import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { bookmakerPartnershipEmail } from '@/lib/email-templates';
import { sendMail } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !isAdmin(me.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tier, bookmakerName, contactName, customNote, email } = body;

  if (!tier || !bookmakerName || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const tpl = bookmakerPartnershipEmail({
    bookmakerName,
    contactName: contactName || undefined,
    tier,
    customNote: customNote || undefined,
  });

  try {
    await sendMail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: 'partnerships@betcheza.co.ke',
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Advertising] Failed to send email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
