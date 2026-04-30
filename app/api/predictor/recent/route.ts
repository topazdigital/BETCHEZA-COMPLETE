import { NextResponse } from 'next/server';
import { listPredictions, ensureSeeded } from '@/lib/predictor-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(24, Number(searchParams.get('limit') || 9)));
  await ensureSeeded();
  return NextResponse.json(
    { predictions: listPredictions(limit) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
