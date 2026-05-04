import { query, getPool } from './db';
import { fileStoreGet, fileStoreSet } from './file-store';

export interface FollowedTeam {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  leagueId?: number;
  leagueSlug?: string;
  leagueName?: string;
  sportSlug?: string;
  countryCode?: string;
  followedAt: string;
}

interface FollowsStores {
  teams: Map<number, Map<string, FollowedTeam>>;
  tipsters: Map<number, Map<number, string>>;
}

const g = globalThis as { __followsStores?: FollowsStores };
if (!g.__followsStores) {
  const saved = fileStoreGet<{
    teams: Record<number, Record<string, FollowedTeam>>;
    tipsters: Record<number, Record<number, string>>;
  }>('follows', { teams: {}, tipsters: {} });
  g.__followsStores = {
    teams: new Map(
      Object.entries(saved.teams || {}).map(([k, v]) => [
        Number(k),
        new Map(Object.entries(v || {})),
      ])
    ),
    tipsters: new Map(
      Object.entries(saved.tipsters || {}).map(([k, v]) => [
        Number(k),
        new Map(Object.entries(v || {}).map(([tk, ts]) => [Number(tk), ts as string])),
      ])
    ),
  };
}
const stores = g.__followsStores;

function hasDb(): boolean {
  return !!getPool();
}

function persistToDisk() {
  try {
    const out = {
      teams: Object.fromEntries(
        Array.from(stores.teams.entries()).map(([uid, m]) => [uid, Object.fromEntries(m)])
      ),
      tipsters: Object.fromEntries(
        Array.from(stores.tipsters.entries()).map(([uid, m]) => [uid, Object.fromEntries(m)])
      ),
    };
    fileStoreSet('follows', out);
  } catch {}
}

// ─── TEAMS ────────────────────────────────────────
export async function getFollowedTeams(userId: number): Promise<FollowedTeam[]> {
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
      if (r.rows.length > 0) {
        return r.rows.map(row => ({
          teamId: row.team_id,
          teamName: row.team_name,
          teamLogo: row.team_logo ?? undefined,
          leagueId: row.league_id ?? undefined,
          leagueSlug: row.league_slug ?? undefined,
          leagueName: row.league_name ?? undefined,
          sportSlug: row.sport_slug ?? undefined,
          countryCode: row.country_code ?? undefined,
          followedAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
        }));
      }
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
         ON DUPLICATE KEY UPDATE
           team_name = VALUES(team_name),
           team_logo = VALUES(team_logo)`,
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
        `INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`,
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
    } catch (e) {
      console.warn('[follows tipster] db write failed:', e);
    }
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

export async function getFollowedTipsters(userId: number): Promise<number[]> {
  if (hasDb()) {
    try {
      const r = await query<{ following_id: number }>(
        `SELECT following_id FROM follows WHERE follower_id = ?`,
        [userId]
      );
      if (r.rows.length > 0) return r.rows.map(x => x.following_id);
    } catch {}
  }
  const m = stores.tipsters.get(userId);
  return m ? Array.from(m.keys()) : [];
}

export async function listFollowersOfTipster(tipsterId: number): Promise<number[]> {
  if (hasDb()) {
    try {
      const r = await query<{ follower_id: number }>(
        `SELECT follower_id FROM follows WHERE following_id = ?`,
        [tipsterId]
      );
      if (r.rows.length > 0) return r.rows.map(x => x.follower_id);
    } catch {}
  }
  const followers: number[] = [];
  for (const [uid, m] of stores.tipsters.entries()) {
    if (m.has(tipsterId)) followers.push(uid);
  }
  return followers;
}

export async function listFollowersOfTeam(teamId: string): Promise<number[]> {
  if (hasDb()) {
    try {
      const r = await query<{ user_id: number }>(
        `SELECT user_id FROM team_follows WHERE team_id = ?`,
        [teamId]
      );
      if (r.rows.length > 0) return r.rows.map(x => x.user_id);
    } catch {}
  }
  const followers: number[] = [];
  for (const [uid, m] of stores.teams.entries()) {
    if (m.has(teamId)) followers.push(uid);
  }
  return followers;
}

/** Alias for getFollowedTeams — used by the match-reminder cron job */
export const listFollowedTeams = getFollowedTeams;

/** Alias for getFollowedTipsters — used by dashboard route */
export const listFollowedTipsters = getFollowedTipsters;

// ─── PLAYERS ──────────────────────────────────────────────────────────────────
export interface FollowedPlayer {
  playerId: string;
  playerName: string;
  playerHeadshot?: string;
  teamId?: string;
  teamName?: string;
  teamLogo?: string;
  sportSlug?: string;
  followedAt: string;
}

interface PlayerFollowsStore { players: Map<number, Map<string, FollowedPlayer>> }
const gp = globalThis as { __playerFollowsStore?: PlayerFollowsStore };
if (!gp.__playerFollowsStore) {
  const saved = fileStoreGet<{ players: Record<number, Record<string, FollowedPlayer>> }>(
    'player-follows', { players: {} }
  );
  gp.__playerFollowsStore = {
    players: new Map(
      Object.entries(saved.players || {}).map(([k, v]) => [
        Number(k), new Map(Object.entries(v || {}))
      ])
    ),
  };
}
const pStores = gp.__playerFollowsStore;

function persistPlayersToDisk() {
  try {
    const out = {
      players: Object.fromEntries(
        Array.from(pStores.players.entries()).map(([uid, m]) => [uid, Object.fromEntries(m)])
      ),
    };
    fileStoreSet('player-follows', out);
  } catch {}
}

export async function getFollowedPlayers(userId: number): Promise<FollowedPlayer[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        player_id: string; player_name: string; player_headshot: string | null;
        team_id: string | null; team_name: string | null; team_logo: string | null;
        sport_slug: string | null; created_at: string;
      }>(
        `SELECT player_id, player_name, player_headshot, team_id, team_name, team_logo,
                sport_slug, created_at
         FROM player_follows WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );
      if (r.rows.length > 0) {
        return r.rows.map(row => ({
          playerId: row.player_id,
          playerName: row.player_name,
          playerHeadshot: row.player_headshot ?? undefined,
          teamId: row.team_id ?? undefined,
          teamName: row.team_name ?? undefined,
          teamLogo: row.team_logo ?? undefined,
          sportSlug: row.sport_slug ?? undefined,
          followedAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
        }));
      }
    } catch {}
  }
  const m = pStores.players.get(userId);
  return m ? Array.from(m.values()).sort((a, b) => b.followedAt.localeCompare(a.followedAt)) : [];
}

export async function followPlayer(userId: number, player: Omit<FollowedPlayer, 'followedAt'>): Promise<FollowedPlayer> {
  const entry: FollowedPlayer = { ...player, followedAt: new Date().toISOString() };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO player_follows
         (user_id, player_id, player_name, player_headshot, team_id, team_name, team_logo, sport_slug, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           player_name = VALUES(player_name),
           player_headshot = VALUES(player_headshot),
           team_id = VALUES(team_id),
           team_name = VALUES(team_name),
           team_logo = VALUES(team_logo)`,
        [userId, entry.playerId, entry.playerName, entry.playerHeadshot || null,
         entry.teamId || null, entry.teamName || null, entry.teamLogo || null, entry.sportSlug || null]
      );
    } catch {}
  }
  if (!pStores.players.has(userId)) pStores.players.set(userId, new Map());
  pStores.players.get(userId)!.set(entry.playerId, entry);
  persistPlayersToDisk();
  return entry;
}

export async function unfollowPlayer(userId: number, playerId: string): Promise<void> {
  if (hasDb()) {
    try {
      await query(`DELETE FROM player_follows WHERE user_id = ? AND player_id = ?`, [userId, playerId]);
    } catch {}
  }
  pStores.players.get(userId)?.delete(playerId);
  persistPlayersToDisk();
}

export async function isFollowingPlayer(userId: number, playerId: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const r = await query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM player_follows WHERE user_id = ? AND player_id = ?`,
        [userId, playerId]
      );
      return Number(r.rows[0]?.c) > 0;
    } catch {}
  }
  return pStores.players.get(userId)?.has(playerId) ?? false;
}

export async function getFollowerCount(tipsterId: number): Promise<number> {
  if (hasDb()) {
    try {
      const r = await query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM follows WHERE following_id = ?`,
        [tipsterId]
      );
      return Number(r.rows[0]?.c ?? 0);
    } catch {}
  }
  let count = 0;
  for (const m of stores.tipsters.values()) {
    if (m.has(tipsterId)) count++;
  }
  return count;
}
