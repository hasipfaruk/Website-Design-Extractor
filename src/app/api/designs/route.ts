import { NextResponse } from 'next/server';
import { listPublicDesigns } from '@/lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ designs: listPublicDesigns() });
}
