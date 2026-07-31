import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  let dbStatus: 'ok' | 'unavailable' = 'unavailable';
  try {
    const pool = getPool();
    if (pool) {
      await pool.execute('SELECT 1');
      dbStatus = 'ok';
    }
  } catch {
    dbStatus = 'unavailable';
  }

  return NextResponse.json(
    {
      status: 'ok',
      db: dbStatus,
      uptime_seconds: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
