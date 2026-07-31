import { NextResponse } from 'next/server';
import { listPublicBookmakers } from '@/lib/bookmakers-store';

export const runtime = 'nodejs';

/** Public list of bookmakers — the /bookmakers page consumes this. */
export async function GET() {
  const res = NextResponse.json({ bookmakers: listPublicBookmakers() });
  res.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  return res;
}
