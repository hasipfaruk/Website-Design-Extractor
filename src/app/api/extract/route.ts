import { NextResponse } from 'next/server';
import { extractDesign, ExtractionError } from '@/lib/extract';
import { BlockedUrlError } from '@/lib/guard';
import { BrowserUnavailableError } from '@/lib/browser';
import { toMarkdown } from '@/lib/markdown';
import { toCssVariables, toTailwindConfig, toTokens } from '@/lib/exporters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// --------------------------------------------------------------- throttling
// Chromium contexts are expensive; without these an open endpoint is trivial
// to knock over. In-memory only - a multi-instance deploy needs shared state.
const MAX_CONCURRENT = 3;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

let inFlight = 0;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
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

  if (inFlight >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: 'The extractor is busy with other sites. Try again in a moment.' },
      { status: 503, headers: { 'Retry-After': '10' } },
    );
  }

  let url: string;
  try {
    const body = await req.json();
    url = typeof body?.url === 'string' ? body.url : '';
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with a "url" field.' }, { status: 400 });
  }

  inFlight++;
  try {
    const report = await extractDesign(url);

    return NextResponse.json({
      report,
      markdown: toMarkdown(report),
      css: toCssVariables(report),
      tailwind: toTailwindConfig(report),
      tokens: toTokens(report),
    });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof BrowserUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[extract] unexpected failure:', err);
    return NextResponse.json(
      { error: 'Something went wrong while analysing that site.' },
      { status: 500 },
    );
  } finally {
    inFlight--;
  }
}
