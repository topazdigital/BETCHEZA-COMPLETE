import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { initiateStkPush, checkTransactionStatus } from '@/lib/payhero';
import { getBalance, debit } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';

const SUBSCRIPTION_DAYS = 7;
const SUBSCRIPTION_COST = 5000;

export interface AccessRecord {
  userId: number;
  paidAt: string;
  expiresAt: string;
  phone: string;
  reference: string;
  /** Day-of-week (0=Mon…6=Sun) the user started on, used to align their personal plan */
  startDayOffset: number;
}

export interface PendingPayment {
  userId: number;
  phone: string;
  reference: string;
  initiatedAt: string;
  checkoutRequestId?: string;
  /** If partial wallet was used, how much was covered */
  walletContribution?: number;
}

function getWeekDayOfPlan(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

export function grantStrategyAccess(userId: number, phone: string, reference: string) {
  const records = fileStoreGet<AccessRecord[]>('strategy-access', []);
  const now = new Date();
  const expires = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
  const startDayOffset = getWeekDayOfPlan();

  const filtered = records.filter(r => r.userId !== userId);
  filtered.push({
    userId,
    paidAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    phone,
    reference,
    startDayOffset,
  });
  fileStoreSet('strategy-access', filtered);

  const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
  fileStoreSet('strategy-pending', pending.filter(p => p.reference !== reference));
}

export function checkStrategyAccess(userId: number): {
  hasAccess: boolean;
  expiresAt?: string;
  startDayOffset?: number;
  daysRemaining?: number;
} {
  const records = fileStoreGet<AccessRecord[]>('strategy-access', []);
  const record = records.find(r => r.userId === userId);
  if (!record) return { hasAccess: false };

  const now = Date.now();
  const expiry = new Date(record.expiresAt).getTime();
  if (now > expiry) return { hasAccess: false };

  const daysRemaining = Math.ceil((expiry - now) / (24 * 60 * 60 * 1000));
  return {
    hasAccess: true,
    expiresAt: record.expiresAt,
    startDayOffset: record.startDayOffset ?? 0,
    daysRemaining,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ hasAccess: false, reason: 'not_logged_in' });

  if (user.role === 'admin' || user.role === 'super_admin') {
    return NextResponse.json({ hasAccess: true, reason: 'admin', startDayOffset: 0, daysRemaining: 7, walletBalance: 0 });
  }

  const result = checkStrategyAccess(user.userId);
  const walletBalance = getBalance(user.userId, 'KES');
  return NextResponse.json({ ...result, walletBalance });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    phone?: string;
    action?: string;
    reference?: string;
  };

  // ── Check payment status by reference ──────────────────────────────────
  if (body.action === 'check' && body.reference) {
    const status = await checkTransactionStatus(body.reference);
    if (status === 'completed') {
      const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
      const p = pending.find(x => x.reference === body.reference);
      if (p) grantStrategyAccess(p.userId, p.phone, p.reference!);
      const access = checkStrategyAccess(user.userId);
      return NextResponse.json({ hasAccess: true, status, ...access });
    }
    return NextResponse.json({ hasAccess: false, status });
  }

  // ── Grant manually (from callback/webhook) ──────────────────────────────
  if (body.action === 'grant' && body.reference) {
    const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
    const p = pending.find(x => x.reference === body.reference);
    if (p) grantStrategyAccess(p.userId, p.phone, p.reference!);
    return NextResponse.json({ success: true });
  }

  // ── Pay using wallet balance ────────────────────────────────────────────
  if (body.action === 'wallet') {
    const existing = checkStrategyAccess(user.userId);
    if (existing.hasAccess) return NextResponse.json({ hasAccess: true, ...existing });

    const balance = getBalance(user.userId, 'KES');

    if (balance >= SUBSCRIPTION_COST) {
      // Full wallet payment — deduct and grant immediately
      const result = debit(user.userId, SUBSCRIPTION_COST, {
        type: 'adjustment',
        currency: 'KES',
        description: '3 Daily Odds Strategy — 7-day subscription',
        reference: `STRAT-WALLET-${user.userId}-${Date.now()}`,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 402 });
      }
      grantStrategyAccess(user.userId, 'wallet', result.txn.reference || 'wallet');
      const access = checkStrategyAccess(user.userId);
      return NextResponse.json({ hasAccess: true, paidVia: 'wallet', newBalance: result.newBalance, ...access });
    }

    // Partial wallet payment — deduct available balance and top up the rest via M-Pesa
    const topUpAmount = SUBSCRIPTION_COST - balance;
    const rawPhone = String(body.phone || '').replace(/\s+/g, '');
    if (!rawPhone) {
      // No phone provided yet — return how much top-up is needed so UI can prompt
      return NextResponse.json({
        needsTopUp: true,
        walletBalance: balance,
        topUpAmount,
        message: `Your wallet covers KES ${balance.toLocaleString()}. Pay the remaining KES ${topUpAmount.toLocaleString()} via M-Pesa to complete your subscription.`,
      });
    }

    // Deduct whatever is in the wallet first
    let walletContribution = 0;
    if (balance > 0) {
      const walletResult = debit(user.userId, balance, {
        type: 'adjustment',
        currency: 'KES',
        description: `3 Daily Odds Strategy — partial wallet payment (KES ${topUpAmount.toLocaleString()} M-Pesa top-up pending)`,
        reference: `STRAT-PARTIAL-${user.userId}-${Date.now()}`,
      });
      if (walletResult.ok) walletContribution = balance;
    }

    // Initiate STK push for the remaining amount
    const reference = `STRAT-TOPUP-${user.userId}-${Date.now()}`;
    const stkResult = await initiateStkPush(topUpAmount, rawPhone, reference);

    if (!stkResult.ok) {
      // Refund the wallet portion since STK failed
      if (walletContribution > 0) {
        const { credit } = await import('@/lib/wallet-store');
        credit(user.userId, walletContribution, {
          type: 'refund',
          currency: 'KES',
          description: 'Refund — M-Pesa top-up failed for 3 Daily Odds Strategy',
        });
      }
      return NextResponse.json({ error: stkResult.error || 'Payment initiation failed' }, { status: 502 });
    }

    const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
    const filteredPending = pending.filter(p => p.userId !== user.userId);
    filteredPending.push({
      userId: user.userId,
      phone: rawPhone,
      reference,
      initiatedAt: new Date().toISOString(),
      checkoutRequestId: stkResult.checkoutRequestId,
      walletContribution,
    });
    fileStoreSet('strategy-pending', filteredPending);

    return NextResponse.json({
      success: true,
      reference,
      topUpAmount,
      walletContribution,
      message: `STK push sent for KES ${topUpAmount.toLocaleString()}. Enter your M-Pesa PIN to complete.`,
    });
  }

  // ── Check already has active access ────────────────────────────────────
  const existing = checkStrategyAccess(user.userId);
  if (existing.hasAccess) {
    return NextResponse.json({ hasAccess: true, ...existing });
  }

  // ── Initiate full STK push via M-Pesa ──────────────────────────────────
  const rawPhone = String(body.phone || '').replace(/\s+/g, '');
  if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const reference = `STRAT-${user.userId}-${Date.now()}`;
  const result = await initiateStkPush(SUBSCRIPTION_COST, rawPhone, reference);

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Payment initiation failed' }, { status: 502 });
  }

  const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
  const filteredPending = pending.filter(p => p.userId !== user.userId);
  filteredPending.push({
    userId: user.userId,
    phone: rawPhone,
    reference,
    initiatedAt: new Date().toISOString(),
    checkoutRequestId: result.checkoutRequestId,
  });
  fileStoreSet('strategy-pending', filteredPending);

  return NextResponse.json({
    success: true,
    reference,
    message: 'STK push sent. Enter your M-Pesa PIN to complete payment.',
  });
}
