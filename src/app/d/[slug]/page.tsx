'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DesignSystemView from '@/components/DesignSystemView';
import { parseDesignMd } from '@/lib/parse-design-md';
import type { ExtractResponse } from '@/components/Report';

function isExtract(value: unknown): value is ExtractResponse {
  if (!value || typeof value !== 'object') return false;
  const v = value as ExtractResponse;
  return !!(v.report && v.report.meta && Array.isArray(v.report.colors));
}

export default function DesignPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();
    setError(null);
    setMarkdown(null);
    setExtract(null);
    setLoaded(false);
    fetch(`/api/designs/${encodeURIComponent(slug)}?format=json`, {
      headers: { Accept: 'application/json' },
      signal: ac.signal,
    })
      .then(async (res) => {
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Could not load ${slug}.`);
        }
        if (type.includes('application/json')) return res.json();
        const text = await res.text();
        return { markdown: text, extract: null };
      })
      .then((payload: { markdown?: string; extract?: unknown }) => {
        const md = payload.markdown || '';
        const next = isExtract(payload.extract) ? payload.extract : null;
        setMarkdown(md || next?.designMd || next?.markdown || '');
        setExtract(next);
        setLoaded(true);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoaded(true);
      });
    return () => ac.abort();
  }, [slug]);

  const model = useMemo(
    () => parseDesignMd(markdown || extract?.designMd || extract?.markdown || ''),
    [markdown, extract],
  );

  if (error) {
    return (
      <div className="docs-status">
        <p>{error}</p>
        <Link href="/">Back to WebSift</Link>
      </div>
    );
  }

  if (!loaded || (!markdown && !extract)) {
    return (
      <div className="docs-status">
        <div className="bar" />
        <p>Loading the full design system for {slug}…</p>
      </div>
    );
  }

  return <DesignSystemView model={model} extract={extract} sourceLabel={slug} />;
}
