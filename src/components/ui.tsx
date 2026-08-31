'use client';

import { useCallback, useState } from 'react';

/** Copy-to-clipboard button that confirms inline. */
export function CopyButton({
  text,
  label = 'Copy',
  className = 'btn',
}: {
  text: string | (() => string);
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  const copy = useCallback(async () => {
    const value = typeof text === 'function' ? text() : text;
    try {
      await navigator.clipboard.writeText(value);
      setState('ok');
    } catch {
      // Clipboard API needs a secure context; tell the user rather than failing silently.
      setState('fail');
    }
    setTimeout(() => setState('idle'), 1800);
  }, [text]);

  return (
    <button type="button" className={className} onClick={copy}>
      {state === 'ok' ? '✓ Copied' : state === 'fail' ? 'Press Ctrl+C' : label}
    </button>
  );
}

/** Trigger a client-side file download without leaving the page. */
export function DownloadButton({
  filename,
  content,
  mime = 'text/plain;charset=utf-8',
  label,
}: {
  filename: string;
  content: string | (() => string);
  mime?: string;
  label: string;
}) {
  const download = useCallback(() => {
    const value = typeof content === 'function' ? content() : content;
    const blob = new Blob([value], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the download has definitely started.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [filename, content, mime]);

  return (
    <button type="button" className="btn" onClick={download}>
      {label}
    </button>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <div className="empty">None detected.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={typeof c === 'string' && /^[#(]|px$|rgb|hsl|oklch/.test(c) ? 'mono' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {hint ? <p className="hint">{hint}</p> : null}
      {children}
    </section>
  );
}
