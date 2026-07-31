import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_TO_ODDS_KEYS } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function fetchTopScorerOdds(sportKey: string): Promise<{ name: string; price: number }[]> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) return [];

  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&regions=uk,eu&markets=outrights&oddsFormat=decimal&dateFormat=iso`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      bookmakers?: Array<{ markets?: Array<{ key: string; outcomes?: Array<{ name: string; price: number }> }> }>
    }>;
    if (!Array.isArray(data) || data.length === 0) return [];

    const tally = new Map<string, number[]>();
    for (const ev of data) {
      for (const bm of ev.bookmakers || []) {
        for (const market of bm.markets || []) {
          if (market.key !== 'outrights') continue;
          for (const o of market.outcomes || []) {
            if (!tally.has(o.name)) tally.set(o.name, []);
            tally.get(o.name)!.push(o.price);
          }
        }
      }
    }

    return Array.from(tally.entries())
      .map(([name, prices]) => ({ name, price: Math.round(Math.max(...prices) * 100) / 100 }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 20);
  } catch {
    return [];
  }
}

const STATIC_SCORER_ODDS: Record<number, { name: string; price: number }[]> = {
  1: [
    { name: 'Erling Haaland', price: 2.75 },
    { name: 'Cole Palmer', price: 5.00 },
    { name: 'Mohamed Salah', price: 5.50 },
    { name: 'Alexander Isak', price: 7.00 },
    { name: 'Harry Kane', price: 7.00 },
    { name: 'Bukayo Saka', price: 8.00 },
    { name: 'Heung-Min Son', price: 9.00 },
    { name: 'Marcus Rashford', price: 13.00 },
    { name: 'Gabriel Jesus', price: 17.00 },
    { name: 'Dominic Calvert-Lewin', price: 21.00 },
  ],
  2: [
    { name: 'Robert Lewandowski', price: 3.50 },
    { name: 'Vinicius Jr', price: 4.00 },
    { name: 'Jude Bellingham', price: 5.50 },
    { name: 'Kylian Mbappé', price: 6.00 },
    { name: 'Artem Dovbyk', price: 7.00 },
    { name: 'Álvaro Morata', price: 8.00 },
    { name: 'Antoine Griezmann', price: 11.00 },
    { name: 'Dani Olmo', price: 13.00 },
  ],
  3: [
    { name: 'Harry Kane', price: 2.50 },
    { name: 'Leroy Sané', price: 7.00 },
    { name: 'Christopher Nkunku', price: 8.00 },
    { name: 'Serhou Guirassy', price: 9.00 },
    { name: 'Lamine Yamal', price: 13.00 },
  ],
  4: [
    { name: 'Lautaro Martínez', price: 3.25 },
    { name: 'Dusan Vlahovic', price: 4.50 },
    { name: 'Romelu Lukaku', price: 5.50 },
    { name: 'Viktor Osimhen', price: 6.00 },
    { name: 'Khvicha Kvaratskhelia', price: 7.00 },
  ],
  5: [
    { name: 'Kylian Mbappé', price: 3.00 },
    { name: 'Jonathan David', price: 5.00 },
    { name: 'Randal Kolo Muani', price: 7.00 },
    { name: 'Ousmane Dembélé', price: 8.00 },
  ],
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const leagueId = parseInt(id);

  if (isNaN(leagueId)) {
    return NextResponse.json({ error: 'Invalid league ID' }, { status: 400 });
  }

  const allKeys = (LEAGUE_TO_ODDS_KEYS as Record<number, string[]>)[leagueId] || [];
  const scorerKey = allKeys.find(k => k.includes('top_scorer'));

  let outcomes: { name: string; price: number }[] = [];

  if (scorerKey) {
    outcomes = await fetchTopScorerOdds(scorerKey);
  }

  if (outcomes.length === 0) {
    outcomes = STATIC_SCORER_ODDS[leagueId] || [];
  }

  return NextResponse.json({
    success: true,
    leagueId,
    marketName: 'Top Scorer',
    marketKey: 'top_scorer',
    outcomes,
    isLive: scorerKey ? outcomes.length > 0 : false,
  });
}
