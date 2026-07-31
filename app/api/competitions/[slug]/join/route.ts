import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getCompetitionBySlugAsync,
  joinCompetition,
  hasUserJoined,
} from '@/lib/competitions-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Sign in to join a competition.' },
      { status: 401 },
    );
  }

  const comp = await getCompetitionBySlugAsync(slug);
  if (!comp) {
    return NextResponse.json({ success: false, error: 'Competition not found' }, { status: 404 });
  }

  let paymentRef: string | undefined;
  if (comp.entryFee > 0) {
    try {
      const body = await req.json();
      paymentRef = body?.paymentRef;
    } catch {
      // body optional for free competitions
    }
    if (!paymentRef) {
      return NextResponse.json(
        { success: false, error: `Entry fee of ${comp.currency} ${comp.entryFee} must be paid before joining.` },
        { status: 402 },
      );
    }
  }

  const userName =
    (user as unknown as { displayName?: string; username?: string; email?: string }).displayName
    || (user as unknown as { username?: string; email?: string }).username
    || (user as unknown as { email?: string }).email
    || `user_${user.userId}`;

  const result = await joinCompetition(comp.id, user.userId, userName);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    alreadyJoined: result.alreadyJoined,
    participantCount: result.participantCount,
    paymentRef,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const comp = await getCompetitionBySlugAsync(slug);
  if (!comp) {
    return NextResponse.json({ success: false, error: 'Competition not found' }, { status: 404 });
  }
  const user = await getCurrentUser();
  const joined = user ? await hasUserJoined(comp.id, user.userId) : false;
  return NextResponse.json({ success: true, joined });
}
