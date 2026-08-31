'use client';

import { useEffect, useRef, useState } from 'react';
import Report, { type ExtractResponse } from '@/components/Report';

const EXAMPLES = ['stripe.com', 'linear.app', 'github.com', 'vercel.com', 'tailwindcss.com'];

const STAGES = [
  'Launching a headless browser…',
  'Loading the page…',
  'Waiting for fonts and lazy content…',
  'Reading computed styles from every element…',
  'Parsing stylesheets for tokens and @font-face…',
  'Building the report…',
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Walk the status text forward while the request is in flight. Purely
  // cosmetic - the server does not stream progress.
  useEffect(() => {
    if (!busy) {
      setStage(0);
      return;
    }
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(id);
  }, [busy]);

  async function analyse(target: string) {
    const trimmed = target.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error ?? `Request failed with status ${res.status}.`);
        return;
      }
      setData(payload as ExtractResponse);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Could not reach the extractor. Is the dev server still running?');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setData(null);
    setError(null);
    setUrl('');
    inputRef.current?.focus();
  }

  return (
    <main className="shell">
      <header className={data ? 'masthead compact' : 'masthead'}>
        <div className="wordmark">
          <span className="dot" />
          Design Extractor
        </div>
        {!data && (
          <>
            <h1 className="title">Every design decision on any site, in one file.</h1>
            <p className="lede">
              Paste a URL. Get the colours, fonts, heading sizes, line heights, spacing scale, radii,
              shadows, icons and components — as a report you can read, or a <code>design.md</code> you can download.
            </p>
          </>
        )}
      </header>

      {!data && (
        <>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              analyse(url);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="stripe.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              aria-label="Website URL"
            />
            <button type="submit" className="btn primary" disabled={busy || !url.trim()}>
              {busy ? 'Analysing…' : 'Extract design'}
            </button>
          </form>

          <div className="examples">
            <span>Try:</span>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => {
                  setUrl(e);
                  analyse(e);
                }}
              >
                {e}
              </button>
            ))}
          </div>

          {error && <div className="alert">{error}</div>}

          {busy && (
            <div className="progress">
              <div className="bar" />
              {STAGES[stage]}
            </div>
          )}

          {!busy && !error && (
            <div className="features">
              <div className="feature">
                <h3>Real computed styles</h3>
                <p>Chromium renders the page first, so you get sizes as shipped — not guesses from raw CSS.</p>
              </div>
              <div className="feature">
                <h3>Typography, role by role</h3>
                <p>h1 through h6, body, buttons, links and captions with size, weight, line height and tracking.</p>
              </div>
              <div className="feature">
                <h3>Ranked colour palette</h3>
                <p>Weighted by how much of the page each colour actually paints, with WCAG contrast for each.</p>
              </div>
              <div className="feature">
                <h3>Tokens you can paste</h3>
                <p>CSS custom properties, a Tailwind theme, JSON tokens, and the full markdown report.</p>
              </div>
            </div>
          )}
        </>
      )}

      {data && <Report data={data} onReset={reset} />}

      <footer className="footer">
        Runs a real browser against the URL you enter. Analyse sites you have permission to inspect.
      </footer>
    </main>
  );
}
