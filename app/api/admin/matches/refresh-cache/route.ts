import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { forceRefreshMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // Do not clear the persistent cache before fetching. ESPN can return an
    // empty/partial response when it is rate-limited; deleting the last good
    // snapshot first would blank the site even though the fetcher correctly
    // protects existing data from low-result writes.
    const refreshed = await forceRefreshMatches();
    if (refreshed.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Refresh returned no matches; existing cache was preserved',
        count: 0,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Refresh attempted — ${refreshed.length} matches available`,
      count: refreshed.length,
    });
  } catch (error) {
    console.error('[Admin] Cache refresh failed:', error);
    return NextResponse.json({ error: 'Cache refresh failed' }, { status: 500 });
  }
}
