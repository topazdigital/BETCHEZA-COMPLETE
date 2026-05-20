import { NextResponse } from 'next/server';
import {
  getCompetitions,
  getJoinedUserIds,
  type Competition,
  type CompetitionParticipant,
} from '@/lib/competitions-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface CompHistoryEntry {
  id: number;
  slug: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  rank: number | null;
  points: number | null;
  tips: number | null;
  winRate: number | null;
  prizePool: number;
  currency: string;
  prizes: Competition['prizes'];
  entryFee: number;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const tipsterId = parseInt(id, 10);

  if (!tipsterId || isNaN(tipsterId)) {
    return NextResponse.json({ error: 'Invalid tipster id' }, { status: 400 });
  }

  const isFake = tipsterId >= 1000;
  const allComps = getCompetitions();
  const results: CompHistoryEntry[] = [];

  for (const comp of allComps) {
    let participated = false;
    let rank: number | null = null;
    let points: number | null = null;
    let tips: number | null = null;
    let winRate: number | null = null;

    if (isFake) {
      // Fake tipsters appear in seeded participants
      const p: CompetitionParticipant | undefined = comp.participants.find(
        (x) => x.tipsterId === tipsterId,
      );
      if (p) {
        participated = true;
        rank = p.rank;
        points = p.points;
        tips = p.tips;
        winRate = p.winRate;
      }
    } else {
      // Real users must have joined
      const joinedIds = getJoinedUserIds(comp.id);
      if (joinedIds.includes(tipsterId)) {
        participated = true;
        // Pull stats from participants if they've been computed
        const p = comp.participants.find((x) => x.tipsterId === tipsterId);
        if (p) {
          rank = p.rank;
          points = p.points;
          tips = p.tips;
          winRate = p.winRate;
        }
      }
    }

    if (!participated) continue;

    results.push({
      id: comp.id,
      slug: comp.slug,
      name: comp.name,
      type: comp.type,
      status: comp.status,
      startDate: comp.startDate,
      endDate: comp.endDate,
      rank,
      points,
      tips,
      winRate,
      prizePool: comp.prizePool,
      currency: comp.currency,
      prizes: comp.prizes,
      entryFee: comp.entryFee,
    });
  }

  // Most recent first
  results.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  return NextResponse.json({ competitions: results });
}
