/**
 * Challenge Status Sync cron — runs every 5 minutes via cron.ts.
 *
 * For every active/pending challenge:
 *  1. Fetches the current match status from the unified sports API.
 *  2. Updates `match_status` in the `challenges` table if it has changed
 *     (scheduled → live, live → finished, etc.).
 *  3. Triggers `settlePendingChallenges()` whenever any match flips to
 *     "finished" so prize payouts happen immediately.
 *
 * This ensures the DB always reflects the true match state, so the
 * Challenges page section grouping (Live Now / Upcoming / Settled) is
 * accurate even between SSE heartbeats or when the API returns a stale
 * "scheduled" status after a match has already kicked off.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getMatchById } from '@/lib/api/unified-sports-api';
import { settlePendingChallenges } from '@/lib/challenges-store';
import { notifyParticipantsMatchLive } from '@/lib/challenge-notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// Prevent overlapping runs (the sports API calls can be slow)
const g = globalThis as { __challengeStatusSyncBusy?: boolean };

const LIVE_STATUSES = new Set([
  'live', '1h', '2h', 'ht', 'halftime', 'inprogress', 'in_progress',
  'extra_time', 'aet', 'pen', 'paused', 'break', 'penalties',
]);
const FINISHED_STATUSES = new Set([
  'finished', 'final', 'ft', 'full-time', 'fulltime', 'complete',
  'completed', 'ended', 'after extra time', 'after penalties',
  'walkover', 'awarded',
]);

function normaliseStatus(raw: string | null | undefined): 'scheduled' | 'live' | 'finished' {
  const s = (raw || '').toLowerCase().trim();
  if (LIVE_STATUSES.has(s)) return 'live';
  if (FINISHED_STATUSES.has(s)) return 'finished';
  for (const ls of LIVE_STATUSES) { if (s.includes(ls)) return 'live'; }
  for (const fs of FINISHED_STATUSES) { if (s.includes(fs)) return 'finished'; }
  return 'scheduled';
}

interface ChallengeRow {
  id: number;
  match_id: string;
  match_status: string;
  match_kickoff: string | null;
  challenger_id: number;
  challenged_id: number | null;
  match_home_team: string;
  match_away_team: string;
  is_fake: number;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (g.__challengeStatusSyncBusy) {
    return NextResponse.json({ skipped: true, reason: 'previous run still in progress' });
  }
  g.__challengeStatusSyncBusy = true;

  try {
    // Fetch all non-settled, non-cancelled challenges that have a match ID.
    // Include participant columns so we can send per-user push notifications.
    // .catch() ensures DB errors (access denied, no pool) degrade gracefully.
    const result = await query<ChallengeRow>(
      `SELECT id, match_id, match_status, match_kickoff,
              challenger_id, challenged_id, match_home_team, match_away_team, is_fake
       FROM challenges
       WHERE status IN ('active', 'pending')
         AND match_id != ''
       LIMIT 100`,
      []
    ).catch(() => ({ rows: [] as ChallengeRow[] }));
    const rows = result.rows;

    if (!rows.length) {
      return NextResponse.json({ ok: true, checked: 0, updated: 0, settled: 0, cancelled: 0 });
    }

    // Deduplicate by match_id — many challenges share the same fixture
    const uniqueMatchIds = [...new Set(rows.map(r => r.match_id))];

    // Resolve current status for each match from the sports API.
    // Use kickoff time as a fallback when the API returns a stale "scheduled" status.
    const now = Date.now();
    const statusMap = new Map<string, 'scheduled' | 'live' | 'finished'>();

    // Build a kickoff-time map from DB rows so we can do time-based fallback
    // even when the sports API is unavailable (e.g. circuit breaker open).
    // Immediately force-settle any challenges where kickoff was >2 hours ago
    // but match_status is still 'scheduled' (covers API-down / ESPN circuit-open cases).
    // Do this BEFORE the per-match API loop so the settlement happens even if all
    // API calls fail this run.
    try {
      await execute(
        `UPDATE challenges
         SET match_status = 'finished', updated_at = NOW()
         WHERE status IN ('active','pending')
           AND match_kickoff IS NOT NULL
           AND match_kickoff < DATE_SUB(NOW(), INTERVAL 120 MINUTE)
           AND match_status = 'scheduled'`,
        []
      );
    } catch { /* non-fatal — we'll still try the API-based path */ }

    const kickoffByMatchId = new Map<string, number>();
    for (const row of rows) {
      if (row.match_id && row.match_kickoff) {
        // MySQL2 can return DATETIME as a Date object or a string — normalise both
        const rawKo = row.match_kickoff as unknown;
        const ms = rawKo instanceof Date
          ? rawKo.getTime()
          : new Date(String(rawKo)).getTime();
        if (!isNaN(ms)) kickoffByMatchId.set(row.match_id, ms);
      }
    }

    await Promise.allSettled(uniqueMatchIds.map(async (matchId) => {
      try {
        const match = await getMatchById(matchId);

        // Time-based fallback when API is unavailable or returns no match.
        const koMs = match?.kickoff
          ? (typeof match.kickoff === 'number' ? match.kickoff : new Date(match.kickoff as string).getTime())
          : (kickoffByMatchId.get(matchId) ?? 0);
        const elapsedMin = koMs > 0 ? (now - koMs) / 60_000 : -1;

        if (!match) {
          // API returned nothing — use kickoff time as the only signal.
          if (elapsedMin >= 115) {
            statusMap.set(matchId, 'finished');
          } else if (elapsedMin >= 0) {
            statusMap.set(matchId, 'live');
          }
          // If elapsedMin < 0 (future match) or no kickoff info, leave as-is.
          return;
        }

        let resolved = normaliseStatus(match.status);

        // Kickoff-time override: if the API still says "scheduled" but
        // we're past kickoff (+ up to 110 min for a normal match) → treat as live.
        // If we're >115 min past kickoff and the API still hasn't flipped → finished.
        if (resolved === 'scheduled' && elapsedMin >= 0) {
          if (elapsedMin < 115) resolved = 'live';
          else resolved = 'finished';
        }

        statusMap.set(matchId, resolved);
      } catch {
        // API threw — still apply time-based fallback from DB kickoff
        const koMs = kickoffByMatchId.get(matchId) ?? 0;
        const elapsedMin = koMs > 0 ? (now - koMs) / 60_000 : -1;
        if (elapsedMin >= 115) statusMap.set(matchId, 'finished');
        else if (elapsedMin >= 0) statusMap.set(matchId, 'live');
      }
    }));

    // Update the DB for any challenge whose match_status has changed.
    // Track transitions for push notifications.
    let updated = 0;
    const finishedMatchIds = new Set<string>();
    const wentLiveRows: ChallengeRow[] = [];

    for (const row of rows) {
      const newStatus = statusMap.get(row.match_id);
      if (!newStatus) continue;

      if (newStatus === 'finished') finishedMatchIds.add(row.match_id);

      const oldStatus = row.match_status || 'scheduled';
      // Only write if the value actually changed
      if (newStatus === oldStatus) continue;

      try {
        await execute(
          `UPDATE challenges SET match_status = ?, updated_at = NOW() WHERE id = ?`,
          [newStatus, row.id]
        );
        updated++;
        console.log(`[challenge-status-sync] id=${row.id} match=${row.match_id}: ${oldStatus} → ${newStatus}`);

        // Collect challenges that just went live for participant notifications
        if (newStatus === 'live' && oldStatus === 'scheduled') {
          wentLiveRows.push(row);
        }
      } catch (e) {
        console.warn(`[challenge-status-sync] DB update failed for id=${row.id}:`, e instanceof Error ? e.message : e);
      }
    }

    // Fire "match is live" push + in-app notifications to participants
    if (wentLiveRows.length > 0) {
      await Promise.allSettled(wentLiveRows.map(row =>
        notifyParticipantsMatchLive({
          challengeId: row.id,
          challengerId: row.challenger_id,
          challengedId: row.challenged_id,
          homeTeam: row.match_home_team,
          awayTeam: row.match_away_team,
          isFake: Boolean(row.is_fake),
        }).catch(() => {})
      ));
    }

    // Trigger settlement unconditionally — not just when a match transitioned to
    // finished in this run. Challenges whose match_status was already set to
    // 'finished' by the force-settle UPDATE above (or in a prior run) are still
    // sitting in 'active' status and only get resolved when settlePendingChallenges()
    // reads the DB-persisted matchStatus. Gating on finishedMatchIds caused
    // stuck challenges from weeks/months ago to never get processed.
    let settled = 0;
    let cancelled = 0;
    try {
      const result = await settlePendingChallenges();
      settled = result.settled;
      cancelled = result.cancelled;
      if (settled > 0 || cancelled > 0) {
        console.log(`[challenge-status-sync] settled=${settled} cancelled=${cancelled}`);
      }
    } catch (e) {
      console.warn('[challenge-status-sync] settlePendingChallenges failed:', e instanceof Error ? e.message : e);
    }

    console.log(
      `[challenge-status-sync] checked ${uniqueMatchIds.length} matches across ${rows.length} challenges — updated ${updated} rows, settled ${settled}, cancelled ${cancelled}`
    );

    return NextResponse.json({
      ok: true,
      checked: uniqueMatchIds.length,
      updated,
      settled,
      cancelled,
    });
  } catch (e) {
    console.warn('[cron/challenge-status-sync] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    g.__challengeStatusSyncBusy = false;
  }
}
