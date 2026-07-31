/**
 * POST /api/support-chat/session
 * Create a new support chat session. Returns { session_id, session_token }.
 * The client stores the token in localStorage and sends it with every request.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSession } from '@/lib/support-chat-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let user_id: number | undefined;
    let visitor_name: string | undefined;
    let visitor_email: string | undefined;

    // Try to attach authenticated user
    try {
      const user = await getCurrentUser();
      if (user) {
        user_id = user.userId;
        visitor_name = user.email?.split('@')[0];
        visitor_email = user.email ?? undefined;
      }
    } catch { /* not logged in — fine */ }

    // Allow override from body for anonymous visitors
    try {
      const body = await req.json().catch(() => ({}));
      if (!visitor_name && body.name) visitor_name = String(body.name).slice(0, 100);
      if (!visitor_email && body.email) visitor_email = String(body.email).slice(0, 200);
    } catch { /* ignore */ }

    const session = await createSession({ user_id, visitor_name, visitor_email });

    return NextResponse.json({
      session_id: session.id,
      session_token: session.session_token,
    });
  } catch (e) {
    console.error('[support-chat/session] error', e);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
