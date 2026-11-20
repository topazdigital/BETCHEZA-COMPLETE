import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { execute, query } from '@/lib/db';
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

    const protection = await protectPublicForm(req, 'careers-application', data);
    if (!protection.ok) return protection.response;

    const name = cleanFormText(data.name, 200);
    const phone = cleanFormText(data.phone, 30);
    const role = cleanFormText(data.role, 100);
    const emailInput = cleanFormText(data.email, 254).toLowerCase();
    const location = cleanFormText(data.location, 200);
    const network = cleanFormText(data.network, 500);
    const message = cleanFormText(data.message, 2000);

    if (!name || !phone || !role) {
      return NextResponse.json({ ok: false, error: 'Name, phone and role are required.' }, { status: 400 });
    }
    if (emailInput && !isValidEmail(emailInput)) {
      return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const sanitizedName = name;
    const sanitizedPhone = phone;
    const sanitizedRole = role;
    const sanitizedEmail = emailInput || null;
    const sanitizedLocation = location || null;
    const sanitizedNetwork = network || null;
    const sanitizedMessage = message || null;

    const htmlName = escapeHtml(sanitizedName);
    const htmlPhone = escapeHtml(sanitizedPhone);
    const htmlRole = escapeHtml(sanitizedRole);
    const htmlEmail = sanitizedEmail ? escapeHtml(sanitizedEmail) : null;
    const htmlLocation = sanitizedLocation ? escapeHtml(sanitizedLocation) : null;
    const htmlNetwork = sanitizedNetwork ? escapeHtml(sanitizedNetwork) : null;
    const htmlMessage = sanitizedMessage ? escapeHtml(sanitizedMessage) : null;

    // ── 1. Save to DB ────────────────────────────────────────────────────────
    let applicationId: number | null = null;
    try {
      const result = await execute(
        `INSERT INTO career_applications
           (name, phone, email, role, location, network, message, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', UTC_TIMESTAMP())`,
        [sanitizedName, sanitizedPhone, sanitizedEmail, sanitizedRole, sanitizedLocation, sanitizedNetwork, sanitizedMessage],
      );
      applicationId = (result as { insertId?: number }).insertId ?? null;
    } catch (dbErr) {
      console.warn('[careers/apply] DB save failed (table may not exist yet):', dbErr);
    }

    // ── 2. Log server-side ───────────────────────────────────────────────────
    console.log(
      `[careers/apply] New application #${applicationId ?? '?'} — role: ${sanitizedRole} | name: ${sanitizedName} | phone: ${sanitizedPhone}` +
      ` | location: ${sanitizedLocation ?? '—'} | network: ${sanitizedNetwork ?? '—'} | email: ${sanitizedEmail ?? '—'}`,
    );

    // ── 3. Send email to careers@betcheza.co.ke via configured mailer ────────
    const to = process.env.CAREERS_EMAIL || 'careers@betcheza.co.ke';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.co.ke';

    await sendMail({
      to,
      subject: `🎯 New Agent Application — ${sanitizedRole} — ${sanitizedName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
    h1 { color: #1d4ed8; font-size: 20px; margin: 0 0 4px; }
    .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 600; margin-bottom: 24px; }
    .row { display: flex; margin-bottom: 12px; }
    .label { color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; width: 130px; flex-shrink: 0; padding-top: 2px; }
    .value { color: #111827; font-size: 14px; flex: 1; }
    .msg-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 4px; font-size: 13px; color: #374151; line-height: 1.5; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px; text-align: center; }
    .cta { display: inline-block; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>New Agent Application</h1>
    <span class="badge">${htmlRole}</span>
    <div class="row"><span class="label">Name</span><span class="value"><strong>${htmlName}</strong></span></div>
    <div class="row"><span class="label">Phone / WhatsApp</span><span class="value">${htmlPhone}</span></div>
    ${htmlEmail    ? `<div class="row"><span class="label">Email</span><span class="value">${htmlEmail}</span></div>` : ''}
    ${htmlLocation ? `<div class="row"><span class="label">Location</span><span class="value">${htmlLocation}</span></div>` : ''}
    ${htmlNetwork  ? `<div class="row"><span class="label">Network/Audience</span><span class="value">${htmlNetwork}</span></div>` : ''}
    ${htmlMessage  ? `<div class="row" style="flex-direction:column;"><span class="label" style="width:auto;margin-bottom:6px;">Message</span><div class="msg-box">${htmlMessage}</div></div>` : ''}
    ${applicationId ? `<a class="cta" href="${appUrl}/admin/careers">View in Admin Dashboard →</a>` : ''}
    <div class="footer">Betcheza Careers · Reply to this email or WhatsApp the applicant directly</div>
  </div>
</body>
</html>`,
      text: [
        `NEW BETCHEZA AGENT APPLICATION`,
        ``,
        `Role:              ${sanitizedRole}`,
        `Name:              ${sanitizedName}`,
        `Phone (WhatsApp):  ${sanitizedPhone}`,
        `Email:             ${sanitizedEmail ?? '—'}`,
        `Location:          ${sanitizedLocation ?? '—'}`,
        `Network/Audience:  ${sanitizedNetwork ?? '—'}`,
        ``,
        `Message:`,
        sanitizedMessage ?? '(none)',
        ``,
        `Application ID: #${applicationId ?? 'N/A'}`,
        `View: ${appUrl}/admin/careers`,
      ].join('\n'),
      replyTo: sanitizedEmail || undefined,
    });

    return NextResponse.json({ ok: true, applicationId });
  } catch (err) {
    console.error('[careers/apply] error:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

// No public GET on this route — admin listing is at /api/admin/careers
