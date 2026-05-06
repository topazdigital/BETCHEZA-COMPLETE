/**
 * Referral system — tracks who referred whom, issues referral codes,
 * and applies bonuses when a referred user verifies their email.
 * MySQL-first, file-based fallback for no-DB environments.
 */
import fs from 'fs';
import path from 'path';
import { query, execute, getPool } from './db';

export interface ReferralRecord {
  id: string;
  referrerId: number;
  referredUserId: number;
  referredEmail: string;
  referredUsername: string;
  createdAt: string;
  verifiedAt?: string;
  referrerBonusPaid: boolean;
  refereeBonusPaid: boolean;
}

export interface ReferralStats {
  code: string;
  totalReferrals: number;
  verifiedReferrals: number;
  pendingReferrals: number;
  totalEarned: number; // KES
  referrals: ReferralRecord[];
}

const STATE_DIR = path.join(process.cwd(), '.local', 'state');
const STATE_FILE = path.join(STATE_DIR, 'referrals.json');

interface ReferralState {
  codes: Record<number, string>; // userId → code
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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
        referrer_bonus_paid TINYINT(1) NOT NULL DEFAULT 0,
        referee_bonus_paid TINYINT(1) NOT NULL DEFAULT 0,
        INDEX idx_referrer (referrer_id),
        INDEX idx_referred (referred_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tableReady = true;
  } catch { /* ignore — no DB */ }
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
  const createdAt = new Date().toISOString();

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
      createdAt,
      referrerBonusPaid: false,
      refereeBonusPaid: false,
    });
    persist();
  }
}

/** Called when a referred user verifies their email — apply bonuses */
export async function onReferralVerified(referredUserId: number): Promise<void> {
  await ensureTables();
  const verifiedAt = new Date().toISOString();

  if (getPool()) {
    try {
      await execute(
        `UPDATE referrals SET verified_at = NOW(), referrer_bonus_paid = 1, referee_bonus_paid = 1
         WHERE referred_user_id = ? AND verified_at IS NULL`,
        [referredUserId]
      );
    } catch { /* fall through */ }
    return;
  }

  const state = load();
  const rec = state.records.find(r => r.referredUserId === referredUserId);
  if (rec && !rec.verifiedAt) {
    rec.verifiedAt = verifiedAt;
    rec.referrerBonusPaid = true;
    rec.refereeBonusPaid = true;
    persist();
  }
}

/**
 * Returns the earned referral credit for a user (KES 100 per verified referral +
 * KES 50 sign-up bonus if this user was themselves referred).
 * This balance is for in-platform use only and is NOT withdrawable.
 */
export async function getReferralBalance(userId: number): Promise<number> {
  await ensureTables();
  let earned = 0;

  if (getPool()) {
    try {
      // KES 100 per referral this user made that got verified
      const referred = await query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id = ? AND verified_at IS NOT NULL`,
        [userId]
      );
      earned += (referred.rows[0]?.cnt ?? 0) * 100;

      // KES 50 welcome bonus if this user was referred and is verified
      const wasReferred = await query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM referrals WHERE referred_user_id = ? AND verified_at IS NOT NULL`,
        [userId]
      );
      if ((wasReferred.rows[0]?.cnt ?? 0) > 0) earned += 50;
    } catch { /* fall through */ }
    return earned;
  }

  // File fallback
  const state = load();
  const madeReferrals = state.records.filter(r => r.referrerId === userId && r.verifiedAt);
  earned += madeReferrals.length * 100;
  const wasReferred = state.records.find(r => r.referredUserId === userId && r.verifiedAt);
  if (wasReferred) earned += 50;
  return earned;
}

/** Get referral stats for a user */
export async function getReferralStats(userId: number, username: string): Promise<ReferralStats> {
  await ensureTables();
  const code = await getReferralCode(userId, username);

  let records: ReferralRecord[] = [];

  if (getPool()) {
    try {
      const r = await query<{
        id: string; referrer_id: number; referred_user_id: number;
        referred_email: string; referred_username: string;
        created_at: string; verified_at: string | null;
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
        referrerBonusPaid: !!row.referrer_bonus_paid,
        refereeBonusPaid: !!row.referee_bonus_paid,
      }));
    } catch { /* fall through */ }
  } else {
    const state = load();
    records = state.records.filter(r => r.referrerId === userId);
  }

  const verified = records.filter(r => r.verifiedAt);
  return {
    code,
    totalReferrals: records.length,
    verifiedReferrals: verified.length,
    pendingReferrals: records.length - verified.length,
    totalEarned: verified.length * 100, // KES 100 per verified referral
    referrals: records,
  };
}
