import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllTxns } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const type = searchParams.get('type') || undefined;
  const status = searchParams.get('status') || undefined;

  const offset = (page - 1) * limit;
  const { txns, total } = getAllTxns({
    limit,
    offset,
    type: type as never,
    status: status as never,
  });

  return NextResponse.json({
    transactions: txns,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
