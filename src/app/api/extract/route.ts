import { NextResponse } from 'next/server';
import { ExtractionError } from '@/lib/extract';
import { BlockedUrlError } from '@/lib/guard';
import { BrowserUnavailableError } from '@/lib/browser';
import { slugFromUrl } from '@/lib/catalog-data';
import { ExtractorBusyError, runExtract } from '@/lib/extract-job';
import { isErrorName } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let url: string;
  try {
    const body = await req.json();
    url = typeof body?.url === 'string' ? body.url : '';
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with a "url" field.' }, { status: 400 });
  }

  try {
    const bundle = await runExtract(url);
    const slug = slugFromUrl(bundle.report.meta.domain || bundle.report.meta.finalUrl);
    return NextResponse.json({
      report: bundle.report,
      slug,
      designMd: bundle.designMd,
      markdown: bundle.markdown,
      css: bundle.css,
      tailwind: bundle.tailwind,
      tokens: bundle.tokens,
    });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof BrowserUnavailableError || isErrorName(err, 'BrowserUnavailableError')) {
      return NextResponse.json({ error: (err as Error).message }, { status: 503 });
    }
    if (err instanceof ExtractorBusyError || isErrorName(err, 'ExtractorBusyError')) {
      return NextResponse.json({ error: (err as Error).message }, { status: 503, headers: { 'Retry-After': '10' } });
    }
    if (err instanceof ExtractionError || isErrorName(err, 'ExtractionError')) {
      const extraction = err as ExtractionError;
      return NextResponse.json({ error: extraction.message }, { status: extraction.status || 502 });
    }
    console.error('[extract] unexpected failure:', err);
    const detail = err instanceof Error ? err.message.split('\n')[0] : '';
    return NextResponse.json(
      {
        error: detail
          ? `Extract failed on this host: ${detail}`
          : 'Something went wrong while analysing that site.',
      },
      { status: 500 },
    );
  }
}
