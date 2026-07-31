import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { credit, debit, getWallet } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }
  const userId = Number(new URL(request.url).searchParams.get('userId'));
  if (!userId) return NextResponse.json({ success: false, error: 'missing userId' }, { status: 400 });
  const wallet = getWallet(userId);
  return NextResponse.json({ success: true, balance: wallet.balances.KES ?? 0, balances: wallet.balances });
}

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const userId = Number(body.userId);
  const amount = Number(body.amount);
  const direction = String(body.direction || 'credit'); // 'credit' | 'debit'
  const note = String(body.note || '').trim().slice(0, 200);

  if (!userId || isNaN(userId)) return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
  if (!amount || amount <= 0 || isNaN(amount)) return NextResponse.json({ success: false, error: 'Amount must be a positive number' }, { status: 400 });

  const description = note || `Admin manual ${direction} by ${me.username || 'admin'}`;

  if (direction === 'debit') {
    const result = debit(userId, amount, {
      type: 'adjustment',
      currency: 'KES',
      method: 'admin',
      description,
      meta: { adminId: me.id, adminUsername: me.username },
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, newBalance: result.newBalance, txn: result.txn });
  } else {
    const txn = credit(userId, amount, {
      type: 'adjustment',
      currency: 'KES',
      method: 'admin',
      description,
      meta: { adminId: me.id, adminUsername: me.username },
    });
    const wallet = getWallet(userId);
    return NextResponse.json({ success: true, newBalance: wallet.balances.KES ?? 0, txn });
  }
}
