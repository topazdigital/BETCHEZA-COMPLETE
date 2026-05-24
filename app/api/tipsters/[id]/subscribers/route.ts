import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tipsterId = Number(id);
  if (user.userId !== tipsterId && user.role !== 'admin' && user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const res = await query<{
      subscriber_name: string;
      subscriber_username: string;
      subscriber_email: string;
      price: number;
      currency: string;
      status: string;
      created_at: string;
      expires_at: string;
    }>(
      `SELECT
         COALESCE(up.display_name, u.username) AS subscriber_name,
         u.username AS subscriber_username,
         u.email AS subscriber_email,
         ts.price,
         ts.currency,
         ts.status,
         ts.created_at,
         ts.expires_at
       FROM tipster_subscriptions ts
       JOIN users u ON u.id = ts.user_id
       LEFT JOIN user_profiles up ON up.user_id = ts.user_id
       WHERE ts.tipster_id = ?
       ORDER BY ts.created_at DESC
       LIMIT 200`,
      [tipsterId]
    );

    const subscribers = res.rows.map(row => ({
      name: row.subscriber_name || row.subscriber_username,
      username: row.subscriber_username,
      email: row.subscriber_email,
      price: Number(row.price),
      currency: row.currency,
      status: row.status,
      startDate: row.created_at,
      expiresAt: row.expires_at,
      daysLeft: Math.max(0, Math.ceil(
        (new Date(row.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )),
    }));

    return NextResponse.json({ subscribers });
  } catch (e) {
    console.error('[subscribers] DB error:', e);
    return NextResponse.json({ subscribers: [] });
  }
}
