import { NextResponse } from 'next/server';
import { listPublicBookmakers } from '@/lib/bookmakers-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public list of bookmakers — the /bookmakers page consumes this. */
export async function GET() {
  return NextResponse.json({ bookmakers: listPublicBookmakers() });
}
