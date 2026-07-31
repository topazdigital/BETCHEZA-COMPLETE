import { NextRequest, NextResponse } from 'next/server';
import { getTrendingHashtags } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 20), 50);
  const hashtags = await getTrendingHashtags(limit);
  return NextResponse.json({ hashtags });
}
