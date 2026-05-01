import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getFeaturedConfig, saveFeaturedConfig, DEFAULT_FEATURED_CONFIG } from '@/lib/featured-store';

export const dynamic = 'force-dynamic';

).role !== 'admin') return null;
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const config = await getFeaturedConfig();
  return NextResponse.json({ config, defaults: DEFAULT_FEATURED_CONFIG });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const patch = body.config && typeof body.config === 'object' ? (body.config as Record<string, unknown>) : body;

  // Coerce numeric / boolean fields safely.
  const coerced: Record<string, unknown> = {};
  if ('enabled' in patch) coerced.enabled = !!patch.enabled;
  if ('topTipsterOnly' in patch) coerced.topTipsterOnly = !!patch.topTipsterOnly;
  if ('minConfidence' in patch) coerced.minConfidence = clamp(Number(patch.minConfidence), 0, 100);
  if ('minOdds' in patch) coerced.minOdds = clamp(Number(patch.minOdds), 1, 100);
  if ('maxOdds' in patch) coerced.maxOdds = clamp(Number(patch.maxOdds), 1, 1000);
  if ('limit' in patch) coerced.limit = clamp(Math.round(Number(patch.limit)), 1, 24);
  if ('sport' in patch) coerced.sport = String(patch.sport || '').toLowerCase();
  if ('pinnedMatchIds' in patch) {
    const raw = patch.pinnedMatchIds;
    coerced.pinnedMatchIds = Array.isArray(raw)
      ? raw.map(String).map(s => s.trim()).filter(Boolean)
      : typeof raw === 'string'
        ? raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
        : [];
  }
  if ('hiddenMatchIds' in patch) {
    const raw = patch.hiddenMatchIds;
    coerced.hiddenMatchIds = Array.isArray(raw)
      ? raw.map(String).map(s => s.trim()).filter(Boolean)
      : typeof raw === 'string'
        ? raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
        : [];
  }

  const next = await saveFeaturedConfig(coerced);
  return NextResponse.json({ success: true, config: next });
}

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
