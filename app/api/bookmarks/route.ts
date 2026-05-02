import { NextRequest, NextResponse } from 'next/server';
import { query, execute, getPool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const g = globalThis as { __bookmarkMem?: Map<string, { entity_type: string; entity_id: string; created_at: string }> };
const mem = g.__bookmarkMem ?? (g.__bookmarkMem = new Map());

async function getUserId(): Promise<string | null> {
  try {
    const u = await getCurrentUser();
    return u && (u as { userId?: string | number }).userId
      ? String((u as { userId: string | number }).userId)
      : null;
  } catch {
    return null;
  }
}

function memKey(userId: string, type: string, id: string) {
  return `${userId}:${type}:${id}`;
}

interface BookmarkBody {
  matchId?: string;
  entityType?: string;
  entityId?: string;
}

function resolveEntity(body: BookmarkBody): { type: string; id: string } | null {
  if (body.matchId) return { type: 'match', id: String(body.matchId) };
  if (body.entityType && body.entityId) return { type: String(body.entityType), id: String(body.entityId) };
  return null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ bookmarks: [] }, { status: 200 });

  const type = req.nextUrl.searchParams.get('type');
  const pool = getPool();
  if (!pool) {
    const list = Array.from(mem.entries())
      .filter(([k]) => k.startsWith(`${userId}:`))
      .filter(([, v]) => !type || v.entity_type === type)
      .map(([, v]) => v);
    return NextResponse.json({ bookmarks: list });
  }
  try {
    const sql = type
      ? 'SELECT entity_type, entity_id, created_at FROM user_bookmarks WHERE user_id = ? AND entity_type = ? ORDER BY created_at DESC'
      : 'SELECT entity_type, entity_id, created_at FROM user_bookmarks WHERE user_id = ? ORDER BY created_at DESC';
    const params = type ? [userId, type] : [userId];
    const r = await query(sql, params);
    return NextResponse.json({ bookmarks: r.rows });
  } catch {
    return NextResponse.json({ bookmarks: [] });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to save bookmarks' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as BookmarkBody;
  const ent = resolveEntity(body);
  if (!ent) return NextResponse.json({ error: 'Missing entity' }, { status: 400 });

  const pool = getPool();
  if (!pool) {
    mem.set(memKey(userId, ent.type, ent.id), {
      entity_type: ent.type, entity_id: ent.id, created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, source: 'memory' });
  }
  try {
    await execute(
      `INSERT INTO user_bookmarks (user_id, entity_type, entity_id, created_at)
       VALUES (?, ?, ?, NOW())`,
      [userId, ent.type, ent.id],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    mem.set(memKey(userId, ent.type, ent.id), {
      entity_type: ent.type, entity_id: ent.id, created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, source: 'memory', warning: String(err) });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Sign in to manage bookmarks' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as BookmarkBody;
  const ent = resolveEntity(body);
  if (!ent) return NextResponse.json({ error: 'Missing entity' }, { status: 400 });

  const pool = getPool();
  if (pool) {
    try {
      await execute(
        'DELETE FROM user_bookmarks WHERE user_id = ? AND entity_type = ? AND entity_id = ?',
        [userId, ent.type, ent.id],
      );
    } catch { /* fall through to memory cleanup */ }
  }
  mem.delete(memKey(userId, ent.type, ent.id));
  return NextResponse.json({ ok: true });
}
