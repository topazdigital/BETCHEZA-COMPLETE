import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { saveEnquiry } from '@/lib/enquiry-store';
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
      return NextResponse.json({ ok: true });
    }

    const protection = await protectPublicForm(req, 'partnership-enquiry', data);
    if (!protection.ok) return protection.response;

    const company = cleanFormText(data.company, 160);
    const name = cleanFormText(data.name, 120);
    const email = cleanFormText(data.email, 254).toLowerCase();
    const phone = cleanFormText(data.phone, 40);
    const website = cleanFormText(data.website, 500);
    const budget = cleanFormText(data.budget, 100);
    const model = cleanFormText(data.model, 100);
    const message = cleanFormText(data.message, 3000);

    if (!company || !email || !name || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Company, name and email are required.' }, { status: 400 });
    }

    let safeWebsite = '';
    if (website) {
      try {
        const parsed = new URL(website);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Invalid protocol');
        safeWebsite = parsed.toString();
      } catch {
        return NextResponse.json({ ok: false, error: 'Please enter a valid website URL.' }, { status: 400 });
      }
    }

    const htmlCompany = escapeHtml(company);
    const htmlName = escapeHtml(name);
    const htmlEmail = escapeHtml(email);
    const htmlPhone = escapeHtml(phone);
    const htmlWebsite = escapeHtml(safeWebsite);
    const htmlBudget = escapeHtml(budget);
    const htmlModel = escapeHtml(model);
    const htmlMessage = escapeHtml(message);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:8px;overflow:hidden">
        <div style="background:#16a34a;padding:24px 32px">
          <h1 style="color:#fff;margin:0;font-size:20px">New Partnership Enquiry — Betcheza</h1>
        </div>
        <div style="padding:24px 32px;background:#fff">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px">Company</td><td style="padding:8px 0;font-size:14px;font-weight:600">${htmlCompany}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Contact Name</td><td style="padding:8px 0;font-size:14px">${htmlName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td><td style="padding:8px 0;font-size:14px"><a href="mailto:${htmlEmail}" style="color:#16a34a">${htmlEmail}</a></td></tr>
            ${phone ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Phone / WhatsApp</td><td style="padding:8px 0;font-size:14px">${htmlPhone}</td></tr>` : ''}
            ${safeWebsite ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Website</td><td style="padding:8px 0;font-size:14px"><a href="${htmlWebsite}" style="color:#16a34a">${htmlWebsite}</a></td></tr>` : ''}
            ${budget ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Monthly Budget</td><td style="padding:8px 0;font-size:14px">${htmlBudget}</td></tr>` : ''}
            ${model ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Preferred Model</td><td style="padding:8px 0;font-size:14px">${htmlModel}</td></tr>` : ''}
            ${message ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top">Message</td><td style="padding:8px 0;font-size:14px;white-space:pre-line">${htmlMessage}</td></tr>` : ''}
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

    // Always persist to file store so admin can read without Roundcube
    saveEnquiry({ company, name, email, phone, website: safeWebsite, budget, model, message });

    const result = await sendMail({
      to: 'partnerships@betcheza.co.ke',
      subject: `Partnership Enquiry from ${company}`,
      html,
      text,
      replyTo: email,
    });

    if (result.skipped) {
      return NextResponse.json(
        { ok: false, skipped: true, error: 'Email delivery is temporarily unavailable. Please try again later or contact us via WhatsApp.' },
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
