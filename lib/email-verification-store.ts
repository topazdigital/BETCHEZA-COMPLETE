// ─────────────────────────────────────────────────────────────────────
// Email verification store — issues a 6-digit code AND a URL-safe token
// per pending verification, with TTL. Stored as JSON; same pattern as
// the other *-store.ts modules so we don't depend on the DB.
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface PendingVerification {
  userId: number;
  email: string;
  code: string;        // 6-digit numeric
  token: string;       // URL-safe (for email link)
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

const STORE_DIR = path.join(process.cwd(), '.local', 'state');
const STORE_FILE = path.join(STORE_DIR, 'email-verifications.json');
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ATTEMPTS = 6;

interface VerifyFile {
  pending: Record<string, PendingVerification>; // keyed by userId
  verifiedUserIds: number[];
}

function ensureDir() {
  try { fs.mkdirSync(STORE_DIR, { recursive: true }); } catch { /* ignore */ }
}

function load(): VerifyFile {
  ensureDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as VerifyFile;
      if (parsed && typeof parsed === 'object') {
        return {
          pending: parsed.pending || {},
          verifiedUserIds: Array.isArray(parsed.verifiedUserIds) ? parsed.verifiedUserIds : [],
        };
      }
    }
  } catch (e) {
    console.warn('[email-verify] failed to read store:', e);
  }
  return { pending: {}, verifiedUserIds: [] };
}

function persist(state: VerifyFile) {
  ensureDir();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[email-verify] failed to write store:', e);
  }
}

const g = globalThis as { __emailVerifyCache?: VerifyFile };
function cache(): VerifyFile {
  if (!g.__emailVerifyCache) g.__emailVerifyCache = load();
  return g.__emailVerifyCache!;
}

function makeCode(): string {
  // 6-digit zero-padded numeric code.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function makeToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** Create or replace a pending verification for the user. */
export function issueVerification(userId: number, email: string): PendingVerification {
  const state = cache();
  const now = Date.now();
  const v: PendingVerification = {
    userId,
    email: email.toLowerCase(),
    code: makeCode(),
    token: makeToken(),
    createdAt: now,
    expiresAt: now + TTL_MS,
    attempts: 0,
  };
  state.pending[String(userId)] = v;
  persist(state);
  return v;
}

export function getPending(userId: number): PendingVerification | undefined {
  const state = cache();
  const v = state.pending[String(userId)];
  if (!v) return undefined;
  if (v.expiresAt <= Date.now()) {
    delete state.pending[String(userId)];
    persist(state);
    return undefined;
  }
  return v;
}

export function isVerified(userId: number): boolean {
  return cache().verifiedUserIds.includes(userId);
}

/** Verify by 6-digit code (current logged-in user). */
export function verifyByCode(userId: number, code: string): { ok: true } | { ok: false; error: string } {
  const state = cache();
  const key = String(userId);
  const v = state.pending[key];
  if (!v) return { ok: false, error: 'No pending verification. Request a new code.' };
  if (v.expiresAt <= Date.now()) {
    delete state.pending[key];
    persist(state);
    return { ok: false, error: 'Your code has expired. Request a new one.' };
  }
  if (v.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many attempts. Request a new code.' };
  }
  if (v.code !== code.replace(/\D/g, '').slice(0, 6)) {
    v.attempts += 1;
    persist(state);
    return { ok: false, error: 'Wrong code. Try again.' };
  }
  if (!state.verifiedUserIds.includes(userId)) state.verifiedUserIds.push(userId);
  delete state.pending[key];
  persist(state);
  return { ok: true };
}

/** Verify via URL token (email link click). Token is single-use. */
export function verifyByToken(token: string): { ok: true; userId: number } | { ok: false; error: string } {
  const state = cache();
  const entry = Object.entries(state.pending).find(([, v]) => v.token === token);
  if (!entry) return { ok: false, error: 'This verification link is invalid or has already been used.' };
  const [key, v] = entry;
  if (v.expiresAt <= Date.now()) {
    delete state.pending[key];
    persist(state);
    return { ok: false, error: 'This verification link has expired. Sign in and request a new one.' };
  }
  if (!state.verifiedUserIds.includes(v.userId)) state.verifiedUserIds.push(v.userId);
  delete state.pending[key];
  persist(state);
  return { ok: true, userId: v.userId };
}

/** Bypass — admin manually marks a user as verified. */
export function markVerified(userId: number): void {
  const state = cache();
  if (!state.verifiedUserIds.includes(userId)) state.verifiedUserIds.push(userId);
  delete state.pending[String(userId)];
  persist(state);
}
