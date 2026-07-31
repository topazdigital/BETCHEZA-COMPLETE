import { NextResponse } from 'next/server';
import { listRooms } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rooms = await listRooms();
    return NextResponse.json({ success: true, rooms });
  } catch (e) {
    console.error('[feed/rooms] GET error:', e);
    return NextResponse.json({ success: true, rooms: [] });
  }
}
