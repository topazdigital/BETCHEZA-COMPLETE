import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeEmail } from '@/lib/notification-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const ok = await unsubscribeEmail(token);
  return NextResponse.json({ success: ok });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = (body.token || '').toString();
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const ok = await unsubscribeEmail(token);
  return NextResponse.json({ success: ok });
}
