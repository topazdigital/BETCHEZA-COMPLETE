import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { checkTransactionStatus, initiateStkPush } from '@/lib/payhero';
import { getBalance, debit } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';

const COST = 100;
const DAYS = 7;

interface AccessRecord { userId: number; paidAt: string; expiresAt: string; phone: string; reference: string }
export interface JackpotPendingPayment {
  userId: number;
  phone: string;
  reference: string;
  initiatedAt: string;
  providerReference?: string;
  checkoutRequestId?: string;
}

export function grantJackpotAccess(userId: number, phone: string, reference: string) {
  const now = new Date();
  const records = fileStoreGet<AccessRecord[]>('jackpot-access', []);
  fileStoreSet('jackpot-access', [
    ...records.filter(r => r.userId !== userId),
    { userId, phone, reference, paidAt: now.toISOString(), expiresAt: new Date(now.getTime() + DAYS * 86400000).toISOString() },
  ]);
  const pending = fileStoreGet<JackpotPendingPayment[]>('jackpot-pending', []);
  fileStoreSet('jackpot-pending', pending.filter(p => p.reference !== reference));
}

function accessFor(userId: number) {
  const record = fileStoreGet<AccessRecord[]>('jackpot-access', []).find(r => r.userId === userId);
  if (!record) return { hasAccess: false };
  const remaining = new Date(record.expiresAt).getTime() - Date.now();
  if (remaining <= 0) return { hasAccess: false, expiredAt: record.expiresAt };
  return { hasAccess: true, expiresAt: record.expiresAt, daysRemaining: Math.ceil(remaining / 86400000) };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ hasAccess: false, reason: 'not_logged_in' });
  if (user.role === 'admin') return NextResponse.json({ hasAccess: true, reason: 'admin' });

  const current = accessFor(user.userId);
  if (current.hasAccess) return NextResponse.json({ ...current, walletBalance: getBalance(user.userId, 'KES') });

  const pending = fileStoreGet<JackpotPendingPayment[]>('jackpot-pending', []);
  const mine = pending.find(p => p.userId === user.userId);
  if (mine && Date.now() - new Date(mine.initiatedAt).getTime() < 86400000) {
    const status = await checkTransactionStatus(mine.providerReference || mine.checkoutRequestId || mine.reference);
    if (status === 'completed') {
      grantJackpotAccess(user.userId, mine.phone, mine.reference);
      return NextResponse.json({ ...accessFor(user.userId), walletBalance: getBalance(user.userId, 'KES'), autoResolved: true });
    }
    if (status === 'pending') return NextResponse.json({ hasAccess: false, pendingReference: mine.reference, walletBalance: getBalance(user.userId, 'KES') });
    fileStoreSet('jackpot-pending', pending.filter(p => p.reference !== mine.reference));
  }
  return NextResponse.json({ ...current, walletBalance: getBalance(user.userId, 'KES') });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { action?: string; phone?: string; reference?: string };

  if (body.action === 'check' && body.reference) {
    const pending = fileStoreGet<JackpotPendingPayment[]>('jackpot-pending', []);
    const mine = pending.find(p => p.reference === body.reference);
    const status = await checkTransactionStatus(mine?.providerReference || mine?.checkoutRequestId || body.reference);
    if (status === 'completed') {
      const referenceUserId = Number(body.reference.match(/^JPT-(\d+)-\d+$/)?.[1] || 0);
      if (mine && mine.userId === user.userId) {
        grantJackpotAccess(mine.userId, mine.phone, mine.reference);
      } else if (referenceUserId === user.userId) {
        // Recover a successful payment if the pending file was lost during a
        // deploy or the provider callback was handled by another process.
        grantJackpotAccess(user.userId, 'mpesa', body.reference);
      }
    }
    if (status === 'failed' && mine) {
      fileStoreSet('jackpot-pending', pending.filter(p => p.reference !== mine.reference));
    }
    return NextResponse.json({ ...accessFor(user.userId), status });
  }

  if (body.action === 'wallet') {
    if (accessFor(user.userId).hasAccess) return NextResponse.json(accessFor(user.userId));
    if (getBalance(user.userId, 'KES') < COST) return NextResponse.json({ error: `You need at least KES ${COST} in your wallet.` }, { status: 402 });
    const result = debit(user.userId, COST, { type: 'adjustment', currency: 'KES', description: 'Jackpot picks unlock — 7 days', reference: `JPT-WALLET-${user.userId}-${Date.now()}` });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 402 });
    grantJackpotAccess(user.userId, 'wallet', result.txn.reference || 'wallet');
    return NextResponse.json({ ...accessFor(user.userId), paidVia: 'wallet', newBalance: result.newBalance });
  }

  const phone = String(body.phone || '').replace(/\s+/g, '');
  if (!phone) return NextResponse.json({ error: 'Enter your M-Pesa phone number.' }, { status: 400 });
  const reference = `JPT-${user.userId}-${Date.now()}`;
  const result = await initiateStkPush(COST, phone, reference);
  if (!result.ok) return NextResponse.json({ error: result.error || 'Payment initiation failed.' }, { status: 502 });
  const pending = fileStoreGet<JackpotPendingPayment[]>('jackpot-pending', []);
  fileStoreSet('jackpot-pending', [...pending.filter(p => p.userId !== user.userId), {
    userId: user.userId,
    phone,
    reference,
    initiatedAt: new Date().toISOString(),
    providerReference: result.providerReference,
    checkoutRequestId: result.checkoutRequestId,
  }]);
  return NextResponse.json({
    success: true,
    reference,
    checkoutRequestId: result.checkoutRequestId,
    message: 'M-Pesa prompt sent. Enter your PIN to unlock the final five games.',
  });
}