import postcss, { type Root, type AtRule, type Rule, type Declaration } from 'postcss';
import type { FontFaceEntry, CssVariable } from './types';
import { parseColor } from './color';

export interface CssSource {
  href: string;
  css: string;
}

export interface ParsedCss {
  fontFaces: FontFaceEntry[];
  variables: CssVariable[];
  breakpoints: { query: string; px: number | null; count: number }[];
  imports: string[];
  sheetsParsed: number;
  bytesParsed: number;
}

/** Total CSS we are willing to run through postcss, across all sheets. */
const MAX_TOTAL_BYTES = 6_000_000;
const MAX_SHEET_BYTES = 2_000_000;

function resolve(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** Pull url(...) targets out of a font-face `src` descriptor. */
function srcUrls(value: string, base: string): { urls: string[]; formats: string[] } {
  const urls: string[] = [];
  const formats: string[] = [];
  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(value)) !== null) {
    if (m[2] && !m[2].startsWith('data:')) urls.push(resolve(m[2].trim(), base));
    else if (m[2]) urls.push('data: (embedded)');
  }
  const fmtRe = /format\(\s*['"]?([a-z0-9-]+)['"]?\s*\)/gi;
  while ((m = fmtRe.exec(value)) !== null) {
    if (!formats.includes(m[1])) formats.push(m[1]);
  }
  // Fall back to the file extension when format() is omitted.
  if (!formats.length) {
    for (const u of urls) {
      const ext = (u.split('?')[0].split('.').pop() || '').toLowerCase();
      if (['woff2', 'woff', 'ttf', 'otf', 'eot'].includes(ext) && !formats.includes(ext)) formats.push(ext);
    }
  }
  return { urls, formats };
}

const unquote = (v: string) => v.trim().replace(/^["']|["']$/g, '');

/**
 * Extract the pixel value a media query switches at.
 * Handles both the classic `(min-width: 48rem)` form and CSS Media Queries
 * Level 4 range syntax (`(width >= 768px)`, `(768px <= width)`), which sites
 * like github.com now ship exclusively.
 */
function breakpointPx(params: string): number | null {
  const patterns = [
    /\(\s*(?:min|max)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)/i,
    /\(\s*width\s*[<>]=?\s*([\d.]+)(px|em|rem)/i,
    /\(\s*([\d.]+)(px|em|rem)\s*[<>]=?\s*width/i,
  ];
  for (const re of patterns) {
    const m = params.match(re);
    if (!m) continue;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) continue;
    return m[2].toLowerCase() === 'px' ? Math.round(n) : Math.round(n * 16);
  }
  return null;
}

export function parseCssBundle(sources: CssSource[]): ParsedCss {
  const fontFaceMap = new Map<string, FontFaceEntry>();
  const varMap = new Map<string, CssVariable>();
  const mediaCounts = new Map<string, number>();
  const imports: string[] = [];

  let sheetsParsed = 0;
  let bytesParsed = 0;

  for (const source of sources) {
    if (bytesParsed >= MAX_TOTAL_BYTES) break;
    const css = source.css.length > MAX_SHEET_BYTES ? source.css.slice(0, MAX_SHEET_BYTES) : source.css;
    if (!css.trim()) continue;

    let root: Root;
    try {
      // `from: undefined` + `map: false` keeps postcss from ever following a
      // sourceMappingURL comment - this CSS comes from arbitrary third-party sites.
      root = postcss.parse(css, { from: undefined, map: false });
    } catch {
      continue; // Malformed CSS in the wild is common; skip the sheet.
    }
    sheetsParsed++;
    bytesParsed += css.length;

    root.walkAtRules((at: AtRule) => {
      if (at.name.toLowerCase() === 'font-face') {
        let family = '';
        let weight = '400';
        let style = 'normal';
        let display = '';
        let urls: string[] = [];
        let formats: string[] = [];

        at.walkDecls((d: Declaration) => {
          const prop = d.prop.toLowerCase();
          if (prop === 'font-family') family = unquote(d.value);
          else if (prop === 'font-weight') weight = d.value.trim();
          else if (prop === 'font-style') style = d.value.trim();
          else if (prop === 'font-display') display = d.value.trim();
          else if (prop === 'src') {
            const r = srcUrls(d.value, source.href);
            urls = urls.concat(r.urls);
            formats = formats.concat(r.formats.filter((f) => !formats.includes(f)));
          }
        });

        if (!family) return;
        const key = `${family.toLowerCase()}|${weight}|${style}`;
        const existing = fontFaceMap.get(key);
        if (existing) {
          for (const u of urls) if (!existing.src.includes(u) && existing.src.length < 6) existing.src.push(u);
          for (const f of formats) if (!existing.formats.includes(f)) existing.formats.push(f);
        } else if (fontFaceMap.size < 200) {
          fontFaceMap.set(key, { family, weight, style, display, formats, src: urls.slice(0, 6) });
        }
      } else if (at.name.toLowerCase() === 'media') {
        const params = at.params.trim().slice(0, 160);
        if (params && !/^\s*(print|speech)\s*$/i.test(params)) {
          mediaCounts.set(params, (mediaCounts.get(params) || 0) + 1);
        }
      } else if (at.name.toLowerCase() === 'import') {
        const u = at.params.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"]/);
        const target = u?.[1] || u?.[2];
        if (target && imports.length < 30) imports.push(resolve(target, source.href));
      }
    });

    root.walkRules((rule: Rule) => {
      if (varMap.size >= 600) return;
      // Only harvest variables from global-ish scopes; component-scoped noise
      // (thousands of hashed selectors) is not useful as a design token.
      const selector = rule.selector.trim();
      if (selector.length > 120) return;
      const isGlobal = /^(:root|html|body|\*|\[data-theme[^\]]*\]|\.dark|\.light|:host|@layer)/i.test(selector);

      rule.walkDecls((d: Declaration) => {
        if (!d.prop.startsWith('--')) return;
        if (!isGlobal && varMap.size > 300) return;
        const name = d.prop.trim();
        const value = d.value.trim().slice(0, 200);
        if (!value) return;
        const scope = selector.slice(0, 60);
        const key = `${name}|${scope}`;
        if (varMap.has(key)) return;
        varMap.set(key, {
          name,
          value,
          hex: parseColor(value)?.hex ?? null,
          scope,
        });
      });
    });
  }

  // Collapse queries that switch at the same width - `(min-width: 640px)` and
  // `not all and (min-width: 640px)` are one breakpoint, listed twice.
  const byPx = new Map<number, { query: string; px: number | null; count: number }>();
  const unkeyed: { query: string; px: number | null; count: number }[] = [];

  for (const [query, count] of mediaCounts) {
    const px = breakpointPx(query);
    if (px === null) {
      unkeyed.push({ query, px, count });
      continue;
    }
    const existing = byPx.get(px);
    if (existing) {
      existing.count += count;
      // Keep the shortest phrasing as the representative query.
      if (query.length < existing.query.length) existing.query = query;
    } else {
      byPx.set(px, { query, px, count });
    }
  }

  const breakpoints = [
    ...Array.from(byPx.values()).sort((a, b) => (a.px ?? 0) - (b.px ?? 0)),
    ...unkeyed.sort((a, b) => b.count - a.count).slice(0, 6),
  ].slice(0, 24);

  const variables = Array.from(varMap.values()).sort((a, b) => {
    // Colors first, then :root scope, then alphabetical - most useful at the top.
    const ac = a.hex ? 0 : 1;
    const bc = b.hex ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const ar = a.scope === ':root' ? 0 : 1;
    const br = b.scope === ':root' ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name);
  });

  return {
    fontFaces: Array.from(fontFaceMap.values()).sort(
      (a, b) => a.family.localeCompare(b.family) || parseInt(a.weight, 10) - parseInt(b.weight, 10),
    ),
    variables,
    breakpoints,
    imports,
    sheetsParsed,
    bytesParsed,
  };
}
