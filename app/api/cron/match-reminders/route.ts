import { NextRequest, NextResponse } from 'next/server';
import { listFollowedTeams } from '@/lib/follows-store';
import { dispatchNotification } from '@/lib/notification-dispatcher';
import { query } from '@/lib/db';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { matchIdToSlug } from '@/lib/utils/match-url';

export const dynamic = 'force-dynamic';

interface ReminderState {
  sentMatchToUser: Set<string>; // key: `${matchId}|${userId}`
  lastRunAt: number;
}
const g = globalThis as { __reminderState?: ReminderState };
g.__reminderState = g.__reminderState || { sentMatchToUser: new Set(), lastRunAt: 0 };
const STATE = g.__reminderState;

// Trim oldest entries when the dedupe set grows large.
function compactState() {
  if (STATE.sentMatchToUser.size > 20000) {
    const keep = Array.from(STATE.sentMatchToUser).slice(-10000);
    STATE.sentMatchToUser = new Set(keep);
  }
}

interface MatchLite {
  id: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  league?: { name?: string };
  kickoffTime: string | Date;
}

async function fetchAllUsers(): Promise<Array<{ userId: number; email?: string | null }>> {
  // When DB is configured, pull every user that has at least one followed
  // team. Otherwise rely on the in-memory follows store keys.
  const { getPool } = await import('@/lib/db');
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
  // Memory fallback
  const store = (globalThis as { __followsStore?: { teams: Map<number, unknown> } }).__followsStore;
  const ids = store?.teams ? Array.from(store.teams.keys()) : [];
  return ids.map(id => ({ userId: id, email: null }));
}

export async function GET(_req: NextRequest) {
  STATE.lastRunAt = Date.now();
  const now = Date.now();
  const windowStart = now + 55 * 60_000;
  const windowEnd = now + 65 * 60_000;

  // Pull a wide sweep of upcoming matches (today + next 24h are what we
  // care about for a 1-hour reminder).
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
    const followedIds = new Set(follows.map(f => f.teamId));
    const followedNames = new Set(follows.map(f => f.teamName.toLowerCase()));

    for (const m of matches) {
      const homeName = (m.homeTeam?.name || '').toLowerCase();
      const awayName = (m.awayTeam?.name || '').toLowerCase();
      const homeMatchesFollowed = followedIds.has(m.homeTeam?.id) || followedNames.has(homeName);
      const awayMatchesFollowed = followedIds.has(m.awayTeam?.id) || followedNames.has(awayName);
      if (!homeMatchesFollowed && !awayMatchesFollowed) continue;

      const key = `${m.id}|${u.userId}`;
      if (STATE.sentMatchToUser.has(key)) continue;
      STATE.sentMatchToUser.add(key);

      const followedName = homeMatchesFollowed ? m.homeTeam.name : m.awayTeam.name;
      const opponent = homeMatchesFollowed ? m.awayTeam.name : m.homeTeam.name;
      const leagueName = m.league?.name;

      try {
        await dispatchNotification({
          userId: u.userId,
          email: u.email,
          type: 'team_match_starting',
          title: `${followedName} kicks off in 1 hour`,
          content: `${followedName} vs ${opponent}${leagueName ? ` — ${leagueName}` : ''}. Don't miss kickoff!`,
          link: `/matches/${matchIdToSlug(m.id)}`,
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
