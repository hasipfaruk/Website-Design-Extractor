'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { DesignReport } from '@/lib/types';
import type { TokenBundle } from '@/lib/exporters';
import { CopyButton, DownloadButton, Panel, Table } from './ui';

export interface ExtractResponse {
  report: DesignReport;
  slug?: string;
  command?: string;
  designMd?: string;
  markdown: string;
  css: string;
  tailwind: string;
  tokens: TokenBundle;
}

const TABS = ['Overview', 'Colours', 'Typography', 'Spacing & shape', 'Components', 'Icons', 'design.md', 'Markdown', 'Tokens'] as const;
type Tab = (typeof TABS)[number];

/**
 * Render extracted SVG through an <img> data URI. Browsers never execute script
 * inside an image, which makes third-party markup safe to display regardless of
 * what the source site put in it.
 */
function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

const SEMANTIC_LABELS: Record<string, string> = {
  background: 'Background',
  surface: 'Surface',
  textPrimary: 'Text — primary',
  textMuted: 'Text — muted',
  border: 'Border',
  primary: 'Primary',
  accent: 'Accent',
};

export default function Report({ data, onReset }: { data: ExtractResponse; onReset?: () => void }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const r = data.report;

  const slugName = useMemo(() => (r.meta.domain || 'site').replace(/[^a-z0-9.-]/gi, '-'), [r.meta.domain]);

  return (
    <>
      <div className="result-head">
        {r.screenshot ? (
          <div className="shot">
            {/* Screenshot is an inline data URI, so next/image would add no value here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.screenshot} alt={`Screenshot of ${r.meta.domain}`} />
          </div>
        ) : null}

        <div className="result-info">
          <h2>{r.meta.title || r.meta.domain}</h2>
          <div className="url">
            <a href={r.meta.finalUrl} target="_blank" rel="noopener noreferrer nofollow">
              {r.meta.finalUrl}
            </a>
          </div>
          {r.meta.description ? <p className="desc">{r.meta.description}</p> : null}

          <div className="badges">
            {r.tech.frameworks.map((f) => (
              <span className="badge" key={f}>{f}</span>
            ))}
            {r.tech.cssFrameworks.map((f) => (
              <span className="badge" key={f}>{f}</span>
            ))}
            {r.tech.fontProviders.map((f) => (
              <span className="badge neutral" key={f}>{f}</span>
            ))}
            {r.tech.iconSets.map((f) => (
              <span className="badge neutral" key={f}>{f}</span>
            ))}
          </div>

          <div className="stats">
            <span>{r.stats.elementsScanned.toLocaleString()} elements</span>
            <span>{r.stats.stylesheetsParsed} stylesheets</span>
            <span>{r.colors.length} colours</span>
            <span>{r.fontFamilies.length} font families</span>
            <span>{r.icons.length} icons</span>
            <span>{(r.stats.durationMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <DownloadButton
          filename="design.md"
          content={data.designMd || data.markdown}
          mime="text/markdown;charset=utf-8"
          label="↓ design.md"
        />
        <CopyButton text={data.designMd || data.markdown} label="Copy design.md" />
        <DownloadButton filename={`${slugName}-design.md`} content={data.markdown} mime="text/markdown;charset=utf-8" label="↓ full report" />
        <CopyButton text={data.markdown} label="Copy report" />
        <DownloadButton
          filename={`${slugName}-tokens.json`}
          content={() => JSON.stringify(data.tokens, null, 2)}
          mime="application/json"
          label="↓ tokens.json"
        />
        <CopyButton text={data.css} label="Copy CSS variables" />
        <CopyButton text={data.tailwind} label="Copy Tailwind theme" />
        {onReset ? (
          <button type="button" className="btn" onClick={onReset}>
            Analyse another site
          </button>
        ) : null}
      </div>

      {r.warnings.length ? (
        <div className="alert" style={{ maxWidth: 'none', margin: '0 0 20px' }}>
          {r.warnings.map((w) => (
            <div key={w.code + w.message}>{w.message}</div>
          ))}
        </div>
      ) : null}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            className="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab r={r} />}
      {tab === 'Colours' && <ColoursTab r={r} />}
      {tab === 'Typography' && <TypographyTab r={r} />}
      {tab === 'Spacing & shape' && <ShapeTab r={r} />}
      {tab === 'Components' && <ComponentsTab r={r} />}
      {tab === 'Icons' && <IconsTab r={r} />}
      {tab === 'design.md' && (
        <Panel
          title="design.md"
          hint="Agent-ready design language. Drop it in a project root and tell your coding agent to read it first."
        >
          <pre className="code">{data.designMd || data.markdown}</pre>
        </Panel>
      )}
      {tab === 'Markdown' && (
        <Panel title="Full extract report" hint="The complete technical report as a single markdown file.">
          <pre className="code">{data.markdown}</pre>
        </Panel>
      )}
      {tab === 'Tokens' && <TokensTab data={data} />}
    </>
  );
}

// ------------------------------------------------------------------ overview

function OverviewTab({ r }: { r: DesignReport }) {
  const rows: [string, React.ReactNode][] = [
    ['URL', <a key="u" href={r.meta.finalUrl} target="_blank" rel="noopener noreferrer nofollow">{r.meta.finalUrl}</a>],
    ['Language', r.meta.lang || '—'],
    ['Viewport', <code key="v">{r.meta.viewport || '—'}</code>],
    ['Theme colour', r.meta.themeColor || '—'],
    ['Generator', r.meta.generator || '—'],
    ['Page background', <code key="bg">{r.layout.pageBackground}</code>],
    ['Document height', `${r.layout.documentHeight}px`],
    ['Flex / grid containers', `${r.layout.flexUsage} flex · ${r.layout.gridUsage} grid`],
    ['Base spacing unit', r.spacing.baseUnit ? `${r.spacing.baseUnit}px` : 'no consistent unit'],
    ['Extracted', new Date(r.stats.extractedAt).toLocaleString()],
  ];

  return (
    <>
      <Panel title="Summary">
        <div className="card">
          {rows.map(([k, v]) => (
            <div className="token-row" key={k} style={{ gridTemplateColumns: '200px 1fr' }}>
              <strong style={{ fontWeight: 550 }}>{k}</strong>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Semantic tokens" hint="Inferred from how the site actually uses each colour.">
        <div className="card">
          {Object.entries(r.semantic).map(([k, v]) => (
            <div className="token-row" key={k}>
              <strong style={{ fontWeight: 550 }}>{SEMANTIC_LABELS[k] ?? k}</strong>
              <span className="swatch-dot" style={{ background: v ?? 'transparent' }} />
              <code>{v ?? 'not detected'}</code>
            </div>
          ))}
        </div>
      </Panel>

      {r.layout.breakpoints.length ? (
        <Panel title="Breakpoints" hint="Media queries found across the site's stylesheets.">
          <Table
            headers={['Query', 'Breakpoint', 'Rules']}
            rows={r.layout.breakpoints.map((b) => [
              <code key="q">{b.query}</code>,
              b.px !== null ? `${b.px}px` : '—',
              b.count,
            ])}
          />
        </Panel>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------- colours

function ColoursTab({ r }: { r: DesignReport }) {
  const colorVars = r.cssVariables.filter((v) => v.hex);

  return (
    <>
      <Panel title="Palette" hint="Ranked by weighted usage — painted area for backgrounds, glyph volume for text.">
        <div className="swatch-grid">
          {r.colors.map((c) => (
            <div className="swatch" key={c.hex}>
              <div className="chipfill">
                <span style={{ background: c.hex }} />
              </div>
              <div className="meta">
                <div className="name">{c.name}</div>
                <div className="hex" title="Click to select">{c.hex}</div>
                <div className="sub">
                  <span>{c.roles.join(', ')}</span>
                  <span>{c.usage}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Colour values & contrast" hint="Contrast ratios are WCAG 2.1, measured against plain white and black.">
        <Table
          headers={['Hex', 'RGB', 'HSL', 'OKLCH', 'Name', 'Usage', 'On white', 'On black', 'On page bg']}
          rows={r.colors.map((c) => [
            c.hex,
            c.rgb,
            c.hsl,
            c.oklch,
            c.name,
            `${c.usage}%`,
            `${c.contrastOnWhite}:1`,
            `${c.contrastOnBlack}:1`,
            c.onPageBackground ? `${c.onPageBackground.contrast}:1 · ${c.onPageBackground.rating}` : '—',
          ])}
        />
      </Panel>

      {r.gradients.length ? (
        <Panel title="Gradients">
          <div className="demo-grid">
            {r.gradients.map((g) => (
              <div className="demo-cell" key={g.value}>
                <div className="box" style={{ backgroundImage: g.value, border: 'none' }} />
                <div className="val">{g.value}</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {colorVars.length ? (
        <Panel title="CSS custom properties" hint={`${colorVars.length} colour variables declared by the site.`}>
          <Table
            headers={['Variable', 'Declared value', 'Resolved', 'Scope']}
            rows={colorVars.map((v) => [
              <code key="n">{v.name}</code>,
              v.value,
              <span key="r" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="swatch-dot" style={{ background: v.hex!, width: 16, height: 16 }} />
                {v.hex}
              </span>,
              <code key="s">{v.scope}</code>,
            ])}
          />
        </Panel>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- typography

function TypographyTab({ r }: { r: DesignReport }) {
  return (
    <>
      <Panel title="Font families" hint="Where each family comes from, and which weights and sizes the site actually uses.">
        <Table
          headers={['Family', 'Source', 'Weights', 'Sizes (px)', 'Applied to', 'Full stack']}
          rows={r.fontFamilies.map((f) => [
            <strong key="p">{f.primary}</strong>,
            f.source,
            f.weightsUsed.join(', ') || '—',
            f.sizesUsed.map(num).join(', ') || '—',
            f.roles.join(', ') || '—',
            <span key="s" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{f.stack}</span>,
          ])}
        />
      </Panel>

      <Panel
        title="Text roles"
        hint="Computed styles exactly as the browser rendered them. Samples are shown on the site's own background colour."
      >
        {r.typeRoles.map((t) => {
          const sampleStyle: CSSProperties = {
            fontFamily: t.fontFamily,
            fontSize: Math.min(t.fontSize, 64),
            fontWeight: t.fontWeight,
            lineHeight: t.lineHeightRatio || 'normal',
            letterSpacing: t.letterSpacing === 'normal' ? undefined : t.letterSpacing,
            textTransform: t.textTransform as CSSProperties['textTransform'],
            color: t.color,
            margin: 0,
          };

          return (
            <div className="specimen" key={t.role + t.selector}>
              <div className="role">
                <strong>{t.role}</strong>
                <span className="sel">{t.selector}</span>
              </div>

              <div
                className="sample"
                style={{
                  background: r.layout.pageBackground,
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                <p style={sampleStyle}>{t.sampleText || 'The quick brown fox jumps over the lazy dog'}</p>
              </div>

              <div className="specs">
                <span className="spec">font: <b>{t.fontFamily.split(',')[0].replace(/["']/g, '')}</b></span>
                <span className="spec">size: <b>{num(t.fontSize)}px</b> / {num(t.fontSizeRem)}rem</span>
                <span className="spec">weight: <b>{t.fontWeight}</b></span>
                <span className="spec">
                  line-height: <b>{t.lineHeightRaw === 'normal' ? 'normal' : `${num(t.lineHeight)}px`}</b>
                  {t.lineHeightRatio ? ` (${num(t.lineHeightRatio)})` : ''}
                </span>
                <span className="spec">tracking: <b>{t.letterSpacing}</b></span>
                {t.textTransform !== 'none' ? <span className="spec">transform: <b>{t.textTransform}</b></span> : null}
                <span className="spec">colour: <b>{t.color}</b></span>
              </div>
            </div>
          );
        })}
      </Panel>

      {r.typeScale.length ? (
        <Panel title="Type scale" hint="Every font size in use, with the ratio between consecutive steps.">
          <Table
            headers={['px', 'rem', 'Ratio to previous', 'Occurrences']}
            rows={r.typeScale.map((s) => [num(s.px), num(s.rem), s.ratio ? `×${num(s.ratio)}` : '—', s.count])}
          />
        </Panel>
      ) : null}

      {r.fontFaces.length ? (
        <Panel title="@font-face" hint="Webfont files the site loads.">
          <Table
            headers={['Family', 'Weight', 'Style', 'Display', 'Formats', 'Source']}
            rows={r.fontFaces.map((f, i) => [
              f.family,
              f.weight,
              f.style,
              f.display || '—',
              f.formats.join(', ') || '—',
              <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 11, wordBreak: 'break-all' }}>
                {f.src[0] ?? '—'}
              </span>,
            ])}
          />
        </Panel>
      ) : null}
    </>
  );
}

// -------------------------------------------------------------- spacing/shape

function ShapeTab({ r }: { r: DesignReport }) {
  return (
    <>
      <Panel
        title="Spacing scale"
        hint={
          r.spacing.baseUnit
            ? `Most values are multiples of ${r.spacing.baseUnit}px.`
            : 'No single base unit explains the spacing used.'
        }
      >
        <div className="card">
          {r.spacing.steps.map((s) => (
            <div className="token-row" key={s.px} style={{ gridTemplateColumns: '84px 1fr 120px' }}>
              <code>{num(s.px)}px</code>
              <span
                style={{
                  display: 'block',
                  height: 14,
                  width: Math.min(s.px * 3, 560),
                  background: 'var(--accent)',
                  opacity: 0.75,
                  borderRadius: 3,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>
                {num(s.rem)}rem{s.multiple !== null ? ` · ${s.multiple}×` : ''} · {s.count} uses
              </span>
            </div>
          ))}
          {!r.spacing.steps.length ? <div className="empty">No spacing values detected.</div> : null}
        </div>
      </Panel>

      <Panel title="Border radius">
        <div className="demo-grid">
          {r.radii.map((x) => (
            <div className="demo-cell" key={x.value}>
              <div className="box" style={{ borderRadius: x.value, background: 'var(--accent-soft)' }} />
              <div className="val">{x.value} · {x.count} uses</div>
            </div>
          ))}
        </div>
        {!r.radii.length ? <div className="empty">No border radii detected.</div> : null}
      </Panel>

      <Panel title="Box shadows" hint="Rendered on the site's page background.">
        <div className="demo-grid">
          {r.shadows.map((x) => (
            <div className="demo-cell" key={x.value} style={{ background: r.layout.pageBackground }}>
              <div className="box" style={{ boxShadow: x.value, background: r.layout.pageBackground, border: 'none' }} />
              <div className="val">{x.value}</div>
            </div>
          ))}
        </div>
        {!r.shadows.length ? <div className="empty">No box shadows detected.</div> : null}
      </Panel>

      <Panel title="Borders">
        <Table headers={['Value', 'Occurrences']} rows={r.borders.map((b) => [b.value, b.count])} />
      </Panel>

      {r.layout.containerMaxWidths.length ? (
        <Panel title="Container widths">
          <Table
            headers={['max-width', 'rem', 'Occurrences']}
            rows={r.layout.containerMaxWidths.map((c) => [`${num(c.px)}px`, num(c.rem), c.count])}
          />
        </Panel>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- components

function ComponentsTab({ r }: { r: DesignReport }) {
  if (!r.components.length) return <div className="empty">No recognisable components were found on this page.</div>;

  return (
    <>
      {r.components.map((c, i) => (
        <Panel key={`${c.name}-${i}`} title={c.name} hint={`${c.selector} · seen ${c.count}×`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
            <div
              style={{
                padding: 24,
                background: r.layout.pageBackground,
                border: '1px solid var(--border)',
                borderRadius: 10,
                minWidth: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: c.styles.backgroundColor,
                  backgroundImage: c.styles.backgroundImage,
                  color: c.styles.color,
                  borderRadius: c.styles.borderRadius,
                  padding: c.styles.padding || '10px 18px',
                  border: c.styles.border,
                  boxShadow: c.styles.boxShadow,
                  fontFamily: c.styles.fontFamily,
                  fontSize: c.styles.fontSize,
                  fontWeight: c.styles.fontWeight as CSSProperties['fontWeight'],
                  letterSpacing: c.styles.letterSpacing,
                  textTransform: c.styles.textTransform as CSSProperties['textTransform'],
                }}
              >
                {c.sampleText || c.name}
              </span>
            </div>

            <div style={{ flex: 1, minWidth: 280 }}>
              <Table
                headers={['Property', 'Value']}
                rows={Object.entries(c.styles).map(([k, v]) => [<code key={k}>{k}</code>, v])}
              />
            </div>
          </div>
        </Panel>
      ))}
    </>
  );
}

// --------------------------------------------------------------------- icons

function IconsTab({ r }: { r: DesignReport }) {
  const inline = r.icons.filter((i) => i.kind === 'inline-svg' && i.svg);
  const imgs = r.icons.filter((i) => i.kind === 'img' && i.url);
  const fonts = r.icons.filter((i) => i.kind === 'icon-font');

  if (!r.icons.length) return <div className="empty">No icons were found on this page.</div>;

  return (
    <>
      {inline.length ? (
        <Panel
          title={`Inline SVG icons (${inline.length})`}
          hint="Rendered as images, so nothing from the source page can execute. Click Copy to take the markup."
        >
          <div className="icon-grid">
            {inline.map((i, idx) => (
              <div className="icon-cell" key={idx}>
                <div className="art" style={{ background: '#fff', borderRadius: 6, padding: 4 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={svgDataUri(i.svg!)} alt={i.label} />
                </div>
                <div className="lbl" title={i.label}>{i.label}</div>
                <CopyButton text={i.svg!} label="Copy" className="btn" />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {imgs.length ? (
        <Panel title={`Image icons (${imgs.length})`}>
          <div className="icon-grid">
            {imgs.map((i, idx) => (
              <div className="icon-cell" key={idx}>
                <div className="art" style={{ background: '#fff', borderRadius: 6, padding: 4 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.url!} alt={i.label} referrerPolicy="no-referrer" />
                </div>
                <div className="lbl" title={i.label}>{i.label}</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {fonts.length ? (
        <Panel title={`Icon-font glyphs (${fonts.length})`} hint="Detected from icon fonts rather than SVG markup.">
          <Table
            headers={['Glyph / class', 'Font family', 'Uses']}
            rows={fonts.map((i) => [i.label, i.color ?? '—', i.count])}
          />
        </Panel>
      ) : null}
    </>
  );
}

// -------------------------------------------------------------------- tokens

function TokensTab({ data }: { data: ExtractResponse }) {
  const [view, setView] = useState<'css' | 'tailwind' | 'json'>('css');
  const content = view === 'css' ? data.css : view === 'tailwind' ? data.tailwind : JSON.stringify(data.tokens, null, 2);
  const file =
    view === 'css' ? 'tokens.css' : view === 'tailwind' ? 'tailwind.config.js' : 'tokens.json';

  return (
    <Panel title="Design tokens" hint="Drop straight into your project.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => setView('css')} aria-pressed={view === 'css'}>
          CSS variables
        </button>
        <button type="button" className="btn" onClick={() => setView('tailwind')} aria-pressed={view === 'tailwind'}>
          Tailwind
        </button>
        <button type="button" className="btn" onClick={() => setView('json')} aria-pressed={view === 'json'}>
          JSON
        </button>
        <span style={{ flex: 1 }} />
        <CopyButton text={content} label="Copy" />
        <DownloadButton filename={file} content={content} label={`↓ ${file}`} />
      </div>
      <pre className="code">{content}</pre>
    </Panel>
  );
}
