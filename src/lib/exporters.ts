import type { DesignReport } from './types';

const slug = (s: string) =>
  s
    // Split camelCase first, so textPrimary becomes text-primary rather than textprimary.
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

/** Quote a font stack for use in a JS/JSON value. */
const stackToArray = (stack: string): string[] =>
  stack
    .split(',')
    .map((f) => f.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

export interface TokenBundle {
  source: { url: string; extractedAt: string };
  color: Record<string, string>;
  palette: Record<string, string>;
  font: Record<string, string>;
  typography: Record<string, { fontSize: string; lineHeight: string; fontWeight: number; letterSpacing: string }>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  screens: Record<string, string>;
}

export function toTokens(report: DesignReport): TokenBundle {
  const color: Record<string, string> = {};
  for (const [k, v] of Object.entries(report.semantic)) {
    if (v) color[slug(k)] = v;
  }

  const palette: Record<string, string> = {};
  report.colors.slice(0, 14).forEach((c, i) => {
    palette[`${slug(c.name)}-${i + 1}`] = c.hex;
  });

  const font: Record<string, string> = {};
  const heading = report.typeRoles.find((r) => r.role === 'h1') ?? report.typeRoles.find((r) => r.role === 'h2');
  const body = report.typeRoles.find((r) => r.role === 'body');
  if (report.fontFamilies[0]) font.base = report.fontFamilies[0].stack;
  if (body) font.body = body.fontFamily;
  if (heading) font.heading = heading.fontFamily;
  const mono = report.fontFamilies.find((f) => /mono|code|consol|menlo/i.test(f.stack));
  if (mono) font.mono = mono.stack;

  const typography: TokenBundle['typography'] = {};
  for (const r of report.typeRoles) {
    typography[slug(r.role)] = {
      fontSize: `${r.fontSize}px`,
      lineHeight: r.lineHeightRaw === 'normal' ? 'normal' : String(r.lineHeightRatio),
      fontWeight: r.fontWeight,
      letterSpacing: r.letterSpacing,
    };
  }

  const spacing: Record<string, string> = {};
  report.spacing.steps.forEach((s) => {
    spacing[s.multiple !== null ? String(s.multiple) : String(s.px)] = `${s.px}px`;
  });

  const radius: Record<string, string> = {};
  report.radii.slice(0, 8).forEach((r, i) => {
    radius[i === 0 ? 'DEFAULT' : `r${i + 1}`] = r.value;
  });

  const shadow: Record<string, string> = {};
  report.shadows.slice(0, 8).forEach((s, i) => {
    shadow[i === 0 ? 'DEFAULT' : `s${i + 1}`] = s.value;
  });

  const screens: Record<string, string> = {};
  report.layout.breakpoints
    .filter((b) => b.px !== null)
    .slice(0, 8)
    .forEach((b) => {
      screens[`bp-${b.px}`] = `${b.px}px`;
    });

  return {
    source: { url: report.meta.finalUrl, extractedAt: report.stats.extractedAt },
    color,
    palette,
    font,
    typography,
    spacing,
    radius,
    shadow,
    screens,
  };
}

export function toCssVariables(report: DesignReport): string {
  const t = toTokens(report);
  const lines: string[] = [
    `/* Design tokens extracted from ${report.meta.finalUrl} */`,
    `/* Generated ${report.stats.extractedAt} */`,
    ':root {',
  ];

  const section = (title: string, entries: [string, string][]) => {
    if (!entries.length) return;
    lines.push(`  /* ${title} */`);
    for (const [k, v] of entries) lines.push(`  ${k}: ${v};`);
    lines.push('');
  };

  section('Semantic colours', Object.entries(t.color).map(([k, v]) => [`--color-${k}`, v]));
  section('Palette', Object.entries(t.palette).map(([k, v]) => [`--palette-${k}`, v]));
  section('Font families', Object.entries(t.font).map(([k, v]) => [`--font-${k}`, v]));

  const typeEntries: [string, string][] = [];
  for (const [role, v] of Object.entries(t.typography)) {
    typeEntries.push([`--text-${role}`, v.fontSize]);
    typeEntries.push([`--leading-${role}`, v.lineHeight]);
    typeEntries.push([`--weight-${role}`, String(v.fontWeight)]);
    if (v.letterSpacing && v.letterSpacing !== 'normal') {
      typeEntries.push([`--tracking-${role}`, v.letterSpacing]);
    }
  }
  section('Typography', typeEntries);

  section('Spacing', Object.entries(t.spacing).map(([k, v]) => [`--space-${k}`, v]));
  section('Radii', Object.entries(t.radius).map(([k, v]) => [`--radius-${k.toLowerCase()}`, v]));
  section('Shadows', Object.entries(t.shadow).map(([k, v]) => [`--shadow-${k.toLowerCase()}`, v]));

  // Trailing blank line inside the block reads badly.
  while (lines[lines.length - 1] === '') lines.pop();
  lines.push('}');
  return lines.join('\n');
}

export function toTailwindConfig(report: DesignReport): string {
  const t = toTokens(report);

  const colors: Record<string, string> = { ...t.color, ...t.palette };
  const fontFamily: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(t.font)) fontFamily[k] = stackToArray(v);

  const fontSize: Record<string, [string, Record<string, string>]> = {};
  for (const [role, v] of Object.entries(t.typography)) {
    fontSize[role] = [v.fontSize, { lineHeight: v.lineHeight, fontWeight: String(v.fontWeight) }];
  }

  const theme = {
    extend: {
      colors,
      fontFamily,
      fontSize,
      spacing: t.spacing,
      borderRadius: t.radius,
      boxShadow: t.shadow,
      screens: t.screens,
    },
  };

  return [
    `// Tailwind theme extracted from ${report.meta.finalUrl}`,
    `// Generated ${report.stats.extractedAt}`,
    '/** @type {import("tailwindcss").Config} */',
    'module.exports = {',
    '  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],',
    `  theme: ${JSON.stringify(theme, null, 2).split('\n').join('\n  ')},`,
    '  plugins: [],',
    '};',
  ].join('\n');
}
