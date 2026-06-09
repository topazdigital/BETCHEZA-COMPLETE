import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { clearMatchCache, getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await clearMatchCache();
    const fresh = await getAllMatches();
    return NextResponse.json({
      success: true,
      message: `Cache cleared and refreshed — ${fresh.length} matches loaded`,
      count: fresh.length,
    });
  } catch (error) {
    console.error('[Admin] Cache refresh failed:', error);
    return NextResponse.json({ error: 'Cache refresh failed' }, { status: 500 });
  }
}
