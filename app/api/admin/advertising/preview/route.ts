import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { bookmakerPartnershipEmail } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tier, bookmakerName, contactName, customNote } = body;

  if (!tier || !bookmakerName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const tpl = bookmakerPartnershipEmail({
    bookmakerName,
    contactName: contactName || undefined,
    tier,
    customNote: customNote || undefined,
  });

  return NextResponse.json({ html: tpl.html, subject: tpl.subject, text: tpl.text });
}
