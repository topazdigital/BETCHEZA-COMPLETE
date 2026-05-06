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
  votesChallenger: number;
  votesOpponent: number;
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

interface FileVote { challengeId: number; userId: number; side: 'challenger' | 'opponent' }
const gv = globalThis as { __challengeVotes?: FileVote[] };
if (!gv.__challengeVotes) gv.__challengeVotes = [];
const vStore = gv.__challengeVotes!;

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

const FAKE_TIPSTER_PAIRS: { challenger: { id: number; name: string; streak: number }; opponent: { id: number; name: string; streak: number } }[] = [
  { challenger: { id: 1001, name: 'Victor Okoye', streak: 7 }, opponent: { id: 1002, name: 'James Kariuki', streak: 4 } },
  { challenger: { id: 1003, name: 'Amara Diallo', streak: 5 }, opponent: { id: 1004, name: 'Kwame Asante', streak: 9 } },
  { challenger: { id: 1005, name: 'Luca Romano', streak: 3 }, opponent: { id: 1006, name: 'Mehmet Yilmaz', streak: 6 } },
  { challenger: { id: 1007, name: 'Ivan Petrov', streak: 11 }, opponent: { id: 1008, name: 'Carlos Mendez', streak: 8 } },
];

const FAKE_CHALLENGE_TEMPLATES: { title: string; description: string; sport: string; scoringMethod: ScoringMethod }[] = [
  { title: 'EPL Prediction Showdown', description: 'Who can nail the most Premier League results this weekend?', sport: 'football', scoringMethod: 'win_rate' },
  { title: 'Champions League ROI Battle', description: 'Best return on investment across all UCL fixtures wins.', sport: 'football', scoringMethod: 'roi' },
  { title: 'NBA Hot Streak Challenge', description: 'Longest consecutive winning run across NBA picks this week.', sport: 'basketball', scoringMethod: 'streak' },
  { title: 'Weekend Warrior Cup', description: 'Multi-sport clash — highest win rate across football & basketball.', sport: 'football', scoringMethod: 'win_rate' },
];

const FAKE_TIPSTER_BY_ID = new Map<number, { name: string; streak: number }>();
FAKE_TIPSTER_PAIRS.forEach(p => {
  FAKE_TIPSTER_BY_ID.set(p.challenger.id, { name: p.challenger.name, streak: p.challenger.streak });
  FAKE_TIPSTER_BY_ID.set(p.opponent.id, { name: p.opponent.name, streak: p.opponent.streak });
});

function buildFakeParticipant(id: number, name: string, streak: number, wonRate = 0.62): ChallengeParticipant {
  const total = 40 + Math.floor(Math.abs((id * 17) % 60));
  const won = Math.round(total * wonRate);
  return {
    userId: id,
    username: name.toLowerCase().replace(/\s/g, '_'),
    displayName: name,
    avatar: null,
    tips: total,
    won,
    lost: total - won,
    streak,
    roi: Math.round((wonRate * 1.9 - 1) * 100) / 10,
  };
}

export function seedFakeChallengesIfEmpty(): void {
  if (cStore.challenges.length > 0) return;
  const now = new Date();

  const statuses: ChallengeStatus[] = ['active', 'active', 'pending', 'finished'];

  FAKE_CHALLENGE_TEMPLATES.forEach((tpl, i) => {
    const pair = FAKE_TIPSTER_PAIRS[i];
    const status = statuses[i];
    const startOffset = status === 'finished' ? -10 : status === 'active' ? -3 : 1;
    const endOffset = status === 'finished' ? -1 : 7;
    const start = new Date(now); start.setDate(start.getDate() + startOffset);
    const end = new Date(now); end.setDate(end.getDate() + endOffset);

    const id = cStore.nextId++;
    const votesC = 30 + Math.floor(Math.abs((id * 13) % 50));
    const votesO = 20 + Math.floor(Math.abs((id * 7) % 40));

    const entry: FileChallenge = {
      id,
      title: tpl.title,
      description: tpl.description,
      sport: tpl.sport,
      scoringMethod: tpl.scoringMethod,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status,
      challengerId: pair.challenger.id,
      opponentId: pair.opponent.id,
      winnerId: status === 'finished' ? pair.challenger.id : null,
      stakePts: [100, 250, 50, 500][i] || 100,
      prizePool: ['KES 2,000', 'KES 5,000', null, 'KES 10,000'][i] || null,
      isPublic: true,
      maxTips: [10, 15, 8, 20][i] || 10,
      watchers: 10 + Math.floor(Math.abs((id * 11) % 90)),
      createdAt: start.toISOString(),
    };
    cStore.challenges.push(entry);

    // Seed some community votes for realism
    vStore.push({ challengeId: id, userId: 9001 + i, side: 'challenger' });
    vStore.push({ challengeId: id, userId: 9010 + i, side: 'opponent' });
    for (let v = 0; v < Math.min(votesC - 1, 5); v++) {
      vStore.push({ challengeId: id, userId: 8000 + i * 10 + v, side: 'challenger' });
    }
    for (let v = 0; v < Math.min(votesO - 1, 4); v++) {
      vStore.push({ challengeId: id, userId: 7000 + i * 10 + v, side: 'opponent' });
    }
  });

  persistToDisk();
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
    votesChallenger: Number(row.votes_challenger || 0),
    votesOpponent: Number(row.votes_opponent || 0),
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
    votesChallenger: vStore.filter(v => v.challengeId === c.id && v.side === 'challenger').length,
    votesOpponent: vStore.filter(v => v.challengeId === c.id && v.side === 'opponent').length,
    challenger: (() => { const p = FAKE_TIPSTER_BY_ID.get(c.challengerId); return p ? buildFakeParticipant(c.challengerId, p.name, p.streak) : fakePart(c.challengerId, `Tipster${c.challengerId}`, 3); })(),
    opponent: c.opponentId ? (() => { const p = FAKE_TIPSTER_BY_ID.get(c.opponentId!); return p ? buildFakeParticipant(c.opponentId!, p.name, p.streak) : fakePart(c.opponentId!, `Tipster${c.opponentId}`, 1); })() : null,
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
    votesChallenger: vStore.filter(v => v.challengeId === c.id && v.side === 'challenger').length,
    votesOpponent: vStore.filter(v => v.challengeId === c.id && v.side === 'opponent').length,
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
    votesChallenger: 0,
    votesOpponent: 0,
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

export async function voteCommunity(
  challengeId: number,
  userId: number,
  side: 'challenger' | 'opponent',
): Promise<{ votesChallenger: number; votesOpponent: number; myVote: 'challenger' | 'opponent' | null }> {
  if (hasDb()) {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS challenge_votes (
          challenge_id INT NOT NULL,
          user_id INT NOT NULL,
          side ENUM('challenger','opponent') NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (challenge_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await query(
        `INSERT INTO challenge_votes (challenge_id, user_id, side) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE side = VALUES(side)`,
        [challengeId, userId, side],
      );
      const rows = await query<{ side: string; cnt: number }>(
        `SELECT side, COUNT(*) AS cnt FROM challenge_votes WHERE challenge_id = ? GROUP BY side`,
        [challengeId],
      );
      let vc = 0, vo = 0;
      for (const r of rows) {
        if (r.side === 'challenger') vc = Number(r.cnt);
        else if (r.side === 'opponent') vo = Number(r.cnt);
      }
      return { votesChallenger: vc, votesOpponent: vo, myVote: side };
    } catch { /* fall through */ }
  }
  const existing = vStore.find(v => v.challengeId === challengeId && v.userId === userId);
  if (existing) { existing.side = side; }
  else { vStore.push({ challengeId, userId, side }); }
  const vc = vStore.filter(v => v.challengeId === challengeId && v.side === 'challenger').length;
  const vo = vStore.filter(v => v.challengeId === challengeId && v.side === 'opponent').length;
  return { votesChallenger: vc, votesOpponent: vo, myVote: side };
}

export async function getCommunityVotes(
  challengeId: number,
  userId?: number,
): Promise<{ votesChallenger: number; votesOpponent: number; myVote: 'challenger' | 'opponent' | null }> {
  if (hasDb()) {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS challenge_votes (
          challenge_id INT NOT NULL,
          user_id INT NOT NULL,
          side ENUM('challenger','opponent') NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (challenge_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const rows = await query<{ side: string; cnt: number }>(
        `SELECT side, COUNT(*) AS cnt FROM challenge_votes WHERE challenge_id = ? GROUP BY side`,
        [challengeId],
      );
      let vc = 0, vo = 0;
      for (const r of rows) {
        if (r.side === 'challenger') vc = Number(r.cnt);
        else if (r.side === 'opponent') vo = Number(r.cnt);
      }
      let myVote: 'challenger' | 'opponent' | null = null;
      if (userId) {
        const mv = await query<{ side: string }>(
          `SELECT side FROM challenge_votes WHERE challenge_id = ? AND user_id = ? LIMIT 1`,
          [challengeId, userId],
        );
        if (mv[0]) myVote = mv[0].side as 'challenger' | 'opponent';
      }
      return { votesChallenger: vc, votesOpponent: vo, myVote };
    } catch { /* fall through */ }
  }
  const vc = vStore.filter(v => v.challengeId === challengeId && v.side === 'challenger').length;
  const vo = vStore.filter(v => v.challengeId === challengeId && v.side === 'opponent').length;
  const myVoteEntry = userId ? vStore.find(v => v.challengeId === challengeId && v.userId === userId) : null;
  return { votesChallenger: vc, votesOpponent: vo, myVote: myVoteEntry?.side ?? null };
}
