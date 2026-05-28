/**
 * Live score change tracker — runs every 2 minutes via cron.ts.
 * Detects goal/score changes in live matches and:
 *  1. Pushes browser notifications to users opted into live-score alerts.
 *  2. Updates strategy pick liveScores and immediately settles any picks
 *     whose outcome is now mathematically certain (e.g. Under line blown).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLiveMatches } from '@/lib/api/unified-sports-api';
import { listPushSubscriptions } from '@/lib/notification-store';
import { sendPushToSubscription } from '@/lib/push-sender';
import { query, execute } from '@/lib/db';
import { checkPickResult, normalizeTeam, matchTeamWords } from '@/lib/strategy-settle';
import type { StrategyPick } from '@/app/api/strategy/predictions/route';

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

    // Gather all push subscriptions once
    const allSubs = await listPushSubscriptions();
    const liveSubs = allSubs.filter(s => s.topics.includes('live_scores') || s.topics.includes('all'));
    // Build a map of userId → subscriptions for targeted tip notifications
    const subsByUser = new Map<number, typeof allSubs>();
    for (const sub of allSubs) {
      if (!sub.userId) continue;
      const list = subsByUser.get(sub.userId) ?? [];
      list.push(sub);
      subsByUser.set(sub.userId, list);
    }

    let pushed = 0;
    for (const goal of goals) {
      const title = '⚽ Score Update';
      const body = goal.title;
      const url = `/matches/${goal.matchId}`;

      // 1. Broadcast to all live-score subscribers
      for (const sub of liveSubs) {
        sendPushToSubscription(sub, { title, body, url, tag: `score-${goal.matchId}` }).catch(() => {});
        pushed++;
      }

      // 2. Targeted push to users who have a pending tip on this exact match
      try {
        const tipRows = await query<{ user_id: number }>(
          `SELECT DISTINCT user_id FROM feed_posts WHERE match_id = ? AND pick IS NOT NULL AND user_id IS NOT NULL LIMIT 200`,
          [goal.matchId],
        );
        const tipUserIds = new Set(tipRows.rows.map(r => r.user_id));
        for (const uid of tipUserIds) {
          // Skip users already covered by live_scores broadcast
          if (liveSubs.some(s => s.userId === uid)) continue;
          const userSubs = subsByUser.get(uid) ?? [];
          for (const sub of userSubs) {
            sendPushToSubscription(sub, {
              title: '📊 Your Tip Match Updated',
              body: goal.title,
              url,
              tag: `tip-score-${goal.matchId}`,
            }).catch(() => {});
            pushed++;
          }
        }
      } catch { /* DB unavailable — skip tip notifications */ }

      console.log(`[live-scores] Goal detected: ${goal.title}`);
    }

    // ── Real-time strategy pick settlement ──────────────────────────────────
    // Every time a score changes, refresh liveScore on today's strategy picks and
    // immediately settle any picks that are now mathematically decided
    // (e.g. Under line blown = LOSS that can never recover regardless of VAR).
    await updateStrategyPickLiveScores(matches).catch(e =>
      console.warn('[live-scores] strategy live-score update failed:', e?.message ?? e)
    );

    return NextResponse.json({ ok: true, live: matches.length, goals: goals.length, pushed });
  } catch (e) {
    console.warn('[cron/live-scores] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    g.__liveScoreCronBusy = false;
  }
}

/**
 * For each live match, find today's strategy picks that reference the same fixture
 * and update their liveScore field.  Picks whose outcome is already mathematically
 * decided (Under line blown, etc.) are settled immediately.
 */
async function updateStrategyPickLiveScores(
  liveMatches: Awaited<ReturnType<typeof getLiveMatches>>
) {
  if (!liveMatches.length) return;

  // Fetch today's strategy row
  const todayStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }).split(',')[0];
  const [m, d, y] = todayStr.split('/');
  const todayISO = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

  const rows = await query<{ id: number; picks: string; status: string }>(
    `SELECT id, picks, status FROM daily_strategy WHERE date = ? AND status = 'active' LIMIT 1`,
    [todayISO]
  );
  if (!rows.rows.length) return;

  const row = rows.rows[0];
  let picks: StrategyPick[] = [];
  try { picks = JSON.parse(row.picks || '[]'); } catch { return; }
  if (!picks.length) return;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let changed = false;

  const updatedPicks = picks.map(pick => {
    const ph = norm(pick.homeTeam);
    const pa = norm(pick.awayTeam);
    const lm = liveMatches.find(m => {
      const mh = norm(m.homeTeam?.name || '');
      const ma = norm(m.awayTeam?.name || '');
      return (mh === ph || mh.includes(ph) || ph.includes(mh)) &&
             (ma === pa || ma.includes(pa) || pa.includes(ma));
    });
    if (!lm) return pick;

    const hs = lm.homeScore ?? 0;
    const as_ = lm.awayScore ?? 0;
    const scoreStr = `${hs}-${as_}`;
    const liveStatus: 'live' | 'finished' = lm.status === 'live' || lm.status === 'inprogress' ? 'live' : 'finished';

    // Only process pending picks for real-time settlement
    if (pick.result === 'pending') {
      // Settle immediately when outcome is mathematically certain mid-game.
      //  • LOSS certain: Under line blown, opponent scored enough — can never recover.
      //  • WIN certain:  Over line cleared, BTTS Yes after both scored, etc.
      // VAR can only disallow a goal that was just scored; once play resumes from
      // kick-off the review window is closed — same logic bookmakers use to pay out.
      const earlyResult = checkPickResult(pick, hs, as_);
      if (earlyResult === 'loss' || earlyResult === 'win') {
        changed = true;
        console.log(`[live-scores] Early ${earlyResult.toUpperCase()} settled: ${pick.homeTeam} vs ${pick.awayTeam} | ${pick.market} ${pick.pick} @ ${scoreStr}`);
        return { ...pick, result: earlyResult, actualScore: scoreStr, liveScore: scoreStr, liveStatus };
      }
    }

    // Update liveScore even for already-settled picks (FT score display)
    const liveScoreChanged = pick.liveScore !== scoreStr || pick.liveStatus !== liveStatus;
    if (liveScoreChanged) {
      changed = true;
      return { ...pick, liveScore: scoreStr, liveStatus };
    }
    return pick;
  });

  if (!changed) return;

  const allSettled = updatedPicks.every(p => p.result !== 'pending');
  const allWon = allSettled && updatedPicks.every(p => p.result === 'win');

  await execute(
    `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = IF(?, NOW(), settled_at) WHERE id = ?`,
    [
      JSON.stringify(updatedPicks),
      allSettled ? (allWon ? 'win' : 'loss') : null,
      allSettled ? 'completed' : 'active',
      allSettled ? 1 : 0,
      row.id,
    ]
  );
}
