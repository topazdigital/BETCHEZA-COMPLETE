import { NextResponse } from 'next/server';
import { listPredictions, ensureSeeded, settlePredictions } from '@/lib/predictor-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(24, Number(searchParams.get('limit') || 9)));
  await ensureSeeded();
  // Settle any predictions whose matches have now finished (best-effort, non-blocking)
  settlePredictions().catch(() => {});
  // Only surface winning predictions — never show lost or pending to visitors
  return NextResponse.json(
    { predictions: listPredictions(limit, 'won') },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
