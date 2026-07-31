import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getAnalytics } from '@/lib/ad-analytics';
import { getHistory } from '@/lib/advertising-log';

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !isAdmin(me.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const analytics = getAnalytics();
  const history   = getHistory(500);

  // Merge analytics into history entries for the UI
  const enriched = history.map(entry => ({
    ...entry,
    opens:  analytics[entry.id]?.opens  ?? 0,
    clicks: analytics[entry.id]?.clicks ?? 0,
    lastOpenAt:  analytics[entry.id]?.lastOpenAt,
    lastClickAt: analytics[entry.id]?.lastClickAt,
  }));

  // Aggregate stats per bookmaker
  const byCompany: Record<string, { sent: number; opens: number; clicks: number }> = {};
  for (const e of enriched) {
    const key = e.company;
    byCompany[key] ??= { sent: 0, opens: 0, clicks: 0 };
    byCompany[key].sent   += 1;
    byCompany[key].opens  += e.opens;
    byCompany[key].clicks += e.clicks;
  }

  const totalSent   = enriched.length;
  const totalOpens  = enriched.reduce((s, e) => s + e.opens,  0);
  const totalClicks = enriched.reduce((s, e) => s + e.clicks, 0);

  return NextResponse.json({
    entries: enriched,
    byCompany,
    totals: { sent: totalSent, opens: totalOpens, clicks: totalClicks },
  });
}
