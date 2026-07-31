/**
 * POST /api/admin/support-chat/reply
 * body: { session_id, body }
 * → sends an admin reply to a session
 *
 * Validates: session_id is a positive integer, session exists and is open.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import { getSessionById, addMessage } from '@/lib/support-chat-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { session_id, body } = await req.json();

  // Validate session_id
  const id = typeof session_id === 'number' ? session_id : parseInt(String(session_id), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
  }

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
  }

  // Verify session exists and is open
  const session = await getSessionById(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status === 'closed') {
    return NextResponse.json({ error: 'Session is closed' }, { status: 400 });
  }

  const msg = await addMessage({
    session_id: id,
    sender: 'admin',
    body: String(body).slice(0, 2000),
  });

  return NextResponse.json({ message: msg });
}
