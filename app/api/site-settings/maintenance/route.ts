import { NextResponse } from 'next/server';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

/** Lightweight endpoint consumed by the edge middleware to gate traffic when
 *  the admin enables maintenance mode. Cached for 30s in middleware so this
 *  is cheap to call on every request. */
export async function GET() {
  const s = await getSiteSettings();
  return NextResponse.json({
    enabled: s.maintenance_mode === 'true',
    message: s.maintenance_message || '',
  });
}
