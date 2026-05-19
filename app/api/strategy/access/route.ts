import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { initiateStkPush, checkTransactionStatus } from '@/lib/payhero';

export const dynamic = 'force-dynamic';

export interface AccessRecord {
  userId: number;
  paidAt: string;
  phone: string;
  reference: string;
}

export interface PendingPayment {
  userId: number;
  phone: string;
  reference: string;
  initiatedAt: string;
  checkoutRequestId?: string;
}

export function grantStrategyAccess(userId: number, phone: string, reference: string) {
  const records = fileStoreGet<AccessRecord[]>('strategy-access', []);
  if (!records.find(r => r.userId === userId)) {
    records.push({ userId, paidAt: new Date().toISOString(), phone, reference });
    fileStoreSet('strategy-access', records);
  }
  const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
  fileStoreSet('strategy-pending', pending.filter(p => p.reference !== reference));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ hasAccess: false, reason: 'not_logged_in' });

  if (user.role === 'admin' || user.role === 'super_admin') {
    return NextResponse.json({ hasAccess: true, reason: 'admin' });
  }

  const records = fileStoreGet<AccessRecord[]>('strategy-access', []);
  if (records.find(r => r.userId === user.userId)) {
    return NextResponse.json({ hasAccess: true });
  }
  return NextResponse.json({ hasAccess: false });
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
      return NextResponse.json({ hasAccess: true, status });
    }
    return NextResponse.json({ hasAccess: false, status });
  }

  // Grant manually (from callback)
  if (body.action === 'grant' && body.reference) {
    const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
    const p = pending.find(x => x.reference === body.reference);
    if (p) grantStrategyAccess(p.userId, p.phone, p.reference!);
    return NextResponse.json({ success: true });
  }

  // Check already has access
  const records = fileStoreGet<AccessRecord[]>('strategy-access', []);
  if (records.find(r => r.userId === user.userId)) {
    return NextResponse.json({ hasAccess: true });
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
  const filtered = pending.filter(p => p.userId !== user.userId);
  filtered.push({ userId: user.userId, phone: rawPhone, reference, initiatedAt: new Date().toISOString(), checkoutRequestId: result.checkoutRequestId });
  fileStoreSet('strategy-pending', filtered);

  return NextResponse.json({
    success: true,
    reference,
    message: 'STK push sent. Enter your M-Pesa PIN to complete payment.',
  });
}
