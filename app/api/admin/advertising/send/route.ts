import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { bookmakerPartnershipEmail } from '@/lib/email-templates';
import { sendMail } from '@/lib/mailer';
import { appendEntry } from '@/lib/advertising-log';

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !isAdmin(me.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tier, bookmakerName, contactName, customNote, email, customHtml, customSubject } = body;

  if (!bookmakerName || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let subject: string;
  let html: string;
  let text: string;
  let mode: 'template' | 'custom';

  if (customHtml) {
    subject = customSubject || `Partnership Proposal for ${bookmakerName} — Betcheza.co.ke`;
    html = customHtml;
    text = `Partnership proposal for ${bookmakerName}. View this email in an HTML-capable client.`;
    mode = 'custom';
  } else {
    if (!tier) {
      return NextResponse.json({ error: 'Missing tier for template mode' }, { status: 400 });
    }
    const tpl = bookmakerPartnershipEmail({
      bookmakerName,
      contactName: contactName || undefined,
      tier,
      customNote: customNote || undefined,
    });
    subject = tpl.subject;
    html = tpl.html;
    text = tpl.text;
    mode = 'template';
  }

  try {
    await sendMail({
      to: email,
      subject,
      html,
      text,
      replyTo: 'partnerships@betcheza.co.ke',
    });

    appendEntry({
      company: bookmakerName,
      contactName: contactName || undefined,
      email,
      subject,
      tier: tier || undefined,
      mode,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Advertising] Failed to send email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
