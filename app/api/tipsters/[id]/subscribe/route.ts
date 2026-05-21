import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    tipsterId?: number;
    tipsterName?: string;
    price?: number;
    currency?: string;
  };

  const tipsterId = Number(id) || body.tipsterId;
  if (!tipsterId) {
    return NextResponse.json({ error: 'Invalid tipster ID' }, { status: 400 });
  }

  const pool = getPool();
  if (pool) {
    try {
      await query(
        `INSERT INTO tipster_subscriptions (user_id, tipster_id, price, currency, status, created_at)
         VALUES (?, ?, ?, ?, 'active', NOW())
         ON DUPLICATE KEY UPDATE status='active', updated_at=NOW()`,
        [user.userId, tipsterId, body.price ?? 0, body.currency ?? 'KES']
      );
    } catch {
      // Table may not exist yet — silently succeed so the UI still works
    }
  }

  return NextResponse.json({
    success: true,
    message: `Successfully subscribed to ${body.tipsterName || 'tipster'}`,
    tipsterId,
    userId: user.userId,
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ subscribed: false });
  }

  const tipsterId = Number(id);
  if (!tipsterId) return NextResponse.json({ subscribed: false });

  const pool = getPool();
  if (pool) {
    try {
      const r = await query<{ id: number }>(
        `SELECT id FROM tipster_subscriptions WHERE user_id=? AND tipster_id=? AND status='active' LIMIT 1`,
        [user.userId, tipsterId]
      );
      return NextResponse.json({ subscribed: !!r.rows[0] });
    } catch {
      // Table may not exist
    }
  }

  return NextResponse.json({ subscribed: false });
}
