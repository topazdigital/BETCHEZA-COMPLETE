import { NextRequest, NextResponse } from 'next/server';
import { listFollowedTeams } from '@/lib/follows-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query, getPool } from '@/lib/db';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { matchToSlug } from '@/lib/utils/match-url';
import { sendPushToTopic } from '@/lib/push-sender';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// In-memory fallback dedup set (used when DB is unavailable).
// ---------------------------------------------------------------------------
interface ReminderState {
  sentMatchToUser: Set<string>; // key: `${matchId}|${userId}|${dateStr}`
  lastRunAt: number;
}
const g = globalThis as { __reminderState?: ReminderState };
g.__reminderState = g.__reminderState || { sentMatchToUser: new Set(), lastRunAt: 0 };
const STATE = g.__reminderState;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Trim oldest entries when the dedupe set grows large.
function compactState() {
  if (STATE.sentMatchToUser.size > 20_000) {
    const keep = Array.from(STATE.sentMatchToUser).slice(-10_000);
    STATE.sentMatchToUser = new Set(keep);
  }
}

// ---------------------------------------------------------------------------
// DB-backed dedup: match_reminders_sent(match_id, user_id, reminder_date)
// ---------------------------------------------------------------------------
async function ensureTable(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS match_reminders_sent (
        match_id     VARCHAR(200) NOT NULL,
        user_id      INT          NOT NULL,
        reminder_date DATE        NOT NULL,
        PRIMARY KEY (match_id, user_id, reminder_date)
      )`,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true if the reminder was already sent (in DB or memory).
 * If not already sent, marks it as sent in both stores.
 */
async function checkAndMarkSent(matchId: string, userId: number, useDb: boolean): Promise<boolean> {
  const date = todayStr();
  const memKey = `${matchId}|${userId}|${date}`;

  // Memory check first — fast path
  if (STATE.sentMatchToUser.has(memKey)) return true;

  if (useDb) {
    try {
      // INSERT IGNORE returns affectedRows=0 if the row already exists
      const res = await query<never>(
        `INSERT IGNORE INTO match_reminders_sent (match_id, user_id, reminder_date) VALUES (?, ?, ?)`,
        [matchId, userId, date],
      );
      const affected = (res as unknown as { affectedRows?: number }).affectedRows ?? 1;
      if (affected === 0) {
        // Row already existed — duplicate
        STATE.sentMatchToUser.add(memKey);
        return true;
      }
    } catch {
      // DB insert failed — fall through and rely on memory only
    }
  }

  // Not a duplicate — mark in memory
  STATE.sentMatchToUser.add(memKey);
  return false;
}

// ---------------------------------------------------------------------------
// User fetch
// ---------------------------------------------------------------------------
interface MatchLite {
  id: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  league?: { name?: string };
  kickoffTime: string | Date;
}

async function fetchAllUsers(): Promise<Array<{ userId: number; email?: string | null }>> {
  if (getPool()) {
    try {
      const r = await query<{ user_id: number; email: string | null }>(
        `SELECT DISTINCT u.id AS user_id, u.email
         FROM team_follows tf
         INNER JOIN users u ON u.id = tf.user_id`,
      );
      return r.rows.map(x => ({ userId: x.user_id, email: x.email }));
    } catch (e) {
      console.warn('[cron/match-reminders] db user fetch failed', e);
    }
  }
  const store = (globalThis as { __followsStore?: { teams: Map<number, unknown> } }).__followsStore;
  const ids = store?.teams ? Array.from(store.teams.keys()) : [];
  return ids.map(id => ({ userId: id, email: null }));
}

// ---------------------------------------------------------------------------
// In-memory dedup for 15-min push reminders (keyed by matchId+date).
// Using a separate set from sentMatchToUser so 1-hour and 15-min reminders
// don't interfere with each other.
// ---------------------------------------------------------------------------
const g15 = globalThis as { __push15Sent?: Set<string> };
g15.__push15Sent = g15.__push15Sent || new Set<string>();
const PUSH15_SENT = g15.__push15Sent;

function push15Key(matchId: string): string {
  return `${matchId}|${todayStr()}`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  STATE.lastRunAt = Date.now();
  const now = Date.now();

  // Window 1: 55–65 min before kickoff → 1-hour team-follow notification
  const windowStart = now + 55 * 60_000;
  const windowEnd   = now + 65 * 60_000;

  // Window 2: 10–20 min before kickoff → 15-min bell-subscriber push
  const push15Start = now + 10 * 60_000;
  const push15End   = now + 20 * 60_000;

  // Ensure the dedup table exists and note whether DB is available
  const dbAvailable = await ensureTable();

  // Pull all upcoming matches once, then filter per window
  let allMatches: MatchLite[] = [];
  try {
    const all = await getAllMatches();
    allMatches = all as unknown as MatchLite[];
  } catch (e) {
    console.warn('[cron/match-reminders] failed to load matches', e);
    return NextResponse.json({ success: false, error: 'matches_load_failed' });
  }

  const matches = allMatches.filter(m => {
    const t = new Date(m.kickoffTime).getTime();
    return !isNaN(t) && t >= windowStart && t <= windowEnd;
  });

  const matches15 = allMatches.filter(m => {
    const t = new Date(m.kickoffTime).getTime();
    return !isNaN(t) && t >= push15Start && t <= push15End;
  });

  // ── 15-min kickoff push: send to match_<id> bell subscribers ────────────
  let push15Sent = 0;
  for (const m of matches15) {
    const key = push15Key(m.id);
    if (PUSH15_SENT.has(key)) continue;
    PUSH15_SENT.add(key);

    const slug = matchToSlug(m.id, m.homeTeam.name, m.awayTeam.name);
    const leagueName = m.league?.name;

    try {
      const count = await sendPushToTopic(`match_${m.id}`, {
        title: `⚽ Kick-off in 15 minutes`,
        body: `${m.homeTeam.name} vs ${m.awayTeam.name}${leagueName ? ` — ${leagueName}` : ''}. Head to the match page!`,
        url: `/matches/${slug}`,
        tag: `match-kick-${m.id}`,
      });
      push15Sent += count;
    } catch (e) {
      console.warn('[cron/match-reminders] push15 failed for', m.id, e);
    }
  }

  // Trim the 15-min dedup set so it doesn't grow unbounded
  if (PUSH15_SENT.size > 5_000) {
    const keep = Array.from(PUSH15_SENT).slice(-2_500);
    PUSH15_SENT.clear();
    for (const k of keep) PUSH15_SENT.add(k);
  }

  // ── 1-hour team-follow notifications ────────────────────────────────────
  if (matches.length === 0) {
    return NextResponse.json({ success: true, scanned: 0, sent: 0, push15Sent, push15Matches: matches15.length });
  }

  const users = await fetchAllUsers();
  let sent = 0;

  for (const u of users) {
    const follows = await listFollowedTeams(u.userId);
    if (follows.length === 0) continue;
    const followedIds   = new Set(follows.map(f => f.teamId));
    const followedNames = new Set(follows.map(f => f.teamName.toLowerCase()));

    for (const m of matches) {
      const homeName = (m.homeTeam?.name || '').toLowerCase();
      const awayName = (m.awayTeam?.name || '').toLowerCase();
      const homeMatches = followedIds.has(m.homeTeam?.id) || followedNames.has(homeName);
      const awayMatches = followedIds.has(m.awayTeam?.id) || followedNames.has(awayName);
      if (!homeMatches && !awayMatches) continue;

      // DB-backed dedup — survives process restarts and hot reloads
      const alreadySent = await checkAndMarkSent(m.id, u.userId, dbAvailable);
      if (alreadySent) continue;

      const followedName = homeMatches ? m.homeTeam.name : m.awayTeam.name;
      const opponent     = homeMatches ? m.awayTeam.name  : m.homeTeam.name;
      const leagueName   = m.league?.name;

      // Use the full human-readable slug so the link resolves correctly
      const slug = matchToSlug(m.id, m.homeTeam.name, m.awayTeam.name);

      try {
        await dispatchNotification({
          userId:  u.userId,
          email:   u.email,
          type:    'team_match_starting',
          title:   `${followedName} kicks off in 1 hour`,
          content: `${followedName} vs ${opponent}${leagueName ? ` — ${leagueName}` : ''}. Don't miss kickoff!`,
          link:    `/matches/${slug}`,
        });
        sent++;
      } catch (e) {
        console.warn('[cron/match-reminders] dispatch failed', e);
      }
    }
  }

  compactState();
  return NextResponse.json({ success: true, scanned: matches.length, users: users.length, sent, push15Sent, push15Matches: matches15.length });
}
