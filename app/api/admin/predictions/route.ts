import { NextResponse } from 'next/server';
import { listAllAutoTips } from '@/lib/auto-tips-store';
import { getFakeTipsterById } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tips = listAllAutoTips(200);
  const items = tips.map((t) => {
    const tipster = getFakeTipsterById(t.tipsterId);
    return {
      id: t.id,
      tipster: {
        id: t.tipsterId,
        name: tipster?.displayName || `Tipster #${t.tipsterId}`,
        avatar: tipster?.avatar || null,
        username: tipster?.username || `tipster_${t.tipsterId}`,
      },
      match: {
        id: t.matchId,
        slug: t.matchSlug || null,
        homeTeam: t.homeTeam,
        awayTeam: t.awayTeam,
        league: t.league || '',
        sport: t.sport || '',
        kickoff: t.kickoff || t.createdAt,
      },
      prediction: t.prediction,
      market: t.market,
      odds: t.odds,
      stake: t.stake,
      confidence: t.confidence,
      isPremium: t.isPremium,
      status: t.status,
      likes: t.likes,
      dislikes: t.dislikes,
      comments: t.comments,
      createdAt: t.createdAt,
    };
  });

  const stats = {
    total: items.length,
    won: items.filter((p) => p.status === 'won').length,
    lost: items.filter((p) => p.status === 'lost').length,
    pending: items.filter((p) => p.status === 'pending').length,
    void: items.filter((p) => p.status === 'void').length,
  };
  const settled = stats.won + stats.lost;
  const winRate = settled > 0 ? Math.round((stats.won / settled) * 100) : 0;

  return NextResponse.json({ items, stats: { ...stats, winRate } });
}
