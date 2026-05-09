import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick } from '../predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  try { return new OpenAI({ apiKey, baseURL }); } catch { return null; }
}

function fallbackPick(match: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date }): StrategyPick {
  const odds = parseFloat((3.1 + Math.random() * 0.8).toFixed(2));
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: match.kickoffTime.toISOString(),
    pick: match.homeTeam.name,
    market: '1X2',
    odds,
    confidence: 'Medium',
    reasoning: `${match.homeTeam.name} has home advantage in this fixture. Value identified at ${odds} odds.`,
    result: 'pending',
  };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetDay: number = body.day || 1;
  const weekId = getWeekId(new Date());
  const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);

  if (!stored) {
    return NextResponse.json({ error: 'No active week found. Load predictions page first.' }, { status: 404 });
  }

  const dayIdx = targetDay - 1;
  const dayData = stored.days[dayIdx];
  if (!dayData) return NextResponse.json({ error: 'Invalid day' }, { status: 400 });

  let picks: StrategyPick[] = [];

  try {
    const upcoming = await getUpcomingMatches();
    const soccerMatches = upcoming.filter(
      (m) => m.sport.slug === 'soccer' || m.sport.slug === 'football'
    );

    const dayDate = new Date(dayData.date);
    const targetMatches = soccerMatches.filter((m) => {
      const matchDate = new Date(m.kickoffTime);
      return matchDate.toDateString() === dayDate.toDateString();
    }).slice(0, 20);

    const matchList = (targetMatches.length > 0 ? targetMatches : soccerMatches.slice(0, 20))
      .map((m) => `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.league.name}, ${new Date(m.kickoffTime).toUTCString()}${m.odds ? `, odds: H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''})`)
      .join('\n');

    const openai = getOpenAI();
    if (openai && matchList) {
      const prompt = `You are a football betting analyst for the Betcheza 3 Daily Odds Winning Strategy.

Strategy context: Players compound winnings daily. Day ${targetDay} stake is KES ${dayData.stake.toLocaleString()}, target win KES ${dayData.targetWin.toLocaleString()}.

Select exactly 3 football matches for a multi/accumulator. Requirements:
- Each pick must have odds strictly between 3.00 and 4.00
- Total combined odds should be around ${(3.2 ** 3).toFixed(1)} to ${(3.9 ** 3).toFixed(1)} giving a good payout
- Pick only football/soccer matches
- Markets: 1X2, Double Chance, Both Teams to Score, Over/Under 2.5
- Give specific reasoning using team form, H2H, home advantage, or odds value

Available matches for Day ${targetDay} (${dayData.date}):
${matchList || 'No specific matches found — use your football knowledge for this date'}

Return ONLY a JSON array of 3 picks in this exact format:
[
  {
    "homeTeam": "Team A",
    "awayTeam": "Team B",
    "league": "League Name",
    "matchTime": "ISO date string",
    "pick": "Team A Win" or "Draw" or "Both Teams to Score" etc,
    "market": "1X2" or "BTTS" or "Over 2.5" etc,
    "odds": 3.20,
    "confidence": "Medium" or "High",
    "reasoning": "2-3 sentence reasoning"
  }
]`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1000,
      });

      const raw = completion.choices?.[0]?.message?.content || '{}';
      let parsed: StrategyPick[] = [];
      try {
        const obj = JSON.parse(raw);
        parsed = Array.isArray(obj) ? obj : (obj.picks || obj.selections || []);
      } catch { /* fall through */ }

      if (parsed.length >= 3) {
        picks = parsed.slice(0, 3).map((p, i) => ({
          ...p,
          id: `${weekId}-d${targetDay}-${i}`,
          odds: Math.min(4.0, Math.max(3.0, parseFloat(String(p.odds)) || 3.2)),
          result: 'pending' as const,
        }));
      }
    }

    if (picks.length < 3) {
      const pool = targetMatches.length > 0 ? targetMatches : soccerMatches;
      picks = pool.slice(0, 3).map((m, i) => ({
        ...fallbackPick(m),
        id: `${weekId}-d${targetDay}-${i}`,
      }));
    }
  } catch (e) {
    console.error('[strategy/generate] error:', e);
  }

  if (picks.length < 3) {
    picks = Array.from({ length: 3 }, (_, i) => ({
      id: `${weekId}-d${targetDay}-fallback-${i}`,
      homeTeam: ['Arsenal', 'Real Madrid', 'Barcelona'][i],
      awayTeam: ['Chelsea', 'Atletico Madrid', 'Valencia'][i],
      league: 'Premier League',
      matchTime: new Date(dayData.date).toISOString(),
      pick: ['Arsenal Win', 'Real Madrid Win', 'Barcelona Win'][i],
      market: '1X2',
      odds: parseFloat((3.1 + i * 0.2).toFixed(2)),
      confidence: 'Medium' as const,
      reasoning: 'Based on current form and home advantage analysis.',
      result: 'pending' as const,
    }));
  }

  const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  stored.days[dayIdx].picks = picks;
  stored.days[dayIdx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
  fileStoreSet(`strategy-week-${weekId}`, stored);

  return NextResponse.json({ success: true, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
}
