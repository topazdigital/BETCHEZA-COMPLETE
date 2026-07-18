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
    const { to, subject, body, inReplyTo } = await req.json();
    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 });
    }

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
      ...(inReplyTo ? { headers: { 'In-Reply-To': inReplyTo, 'References': inReplyTo } } : {}),
    });

    if (!result.ok) return NextResponse.json({ error: result.error || 'Send failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
