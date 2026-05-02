import { query, getPool } from './db';
import { fileStoreGet, fileStoreSet } from './file-store';

export type ScoringMethod = 'win_rate' | 'roi' | 'streak';
export type ChallengeStatus = 'pending' | 'active' | 'finished' | 'cancelled';

export interface ChallengeParticipant {
  userId: number;
  username: string;
  displayName: string;
  avatar: string | null;
  tips: number;
  won: number;
  lost: number;
  streak: number;
  roi: number;
}

export interface Challenge {
  id: number;
  title: string;
  description: string | null;
  sport: string;
  scoringMethod: ScoringMethod;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  challengerId: number;
  opponentId: number | null;
  winnerId: number | null;
  stakePts: number;
  prizePool: string | null;
  isPublic: boolean;
  maxTips: number;
  watchers: number;
  challenger: ChallengeParticipant | null;
  opponent: ChallengeParticipant | null;
  createdAt: string;
}

export interface CreateChallengeInput {
  title: string;
  description?: string;
  sport?: string;
  scoringMethod?: ScoringMethod;
  startDate: string;
  endDate: string;
  challengerId: number;
  opponentId?: number | null;
  stakePts?: number;
  prizePool?: string;
  isPublic?: boolean;
  maxTips?: number;
}

function hasDb(): boolean {
  return !!getPool();
}

interface FileChallenge {
  id: number;
  title: string;
  description: string | null;
  sport: string;
  scoringMethod: ScoringMethod;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  challengerId: number;
  opponentId: number | null;
  winnerId: number | null;
  stakePts: number;
  prizePool: string | null;
  isPublic: boolean;
  maxTips: number;
  watchers: number;
  createdAt: string;
}

const g = globalThis as { __challengeStore?: { challenges: FileChallenge[]; nextId: number } };
if (!g.__challengeStore) {
  const saved = fileStoreGet<{ challenges: FileChallenge[]; nextId: number }>('challenges', {
    challenges: [],
    nextId: 1,
  });
  g.__challengeStore = saved;
}
const cStore = g.__challengeStore!;

function persistToDisk() {
  try { fileStoreSet('challenges', { challenges: cStore.challenges, nextId: cStore.nextId }); } catch {}
}

function fakePart(userId: number, displayName: string, streak = 0): ChallengeParticipant {
  return { userId, username: displayName.toLowerCase().replace(/\s/g, '_'), displayName, avatar: null, tips: 0, won: 0, lost: 0, streak, roi: 0 };
}

function shapeFromDb(row: Record<string, unknown>, challenger: ChallengeParticipant | null, opponent: ChallengeParticipant | null): Challenge {
  return {
    id: Number(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    sport: String(row.sport || 'football'),
    scoringMethod: (row.scoring_method as ScoringMethod) || 'win_rate',
    startDate: row.start_date ? String(row.start_date) : '',
    endDate: row.end_date ? String(row.end_date) : '',
    status: (row.status as ChallengeStatus) || 'pending',
    challengerId: Number(row.challenger_id),
    opponentId: row.opponent_id ? Number(row.opponent_id) : null,
    winnerId: row.winner_id ? Number(row.winner_id) : null,
    stakePts: Number(row.stake_pts || 0),
    prizePool: row.prize_pool ? String(row.prize_pool) : null,
    isPublic: Boolean(row.is_public),
    maxTips: Number(row.max_tips || 10),
    watchers: Number(row.watchers || 0),
    challenger,
    opponent,
    createdAt: String(row.created_at || ''),
  };
}

async function buildParticipant(userId: number | null): Promise<ChallengeParticipant | null> {
  if (!userId) return null;
  if (hasDb()) {
    try {
      const rows = await query<{
        user_id: number; username: string; display_name: string; avatar_url: string | null;
        total_tips: number; won_tips: number; lost_tips: number; streak: number; roi: number;
      }>(
        `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url,
          COALESCE(tp.total_tips,0) AS total_tips,
          COALESCE(tp.won_tips,0) AS won_tips,
          COALESCE(tp.lost_tips,0) AS lost_tips,
          COALESCE(tp.streak,0) AS streak,
          COALESCE(tp.roi,0) AS roi
         FROM users u
         LEFT JOIN tipster_profiles tp ON tp.user_id = u.id
         WHERE u.id = ?`,
        [userId]
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name || r.username,
        avatar: r.avatar_url,
        tips: r.total_tips,
        won: r.won_tips,
        lost: r.lost_tips,
        streak: r.streak,
        roi: Number(r.roi),
      };
    } catch {
      return null;
    }
  }
  return fakePart(userId, `User#${userId}`);
}

export async function getChallenges(status?: ChallengeStatus | 'all'): Promise<Challenge[]> {
  if (hasDb()) {
    try {
      let sql = `SELECT * FROM tipster_challenges`;
      const params: unknown[] = [];
      if (status && status !== 'all') {
        sql += ` WHERE status = ?`;
        params.push(status);
      }
      sql += ` ORDER BY created_at DESC LIMIT 100`;
      const rows = await query<Record<string, unknown>>(sql, params);
      const challenges = await Promise.all(
        rows.map(async (r) => {
          const [challenger, opponent] = await Promise.all([
            buildParticipant(Number(r.challenger_id)),
            r.opponent_id ? buildParticipant(Number(r.opponent_id)) : Promise.resolve(null),
          ]);
          return shapeFromDb(r, challenger, opponent);
        })
      );
      return challenges;
    } catch {
      // fall through
    }
  }
  // file fallback
  let list = cStore.challenges;
  if (status && status !== 'all') list = list.filter((c) => c.status === status);
  return list.map((c) => ({
    ...c,
    challenger: fakePart(c.challengerId, `Tipster${c.challengerId}`, 3),
    opponent: c.opponentId ? fakePart(c.opponentId, `Tipster${c.opponentId}`, 1) : null,
  }));
}

export async function getChallengeById(id: number): Promise<Challenge | null> {
  if (hasDb()) {
    try {
      const rows = await query<Record<string, unknown>>(`SELECT * FROM tipster_challenges WHERE id = ?`, [id]);
      if (!rows.length) return null;
      const r = rows[0];
      const [challenger, opponent] = await Promise.all([
        buildParticipant(Number(r.challenger_id)),
        r.opponent_id ? buildParticipant(Number(r.opponent_id)) : Promise.resolve(null),
      ]);
      return shapeFromDb(r, challenger, opponent);
    } catch { return null; }
  }
  const c = cStore.challenges.find((x) => x.id === id);
  if (!c) return null;
  return {
    ...c,
    challenger: fakePart(c.challengerId, `Tipster${c.challengerId}`, 3),
    opponent: c.opponentId ? fakePart(c.opponentId, `Tipster${c.opponentId}`, 1) : null,
  };
}

export async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  if (hasDb()) {
    try {
      const result = await query<{ insertId: number }>(
        `INSERT INTO tipster_challenges
          (title, description, sport, scoring_method, start_date, end_date, status,
           challenger_id, opponent_id, stake_pts, prize_pool, is_public, max_tips, watchers)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, 0)`,
        [
          input.title,
          input.description || null,
          input.sport || 'football',
          input.scoringMethod || 'win_rate',
          input.startDate,
          input.endDate,
          input.challengerId,
          input.opponentId || null,
          input.stakePts || 0,
          input.prizePool || null,
          input.isPublic !== false ? 1 : 0,
          input.maxTips || 10,
        ]
      );
      const created = await getChallengeById(result[0]?.insertId || 0);
      if (created) return created;
    } catch { /* fall through */ }
  }
  // file fallback
  const id = cStore.nextId++;
  const now = new Date().toISOString();
  const entry: FileChallenge = {
    id,
    title: input.title,
    description: input.description || null,
    sport: input.sport || 'football',
    scoringMethod: input.scoringMethod || 'win_rate',
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'pending',
    challengerId: input.challengerId,
    opponentId: input.opponentId || null,
    winnerId: null,
    stakePts: input.stakePts || 0,
    prizePool: input.prizePool || null,
    isPublic: input.isPublic !== false,
    maxTips: input.maxTips || 10,
    watchers: 0,
    createdAt: now,
  };
  cStore.challenges.unshift(entry);
  persistToDisk();
  return {
    ...entry,
    challenger: fakePart(input.challengerId, `Tipster${input.challengerId}`),
    opponent: input.opponentId ? fakePart(input.opponentId, `Tipster${input.opponentId}`) : null,
  };
}

export async function acceptChallenge(challengeId: number, userId: number): Promise<boolean> {
  if (hasDb()) {
    try {
      await query(
        `UPDATE tipster_challenges SET opponent_id = ?, status = 'active', updated_at = NOW()
         WHERE id = ? AND opponent_id IS NULL AND status = 'pending' AND challenger_id != ?`,
        [userId, challengeId, userId]
      );
      return true;
    } catch { return false; }
  }
  const c = cStore.challenges.find((x) => x.id === challengeId);
  if (!c || c.opponentId || c.status !== 'pending' || c.challengerId === userId) return false;
  c.opponentId = userId;
  c.status = 'active';
  persistToDisk();
  return true;
}

export async function cancelChallenge(challengeId: number, userId: number): Promise<boolean> {
  if (hasDb()) {
    try {
      await query(
        `UPDATE tipster_challenges SET status = 'cancelled', updated_at = NOW()
         WHERE id = ? AND challenger_id = ? AND status IN ('pending','active')`,
        [challengeId, userId]
      );
      return true;
    } catch { return false; }
  }
  const c = cStore.challenges.find((x) => x.id === challengeId && x.challengerId === userId);
  if (!c) return false;
  c.status = 'cancelled';
  persistToDisk();
  return true;
}

export async function incrementWatchers(challengeId: number): Promise<void> {
  if (hasDb()) {
    try {
      await query(`UPDATE tipster_challenges SET watchers = watchers + 1 WHERE id = ?`, [challengeId]);
      return;
    } catch {}
  }
  const c = cStore.challenges.find((x) => x.id === challengeId);
  if (c) { c.watchers++; persistToDisk(); }
}
