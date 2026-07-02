import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { bookmakerPartnershipEmail } from '@/lib/email-templates';
import { sendMail } from '@/lib/mailer';
import { appendEntry } from '@/lib/advertising-log';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

function injectTrackingPixel(html: string, entryId: string): string {
  const pixel = `<img src="${SITE_URL}/api/ad-track?id=${entryId}&t=open" width="1" height="1" style="display:none;border:0;outline:0" alt="" />`;
  // Inject before </body> if present, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}\n</body>`);
  }
  return html + pixel;
}

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
    // Log the entry first so we have the ID for the tracking pixel
    const entry = appendEntry({
      company: bookmakerName,
      contactName: contactName || undefined,
      email,
      subject,
      tier: tier || undefined,
      mode,
    });

    // Inject open-tracking pixel into the outgoing HTML
    const trackedHtml = injectTrackingPixel(html, entry.id);

    await sendMail({
      to: email,
      subject,
      html: trackedHtml,
      text,
      replyTo: 'partnerships@betcheza.co.ke',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Advertising] Failed to send email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
