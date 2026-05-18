/**
 * Live score change tracker — runs every 2 minutes via cron.ts.
 * Detects goal/score changes in live matches and pushes browser notifications
 * to users who have opted in to live score alerts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLiveMatches } from '@/lib/api/unified-sports-api';
import { listPushSubscriptions } from '@/lib/notification-store';
import { sendPushToSubscription } from '@/lib/push-sender';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// In-memory score snapshot keyed by matchId → "homeScore:awayScore"
// __sentGoalKeys: Set of "matchId:score" strings already notified — prevents
// duplicate pushes if the cron fires twice in quick succession or the snap
// state is stale after an API outage.
const g = globalThis as {
  __liveScoreSnap?: Map<string, string>;
  __liveScoreCronBusy?: boolean;
  __sentGoalKeys?: Set<string>;
};
if (!g.__liveScoreSnap) g.__liveScoreSnap = new Map();
if (!g.__sentGoalKeys) g.__sentGoalKeys = new Set();
const snap = g.__liveScoreSnap;
const sentGoals = g.__sentGoalKeys;

function scoreKey(home: number | null | undefined, away: number | null | undefined): string {
  return `${home ?? 0}:${away ?? 0}`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (g.__liveScoreCronBusy) {
    return NextResponse.json({ skipped: true, reason: 'previous run still in progress' });
  }
  g.__liveScoreCronBusy = true;

  try {
    const matches = await getLiveMatches();
    if (matches.length === 0) {
      return NextResponse.json({ ok: true, live: 0, goals: 0 });
    }

    const goals: Array<{ matchId: string; title: string; score: string }> = [];

    for (const m of matches) {
      const current = scoreKey(m.homeScore, m.awayScore);
      const previous = snap.get(m.id);

      if (previous === undefined) {
        // First time we see this match — just record, don't alert
        snap.set(m.id, current);
        continue;
      }

      if (previous !== current) {
        snap.set(m.id, current);
        // Dedup: skip if we already sent a push for this exact score change
        const goalKey = `${m.id}:${current}`;
        if (sentGoals.has(goalKey)) continue;
        sentGoals.add(goalKey);
        // Cap the dedup set size to avoid unbounded memory growth
        if (sentGoals.size > 500) {
          const first = sentGoals.values().next().value;
          if (first) sentGoals.delete(first);
        }
        goals.push({
          matchId: m.id,
          title: `${m.homeTeam} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.awayTeam}`,
          score: current,
        });
      }
    }

    // Clean up entries for matches that are no longer live
    const liveIds = new Set(matches.map(m => m.id));
    for (const key of snap.keys()) {
      if (!liveIds.has(key)) snap.delete(key);
    }

    if (goals.length === 0) {
      return NextResponse.json({ ok: true, live: matches.length, goals: 0 });
    }

    // Send push notifications to all subscribed users
    const subs = await listPushSubscriptions();
    const pushSubs = subs.filter(s => s.topics.includes('live_scores') || s.topics.includes('all'));

    let pushed = 0;
    for (const goal of goals) {
      const title = '⚽ Score Update';
      const body = goal.title;
      const url = `/matches/${goal.matchId}`;
      for (const sub of pushSubs) {
        sendPushToSubscription(sub, { title, body, url, tag: `score-${goal.matchId}` }).catch(() => {});
        pushed++;
      }
      console.log(`[live-scores] Goal detected: ${goal.title}`);
    }

    return NextResponse.json({ ok: true, live: matches.length, goals: goals.length, pushed });
  } catch (e) {
    console.warn('[cron/live-scores] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    g.__liveScoreCronBusy = false;
  }
}
