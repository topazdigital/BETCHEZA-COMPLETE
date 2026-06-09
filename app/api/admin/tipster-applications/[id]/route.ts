import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { setUserRoleOverride } from '@/lib/user-role-overrides';
import {
  getApplication,
  reviewApplication,
  markApplicationEmailSent,
} from '@/lib/tipster-applications-store';
import { getTemplate as getEmailTemplate } from '@/lib/email-templates-store';
import { renderTemplate, sendMail } from '@/lib/mailer';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.role')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'reject' ? 'reject' : null;
  if (!decision) {
    return NextResponse.json({ error: 'invalid decision' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note : undefined;
  const grantVerified = !!body.grantVerified;

  const existing = await getApplication(id);
  if (!existing) {
    return NextResponse.json({ error: 'application not found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: `Application is already ${existing.status}.` },
      { status: 400 },
    );
  }

  const updated = await reviewApplication(id, {
    reviewerId: me.userId,
    decision,
    note,
    grantVerified,
  });
  if (!updated) {
    return NextResponse.json({ error: 'review failed' }, { status: 500 });
  }

  if (decision === 'approve') {
    setUserRoleOverride(updated.userId, 'tipster');
  }

  // Notify applicant by email — best effort, never blocks the response.
  try {
    // Prefer email from the application record, fall back to DB lookup
    let recipient = updated.email || existing.email;
    if (!recipient) {
      const dbUser = await queryOne<{ email: string }>(
        'SELECT email FROM users WHERE id = ? LIMIT 1',
        [updated.userId]
      );
      recipient = dbUser?.email;
    }

    if (recipient) {
      const tplKey = decision === 'approve' ? 'tipster_approved' : 'tipster_rejected';
      const tpl = getEmailTemplate(tplKey);
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host') || 'localhost:5000';
      const siteUrl = `${proto}://${host}`;
      const noteBlock = note
        ? (tpl.html.includes('<')
            ? `<blockquote style="border-left:3px solid #10B981;padding-left:12px;color:#475569;margin:16px 0">${note}</blockquote>`
            : `Note from the team: ${note}\n\n`)
        : '';
      const noteBlockText = note ? `Note from the team: ${note}\n\n` : '';
      const verifiedLine = decision === 'approve' && grantVerified ? ' with the verified badge' : '';

      const subject = renderTemplate(tpl.subject, { name: updated.displayName || updated.username });
      const html = renderTemplate(tpl.html, {
        name: updated.displayName || updated.username,
        siteUrl,
        verifiedLine,
        noteBlock,
      });
      const text = renderTemplate(tpl.text, {
        name: updated.displayName || updated.username,
        siteUrl,
        verifiedLine,
        noteBlock: noteBlockText,
      });

      const mailResult = await sendMail({ to: recipient, subject, html, text });
      await markApplicationEmailSent(updated.id, mailResult.ok === true);
    }
  } catch (err) {
    console.warn('[tipster-applications] notification email failed:', err);
    await markApplicationEmailSent(updated.id, false).catch(() => {});
  }

  return NextResponse.json({ application: updated });
}
