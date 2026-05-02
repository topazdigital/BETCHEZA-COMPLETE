import { query } from './db';
import fs from 'fs';
import path from 'path';

export interface FollowedTeam {
  teamId: string;
  teamName: string;
  teamLogo?: string | null;
  leagueId?: number | null;
  leagueSlug?: string | null;
  leagueName?: string | null;
  sportSlug?: string | null;
  countryCode?: string | null;
  followedAt: string;
}

export interface FollowedTipster {
  tipsterId: number;
  followedAt: string;
}

interface Stores {
  teams: Map<number, Map<string, FollowedTeam>>;
  tipsters: Map<number, Map<number, string>>;
  loaded: boolean;
}

const FOLLOWS_FILE = path.join(process.cwd(), '.local', 'state', 'follows.json');

function ensureDir(p: string) {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
}

function persistToDisk() {
  try {
    ensureDir(FOLLOWS_FILE);
    const teams: Record<string, FollowedTeam[]> = {};
    for (const [uid, m] of stores.teams) teams[String(uid)] = Array.from(m.values());
    const tipsters: Record<string, Array<{ tipsterId: number; followedAt: string }>> = {};
    for (const [uid, m] of stores.tipsters)
      tipsters[String(uid)] = Array.from(m.entries()).map(([tipsterId, followedAt]) => ({ tipsterId, followedAt }));
    fs.writeFileSync(FOLLOWS_FILE, JSON.stringify({ teams, tipsters }, null, 2));
  } catch (e) {
    console.warn('[follows] persist failed', e);
  }
}

function loadFromDisk() {
  if (stores.loaded) return;
  stores.loaded = true;
  try {
    if (!fs.existsSync(FOLLOWS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(FOLLOWS_FILE, 'utf8')) as {
      teams?: Record<string, FollowedTeam[]>;
      tipsters?: Record<string, Array<{ tipsterId: number; followedAt: string }>>;
    };
    for (const [uid, arr] of Object.entries(raw.teams || {})) {
      const m = new Map<string, FollowedTeam>();
      for (const t of arr) m.set(t.teamId, t);
      stores.teams.set(Number(uid), m);
    }
    for (const [uid, arr] of Object.entries(raw.tipsters || {})) {
      const m = new Map<number, string>();
      for (const t of arr) m.set(t.tipsterId, t.followedAt);
      stores.tipsters.set(Number(uid), m);
    }
  } catch (e) {
    console.warn('[follows] load failed', e);
  }
}

const g = globalThis as { __followsStore?: Stores };
g.__followsStore = g.__followsStore || { teams: new Map(), tipsters: new Map(), loaded: false };
const stores = g.__followsStore;
loadFromDisk();

function hasDb(): boolean {
  return !!process.env.DATABASE_URL || !!process.env.MYSQL_URL;
}

// ─── TEAMS ───────────────────────────────────────
export async function listFollowedTeams(userId: number): Promise<FollowedTeam[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        team_id: string; team_name: string; team_logo: string | null;
        league_id: number | null; league_slug: string | null; league_name: string | null;
        sport_slug: string | null; country_code: string | null; created_at: string;
      }>(
        `SELECT team_id, team_name, team_logo, league_id, league_slug, league_name,
                sport_slug, country_code, created_at
         FROM team_follows WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );
      return r.rows.map(row => ({
        teamId: row.team_id,
        teamName: row.team_name,
        teamLogo: row.team_logo,
        leagueId: row.league_id,
        leagueSlug: row.league_slug,
        leagueName: row.league_name,
        sportSlug: row.sport_slug,
        countryCode: row.country_code,
        followedAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
      }));
    } catch (e) {
      console.warn('[follows] db read failed, falling back to memory:', e);
    }
  }
  const m = stores.teams.get(userId);
  return m ? Array.from(m.values()).sort((a, b) => b.followedAt.localeCompare(a.followedAt)) : [];
}

export async function followTeam(userId: number, team: Omit<FollowedTeam, 'followedAt'>): Promise<FollowedTeam> {
  const entry: FollowedTeam = { ...team, followedAt: new Date().toISOString() };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO team_follows
         (user_id, team_id, team_name, team_logo, league_id, league_slug, league_name, sport_slug, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON CONFLICT (user_id, team_id) DO UPDATE SET
           team_name = EXCLUDED.team_name,
           team_logo = EXCLUDED.team_logo`,
        [userId, entry.teamId, entry.teamName, entry.teamLogo || null, entry.leagueId || null,
         entry.leagueSlug || null, entry.leagueName || null, entry.sportSlug || null, entry.countryCode || null]
      );
    } catch (e) {
      console.warn('[follows] db write failed:', e);
    }
  }
  if (!stores.teams.has(userId)) stores.teams.set(userId, new Map());
  stores.teams.get(userId)!.set(entry.teamId, entry);
  persistToDisk();
  return entry;
}

export async function unfollowTeam(userId: number, teamId: string): Promise<void> {
  if (hasDb()) {
    try {
      await query(`DELETE FROM team_follows WHERE user_id = ? AND team_id = ?`, [userId, teamId]);
    } catch (e) {
      console.warn('[follows] db delete failed:', e);
    }
  }
  stores.teams.get(userId)?.delete(teamId);
  persistToDisk();
}

export async function isFollowingTeam(userId: number, teamId: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const r = await query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM team_follows WHERE user_id = ? AND team_id = ?`,
        [userId, teamId]
      );
      return Number(r.rows[0]?.c) > 0;
    } catch {}
  }
  return stores.teams.get(userId)?.has(teamId) ?? false;
}

// ─── TIPSTERS ─────────────────────────────────────
export async function followTipster(userId: number, tipsterId: number): Promise<void> {
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO follows (follower_id, following_id) VALUES (?, ?) ON CONFLICT (follower_id, following_id) DO NOTHING`,
        [userId, tipsterId]
      );
    } catch (e) {
      console.warn('[follows tipster] db write failed:', e);
    }
  }
  if (!stores.tipsters.has(userId)) stores.tipsters.set(userId, new Map());
  stores.tipsters.get(userId)!.set(tipsterId, new Date().toISOString());
  persistToDisk();
}

export async function unfollowTipster(userId: number, tipsterId: number): Promise<void> {
  if (hasDb()) {
    try {
      await query(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [userId, tipsterId]);
    } catch {}
  }
  stores.tipsters.get(userId)?.delete(tipsterId);
  persistToDisk();
}

export async function isFollowingTipster(userId: number, tipsterId: number): Promise<boolean> {
  if (hasDb()) {
    try {
      const r = await query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM follows WHERE follower_id = ? AND following_id = ?`,
        [userId, tipsterId]
      );
      return Number(r.rows[0]?.c) > 0;
    } catch {}
  }
  return stores.tipsters.get(userId)?.has(tipsterId) ?? false;
}

export function getFollowedTipsterEntries(userId: number): Array<{ tipsterId: number; followedAt: string }> {
  const m = stores.tipsters.get(userId);
  if (!m) return [];
  return Array.from(m.entries()).map(([tipsterId, followedAt]) => ({ tipsterId, followedAt }));
}

export async function listFollowedTipsters(userId: number): Promise<number[]> {
  if (hasDb()) {
    try {
      const r = await query<{ following_id: number }>(
        `SELECT following_id FROM follows WHERE follower_id = ?`,
        [userId]
      );
      return r.rows.map(x => x.following_id);
    } catch {}
  }
  return Array.from((stores.tipsters.get(userId) || new Map()).keys());
}

export async function listFollowersOfTipster(tipsterId: number): Promise<number[]> {
  if (hasDb()) {
    try {
      const r = await query<{ follower_id: number }>(
        `SELECT follower_id FROM follows WHERE following_id = ?`,
        [tipsterId]
      );
      return r.rows.map(x => x.follower_id);
    } catch {}
  }
  const out: number[] = [];
  for (const [uid, m] of stores.tipsters) {
    if (m.has(tipsterId)) out.push(uid);
  }
  return out;
}

export async function listFollowersOfTeam(teamId: string): Promise<number[]> {
  if (hasDb()) {
    try {
      const r = await query<{ user_id: number }>(
        `SELECT user_id FROM team_follows WHERE team_id = ?`,
        [teamId]
      );
      return r.rows.map(x => x.user_id);
    } catch {}
  }
  const out: number[] = [];
  for (const [uid, m] of stores.teams) {
    if (m.has(teamId)) out.push(uid);
  }
  return out;
}
