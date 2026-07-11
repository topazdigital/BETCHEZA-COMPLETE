/**
 * Challenge Status Sync cron — runs every 5 minutes via cron.ts.
 *
 * For every active/pending challenge:
 *  1. Fetches the current match status from the unified sports API.
 *  2. Updates `match_status` in the `challenges` table if it has changed
 *     (scheduled → live, live → finished, etc.).
 *  3. Settles challenges immediately when scores are available — does NOT
 *     rely solely on settlePendingChallenges() which can't get old scores.
 *
 * This ensures the DB always reflects the true match state, so the
 * Challenges page section grouping (Live Now / Upcoming / Settled) is
 * accurate even between SSE heartbeats or when the API returns a stale
 * "scheduled" status after a match has already kicked off.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getMatchById } from '@/lib/api/unified-sports-api';
import { settleChallenge, settlePendingChallenges } from '@/lib/challenges-store';
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

interface MatchScore {
  homeScore: number;
  awayScore: number;
}

/** Derive ESPN sport name from a league key extracted from a match ID. */
function espnSportForLeague(leagueKey: string): string {
  const l = leagueKey.toLowerCase();
  if (l === 'atp' || l === 'wta' || l.startsWith('itf') || l.includes('tennis')) return 'tennis';
  if (l === 'nba' || l === 'wnba' || l.includes('basketball')) return 'basketball';
  if (l === 'nhl' || l.includes('hockey')) return 'hockey';
  if (l === 'mlb' || l.includes('baseball')) return 'baseball';
  if (l === 'nfl' || l === 'cfl') return 'football';
  if (l.includes('rugby')) return 'rugby-union';
  return 'soccer';
}

/**
 * Last-resort score fetch for old matches no longer in the rolling cache.
 * Parses the ESPN match ID to derive sport + league, then hits the ESPN
 * event summary endpoint directly. Only tried when getMatchById returned
 * null AND the kickoff was >115 min ago.
 */
async function fetchEspnEventDirect(matchId: string): Promise<MatchScore | null> {
  // Format: espn_{leagueKey}_{eventId}  e.g. espn_club.friendly_12345
  const m = matchId.match(/^espn_(.+)_(\d+)$/);
  if (!m) return null;
  const leagueKey = m[1];
  const eventId = m[2];

  // Skip global-sport IDs (espn_globalNNN_EVENT) — those use a different URL structure
  if (/^global\d+/.test(leagueKey)) return null;

  const sport = espnSportForLeague(leagueKey);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${leagueKey}/summary?event=${eventId}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    type Competitor = { homeAway: string; score?: string };
    type Competition = {
      status?: { type?: { completed?: boolean; name?: string } };
      competitors?: Competitor[];
    };
    const data = await res.json() as { header?: { competitions?: Competition[] } };
    const competition = data?.header?.competitions?.[0];
    if (!competition) return null;

    // Only return scores if the match is confirmed completed
    const completed = competition.status?.type?.completed === true;
    const statusName = (competition.status?.type?.name || '').toLowerCase();
    const isFinished = completed ||
      statusName.includes('final') || statusName.includes('end') ||
      statusName.includes('full') || statusName.includes('finish');
    if (!isFinished) return null;

    const competitors = competition.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home');
    const away = competitors.find(c => c.homeAway === 'away');
    if (!home?.score || !away?.score) return null;

    const hs = parseInt(home.score);
    const as_ = parseInt(away.score);
    if (isNaN(hs) || isNaN(as_)) return null;

    return { homeScore: hs, awayScore: as_ };
  } catch {
    return null;
  }
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

    const uniqueMatchIds = [...new Set(rows.map(r => r.match_id))];
    const now = Date.now();

    // Build kickoff map from DB rows for time-based fallback
    const kickoffByMatchId = new Map<string, number>();
    for (const row of rows) {
      if (row.match_id && row.match_kickoff) {
        const rawKo = row.match_kickoff as unknown;
        const ms = rawKo instanceof Date
          ? rawKo.getTime()
          : new Date(String(rawKo)).getTime();
        if (!isNaN(ms)) kickoffByMatchId.set(row.match_id, ms);
      }
    }

    // ── Force-settle any match stuck at 'scheduled' OR 'live' for >2 hours ──
    // Covers: matches whose status was never updated to 'finished' in the DB.
    // IMPORTANT: catches both 'scheduled' (never went live in our DB) and
    // 'live' (went live but never flipped to finished) — previously this only
    // caught 'scheduled', leaving all June/July challenges stuck at 'live'.
    try {
      await execute(
        `UPDATE challenges
         SET match_status = 'finished', updated_at = NOW()
         WHERE status IN ('active','pending')
           AND match_kickoff IS NOT NULL
           AND match_kickoff < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 120 MINUTE)
           AND match_status NOT IN ('finished', 'cancelled')`,
        []
      );
    } catch { /* non-fatal */ }

    // ── Per-match API resolution ──────────────────────────────────────────────
    const statusMap = new Map<string, 'scheduled' | 'live' | 'finished'>();
    // Track confirmed scores alongside status so we can settle immediately
    const scoresMap = new Map<string, MatchScore>();

    await Promise.allSettled(uniqueMatchIds.map(async (matchId) => {
      try {
        const match = await getMatchById(matchId);

        const koMs = match?.kickoffTime
          ? new Date(match.kickoffTime).getTime()
          : (kickoffByMatchId.get(matchId) ?? 0);
        const elapsedMin = koMs > 0 ? (now - koMs) / 60_000 : -1;

        if (!match) {
          // API returned nothing — use kickoff time + ESPN direct fetch as fallback.
          if (elapsedMin >= 115) {
            statusMap.set(matchId, 'finished');
            // Try ESPN event summary directly for historical scores
            const espnScores = await fetchEspnEventDirect(matchId);
            if (espnScores) {
              scoresMap.set(matchId, espnScores);
            }
          } else if (elapsedMin >= 0) {
            statusMap.set(matchId, 'live');
          }
          return;
        }

        let resolved = normaliseStatus(match.status);

        // Kickoff-time override
        if (resolved === 'scheduled' && elapsedMin >= 0) {
          resolved = elapsedMin < 115 ? 'live' : 'finished';
        }

        statusMap.set(matchId, resolved);

        // Store scores when we have them and the match is finished
        if (resolved === 'finished' &&
            typeof match.homeScore === 'number' &&
            typeof match.awayScore === 'number') {
          scoresMap.set(matchId, { homeScore: match.homeScore, awayScore: match.awayScore });
        }
      } catch {
        const koMs = kickoffByMatchId.get(matchId) ?? 0;
        const elapsedMin = koMs > 0 ? (now - koMs) / 60_000 : -1;
        if (elapsedMin >= 115) statusMap.set(matchId, 'finished');
        else if (elapsedMin >= 0) statusMap.set(matchId, 'live');
      }
    }));

    // ── Update DB match_status for any challenges whose status changed ────────
    let updated = 0;
    const wentLiveRows: ChallengeRow[] = [];

    for (const row of rows) {
      const newStatus = statusMap.get(row.match_id);
      if (!newStatus) continue;

      const oldStatus = row.match_status || 'scheduled';
      if (newStatus === oldStatus) continue;

      try {
        await execute(
          `UPDATE challenges SET match_status = ?, updated_at = NOW() WHERE id = ?`,
          [newStatus, row.id]
        );
        updated++;
        console.log(`[challenge-status-sync] id=${row.id} match=${row.match_id}: ${oldStatus} → ${newStatus}`);

        if (newStatus === 'live' && oldStatus === 'scheduled') {
          wentLiveRows.push(row);
        }
      } catch (e) {
        console.warn(`[challenge-status-sync] DB update failed for id=${row.id}:`, e instanceof Error ? e.message : e);
      }
    }

    // Fire "match is live" push notifications
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

    // ── Settle finished challenges that have confirmed scores ─────────────────
    // Key insight: settle here directly (with scores we already have) rather
    // than delegating entirely to settlePendingChallenges() which has to refetch
    // scores and fails on old matches no longer in the API cache.
    let directlySettled = 0;
    const activeRows = rows.filter(r => r.challenged_id !== null);

    await Promise.allSettled(activeRows.map(async (row) => {
      // Determine effective status (API result OR force-settle already set it in DB)
      const apiStatus = statusMap.get(row.match_id);
      const dbStatus = row.match_status;
      const effectiveStatus = apiStatus || dbStatus;
      if (effectiveStatus !== 'finished') return;

      const scores = scoresMap.get(row.match_id);
      if (!scores) return; // no scores available in this run — settlePendingChallenges will retry

      try {
        const res = await settleChallenge(row.id, scores.homeScore, scores.awayScore);
        if (res.ok) {
          directlySettled++;
          console.log(`[challenge-status-sync] directly settled id=${row.id} (${row.match_home_team} vs ${row.match_away_team}) ${scores.homeScore}-${scores.awayScore}`);
        }
      } catch (e) {
        console.warn(`[challenge-status-sync] direct settle failed for id=${row.id}:`, e instanceof Error ? e.message : e);
      }
    }));

    // ── Fallback: settlePendingChallenges for anything not settled above ───────
    // Catches challenges whose match_status was already 'finished' in the DB from
    // a prior run AND challenges where scoresMap had no entry this run.
    let settled = directlySettled;
    let cancelled = 0;
    try {
      const result = await settlePendingChallenges();
      settled += result.settled;
      cancelled = result.cancelled;
      if (result.settled > 0 || result.cancelled > 0) {
        console.log(`[challenge-status-sync] fallback-settled=${result.settled} cancelled=${result.cancelled}`);
      }
    } catch (e) {
      console.warn('[challenge-status-sync] settlePendingChallenges failed:', e instanceof Error ? e.message : e);
    }

    console.log(
      `[challenge-status-sync] checked=${uniqueMatchIds.length} rows=${rows.length} updated=${updated} settled=${settled} cancelled=${cancelled}`
    );

    return NextResponse.json({
      ok: true,
      checked: uniqueMatchIds.length,
      updated,
      settled,
      cancelled,
    });
  } catch (e) {
    console.error('[challenge-status-sync] fatal error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    g.__challengeStatusSyncBusy = false;
  }
}
