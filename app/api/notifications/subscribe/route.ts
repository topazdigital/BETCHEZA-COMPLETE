import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { savePushSubscription } from '@/lib/notification-store';

export const dynamic = 'force-dynamic';

interface PushSubInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  topics?: string[];
  countryCode?: string | null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => null)) as PushSubInput | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'Invalid push subscription payload' }, { status: 400 });
  }
  const row = await savePushSubscription({
    userId: user?.userId ?? null,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    topics: body.topics || ['general'],
    countryCode: body.countryCode || null,
  });
  return NextResponse.json({ success: true, id: row.id });
}
