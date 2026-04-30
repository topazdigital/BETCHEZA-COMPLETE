import { NextResponse } from 'next/server';
import { getSiteSettings, parseRewrites } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

/** Lightweight endpoint consumed by the edge middleware. Public on purpose
 *  — these are the redirect rules the admin already configured. */
export async function GET() {
  const s = await getSiteSettings();
  return NextResponse.json({ rewrites: parseRewrites(s.url_rewrites) });
}
