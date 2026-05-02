/**
 * Persistent user profile overrides.
 * MySQL-first, file-based fallback for dev/no-DB environments.
 */
import { query, getPool } from './db';
import { fileStoreGet, fileStoreSet } from './file-store';

export interface ProfilePatch {
  displayName?: string;
  username?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface StoredProfile extends ProfilePatch {
  userId: number;
  updatedAt: string;
}

const g = globalThis as { __userProfiles?: Record<number, StoredProfile> };
function cache(): Record<number, StoredProfile> {
  if (!g.__userProfiles) {
    g.__userProfiles = fileStoreGet<Record<number, StoredProfile>>('user-profiles', {});
  }
  return g.__userProfiles;
}

function hasDb(): boolean {
  return !!getPool();
}

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INT NOT NULL PRIMARY KEY,
        display_name VARCHAR(100),
        username VARCHAR(50),
        phone VARCHAR(30),
        bio TEXT,
        avatar_url VARCHAR(500),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    tableReady = true;
  } catch { /* ignore — no DB */ }
}

export async function getProfile(userId: number): Promise<StoredProfile | null> {
  if (hasDb()) {
    try {
      await ensureTable();
      const r = await query<{
        user_id: number; display_name: string; username: string; phone: string; bio: string; avatar_url: string; updated_at: string;
      }>('SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
      if (r.rows[0]) {
        const row = r.rows[0];
        return {
          userId,
          displayName: row.display_name ?? undefined,
          username: row.username ?? undefined,
          phone: row.phone ?? undefined,
          bio: row.bio ?? undefined,
          avatarUrl: row.avatar_url ?? undefined,
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString(),
        };
      }
    } catch { /* no DB */ }
  }
  return cache()[userId] ?? null;
}

export async function updateProfile(userId: number, patch: ProfilePatch): Promise<StoredProfile> {
  const existing = await getProfile(userId) ?? { userId, updatedAt: new Date().toISOString() };
  const merged: StoredProfile = {
    ...existing,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    userId,
    updatedAt: new Date().toISOString(),
  };

  const c = cache();
  c[userId] = merged;
  fileStoreSet('user-profiles', c);

  if (hasDb()) {
    try {
      await ensureTable();
      await query(
        `INSERT INTO user_profiles (user_id, display_name, username, phone, bio, avatar_url)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           username = VALUES(username),
           phone = VALUES(phone),
           bio = VALUES(bio),
           avatar_url = VALUES(avatar_url)`,
        [
          userId,
          merged.displayName ?? null,
          merged.username ?? null,
          merged.phone ?? null,
          merged.bio ?? null,
          merged.avatarUrl ?? null,
        ]
      );
    } catch { /* ignore — file fallback saved */ }
  }

  return merged;
}
