'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Catalog, { type CatalogDesign } from '@/components/Catalog';
import HeroDemo from '@/components/HeroDemo';
import { CATALOG, type PublicDesign } from '@/lib/catalog-data';

const STAGES = [
  'Launching a headless browser…',
  'Loading the page…',
  'Waiting for fonts and lazy content…',
  'Reading computed styles from every element…',
  'Parsing stylesheets for tokens and @font-face…',
  'Writing design.md…',
];

const FALLBACK: CatalogDesign[] = CATALOG.map((e) => ({
  slug: e.slug,
  name: e.name,
  description: e.description,
  url: e.url,
  ready: !!e.file,
  sections: e.sections ?? null,
  screens: e.screens ?? null,
}));

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

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [designs, setDesigns] = useState<CatalogDesign[]>(FALLBACK);
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(CATALOG[0]?.slug ?? 'mobbin');
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/designs')
      .then((r) => r.json())
      .then((payload: { designs?: PublicDesign[] }) => {
        if (payload.designs?.length) setDesigns(payload.designs);
      })
      .catch(() => {
        /* keep bundled fallback */
      });
  }, []);

  useEffect(() => {
    if (!busy && !busySlug) {
      setStage(0);
      return;
    }
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(id);
  }, [busy, busySlug]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  async function analyse(target: string) {
    const trimmed = target.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);

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
      const slug = payload?.slug as string | undefined;
      if (slug) {
        router.push(`/d/${slug}`);
        return;
      }
      setError('Extract finished but no design slug was returned.');
    } catch {
      setError('Could not reach the extractor. Is the dev server still running?');
    } finally {
      setBusy(false);
    }
  }

  async function addDesign(design: CatalogDesign) {
    if (busySlug) return;
    setBusySlug(design.slug);
    setError(null);
    try {
      const res = await fetch(`/api/designs/${design.slug}?download=1`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.error ?? `Could not fetch design.md for ${design.slug}.`;
        setError(message);
        setToast(message);
        return;
      }
      const text = await res.text();
      triggerDownload('design.md', text);
      setDesigns((prev) => prev.map((d) => (d.slug === design.slug ? { ...d, ready: true } : d)));
      setToast(`design.md downloaded for ${design.name}`);
    } catch {
      setError('Could not download that design.md.');
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div className="site">
      <header className="topbar">
        <Link className="wordmark" href="/">
          WebSift
        </Link>
        <nav className="top-links">
          <a href="#how">How it works</a>
          <a href="#extract">Request an extract</a>
          <a href="#catalog">Website catalog</a>
        </nav>
        <div className="top-search">
          <input
            type="search"
            placeholder="Search design.md"
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (next.trim()) {
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            aria-label="Search design references"
          />
        </div>
        <a className="btn" href="#extract">
          Start
        </a>
      </header>

      <section className="hero-split">
        <div className="hero-copy">
          <p className="eyebrow">Open-source collection for AI coding agents</p>
          <h1 className="title">
            Give AI-built websites a real design with <em>WebSift</em>
          </h1>
          <p className="lede">
            Give your coding agent a compelling reference: colors, typography, spacing, components,
            and the reasoning behind them — so every page follows one visual language.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#catalog">
              Browse catalog
            </a>
            <a className="btn" href="#extract">
              Extract any URL
            </a>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section className="feature-grid" aria-label="Product">
        <a href="#extract" className="feature-card">
          <h3>Request an extract</h3>
          <p>Paste a public URL. We read live computed styles and write a design.md.</p>
        </a>
        <a href="#catalog" className="feature-card">
          <h3>Website catalog</h3>
          <p>Browse references and open a full design-system analysis, or download the file.</p>
        </a>
        <a href="#how" className="feature-card">
          <h3>How it works</h3>
          <p>Generic AI layout on the left. The same screen after design.md on the right.</p>
        </a>
      </section>

      <section className="gd-extract" id="extract">
        <div className="extract-copy">
          <h2>Match a reference you like</h2>
          <p>
            Paste any public URL. Chromium renders the page, we read computed styles, and you get a{' '}
            <code>design.md</code> plus a browsable analysis. The first visit after idle can take a
            minute while the free server wakes.
          </p>
        </div>
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
            {busy ? 'Extracting…' : 'Extract design.md'}
          </button>
        </form>
        {error && <div className="alert">{error}</div>}
        {busy && (
          <div className="progress">
            <div className="bar" />
            {STAGES[stage]}
          </div>
        )}
      </section>

      <section className="how" id="how">
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Pick a reference</strong>
            <span>Search the catalog or paste any public URL.</span>
          </li>
          <li>
            <strong>We extract the system</strong>
            <span>A real browser reads colours, type, spacing and components.</span>
          </li>
          <li>
            <strong>You get design.md</strong>
            <span>Open the analysis, download the file, hand it to your coding agent.</span>
          </li>
        </ol>
      </section>

      {error && busySlug === null && !busy ? (
        <div className="alert catalog-error" role="alert">
          {error}
        </div>
      ) : null}

      <Catalog
        designs={designs}
        query={query}
        busySlug={busySlug}
        selectedSlug={selectedSlug}
        onSelect={setSelectedSlug}
        onAdd={addDesign}
      />

      {toast && <div className="toast">{toast}</div>}

      <footer className="site-footer">
        <div>
          <strong>WebSift</strong>
          <p>Sift any site into a complete design system your agent can follow.</p>
        </div>
        <div>
          <b>Product</b>
          <a href="#extract">Request an extract</a>
          <a href="#catalog">Website catalog</a>
          <a href="#how">How it works</a>
        </div>
        <div>
          <b>Use</b>
          <span>Download design.md</span>
          <span>Open the analysis</span>
          <span>Give it to your agent</span>
        </div>
      </footer>
    </div>
  );
}
