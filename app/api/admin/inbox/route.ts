import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import { fetchInboxEmails, markEmailSeen, invalidateImapCache } from '@/lib/imap-client';

export const dynamic = 'force-dynamic';

async function guard() {
  try {
    const u = await getCurrentUser();
    return !!(u && canAccessAdmin(u.role));
  } catch { return false; }
}

// GET — fetch inbox (all accounts)
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const result = await fetchInboxEmails(60);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[admin/inbox]', e?.message);
    return NextResponse.json({ error: e?.message || 'IMAP error', emails: [], accounts: [], errors: [] }, { status: 500 });
  }
}

// PATCH — mark as seen
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { uid, account } = await req.json();
    await markEmailSeen(uid, account || 'partnerships');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// DELETE — bust cache
export async function DELETE() {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  invalidateImapCache();
  return NextResponse.json({ ok: true });
}
