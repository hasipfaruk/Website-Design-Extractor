'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { ExtractResponse } from './Report';
import MarkdownBody from './MarkdownBody';
import { CopyButton, DownloadButton } from './ui';
import type { DesignViewModel } from '@/lib/parse-design-md';

function triggerDownload(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BASE_NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'components', label: 'Components' },
] as const;

export default function DesignSystemView({
  model,
  extract,
  sourceLabel,
}: {
  model: DesignViewModel;
  extract?: ExtractResponse | null;
  sourceLabel?: string;
}) {
  const report = extract?.report;
  const nav = useMemo(() => {
    const extras = model.sections
      .filter((s) => !BASE_NAV.some((b) => b.id === s.id) && s.id !== 'file')
      .map((s) => ({ id: s.id, label: s.title }));
    const more = [
      ...(report?.icons.length ? [{ id: 'icons', label: 'Icons' }] : []),
      ...(extract ? [{ id: 'tokens', label: 'Tokens' }] : []),
      { id: 'file', label: 'Full design.md' },
    ];
    return [...BASE_NAV, ...extras, ...more];
  }, [model.sections, report, extract]);

  const [section, setSection] = useState('overview');
  const primary = model.colors.find((c) => c.token === 'primary')?.hex ?? report?.semantic.primary ?? '#ffb1ee';
  const canvas = model.colors.find((c) => c.token === 'canvas')?.hex ?? report?.semantic.background ?? '#000000';
  const ink = model.colors.find((c) => c.token === 'ink')?.hex ?? report?.semantic.textPrimary ?? '#a0a0a0';
  const current = model.sections.find((s) => s.id === section);
  const designMd = extract?.designMd || model.markdown;
  const known = new Set([...BASE_NAV.map((b) => b.id), 'icons', 'tokens', 'file']);

  return (
    <div className="docs">
      <header className="docs-top">
        <Link className="docs-back" href="/">
          ← WebSift
        </Link>
        <h1>{model.name}</h1>
        <button type="button" className="btn primary" onClick={() => triggerDownload('design.md', designMd)}>
          Download .md
        </button>
      </header>

      <div className="docs-body">
        <aside className="docs-side">
          <p className="docs-side-label">Design system</p>
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'is-on' : undefined}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <div className="docs-main">
          {section === 'overview' && (
            <section>
              <div className="docs-hero">
                <div>
                  <p className="eyebrow">{sourceLabel ?? 'Design system analysis'}</p>
                  <h2>{report?.meta.title || model.name}</h2>
                  <p>{model.description || report?.meta.description || 'Extracted visual language for AI coding agents.'}</p>
                  {report ? (
                    <p className="docs-lead">
                      {report.stats.elementsScanned.toLocaleString()} elements · {report.colors.length} colours ·{' '}
                      {report.fontFamilies.length} families · {report.components.length} components
                      {report.meta.finalUrl ? (
                        <>
                          {' · '}
                          <a href={report.meta.finalUrl} target="_blank" rel="noopener noreferrer nofollow">
                            {report.meta.domain}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                {report?.screenshot ? (
                  <div className="docs-cover docs-shot">
                    {/* Screenshot is an inline data URI. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={report.screenshot} alt={`Screenshot of ${report.meta.domain}`} />
                  </div>
                ) : (
                  <div className="docs-cover" style={{ background: `linear-gradient(160deg, ${primary} 0%, ${canvas} 72%)` }}>
                    <span style={{ color: ink }}>{model.name}</span>
                  </div>
                )}
              </div>
              {model.sections
                .filter((s) => s.id === 'overview')
                .map((s) => (
                  <MarkdownBody key={s.id} text={s.body} />
                ))}
            </section>
          )}

          {section === 'colors' && (
            <section>
              <h2>Colors</h2>
              <div className="swatch-grid docs-swatches">
                {(report?.colors.length
                  ? report.colors.map((c) => ({ token: c.name, hex: c.hex, meta: `${c.usage}% · ${c.roles.join(', ')}` }))
                  : model.colors.map((c) => ({ token: c.token, hex: c.hex, meta: c.hex }))
                ).map((c) => (
                  <div className="swatch" key={c.token + c.hex}>
                    <div className="chipfill">
                      <span style={{ background: c.hex }} />
                    </div>
                    <div className="meta">
                      <div className="name">{c.token}</div>
                      <div className="hex">{c.hex}</div>
                      {'meta' in c ? <div className="sub">{c.meta}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
              {report ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Hex</th>
                        <th>Name</th>
                        <th>Usage</th>
                        <th>On white</th>
                        <th>On black</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.colors.map((c) => (
                        <tr key={c.hex}>
                          <td className="mono">{c.hex}</td>
                          <td>{c.name}</td>
                          <td>{c.usage}%</td>
                          <td>{c.contrastOnWhite}:1</td>
                          <td>{c.contrastOnBlack}:1</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {model.sections
                .filter((s) => s.id === 'colors' || s.id === 'colours')
                .map((s) => (
                  <MarkdownBody key={s.id} text={s.body} />
                ))}
            </section>
          )}

          {section === 'typography' && (
            <section>
              <h2>Typography</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Family</th>
                      <th>Size</th>
                      <th>Weight</th>
                      <th>Line height</th>
                      <th>Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.typeRoles.length
                      ? report.typeRoles.map((t) => ({
                          token: t.role,
                          fontFamily: t.fontFamily,
                          fontSize: `${Math.round(t.fontSize)}px`,
                          fontWeight: String(t.fontWeight),
                          lineHeight: t.lineHeightRatio ? String(t.lineHeightRatio) : t.lineHeightRaw,
                          letterSpacing: t.letterSpacing,
                        }))
                      : model.typography
                    ).map((t) => (
                      <tr key={t.token}>
                        <td>{t.token}</td>
                        <td className="mono">{t.fontFamily}</td>
                        <td className="mono">{t.fontSize}</td>
                        <td className="mono">{t.fontWeight}</td>
                        <td className="mono">{t.lineHeight}</td>
                        <td className="mono">{t.letterSpacing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="docs-specimens">
                {(report?.typeRoles.length ? report.typeRoles : model.typography).map((t) => {
                  const family = 'fontFamily' in t ? t.fontFamily : '';
                  const size = 'fontSize' in t && typeof t.fontSize === 'number' ? `${t.fontSize}px` : (t as { fontSize: string }).fontSize;
                  const weight = 'fontWeight' in t ? t.fontWeight : 400;
                  const sample = 'sampleText' in t ? t.sampleText : 'Give AI-built websites a real design.';
                  const color = 'color' in t ? t.color : undefined;
                  return (
                    <div className="specimen" key={'role' in t ? t.role + t.selector : t.token}>
                      <div className="role">
                        <strong>{'role' in t ? t.role : t.token}</strong>
                        <span className="sel">
                          {size} / {weight}
                        </span>
                      </div>
                      <p
                        className="sample"
                        style={{
                          fontFamily: family,
                          fontSize: `min(${size}, 40px)`,
                          fontWeight: Number(weight) || 400,
                          lineHeight: 'lineHeightRatio' in t ? t.lineHeightRatio || 1.4 : t.lineHeight,
                          letterSpacing: 'letterSpacing' in t ? t.letterSpacing : undefined,
                          color,
                        }}
                      >
                        {sample || 'Give AI-built websites a real design.'}
                      </p>
                    </div>
                  );
                })}
              </div>
              {model.sections
                .filter((s) => s.id === 'typography')
                .map((s) => (
                  <MarkdownBody key={s.id} text={s.body} />
                ))}
            </section>
          )}

          {section === 'layout' && (
            <section>
              <h2>Layout</h2>
              <h3>Rounded</h3>
              <div className="docs-chips">
                {(report?.radii.length
                  ? report.radii.map((r) => ({ token: r.value, value: r.value }))
                  : model.rounded
                ).map((r) => (
                  <div key={r.token} className="docs-chip">
                    <i style={{ borderRadius: r.value }} />
                    <span>
                      {r.token}
                      <code>{r.value}</code>
                    </span>
                  </div>
                ))}
              </div>
              <h3>Spacing</h3>
              <div className="docs-space">
                {(report?.spacing.steps.length
                  ? report.spacing.steps.map((s) => ({ token: `${s.px}px`, value: `${s.px}px` }))
                  : model.spacing
                ).map((s) => (
                  <div key={s.token}>
                    <b>{s.token}</b>
                    <em style={{ width: s.value }} />
                    <code>{s.value}</code>
                  </div>
                ))}
              </div>
              {report?.shadows.length ? (
                <>
                  <h3>Shadows</h3>
                  <div className="docs-chips">
                    {report.shadows.map((s) => (
                      <div key={s.value} className="docs-chip">
                        <i style={{ boxShadow: s.value, background: '#fff' }} />
                        <span>
                          shadow
                          <code>{s.value}</code>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              {report?.layout.breakpoints.length ? (
                <>
                  <h3>Breakpoints</h3>
                  <ul className="docs-plain-list">
                    {report.layout.breakpoints.map((b) => (
                      <li key={b.query}>
                        <code>{b.query}</code>
                        {b.px ? ` · ${b.px}px` : ''} · {b.count} rules
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {model.sections
                .filter((s) => ['layout', 'elevation-depth', 'elevation-and-depth', 'shapes', 'dos-and-donts'].includes(s.id))
                .map((s) => (
                  <MarkdownBody key={s.id} text={s.body} />
                ))}
            </section>
          )}

          {section === 'components' && (
            <section>
              <h2>Components</h2>
              <div className="docs-preview-row">
                <button type="button" className="btn primary" style={{ background: primary, borderColor: canvas, color: ink }}>
                  Primary
                </button>
                <button type="button" className="btn">
                  Secondary
                </button>
                <input className="docs-fake-input" placeholder="Text input" readOnly />
              </div>
              {report?.components.length
                ? report.components.map((c, i) => (
                    <div className="docs-comp" key={`${c.name}-${i}`}>
                      <h3>
                        {c.name} <span className="docs-comp-meta">{c.selector} · {c.count}×</span>
                      </h3>
                      <div
                        className="docs-comp-preview"
                        style={{ background: report.layout.pageBackground }}
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
                            fontWeight: c.styles.fontWeight,
                            letterSpacing: c.styles.letterSpacing,
                            textTransform: c.styles.textTransform as CSSProperties['textTransform'],
                          }}
                        >
                          {c.sampleText || c.name}
                        </span>
                      </div>
                      <ul>
                        {Object.entries(c.styles).map(([k, v]) => (
                          <li key={k}>
                            <b>{k}</b> <code>{v}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                : model.components.map((c) => (
                    <div className="docs-comp" key={c.name}>
                      <h3>{c.name}</h3>
                      <ul>
                        {c.props.map((p) => (
                          <li key={p.key}>
                            <b>{p.key}</b> <code>{p.value}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              {model.sections
                .filter((s) => s.id === 'components')
                .map((s) => (
                  <MarkdownBody key={s.id} text={s.body} />
                ))}
            </section>
          )}

          {section === 'icons' && report?.icons.length ? (
            <section>
              <h2>Icons</h2>
              <div className="icon-grid docs-icons">
                {report.icons
                  .filter((icon) => icon.svg || icon.url)
                  .slice(0, 48)
                  .map((icon, idx) => (
                    <div className="icon-cell" key={idx}>
                      <div className="art">
                        {icon.svg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(icon.svg)}`} alt={icon.label} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon.url!} alt={icon.label} referrerPolicy="no-referrer" />
                        )}
                      </div>
                      <div className="lbl">{icon.label}</div>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {section === 'tokens' && extract ? (
            <section>
              <h2>Tokens</h2>
              <p className="docs-lead">CSS variables, Tailwind theme, and JSON tokens from the live extract.</p>
              <div className="docs-preview-row">
                <CopyButton text={extract.css} label="Copy CSS" />
                <CopyButton text={extract.tailwind} label="Copy Tailwind" />
                <DownloadButton
                  filename="tokens.json"
                  content={() => JSON.stringify(extract.tokens, null, 2)}
                  mime="application/json"
                  label="↓ tokens.json"
                />
              </div>
              <h3>CSS variables</h3>
              <pre className="code docs-md-full">{extract.css}</pre>
              <h3>Tailwind</h3>
              <pre className="code docs-md-full">{extract.tailwind}</pre>
            </section>
          ) : null}

          {section === 'file' && (
            <section>
              <h2>Full design.md</h2>
              <pre className="code docs-md-full">{designMd}</pre>
            </section>
          )}

          {current && !known.has(section) && (
            <section>
              <h2>{current.title}</h2>
              <MarkdownBody text={current.body} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
