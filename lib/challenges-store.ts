import { query, getPool } from './db';
import { fileStoreGet, fileStoreSet } from './file-store';
import { getFakeTipsters } from './fake-tipsters';
import { getBalance, debit, credit } from './wallet-store';

export type ScoringMethod = 'win_rate' | 'roi' | 'streak';
export type ChallengeStatus = 'pending' | 'active' | 'finished' | 'cancelled';
export type EscrowStatus = 'none' | 'challenger_locked' | 'both_locked' | 'settled' | 'refunded';

export const PLATFORM_WALLET_ID = 0; // platform fee account

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
  isFake?: boolean;
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
  stakeKes: number;
  platformFeePct: number;
  escrowStatus: EscrowStatus;
  isFakeChallenge: boolean;
  drawRefunded: boolean;
  prizePool: string | null;
  isPublic: boolean;
  maxTips: number;
  watchers: number;
  votesChallenger: number;
  votesOpponent: number;
  challenger: ChallengeParticipant | null;
  opponent: ChallengeParticipant | null;
  createdAt: string;
  matchScope?: string | null;
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
  stakeKes?: number;
  prizePool?: string;
  isPublic?: boolean;
  maxTips?: number;
  isFakeChallenge?: boolean;
  matchScope?: string;
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
  stakeKes: number;
  platformFeePct: number;
  escrowStatus: EscrowStatus;
  isFakeChallenge: boolean;
  drawRefunded: boolean;
  prizePool: string | null;
  isPublic: boolean;
  maxTips: number;
  watchers: number;
  createdAt: string;
  matchScope?: string | null;
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

function fakePart(userId: number, displayName: string, streak = 0, isFake = false): ChallengeParticipant {
  return { userId, username: displayName.toLowerCase().replace(/\s+/g, '_').slice(0, 20), displayName, avatar: null, tips: 0, won: 0, lost: 0, streak, roi: 0, isFake };
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
    stakeKes: Number(row.stake_kes || row.stake_pts || 0),
    platformFeePct: Number(row.platform_fee_pct || 10),
    escrowStatus: (row.escrow_status as EscrowStatus) || 'none',
    isFakeChallenge: Boolean(row.is_fake_challenge),
    drawRefunded: Boolean(row.draw_refunded),
    prizePool: row.prize_pool ? String(row.prize_pool) : null,
    isPublic: Boolean(row.is_public),
    maxTips: Number(row.max_tips || 10),
    watchers: Number(row.watchers || 0),
    votesChallenger: Number(row.votes_challenger || 0),
    votesOpponent: Number(row.votes_opponent || 0),
    challenger,
    opponent,
    createdAt: String(row.created_at || ''),
    matchScope: row.match_scope ? String(row.match_scope) : null,
  };
}

async function buildParticipant(userId: number | null): Promise<ChallengeParticipant | null> {
  if (!userId) return null;
  if (userId >= 1000) {
    const fakes = getFakeTipsters();
    const ft = fakes.find(f => f.id === userId);
    if (ft) {
      return {
        userId: ft.id,
        username: ft.username,
        displayName: ft.displayName,
        avatar: ft.avatar,
        tips: ft.totalTips,
        won: ft.wonTips,
        lost: ft.lostTips,
        streak: ft.streak,
        roi: ft.roi,
        isFake: true,
      };
    }
    return fakePart(userId, `Tipster${userId}`, 2, true);
  }
  if (hasDb()) {
    try {
      const { rows } = await query<{
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
        isFake: false,
      };
    } catch {
      return null;
    }
  }
  return fakePart(userId, `User#${userId}`, 0, false);
}

export function seedFakeChallengesIfEmpty(): void {
  if (cStore.challenges.length > 0) return;
  const fakeTipsters = getFakeTipsters();
  if (fakeTipsters.length < 8) return;

  const now = new Date();
  const statuses: ChallengeStatus[] = ['active', 'active', 'pending', 'finished'];

  const templates = [
    { title: 'EPL Prediction Showdown', description: 'Who can nail the most Premier League results this weekend?', sport: 'football', scoringMethod: 'win_rate' as ScoringMethod, stakeKes: 500 },
    { title: 'Champions League ROI Battle', description: 'Best return on investment across all UCL fixtures wins.', sport: 'football', scoringMethod: 'roi' as ScoringMethod, stakeKes: 1000 },
    { title: 'NBA Hot Streak Challenge', description: 'Longest consecutive winning run across NBA picks this week.', sport: 'basketball', scoringMethod: 'streak' as ScoringMethod, stakeKes: 0 },
    { title: 'Weekend Warrior Cup', description: 'Multi-sport clash — highest win rate across football & basketball.', sport: 'football', scoringMethod: 'win_rate' as ScoringMethod, stakeKes: 2000 },
  ];

  templates.forEach((tpl, i) => {
    const ft1 = fakeTipsters[i * 2];
    const ft2 = fakeTipsters[i * 2 + 1];
    const status = statuses[i];
    const startOffset = status === 'finished' ? -10 : status === 'active' ? -3 : 1;
    const endOffset = status === 'finished' ? -1 : 7;
    const start = new Date(now); start.setDate(start.getDate() + startOffset);
    const end = new Date(now); end.setDate(end.getDate() + endOffset);

    const id = cStore.nextId++;
    const entry: FileChallenge = {
      id,
      title: tpl.title,
      description: tpl.description,
      sport: tpl.sport,
      scoringMethod: tpl.scoringMethod,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status,
      challengerId: ft1.id,
      opponentId: ft2.id,
      winnerId: status === 'finished' ? ft1.id : null,
      stakeKes: tpl.stakeKes,
      platformFeePct: 10,
      escrowStatus: status === 'finished' ? 'settled' : status === 'active' ? 'both_locked' : 'none',
      isFakeChallenge: true,
      drawRefunded: false,
      prizePool: tpl.stakeKes > 0 ? `KES ${(tpl.stakeKes * 2 * 0.9).toLocaleString()}` : null,
      isPublic: true,
      maxTips: [10, 15, 8, 20][i] || 10,
      watchers: 10 + Math.floor(Math.abs((id * 11) % 90)),
      createdAt: start.toISOString(),
    };
    cStore.challenges.push(entry);

    vStore.push({ challengeId: id, userId: 9001 + i, side: 'challenger' });
    vStore.push({ challengeId: id, userId: 9010 + i, side: 'opponent' });
    for (let v = 0; v < 5; v++) {
      vStore.push({ challengeId: id, userId: 8000 + i * 10 + v, side: 'challenger' });
    }
    for (let v = 0; v < 4; v++) {
      vStore.push({ challengeId: id, userId: 7000 + i * 10 + v, side: 'opponent' });
    }
  });

  persistToDisk();
}

function shapeFileChallenge(c: FileChallenge, challenger: ChallengeParticipant | null, opponent: ChallengeParticipant | null): Challenge {
  return {
    ...c,
    votesChallenger: vStore.filter(v => v.challengeId === c.id && v.side === 'challenger').length,
    votesOpponent: vStore.filter(v => v.challengeId === c.id && v.side === 'opponent').length,
    challenger,
    opponent,
  };
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
      const result = await query<Record<string, unknown>>(sql, params);
      const challenges = await Promise.all(
        result.rows.map(async (r) => {
          const [challenger, opponent] = await Promise.all([
            buildParticipant(Number(r.challenger_id)),
            r.opponent_id ? buildParticipant(Number(r.opponent_id)) : Promise.resolve(null),
          ]);
          return shapeFromDb(r, challenger, opponent);
        })
      );
      return challenges;
    } catch { /* fall through */ }
  }
  let list = cStore.challenges;
  if (status && status !== 'all') list = list.filter((c) => c.status === status);
  const fakes = getFakeTipsters();
  const fakeMap = new Map(fakes.map(f => [f.id, f]));

  return list.map((c) => {
    const ft1 = fakeMap.get(c.challengerId);
    const ft2 = c.opponentId ? fakeMap.get(c.opponentId) : null;
    const challenger: ChallengeParticipant | null = ft1
      ? { userId: ft1.id, username: ft1.username, displayName: ft1.displayName, avatar: ft1.avatar, tips: ft1.totalTips, won: ft1.wonTips, lost: ft1.lostTips, streak: ft1.streak, roi: ft1.roi, isFake: true }
      : fakePart(c.challengerId, `Tipster${c.challengerId}`, 2, true);
    const opponent: ChallengeParticipant | null = c.opponentId
      ? ft2
        ? { userId: ft2.id, username: ft2.username, displayName: ft2.displayName, avatar: ft2.avatar, tips: ft2.totalTips, won: ft2.wonTips, lost: ft2.lostTips, streak: ft2.streak, roi: ft2.roi, isFake: true }
        : fakePart(c.opponentId, `Tipster${c.opponentId}`, 1, true)
      : null;
    return shapeFileChallenge(c, challenger, opponent);
  });
}

export async function getChallengeById(id: number): Promise<Challenge | null> {
  if (hasDb()) {
    try {
      const result = await query<Record<string, unknown>>(`SELECT * FROM tipster_challenges WHERE id = ?`, [id]);
      if (!result.rows.length) return null;
      const r = result.rows[0];
      const [challenger, opponent] = await Promise.all([
        buildParticipant(Number(r.challenger_id)),
        r.opponent_id ? buildParticipant(Number(r.opponent_id)) : Promise.resolve(null),
      ]);
      return shapeFromDb(r, challenger, opponent);
    } catch { return null; }
  }
  const c = cStore.challenges.find((x) => x.id === id);
  if (!c) return null;
  const [challenger, opponent] = await Promise.all([
    buildParticipant(c.challengerId),
    c.opponentId ? buildParticipant(c.opponentId) : Promise.resolve(null),
  ]);
  return shapeFileChallenge(c, challenger, opponent);
}

export async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  const stakeKes = input.stakeKes ?? 0;
  const prizePool = stakeKes > 0 ? `KES ${(stakeKes * 2 * 0.9).toLocaleString()}` : (input.prizePool || null);

  if (hasDb()) {
    try {
      await query(`
        ALTER TABLE tipster_challenges
          ADD COLUMN IF NOT EXISTS stake_kes INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS platform_fee_pct INT NOT NULL DEFAULT 10,
          ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(30) NOT NULL DEFAULT 'none',
          ADD COLUMN IF NOT EXISTS is_fake_challenge TINYINT(1) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS draw_refunded TINYINT(1) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS match_scope VARCHAR(255) DEFAULT NULL
      `).catch(() => {});

      const result = await query<{ insertId: number }>(
        `INSERT INTO tipster_challenges
          (title, description, sport, scoring_method, start_date, end_date, status,
           challenger_id, opponent_id, stake_kes, stake_pts, platform_fee_pct,
           escrow_status, is_fake_challenge, prize_pool, is_public, max_tips, watchers, match_scope)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 10, ?, ?, ?, ?, ?, 0, ?)`,
        [
          input.title,
          input.description || null,
          input.sport || 'football',
          input.scoringMethod || 'win_rate',
          input.startDate,
          input.endDate,
          input.challengerId,
          input.opponentId || null,
          stakeKes,
          stakeKes,
          stakeKes > 0 ? 'challenger_locked' : 'none',
          input.isFakeChallenge ? 1 : 0,
          prizePool,
          input.isPublic !== false ? 1 : 0,
          input.maxTips || 10,
          input.matchScope || null,
        ]
      );
      const created = await getChallengeById((result as unknown as { insertId: number }).insertId || 0);
      if (created) return created;
    } catch { /* fall through */ }
  }
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
    stakeKes,
    platformFeePct: 10,
    escrowStatus: stakeKes > 0 ? 'challenger_locked' : 'none',
    isFakeChallenge: input.isFakeChallenge ?? false,
    drawRefunded: false,
    prizePool,
    isPublic: input.isPublic !== false,
    maxTips: input.maxTips || 10,
    watchers: 0,
    createdAt: now,
    matchScope: input.matchScope || null,
  };
  cStore.challenges.unshift(entry);
  persistToDisk();
  const [challenger, opponent] = await Promise.all([
    buildParticipant(entry.challengerId),
    entry.opponentId ? buildParticipant(entry.opponentId) : Promise.resolve(null),
  ]);
  return shapeFileChallenge(entry, challenger, opponent);
}

export async function acceptChallenge(challengeId: number, userId: number): Promise<{ ok: boolean; error?: string }> {
  if (hasDb()) {
    try {
      const ch = await getChallengeById(challengeId);
      if (!ch || ch.status !== 'pending' || ch.challengerId === userId) {
        return { ok: false, error: 'Cannot accept this challenge' };
      }
      if (ch.opponentId && ch.opponentId !== userId) {
        return { ok: false, error: 'This challenge is directed at another tipster' };
      }
      if (ch.stakeKes > 0) {
        const bal = getBalance(userId);
        if (bal < ch.stakeKes) {
          return { ok: false, error: `Insufficient balance. You need KES ${ch.stakeKes.toLocaleString()}, you have KES ${bal.toLocaleString()}.` };
        }
        debit(userId, ch.stakeKes, { type: 'competition_entry', description: `Challenge stake: ${ch.title}`, meta: { challengeId } });
      }
      await query(
        `UPDATE tipster_challenges SET opponent_id = ?, status = 'active', escrow_status = ?, updated_at = NOW()
         WHERE id = ? AND status = 'pending' AND challenger_id != ?`,
        [userId, ch.stakeKes > 0 ? 'both_locked' : 'none', challengeId, userId]
      );
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  const c = cStore.challenges.find((x) => x.id === challengeId);
  if (!c || c.status !== 'pending' || c.challengerId === userId) return { ok: false, error: 'Cannot accept' };
  if (c.opponentId && c.opponentId !== userId) return { ok: false, error: 'Challenge is directed at someone else' };
  if (c.stakeKes > 0) {
    const bal = getBalance(userId);
    if (bal < c.stakeKes) {
      return { ok: false, error: `Insufficient balance. Need KES ${c.stakeKes.toLocaleString()}, have KES ${bal.toLocaleString()}.` };
    }
    debit(userId, c.stakeKes, { type: 'competition_entry', description: `Challenge stake: ${c.title}`, meta: { challengeId } });
  }
  c.opponentId = userId;
  c.status = 'active';
  c.escrowStatus = c.stakeKes > 0 ? 'both_locked' : 'none';
  persistToDisk();
  return { ok: true };
}

export async function cancelChallenge(challengeId: number, userId: number): Promise<boolean> {
  if (hasDb()) {
    try {
      const ch = await getChallengeById(challengeId);
      if (!ch || ch.challengerId !== userId) return false;
      if (!['pending', 'active'].includes(ch.status)) return false;
      if (ch.stakeKes > 0 && ch.escrowStatus === 'challenger_locked') {
        credit(userId, ch.stakeKes, { type: 'refund', description: `Challenge cancelled: ${ch.title}`, meta: { challengeId } });
      }
      if (ch.stakeKes > 0 && ch.escrowStatus === 'both_locked' && ch.opponentId) {
        credit(userId, ch.stakeKes, { type: 'refund', description: `Challenge cancelled: ${ch.title}`, meta: { challengeId } });
        credit(ch.opponentId, ch.stakeKes, { type: 'refund', description: `Challenge cancelled: ${ch.title}`, meta: { challengeId } });
      }
      await query(
        `UPDATE tipster_challenges SET status = 'cancelled', escrow_status = 'refunded', updated_at = NOW()
         WHERE id = ? AND challenger_id = ? AND status IN ('pending','active')`,
        [challengeId, userId]
      );
      return true;
    } catch { return false; }
  }
  const c = cStore.challenges.find((x) => x.id === challengeId && x.challengerId === userId);
  if (!c || !['pending', 'active'].includes(c.status)) return false;
  if (c.stakeKes > 0 && c.escrowStatus === 'challenger_locked') {
    credit(userId, c.stakeKes, { type: 'refund', description: `Challenge cancelled: ${c.title}`, meta: { challengeId } });
  }
  if (c.stakeKes > 0 && c.escrowStatus === 'both_locked' && c.opponentId) {
    credit(userId, c.stakeKes, { type: 'refund', description: `Challenge cancelled: ${c.title}`, meta: { challengeId } });
    credit(c.opponentId, c.stakeKes, { type: 'refund', description: `Challenge cancelled: ${c.title}`, meta: { challengeId } });
  }
  c.status = 'cancelled';
  c.escrowStatus = 'refunded';
  persistToDisk();
  return true;
}

export async function settleChallenge(
  challengeId: number,
  winnerId: number | null,
): Promise<{ ok: boolean; error?: string; isDraw?: boolean }> {
  const ch = await getChallengeById(challengeId);
  if (!ch) return { ok: false, error: 'Challenge not found' };
  if (ch.status === 'finished' || ch.status === 'cancelled') return { ok: false, error: 'Already settled' };

  const isDraw = winnerId === null;
  const potKes = ch.stakeKes * 2;
  const feeKes = isDraw ? 0 : Math.round(potKes * (ch.platformFeePct / 100));
  const winnerGets = potKes - feeKes;

  if (ch.stakeKes > 0 && !ch.isFakeChallenge) {
    if (isDraw) {
      if (ch.challengerId) credit(ch.challengerId, ch.stakeKes, { type: 'refund', description: `Challenge draw refund: ${ch.title}`, meta: { challengeId } });
      if (ch.opponentId) credit(ch.opponentId, ch.stakeKes, { type: 'refund', description: `Challenge draw refund: ${ch.title}`, meta: { challengeId } });
    } else {
      if (winnerId) credit(winnerId, winnerGets, { type: 'prize_payout', description: `Challenge won: ${ch.title}`, meta: { challengeId, feeKes } });
      credit(PLATFORM_WALLET_ID, feeKes, { type: 'adjustment', description: `Platform fee: ${ch.title}`, meta: { challengeId } });
    }
  }

  if (hasDb()) {
    try {
      await query(
        `UPDATE tipster_challenges SET status = 'finished', winner_id = ?, escrow_status = ?, draw_refunded = ?, updated_at = NOW() WHERE id = ?`,
        [isDraw ? null : winnerId, 'settled', isDraw ? 1 : 0, challengeId]
      );
      return { ok: true, isDraw };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  const c = cStore.challenges.find((x) => x.id === challengeId);
  if (!c) return { ok: false, error: 'Not found' };
  c.status = 'finished';
  c.winnerId = isDraw ? null : winnerId;
  c.escrowStatus = 'settled';
  c.drawRefunded = isDraw;
  persistToDisk();
  return { ok: true, isDraw };
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
          side VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (challenge_id, user_id)
        )
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
      for (const r of rows.rows) {
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
          side VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (challenge_id, user_id)
        )
      `);
      const rows = await query<{ side: string; cnt: number }>(
        `SELECT side, COUNT(*) AS cnt FROM challenge_votes WHERE challenge_id = ? GROUP BY side`,
        [challengeId],
      );
      let vc = 0, vo = 0;
      for (const r of rows.rows) {
        if (r.side === 'challenger') vc = Number(r.cnt);
        else if (r.side === 'opponent') vo = Number(r.cnt);
      }
      let myVote: 'challenger' | 'opponent' | null = null;
      if (userId) {
        const mv = await query<{ side: string }>(
          `SELECT side FROM challenge_votes WHERE challenge_id = ? AND user_id = ? LIMIT 1`,
          [challengeId, userId],
        );
        if (mv.rows[0]) myVote = mv.rows[0].side as 'challenger' | 'opponent';
      }
      return { votesChallenger: vc, votesOpponent: vo, myVote };
    } catch { /* fall through */ }
  }
  const vc = vStore.filter(v => v.challengeId === challengeId && v.side === 'challenger').length;
  const vo = vStore.filter(v => v.challengeId === challengeId && v.side === 'opponent').length;
  const myVoteEntry = userId ? vStore.find(v => v.challengeId === challengeId && v.userId === userId) : null;
  return { votesChallenger: vc, votesOpponent: vo, myVote: myVoteEntry?.side ?? null };
}

export function isFakeUserId(userId: number): boolean {
  return userId >= 1000;
}
