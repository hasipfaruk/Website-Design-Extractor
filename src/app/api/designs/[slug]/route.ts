import { NextResponse } from 'next/server';
import { ExtractionError } from '@/lib/extract';
import { BlockedUrlError } from '@/lib/guard';
import { BrowserUnavailableError } from '@/lib/browser';
import { catalogUrlFor, readDesignMarkdown, readExtractBundle } from '@/lib/catalog';
import { findCatalogEntry, SLUG_RE } from '@/lib/catalog-data';
import { ExtractorBusyError, isExtractBundle, runExtract } from '@/lib/extract-job';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

function markdownResponse(slug: string, body: string, download: boolean) {
  const headers: Record<string, string> = {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Design-Slug': slug,
  };
  if (download) headers['Content-Disposition'] = 'attachment; filename="design.md"';
  return new NextResponse(body, { status: 200, headers });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const search = new URL(request.url).searchParams;
  const download = search.get('download') === '1';
  const accept = request.headers.get('accept') ?? '';
  const asJson = search.get('format') === 'json' || accept.includes('application/json');

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Unknown design. Use a slug like mobbin or stripe.' }, { status: 400 });
  }

  const existingMd = readDesignMarkdown(slug);
  const cached = readExtractBundle(slug);
  const existingBundle = isExtractBundle(cached) ? cached : null;

  if (existingBundle || existingMd) {
    const md =
      existingMd ||
      (typeof existingBundle?.designMd === 'string' ? existingBundle.designMd : '');
    if (download || !asJson) return markdownResponse(slug, md, download);
    return NextResponse.json({ slug, markdown: md, extract: existingBundle });
  }

  const url = catalogUrlFor(slug);
  if (!url) {
    const known = findCatalogEntry(slug);
    return NextResponse.json(
      { error: known ? 'That reference has no source URL yet.' : `No design named "${slug}".` },
      { status: 404 },
    );
  }

  try {
    const bundle = await runExtract(url, slug);
    if (download || !asJson) return markdownResponse(slug, bundle.designMd, download);
    return NextResponse.json({ slug, markdown: bundle.designMd, extract: bundle });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof BrowserUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof ExtractorBusyError) {
      return NextResponse.json({ error: err.message }, { status: 503, headers: { 'Retry-After': '10' } });
    }
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[designs] extract failed:', err);
    return NextResponse.json({ error: 'Could not build design.md for that site.' }, { status: 500 });
  }
}
