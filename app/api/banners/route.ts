import { NextResponse } from 'next/server';
import { getBanners } from '@/lib/banner-store';

export const dynamic = 'force-dynamic';

let _cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL) {
    return NextResponse.json(_cache.data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  }
  const banners = await getBanners();
  const active = banners.filter((b) => b.active).sort((a, b) => a.order - b.order);
  _cache = { data: active, ts: now };
  return NextResponse.json(active, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
