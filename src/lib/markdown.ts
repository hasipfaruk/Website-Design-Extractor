import type { DesignReport } from './types';
import { toCssVariables, toTailwindConfig, toTokens } from './exporters';

/** Escape a value for a markdown table cell. */
const cell = (v: unknown): string => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
  return s || '—';
};

const code = (v: unknown): string => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, "'").trim();
  return s ? `\`${s}\`` : '—';
};

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

function table(headers: string[], rows: (string | number)[][]): string {
  if (!rows.length) return '_None detected._\n';
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}\n`;
}

export function toMarkdown(report: DesignReport): string {
  const r = report;
  const out: string[] = [];
  const p = (s = '') => out.push(s);

  const title = r.meta.title || r.meta.domain || r.meta.finalUrl;

  // ------------------------------------------------------------------ header
  p(`# Design System — ${r.meta.domain || title}`);
  p();
  p(`> Extracted from **${r.meta.finalUrl}** on ${new Date(r.stats.extractedAt).toUTCString()}`);
  p();
  if (r.meta.title) p(`**Page title:** ${r.meta.title}  `);
  if (r.meta.description) p(`**Description:** ${r.meta.description}  `);
  p(
    `**Analysed:** ${r.stats.elementsScanned.toLocaleString()} elements · ` +
      `${r.stats.stylesheetsParsed} stylesheets · ${(r.stats.durationMs / 1000).toFixed(1)}s`,
  );
  p();

  if (r.warnings.length) {
    p('> [!NOTE]');
    for (const w of r.warnings) p(`> ${w.message}`);
    p();
  }

  // ---------------------------------------------------------------- contents
  p('## Contents');
  p();
  p('1. [Overview](#overview)');
  p('2. [Colours](#colours)');
  p('3. [Typography](#typography)');
  p('4. [Spacing](#spacing)');
  p('5. [Radii, shadows & borders](#radii-shadows--borders)');
  p('6. [Layout & breakpoints](#layout--breakpoints)');
  p('7. [Components](#components)');
  p('8. [Icons](#icons)');
  p('9. [Assets](#assets)');
  p('10. [Design tokens](#design-tokens)');
  p();
  p('---');
  p();

  // ---------------------------------------------------------------- overview
  p('## Overview');
  p();
  p(
    table(
      ['Property', 'Value'],
      [
        ['URL', cell(r.meta.finalUrl)],
        ['Domain', cell(r.meta.domain)],
        ['Language', code(r.meta.lang)],
        ['Charset', code(r.meta.charset)],
        ['Viewport', code(r.meta.viewport)],
        ['Theme colour', r.meta.themeColor ? code(r.meta.themeColor) : '—'],
        ['Generator', cell(r.meta.generator)],
        ['Page background', code(r.layout.pageBackground)],
        ['Document height', `${r.layout.documentHeight}px`],
        ['Frameworks', r.tech.frameworks.length ? r.tech.frameworks.map((f) => `\`${f}\``).join(', ') : '—'],
        ['CSS framework', r.tech.cssFrameworks.length ? r.tech.cssFrameworks.map((f) => `\`${f}\``).join(', ') : '—'],
        ['Font provider', r.tech.fontProviders.length ? r.tech.fontProviders.map((f) => `\`${f}\``).join(', ') : '—'],
        ['Icon set', r.tech.iconSets.length ? r.tech.iconSets.map((f) => `\`${f}\``).join(', ') : '—'],
      ],
    ),
  );

  // ------------------------------------------------------------------ colours
  p('## Colours');
  p();
  p('### Semantic tokens');
  p();
  p('_Inferred from usage: what the site treats as background, body text, borders and primary action._');
  p();
  p(
    table(
      ['Token', 'Value', 'Name'],
      Object.entries(r.semantic).map(([k, v]) => {
        const match = v ? r.colors.find((c) => c.hex.toLowerCase() === v.toLowerCase()) : null;
        return [
          `\`${k.replace(/([A-Z])/g, '-$1').toLowerCase()}\``,
          v ? code(v) : '—',
          cell(match?.name ?? ''),
        ];
      }),
    ),
  );

  p('### Full palette');
  p();
  p('_Ranked by weighted usage across backgrounds, text, borders, icons and shadows._');
  p();
  p(
    table(
      ['#', 'Hex', 'RGB', 'HSL', 'OKLCH', 'Name', 'Usage', 'Used for', 'On white', 'On black'],
      r.colors.map((c, i) => [
        i + 1,
        code(c.hex),
        code(c.rgb),
        code(c.hsl),
        code(c.oklch),
        cell(c.name),
        `${c.usage}%`,
        c.roles.join(', '),
        `${c.contrastOnWhite}:1`,
        `${c.contrastOnBlack}:1`,
      ]),
    ),
  );

  if (r.gradients.length) {
    p('### Gradients');
    p();
    p(table(['Gradient', 'Uses'], r.gradients.map((g) => [code(g.value), g.count])));
  }

  const colorVars = r.cssVariables.filter((v) => v.hex);
  if (colorVars.length) {
    p('### CSS custom properties (colour)');
    p();
    p(
      table(
        ['Variable', 'Value', 'Resolved', 'Scope'],
        colorVars.slice(0, 60).map((v) => [code(v.name), code(v.value), code(v.hex ?? ''), code(v.scope)]),
      ),
    );
  }

  // --------------------------------------------------------------- typography
  p('## Typography');
  p();
  p('### Font families');
  p();
  p(
    table(
      ['Family', 'Full stack', 'Source', 'Weights used', 'Sizes used (px)', 'Applied to'],
      r.fontFamilies.map((f) => [
        `**${cell(f.primary)}**`,
        code(f.stack),
        cell(f.source),
        f.weightsUsed.length ? f.weightsUsed.join(', ') : '—',
        f.sizesUsed.length ? f.sizesUsed.map(num).join(', ') : '—',
        f.roles.length ? f.roles.join(', ') : '—',
      ]),
    ),
  );

  p('### Text roles');
  p();
  p('_Computed styles as actually rendered — headings, sub-headings, body copy and UI text._');
  p();
  p(
    table(
      ['Role', 'Font', 'Size', 'Size (rem)', 'Weight', 'Line height', 'Ratio', 'Letter spacing', 'Transform', 'Colour'],
      r.typeRoles.map((t) => [
        `**${cell(t.role)}**`,
        cell(t.fontFamily.split(',')[0].replace(/["']/g, '')),
        `${num(t.fontSize)}px`,
        `${num(t.fontSizeRem)}rem`,
        t.fontWeight,
        t.lineHeightRaw === 'normal' ? '`normal`' : `${num(t.lineHeight)}px`,
        t.lineHeightRatio ? `${num(t.lineHeightRatio)}` : '—',
        code(t.letterSpacing),
        cell(t.textTransform),
        code(t.color),
      ]),
    ),
  );

  const samples = r.typeRoles.filter((t) => t.sampleText);
  if (samples.length) {
    p('<details><summary>Sample text per role</summary>');
    p();
    p(table(['Role', 'Selector', 'Sample'], samples.map((t) => [cell(t.role), code(t.selector), cell(t.sampleText)])));
    p('</details>');
    p();
  }

  if (r.typeScale.length) {
    p('### Type scale');
    p();
    p(
      table(
        ['Size (px)', 'Size (rem)', 'Ratio to previous', 'Occurrences'],
        r.typeScale.map((s) => [num(s.px), num(s.rem), s.ratio ? `×${num(s.ratio)}` : '—', s.count]),
      ),
    );
  }

  if (r.fontFaces.length) {
    p('### @font-face declarations');
    p();
    p(
      table(
        ['Family', 'Weight', 'Style', 'Display', 'Formats', 'Source'],
        r.fontFaces.slice(0, 40).map((f) => [
          cell(f.family),
          cell(f.weight),
          cell(f.style),
          cell(f.display),
          f.formats.join(', ') || '—',
          f.src.length ? code(f.src[0]) : '—',
        ]),
      ),
    );
  }

  // ------------------------------------------------------------------ spacing
  p('## Spacing');
  p();
  p(
    r.spacing.baseUnit
      ? `Inferred base unit: **${r.spacing.baseUnit}px** — most spacing values are multiples of it.`
      : '_No consistent base unit detected._',
  );
  p();
  p(
    table(
      ['px', 'rem', r.spacing.baseUnit ? `× ${r.spacing.baseUnit}px` : 'Multiple', 'Occurrences'],
      r.spacing.steps.map((s) => [num(s.px), num(s.rem), s.multiple !== null ? `${s.multiple}×` : '—', s.count]),
    ),
  );

  // ------------------------------------------------- radii, shadows, borders
  p('## Radii, shadows & borders');
  p();
  p('### Border radius');
  p();
  p(table(['Value', 'Occurrences'], r.radii.map((x) => [code(x.value), x.count])));

  p('### Box shadows');
  p();
  p(table(['Value', 'Occurrences'], r.shadows.map((x) => [code(x.value), x.count])));

  p('### Borders');
  p();
  p(table(['Value', 'Occurrences'], r.borders.map((x) => [code(x.value), x.count])));

  // ------------------------------------------------------ layout, breakpoints
  p('## Layout & breakpoints');
  p();
  p(
    table(
      ['Property', 'Value'],
      [
        ['Flex containers', r.layout.flexUsage],
        ['Grid containers', r.layout.gridUsage],
        ['Document height', `${r.layout.documentHeight}px`],
      ],
    ),
  );

  if (r.layout.containerMaxWidths.length) {
    p('### Container widths');
    p();
    p(
      table(
        ['max-width (px)', 'rem', 'Occurrences'],
        r.layout.containerMaxWidths.map((c) => [num(c.px), num(c.rem), c.count]),
      ),
    );
  }

  if (r.layout.breakpoints.length) {
    p('### Media queries');
    p();
    p(
      table(
        ['Query', 'Breakpoint', 'Rules'],
        r.layout.breakpoints.map((b) => [code(b.query), b.px !== null ? `${b.px}px` : '—', b.count]),
      ),
    );
  }

  // --------------------------------------------------------------- components
  p('## Components');
  p();
  if (!r.components.length) {
    p('_No recognisable components detected._');
    p();
  } else {
    for (const c of r.components) {
      p(`### ${c.name}${c.sampleText ? ` — "${c.sampleText}"` : ''}`);
      p();
      p(`Selector: ${code(c.selector)} · seen ${c.count}×`);
      p();
      p(table(['Property', 'Value'], Object.entries(c.styles).map(([k, v]) => [code(k), code(v)])));
    }
  }

  // -------------------------------------------------------------------- icons
  p('## Icons');
  p();
  {
    const inline = r.icons.filter((i) => i.kind === 'inline-svg');
    const imgs = r.icons.filter((i) => i.kind === 'img');
    const fonts = r.icons.filter((i) => i.kind === 'icon-font');

    p(
      `Found **${inline.length}** inline SVG icons, **${imgs.length}** image icons` +
        (fonts.length ? `, **${fonts.length}** icon-font glyphs` : '') +
        '.',
    );
    p();

    if (inline.length) {
      p(
        table(
          ['Label', 'Size', 'Stroke width', 'Colour', 'Uses'],
          inline.map((i) => [
            cell(i.label),
            `${i.width}×${i.height}`,
            i.strokeWidth ? num(i.strokeWidth) : '—',
            i.color ? code(i.color) : '—',
            i.count,
          ]),
        ),
      );

      p('<details><summary>Inline SVG markup</summary>');
      p();
      for (const i of inline.slice(0, 24)) {
        p(`**${i.label}**`);
        p();
        p('```svg');
        p(i.svg ?? '');
        p('```');
        p();
      }
      p('</details>');
      p();
    }

    if (imgs.length) {
      p('### Image icons');
      p();
      p(table(['Label', 'Size', 'URL'], imgs.map((i) => [cell(i.label), `${i.width}×${i.height}`, cell(i.url)])));
    }

    if (fonts.length) {
      p('### Icon-font glyphs');
      p();
      p(table(['Glyph', 'Font', 'Uses'], fonts.map((i) => [cell(i.label), cell(i.color), i.count])));
    }
  }

  // ------------------------------------------------------------------ assets
  p('## Assets');
  p();
  if (r.meta.logo) {
    p(`**Logo** (${r.meta.logo.kind})${r.meta.logo.alt ? ` — "${r.meta.logo.alt}"` : ''}`);
    p();
    if (r.meta.logo.src) p(`- Source: ${r.meta.logo.src}`);
    if (r.meta.logo.svg) {
      p('');
      p('```svg');
      p(r.meta.logo.svg);
      p('```');
    }
    p();
  }
  if (r.meta.ogImage) {
    p(`**Social image:** ${r.meta.ogImage}`);
    p();
  }
  p('### Favicons');
  p();
  p(
    table(
      ['rel', 'Sizes', 'Type', 'URL'],
      r.meta.favicons.map((f) => [code(f.rel), cell(f.sizes), cell(f.type), cell(f.href)]),
    ),
  );

  // ------------------------------------------------------------------ tokens
  p('## Design tokens');
  p();
  p('### CSS custom properties');
  p();
  p('```css');
  p(toCssVariables(r));
  p('```');
  p();
  p('### Tailwind theme');
  p();
  p('```js');
  p(toTailwindConfig(r));
  p('```');
  p();
  p('### JSON');
  p();
  p('```json');
  p(JSON.stringify(toTokens(r), null, 2));
  p('```');
  p();
  p('---');
  p();
  p(`_Generated by Design Extractor from ${r.meta.finalUrl}_`);
  p();

  return out.join('\n');
}
