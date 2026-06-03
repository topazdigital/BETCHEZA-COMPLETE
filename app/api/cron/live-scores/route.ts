/**
 * Live score change tracker — runs every 2 minutes via cron.ts.
 * Detects goal/score changes in live matches and:
 *  1. Pushes browser notifications to users opted into live-score alerts.
 *  2. Updates strategy pick liveScores and immediately settles any picks
 *     whose outcome is now mathematically certain (e.g. Under line blown).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLiveMatches, getAllMatches } from '@/lib/api/unified-sports-api';
import { matchToSlug } from '@/lib/utils/match-url';
import { listPushSubscriptions } from '@/lib/notification-store';
import { sendPushToSubscription } from '@/lib/push-sender';
import { query, execute } from '@/lib/db';
import { checkPickResult, normalizeTeam, matchTeamWords } from '@/lib/strategy-settle';
import { sendStrategyResultPush } from '@/lib/strategy-push';
import { pingMatchResult, pingIndexNow } from '@/lib/indexnow';
import { pingGoogleIndexingBatch } from '@/lib/google-indexing';
import type { StrategyPick } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// In-memory score snapshot keyed by matchId → "homeScore:awayScore"
// __sentGoalKeys: Set of "matchId:score" strings already notified — prevents
// duplicate pushes if the cron fires twice in quick succession or the snap
// state is stale after an API outage.
// __liveStatusSnap: previous status per matchId — used to detect live→finished transitions
// so we can fire an IndexNow ping the moment a result is confirmed.
const g = globalThis as {
  __liveScoreSnap?: Map<string, string>;
  __liveStatusSnap?: Map<string, string>;
  __liveScoreCronBusy?: boolean;
  __sentGoalKeys?: Set<string>;
};
if (!g.__liveScoreSnap) g.__liveScoreSnap = new Map();
if (!g.__liveStatusSnap) g.__liveStatusSnap = new Map();
if (!g.__sentGoalKeys) g.__sentGoalKeys = new Set();
const snap = g.__liveScoreSnap;
const statusSnap = g.__liveStatusSnap;
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
    // Always run past-pick settlement on every cron tick — finished games are no
    // longer "live" so they won't show up in getLiveMatches(). This ensures picks
    // from games that ended since the last cron run get settled promptly.
    settleRecentPendingStrategyPicks().catch(e =>
      console.warn('[live-scores] past-pick settlement failed:', e?.message ?? e)
    );

    const matches = await getLiveMatches();
    if (matches.length === 0) {
      return NextResponse.json({ ok: true, live: 0, goals: 0 });
    }

    const goals: Array<{ matchId: string; homeTeam: string; awayTeam: string; title: string; score: string }> = [];
    const justFinished: Array<{ matchId: string; homeTeam: string; awayTeam: string }> = [];
    const justWentLive: Array<{ matchId: string; homeTeam: string; awayTeam: string }> = [];

    for (const m of matches) {
      const current = scoreKey(m.homeScore, m.awayScore);
      const previous = snap.get(m.id);

      // Track live→finished transitions for IndexNow freshness pings
      const prevStatus = statusSnap.get(m.id);
      const isNowFinished = ['finished', 'ft', 'full-time', 'aet', 'pen', 'walkover', 'awarded'].includes(
        (m.status || '').toLowerCase()
      );
      const isNowLive = ['live', 'inprogress', 'in_progress', 'halftime', 'ht', 'extra_time', 'penalties', 'break'].includes(
        (m.status || '').toLowerCase()
      );
      const wasLive = prevStatus && ['live', 'inprogress', 'in_progress', 'halftime', 'ht', 'extra_time', 'penalties', 'break'].includes(prevStatus.toLowerCase());
      const wasScheduled = !prevStatus || ['scheduled', 'tbd', 'upcoming', 'pre', 'preview', 'ns', 'not_started', ''].includes(prevStatus.toLowerCase());
      if (isNowFinished && wasLive) {
        justFinished.push({ matchId: m.id, homeTeam: m.homeTeam.name, awayTeam: m.awayTeam.name });
      }
      if (isNowLive && wasScheduled) {
        justWentLive.push({ matchId: m.id, homeTeam: m.homeTeam.name, awayTeam: m.awayTeam.name });
      }
      statusSnap.set(m.id, m.status || '');

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
          homeTeam: m.homeTeam.name,
          awayTeam: m.awayTeam.name,
          title: `${m.homeTeam.name} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.awayTeam.name}`,
          score: current,
        });
      }
    }

    // Clean up entries for matches that are no longer live
    const liveIds = new Set(matches.map(m => m.id));
    for (const key of snap.keys()) {
      if (!liveIds.has(key)) snap.delete(key);
    }

    // IndexNow + Google Indexing: ping for every match that just reached full-time.
    // This tells search engines the result page has fresh, unique content.
    if (justFinished.length > 0) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
      const finishedUrls: string[] = [];
      for (const m of justFinished) {
        pingMatchResult(m.matchId, m.homeTeam, m.awayTeam).catch(() => {});
        console.log(`[live-scores] IndexNow queued for FT result: ${m.homeTeam} vs ${m.awayTeam}`);
        // Use canonical slug format so Google indexes the right URL
        const slug = matchToSlug(m.matchId, m.homeTeam, m.awayTeam);
        finishedUrls.push(`${siteUrl}/matches/${slug}`);
      }
      // Also ping Google's Indexing API (direct crawl queue)
      if (finishedUrls.length > 0) {
        pingGoogleIndexingBatch(finishedUrls).catch(() => {});
      }
    }

    // IndexNow ping when matches just kicked off (scheduled → live).
    // Tells search engines the live page is now high-priority content.
    if (justWentLive.length > 0) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
      const liveUrls: string[] = [];
      for (const m of justWentLive) {
        try {
          const { matchToSlug } = await import('@/lib/utils/match-url');
          liveUrls.push(`${siteUrl}/matches/${matchToSlug(m.matchId, m.homeTeam, m.awayTeam)}`);
          console.log(`[live-scores] IndexNow: match just went live: ${m.homeTeam} vs ${m.awayTeam}`);
        } catch { liveUrls.push(`${siteUrl}/matches/${m.matchId}`); }
      }
      pingIndexNow(liveUrls);
      pingGoogleIndexingBatch(liveUrls).catch(() => {});
    }

    // Also ping sitemap for Bing to discover any new match pages
    if (goals.length > 0 || justFinished.length > 0 || justWentLive.length > 0) {
      pingIndexNow([
        `${process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke'}/sitemap.xml`,
      ]);
    }

    if (goals.length === 0) {
      return NextResponse.json({ ok: true, live: matches.length, goals: 0, finished: justFinished.length });
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
      const url = `/matches/${matchToSlug(goal.matchId, goal.homeTeam, goal.awayTeam)}`;

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

    return NextResponse.json({ ok: true, live: matches.length, goals: goals.length, pushed, finished: justFinished.length });
  } catch (e) {
    console.warn('[cron/live-scores] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    g.__liveScoreCronBusy = false;
  }
}

/**
 * Settle pending strategy picks from the last 3 days whose kickoff was >2h ago.
 * Runs every time the live-scores cron fires so that picks from finished matches
 * (which are no longer "live" and missed by updateStrategyPickLiveScores) get
 * settled automatically without needing an admin action.
 *
 * Uses the in-memory getAllMatches() cache — essentially free after the first call.
 */
async function settleRecentPendingStrategyPicks() {
  const now = Date.now();
  const TWO_HOURS_MS = 2 * 3600_000;

  // Build ISO dates for the last 30 days (full coverage — old pending picks get settled)
  const nairobi = (offsetDays: number) => {
    const d = new Date(now + offsetDays * 86_400_000);
    const s = d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }).split(',')[0];
    const [mo, dy, yr] = s.split('/');
    return `${yr}-${mo.padStart(2, '0')}-${dy.padStart(2, '0')}`;
  };
  const dates = Array.from({ length: 30 }, (_, i) => nairobi(-i));

  // Check if any of the recent days have pending picks before hitting the DB
  let rows: { id: number; date: string; day_number: number; picks: string; status: string }[] = [];
  try {
    const placeholders = dates.map(() => '?').join(', ');
    const res = await query<{ id: number; date: string; day_number: number; picks: string; status: string }>(
      `SELECT id, date, day_number, picks, status FROM daily_strategy WHERE date IN (${placeholders}) AND picks IS NOT NULL`,
      dates
    );
    rows = res.rows;
  } catch { return; }

  // Process rows that have pending picks OR picks with stale liveStatus: 'live'
  const pendingRows = rows.filter(r => {
    try {
      const picks: StrategyPick[] = JSON.parse(r.picks || '[]');
      return picks.some(p => p.result === 'pending' || (p.result !== 'pending' && p.liveStatus === 'live'));
    } catch { return false; }
  });

  if (pendingRows.length === 0) return; // nothing to do

  // Fetch the full match cache (cheap — uses in-process TTL cache)
  let finishedScores: Map<string, { homeScore: number; awayScore: number; homeTeam: string; awayTeam: string }>;
  try {
    const allMatches = await getAllMatches();
    finishedScores = new Map();
    for (const m of allMatches) {
      if (m.status !== 'finished') continue;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') continue;
      const hn = m.homeTeam?.name || '';
      const an = m.awayTeam?.name || '';
      if (!hn || !an) continue;
      finishedScores.set(`${normalizeTeam(hn)}_${normalizeTeam(an)}`, {
        homeScore: m.homeScore, awayScore: m.awayScore,
        homeTeam: hn, awayTeam: an,
      });
    }

    // Also merge in the Results page cache as a secondary fallback source.
    // This covers matches that the live-score API has dropped from its feed
    // (e.g. South American leagues, rate-limited providers) but whose scores
    // were captured when the match was live or when a user visited /results.
    const gResults = globalThis as {
      __resultsCache?: {
        data: Array<{
          homeTeam: { name: string };
          awayTeam: { name: string };
          homeScore: number | null;
          awayScore: number | null;
          status: string;
        }>;
        ts: number;
      };
    };
    if (gResults.__resultsCache?.data) {
      for (const m of gResults.__resultsCache.data) {
        if (m.status !== 'finished') continue;
        if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') continue;
        const hn = m.homeTeam?.name || '';
        const an = m.awayTeam?.name || '';
        if (!hn || !an) continue;
        const key = `${normalizeTeam(hn)}_${normalizeTeam(an)}`;
        if (!finishedScores.has(key)) {
          finishedScores.set(key, {
            homeScore: m.homeScore, awayScore: m.awayScore,
            homeTeam: hn, awayTeam: an,
          });
        }
      }
    }
  } catch { return; }

  for (const row of pendingRows) {
    let picks: StrategyPick[];
    try { picks = JSON.parse(row.picks || '[]'); } catch { continue; }

    let changed = false;
    const updated = picks.map(pick => {
      // Clean up stale liveStatus: 'live' on already-settled picks
      // (happens when a day rolled over before the status was cleared)
      if (pick.result !== 'pending' && pick.liveStatus === 'live') {
        changed = true;
        return { ...pick, liveStatus: 'finished' as const };
      }

      if (pick.result !== 'pending') return pick;

      // Only try to settle if kickoff is >2h in the past
      const kickoff = pick.matchTime ? new Date(pick.matchTime).getTime() : 0;
      if (now - kickoff < TWO_HOURS_MS) return pick;

      const pHn = normalizeTeam(pick.homeTeam);
      const pAn = normalizeTeam(pick.awayTeam);

      // Force-settle bare over/under after 24h — assume Over 2.5 line
      const TWENTY_FOUR_HOURS_MS = 24 * 3600_000;
      const forceSettle = now - kickoff > TWENTY_FOUR_HOURS_MS;

      let scored: { homeScore: number; awayScore: number } | null = null;
      for (const [, v] of finishedScores) {
        const vHn = normalizeTeam(v.homeTeam);
        const vAn = normalizeTeam(v.awayTeam);
        const homeOk = vHn === pHn || vHn.includes(pHn) || pHn.includes(vHn) || matchTeamWords(v.homeTeam, pick.homeTeam);
        const awayOk = vAn === pAn || vAn.includes(pAn) || pAn.includes(vAn) || matchTeamWords(v.awayTeam, pick.awayTeam);
        if (homeOk && awayOk) { scored = v; break; }
      }
      // For picks older than 7 days with no match data found, force-settle as lost
      const SEVEN_DAYS_MS = 7 * 24 * 3600_000;
      if (!scored) {
        if (now - kickoff > SEVEN_DAYS_MS) {
          // Match data no longer available; mark void so it doesn't stay pending forever
          changed = true;
          return { ...pick, result: 'void' as const, liveStatus: 'finished' as const, actualScore: 'N/A' };
        }
        return pick;
      }

      const result = checkPickResult(pick, scored.homeScore, scored.awayScore, forceSettle);
      if (!result) return pick;

      const scoreStr = `${scored.homeScore}-${scored.awayScore}`;
      console.log(`[live-scores] Past-pick settled: ${pick.homeTeam} vs ${pick.awayTeam} | ${pick.market} ${pick.pick} | ${scoreStr} → ${result}`);
      changed = true;
      return { ...pick, result, actualScore: scoreStr, liveScore: scoreStr, liveStatus: 'finished' as const };
    });

    if (!changed) continue;

    const allSettled = updated.every(p => p.result !== 'pending');
    const allWon = allSettled && updated.every(p => p.result === 'win');
    const wasUnsettled = row.status !== 'completed';
    try {
      await execute(
        `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = IF(?, NOW(), settled_at) WHERE id = ?`,
        [
          JSON.stringify(updated),
          allSettled ? (allWon ? 'win' : 'loss') : null,
          allSettled ? 'completed' : 'active',
          allSettled ? 1 : 0,
          row.id,
        ]
      );
    } catch (e) {
      console.warn('[live-scores] past-pick DB write failed:', e instanceof Error ? e.message : e);
    }

    // Fire result push exactly once per day when it first becomes fully settled
    if (allSettled && wasUnsettled) {
      const finalResult = allWon ? 'win' : 'loss';
      sendStrategyResultPush(row.date, row.day_number || 0, finalResult, updated).catch(() => {});
    }
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

  const rows = await query<{ id: number; day_number: number; picks: string; status: string }>(
    `SELECT id, day_number, picks, status FROM daily_strategy WHERE date = ? AND status = 'active' LIMIT 1`,
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
      // Picks are for 90-minute results only. Several markets must NOT be
      // early-settled mid-game — the state can change before the final whistle.
      // Only certain Over/Under/BTTS outcomes are truly certain mid-game (line blown, etc.).
      const marketLower = (pick.market || '').toLowerCase();
      const pickLower = (pick.pick || '').toLowerCase();
      const waitForFinalWhistle =
        // 1X2 / Match Result — trailing team can still equalise or win
        marketLower.includes('double chance') ||
        marketLower === '1x2' || marketLower.includes('1x2') ||
        marketLower === 'match result' || marketLower.includes('match result') ||
        marketLower === 'match winner' || marketLower === '' ||
        marketLower === 'full time result' || marketLower === 'ft result' ||
        // Win to Nil — leading team might concede before FT (1-0 → 1-1 kills the tip)
        marketLower.includes('win to nil') || marketLower.includes('win & clean') ||
        marketLower.includes('win and clean') || pickLower.includes('win to nil') ||
        // Clean Sheet — clean sheet can be broken any time before FT
        marketLower.includes('clean sheet') || pickLower.includes('clean sheet') ||
        // Draw No Bet — draw pushes, lead can be wiped out before FT
        marketLower.includes('draw no bet') || pickLower.includes('draw no bet') ||
        // HT/FT double result — always wait for FT
        marketLower.includes('half-time') || marketLower.includes('ht/ft') ||
        /^[12x]\/[12x]$/i.test(pickLower);

      if (!waitForFinalWhistle || liveStatus === 'finished') {
        const earlyResult = checkPickResult(pick, hs, as_);
        if (earlyResult === 'loss' || earlyResult === 'win') {
          changed = true;
          const label = liveStatus === 'finished' ? 'FT' : 'Early';
          console.log(`[live-scores] ${label} ${earlyResult.toUpperCase()} settled: ${pick.homeTeam} vs ${pick.awayTeam} | ${pick.market} ${pick.pick} @ ${scoreStr}`);
          return { ...pick, result: earlyResult, actualScore: scoreStr, liveScore: scoreStr, liveStatus };
        }
      }
    }

    // When a match finishes, correct any pick that was early-settled using an
    // intermediate score that turned out to be wrong (e.g. 0-1 during play → 1-1 FT).
    if (pick.result !== 'pending' && liveStatus === 'finished') {
      const finalResult = checkPickResult(pick, hs, as_);
      if (finalResult && finalResult !== pick.result) {
        changed = true;
        console.log(`[live-scores] Correcting early settlement: ${pick.homeTeam} vs ${pick.awayTeam} | ${pick.market} | was ${pick.result} → corrected to ${finalResult} at ${scoreStr}`);
        return { ...pick, result: finalResult, actualScore: scoreStr, liveScore: scoreStr, liveStatus };
      }
    }

    // Update liveScore for display; also lock in actualScore when match finishes
    // so admin resettle (Pass 1) always uses the true 90-min score, not an
    // intermediate snapshot captured during early settlement.
    const liveScoreChanged = pick.liveScore !== scoreStr || pick.liveStatus !== liveStatus;
    if (liveScoreChanged) {
      changed = true;
      return {
        ...pick,
        liveScore: scoreStr,
        liveStatus,
        ...(liveStatus === 'finished' ? { actualScore: scoreStr } : {}),
      };
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

  // Notify all push subscribers when all picks settle for the first time today
  if (allSettled) {
    const finalResult = allWon ? 'win' : 'loss';
    sendStrategyResultPush(todayISO, row.day_number || 0, finalResult, updatedPicks).catch(() => {});
  }
}
