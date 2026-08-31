/**
 * Code that runs INSIDE the target page via page.evaluate().
 *
 * Deliberately kept as a raw string rather than a real function:
 *  - page.evaluate(fn) relies on Function.prototype.toString(), which SWC/webpack
 *    can rewrite (helper injection, scope hoisting) and silently break.
 *  - String.raw keeps regex backslashes intact - a plain template literal would
 *    turn \s into s and corrupt every pattern below.
 *
 * Constraints for anything added here: no backticks and no dollar-brace (they
 * would terminate or interpolate the template), and it must return
 * JSON-serializable data.
 */
export const COLLECT_SCRIPT = String.raw`
(() => {
  const MAX_ELEMENTS = 8000;
  const MAX_PSEUDO_CHECKS = 2000;
  const warnings = [];

  // ---------------------------------------------------------------- helpers
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  /** Frequency counter with a hard key cap so a pathological page cannot blow up memory. */
  function counter(cap) {
    const m = Object.create(null);
    let size = 0;
    return {
      add(key, by) {
        if (key === undefined || key === null || key === '') return;
        if (m[key] === undefined) {
          if (size >= cap) return;
          size++;
          m[key] = 0;
        }
        m[key] += (by === undefined ? 1 : by);
      },
      list(limit) {
        return Object.keys(m)
          .map((k) => ({ key: k, count: Math.round(m[k] * 100) / 100 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit || 200);
      },
    };
  }

  const attr = (el, name) => (el && el.getAttribute(name)) || '';
  const metaOf = (sel) => { const el = document.querySelector(sel); return el ? attr(el, 'content') : ''; };
  const abs = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch (e) { return u || ''; } };

  function isTransparent(c) {
    if (!c) return true;
    if (c === 'transparent' || c === 'none' || c === 'currentcolor') return true;
    const m = c.match(/rgba?\(([^)]+)\)/i);
    if (!m) return false;
    const parts = m[1].split(/[,\/\s]+/).filter(Boolean);
    return parts.length > 3 ? num(parts[3]) < 0.05 : false;
  }

  function selectorFor(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    const raw = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    return s;
  }

  /** Text owned directly by this element, so a wrapper does not steal its children's styling weight. */
  function directText(el) {
    let t = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i];
      if (n.nodeType === 3) t += n.nodeValue;
    }
    return t.replace(/\s+/g, ' ').trim();
  }

  function classHint(el) {
    const raw = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    const toks = raw.trim().split(/\s+/).filter(Boolean);
    for (const t of toks) if (/icon|logo|fa-|bi-|ri-|mdi|lucide|feather|tabler|hero/i.test(t)) return t;
    return toks[0] || '';
  }

  function styleKey(cs, fs) {
    return [cs.fontFamily, fs, cs.fontWeight, cs.lineHeight, cs.letterSpacing, cs.textTransform, cs.color].join('|');
  }

  /**
   * Screen-reader-only text is in the DOM and passes a naive visibility check -
   * the usual .sr-only recipe is a 1x1 clipped box - but nobody sees it, so its
   * default styling must not be reported as the site's caption or body style.
   */
  function visuallyHidden(cs, rect) {
    if (rect.width < 2 || rect.height < 2) return true;
    const clip = cs.clip || '';
    if (/^rect\(\s*(0px|1px)[,\s]/.test(clip)) return true;
    const cp = cs.clipPath || '';
    if (cp === 'inset(50%)' || cp === 'inset(100%)') return true;
    return false;
  }

  // ----------------------------------------------------------- accumulators
  const bgColors = counter(600);
  const textColors = counter(600);
  const borderColors = counter(600);
  const shadowColors = counter(400);
  const svgColors = counter(300);
  const gradients = counter(120);
  const fontSizes = counter(300);
  const fontStacks = counter(120);
  const spacingCounts = counter(300);
  const radiusCounts = counter(200);
  const shadowCounts = counter(200);
  const borderCounts = counter(300);
  const maxWidthCounts = counter(150);
  const classTokens = counter(4000);
  const iconFontGlyphs = counter(150);

  const styleGroups = Object.create(null);
  const rootFontSize = num(getComputedStyle(document.documentElement).fontSize) || 16;

  let gridUsage = 0;
  let flexUsage = 0;
  let elementsScanned = 0;
  let pseudoChecks = 0;

  const ICON_FONT_RE = /icon|font\s*awesome|fontawesome|material|remix|boxicons|ionicons|feather|glyphicon|tabler|phosphor|bootstrap-icons/i;

  // ------------------------------------------------------------- main sweep
  // html and body are included explicitly: the page's dominant background lives
  // on one of them, and querySelectorAll('*') from body would skip both.
  const descendants = document.body ? document.body.querySelectorAll('*') : [];
  const all = [];
  if (document.documentElement) all.push(document.documentElement);
  if (document.body) all.push(document.body);
  for (let i = 0; i < descendants.length; i++) all.push(descendants[i]);
  const total = Math.min(all.length, MAX_ELEMENTS);
  if (all.length > MAX_ELEMENTS) {
    warnings.push({ code: 'element-cap', message: 'Page has ' + all.length + ' elements; analysed the first ' + MAX_ELEMENTS + '.' });
  }

  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const SPACE_PROPS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                       'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap'];

  for (let i = 0; i < total; i++) {
    const el = all[i];
    let cs;
    try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (num(cs.opacity) < 0.05) continue;

    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) continue;
    elementsScanned++;

    // Painted area drives background weight, so a hero section outranks a 2px divider.
    const area = Math.min(w * h, 2000000) / 1000;

    if (!isTransparent(cs.backgroundColor)) bgColors.add(cs.backgroundColor, Math.min(area, 6000));

    const bgImage = cs.backgroundImage;
    if (bgImage && bgImage.indexOf('gradient') !== -1) {
      gradients.add(bgImage.slice(0, 300), 1);
      const gc = bgImage.match(/rgba?\([^)]*\)/gi) || [];
      for (const c of gc) if (!isTransparent(c)) bgColors.add(c, 20);
    }

    // Backgrounds and borders still count for hidden boxes (a 1px rule is real);
    // only the text styling of invisible elements is misleading.
    const txt = visuallyHidden(cs, rect) ? '' : directText(el);
    if (txt) {
      const len = Math.min(txt.length, 400);
      const fs = num(cs.fontSize);
      if (!isTransparent(cs.color)) textColors.add(cs.color, len * Math.max(fs / 16, 0.5));
      fontSizes.add(String(Math.round(fs * 100) / 100), len);
      fontStacks.add(cs.fontFamily, len);

      const key = styleKey(cs, fs);
      let grp = styleGroups[key];
      if (!grp) {
        grp = styleGroups[key] = {
          fontFamily: cs.fontFamily,
          fontSize: fs,
          fontWeight: parseInt(cs.fontWeight, 10) || 400,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform,
          color: cs.color,
          count: 0,
          tags: Object.create(null),
          sample: txt.slice(0, 120),
          selector: selectorFor(el),
        };
      }
      grp.count += len;
      const tag = el.tagName.toLowerCase();
      grp.tags[tag] = (grp.tags[tag] || 0) + 1;
    }

    for (let s = 0; s < 4; s++) {
      const side = SIDES[s];
      const bw = num(cs['border' + side + 'Width']);
      const bstyle = cs['border' + side + 'Style'];
      if (bw > 0 && bstyle !== 'none') {
        const bc = cs['border' + side + 'Color'];
        if (!isTransparent(bc)) borderColors.add(bc, Math.min((s % 2 === 0 ? w : h) / 10, 200));
        borderCounts.add(Math.round(bw * 100) / 100 + 'px ' + bstyle + ' ' + bc, 1);
      }
    }

    const sh = cs.boxShadow;
    if (sh && sh !== 'none') {
      shadowCounts.add(sh.slice(0, 200), 1);
      const sc = sh.match(/rgba?\([^)]*\)/gi) || [];
      for (const c of sc) if (!isTransparent(c)) shadowColors.add(c, 3);
    }

    if (cs.borderRadius && cs.borderRadius !== '0px') radiusCounts.add(cs.borderRadius.slice(0, 80), 1);

    for (const p of SPACE_PROPS) {
      const v = num(cs[p]);
      // Sub-pixel values are layout rounding artefacts, not spacing tokens.
      if (v >= 0.5 && v <= 256) spacingCounts.add(String(Math.round(v * 100) / 100), 1);
    }

    if (cs.maxWidth && cs.maxWidth !== 'none') {
      const mw = num(cs.maxWidth);
      if (mw >= 320 && mw <= 2200) maxWidthCounts.add(String(Math.round(mw)), 1);
    }

    if (cs.display === 'grid' || cs.display === 'inline-grid') gridUsage++;
    else if (cs.display === 'flex' || cs.display === 'inline-flex') flexUsage++;

    const cn = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    if (cn) {
      const toks = cn.split(/\s+/);
      for (let t = 0; t < toks.length && t < 12; t++) if (toks[t]) classTokens.add(toks[t].slice(0, 40), 1);
    }

    // Icon-font glyphs: childless, textless elements whose font or class says "icon".
    if (!el.firstElementChild && !txt && pseudoChecks < MAX_PSEUDO_CHECKS) {
      const ff = cs.fontFamily || '';
      if (ICON_FONT_RE.test(ff) || ICON_FONT_RE.test(cn)) {
        pseudoChecks++;
        let glyph = '';
        try {
          const before = getComputedStyle(el, '::before').content;
          if (before && before !== 'none' && before !== 'normal') glyph = before.replace(/^["']|["']$/g, '');
        } catch (e) { /* pseudo unavailable */ }
        iconFontGlyphs.add(ff.split(',')[0].replace(/["']/g, '').trim() + '|' + glyph + '|' + classHint(el), 1);
      }
    }
  }

  // --------------------------------------------------------- role typography
  const ROLE_SELECTORS = [
    ['h1', 'h1, [role=heading][aria-level="1"]'],
    ['h2', 'h2, [role=heading][aria-level="2"]'],
    ['h3', 'h3, [role=heading][aria-level="3"]'],
    ['h4', 'h4, [role=heading][aria-level="4"]'],
    ['h5', 'h5'],
    ['h6', 'h6'],
    ['body', 'p'],
    ['list item', 'li'],
    ['link', 'p a, li a, main a, article a'],
    ['button', 'button, [role=button], input[type=submit], .btn, .button'],
    ['label', 'label'],
    ['small / caption', 'small, figcaption, caption'],
    ['code', 'code, pre, kbd, samp'],
    ['blockquote', 'blockquote'],
    ['nav link', 'nav a, header a'],
  ];

  /**
   * Find the element that actually owns this text.
   *
   * A link or button is usually a wrapper with no text of its own - measuring it
   * reports the inherited browser defaults (16px / 400 / black) instead of the
   * styles the reader sees. Descend to the first visible descendant that owns a
   * text node and measure that.
   */
  function textBearer(el) {
    if (directText(el)) return el;
    let kids;
    try { kids = el.querySelectorAll('*'); } catch (e) { return null; }
    for (let i = 0; i < kids.length && i < 60; i++) {
      if (!directText(kids[i])) continue;
      let kcs;
      try { kcs = getComputedStyle(kids[i]); } catch (e) { continue; }
      if (!kcs || kcs.display === 'none' || kcs.visibility === 'hidden') continue;
      return kids[i];
    }
    return null;
  }

  function roleStyle(role, selector) {
    let els;
    try { els = document.querySelectorAll(selector); } catch (e) { return null; }
    const groups = Object.create(null);
    let seen = 0;
    for (let i = 0; i < els.length && seen < 400; i++) {
      const el = els[i];
      let ecs;
      try { ecs = getComputedStyle(el); } catch (e) { continue; }
      if (!ecs || ecs.display === 'none' || ecs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (visuallyHidden(ecs, rect)) continue;

      const bearer = textBearer(el);
      if (!bearer) continue;
      let cs = ecs;
      if (bearer !== el) {
        try { cs = getComputedStyle(bearer); } catch (e) { continue; }
      }
      const t = directText(bearer);
      if (!t) continue;
      seen++;
      const len = Math.min(t.length, 300);
      const fs = num(cs.fontSize);
      const key = styleKey(cs, fs);
      let g = groups[key];
      if (!g) {
        g = groups[key] = {
          role: role,
          selector: bearer === el ? selectorFor(el) : selectorFor(el) + ' > ' + selectorFor(bearer),
          fontFamily: cs.fontFamily,
          fontSize: fs,
          fontWeight: parseInt(cs.fontWeight, 10) || 400,
          lineHeightRaw: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform,
          color: cs.color,
          count: 0,
          sampleText: t.slice(0, 140),
        };
      }
      g.count += len;
    }
    const best = Object.keys(groups).map((k) => groups[k]).sort((a, b) => b.count - a.count)[0];
    return best || null;
  }

  const typeRoles = [];
  for (const pair of ROLE_SELECTORS) {
    const r = roleStyle(pair[0], pair[1]);
    if (r) typeRoles.push(r);
  }

  // ------------------------------------------------------------- components
  const COMPONENT_PROPS = ['backgroundColor', 'color', 'borderRadius', 'padding', 'border', 'boxShadow',
                           'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform',
                           'minHeight', 'backgroundImage', 'gap'];

  function componentStyles(name, selector, maxVariants) {
    let els;
    try { els = document.querySelectorAll(selector); } catch (e) { return []; }
    const groups = Object.create(null);
    for (let i = 0; i < els.length && i < 300; i++) {
      const el = els[i];
      let cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      const styles = {};
      for (const p of COMPONENT_PROPS) {
        const v = cs[p];
        if (!v || v === 'none' || v === 'normal' || v === '0px' || v === 'auto') continue;
        if (p === 'backgroundImage' && v.indexOf('gradient') === -1) continue;
        styles[p] = String(v).slice(0, 200);
      }
      const key = Object.keys(styles).map((k) => k + ':' + styles[k]).join(';');
      if (!key) continue;
      let g = groups[key];
      if (!g) {
        g = groups[key] = {
          name: name,
          selector: selectorFor(el),
          sampleText: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          styles: styles,
          count: 0,
          hasBg: !isTransparent(cs.backgroundColor),
        };
      }
      g.count++;
    }
    return Object.keys(groups)
      .map((k) => groups[k])
      // Prefer filled variants: a primary button is more informative than a ghost one.
      .sort((a, b) => (b.hasBg ? 1 : 0) - (a.hasBg ? 1 : 0) || b.count - a.count)
      .slice(0, maxVariants || 1)
      .map((g, idx) => {
        if (idx > 0) g.name = g.name + ' (variant ' + (idx + 1) + ')';
        return g;
      });
  }

  const components = []
    .concat(componentStyles('Button', 'button, [role=button], input[type=submit], .btn, .button, a[class*=btn], a[class*=button]', 2))
    .concat(componentStyles('Input field', 'input[type=text], input[type=email], input[type=search], input[type=password], input:not([type]), textarea, select', 1))
    .concat(componentStyles('Card', '[class*=card], [class*=Card], article', 1))
    .concat(componentStyles('Badge / tag', '[class*=badge], [class*=tag], [class*=chip], [class*=pill]', 1))
    .concat(componentStyles('Header / nav', 'header, nav, [role=banner]', 1))
    .concat(componentStyles('Footer', 'footer, [role=contentinfo]', 1));

  // ------------------------------------------------------------------ icons
  const icons = [];
  const svgSeen = Object.create(null);
  const svgs = document.querySelectorAll('svg');
  for (let i = 0; i < svgs.length && icons.length < 80; i++) {
    const sv = svgs[i];
    const r = sv.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.width > 512 || r.height > 512) continue;
    const html = sv.outerHTML || '';
    // Never truncate SVG markup - a cut-off path is invalid XML that will not
    // render anywhere. Oversized icons are skipped entirely instead.
    if (!html || html.length > 12000) continue;
    // Normalise away instance-specific noise so repeated icons collapse into one entry.
    const norm = html.replace(/\s+/g, ' ').replace(/ (id|aria-labelledby|class|style)="[^"]*"/g, '').trim().slice(0, 400);
    if (svgSeen[norm]) { svgSeen[norm].count++; continue; }
    let scs;
    try { scs = getComputedStyle(sv); } catch (e) { continue; }
    const titleEl = sv.querySelector('title');
    const entry = {
      kind: 'inline-svg',
      svg: html,
      url: null,
      label: attr(sv, 'aria-label') || (titleEl ? (titleEl.textContent || '').trim() : '') || attr(sv, 'data-icon') || classHint(sv) || 'icon',
      width: Math.round(r.width),
      height: Math.round(r.height),
      strokeWidth: num(scs.strokeWidth) || null,
      color: scs.color || null,
      count: 1,
    };
    svgSeen[norm] = entry;
    icons.push(entry);
    if (scs.fill && scs.fill !== 'none' && !isTransparent(scs.fill)) svgColors.add(scs.fill, 3);
    if (scs.stroke && scs.stroke !== 'none' && !isTransparent(scs.stroke)) svgColors.add(scs.stroke, 3);
  }

  const imgs = document.querySelectorAll('img');
  let imgIcons = 0;
  for (let i = 0; i < imgs.length && imgIcons < 30; i++) {
    const im = imgs[i];
    const src = attr(im, 'src') || attr(im, 'data-src');
    if (!src) continue;
    const r = im.getBoundingClientRect();
    const isSvg = /\.svg(\?|$)/i.test(src);
    const isSmall = r.width > 0 && r.width <= 64 && r.height <= 64;
    if (!isSvg && !isSmall) continue;
    imgIcons++;
    icons.push({
      kind: 'img',
      svg: null,
      url: abs(src),
      label: attr(im, 'alt') || classHint(im) || (src.split('/').pop() || '').split('?')[0],
      width: Math.round(r.width),
      height: Math.round(r.height),
      strokeWidth: null,
      color: null,
      count: 1,
    });
  }

  for (const g of iconFontGlyphs.list(40)) {
    const parts = g.key.split('|');
    icons.push({
      kind: 'icon-font',
      svg: null,
      url: null,
      label: (parts[2] || parts[1] || 'glyph') + (parts[1] ? ' (' + parts[1] + ')' : ''),
      width: 0,
      height: 0,
      strokeWidth: null,
      color: parts[0] || null,
      count: g.count,
    });
  }

  // ------------------------------------------------------------------- meta
  const favicons = [];
  document.querySelectorAll('link[rel*="icon" i]').forEach((l) => {
    if (favicons.length < 12) {
      favicons.push({ rel: attr(l, 'rel'), href: abs(attr(l, 'href')), sizes: attr(l, 'sizes'), type: attr(l, 'type') });
    }
  });

  let logo = null;
  const LOGO_SELECTORS = ['header [class*=logo i] img', '[class*=logo i] img', 'a[href="/"] img', 'header img', 'nav img',
                          'header [class*=logo i] svg', '[class*=logo i] svg', 'header svg'];
  for (const sel of LOGO_SELECTORS) {
    if (logo) break;
    let cands;
    try { cands = document.querySelectorAll(sel); } catch (e) { continue; }
    for (let i = 0; i < cands.length; i++) {
      const el = cands[i];
      const r = el.getBoundingClientRect();
      if (r.width < 16 || r.height < 8) continue;
      const isSvg = el.tagName.toLowerCase() === 'svg';
      logo = {
        kind: isSvg ? 'svg' : 'img',
        src: isSvg ? null : abs(attr(el, 'src')),
        svg: isSvg ? (el.outerHTML || '').slice(0, 8000) : null,
        alt: attr(el, 'alt') || attr(el, 'aria-label') || '',
      };
      break;
    }
  }

  // -------------------------------------------------------- css custom props
  const cssVars = Object.create(null);
  function collectVars(el, scope) {
    if (!el || typeof el.computedStyleMap !== 'function') return;
    try {
      for (const entry of el.computedStyleMap()) {
        const prop = entry[0];
        if (prop.slice(0, 2) !== '--') continue;
        if (cssVars[prop]) continue;
        const raw = entry[1];
        const v = (Array.isArray(raw) ? raw.map((x) => x.toString()).join(', ') : String(raw)).trim();
        if (v) cssVars[prop] = { name: prop, value: v.slice(0, 200), scope: scope };
      }
    } catch (e) { /* computedStyleMap does not expose custom props here */ }
  }
  collectVars(document.documentElement, ':root');
  collectVars(document.body, 'body');

  // ------------------------------------------------------------- stylesheets
  // Linked CSS is captured server-side from the network. Only inline <style>
  // blocks need ferrying out of the page.
  const inlineStyles = [];
  let inlineBudget = 600000;
  document.querySelectorAll('style').forEach((s) => {
    const t = s.textContent || '';
    if (t && inlineBudget > 0) {
      inlineStyles.push(t.slice(0, Math.min(t.length, inlineBudget)));
      inlineBudget -= t.length;
    }
  });

  let sheetsBlocked = 0;
  let sheetsReadable = 0;
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      if (document.styleSheets[i].cssRules) sheetsReadable++;
    } catch (e) { sheetsBlocked++; }
  }

  const loadedFonts = [];
  try {
    document.fonts.forEach((f) => {
      if (loadedFonts.length < 80) {
        loadedFonts.push({ family: f.family, weight: f.weight, style: f.style, status: f.status, display: f.display || '' });
      }
    });
  } catch (e) { /* FontFaceSet unavailable */ }

  const resourceLinks = [];
  document.querySelectorAll('link[href]').forEach((l) => {
    if (resourceLinks.length < 60) {
      resourceLinks.push({ rel: attr(l, 'rel'), href: abs(attr(l, 'href')), as: attr(l, 'as') });
    }
  });

  const scriptSrcs = [];
  document.querySelectorAll('script[src]').forEach((s) => {
    if (scriptSrcs.length < 60) scriptSrcs.push(abs(attr(s, 'src')));
  });

  // ------------------------------------------------------------------- tech
  const html = document.documentElement.outerHTML.slice(0, 300000);
  const frameworks = [];
  const cssFrameworks = [];
  const iconSets = [];
  const fontProviders = [];
  const pushIf = (arr, cond, name) => { if (cond && arr.indexOf(name) === -1) arr.push(name); };

  pushIf(frameworks, !!(window.__NEXT_DATA__ || document.querySelector('#__next') || /\/_next\//.test(html)), 'Next.js');
  pushIf(frameworks, !!(window.__NUXT__ || document.querySelector('#__nuxt') || /\/_nuxt\//.test(html)), 'Nuxt');
  pushIf(frameworks, !!document.querySelector('#___gatsby'), 'Gatsby');
  pushIf(frameworks, !!document.querySelector('astro-island'), 'Astro');
  pushIf(frameworks, !!document.querySelector('[ng-version]'), 'Angular');
  pushIf(frameworks, !!(document.querySelector('[data-reactroot]') || window.__REACT_DEVTOOLS_GLOBAL_HOOK__), 'React');
  pushIf(frameworks, !!(window.Vue || document.querySelector('[data-v-app]') || /data-v-[0-9a-f]{8}/.test(html)), 'Vue');
  pushIf(frameworks, /class="[^"]*svelte-[a-z0-9]+/.test(html), 'Svelte');
  pushIf(frameworks, /wp-content|wp-includes/.test(html), 'WordPress');
  pushIf(frameworks, !!window.Shopify || /cdn\.shopify\.com/.test(html), 'Shopify');
  pushIf(frameworks, !!document.querySelector('[data-wf-page], [data-wf-site]'), 'Webflow');
  pushIf(frameworks, !!window.Squarespace || /squarespace/i.test(html), 'Squarespace');
  pushIf(frameworks, /static\.parastorage\.com|wixstatic/i.test(html), 'Wix');
  pushIf(frameworks, /cdn\.sanity\.io/i.test(html), 'Sanity (content)');

  const varNames = Object.keys(cssVars);
  const hasVarPrefix = (p) => varNames.some((n) => n.indexOf(p) === 0);
  const classList = classTokens.list(4000).map((c) => c.key);
  const classHas = (re) => classList.some((c) => re.test(c));

  pushIf(cssFrameworks, hasVarPrefix('--tw-') ||
    (classHas(/^(flex|grid|hidden)$/) && classHas(/^(text|bg|px|py|mt|mb|gap|rounded)-/)), 'Tailwind CSS');
  pushIf(cssFrameworks, hasVarPrefix('--bs-') || classHas(/^col-(sm|md|lg|xl)-/), 'Bootstrap');
  pushIf(cssFrameworks, classHas(/^Mui[A-Z]/), 'MUI');
  pushIf(cssFrameworks, classHas(/^chakra-/), 'Chakra UI');
  pushIf(cssFrameworks, classHas(/^ant-/), 'Ant Design');
  pushIf(cssFrameworks, classHas(/^(is-|has-)/) && /bulma/i.test(html), 'Bulma');
  pushIf(cssFrameworks, /sc-[a-zA-Z]{6}/.test(html), 'styled-components');
  pushIf(cssFrameworks, classHas(/^css-[a-z0-9]{6,}$/), 'Emotion / CSS-in-JS');

  const allHrefs = resourceLinks.map((l) => l.href).join(' ') + ' ' + scriptSrcs.join(' ');
  pushIf(fontProviders, /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(allHrefs), 'Google Fonts');
  pushIf(fontProviders, /use\.typekit\.net|typekit/.test(allHrefs), 'Adobe Fonts (Typekit)');
  pushIf(fontProviders, /fonts\.bunny\.net/.test(allHrefs), 'Bunny Fonts');
  pushIf(fontProviders, /fontshare/.test(allHrefs), 'Fontshare');
  pushIf(fontProviders, /fontsource/.test(allHrefs), 'Fontsource');

  const fontBlob = fontStacks.list(60).map((f) => f.key).join(' ').toLowerCase();
  pushIf(iconSets, /font\s*awesome/.test(fontBlob) || classHas(/^fa[srlbd]?$/) || classHas(/^fa-/), 'Font Awesome');
  pushIf(iconSets, /material icons|material symbols/.test(fontBlob), 'Material Icons');
  pushIf(iconSets, classHas(/^bi-/) || /bootstrap-icons/.test(fontBlob), 'Bootstrap Icons');
  pushIf(iconSets, classHas(/^ri-/) || /remixicon/.test(fontBlob), 'Remix Icon');
  pushIf(iconSets, classHas(/^lucide/), 'Lucide');
  pushIf(iconSets, classHas(/^feather/), 'Feather');
  pushIf(iconSets, classHas(/^ti-/) || /tabler/.test(fontBlob), 'Tabler Icons');
  pushIf(iconSets, classHas(/^hero(icon)?-/), 'Heroicons');
  pushIf(iconSets, /phosphor/.test(fontBlob) || classHas(/^ph-/), 'Phosphor');

  // ----------------------------------------------------------------- layout
  const htmlCs = getComputedStyle(document.documentElement);
  const bodyCs = document.body ? getComputedStyle(document.body) : htmlCs;
  let pageBackground = bodyCs.backgroundColor;
  if (isTransparent(pageBackground)) pageBackground = htmlCs.backgroundColor;
  if (isTransparent(pageBackground)) pageBackground = 'rgb(255, 255, 255)';

  return {
    meta: {
      finalUrl: location.href,
      domain: location.hostname,
      title: (document.title || '').trim(),
      description: metaOf('meta[name="description" i]') || metaOf('meta[property="og:description" i]'),
      lang: document.documentElement.lang || '',
      charset: document.characterSet || '',
      viewport: metaOf('meta[name="viewport" i]'),
      themeColor: metaOf('meta[name="theme-color" i]'),
      ogImage: abs(metaOf('meta[property="og:image" i]')),
      generator: metaOf('meta[name="generator" i]'),
      favicons: favicons,
      logo: logo,
    },
    tech: { frameworks: frameworks, cssFrameworks: cssFrameworks, fontProviders: fontProviders, iconSets: iconSets },
    colors: {
      background: bgColors.list(80),
      text: textColors.list(80),
      border: borderColors.list(60),
      shadow: shadowColors.list(40),
      svg: svgColors.list(40),
      gradients: gradients.list(20),
      pageBackground: pageBackground,
    },
    typography: {
      rootFontSize: rootFontSize,
      roles: typeRoles,
      sizes: fontSizes.list(60),
      stacks: fontStacks.list(30),
      groups: Object.keys(styleGroups).map((k) => styleGroups[k]).sort((a, b) => b.count - a.count).slice(0, 40),
      loadedFonts: loadedFonts,
    },
    spacing: spacingCounts.list(60),
    radii: radiusCounts.list(30),
    shadows: shadowCounts.list(24),
    borders: borderCounts.list(30),
    maxWidths: maxWidthCounts.list(20),
    icons: icons,
    components: components,
    cssVariables: Object.keys(cssVars).map((k) => cssVars[k]).slice(0, 400),
    inlineStyles: inlineStyles,
    resourceLinks: resourceLinks,
    layout: {
      pageBackground: pageBackground,
      gridUsage: gridUsage,
      flexUsage: flexUsage,
      documentHeight: document.documentElement.scrollHeight,
    },
    stats: {
      elementsScanned: elementsScanned,
      sheetsReadable: sheetsReadable,
      sheetsBlocked: sheetsBlocked,
    },
    warnings: warnings,
  };
})()
`;

/** Shape returned by COLLECT_SCRIPT. Loosely typed - analyze.ts is the validator. */
export interface RawCollected {
  meta: any;
  tech: any;
  colors: any;
  typography: any;
  spacing: { key: string; count: number }[];
  radii: { key: string; count: number }[];
  shadows: { key: string; count: number }[];
  borders: { key: string; count: number }[];
  maxWidths: { key: string; count: number }[];
  icons: any[];
  components: any[];
  cssVariables: { name: string; value: string; scope: string }[];
  inlineStyles: string[];
  resourceLinks: { rel: string; href: string; as: string }[];
  layout: any;
  stats: any;
  warnings: { code: string; message: string }[];
}
