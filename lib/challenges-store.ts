// Challenges store — DB-first (MySQL `challenges` table).
// Each challenge is tied to ONE real match from the site's matches cache.
// File/memory fallback when DB is unavailable.

import { query, getPool } from './db';
import { getFakeTipsters, isFakeUserId } from './fake-tipsters';
import { getBalance, debit, credit } from './wallet-store';
import { pickOptionsForSport, evaluatePick } from './challenge-picks';

export { isFakeUserId };
export { pickOptionsForSport, evaluatePick };

export const PLATFORM_WALLET_ID = 0;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeStatus = 'pending' | 'active' | 'settled' | 'cancelled';
export type EscrowStatus = 'none' | 'challenger_locked' | 'both_locked' | 'settled' | 'refunded';

export interface MatchSnapshot {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  league: string;
  sport: string;
  kickoff?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string;
}

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
  isFake: boolean;
}

export interface Challenge {
  id: number;
  matchId: string;
  matchHomeTeam: string;
  matchAwayTeam: string;
  matchHomeLogo: string | null;
  matchAwayLogo: string | null;
  matchLeague: string;
  matchSport: string;
  matchKickoff: string | null;
  matchStatus: string;
  challengerId: number;
  challengedId: number | null;
  challengerPick: string;
  challengedPick: string | null;
  stakeKes: number;
  platformFeePct: number;
  status: ChallengeStatus;
  escrowStatus: EscrowStatus;
  isFake: boolean;
  winnerId: number | null;
  drawRefunded: boolean;
  isPublic: boolean;
  watchers: number;
  challenger: ChallengeParticipant | null;
  challenged: ChallengeParticipant | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChallengeInput {
  matchId: string;
  matchSnapshot: MatchSnapshot;
  challengerId: number;
  challengerPick: string;
  challengedId?: number | null;
  stakeKes?: number;
  isPublic?: boolean;
  isFake?: boolean;
}

// ─── DB migration ─────────────────────────────────────────────────────────────

function hasDb(): boolean {
  return !!getPool();
}

async function runMigration(): Promise<void> {
  if (!hasDb()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id VARCHAR(200) NOT NULL DEFAULT '',
        match_home_team VARCHAR(150) NOT NULL DEFAULT '',
        match_away_team VARCHAR(150) NOT NULL DEFAULT '',
        match_home_logo TEXT NULL,
        match_away_logo TEXT NULL,
        match_league VARCHAR(200) NOT NULL DEFAULT '',
        match_sport VARCHAR(60) NOT NULL DEFAULT 'football',
        match_kickoff DATETIME NULL,
        match_status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
        challenger_id INT NOT NULL,
        challenged_id INT NULL,
        challenger_pick VARCHAR(100) NOT NULL DEFAULT '',
        challenged_pick VARCHAR(100) NULL,
        stake_kes INT NOT NULL DEFAULT 0,
        platform_fee_pct INT NOT NULL DEFAULT 10,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        escrow_status VARCHAR(30) NOT NULL DEFAULT 'none',
        is_fake TINYINT(1) NOT NULL DEFAULT 0,
        winner_id INT NULL,
        draw_refunded TINYINT(1) NOT NULL DEFAULT 0,
        is_public TINYINT(1) NOT NULL DEFAULT 1,
        watchers INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_match_id (match_id),
        INDEX idx_challenger (challenger_id),
        INDEX idx_fake (is_fake)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  } catch { /* table exists */ }

  // Add any missing columns (ignore ER_DUP_FIELDNAME = errno 1060)
  const alters = [
    `ALTER TABLE challenges ADD COLUMN match_home_logo TEXT NULL`,
    `ALTER TABLE challenges ADD COLUMN match_away_logo TEXT NULL`,
    `ALTER TABLE challenges ADD COLUMN match_home_team VARCHAR(150) NOT NULL DEFAULT ''`,
    `ALTER TABLE challenges ADD COLUMN match_away_team VARCHAR(150) NOT NULL DEFAULT ''`,
    `ALTER TABLE challenges ADD COLUMN match_league VARCHAR(200) NOT NULL DEFAULT ''`,
    `ALTER TABLE challenges ADD COLUMN match_sport VARCHAR(60) NOT NULL DEFAULT 'football'`,
    `ALTER TABLE challenges ADD COLUMN match_kickoff DATETIME NULL`,
    `ALTER TABLE challenges ADD COLUMN match_status VARCHAR(30) NOT NULL DEFAULT 'scheduled'`,
    `ALTER TABLE challenges ADD COLUMN challenged_pick VARCHAR(100) NULL`,
    `ALTER TABLE challenges ADD COLUMN stake_kes INT NOT NULL DEFAULT 0`,
    `ALTER TABLE challenges ADD COLUMN platform_fee_pct INT NOT NULL DEFAULT 10`,
    `ALTER TABLE challenges ADD COLUMN escrow_status VARCHAR(30) NOT NULL DEFAULT 'none'`,
    `ALTER TABLE challenges ADD COLUMN is_fake TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE challenges ADD COLUMN winner_id INT NULL`,
    `ALTER TABLE challenges ADD COLUMN draw_refunded TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE challenges ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1`,
    `ALTER TABLE challenges ADD COLUMN watchers INT NOT NULL DEFAULT 0`,
    `ALTER TABLE challenges ADD COLUMN challenged_id INT NULL`,
  ];
  for (const sql of alters) {
    try { await query(sql, []); } catch { /* column exists */ }
  }
}

const gMigrated = globalThis as { __challengesMigrated?: boolean };
async function ensureMigrated(): Promise<void> {
  if (gMigrated.__challengesMigrated) return;
  await runMigration();
  gMigrated.__challengesMigrated = true;
}

// ─── File fallback ────────────────────────────────────────────────────────────

interface FileStore { challenges: Challenge[]; nextId: number }
const gf = globalThis as { __challengesFile?: FileStore };

function loadFile(): FileStore {
  if (gf.__challengesFile && gf.__challengesFile.challenges.length > 0) return gf.__challengesFile;
  try {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const p = path.join(process.cwd(), '.local', 'data', 'challenges.json');
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore;
      gf.__challengesFile = { challenges: raw.challenges || [], nextId: raw.nextId || 1 };
      return gf.__challengesFile;
    }
  } catch { /* ignore */ }
  if (!gf.__challengesFile) gf.__challengesFile = { challenges: [], nextId: 1 };
  return gf.__challengesFile;
}

function persistFile(): void {
  try {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const dir = path.join(process.cwd(), '.local', 'data');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'challenges.json'), JSON.stringify(gf.__challengesFile, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

// ─── Pick evaluation ──────────────────────────────────────────────────────────

// evaluatePick and pickOptionsForSport are re-exported from ./challenge-picks (client-safe).

// ─── Participant builder ───────────────────────────────────────────────────────

async function buildParticipant(userId: number | null): Promise<ChallengeParticipant | null> {
  if (userId === null) return null;
  if (isFakeUserId(userId)) {
    const ft = getFakeTipsters().find(f => f.id === userId);
    if (ft) return { userId: ft.id, username: ft.username, displayName: ft.displayName, avatar: ft.avatar, tips: ft.totalTips, won: ft.wonTips, lost: ft.lostTips, streak: ft.streak, roi: ft.roi, isFake: true };
    return { userId, username: `tipster${userId}`, displayName: `Tipster ${userId}`, avatar: null, tips: 0, won: 0, lost: 0, streak: 0, roi: 0, isFake: true };
  }
  if (hasDb()) {
    try {
      const { rows } = await query<{
        id: number; username: string; display_name: string; avatar_url: string | null;
        total_tips: number; won_tips: number; lost_tips: number; streak: number; roi: number;
      }>(
        `SELECT u.id, u.username, u.display_name, u.avatar_url,
          COALESCE(tp.total_tips,0) AS total_tips, COALESCE(tp.won_tips,0) AS won_tips,
          COALESCE(tp.lost_tips,0) AS lost_tips, COALESCE(tp.streak,0) AS streak, COALESCE(tp.roi,0) AS roi
         FROM users u LEFT JOIN tipster_profiles tp ON tp.user_id = u.id WHERE u.id = ?`, [userId]
      );
      if (rows.length) {
        const r = rows[0];
        return { userId: r.id, username: r.username, displayName: r.display_name || r.username, avatar: r.avatar_url, tips: r.total_tips, won: r.won_tips, lost: r.lost_tips, streak: r.streak, roi: Number(r.roi), isFake: false };
      }
    } catch { /* fallback */ }
  }
  return { userId, username: `user${userId}`, displayName: `User #${userId}`, avatar: null, tips: 0, won: 0, lost: 0, streak: 0, roi: 0, isFake: false };
}

function rowToChallenge(row: Record<string, unknown>, challenger: ChallengeParticipant | null, challenged: ChallengeParticipant | null): Challenge {
  return {
    id: Number(row.id),
    matchId: String(row.match_id || ''),
    matchHomeTeam: String(row.match_home_team || ''),
    matchAwayTeam: String(row.match_away_team || ''),
    matchHomeLogo: row.match_home_logo ? String(row.match_home_logo) : null,
    matchAwayLogo: row.match_away_logo ? String(row.match_away_logo) : null,
    matchLeague: String(row.match_league || ''),
    matchSport: String(row.match_sport || 'football'),
    matchKickoff: row.match_kickoff ? String(row.match_kickoff) : null,
    matchStatus: String(row.match_status || 'scheduled'),
    challengerId: Number(row.challenger_id),
    challengedId: row.challenged_id ? Number(row.challenged_id) : null,
    challengerPick: String(row.challenger_pick || ''),
    challengedPick: row.challenged_pick ? String(row.challenged_pick) : null,
    stakeKes: Number(row.stake_kes || row.stake || 0),
    platformFeePct: Number(row.platform_fee_pct || 10),
    status: (row.status as ChallengeStatus) || 'pending',
    escrowStatus: (row.escrow_status as EscrowStatus) || 'none',
    isFake: Boolean(Number(row.is_fake)),
    winnerId: row.winner_id ? Number(row.winner_id) : null,
    drawRefunded: Boolean(Number(row.draw_refunded)),
    isPublic: row.is_public !== undefined ? Boolean(Number(row.is_public)) : true,
    watchers: Number(row.watchers || 0),
    challenger,
    challenged,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
  };
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export async function getChallenges(status?: 'all' | ChallengeStatus): Promise<Challenge[]> {
  await ensureMigrated();
  if (hasDb()) {
    try {
      let sql = `SELECT * FROM challenges`;
      const params: unknown[] = [];
      if (status && status !== 'all') {
        sql += ` WHERE status = ?`;
        params.push(status);
      } else {
        sql += ` WHERE status != 'cancelled'`;
      }
      sql += ` ORDER BY created_at DESC LIMIT 100`;
      const { rows } = await query<Record<string, unknown>>(sql, params);
      return Promise.all(rows.map(async r => {
        const [ch, op] = await Promise.all([
          buildParticipant(Number(r.challenger_id)),
          r.challenged_id ? buildParticipant(Number(r.challenged_id)) : Promise.resolve(null),
        ]);
        return rowToChallenge(r, ch, op);
      }));
    } catch (e) { console.error('[getChallenges]', e); }
  }
  const fs = loadFile();
  const list = status && status !== 'all' ? fs.challenges.filter(c => c.status === status) : fs.challenges.filter(c => c.status !== 'cancelled');
  return Promise.all(list.map(async c => {
    const [ch, op] = await Promise.all([buildParticipant(c.challengerId), buildParticipant(c.challengedId)]);
    return { ...c, challenger: ch, challenged: op };
  }));
}

export async function getChallengeById(id: number): Promise<Challenge | null> {
  await ensureMigrated();
  if (hasDb()) {
    try {
      const { rows } = await query<Record<string, unknown>>(`SELECT * FROM challenges WHERE id = ?`, [id]);
      if (!rows.length) return null;
      const r = rows[0];
      const [ch, op] = await Promise.all([
        buildParticipant(Number(r.challenger_id)),
        r.challenged_id ? buildParticipant(Number(r.challenged_id)) : Promise.resolve(null),
      ]);
      return rowToChallenge(r, ch, op);
    } catch { /* fallback */ }
  }
  const fs = loadFile();
  const c = fs.challenges.find(x => x.id === id);
  if (!c) return null;
  const [ch, op] = await Promise.all([buildParticipant(c.challengerId), buildParticipant(c.challengedId)]);
  return { ...c, challenger: ch, challenged: op };
}

export async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  await ensureMigrated();
  const { matchId, matchSnapshot: ms, challengerId, challengerPick, challengedId = null, stakeKes = 0, isPublic = true, isFake = false } = input;
  const escrow: EscrowStatus = stakeKes > 0 ? 'challenger_locked' : 'none';
  const kickoffVal = ms.kickoff ? new Date(ms.kickoff).toISOString().slice(0, 19).replace('T', ' ') : null;

  if (hasDb()) {
    try {
      const res = await query<Record<string, unknown>>(
        `INSERT INTO challenges
          (match_id, match_home_team, match_away_team, match_home_logo, match_away_logo,
           match_league, match_sport, match_kickoff, match_status,
           challenger_id, challenged_id, challenger_pick,
           stake_kes, platform_fee_pct, status, escrow_status,
           is_fake, is_public, watchers)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,10,'pending',?,?,?,0)`,
        [matchId, ms.homeTeam, ms.awayTeam, ms.homeLogo || null, ms.awayLogo || null,
          ms.league, ms.sport, kickoffVal, ms.status || 'scheduled',
          challengerId, challengedId, challengerPick, stakeKes, escrow, isFake ? 1 : 0, isPublic ? 1 : 0]
      );
      const insertId = (res as unknown as { insertId?: number }).insertId || (res.rows as unknown as { insertId?: number }[])?.[0]?.insertId;
      if (insertId) {
        const created = await getChallengeById(Number(insertId));
        if (created) return created;
      }
    } catch (e) { console.error('[createChallenge DB]', e); }
  }

  // File fallback
  const fs = loadFile();
  const now = new Date().toISOString();
  const id = fs.nextId++;
  const c: Challenge = {
    id, matchId,
    matchHomeTeam: ms.homeTeam, matchAwayTeam: ms.awayTeam,
    matchHomeLogo: ms.homeLogo || null, matchAwayLogo: ms.awayLogo || null,
    matchLeague: ms.league, matchSport: ms.sport,
    matchKickoff: ms.kickoff || null, matchStatus: ms.status || 'scheduled',
    challengerId, challengedId, challengerPick, challengedPick: null,
    stakeKes, platformFeePct: 10, status: 'pending', escrowStatus: escrow,
    isFake, winnerId: null, drawRefunded: false, isPublic, watchers: 0,
    challenger: null, challenged: null, createdAt: now, updatedAt: now,
  };
  fs.challenges.unshift(c);
  persistFile();
  const [ch, op] = await Promise.all([buildParticipant(challengerId), buildParticipant(challengedId)]);
  return { ...c, challenger: ch, challenged: op };
}

export async function acceptChallenge(id: number, userId: number, pick: string): Promise<{ ok: boolean; error?: string }> {
  await ensureMigrated();
  const ch = await getChallengeById(id);
  if (!ch) return { ok: false, error: 'Challenge not found' };
  if (ch.status !== 'pending') return { ok: false, error: 'Challenge is no longer open' };
  if (ch.challengerId === userId) return { ok: false, error: 'You cannot accept your own challenge' };
  if (ch.challengedId && ch.challengedId !== userId) return { ok: false, error: 'This challenge is reserved for another user' };

  // Lock wallet for real users
  if (ch.stakeKes > 0 && !isFakeUserId(userId)) {
    const bal = getBalance(userId);
    if (bal < ch.stakeKes) {
      return { ok: false, error: `Insufficient balance. Need KES ${ch.stakeKes.toLocaleString()}, have KES ${bal.toLocaleString()}`, };
    }
    const res = debit(userId, ch.stakeKes, {
      type: 'competition_entry',
      description: `Challenge stake: ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}`,
      meta: { challengeId: id },
    });
    if (!res.ok) return { ok: false, error: res.error };
  }

  const newEscrow: EscrowStatus = ch.stakeKes > 0 ? 'both_locked' : 'none';
  if (hasDb()) {
    try {
      await query(
        `UPDATE challenges SET challenged_id=?, challenged_pick=?, status='active', escrow_status=?, updated_at=NOW() WHERE id=?`,
        [userId, pick, newEscrow, id]
      );
      return { ok: true };
    } catch (e) { console.error('[acceptChallenge DB]', e); }
  }
  const fs = loadFile();
  const idx = fs.challenges.findIndex(x => x.id === id);
  if (idx >= 0) {
    fs.challenges[idx] = { ...fs.challenges[idx], challengedId: userId, challengedPick: pick, status: 'active', escrowStatus: newEscrow, updatedAt: new Date().toISOString() };
    persistFile();
  }
  return { ok: true };
}

export async function cancelChallenge(id: number, requesterId: number): Promise<boolean> {
  await ensureMigrated();
  const ch = await getChallengeById(id);
  if (!ch) return false;
  if (ch.challengerId !== requesterId) return false;
  if (!['pending', 'active'].includes(ch.status)) return false;

  // Refund challenger stake
  if (ch.stakeKes > 0 && !isFakeUserId(ch.challengerId)) {
    credit(ch.challengerId, ch.stakeKes, { type: 'refund', description: `Cancelled challenge: ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}`, meta: { challengeId: id } });
  }
  // Refund opponent if they had accepted
  if (ch.challengedId && ch.escrowStatus === 'both_locked' && ch.stakeKes > 0 && !isFakeUserId(ch.challengedId)) {
    credit(ch.challengedId, ch.stakeKes, { type: 'refund', description: `Cancelled challenge: ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}`, meta: { challengeId: id } });
  }

  if (hasDb()) {
    try {
      await query(`UPDATE challenges SET status='cancelled', escrow_status='refunded', updated_at=NOW() WHERE id=?`, [id]);
      return true;
    } catch { /* fallback */ }
  }
  const fs = loadFile();
  const idx = fs.challenges.findIndex(x => x.id === id);
  if (idx >= 0) { fs.challenges[idx] = { ...fs.challenges[idx], status: 'cancelled', escrowStatus: 'refunded', updatedAt: new Date().toISOString() }; persistFile(); }
  return true;
}

export async function settleChallenge(id: number, homeScore: number, awayScore: number): Promise<{ ok: boolean; winnerId?: number | null; draw?: boolean; error?: string }> {
  await ensureMigrated();
  const ch = await getChallengeById(id);
  if (!ch) return { ok: false, error: 'Not found' };
  if (ch.status === 'settled') return { ok: false, error: 'Already settled' };
  if (!ch.challengedId || !ch.challengedPick) return { ok: false, error: 'Challenge not yet accepted by opponent' };

  const challengerWon = evaluatePick(ch.challengerPick, homeScore, awayScore);
  const challengedWon = evaluatePick(ch.challengedPick, homeScore, awayScore);

  let winnerId: number | null = null;
  let drawRefunded = false;

  if (challengerWon && !challengedWon) winnerId = ch.challengerId;
  else if (challengedWon && !challengerWon) winnerId = ch.challengedId;
  else drawRefunded = true; // both right, both wrong → draw → full refund

  const pot = ch.stakeKes * 2;
  const fee = Math.round(pot * (ch.platformFeePct / 100));
  const payout = pot - fee;

  // Move real money only for real (non-fake) challenges
  if (!ch.isFake) {
    if (drawRefunded) {
      if (!isFakeUserId(ch.challengerId)) credit(ch.challengerId, ch.stakeKes, { type: 'refund', description: `Draw refund: ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}`, meta: { challengeId: id, finalScore: `${homeScore}-${awayScore}` } });
      if (ch.challengedId && !isFakeUserId(ch.challengedId)) credit(ch.challengedId, ch.stakeKes, { type: 'refund', description: `Draw refund: ${ch.matchHomeTeam} vs ${ch.matchAwayTeam}`, meta: { challengeId: id } });
    } else if (winnerId !== null) {
      if (!isFakeUserId(winnerId)) credit(winnerId, payout, { type: 'prize_payout', description: `Challenge win: ${ch.matchHomeTeam} vs ${ch.matchAwayTeam} (${ch.challengerPick} vs ${ch.challengedPick})`, meta: { challengeId: id, fee, pot, finalScore: `${homeScore}-${awayScore}` } });
      if (fee > 0) credit(PLATFORM_WALLET_ID, fee, { type: 'adjustment', description: `Platform fee: challenge #${id}`, meta: { challengeId: id } });
    }
  }

  if (hasDb()) {
    try {
      await query(
        `UPDATE challenges SET status='settled', winner_id=?, draw_refunded=?, escrow_status='settled', match_status='finished', updated_at=NOW() WHERE id=?`,
        [winnerId, drawRefunded ? 1 : 0, id]
      );
    } catch (e) { console.error('[settleChallenge DB]', e); }
  }
  const fs = loadFile();
  const idx = fs.challenges.findIndex(x => x.id === id);
  if (idx >= 0) {
    fs.challenges[idx] = { ...fs.challenges[idx], status: 'settled', winnerId, drawRefunded, escrowStatus: 'settled', matchStatus: 'finished', updatedAt: new Date().toISOString() };
    persistFile();
  }

  // Push notification to challenge watchers
  try {
    const { sendPushToTopic } = await import('./push-sender');
    const matchLabel = `${ch.matchHomeTeam} vs ${ch.matchAwayTeam}`;
    const resultLabel = drawRefunded ? 'Draw — stakes refunded' : winnerId === ch.challengerId
      ? `${ch.challenger?.displayName || 'Challenger'} wins!`
      : `${ch.challenged?.displayName || 'Opponent'} wins!`;
    await sendPushToTopic(`challenge_${id}`, {
      title: `⚔️ Challenge Settled: ${matchLabel}`,
      body: resultLabel,
      url: '/challenges',
    });
  } catch { /* non-critical */ }

  return { ok: true, winnerId, draw: drawRefunded };
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

export async function incrementWatchers(id: number): Promise<void> {
  await ensureMigrated();
  if (hasDb()) {
    try {
      await query(`UPDATE challenges SET watchers = watchers + 1 WHERE id = ?`, [id]);
      return;
    } catch { /* fallback */ }
  }
  const fs = loadFile();
  const idx = fs.challenges.findIndex(x => x.id === id);
  if (idx >= 0) { fs.challenges[idx] = { ...fs.challenges[idx], watchers: (fs.challenges[idx].watchers || 0) + 1 }; persistFile(); }
}

// ─── Community votes ──────────────────────────────────────────────────────────

async function ensureVotesTable(): Promise<void> {
  if (!hasDb()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS community_votes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challenge_id INT NOT NULL,
        user_id INT NOT NULL,
        side VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_vote (challenge_id, user_id),
        INDEX idx_cv_challenge (challenge_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  } catch { /* exists */ }
}

export async function getCommunityVotes(challengeId: number, userId?: number): Promise<{
  challengerVotes: number; opponentVotes: number; userVote: string | null;
}> {
  await ensureVotesTable();
  if (hasDb()) {
    try {
      const { rows: counts } = await query<{ side: string; cnt: number }>(
        `SELECT side, COUNT(*) as cnt FROM community_votes WHERE challenge_id = ? GROUP BY side`,
        [challengeId]
      );
      let challengerVotes = 0; let opponentVotes = 0;
      for (const r of counts) {
        if (r.side === 'challenger') challengerVotes = Number(r.cnt);
        else if (r.side === 'opponent') opponentVotes = Number(r.cnt);
      }
      let userVote: string | null = null;
      if (userId) {
        const { rows: uv } = await query<{ side: string }>(
          `SELECT side FROM community_votes WHERE challenge_id = ? AND user_id = ?`,
          [challengeId, userId]
        );
        if (uv.length) userVote = uv[0].side;
      }
      return { challengerVotes, opponentVotes, userVote };
    } catch { /* fallback */ }
  }
  return { challengerVotes: 0, opponentVotes: 0, userVote: null };
}

export async function voteCommunity(challengeId: number, userId: number, side: 'challenger' | 'opponent'): Promise<{
  ok: boolean; challengerVotes: number; opponentVotes: number; userVote: string;
}> {
  await ensureVotesTable();
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO community_votes (challenge_id, user_id, side) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE side = VALUES(side)`,
        [challengeId, userId, side]
      );
    } catch { /* ignore */ }
  }
  const result = await getCommunityVotes(challengeId, userId);
  return { ok: true, ...result, userVote: result.userVote || side };
}

// ─── Auto-settle cron ─────────────────────────────────────────────────────────

async function fetchMatchResult(matchId: string): Promise<{ status: string; homeScore: number | null; awayScore: number | null } | null> {
  try {
    const { getMatchById } = await import('./api/unified-sports-api');
    const m = await getMatchById(matchId);
    if (!m) return null;
    return { status: m.status || '', homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null };
  } catch { return null; }
}

export async function settlePendingChallenges(): Promise<{ settled: number; skipped: number; errors: number }> {
  await ensureMigrated();
  const active = await getChallenges('active');
  let settled = 0; let skipped = 0; let errors = 0;

  for (const c of active) {
    if (!c.challengedPick || !c.matchId) { skipped++; continue; }
    try {
      const match = await fetchMatchResult(c.matchId);
      if (!match) { skipped++; continue; }
      const s = (match.status || '').toLowerCase();
      if (!['finished', 'final', 'ft', 'full-time', 'complete', 'completed'].includes(s)) { skipped++; continue; }
      if (match.homeScore === null || match.awayScore === null) { skipped++; continue; }
      const res = await settleChallenge(c.id, match.homeScore, match.awayScore);
      if (res.ok) settled++;
      else errors++;
    } catch { errors++; }
  }
  return { settled, skipped, errors };
}

// ─── Fake challenge seeding from real matches ─────────────────────────────────

export async function seedFakeChallengesFromMatches(matches: MatchSnapshot[]): Promise<number> {
  await ensureMigrated();

  // Only seed if fewer than 4 fake challenges exist
  let existingFake = 0;
  if (hasDb()) {
    try {
      const { rows } = await query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM challenges WHERE is_fake = 1`, []);
      existingFake = Number(rows[0]?.cnt || 0);
    } catch { /* ignore */ }
  } else {
    const fs = loadFile();
    existingFake = fs.challenges.filter(c => c.isFake).length;
  }
  if (existingFake >= 4) return 0;

  const fakes = getFakeTipsters();
  if (fakes.length < 8) return 0;

  const upcoming = matches.filter(m => {
    const s = (m.status || '').toLowerCase();
    return s === 'scheduled' || s === 'upcoming' || s === '' || !m.status;
  }).slice(0, 6);
  if (upcoming.length === 0) return 0;

  const stakes = [500, 1000, 1500, 2000];
  let seeded = 0;

  for (let i = 0; i < Math.min(4, upcoming.length); i++) {
    const m = upcoming[i];
    const ft1 = fakes[(i * 2) % fakes.length];
    const ft2 = fakes[(i * 2 + 1) % fakes.length];
    const opts = pickOptionsForSport(m.sport);
    const p1 = opts[i % opts.length]?.value || 'Home Win';
    const p2 = opts.find(o => o.value !== p1)?.value || 'Away Win';
    const stakeKes = stakes[i % stakes.length];

    try {
      const challenge = await createChallenge({
        matchId: m.id,
        matchSnapshot: m,
        challengerId: ft1.id,
        challengerPick: p1,
        challengedId: ft2.id,
        stakeKes,
        isFake: true,
        isPublic: true,
      });

      // Immediately accept (both sides locked, both picks set for fake challenges)
      if (hasDb()) {
        try {
          await query(
            `UPDATE challenges SET challenged_pick=?, status='active', escrow_status='both_locked', updated_at=NOW() WHERE id=?`,
            [p2, challenge.id]
          );
        } catch { /* ignore */ }
      } else {
        const fs = loadFile();
        const idx = fs.challenges.findIndex(x => x.id === challenge.id);
        if (idx >= 0) { fs.challenges[idx] = { ...fs.challenges[idx], challengedPick: p2, status: 'active', escrowStatus: 'both_locked' }; persistFile(); }
      }
      seeded++;
    } catch (e) { console.error('[seedFake]', e); }
  }
  return seeded;
}

// Legacy export kept for any remaining imports
export function seedFakeChallengesIfEmpty(): void { /* no-op — replaced by seedFakeChallengesFromMatches */ }
