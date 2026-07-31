import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { query } from '@/lib/db';
import type { AccessRecord, PendingPayment } from '@/app/api/strategy/access/route';
import { grantStrategyAccess } from '@/app/api/strategy/access/route';

export const dynamic = 'force-dynamic';

export interface SubscriberRow {
  userId: number;
  email: string;
  username: string;
  displayName: string;
  phone: string;
  paidAt: string;
  expiresAt: string;
  daysRemaining: number;
  reference: string;
}

export interface PendingRow {
  userId: number;
  email: string;
  username: string;
  displayName: string;
  phone: string;
  reference: string;
  initiatedAt: string;
  checkoutRequestId?: string;
  walletContribution?: number;
  ageMinutes: number;
}

async function enrichWithUsers<T extends { userId: number }>(
  records: T[]
): Promise<Array<T & { email: string; username: string; displayName: string }>> {
  if (records.length === 0) return [];
  const ids = records.map(r => r.userId);
  const placeholders = ids.map(() => '?').join(',');

  let rows: Array<{ id: number; email: string; username: string; display_name: string | null }> = [];

  // Try with user_profiles join first, fall back to users-only if table missing
  try {
    const res = await query<{ id: number; email: string; username: string; display_name: string | null }>(
      `SELECT u.id, u.email, u.username, COALESCE(up.display_name, u.display_name, u.username) AS display_name
       FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id IN (${placeholders})`,
      ids
    );
    rows = res.rows;
  } catch {
    // user_profiles might not exist — try without join
    try {
      const res = await query<{ id: number; email: string; username: string; display_name: string | null }>(
        `SELECT id, email, username, display_name FROM users WHERE id IN (${placeholders})`,
        ids
      );
      rows = res.rows;
    } catch {
      // DB unavailable — return empty, caller will use fallback
      throw new Error('db_unavailable');
    }
  }

  const userMap = new Map(rows.map(u => [u.id, u]));
  return records.map(r => {
    const u = userMap.get(r.userId);
    return {
      ...r,
      email: u?.email || '',
      username: u?.username || String(r.userId),
      displayName: u?.display_name || u?.username || String(r.userId),
    };
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const accessRecords = fileStoreGet<AccessRecord[]>('strategy-access', []);
  const pendingRecords = fileStoreGet<PendingPayment[]>('strategy-pending', []);

  const activeRecords = accessRecords.filter(r => new Date(r.expiresAt).getTime() > now);
  const expiredRecords = accessRecords.filter(r => new Date(r.expiresAt).getTime() <= now);

  let active: SubscriberRow[] = [];
  let expired: SubscriberRow[] = [];
  let pending: PendingRow[] = [];

  try {
    const enrichedActive = await enrichWithUsers(activeRecords);
    active = enrichedActive.map(r => ({
      userId: r.userId,
      email: r.email,
      username: r.username,
      displayName: r.displayName,
      phone: r.phone,
      paidAt: r.paidAt,
      expiresAt: r.expiresAt,
      daysRemaining: Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - now) / 86400000)),
      reference: r.reference,
    }));

    const enrichedExpired = await enrichWithUsers(expiredRecords);
    expired = enrichedExpired.map(r => ({
      userId: r.userId,
      email: r.email,
      username: r.username,
      displayName: r.displayName,
      phone: r.phone,
      paidAt: r.paidAt,
      expiresAt: r.expiresAt,
      daysRemaining: 0,
      reference: r.reference,
    }));

    const enrichedPending = await enrichWithUsers(pendingRecords);
    pending = enrichedPending.map(r => ({
      userId: r.userId,
      email: r.email,
      username: r.username,
      displayName: r.displayName,
      phone: r.phone,
      reference: r.reference,
      initiatedAt: r.initiatedAt,
      checkoutRequestId: r.checkoutRequestId,
      walletContribution: r.walletContribution,
      ageMinutes: Math.floor((now - new Date(r.initiatedAt).getTime()) / 60000),
    }));
  } catch {
    // DB unavailable — return raw data without user enrichment
    active = activeRecords.map(r => ({
      userId: r.userId, email: '', username: String(r.userId), displayName: String(r.userId),
      phone: r.phone, paidAt: r.paidAt, expiresAt: r.expiresAt,
      daysRemaining: Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - now) / 86400000)),
      reference: r.reference,
    }));
    pending = pendingRecords.map(r => ({
      userId: r.userId, email: '', username: String(r.userId), displayName: String(r.userId),
      phone: r.phone, reference: r.reference, initiatedAt: r.initiatedAt,
      checkoutRequestId: r.checkoutRequestId, walletContribution: r.walletContribution,
      ageMinutes: Math.floor((now - new Date(r.initiatedAt).getTime()) / 60000),
    }));
  }

  return NextResponse.json({ active, expired, pending });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.action === 'grant') {
    const { userId, phone, reference } = body;
    if (!userId || !phone || !reference) {
      return NextResponse.json({ error: 'userId, phone, and reference are required' }, { status: 400 });
    }
    grantStrategyAccess(Number(userId), String(phone), String(reference));
    return NextResponse.json({ success: true });
  }

  if (body.action === 'revoke') {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    const records = fileStoreGet<AccessRecord[]>('strategy-access', []);
    fileStoreSet('strategy-access', records.filter(r => r.userId !== Number(userId)));
    return NextResponse.json({ success: true });
  }

  if (body.action === 'dismiss_pending') {
    const { reference } = body;
    if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 });
    const pending = fileStoreGet<PendingPayment[]>('strategy-pending', []);
    fileStoreSet('strategy-pending', pending.filter(p => p.reference !== reference));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
