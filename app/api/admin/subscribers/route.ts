import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import { getPool } from '@/lib/db';
import { listEmailSubscribers } from '@/lib/notification-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Query ALL subscribers (active + unsubscribed) with full field set
  try {
    const pool = await getPool();
    if (pool) {
      const [rows] = await pool.query<any[]>(`
        SELECT
          id,
          email,
          user_id,
          source,
          topics,
          is_verified,
          unsubscribed_at,
          created_at,
          active
        FROM email_subscribers
        ORDER BY created_at DESC
        LIMIT 5000
      `);

      const subscribers = rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        userId: r.user_id ?? null,
        source: r.source ?? null,
        topics: typeof r.topics === 'string'
          ? (r.topics ? JSON.parse(r.topics) : [])
          : (Array.isArray(r.topics) ? r.topics : []),
        isVerified: !!r.is_verified,
        unsubscribedAt: r.unsubscribed_at
          ? new Date(r.unsubscribed_at).toISOString()
          : (!r.active ? new Date(0).toISOString() : null),
        createdAt: r.created_at
          ? new Date(r.created_at).toISOString()
          : null,
        active: !!r.active,
      }));

      return NextResponse.json({ subscribers });
    }
  } catch (e) {
    console.warn('[admin/subscribers] DB query failed, falling back:', e);
  }

  // Fallback: use in-memory / file store (returns active-only, limited fields)
  const subs = await listEmailSubscribers();
  const mapped = subs.map(s => ({
    id: s.id,
    email: s.email,
    userId: null,
    source: null,
    topics: s.topics,
    isVerified: false,
    unsubscribedAt: null,
    createdAt: null,
    active: s.active,
  }));
  return NextResponse.json({ subscribers: mapped });
}
