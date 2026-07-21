/**
 * POST /api/paystack/verify
 *
 * Polls verifyTransaction for a reference that was returned as { needsPoll: true }.
 * If confirmed → performs the action and returns { success: true }.
 * If still pending → returns { pending: true }.
 * If failed → returns { error: '...' }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { verifyTransaction } from '@/lib/paystack';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { performAction, PendingCardPayment } from '@/app/api/paystack/charge/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let reference: string;
  try {
    ({ reference } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!reference) {
    return NextResponse.json({ error: 'reference required.' }, { status: 400 });
  }

  // Find the pending record for this user + reference
  const pending = fileStoreGet<PendingCardPayment[]>('card-pending', []);
  const record = pending.find(p => p.userId === user.userId && p.reference === reference);
  if (!record) {
    return NextResponse.json({ error: 'No pending payment found for this reference.' }, { status: 404 });
  }

  const v = await verifyTransaction(reference);

  if (v.ok && v.status === 'success') {
    // Remove from pending store
    fileStoreSet('card-pending', pending.filter(p => p.reference !== reference));
    return performAction({
      userId: record.userId,
      purpose: record.purpose,
      amount: record.amount,
      reference,
      email: record.email,
      meta: record.meta as { competitionName?: string; competitionSlug?: string; currency?: string },
    });
  }

  if (v.status === 'failed') {
    fileStoreSet('card-pending', pending.filter(p => p.reference !== reference));
    return NextResponse.json({ error: 'Your card was declined by the bank.' }, { status: 402 });
  }

  return NextResponse.json({ pending: true });
}
