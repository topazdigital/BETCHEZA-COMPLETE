import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getJackpotById } from '@/lib/jackpot-store';
import { sendJackpotNotification } from '@/lib/jackpot-notify';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let jackpotId: string | undefined;
  try { const body = await req.json(); jackpotId = body?.jackpotId; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!jackpotId) return NextResponse.json({ error: 'jackpotId is required' }, { status: 400 });
  const jackpot = getJackpotById(jackpotId);
  if (!jackpot) return NextResponse.json({ error: 'Jackpot not found' }, { status: 404 });
  try {
    const result = await sendJackpotNotification(jackpot);
    if (result.skipped) return NextResponse.json({ ok: false, message: 'Email not configured. Set up SMTP in Admin > Email Setup.', sent: 0, failed: 0 });
    if (result.recipientCount === 0) return NextResponse.json({ ok: true, message: 'No subscribers have opted in to jackpot alerts yet.', sent: 0, failed: 0 });
    return NextResponse.json({ ok: true, message: 'Sent to ' + result.sent + ' subscriber' + (result.sent !== 1 ? 's' : '') + (result.failed > 0 ? ' (' + result.failed + ' failed)' : '') + '.', sent: result.sent, failed: result.failed });
  } catch (e) { console.error('[jackpot notify]', e); return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 }); }
}
