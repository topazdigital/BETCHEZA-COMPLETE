import { NextResponse } from 'next/server';
import {
  getCompetitionsAsync,
  type Competition,
  type CompetitionParticipant,
} from '@/lib/competitions-store';
import { query } from '@/lib/db';

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
  const results: CompHistoryEntry[] = [];

  try {
    const allComps = await getCompetitionsAsync();

    if (isFake) {
      // Fake tipsters: check in-memory participant lists only
      for (const comp of allComps) {
        const p: CompetitionParticipant | undefined = comp.participants.find(
          (x) => x.tipsterId === tipsterId,
        );
        if (!p) continue;
        results.push({
          id: comp.id, slug: comp.slug, name: comp.name,
          type: comp.type, status: comp.status,
          startDate: comp.startDate, endDate: comp.endDate,
          rank: p.rank, points: p.points, tips: p.tips, winRate: p.winRate,
          prizePool: comp.prizePool, currency: comp.currency,
          prizes: comp.prizes, entryFee: comp.entryFee,
        });
      }
    } else {
      // Real tipsters: single query to get all competition_ids this user joined
      let joinedCompIds: Set<number> = new Set();
      try {
        const entriesResult = await query<{ competition_id: number }>(
          `SELECT competition_id FROM competition_entries WHERE user_id = ?`,
          [tipsterId],
        );
        joinedCompIds = new Set(entriesResult.rows.map(r => r.competition_id));
      } catch {
        // DB unavailable — return empty list gracefully
        return NextResponse.json({ competitions: [] });
      }

      for (const comp of allComps) {
        if (!joinedCompIds.has(comp.id)) continue;
        const p = comp.participants.find((x) => x.tipsterId === tipsterId);
        results.push({
          id: comp.id, slug: comp.slug, name: comp.name,
          type: comp.type, status: comp.status,
          startDate: comp.startDate, endDate: comp.endDate,
          rank: p?.rank ?? null, points: p?.points ?? null,
          tips: p?.tips ?? null, winRate: p?.winRate ?? null,
          prizePool: comp.prizePool, currency: comp.currency,
          prizes: comp.prizes, entryFee: comp.entryFee,
        });
      }
    }
  } catch {
    // If competitions DB is down, return empty rather than hanging
    return NextResponse.json({ competitions: [] });
  }

  results.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  return NextResponse.json({ competitions: results });
}
