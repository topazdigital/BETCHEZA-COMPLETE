/**
 * Support live-chat store.
 *
 * Two storage tiers:
 *   1. MySQL — when DB is configured AND tables are present. Persists across restarts.
 *   2. In-memory Map — no DB configured, or tables not yet created.
 *
 * Backend selection is STICKY: on the first operation, we probe the DB. If the
 * probe succeeds, all operations use DB. If it fails (e.g. ER_NO_SUCH_TABLE,
 * or no DB configured), all operations use memory for the lifetime of the
 * process. This prevents the inconsistent state where writes go to memory but
 * reads target a missing DB table and return empty results.
 *
 * Security: every session gets a random 64-hex-char session_token.
 * All user-facing API requests must supply a matching token.
 */

import crypto from 'crypto';
import { query, execute, getPool } from './db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: number;
  session_token: string;
  user_id: number | null;
  visitor_name: string | null;
  visitor_email: string | null;
  status: 'open' | 'closed';
  last_message_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  sender: 'user' | 'admin';
  body: string;
  created_at: string;
}

// ─── Global state ─────────────────────────────────────────────────────────────

const g = globalThis as {
  __supportSessions?: Map<number, ChatSession>;
  __supportMessages?: Map<number, ChatMessage[]>; // keyed by session_id
  __supportSeq?: number;
  __supportMsgSeq?: number;
  /** null = not yet probed; true = DB tables ready; false = use memory */
  __supportUseDb?: boolean | null;
};

// ─── Backend selection ────────────────────────────────────────────────────────

/**
 * Probe DB readiness and return whether to use DB for this call.
 *
 * Caching rules:
 *   - `true`  → DB is ready; cache permanently (don't re-probe on every call).
 *   - `false` → No DB pool configured; cache permanently (won't appear mid-run).
 *   - `null`  → Not yet probed; will probe on next call.
 *
 * CRITICAL RULE: once any data has been written to the in-memory store,
 * `lockMemory()` sets `__supportUseDb = false` permanently. This prevents
 * a later successful DB probe from switching backends and losing in-memory
 * sessions/messages. Backend selection is therefore monotonic: null → true
 * (if DB ready before first write) or null → false (if first write hits memory).
 */
async function resolveBackend(): Promise<boolean> {
  // Permanently confirmed: use DB
  if (g.__supportUseDb === true) return true;
  // Permanently confirmed: use memory (no pool, or data already written to memory)
  if (g.__supportUseDb === false) return false;
  // null: probe now

  // No pool → memory permanently
  if (!getPool()) {
    g.__supportUseDb = false;
    return false;
  }

  // Probe the table
  try {
    await query('SELECT 1 FROM support_chat_sessions LIMIT 0');
    g.__supportUseDb = true;
    console.log('[support-chat] DB tables ready — using DB backend');
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Transient: tables not yet created by instrumentation — keep null, retry next call
    console.warn('[support-chat] DB probe failed, will retry:', code ?? String(e));
    return false;
  }
}

/**
 * Permanently lock this process to the in-memory backend.
 * Call immediately after any successful write to the in-memory store,
 * so a later DB readiness probe cannot switch backends and lose that data.
 */
function lockMemory(): void {
  if (g.__supportUseDb !== true) {
    g.__supportUseDb = false;
  }
}

// ─── In-memory store ──────────────────────────────────────────────────────────

function mem() {
  if (!g.__supportSessions) g.__supportSessions = new Map();
  if (!g.__supportMessages) g.__supportMessages = new Map();
  if (!g.__supportSeq) g.__supportSeq = 1;
  if (!g.__supportMsgSeq) g.__supportMsgSeq = 1;
  return {
    sessions: g.__supportSessions,
    messages: g.__supportMessages,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function toPositiveInt(v: unknown): number | null {
  const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Session operations ───────────────────────────────────────────────────────

/** Create a new chat session. Returns the session (including the token). */
export async function createSession(opts: {
  user_id?: number;
  visitor_name?: string;
  visitor_email?: string;
}): Promise<ChatSession> {
  const token = genToken();
  const now = nowStr();
  const useDb = await resolveBackend();

  if (useDb) {
    const result = await execute(
      `INSERT INTO support_chat_sessions (session_token, user_id, visitor_name, visitor_email, status, created_at)
       VALUES (?, ?, ?, ?, 'open', UTC_TIMESTAMP())`,
      [token, opts.user_id ?? null, opts.visitor_name ?? null, opts.visitor_email ?? null],
    );
    const insertId = (result as { insertId?: number }).insertId ?? 0;
    return {
      id: insertId,
      session_token: token,
      user_id: opts.user_id ?? null,
      visitor_name: opts.visitor_name ?? null,
      visitor_email: opts.visitor_email ?? null,
      status: 'open',
      last_message_at: null,
      created_at: now,
    };
  }

  // Memory fallback — lock permanently so a later DB probe cannot switch backends
  lockMemory();
  const { sessions } = mem();
  const id = g.__supportSeq!++;
  const session: ChatSession = {
    id,
    session_token: token,
    user_id: opts.user_id ?? null,
    visitor_name: opts.visitor_name ?? null,
    visitor_email: opts.visitor_email ?? null,
    status: 'open',
    last_message_at: null,
    created_at: now,
  };
  sessions.set(id, session);
  return session;
}

/** Validate session_token matches session_id. Returns session or null. */
export async function getSessionByToken(session_id: number, token: string): Promise<ChatSession | null> {
  const id = toPositiveInt(session_id);
  if (!id) return null;

  const useDb = await resolveBackend();
  if (useDb) {
    const { rows } = await query<ChatSession>(
      `SELECT * FROM support_chat_sessions WHERE id = ? AND session_token = ? LIMIT 1`,
      [id, token],
    );
    return rows[0] ?? null;
  }

  const { sessions } = mem();
  const s = sessions.get(id);
  if (!s || s.session_token !== token) return null;
  return s;
}

/** Get a session by ID (admin use — no token required). */
export async function getSessionById(session_id: number): Promise<ChatSession | null> {
  const id = toPositiveInt(session_id);
  if (!id) return null;

  const useDb = await resolveBackend();
  if (useDb) {
    const { rows } = await query<ChatSession>(
      `SELECT * FROM support_chat_sessions WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  const { sessions } = mem();
  return sessions.get(id) ?? null;
}

/** Get all sessions (for admin). */
export async function getAllSessions(): Promise<ChatSession[]> {
  const useDb = await resolveBackend();
  if (useDb) {
    const { rows } = await query<ChatSession>(
      `SELECT * FROM support_chat_sessions ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 200`,
    );
    return rows;
  }

  const { sessions } = mem();
  return [...sessions.values()].sort(
    (a, b) =>
      new Date(b.last_message_at ?? b.created_at).getTime() -
      new Date(a.last_message_at ?? a.created_at).getTime(),
  );
}

/** Close a session (admin). */
export async function closeSession(session_id: number): Promise<void> {
  const id = toPositiveInt(session_id);
  if (!id) return;

  const useDb = await resolveBackend();
  if (useDb) {
    await execute(`UPDATE support_chat_sessions SET status='closed' WHERE id=?`, [id]);
    return;
  }
  const { sessions } = mem();
  const s = sessions.get(id);
  if (s) s.status = 'closed';
}

// ─── Message operations ───────────────────────────────────────────────────────

/** Add a message to a session. */
export async function addMessage(opts: {
  session_id: number;
  sender: 'user' | 'admin';
  body: string;
}): Promise<ChatMessage> {
  const now = nowStr();
  const useDb = await resolveBackend();

  if (useDb) {
    const result = await execute(
      `INSERT INTO support_chat_messages (session_id, sender, body, created_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP())`,
      [opts.session_id, opts.sender, opts.body],
    );
    await execute(
      `UPDATE support_chat_sessions SET last_message_at=UTC_TIMESTAMP(), status='open' WHERE id=?`,
      [opts.session_id],
    ).catch(() => {});
    const insertId = (result as { insertId?: number }).insertId ?? 0;
    return { id: insertId, ...opts, created_at: now };
  }

  // Memory fallback — lock permanently so a later DB probe cannot switch backends
  lockMemory();
  const { messages, sessions } = mem();
  const id = g.__supportMsgSeq!++;
  const msg: ChatMessage = { id, ...opts, created_at: now };
  const list = messages.get(opts.session_id) ?? [];
  list.push(msg);
  messages.set(opts.session_id, list);
  const s = sessions.get(opts.session_id);
  if (s) { s.last_message_at = now; s.status = 'open'; }
  return msg;
}

/** Get messages for a session, optionally only those with id > sinceId. */
export async function getMessages(session_id: number, sinceId = 0): Promise<ChatMessage[]> {
  const id = toPositiveInt(session_id);
  if (!id) return [];

  const useDb = await resolveBackend();
  if (useDb) {
    const { rows } = await query<ChatMessage>(
      `SELECT * FROM support_chat_messages
       WHERE session_id = ? AND id > ?
       ORDER BY id ASC
       LIMIT 200`,
      [id, sinceId],
    );
    return rows;
  }

  const { messages } = mem();
  const list = messages.get(id) ?? [];
  return list.filter(m => m.id > sinceId);
}

/** Count unread (user) messages across all sessions (for admin badge). */
export async function countUnreadUserMessages(): Promise<number> {
  const useDb = await resolveBackend();
  if (useDb) {
    try {
      const { rows } = await query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM support_chat_messages m
         JOIN support_chat_sessions s ON s.id = m.session_id
         WHERE m.sender = 'user' AND s.status = 'open'
           AND m.id > COALESCE((
             SELECT MAX(id) FROM support_chat_messages
             WHERE session_id = m.session_id AND sender = 'admin'
           ), 0)`,
      );
      return rows[0]?.cnt ?? 0;
    } catch { return 0; }
  }

  const { messages } = mem();
  let count = 0;
  for (const [, list] of messages) {
    const adminIds = list.filter(m => m.sender === 'admin').map(m => m.id);
    const maxAdmin = adminIds.length ? Math.max(...adminIds) : 0;
    count += list.filter(m => m.sender === 'user' && m.id > maxAdmin).length;
  }
  return count;
}
