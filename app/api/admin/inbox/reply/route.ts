import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const u = await getCurrentUser();
    if (!u || !canAccessAdmin(u.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  try {
    const { to, subject, body, inReplyTo, from } = await req.json();
    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 });
    }
    const allowedFrom = new Set([
      'support@betcheza.co.ke',
      'partnerships@betcheza.co.ke',
      'info@betcheza.co.ke',
      'careers@betcheza.co.ke',
    ]);
    const sender = typeof from === 'string' && allowedFrom.has(from.toLowerCase())
      ? from.toLowerCase()
      : undefined;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="white-space:pre-line;font-size:14px;line-height:1.6;padding:16px 0">${body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="font-size:12px;color:#9ca3af">Betcheza · betcheza.co.ke</p>
      </div>`;

    const result = await sendMail({
      to,
      subject,
      html,
      text: body,
      ...(sender ? { from: sender } : {}),
      ...(inReplyTo ? { headers: { 'In-Reply-To': inReplyTo, References: inReplyTo } } : {}),
    });

    if (!result.ok) return NextResponse.json({ error: result.error || 'Send failed' }, { status: 500 });
    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      accepted: result.accepted ?? [],
      rejected: result.rejected ?? [],
      response: result.response,
      sender: sender || 'configured SMTP sender',
      notice: 'Accepted by the outgoing mail server. Delivery can still be delayed or filtered by the recipient mailbox.',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
