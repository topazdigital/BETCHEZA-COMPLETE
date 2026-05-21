/**
 * Referral system — tracks who referred whom, issues referral codes,
 * and applies bonuses with smart anti-abuse rules:
 *
 *   Referrer (KES 100): paid ONLY when referred user makes a qualifying
 *     deposit (≥ MIN_QUALIFYING_DEPOSIT) AND places at least 1 tip/bet.
 *
 *   Referee  (KES 50):  credited ONLY on their first qualifying deposit
 *     (≥ MIN_QUALIFYING_DEPOSIT) as a welcome bonus — not just for signing up.
 *
 * Both balances are in-platform credits, NOT withdrawable.
 * MySQL-first, file-based fallback for no-DB environments.
 */
import fs from 'fs';
import path from 'path';
import { query, execute, getPool } from './db';

export const MIN_QUALIFYING_DEPOSIT = 200; // KES — minimum deposit to trigger bonuses
export const REFERRER_BONUS = 100;          // KES — referrer earns per qualifying referral
export const REFEREE_BONUS = 50;            // KES — referee earns on first qualifying deposit

export interface ReferralRecord {
  id: string;
  referrerId: number;
  referredUserId: number;
  referredEmail: string;
  referredUsername: string;
  createdAt: string;
  verifiedAt?: string;
  firstDepositAt?: string;
  firstDepositAmount?: number;
  firstBetAt?: string;
  referrerBonusPaid: boolean;
  refereeBonusPaid: boolean;
}

export interface ReferralStats {
  code: string;
  referralUrl: string;
  totalReferrals: number;
  verifiedReferrals: number;   // email-verified
  qualifiedReferrals: number;  // deposited + placed bet → referrer bonus triggered
  pendingReferrals: number;
  totalEarned: number; // KES
  referrals: ReferralRecord[];
}

const STATE_DIR = path.join(process.cwd(), '.local', 'state');
const STATE_FILE = path.join(STATE_DIR, 'referrals.json');

interface ReferralState {
  codes: Record<number, string>;   // userId → code
  usersByCode: Record<string, number>; // code → userId
  records: ReferralRecord[];
}

const g = globalThis as { __referralState?: ReferralState };

function load(): ReferralState {
  if (g.__referralState) return g.__referralState;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ReferralState;
      if (parsed && typeof parsed === 'object') {
        g.__referralState = parsed;
        return parsed;
      }
    }
  } catch { /* corrupted — start fresh */ }
  g.__referralState = { codes: {}, usersByCode: {}, records: [] };
  return g.__referralState;
}

function persist(): void {
  try {
    if (!g.__referralState) return;
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(g.__referralState));
  } catch {}
}

function generateCode(userId: number, username: string): string {
  const base = username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  const suffix = (userId * 7919 + 1337).toString(36).slice(-4).toUpperCase();
  return `${base}${suffix}`;
}

let tableReady = false;
async function ensureTables(): Promise<void> {
  if (tableReady || !getPool()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        user_id INT NOT NULL PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        referrer_id INT NOT NULL,
        referred_user_id INT NOT NULL UNIQUE,
        referred_email VARCHAR(255) NOT NULL,
        referred_username VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP NULL,
        first_deposit_at TIMESTAMP NULL,
        first_deposit_amount DECIMAL(10,2) NULL,
        first_bet_at TIMESTAMP NULL,
        referrer_bonus_paid BOOLEAN NOT NULL DEFAULT FALSE,
        referee_bonus_paid BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    // Add new columns to existing installs gracefully
    const cols = ['first_deposit_at TIMESTAMP NULL', 'first_deposit_amount DECIMAL(10,2) NULL', 'first_bet_at TIMESTAMP NULL'];
    for (const col of cols) {
      try {
        await execute(`ALTER TABLE referrals ADD COLUMN ${col}`);
      } catch { /* column already exists */ }
    }
    tableReady = true;
  } catch { /* ignore — no DB */ }
}

/** Check whether all bonus conditions are met and issue if so */
async function maybeIssueReferrerBonus(referredUserId: number): Promise<void> {
  // Referrer bonus: referred user must have a qualifying deposit AND have placed a bet
  if (getPool()) {
    try {
      const r = await query<{
        id: string; referrer_id: number; first_deposit_amount: number | null;
        first_deposit_at: string | null; first_bet_at: string | null;
        referrer_bonus_paid: number; referee_bonus_paid: number;
      }>(
        `SELECT id, referrer_id, first_deposit_amount, first_deposit_at, first_bet_at,
                referrer_bonus_paid, referee_bonus_paid
         FROM referrals WHERE referred_user_id = ? LIMIT 1`,
        [referredUserId]
      );
      const row = r.rows[0];
      if (!row) return;

      const qualifyingDeposit = row.first_deposit_amount != null && row.first_deposit_amount >= MIN_QUALIFYING_DEPOSIT;
      const hasBet = !!row.first_bet_at;

      if (qualifyingDeposit && hasBet && !row.referrer_bonus_paid) {
        await execute(
          `UPDATE referrals SET referrer_bonus_paid = 1 WHERE id = ?`,
          [row.id]
        );
      }
    } catch { /* fall through */ }
    return;
  }

  // File fallback
  const state = load();
  const rec = state.records.find(r => r.referredUserId === referredUserId);
  if (!rec) return;
  const qualifyingDeposit = rec.firstDepositAmount != null && rec.firstDepositAmount >= MIN_QUALIFYING_DEPOSIT;
  const hasBet = !!rec.firstBetAt;
  if (qualifyingDeposit && hasBet && !rec.referrerBonusPaid) {
    rec.referrerBonusPaid = true;
    persist();
  }
}

/** Get or create the referral code for a user */
export async function getReferralCode(userId: number, username: string): Promise<string> {
  await ensureTables();
  const code = generateCode(userId, username);

  if (getPool()) {
    try {
      await execute(
        `INSERT IGNORE INTO referral_codes (user_id, code) VALUES (?, ?)`,
        [userId, code]
      );
      const r = await query<{ code: string }>(
        `SELECT code FROM referral_codes WHERE user_id = ? LIMIT 1`,
        [userId]
      );
      if (r.rows[0]) return r.rows[0].code;
    } catch { /* fall through */ }
  }

  const state = load();
  if (!state.codes[userId]) {
    state.codes[userId] = code;
    state.usersByCode[code] = userId;
    persist();
  }
  return state.codes[userId];
}

/** Look up the referrer user ID from a code */
export async function getReferrerByCode(code: string): Promise<number | null> {
  await ensureTables();
  const normalized = code.toUpperCase().trim();

  if (getPool()) {
    try {
      const r = await query<{ user_id: number }>(
        `SELECT user_id FROM referral_codes WHERE code = ? LIMIT 1`,
        [normalized]
      );
      if (r.rows[0]) return r.rows[0].user_id;
    } catch { /* fall through */ }
  }

  const state = load();
  return state.usersByCode[normalized] ?? null;
}

/** Record a new referral (called at registration time) */
export async function recordReferral(opts: {
  referrerId: number;
  referredUserId: number;
  referredEmail: string;
  referredUsername: string;
}): Promise<void> {
  await ensureTables();
  const { referrerId, referredUserId, referredEmail, referredUsername } = opts;
  const id = `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  if (getPool()) {
    try {
      await execute(
        `INSERT IGNORE INTO referrals
         (id, referrer_id, referred_user_id, referred_email, referred_username, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, referrerId, referredUserId, referredEmail, referredUsername]
      );
      return;
    } catch { /* fall through */ }
  }

  const state = load();
  const already = state.records.find(r => r.referredUserId === referredUserId);
  if (!already) {
    state.records.push({
      id,
      referrerId,
      referredUserId,
      referredEmail,
      referredUsername,
      createdAt: new Date().toISOString(),
      referrerBonusPaid: false,
      refereeBonusPaid: false,
    });
    persist();
  }
}

/**
 * Called when a referred user verifies their email.
 * Does NOT issue bonuses — just marks the verification timestamp.
 * Bonuses are only issued after qualifying deposit + first bet.
 */
export async function onReferralVerified(referredUserId: number): Promise<void> {
  await ensureTables();

  if (getPool()) {
    try {
      await execute(
        `UPDATE referrals SET verified_at = NOW()
         WHERE referred_user_id = ? AND verified_at IS NULL`,
        [referredUserId]
      );
    } catch { /* fall through */ }
    return;
  }

  const state = load();
  const rec = state.records.find(r => r.referredUserId === referredUserId);
  if (rec && !rec.verifiedAt) {
    rec.verifiedAt = new Date().toISOString();
    persist();
  }
}

/**
 * Called when a referred user makes a deposit (via PayHero callback or manual credit).
 * - If first qualifying deposit: award referee KES 50 welcome bonus.
 * - Then check if referrer bonus conditions are now fully met.
 */
export async function onReferralDeposit(referredUserId: number, amount: number): Promise<void> {
  await ensureTables();

  if (getPool()) {
    try {
      // Record first deposit if not already set
      await execute(
        `UPDATE referrals
         SET first_deposit_at = COALESCE(first_deposit_at, NOW()),
             first_deposit_amount = COALESCE(first_deposit_amount, ?)
         WHERE referred_user_id = ? AND first_deposit_at IS NULL`,
        [amount, referredUserId]
      );
      // Award referee bonus on first qualifying deposit
      if (amount >= MIN_QUALIFYING_DEPOSIT) {
        await execute(
          `UPDATE referrals SET referee_bonus_paid = 1
           WHERE referred_user_id = ? AND referee_bonus_paid = 0
             AND first_deposit_amount >= ?`,
          [referredUserId, MIN_QUALIFYING_DEPOSIT]
        );
      }
    } catch { /* fall through */ }
  } else {
    const state = load();
    const rec = state.records.find(r => r.referredUserId === referredUserId);
    if (rec && !rec.firstDepositAt) {
      rec.firstDepositAt = new Date().toISOString();
      rec.firstDepositAmount = amount;
      if (amount >= MIN_QUALIFYING_DEPOSIT && !rec.refereeBonusPaid) {
        rec.refereeBonusPaid = true;
      }
      persist();
    }
  }

  // Check if referrer bonus is now fully unlocked
  await maybeIssueReferrerBonus(referredUserId);
}

/**
 * Called when a referred user places their first tip/bet on the platform.
 * After this + a qualifying deposit, the referrer earns KES 100.
 */
export async function onReferralFirstBet(referredUserId: number): Promise<void> {
  await ensureTables();

  if (getPool()) {
    try {
      await execute(
        `UPDATE referrals
         SET first_bet_at = COALESCE(first_bet_at, NOW())
         WHERE referred_user_id = ? AND first_bet_at IS NULL`,
        [referredUserId]
      );
    } catch { /* fall through */ }
  } else {
    const state = load();
    const rec = state.records.find(r => r.referredUserId === referredUserId);
    if (rec && !rec.firstBetAt) {
      rec.firstBetAt = new Date().toISOString();
      persist();
    }
  }

  // Check if referrer bonus is now fully unlocked
  await maybeIssueReferrerBonus(referredUserId);
}

/**
 * Returns the earned referral credit for a user:
 *   - KES 100 per qualifying referral (referred user deposited ≥ KES 200 AND placed ≥ 1 bet)
 *   - KES 50 welcome bonus if this user was referred and made a qualifying deposit
 * This balance is for in-platform use only and is NOT withdrawable.
 */
export async function getReferralBalance(userId: number): Promise<number> {
  await ensureTables();
  let earned = 0;

  if (getPool()) {
    try {
      // KES 100 per referral this user made that fully qualified
      const referred = await query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM referrals
         WHERE referrer_id = ? AND referrer_bonus_paid = 1`,
        [userId]
      );
      earned += (referred.rows[0]?.cnt ?? 0) * REFERRER_BONUS;

      // KES 50 welcome bonus if this user was referred and made a qualifying deposit
      const wasReferred = await query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM referrals
         WHERE referred_user_id = ? AND referee_bonus_paid = 1`,
        [userId]
      );
      if ((wasReferred.rows[0]?.cnt ?? 0) > 0) earned += REFEREE_BONUS;
    } catch { /* fall through */ }
    return earned;
  }

  // File fallback
  const state = load();
  const madeReferrals = state.records.filter(r => r.referrerId === userId && r.referrerBonusPaid);
  earned += madeReferrals.length * REFERRER_BONUS;
  const wasReferred = state.records.find(r => r.referredUserId === userId && r.refereeBonusPaid);
  if (wasReferred) earned += REFEREE_BONUS;
  return earned;
}

/** Get referral stats for a user */
export async function getReferralStats(userId: number, username: string): Promise<ReferralStats> {
  await ensureTables();
  const code = await getReferralCode(userId, username);
  const referralUrl = `/register?ref=${code}`;

  let records: ReferralRecord[] = [];

  if (getPool()) {
    try {
      const r = await query<{
        id: string; referrer_id: number; referred_user_id: number;
        referred_email: string; referred_username: string;
        created_at: string; verified_at: string | null;
        first_deposit_at: string | null; first_deposit_amount: number | null;
        first_bet_at: string | null;
        referrer_bonus_paid: number; referee_bonus_paid: number;
      }>(
        `SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 200`,
        [userId]
      );
      records = r.rows.map(row => ({
        id: row.id,
        referrerId: row.referrer_id,
        referredUserId: row.referred_user_id,
        referredEmail: row.referred_email,
        referredUsername: row.referred_username,
        createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
        verifiedAt: row.verified_at ? (typeof row.verified_at === 'string' ? row.verified_at : new Date(row.verified_at).toISOString()) : undefined,
        firstDepositAt: row.first_deposit_at ? (typeof row.first_deposit_at === 'string' ? row.first_deposit_at : new Date(row.first_deposit_at).toISOString()) : undefined,
        firstDepositAmount: row.first_deposit_amount ?? undefined,
        firstBetAt: row.first_bet_at ? (typeof row.first_bet_at === 'string' ? row.first_bet_at : new Date(row.first_bet_at).toISOString()) : undefined,
        referrerBonusPaid: !!row.referrer_bonus_paid,
        refereeBonusPaid: !!row.referee_bonus_paid,
      }));
    } catch { /* fall through */ }
  } else {
    const state = load();
    records = state.records.filter(r => r.referrerId === userId);
  }

  const verified = records.filter(r => r.verifiedAt);
  const qualified = records.filter(r => r.referrerBonusPaid);

  return {
    code,
    referralUrl,
    totalReferrals: records.length,
    verifiedReferrals: verified.length,
    qualifiedReferrals: qualified.length,
    pendingReferrals: records.length - qualified.length,
    totalEarned: qualified.length * REFERRER_BONUS,
    referrals: records,
  };
}
