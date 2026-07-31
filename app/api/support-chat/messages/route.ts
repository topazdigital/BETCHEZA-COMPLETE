/**
 * GET  /api/support-chat/messages?session_id=X&sinceId=N
 *   Header: X-Support-Token: <session_token>
 *   → returns messages for session with id > sinceId
 *
 * POST /api/support-chat/messages
 *   Header: X-Support-Token: <session_token>
 *   body: { session_id, body }
 *   → adds a user message; returns the new message
 *
 * The session token is passed as a request header (not a query parameter)
 * to prevent it appearing in server access logs and URL telemetry.
 */
import { NextResponse } from 'next/server';
import { getSessionByToken, getMessages, addMessage } from '@/lib/support-chat-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const session_id = parseInt(searchParams.get('session_id') ?? '0', 10);
  const token = req.headers.get('X-Support-Token') ?? '';
  const sinceId = parseInt(searchParams.get('sinceId') ?? '0', 10);

  if (!session_id || !token) {
    return NextResponse.json({ error: 'Missing session_id or X-Support-Token header' }, { status: 400 });
  }

  const session = await getSessionByToken(session_id, token);
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 403 });
  }

  const messages = await getMessages(session_id, sinceId);
  return NextResponse.json({ messages, status: session.status });
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get('X-Support-Token') ?? '';
    const { session_id, body } = await req.json();

    if (!session_id || !token || !body?.trim()) {
      return NextResponse.json({ error: 'Missing required fields or X-Support-Token header' }, { status: 400 });
    }

    const session = await getSessionByToken(Number(session_id), token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 403 });
    }
    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Session is closed' }, { status: 400 });
    }

    const msg = await addMessage({
      session_id: Number(session_id),
      sender: 'user',
      body: String(body).slice(0, 2000),
    });

    return NextResponse.json({ message: msg });
  } catch (e) {
    console.error('[support-chat/messages POST]', e);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
