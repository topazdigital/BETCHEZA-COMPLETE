import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, role, email, location, network, message } = body;

    if (!name || !phone || !role) {
      return NextResponse.json({ ok: false, error: 'Name, phone and role are required.' }, { status: 400 });
    }

    // Log the application server-side (persists in workflow logs for admin review)
    console.log(`[careers/apply] New application — role: ${role} | name: ${name} | phone: ${phone} | location: ${location || '—'} | network: ${network || '—'} | email: ${email || '—'} | message: ${message || '—'}`);

    // Try to notify via email if SMTP is configured
    let emailSent = false;
    try {
      const nodemailer = await import('nodemailer');
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587');
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const to = process.env.CAREERS_EMAIL || process.env.ADMIN_EMAIL || 'careers@betcheza.co.ke';

      if (host && user && pass) {
        const transporter = nodemailer.default.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
        await transporter.sendMail({
          from: `"Betcheza Careers" <${user}>`,
          to,
          subject: `New Agent Application — ${role} — ${name}`,
          text: [
            `NEW BETCHEZA AGENT APPLICATION`,
            ``,
            `Role: ${role}`,
            `Name: ${name}`,
            `Phone (WhatsApp): ${phone}`,
            `Email: ${email || '—'}`,
            `Location: ${location || '—'}`,
            `Network / audience: ${network || '—'}`,
            ``,
            `Message:`,
            message || '(none)',
          ].join('\n'),
        });
        emailSent = true;
      }
    } catch {
      // SMTP not configured — application is still logged above
    }

    return NextResponse.json({ ok: true, emailSent });
  } catch (err) {
    console.error('[careers/apply] error:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
