import { parseColor } from './color';
import type { ComponentStyle, DesignReport, TypeRole } from './types';

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

function isLight(hex: string | null | undefined): boolean {
  const p = hex ? parseColor(hex) : null;
  return !!p && p.l >= 0.6;
}

function role(report: DesignReport, name: string): TypeRole | undefined {
  return report.typeRoles.find((r) => r.role === name);
}

function px(n: number): string {
  return `${Math.round(n)}px`;
}

function firstFamily(stack: string): string {
  return (stack.split(',')[0] ?? stack).replace(/['"]/g, '').trim() || 'system-ui';
}

function pickRadius(report: DesignReport): { none: string; sm: string; md: string; full: string } {
  const nums = report.radii
    .map((r) => r.px)
    .filter((n): n is number => typeof n === 'number' && n > 0 && n < 80)
    .sort((a, b) => a - b);
  const sm = nums.find((n) => n >= 6 && n <= 16) ?? nums[0] ?? 8;
  const md = nums.find((n) => n > sm && n <= 32) ?? Math.max(sm * 1.5, 16);
  return { none: '0px', sm: px(sm), md: px(md), full: '9999px' };
}

function pickSpacing(report: DesignReport): Record<string, string> {
  const steps = report.spacing.steps.map((s) => s.px).filter((n) => n >= 4 && n <= 160);
  const unique = [...new Set(steps)].sort((a, b) => a - b);
  const pick = (min: number, fallback: number) => unique.find((n) => n >= min) ?? fallback;
  return {
    xxs: px(pick(4, 4)),
    xs: px(pick(8, 8)),
    sm: px(pick(12, 12)),
    md: px(pick(16, 16)),
    lg: px(pick(24, 24)),
    xl: px(pick(32, 32)),
    xxl: px(pick(48, 48)),
    section: px(pick(80, 80)),
    'section-lg': px(pick(120, 120)),
  };
}

function colorMap(report: DesignReport): Record<string, string> {
  const s = report.semantic;
  const ink = s.textPrimary ?? '#111111';
  const canvas = s.background ?? '#ffffff';
  const primary = s.primary ?? ink;
  const onPrimary = isLight(primary) ? ink : '#ffffff';
  const muted = s.textMuted ?? '#6b6b6b';
  return {
    primary,
    'on-primary': onPrimary,
    ink,
    'ink-soft': ink,
    'text-muted': muted,
    'text-faint': isLight(canvas) ? '#adadad' : '#6d6d6d',
    canvas,
    'canvas-soft': s.surface ?? (isLight(canvas) ? '#f3f3f3' : '#161616'),
    field: s.surface ?? (isLight(canvas) ? '#f0f0f0' : '#1a1a1a'),
    'hairline-soft': s.border ?? (isLight(canvas) ? '#f0f0f0' : '#222222'),
    hairline: s.border ?? (isLight(canvas) ? '#e0e0e0' : '#2a2a2a'),
    accent: s.accent ?? s.primary ?? '#0066ff',
  };
}

function tokenFor(hex: string | undefined, colors: Record<string, string>): string | undefined {
  if (!hex) return undefined;
  const normalised = hex.toLowerCase();
  for (const [name, value] of Object.entries(colors)) {
    if (value.toLowerCase() === normalised) return `{colors.${name}}`;
  }
  return hex;
}

function typeBlock(r: TypeRole | undefined, fallback: { family: string; size: number; weight: number; lh: number }) {
  return {
    fontFamily: r ? firstFamily(r.fontFamily) : fallback.family,
    fontSize: px(r?.fontSize ?? fallback.size),
    fontWeight: r?.fontWeight ?? fallback.weight,
    lineHeight: Number((r?.lineHeightRatio ?? fallback.lh).toFixed(2)),
    letterSpacing: r?.letterSpacing && r.letterSpacing !== 'normal' ? r.letterSpacing : '0',
  };
}

function findComponent(report: DesignReport, prefix: string): ComponentStyle | undefined {
  return report.components.find((c) => c.name === prefix) ?? report.components.find((c) => c.name.startsWith(prefix));
}

function componentYaml(
  name: string,
  styles: Record<string, string>,
  colors: Record<string, string>,
): string {
  const lines = [`  ${name}:`];
  const bg = tokenFor(parseColor(styles.backgroundColor ?? '')?.hex, colors);
  const fg = tokenFor(parseColor(styles.color ?? '')?.hex, colors);
  if (bg) lines.push(`    backgroundColor: ${yamlQuote(bg)}`);
  if (fg) lines.push(`    textColor: ${yamlQuote(fg)}`);
  if (styles.borderRadius) lines.push(`    rounded: ${yamlQuote(styles.borderRadius.split(' ')[0] ?? styles.borderRadius)}`);
  if (styles.padding) lines.push(`    padding: ${yamlQuote(styles.padding)}`);
  if (styles.border && styles.border !== 'none') {
    const borderColor = styles.border.match(/(#(?:[0-9a-f]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\))/i)?.[1];
    const hex = borderColor ? parseColor(borderColor)?.hex : undefined;
    const tok = tokenFor(hex, colors);
    if (tok) lines.push(`    borderColor: ${yamlQuote(tok)}`);
  }
  if (lines.length === 1) lines.push(`    description: ${yamlQuote('Detected on the source page.')}`);
  return lines.join('\n');
}

function yamlType(name: string, block: ReturnType<typeof typeBlock>): string {
  return [
    `  ${name}:`,
    `    fontFamily: ${block.fontFamily}`,
    `    fontSize: ${block.fontSize}`,
    `    fontWeight: ${block.fontWeight}`,
    `    lineHeight: ${block.lineHeight}`,
    `    letterSpacing: ${block.letterSpacing}`,
  ].join('\n');
}

/**
 * Build a getdesign-style DESIGN.md: YAML tokens plus agent-readable prose.
 */
export function toDesignMd(report: DesignReport): string {
  const colors = colorMap(report);
  const family = report.fontFamilies[0]?.primary ?? firstFamily(role(report, 'body')?.fontFamily ?? 'system-ui');
  const display = typeBlock(role(report, 'h1') ?? role(report, 'display'), { family, size: 64, weight: 650, lh: 1 });
  const h1 = typeBlock(role(report, 'h1'), { family, size: 48, weight: 650, lh: 1.05 });
  const h2 = typeBlock(role(report, 'h2'), { family, size: 36, weight: 650, lh: 1.15 });
  const h3 = typeBlock(role(report, 'h3'), { family, size: 28, weight: 600, lh: 1.2 });
  const h4 = typeBlock(role(report, 'h4'), { family, size: 22, weight: 600, lh: 1.25 });
  const title = typeBlock(role(report, 'h5') ?? role(report, 'label'), { family, size: 18, weight: 600, lh: 1.3 });
  const bodyLg = typeBlock(role(report, 'lead') ?? role(report, 'h6'), { family, size: 20, weight: 400, lh: 1.4 });
  const bodyType = typeBlock(role(report, 'body'), { family, size: 16, weight: 450, lh: 1.4 });
  const bodySm = typeBlock(role(report, 'small / caption'), { family, size: 14, weight: 450, lh: 1.45 });
  const link = typeBlock(role(report, 'link'), { family, size: 16, weight: 600, lh: 1.4 });
  const label = typeBlock(role(report, 'label') ?? role(report, 'button'), { family, size: 12, weight: 600, lh: 1.3 });
  const caption = typeBlock(role(report, 'small / caption'), { family, size: 12, weight: 450, lh: 1.3 });
  const rounded = pickRadius(report);
  const spacing = pickSpacing(report);

  const name = report.meta.title?.split(/[|—–-]/)[0]?.trim() || report.meta.domain || 'Site';
  const description =
    report.meta.description ||
    `A design-language analysis of ${report.meta.domain}, extracted from live computed styles.`;

  const button = findComponent(report, 'Button');
  const buttonVar = report.components.find((c) => c.name.startsWith('Button (variant'));
  const input = findComponent(report, 'Input field');
  const card = findComponent(report, 'Card');
  const badge = findComponent(report, 'Badge');
  const nav = findComponent(report, 'Header');
  const footer = findComponent(report, 'Footer');

  const front: string[] = [
    '---',
    'version: alpha',
    `name: ${yamlQuote(`${name} Analysis`)}`,
    `description: ${yamlQuote(description)}`,
    '',
    'colors:',
    ...Object.entries(colors).map(([k, v]) => `  ${k}: ${yamlQuote(v)}`),
    '',
    'typography:',
    yamlType('display', display),
    yamlType('heading-1', h1),
    yamlType('heading-2', h2),
    yamlType('heading-3', h3),
    yamlType('heading-4', h4),
    yamlType('title', title),
    yamlType('body-lg', bodyLg),
    yamlType('body', bodyType),
    yamlType('label', label),
    yamlType('caption', caption),
    yamlType('link', link),
    yamlType('body-sm', bodySm),
    '',
    'rounded:',
    ...Object.entries(rounded).map(([k, v]) => `  ${k}: ${v}`),
    '',
    'spacing:',
    ...Object.entries(spacing).map(([k, v]) => `  ${k}: ${v}`),
    '',
    'components:',
  ];

  if (button) front.push(componentYaml('button-primary', button.styles, colors));
  if (buttonVar) front.push(componentYaml('button-outline', buttonVar.styles, colors));
  if (input) front.push(componentYaml('text-input', input.styles, colors));
  if (card) front.push(componentYaml('card', card.styles, colors));
  if (badge) front.push(componentYaml('badge', badge.styles, colors));
  if (nav) front.push(componentYaml('nav', nav.styles, colors));
  if (footer) front.push(componentYaml('footer', footer.styles, colors));

  front.push('---', '', '');

  const paletteLine = Object.entries(colors)
    .slice(0, 6)
    .map(([k, v]) => `\`${k}\` (${v})`)
    .join(', ');

  const tech = [...report.tech.frameworks, ...report.tech.cssFrameworks].slice(0, 4).join(', ');
  const topType = report.fontFamilies
    .slice(0, 3)
    .map((f) => f.primary)
    .join(', ');

  const shadows = report.shadows.length
    ? report.shadows
        .slice(0, 3)
        .map((s) => `\`${s.value}\``)
        .join('; ')
    : 'shadow-free — hierarchy comes from fill difference and hairlines';

  const breakpoints = report.layout.breakpoints.length
    ? report.layout.breakpoints
        .slice(0, 6)
        .map((b) => `- \`${b.query}\`${b.px ? ` (${b.px}px)` : ''}`)
        .join('\n')
    : '- Desktop-first capture at 1440×900; mobile rules were not enumerated.';

  const prose: string[] = [
    '## Overview',
    '',
    `${name} is captured here as a reusable visual language for AI coding agents. ` +
      `The system is built from **live computed styles** on ${report.meta.finalUrl}` +
      `${tech ? ` (${tech})` : ''}, not from a published design-token file. ` +
      `Ink sits at \`{colors.ink}\`, the canvas is \`{colors.canvas}\`, and the commercial accent is \`{colors.accent}\`.`,
    '',
    `Type is led by ${topType || family}. Display size is ${display.fontSize} at weight ${display.fontWeight}; ` +
      `body sits at ${bodyType.fontSize} / ${bodyType.fontWeight}. Corners run ${rounded.sm} → ${rounded.md}, with pills at \`{rounded.full}\`.`,
    '',
    '**Key Characteristics:**',
    `- Palette: ${paletteLine}`,
    `- Type families: ${topType || family}`,
    `- Radius scale: ${rounded.sm} / ${rounded.md} / ${rounded.full}`,
    `- Spacing base: ${report.spacing.baseUnit ? `${report.spacing.baseUnit}px` : 'inferred from usage'}`,
    `- Elevation: ${shadows}`,
    '',
    '## Colors',
    '',
    `Source: ${report.meta.domain}. ${report.colors.length} colours were ranked by painted area, glyph volume and edge length.`,
    '',
    '### Brand & Accent',
    `- **Primary** (\`{colors.primary}\` — ${colors.primary}): Filled CTAs and brand chrome.`,
    `- **Accent** (\`{colors.accent}\` — ${colors.accent}): Highlight, links, and commercial emphasis.`,
    `- **Ink** (\`{colors.ink}\` — ${colors.ink}): Headings and primary copy.`,
    '',
    '### Surface',
    `- **Canvas** (\`{colors.canvas}\` — ${colors.canvas}): Default page background.`,
    `- **Soft canvas** (\`{colors.canvas-soft}\` — ${colors['canvas-soft']}): Panels, featured cards, nav tracks.`,
    `- **Field** (\`{colors.field}\` — ${colors.field}): Form fills.`,
    `- **Hairline** (\`{colors.hairline}\` — ${colors.hairline}): Control and card edges.`,
    '',
    '### Text',
    `- **Ink** (\`{colors.ink}\` — ${colors.ink})`,
    `- **Muted** (\`{colors.text-muted}\` — ${colors['text-muted']})`,
    `- **Faint** (\`{colors.text-faint}\` — ${colors['text-faint']})`,
    `- **On primary** (\`{colors.on-primary}\` — ${colors['on-primary']}): Label colour on filled buttons.`,
    '',
    '## Typography',
    '',
    `### Font Family`,
    '',
    `**${family}** is the lead face${report.fontFamilies.length > 1 ? `, with ${report.fontFamilies
      .slice(1, 3)
      .map((f) => f.primary)
      .join(' and ')} in supporting roles` : ''}. Fallback: system sans (\`-apple-system, "Helvetica Neue", Arial, sans-serif\`).`,
    '',
    '### Hierarchy',
    '',
    '| Token | Size | Weight | Line Height | Use |',
    '|---|---|---|---|---|',
    `| \`{typography.display}\` | ${display.fontSize} | ${display.fontWeight} | ${display.lineHeight} | Hero statements |`,
    `| \`{typography.heading-1}\` | ${h1.fontSize} | ${h1.fontWeight} | ${h1.lineHeight} | Page heroes |`,
    `| \`{typography.heading-2}\` | ${h2.fontSize} | ${h2.fontWeight} | ${h2.lineHeight} | Section headings |`,
    `| \`{typography.heading-3}\` | ${h3.fontSize} | ${h3.fontWeight} | ${h3.lineHeight} | Card titles |`,
    `| \`{typography.heading-4}\` | ${h4.fontSize} | ${h4.fontWeight} | ${h4.lineHeight} | Sub-section headings |`,
    `| \`{typography.body-lg}\` | ${bodyLg.fontSize} | ${bodyLg.fontWeight} | ${bodyLg.lineHeight} | Lead paragraphs |`,
    `| \`{typography.body}\` | ${bodyType.fontSize} | ${bodyType.fontWeight} | ${bodyType.lineHeight} | Default copy |`,
    `| \`{typography.body-sm}\` | ${bodySm.fontSize} | ${bodySm.fontWeight} | ${bodySm.lineHeight} | Supporting copy |`,
    `| \`{typography.link}\` | ${link.fontSize} | ${link.fontWeight} | ${link.lineHeight} | Links and button labels |`,
    `| \`{typography.label}\` | ${label.fontSize} | ${label.fontWeight} | ${label.lineHeight} | Badges and chips |`,
    '',
    '## Layout',
    '',
    '### Spacing System',
    `- Base unit: ${report.spacing.baseUnit ?? 8}px`,
    `- Tokens: ${Object.entries(spacing)
      .map(([k, v]) => `\`{spacing.${k}}\` ${v}`)
      .join(' · ')}`,
    '',
    '### Grid & Container',
    report.layout.containerMaxWidths[0]
      ? `- Content max-width observed around ${px(report.layout.containerMaxWidths[0].px)}.`
      : '- Content is a centered column; marquees may run full-bleed.',
    `- Layout mix: flex ${report.layout.flexUsage}, grid ${report.layout.gridUsage}.`,
    '',
    '### Responsive Strategy',
    '',
    breakpoints,
    '',
    '## Elevation & Depth',
    '',
    shadows === 'shadow-free — hierarchy comes from fill difference and hairlines'
      ? 'The captured chrome is essentially shadow-free. Elevation is fill difference (`{colors.canvas}` vs `{colors.canvas-soft}`) and 1px hairlines.'
      : `Shadows in use: ${shadows}. Prefer the lightest shadow for cards and save heavier ones for overlays.`,
    '',
    '## Shapes',
    '',
    '| Token | Value | Use |',
    '|---|---|---|',
    `| \`{rounded.none}\` | ${rounded.none} | Full-bleed media |`,
    `| \`{rounded.sm}\` | ${rounded.sm} | Inputs, compact cards |`,
    `| \`{rounded.md}\` | ${rounded.md} | Content cards, tiles |`,
    `| \`{rounded.full}\` | ${rounded.full} | Pills, avatars, toggles |`,
    '',
    '## Components',
    '',
  ];

  for (const c of report.components) {
    prose.push(`### \`${c.name}\``);
    prose.push('');
    if (c.sampleText) prose.push(`Sample: “${c.sampleText.replace(/"/g, "'")}”`);
    prose.push('');
    const bits = Object.entries(c.styles)
      .slice(0, 8)
      .map(([k, v]) => `- **${k}:** \`${v.replace(/\|/g, '/')}\``);
    prose.push(...bits);
    prose.push('');
  }

  prose.push(
    "## Do's and Don'ts",
    '',
    '### Do',
    `- Keep surfaces on \`{colors.canvas}\` / \`{colors.canvas-soft}\` and put brand chroma in \`{colors.primary}\` and \`{colors.accent}\`.`,
    `- Set headings in ${family} at the weights above; pair heavy display type with lighter \`{typography.body-lg}\` leads.`,
    `- Use \`{rounded.full}\` for primary actions when the source does; otherwise stay on \`{rounded.md}\`.`,
    '- Treat this file as the source of truth before writing or restyling any UI.',
    '',
    "### Don't",
    '- Do not invent extra accent hues that are not in the color map.',
    '- Do not replace the type scale with generic 16/24/32 defaults.',
    '- Do not add drop shadows if the source system is hairline-and-fill only.',
    '',
    `Extracted from ${report.meta.finalUrl} on ${new Date(report.stats.extractedAt).toUTCString()} ` +
      `(${report.stats.elementsScanned.toLocaleString()} elements, ${report.stats.stylesheetsParsed} stylesheets).`,
    '',
  );

  return `${front.join('\n')}\n${prose.join('\n')}`;
}

export function countMarkdownSections(markdown: string): number {
  return (markdown.match(/^##\s+/gm) ?? []).length;
}
