/**
 * GET /api/admin/support-chat
 *   → list all sessions; pass ?session_id=X to get messages for one session
 *
 * PATCH /api/admin/support-chat
 *   body: { session_id, action: 'close' }
 *   → close a session (verifies session exists first)
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import {
  getAllSessions,
  getSessionById,
  getMessages,
  closeSession,
  countUnreadUserMessages,
} from '@/lib/support-chat-store';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) return null;
  return user;
}

function parsePositiveInt(v: string | null): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rawSessionId = searchParams.get('session_id');

  if (rawSessionId !== null) {
    const sessionId = parsePositiveInt(rawSessionId);
    if (!sessionId) {
      return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
    }
    const sinceId = parseInt(searchParams.get('sinceId') ?? '0', 10) || 0;
    const messages = await getMessages(sessionId, sinceId);
    return NextResponse.json({ messages });
  }

  const [sessions, unread] = await Promise.all([getAllSessions(), countUnreadUserMessages()]);
  return NextResponse.json({ sessions, unread });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { session_id, action } = await req.json();

  if (action === 'close') {
    const id = typeof session_id === 'number' ? session_id : parseInt(String(session_id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
    }
    const session = await getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    await closeSession(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
