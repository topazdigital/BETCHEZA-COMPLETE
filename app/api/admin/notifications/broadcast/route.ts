import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import {
  createNotification,
  listEmailSubscribers,
  listPushSubscriptions,
  listAllUserIds,
} from '@/lib/notification-store';
import { sendBulkMailBatched, renderTemplate } from '@/lib/mailer';
import { getTemplate } from '@/lib/email-templates-store';

export const dynamic = 'force-dynamic';

interface BroadcastBody {
  title: string;
  body: string;
  link?: string;
  audience?: 'all' | 'push' | 'email';
  /** Optional batching overrides for very large lists. */
  batchSize?: number;
  perEmailDelayMs?: number;
  perBatchDelayMs?: number;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = (await req.json().catch(() => ({}))) as Partial<BroadcastBody>;
  const title = (data.title || '').trim();
  const body = (data.body || '').trim();
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
  }
  const audience = data.audience ?? 'all';

  let count = 0;

  // In-app notifications for ALL registered users
  if (audience === 'all' || audience === 'push') {
    // Get all registered user IDs (falls back to push-subscriber user IDs when no DB)
    const allUserIds = await listAllUserIds();
    // Also include any push-subscriber user IDs not already in the list
    const pushSubs = await listPushSubscriptions();
    const pushUserIds = pushSubs.map((s) => s.userId).filter((id): id is number => !!id);
    const userIds = Array.from(new Set([...allUserIds, ...pushUserIds]));
    for (const uid of userIds) {
      await createNotification({
        userId: uid,
        type: 'admin_broadcast',
        title,
        content: body,
        link: data.link ?? null,
        channel: 'inapp',
      });
      count++;
    }
  }

  let emailResult: { sent: number; failed: number; skipped?: boolean; total?: number } | null = null;
  if (audience === 'all' || audience === 'email') {
    const emailSubs = (await listEmailSubscribers()).filter((s) => s.active);
    const recipients = emailSubs.map((s) => s.email);

    // Render the broadcast through the editable template; fall back to the
    // legacy hand-coded HTML when the template is empty.
    const tpl = getTemplate('broadcast');
    const baseVars = {
      subject: title,
      heading: title,
      body: escapeHtml(body).replace(/\n/g, '<br/>'),
      siteUrl: (process.env.NEXT_PUBLIC_APP_URL || 'https://betcheza.com').replace(/\/$/, ''),
      name: 'there',
      email: '',
    };
    const renderedSubject = renderTemplate(tpl.subject || title, baseVars) || title;
    const renderedHtml =
      renderTemplate(tpl.html, baseVars) ||
      `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;color:#111">
        <h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(title)}</h1>
        <div style="font-size:15px;line-height:1.5;color:#333">${baseVars.body}</div>
        ${data.link ? `<p style="margin-top:24px"><a href="${escapeAttr(data.link)}" style="background:#10B981;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Open</a></p>` : ''}
        <hr style="margin:32px 0;border:none;border-top:1px solid #eee"/>
        <p style="font-size:11px;color:#999">You received this because you subscribed to Betcheza updates.</p>
      </div>`;
    const renderedText = renderTemplate(tpl.text, baseVars) || body;

    emailResult = await sendBulkMailBatched(
      recipients,
      renderedSubject,
      renderedHtml,
      renderedText,
      {
        batchSize: data.batchSize ?? 25,
        perEmailDelayMs: data.perEmailDelayMs ?? 80,
        perBatchDelayMs: data.perBatchDelayMs ?? 1500,
      },
    );
    count += emailResult.sent;
  }

  return NextResponse.json({ ok: true, count, audience, email: emailResult });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
