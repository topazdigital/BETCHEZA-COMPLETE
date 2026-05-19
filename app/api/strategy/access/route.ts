import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { initiateStkPush, checkTransactionStatus } from '@/lib/payhero';

export const dynamic = 'force-dynamic';

const SUBSCRIPTION_DAYS = 7;

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
}

function getWeekDayOfPlan(): number {
  // Returns 0-6 where 0 = Monday, 6 = Sunday (matching the 7-day plan)
  const d = new Date().getDay(); // 0=Sun,1=Mon...6=Sat
  return d === 0 ? 6 : d - 1;
}

export function grantStrategyAccess(userId: number, phone: string, reference: string) {
  const records = fileStoreGet<AccessRecord[]>('strategy-access', []);
  const now = new Date();
  const expires = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
  const startDayOffset = getWeekDayOfPlan();

  // Remove existing record (renewal replaces old)
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
    return NextResponse.json({ hasAccess: true, reason: 'admin', startDayOffset: 0, daysRemaining: 7 });
  }

  const result = checkStrategyAccess(user.userId);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    phone?: string;
    action?: string;
    reference?: string;
  };

  // Check payment status by reference
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

  // Grant manually (from callback/webhook)
  if (body.action === 'grant' && body.reference) {
    const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
    const p = pending.find(x => x.reference === body.reference);
    if (p) grantStrategyAccess(p.userId, p.phone, p.reference!);
    return NextResponse.json({ success: true });
  }

  // Check already has active access
  const existing = checkStrategyAccess(user.userId);
  if (existing.hasAccess) {
    return NextResponse.json({ hasAccess: true, ...existing });
  }

  // Initiate STK push
  const rawPhone = String(body.phone || '').replace(/\s+/g, '');
  if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const reference = `STRAT-${user.userId}-${Date.now()}`;
  const result = await initiateStkPush(5000, rawPhone, reference);

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
