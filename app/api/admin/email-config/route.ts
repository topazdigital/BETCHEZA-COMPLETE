import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getEmailConfig,
  saveEmailConfig,
  maskedConfig,
  type EmailConfig,
} from '@/lib/email-config-store';
import { verifyMailer, sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const cfg = await getEmailConfig();
    return NextResponse.json({ config: maskedConfig(cfg) });
  } catch (err) {
    console.error('[email-config GET]', err);
    return NextResponse.json({ error: 'Failed to load email configuration' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Partial<EmailConfig> & {
      action?: string;
      keepPassword?: boolean;
      passwordSet?: boolean;
      to?: string;
    };

    const { action } = body;

    if (action === 'save') {
      const patch: Partial<EmailConfig> = {
        enabled: body.enabled,
        host: body.host,
        port: typeof body.port === 'number' ? body.port : undefined,
        secure: body.secure,
        username: body.username,
        fromEmail: body.fromEmail,
        fromName: body.fromName,
        replyTo: body.replyTo,
      };

      if (!body.keepPassword) {
        patch.password = body.password ?? '';
      }

      const cleaned: Partial<EmailConfig> = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      ) as Partial<EmailConfig>;

      const saved = await saveEmailConfig(cleaned);
      return NextResponse.json({ config: maskedConfig(saved) });
    }

    if (action === 'verify') {
      const res = await verifyMailer();
      return NextResponse.json(res);
    }

    if (action === 'test') {
      const { to } = body;
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
  } catch (err) {
    console.error('[email-config POST]', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Partial<EmailConfig> & {
      keepPassword?: boolean;
      passwordSet?: boolean;
    };

    const patch: Partial<EmailConfig> = {
      enabled: body.enabled,
      host: body.host,
      port: typeof body.port === 'number' ? body.port : undefined,
      secure: body.secure,
      username: body.username,
      fromEmail: body.fromEmail,
      fromName: body.fromName,
      replyTo: body.replyTo,
    };

    if (!body.keepPassword) {
      patch.password = body.password ?? '';
    }

    const cleaned: Partial<EmailConfig> = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    ) as Partial<EmailConfig>;

    const saved = await saveEmailConfig(cleaned);
    return NextResponse.json({ config: maskedConfig(saved) });
  } catch (err) {
    console.error('[email-config PUT]', err);
    return NextResponse.json({ error: 'Failed to save email configuration' }, { status: 500 });
  }
}
