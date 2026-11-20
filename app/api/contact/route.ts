import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import {
  cleanFormText,
  escapeHtml,
  isHoneypotFilled,
  isValidEmail,
  protectPublicForm,
} from '@/lib/public-form-security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    if (isHoneypotFilled(data.companyFax)) {
      // Quietly discard basic form-filling bots.
      return NextResponse.json({ ok: true });
    }

    const protection = await protectPublicForm(req, 'contact', data);
    if (!protection.ok) return protection.response;

    const name = cleanFormText(data.name, 120);
    const email = cleanFormText(data.email, 254).toLowerCase();
    const subject = cleanFormText(data.subject, 140);
    const message = cleanFormText(data.message, 3000);

    if (!name || !email || !subject || !message || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'Please provide your name, a valid email, subject, and message.' },
        { status: 400 },
      );
    }

    const result = await sendMail({
      to: 'support@betcheza.co.ke',
      subject: `Website contact: ${subject}`,
      replyTo: email,
      text: `New website contact message\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2>New website contact message</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        </div>
      `,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.skipped ? 'The contact form is temporarily unavailable. Please try again later.' : 'Could not send your message. Please try again later.' },
        { status: result.skipped ? 503 : 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[contact] submission failed:', error);
    return NextResponse.json({ ok: false, error: 'Could not send your message. Please try again later.' }, { status: 500 });
  }
}
