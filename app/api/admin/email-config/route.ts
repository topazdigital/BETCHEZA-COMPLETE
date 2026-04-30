import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getEmailConfig,
  saveEmailConfig,
  maskedConfig,
  type EmailConfig,
} from '@/lib/email-config-store';
import { verifyMailer, sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const cfg = await getEmailConfig();
  return NextResponse.json({ config: maskedConfig(cfg) });
}

export async function PUT(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Partial<EmailConfig> & {
    keepPassword?: boolean;
  };
  const patch: Partial<EmailConfig> = { ...body };
  delete (patch as { keepPassword?: boolean }).keepPassword;
  if (body.keepPassword) {
    delete patch.password;
  }
  const saved = await saveEmailConfig(patch);
  return NextResponse.json({ config: maskedConfig(saved) });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { action, to } = (await req.json().catch(() => ({}))) as {
    action?: 'verify' | 'test';
    to?: string;
  };
  if (action === 'verify') {
    const res = await verifyMailer();
    return NextResponse.json(res);
  }
  if (action === 'test') {
    if (!to) return NextResponse.json({ ok: false, error: 'recipient required' }, { status: 400 });
    const result = await sendMail({
      to,
      subject: 'Betcheza SMTP test',
      text: 'If you can read this, your Betcheza SMTP configuration is working.',
      html: `<p>If you can read this, your <strong>Betcheza</strong> SMTP configuration is working.</p>
             <p style="color:#888;font-size:12px">Sent from the Betcheza admin panel.</p>`,
    });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
