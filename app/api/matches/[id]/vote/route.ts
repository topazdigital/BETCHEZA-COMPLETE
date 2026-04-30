import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getUserVote, getVoteTotals, castVote, type VotePick } from '@/lib/votes-store';
import { getMatchById } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

const VOTER_COOKIE = 'bz_voter';
const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

async function resolveVoterId(): Promise<{ id: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = jar.get(VOTER_COOKIE)?.value;
  if (existing && /^[a-f0-9-]{8,}$/i.test(existing)) {
    return { id: existing, isNew: false };
  }
  const id = crypto.randomUUID();
  return { id, isNew: true };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matchId = decodeURIComponent(id);
  const { id: voterId, isNew } = await resolveVoterId();
  const [totals, myVote] = await Promise.all([
    getVoteTotals(matchId),
    isNew ? Promise.resolve(null) : getUserVote(matchId, voterId),
  ]);
  const res = NextResponse.json({
    matchId,
    totals,
    myVote,
  });
  // Always (re)issue the cookie so subsequent POSTs are stable.
  res.cookies.set(VOTER_COOKIE, voterId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: VOTER_COOKIE_MAX_AGE,
  });
  return res;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matchId = decodeURIComponent(id);
  let body: { pick?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const pick = body.pick as VotePick | undefined;
  if (pick !== 'home' && pick !== 'draw' && pick !== 'away') {
    return NextResponse.json({ error: 'invalid_pick' }, { status: 400 });
  }

  // Lock voting once the match has kicked off (live, halftime, or finished).
  // Predictions don't make sense after the ball is already rolling — and
  // letting them through would skew the pre-match crowd sentiment.
  try {
    const match = await getMatchById(matchId);
    if (match) {
      const lockedStatuses = new Set(['live', 'halftime', 'extra_time', 'penalties', 'finished']);
      const kickoffMs = match.kickoffTime instanceof Date
        ? match.kickoffTime.getTime()
        : new Date(match.kickoffTime).getTime();
      const isPastKickoff = Number.isFinite(kickoffMs) && kickoffMs <= Date.now();
      if (lockedStatuses.has(match.status) || isPastKickoff) {
        const totals = await getVoteTotals(matchId);
        const myVote = await getUserVote(matchId, (await resolveVoterId()).id);
        return NextResponse.json(
          { matchId, ok: false, reason: 'voting_closed', totals, myVote },
          { status: 409 },
        );
      }
    }
  } catch (e) {
    console.warn('[vote] match status lookup failed, allowing vote:', e);
  }

  const { id: voterId } = await resolveVoterId();
  const result = await castVote(matchId, voterId, pick);
  const status = result.ok ? 200 : 409;
  const res = NextResponse.json(
    {
      matchId,
      ok: result.ok,
      reason: result.ok ? undefined : result.reason,
      totals: result.totals,
      myVote: result.pick,
    },
    { status },
  );
  res.cookies.set(VOTER_COOKIE, voterId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: VOTER_COOKIE_MAX_AGE,
  });
  return res;
}
