import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { hasPermission } from '@/lib/permissions';
import { setUserRoleOverride } from '@/lib/user-role-overrides';
import {
  getApplication,
  reviewApplication,
} from '@/lib/tipster-applications-store';
import { getTemplate as getEmailTemplate } from '@/lib/email-templates-store';
import { renderTemplate, sendMail } from '@/lib/mailer';
import { mockUsers } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx { params: Promise<{ id: string }> }

/**
 * PATCH { decision: 'approve' | 'reject', note?, grantVerified? }
 *
 * Admin (or anyone with admin.users.role permission) approves or rejects an
 * application. Approval flips the user's role to `tipster` immediately.
 */
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

  // On approval — promote the user's role so they can post tips immediately.
  if (decision === 'approve') {
    setUserRoleOverride(updated.userId, 'tipster');
  }

  // ─── Notify the applicant by email — best effort, never blocks the response. ──
  try {
    const recipient =
      updated.email ||
      existing.email ||
      mockUsers.find(u => u.id === updated.userId || u.username === updated.username)?.email;

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

      await sendMail({ to: recipient, subject, html, text });
    }
  } catch (err) {
    console.warn('[tipster-applications] notification email failed:', err);
  }

  return NextResponse.json({ application: updated });
}
