import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, website, name, email, phone, budget, model, message } = body;

    if (!company || !email || !name) {
      return NextResponse.json({ error: 'Company, name and email are required.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:8px;overflow:hidden">
        <div style="background:#16a34a;padding:24px 32px">
          <h1 style="color:#fff;margin:0;font-size:20px">New Partnership Enquiry — Betcheza</h1>
        </div>
        <div style="padding:24px 32px;background:#fff">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px">Company</td><td style="padding:8px 0;font-size:14px;font-weight:600">${company}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Contact Name</td><td style="padding:8px 0;font-size:14px">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td><td style="padding:8px 0;font-size:14px"><a href="mailto:${email}" style="color:#16a34a">${email}</a></td></tr>
            ${phone ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Phone / WhatsApp</td><td style="padding:8px 0;font-size:14px">${phone}</td></tr>` : ''}
            ${website ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Website</td><td style="padding:8px 0;font-size:14px"><a href="${website}" style="color:#16a34a">${website}</a></td></tr>` : ''}
            ${budget ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Monthly Budget</td><td style="padding:8px 0;font-size:14px">${budget}</td></tr>` : ''}
            ${model ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Preferred Model</td><td style="padding:8px 0;font-size:14px">${model}</td></tr>` : ''}
            ${message ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top">Message</td><td style="padding:8px 0;font-size:14px;white-space:pre-line">${message}</td></tr>` : ''}
          </table>
        </div>
        <div style="padding:16px 32px;background:#f3f4f6;font-size:12px;color:#9ca3af">
          Sent from betcheza.co.ke/advertise — reply directly to ${email}
        </div>
      </div>
    `;

    const text = [
      'New Partnership Enquiry — Betcheza',
      '',
      `Company: ${company}`,
      `Contact: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : '',
      website ? `Website: ${website}` : '',
      budget ? `Budget: ${budget}` : '',
      model ? `Model: ${model}` : '',
      message ? `\nMessage:\n${message}` : '',
    ].filter(Boolean).join('\n');

    const result = await sendMail({
      to: 'partnerships@betcheza.co.ke',
      subject: `Partnership Enquiry from ${company}`,
      html,
      text,
      replyTo: email,
    });

    if (result.skipped) {
      return NextResponse.json(
        { ok: false, skipped: true, error: 'Email not configured on server — please contact us directly at partnerships@betcheza.co.ke' },
        { status: 503 }
      );
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Failed to send email.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[advertise/enquiry]', e);
    return NextResponse.json({ ok: false, error: 'Server error.' }, { status: 500 });
  }
}
