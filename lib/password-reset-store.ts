import { randomBytes, createHash } from 'crypto';

export interface PasswordResetToken {
  tokenHash: string;
  email: string;
  userId: number;
  expiresAt: number;
  used: boolean;
}

const g = globalThis as { __pwResetTokens?: Map<string, PasswordResetToken> };

function store(): Map<string, PasswordResetToken> {
  if (!g.__pwResetTokens) g.__pwResetTokens = new Map();
  return g.__pwResetTokens;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPasswordResetToken(userId: number, email: string): { token: string; expiresAt: number } {
  // 60 minutes lifetime
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = Date.now() + 60 * 60 * 1000;
  store().set(tokenHash, { tokenHash, email, userId, expiresAt, used: false });
  // Best-effort cleanup of stale tokens (avoid unbounded growth)
  for (const [k, v] of store().entries()) {
    if (v.expiresAt < Date.now() - 24 * 60 * 60 * 1000) store().delete(k);
  }
  return { token, expiresAt };
}

export function consumePasswordResetToken(rawToken: string): PasswordResetToken | null {
  const tokenHash = hashToken(rawToken);
  const entry = store().get(tokenHash);
  if (!entry) return null;
  if (entry.used) return null;
  if (entry.expiresAt < Date.now()) return null;
  entry.used = true;
  store().set(tokenHash, entry);
  return entry;
}

export function peekPasswordResetToken(rawToken: string): PasswordResetToken | null {
  const tokenHash = hashToken(rawToken);
  const entry = store().get(tokenHash);
  if (!entry) return null;
  if (entry.used) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}
