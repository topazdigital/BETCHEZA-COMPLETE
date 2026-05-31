import { NextRequest, NextResponse } from 'next/server';
import { listFollowedTeams } from '@/lib/follows-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query, getPool } from '@/lib/db';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { matchToSlug } from '@/lib/utils/match-url';

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
// Main handler
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  STATE.lastRunAt = Date.now();
  const now = Date.now();
  const windowStart = now + 55 * 60_000;
  const windowEnd   = now + 65 * 60_000;

  // Ensure the dedup table exists and note whether DB is available
  const dbAvailable = await ensureTable();

  // Pull upcoming matches in the 55–65 min window
  let matches: MatchLite[] = [];
  try {
    const all = await getAllMatches();
    matches = (all as unknown as MatchLite[]).filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      return !isNaN(t) && t >= windowStart && t <= windowEnd;
    });
  } catch (e) {
    console.warn('[cron/match-reminders] failed to load matches', e);
    return NextResponse.json({ success: false, error: 'matches_load_failed' });
  }

  if (matches.length === 0) {
    return NextResponse.json({ success: true, scanned: 0, sent: 0 });
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
  return NextResponse.json({ success: true, scanned: matches.length, users: users.length, sent });
}
