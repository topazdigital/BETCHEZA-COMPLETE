import { NextRequest, NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: false });

  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === 'string' ? body.path.slice(0, 255) : '/';

    await query(
      `INSERT INTO site_pageviews (date, path, count)
       VALUES (CURDATE(), ?, 1)
       ON DUPLICATE KEY UPDATE count = count + 1`,
      [path]
    );
  } catch {
  }

  return NextResponse.json({ ok: true });
}
