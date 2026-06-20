import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { savePushSubscription, listPushSubscriptions } from '@/lib/notification-store';

export const dynamic = 'force-dynamic';

interface MatchSubInput {
  matchId: string;
  action: 'subscribe' | 'unsubscribe';
  endpoint: string;
  p256dh: string;
  auth: string;
  countryCode?: string | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as MatchSubInput | null;
  if (!body?.matchId || !body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const topic = `match_${body.matchId}`;

  try {
    const all = await listPushSubscriptions();
    const existing = all.find(s => s.endpoint === body.endpoint);

    const currentTopics: string[] = existing?.topics ?? ['general'];
    let updatedTopics: string[];

    if (body.action === 'subscribe') {
      updatedTopics = currentTopics.includes(topic)
        ? currentTopics
        : [...currentTopics, topic];
    } else {
      updatedTopics = currentTopics.filter(t => t !== topic);
    }

    await savePushSubscription({
      userId: existing?.userId ?? null,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      topics: updatedTopics,
      countryCode: body.countryCode ?? existing?.countryCode ?? null,
    });

    return NextResponse.json({
      success: true,
      action: body.action,
      topic,
      topics: updatedTopics,
    });
  } catch (err) {
    console.error('[match-subscribe] error:', err);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get('matchId');
  const endpoint = searchParams.get('endpoint');

  if (!matchId || !endpoint) {
    return NextResponse.json({ subscribed: false });
  }

  try {
    const all = await listPushSubscriptions();
    const sub = all.find(s => s.endpoint === endpoint);
    const subscribed = sub ? sub.topics.includes(`match_${matchId}`) : false;
    return NextResponse.json({ subscribed });
  } catch {
    return NextResponse.json({ subscribed: false });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get('matchId');
  if (!matchId) {
    return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  }
  const topic = `match_${matchId}`;

  try {
    await query(
      `UPDATE push_subscriptions SET topics = JSON_REMOVE(topics, JSON_UNQUOTE(JSON_SEARCH(topics, 'one', ?))) WHERE JSON_SEARCH(topics, 'one', ?) IS NOT NULL`,
      [topic, topic],
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
