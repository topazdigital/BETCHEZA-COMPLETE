import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'all';
  const search = url.searchParams.get('search') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status !== 'all') {
    conditions.push('ts.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(sub.username LIKE ? OR sub.email LIKE ? OR tip.username LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM tipster_subscriptions ts
     JOIN users sub ON sub.id = ts.user_id
     JOIN users tip ON tip.id = ts.tipster_id
     ${where}`,
    params,
  );
  const total = countRes.rows[0]?.total ?? 0;

  const rows = await query<{
    id: number;
    subscriber_name: string;
    subscriber_username: string;
    subscriber_email: string;
    tipster_name: string;
    tipster_username: string;
    price: number;
    currency: string;
    status: string;
    created_at: string;
    expires_at: string;
  }>(
    `SELECT ts.id,
            COALESCE(sp.display_name, sub.username) AS subscriber_name,
            sub.username                             AS subscriber_username,
            sub.email                               AS subscriber_email,
            COALESCE(tp.display_name, tip.username) AS tipster_name,
            tip.username                            AS tipster_username,
            ts.price,
            ts.currency,
            ts.status,
            ts.created_at,
            ts.expires_at
     FROM tipster_subscriptions ts
     JOIN users sub ON sub.id = ts.user_id
     LEFT JOIN user_profiles sp ON sp.user_id = ts.user_id
     JOIN users tip ON tip.id = ts.tipster_id
     LEFT JOIN user_profiles tp ON tp.user_id = ts.tipster_id
     ${where}
     ORDER BY ts.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return NextResponse.json({
    subscriptions: rows.rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
