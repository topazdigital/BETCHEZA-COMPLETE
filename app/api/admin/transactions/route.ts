import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllTxns, WalletTxnType, WalletTxnStatus } from '@/lib/wallet-store';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(200, parseInt(sp.get('limit') || '50', 10));
  const type = (sp.get('type') || '') as WalletTxnType | '';
  const status = (sp.get('status') || '') as WalletTxnStatus | '';
  const method = sp.get('method') || '';
  const search = (sp.get('search') || '').toLowerCase();

  const { txns: allTxns, total: grandTotal } = getAllTxns({ limit: 10000, offset: 0 });

  // Enrich with usernames from DB
  const userIds = [...new Set(allTxns.map((t) => t.userId))];
  const userMap: Record<number, string> = {};
  if (userIds.length > 0) {
    try {
      const placeholders = userIds.map(() => '?').join(',');
      const result = await query<{ id: number; username: string }>(
        `SELECT id, username FROM users WHERE id IN (${placeholders})`,
        userIds,
      );
      for (const row of result.rows || []) userMap[row.id] = row.username;
    } catch { /* no DB — skip */ }
  }

  // Apply filters
  let filtered = allTxns;
  if (type) filtered = filtered.filter((t) => t.type === type);
  if (status) filtered = filtered.filter((t) => t.status === status);
  if (method) filtered = filtered.filter((t) => t.method === method);
  if (search) {
    filtered = filtered.filter(
      (t) =>
        t.id.toLowerCase().includes(search) ||
        (t.reference || '').toLowerCase().includes(search) ||
        (t.description || '').toLowerCase().includes(search) ||
        (userMap[t.userId] || '').toLowerCase().includes(search) ||
        String(t.userId).includes(search),
    );
  }

  const filteredTotal = filtered.length;
  const offset = (page - 1) * limit;
  const pageTxns = filtered.slice(offset, offset + limit).map((t) => ({
    ...t,
    username: userMap[t.userId] || null,
  }));

  // Summary stats (always from unfiltered full set)
  const completedDeposits = allTxns.filter((t) => t.type === 'deposit' && t.status === 'completed');
  const completedWithdrawals = allTxns.filter((t) => t.type === 'withdraw' && t.status === 'completed');
  const mpesaTxns = allTxns.filter((t) => t.method === 'mpesa');
  const pendingTxns = allTxns.filter((t) => t.status === 'pending');

  return NextResponse.json({
    txns: pageTxns,
    total: filteredTotal,
    page,
    limit,
    pages: Math.ceil(filteredTotal / limit),
    stats: {
      grandTotal,
      totalDeposited: completedDeposits.reduce((s, t) => s + t.amount, 0),
      totalWithdrawn: Math.abs(completedWithdrawals.reduce((s, t) => s + t.amount, 0)),
      mpesaCount: mpesaTxns.length,
      pendingCount: pendingTxns.length,
    },
  });
}
