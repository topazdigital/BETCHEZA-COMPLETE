import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getChallenges, createChallenge, type ScoringMethod } from '@/lib/challenges-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'all';
  try {
    const challenges = await getChallenges(status as 'all' | 'pending' | 'active' | 'finished' | 'cancelled');
    return NextResponse.json({ challenges });
  } catch (e) {
    return NextResponse.json({ challenges: [] });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as {
      title?: string;
      description?: string;
      sport?: string;
      scoringMethod?: ScoringMethod;
      startDate?: string;
      endDate?: string;
      opponentId?: number | null;
      stakePts?: number;
      prizePool?: string;
      isPublic?: boolean;
      maxTips?: number;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }

    const challenge = await createChallenge({
      title: body.title.trim(),
      description: body.description?.trim(),
      sport: body.sport || 'football',
      scoringMethod: body.scoringMethod || 'win_rate',
      startDate: body.startDate,
      endDate: body.endDate,
      challengerId: user.id,
      opponentId: body.opponentId || null,
      stakePts: body.stakePts || 0,
      prizePool: body.prizePool,
      isPublic: body.isPublic !== false,
      maxTips: body.maxTips || 10,
    });

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}
