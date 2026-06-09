import { NextResponse } from 'next/server';
import { discoverAllOutrights } from '@/lib/api/outright-discovery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await discoverAllOutrights();
    const res = NextResponse.json({ success: true, count: data.length, data });
    res.headers.set('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
    return res;
  } catch (err) {
    console.error('[outrights/all]', err);
    return NextResponse.json({ success: false, data: [], error: 'Failed to load outright markets' }, { status: 500 });
  }
}
