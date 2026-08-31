import type { RawCollected } from './page-script';
import type { ParsedCss } from './css-parse';
import { parseColor, colorName, contrast, wcagRating, flatten, type ParsedColor } from './color';
import type {
  ColorEntry,
  ColorRole,
  ComponentStyle,
  DesignReport,
  FontFamilyEntry,
  IconEntry,
  ScaleStep,
  SemanticTokens,
  SpacingEntry,
  TypeRole,
} from './types';

interface Counted {
  key: string;
  count: number;
}

const asCounted = (v: unknown): Counted[] =>
  Array.isArray(v) ? (v as Counted[]).filter((x) => x && typeof x.key === 'string') : [];

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

/**
 * Strip anything executable from third-party SVG markup.
 *
 * This is defence in depth only - the UI renders icons through an <img> with a
 * data: URI, where the SVG spec forbids scripting regardless. The cleanup here
 * protects whoever copies the markup out of the report into their own page.
 */
export function sanitizeSvg(svg: string): string {
  let out = svg
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*script[^>]*\/?>/gi, '')
    .replace(/<\s*foreignObject[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, '')
    .replace(/<\s*(iframe|embed|object|animate|set)\b[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/((?:xlink:)?href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '')
    .replace(/(["'\s])javascript:/gi, '$1')
    .trim();

  // Inline SVG inherits the XML namespace from the HTML parser, so most sites
  // omit xmlns. Standalone the attribute is mandatory: without it the markup
  // will not render in an <img>, nor open as a .svg file once copied out.
  const openTag = out.slice(0, out.indexOf('>') + 1);
  if (/^<svg\b/i.test(out) && !/\sxmlns\s*=/i.test(openTag)) {
    out = out.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (/xlink:/i.test(out) && !/\sxmlns:xlink\s*=/i.test(out.slice(0, out.indexOf('>') + 1))) {
    out = out.replace(/^<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  // Sized by CSS on the source page, an icon often carries only a viewBox. On
  // its own that leaves the file with no intrinsic dimensions, so give it a
  // concrete size from the viewBox.
  const root = out.slice(0, out.indexOf('>') + 1);
  if (/^<svg\b/i.test(out) && !/\swidth\s*=/i.test(root) && !/\sheight\s*=/i.test(root)) {
    const vb = root.match(/viewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (vb) out = out.replace(/^<svg\b/i, `<svg width="${vb[1]}" height="${vb[2]}"`);
  }

  return out;
}

// --------------------------------------------------------------------- colors

/**
 * Merge the per-role color tallies into one ranked palette.
 *
 * Each role is normalised to its own maximum before weighting, because the raw
 * numbers are on wildly different scales - backgrounds are counted by painted
 * area, text by character count. Summing them raw would let one full-page
 * background drown out every accent on the site.
 */
function buildColors(rawColors: RawCollected['colors'], pageBg: ParsedColor | null): ColorEntry[] {
  const ROLE_WEIGHT: [ColorRole, number][] = [
    ['background', 100],
    ['text', 80],
    ['border', 40],
    ['svg', 30],
    ['shadow', 20],
  ];

  const merged = new Map<
    string,
    { parsed: ParsedColor; usage: number; roles: Set<ColorRole>; roleUsage: Partial<Record<ColorRole, number>> }
  >();

  for (const [role, weight] of ROLE_WEIGHT) {
    const list = asCounted(rawColors?.[role]);
    if (!list.length) continue;
    const max = Math.max(...list.map((c) => c.count)) || 1;

    for (const item of list) {
      const parsed = parseColor(item.key);
      if (!parsed) continue;
      // Fully transparent colors carry no design information.
      if (parsed.alpha < 0.05) continue;

      const id = parsed.hex.toLowerCase();
      const existing = merged.get(id);
      // Scale by alpha: a 5%-opacity overlay covering the whole page contributes
      // far less to the visual design than an opaque fill of the same area.
      const contribution = (item.count / max) * weight * parsed.alpha;
      if (existing) {
        existing.usage += contribution;
        existing.roles.add(role);
        existing.roleUsage[role] = (existing.roleUsage[role] ?? 0) + contribution;
      } else {
        merged.set(id, {
          parsed,
          usage: contribution,
          roles: new Set([role]),
          roleUsage: { [role]: contribution },
        });
      }
    }
  }

  const entries = Array.from(merged.values());
  if (!entries.length) return [];
  const maxUsage = Math.max(...entries.map((e) => e.usage)) || 1;

  return entries
    .map(({ parsed, usage, roles, roleUsage }): ColorEntry => {
      const onBg = pageBg
        ? (() => {
            const c = contrast(flatten(parsed, pageBg), pageBg.color);
            return { contrast: c, rating: wcagRating(c) };
          })()
        : null;

      return {
        hex: parsed.hex,
        rgb: parsed.rgb,
        hsl: parsed.hsl,
        oklch: parsed.oklch,
        alpha: parsed.alpha,
        name: colorName(parsed),
        usage: round((usage / maxUsage) * 100, 1),
        roles: Array.from(roles),
        roleUsage,
        contrastOnWhite: contrast(parsed.color, '#ffffff'),
        contrastOnBlack: contrast(parsed.color, '#000000'),
        onPageBackground: onBg,
      };
    })
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 40);
}

function buildSemanticTokens(
  colors: ColorEntry[],
  pageBg: ParsedColor | null,
  components: ComponentStyle[],
): SemanticTokens {
  // Rank every slot by usage *in that role*, never by total usage - white is the
  // most-used colour on most sites and would otherwise win every category.
  const by = (role: ColorRole) => (c: ColorEntry) => c.roleUsage[role] ?? 0;
  const topBy = (role: ColorRole, filter: (c: ColorEntry) => boolean = () => true) =>
    colors.filter((c) => by(role)(c) > 0 && filter(c)).sort((a, b) => by(role)(b) - by(role)(a))[0]?.hex ?? null;

  const background = pageBg?.hex ?? topBy('background');

  // A surface is a panel you can actually see - translucent wash layers are
  // overlays, not surfaces, so require near-opacity.
  const surface = topBy('background', (c) => c.hex !== background && c.alpha >= 0.9);

  const texts = colors.filter((c) => (c.roleUsage.text ?? 0) > 0 && c.onPageBackground);
  // Prefer the most-used text colour that is actually readable; fall back to the
  // highest-contrast one if nothing clears AA.
  const readable = texts.filter((c) => c.onPageBackground!.contrast >= 4.5);
  const textPrimary =
    (readable.length ? readable : texts).sort((a, b) => by('text')(b) - by('text')(a))[0]?.hex ??
    [...texts].sort((a, b) => b.onPageBackground!.contrast - a.onPageBackground!.contrast)[0]?.hex ??
    null;

  // Muted text: still legible, but genuinely *less* contrast than the primary.
  // Without that upper bound, pure black outranks a site's real #212529 body
  // colour and gets reported as the muted tone.
  const primaryContrast = texts.find((c) => c.hex === textPrimary)?.onPageBackground!.contrast ?? Infinity;
  const textMuted =
    texts
      .filter(
        (c) =>
          c.hex !== textPrimary &&
          c.onPageBackground!.contrast >= 2.5 &&
          c.onPageBackground!.contrast < primaryContrast,
      )
      .sort((a, b) => by('text')(b) - by('text')(a))[0]?.hex ?? null;

  const border = topBy('border');

  // A filled button's background is the strongest available signal for "primary",
  // but only when it is a real call-to-action. A #f8f9fa secondary button is
  // technically "filled" while being visually indistinguishable from the page,
  // so require it to actually stand out against the background.
  let primary: string | null = null;
  for (const candidate of components.filter((c) => c.name.startsWith('Button') && c.styles.backgroundColor)) {
    const p = parseColor(candidate.styles.backgroundColor);
    if (!p || p.alpha < 0.5) continue;
    if (p.s <= 0.15 || p.l <= 0.15 || p.l >= 0.9) continue;
    if (pageBg && contrast(flatten(p, pageBg), pageBg.color) < 1.5) continue;
    primary = p.hex;
    break;
  }

  const saturated = colors
    .filter((c) => {
      const p = parseColor(c.hex);
      return p && p.s > 0.25 && p.l > 0.12 && p.l < 0.88 && c.hex !== background;
    })
    // A brand colour paints something - a button, an icon, a rule. A saturated
    // colour that only ever appears as text is usually syntax highlighting.
    .sort((a, b) => {
      const paints = (c: ColorEntry) =>
        c.roles.some((r) => r === 'background' || r === 'svg' || r === 'border') ? 0 : 1;
      return paints(a) - paints(b) || b.usage - a.usage;
    });

  if (!primary) primary = saturated[0]?.hex ?? null;
  const accent = saturated.find((c) => c.hex !== primary)?.hex ?? null;

  return { background, surface, textPrimary, textMuted, border, primary, accent };
}

// ----------------------------------------------------------------- typography

const GENERIC_FAMILIES = new Set([
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif',
  'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'inherit',
  'segoe ui', 'roboto', 'helvetica', 'helvetica neue', 'arial', 'georgia', 'times', 'times new roman',
  'courier', 'courier new', 'verdana', 'tahoma', 'consolas', 'menlo', 'monaco', 'emoji',
  'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji',
]);

const firstFamily = (stack: string): string =>
  (stack.split(',')[0] || '').trim().replace(/^["']|["']$/g, '');

function buildFontFamilies(
  raw: RawCollected['typography'],
  css: ParsedCss,
  resourceLinks: RawCollected['resourceLinks'],
  typeRoles: TypeRole[],
): FontFamilyEntry[] {
  const stacks = asCounted(raw?.stacks);
  if (!stacks.length) return [];
  const groups: { fontFamily: string; fontSize: number; fontWeight: number }[] = Array.isArray(raw?.groups)
    ? raw.groups
    : [];

  const hrefs = (resourceLinks || []).map((l) => l.href).join(' ') + ' ' + (css.imports || []).join(' ');
  const faceByFamily = new Map<string, typeof css.fontFaces>();
  for (const f of css.fontFaces) {
    const k = f.family.toLowerCase();
    if (!faceByFamily.has(k)) faceByFamily.set(k, []);
    faceByFamily.get(k)!.push(f);
  }

  return stacks.slice(0, 12).map((s): FontFamilyEntry => {
    const primary = firstFamily(s.key);
    const key = primary.toLowerCase();
    const faces = faceByFamily.get(key) || [];
    const webfontUrls = Array.from(new Set(faces.flatMap((f) => f.src))).slice(0, 8);

    let source: FontFamilyEntry['source'] = 'unknown';
    if (webfontUrls.some((u) => /fonts\.gstatic\.com/.test(u)) || new RegExp(primary.replace(/\s+/g, '\\+'), 'i').test(hrefs) && /googleapis/.test(hrefs)) {
      source = 'google';
    } else if (webfontUrls.some((u) => /typekit|adobe/.test(u))) {
      source = 'adobe';
    } else if (webfontUrls.length) {
      source = 'self-hosted';
    } else if (GENERIC_FAMILIES.has(key)) {
      source = 'system';
    }

    const matching = groups.filter((g) => firstFamily(g.fontFamily).toLowerCase() === key);
    const weightsUsed = Array.from(new Set(matching.map((g) => g.fontWeight))).sort((a, b) => a - b);
    const sizesUsed = Array.from(new Set(matching.map((g) => round(g.fontSize, 1)))).sort((a, b) => a - b);
    const roles = typeRoles.filter((r) => firstFamily(r.fontFamily).toLowerCase() === key).map((r) => r.role);

    return {
      stack: s.key,
      primary,
      usage: s.count,
      weightsUsed: weightsUsed.length ? weightsUsed : Array.from(new Set(faces.map((f) => parseInt(f.weight, 10)).filter(Boolean))),
      sizesUsed: sizesUsed.slice(0, 14),
      roles,
      source,
      webfontUrls,
    };
  });
}

function buildTypeRoles(raw: RawCollected['typography']): TypeRole[] {
  const roles = Array.isArray(raw?.roles) ? raw.roles : [];
  const rootPx = Number(raw?.rootFontSize) || 16;

  return roles.map((r: Record<string, unknown>): TypeRole => {
    const fontSize = Number(r.fontSize) || 0;
    const lhRaw = String(r.lineHeightRaw ?? 'normal');
    const lhNum = parseFloat(lhRaw);
    // `line-height: normal` has no computed px value; browsers land near 1.2.
    const lineHeight = isFinite(lhNum) ? lhNum : round(fontSize * 1.2, 1);

    return {
      role: String(r.role ?? ''),
      selector: String(r.selector ?? ''),
      fontFamily: String(r.fontFamily ?? ''),
      fontSize: round(fontSize, 1),
      fontSizeRem: round(fontSize / rootPx, 3),
      fontWeight: Number(r.fontWeight) || 400,
      lineHeight: round(lineHeight, 1),
      lineHeightRaw: lhRaw,
      lineHeightRatio: fontSize ? round(lineHeight / fontSize, 2) : 0,
      letterSpacing: String(r.letterSpacing ?? 'normal'),
      textTransform: String(r.textTransform ?? 'none'),
      color: parseColor(String(r.color ?? ''))?.hex ?? String(r.color ?? ''),
      count: Number(r.count) || 0,
      sampleText: String(r.sampleText ?? ''),
    };
  });
}

function buildTypeScale(raw: RawCollected['typography']): ScaleStep[] {
  const sizes = asCounted(raw?.sizes);
  if (!sizes.length) return [];
  const rootPx = Number(raw?.rootFontSize) || 16;
  const total = sizes.reduce((a, b) => a + b.count, 0);

  const steps = sizes
    // Drop long-tail one-off sizes so the scale reflects intent, not accidents.
    .filter((s) => s.count / total > 0.002)
    .map((s) => ({ px: parseFloat(s.key), count: s.count }))
    .filter((s) => isFinite(s.px) && s.px > 0)
    .sort((a, b) => a.px - b.px)
    .slice(0, 18);

  return steps.map((s, i) => ({
    px: round(s.px, 1),
    rem: round(s.px / rootPx, 3),
    count: s.count,
    ratio: i > 0 && steps[i - 1].px ? round(s.px / steps[i - 1].px, 3) : null,
  }));
}

// -------------------------------------------------------------------- spacing

function buildSpacing(raw: Counted[]): { baseUnit: number | null; steps: SpacingEntry[] } {
  const values = raw
    .map((s) => ({ px: parseFloat(s.key), count: s.count }))
    .filter((s) => isFinite(s.px) && s.px > 0);

  if (!values.length) return { baseUnit: null, steps: [] };

  const total = values.reduce((a, b) => a + b.count, 0);

  // Prefer the largest base unit that still explains most of the spacing used.
  let baseUnit: number | null = null;
  for (const candidate of [8, 6, 5, 4, 3, 2]) {
    const covered = values
      .filter((v) => Math.abs(v.px / candidate - Math.round(v.px / candidate)) < 0.06)
      .reduce((a, b) => a + b.count, 0);
    if (covered / total >= 0.7) {
      baseUnit = candidate;
      break;
    }
  }

  const steps = values
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .sort((a, b) => a.px - b.px)
    .map((v): SpacingEntry => ({
      px: round(v.px, 1),
      rem: round(v.px / 16, 3),
      count: v.count,
      multiple:
        baseUnit && Math.abs(v.px / baseUnit - Math.round(v.px / baseUnit)) < 0.06
          ? Math.round(v.px / baseUnit)
          : null,
    }));

  return { baseUnit, steps };
}

/**
 * "Pill" radii compute to absurd numbers - Tailwind's rounded-full is
 * `calc(infinity * 1px)`, which getComputedStyle reports as 3.35544e+07px.
 * Collapse anything past the pill threshold to a value you can paste.
 */
export function normalizeRadius(value: string): string {
  return value.replace(/(\d+(?:\.\d+)?(?:e[+-]?\d+)?)px/gi, (match, n) =>
    parseFloat(n) >= 9999 ? '9999px' : match,
  );
}

// ---------------------------------------------------------------------- icons

function buildIcons(raw: unknown[]): IconEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((raw_: unknown): IconEntry => {
      const i = (raw_ ?? {}) as Record<string, unknown>;
      const svg = typeof i.svg === 'string' ? sanitizeSvg(i.svg) : null;
      return {
        kind: (i.kind as IconEntry['kind']) ?? 'inline-svg',
        svg: svg || null,
        url: typeof i.url === 'string' ? i.url : null,
        label: String(i.label ?? 'icon').slice(0, 80),
        width: Number(i.width) || 0,
        height: Number(i.height) || 0,
        strokeWidth: i.strokeWidth === null ? null : Number(i.strokeWidth) || null,
        color: typeof i.color === 'string' ? parseColor(i.color)?.hex ?? i.color : null,
        count: Number(i.count) || 1,
      };
    })
    .filter((i) => i.svg || i.url || i.kind === 'icon-font')
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------- css custom props

type VarEntry = { name: string; value: string; hex: string | null; scope: string };

const hexChannels = (hex: string) => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255,
  };
};

/**
 * Are two values for the same variable name the same declaration?
 *
 * Colours need a tolerance rather than string or hex equality. Chrome
 * serialises a computed custom property as lab(86.4% 6.1 78.4) where the author
 * wrote #ffd236, and converting that back to sRGB lands a digit or two off. A
 * real theme override (light vs dark) differs by far more than this threshold.
 */
function sameDeclaration(a: VarEntry, b: VarEntry): boolean {
  if (a.hex && b.hex) {
    if (a.hex === b.hex) return true;
    const x = hexChannels(a.hex);
    const y = hexChannels(b.hex);
    return (
      Math.abs(x.r - y.r) <= 6 && Math.abs(x.g - y.g) <= 6 && Math.abs(x.b - y.b) <= 6 && Math.abs(x.a - y.a) <= 6
    );
  }
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').replace(/(^|[^\d])0+\./g, '$1.').trim();
  return norm(a.value) === norm(b.value);
}

/** Keep the spelling a developer would paste: the author's hex, not lab(). */
const isComputedNotation = (v: string) => /^(lab|lch|oklab|color)\(/i.test(v.trim());

function mergeVariable(map: Map<string, VarEntry[]>, incoming: VarEntry): void {
  const kept = map.get(incoming.name);
  if (!kept) {
    map.set(incoming.name, [incoming]);
    return;
  }
  for (let i = 0; i < kept.length; i++) {
    if (sameDeclaration(kept[i], incoming)) {
      if (isComputedNotation(kept[i].value) && !isComputedNotation(incoming.value)) kept[i] = incoming;
      return;
    }
  }
  // Cap per-name variants so a heavily themed site cannot explode the list.
  if (kept.length < 6) kept.push(incoming);
}

// ------------------------------------------------------------------ assembly

export function buildReport(
  raw: RawCollected,
  css: ParsedCss,
  extras: { requestedUrl: string; screenshot: string | null; durationMs: number; warnings: { code: string; message: string }[] },
): DesignReport {
  const pageBg = parseColor(String(raw.layout?.pageBackground ?? '')) ?? parseColor('#ffffff');

  const components: ComponentStyle[] = Array.isArray(raw.components)
    ? raw.components.map((c: Record<string, unknown>) => ({
        name: String(c.name ?? ''),
        selector: String(c.selector ?? ''),
        sampleText: String(c.sampleText ?? ''),
        styles: (c.styles as Record<string, string>) ?? {},
        count: Number(c.count) || 0,
      }))
    : [];

  const colors = buildColors(raw.colors, pageBg);
  const typeRoles = buildTypeRoles(raw.typography);

  // Page-observed custom properties win over stylesheet-parsed ones (they are
  // already resolved), but stylesheet parsing catches scoped themes like .dark.
  const varMap = new Map<string, VarEntry[]>();
  const mapVar = (v: { name: string; value: string; scope: string }): VarEntry => ({
    name: v.name,
    value: v.value,
    hex: parseColor(v.value)?.hex ?? null,
    scope: v.scope,
  });
  for (const v of raw.cssVariables || []) mergeVariable(varMap, mapVar(v));
  for (const v of css.variables) mergeVariable(varMap, v);

  // Cap colour and non-colour variables separately. A design-system site can
  // declare hundreds of palette variables, and a single sorted slice would drop
  // every spacing, font and radius token before the colours ran out.
  const allVars = Array.from(varMap.values())
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name));
  const cssVariables = [
    ...allVars.filter((v) => v.hex).slice(0, 250),
    ...allVars.filter((v) => !v.hex).slice(0, 150),
  ];

  const radii = asCounted(raw.radii).map((r) => {
    const value = normalizeRadius(r.key);
    const px = parseFloat(value);
    return { value, px: isFinite(px) ? px : null, count: r.count };
  });

  return {
    meta: {
      url: extras.requestedUrl,
      finalUrl: String(raw.meta?.finalUrl ?? extras.requestedUrl),
      domain: String(raw.meta?.domain ?? ''),
      title: String(raw.meta?.title ?? ''),
      description: String(raw.meta?.description ?? ''),
      lang: String(raw.meta?.lang ?? ''),
      charset: String(raw.meta?.charset ?? ''),
      viewport: String(raw.meta?.viewport ?? ''),
      themeColor: String(raw.meta?.themeColor ?? ''),
      ogImage: String(raw.meta?.ogImage ?? ''),
      generator: String(raw.meta?.generator ?? ''),
      favicons: Array.isArray(raw.meta?.favicons) ? raw.meta.favicons : [],
      logo: raw.meta?.logo
        ? { ...raw.meta.logo, svg: raw.meta.logo.svg ? sanitizeSvg(raw.meta.logo.svg) : null }
        : null,
    },
    tech: {
      frameworks: raw.tech?.frameworks ?? [],
      cssFrameworks: raw.tech?.cssFrameworks ?? [],
      fontProviders: raw.tech?.fontProviders ?? [],
      iconSets: raw.tech?.iconSets ?? [],
    },
    colors,
    semantic: buildSemanticTokens(colors, pageBg, components),
    cssVariables,
    fontFamilies: buildFontFamilies(raw.typography, css, raw.resourceLinks, typeRoles),
    fontFaces: css.fontFaces,
    typeRoles,
    typeScale: buildTypeScale(raw.typography),
    spacing: buildSpacing(asCounted(raw.spacing)),
    radii,
    shadows: asCounted(raw.shadows).map((s) => ({ value: s.key, count: s.count })),
    borders: asCounted(raw.borders).map((b) => ({ value: b.key, count: b.count })),
    gradients: asCounted(raw.colors?.gradients).map((g) => ({ value: g.key, count: g.count })),
    icons: buildIcons(raw.icons),
    components,
    layout: {
      pageBackground: pageBg?.hex ?? '#ffffff',
      containerMaxWidths: asCounted(raw.maxWidths)
        .map((m) => ({ px: parseFloat(m.key), rem: round(parseFloat(m.key) / 16, 2), count: m.count, ratio: null }))
        .filter((m) => isFinite(m.px))
        .slice(0, 8),
      breakpoints: css.breakpoints,
      gridUsage: Number(raw.layout?.gridUsage) || 0,
      flexUsage: Number(raw.layout?.flexUsage) || 0,
      documentHeight: Number(raw.layout?.documentHeight) || 0,
    },
    screenshot: extras.screenshot,
    stats: {
      elementsScanned: Number(raw.stats?.elementsScanned) || 0,
      stylesheetsParsed: css.sheetsParsed,
      durationMs: extras.durationMs,
      extractedAt: new Date().toISOString(),
    },
    warnings: [...(raw.warnings || []), ...extras.warnings],
  };
}
