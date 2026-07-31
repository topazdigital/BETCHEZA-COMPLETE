import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { execute, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, role, email, location, network, message } = body;

    if (!name || !phone || !role) {
      return NextResponse.json({ ok: false, error: 'Name, phone and role are required.' }, { status: 400 });
    }

    const sanitizedName    = String(name).trim().slice(0, 200);
    const sanitizedPhone   = String(phone).trim().slice(0, 30);
    const sanitizedRole    = String(role).trim().slice(0, 100);
    const sanitizedEmail   = email   ? String(email).trim().slice(0, 200)   : null;
    const sanitizedLocation = location ? String(location).trim().slice(0, 200) : null;
    const sanitizedNetwork  = network  ? String(network).trim().slice(0, 500)  : null;
    const sanitizedMessage  = message  ? String(message).trim().slice(0, 2000) : null;

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
    <span class="badge">${sanitizedRole}</span>
    <div class="row"><span class="label">Name</span><span class="value"><strong>${sanitizedName}</strong></span></div>
    <div class="row"><span class="label">Phone / WhatsApp</span><span class="value">${sanitizedPhone}</span></div>
    ${sanitizedEmail    ? `<div class="row"><span class="label">Email</span><span class="value">${sanitizedEmail}</span></div>` : ''}
    ${sanitizedLocation ? `<div class="row"><span class="label">Location</span><span class="value">${sanitizedLocation}</span></div>` : ''}
    ${sanitizedNetwork  ? `<div class="row"><span class="label">Network/Audience</span><span class="value">${sanitizedNetwork}</span></div>` : ''}
    ${sanitizedMessage  ? `<div class="row" style="flex-direction:column;"><span class="label" style="width:auto;margin-bottom:6px;">Message</span><div class="msg-box">${sanitizedMessage}</div></div>` : ''}
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
