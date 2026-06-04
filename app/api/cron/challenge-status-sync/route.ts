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
    const result = await query<ChallengeRow>(
      `SELECT id, match_id, match_status, match_kickoff,
              challenger_id, challenged_id, match_home_team, match_away_team, is_fake
       FROM challenges
       WHERE status IN ('active', 'pending')
         AND match_id != ''
       LIMIT 100`,
      []
    );
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

    await Promise.allSettled(uniqueMatchIds.map(async (matchId) => {
      try {
        const match = await getMatchById(matchId);
        if (!match) return;

        let resolved = normaliseStatus(match.status);

        // Kickoff-time override: if the API still says "scheduled" but
        // we're past kickoff (+ up to 105 min for a normal match) → treat as live.
        // If we're >110 min past kickoff and the API still hasn't flipped → finished.
        if (resolved === 'scheduled' && match.kickoff) {
          const ko = typeof match.kickoff === 'number'
            ? match.kickoff
            : new Date(match.kickoff as string).getTime();
          const elapsedMin = (now - ko) / 60_000;
          if (elapsedMin >= 0 && elapsedMin < 110) resolved = 'live';
          else if (elapsedMin >= 110) resolved = 'finished';
        }

        statusMap.set(matchId, resolved);
      } catch {
        // API unavailable for this match — skip; keep existing DB status
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

    // Trigger settlement for any challenges whose matches just finished
    let settled = 0;
    let cancelled = 0;
    if (finishedMatchIds.size > 0) {
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
