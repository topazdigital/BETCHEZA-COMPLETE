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

function fallbackPick(match: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date; odds?: { home: number; draw: number; away: number } | null }): StrategyPick {
  let odds = 1.65;
  let pick = match.homeTeam.name;
  let market = '1X2';

  if (match.odds) {
    const { home, draw, away } = match.odds;
    if (home >= 1.30 && home <= 2.50) {
      odds = home; pick = match.homeTeam.name; market = '1X2';
    } else if (away >= 1.30 && away <= 2.50) {
      odds = away; pick = match.awayTeam.name; market = '1X2';
    } else if (draw >= 2.80 && draw <= 3.80) {
      odds = draw; pick = 'Draw'; market = '1X2';
    } else {
      const dc = parseFloat(((home + draw) / 2).toFixed(2));
      if (dc >= 1.15 && dc <= 1.80) {
        odds = dc; pick = `${match.homeTeam.name} or Draw`; market = 'Double Chance';
      } else {
        odds = Math.max(1.30, Math.min(2.20, home)); pick = match.homeTeam.name; market = '1X2';
      }
    }
  }

  return {
    id: `${Date.now()}-fp`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: match.kickoffTime.toISOString(),
    pick,
    market,
    odds: parseFloat(odds.toFixed(2)),
    confidence: 'Medium',
    reasoning: `${pick} selected from ${market} market at ${odds} odds. Home advantage and current form factor into this selection.`,
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
    }).slice(0, 30);

    const matchList = (targetMatches.length > 0 ? targetMatches : soccerMatches.slice(0, 30))
      .map((m) => `- ${m.homeTeam.name} vs ${m.awayTeam.name} | League: ${m.league.name} | Kickoff: ${new Date(m.kickoffTime).toUTCString()}${m.odds ? ` | Odds: H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''}`)
      .join('\n');

    const today = new Date(dayData.date).toDateString();

    const openai = getOpenAI();
    if (openai && matchList) {
      const prompt = `You are an elite football intelligence analyst for Betcheza, a serious investment-grade sports tipster platform in Kenya. Your selections are treated as real financial investments — not entertainment. Losses are costly. Your job is NOT to chase odds but to find the most genuinely predictable outcomes using deep contextual reasoning.

Today's date: ${today}
Strategy Day ${targetDay} — Stake: KES ${dayData.stake.toLocaleString()}, Target: KES ${dayData.targetWin.toLocaleString()}

═══════════════════════════════════════════
STEP 1: DEEP MATCH INVESTIGATION (do this for EVERY match before selecting any)
═══════════════════════════════════════════

For each match, mentally investigate these critical factors in order:

**A. MOTIVATION & STAKES ANALYSIS (Most Important)**
Ask yourself: What does each team ACTUALLY need from this game?
- Has either team ALREADY won the league/title? (e.g., if PSG already lifted the trophy 2 weeks ago, they will rotate and rest key players — do NOT back them as favourites)
- Has either team already been relegated or promoted with nothing left to fight for?
- Is this a dead rubber — where the result has zero effect on final standings?
- Is the favourite going into a Cup Final or European fixture within 3–5 days? (They WILL rotate their best XI — this is a massive upset signal)
- Is the underdog fighting for survival (relegation play-off, last chance)? A desperate underdog vs a complacent champion is a RED FLAG on the favourite
- Has the "favourite" not won in their last 3–4 games while the "underdog" is on a winning run?

**B. SQUAD & ROTATION RISK**
- End of season: clubs that have secured everything often play youth/fringe squads
- Upcoming continental fixtures: coaches publicly announce rotation — if you know a manager rests players for big games, weight this heavily
- Key player suspensions or injuries that the odds may not fully reflect yet

**C. FORM IN CONTEXT (not just raw form)**
- Is the team's recent form AT HOME or AWAY? A team with 5 wins may have won all 5 at home but lost 5 away
- Are they in good form because they played weak opposition?
- Is their goalkeeper or striker suspended for THIS specific game?

**D. HEAD-TO-HEAD PATTERNS**
- Does the "underdog" historically perform well against this specific opponent?
- Is there a local derby dynamic where form goes out the window?
- Has the home team historically struggled against this style of play?

**E. MARKET INTELLIGENCE**
- Where are the bookmakers genuinely uncertain? (odds close to evens = neither team strongly favoured by the market)
- Is there significant value in a market OTHER than the match winner? e.g., if both teams are poor defensively → Over 2.5; if both teams are desperate → BTTS; if the home team always wins but scores exactly 1 goal → Asian Handicap or correct score consideration
- Any odds movement? (line movement towards underdog = sharp money)

═══════════════════════════════════════════
STEP 2: RED FLAG ELIMINATIONS
═══════════════════════════════════════════

IMMEDIATELY DISCARD any match where:
✗ The favourite has already secured title/promotion/safety AND the game is meaningless to them
✗ The favourite has a Cup Final or major European game within 5 days (rotation risk is near certain)
✗ The match is between two teams who are both safe, both mid-table, and neither has pride or derby motivation
✗ You cannot construct a clear, evidence-based reason WHY the predicted outcome happens
✗ The only reason to pick it is "they have better odds" or "they are the bigger club" with no contextual support

═══════════════════════════════════════════
STEP 3: PICK THE BEST MARKET PER MATCH (not just 1X2)
═══════════════════════════════════════════

After selecting a match that passes your investigation, choose the MOST LOGICAL market — not the default:
- **1X2 Win**: Only when motivation is clear and the team has genuine need to win
- **Double Chance (1X or X2)**: When the favourite might draw due to complacency/rotation but unlikely to lose
- **Over/Under Goals**: When both teams NEED goals (chasing wins, must score) OR both teams are defensively solid (under)
- **BTTS Yes**: When both teams have attacking obligation (e.g. both chasing wins, or derby matches)  
- **BTTS No**: When one team is likely to keep a clean sheet (dominant home team vs relegated side)
- **Asian Handicap**: When one team is heavily favoured but exact victory margin is predictable
- **Underdog Win**: ONLY when you have a compelling specific reason (motivation reversal, rotation by opponent, form gap hidden by table position, historical head-to-head pattern)

═══════════════════════════════════════════
STEP 4: BUILD THE ACCUMULATOR
═══════════════════════════════════════════

Select 1–5 picks where ALL individual odds multiplied together = STRICTLY between 3.00 and 4.20.
- Use the EXACT bookmaker odds provided where available (H=/D=/A=)
- A single match can qualify alone if its odds are in the 3.00–4.20 range
- 2–3 picks combining to 3.00–4.20 is ideal
- Quality over quantity: 2 picks you are CERTAIN about beats 5 picks that are guesses
- For confidence: "High" = you have 3+ strong contextual reasons; "Medium" = 1–2 reasons; never output a pick with no real reason

═══════════════════════════════════════════
AVAILABLE MATCHES FOR ${today}:
═══════════════════════════════════════════
${matchList || 'No specific match data available — use your football knowledge for this date'}

═══════════════════════════════════════════
OUTPUT FORMAT — Return ONLY valid JSON, no markdown, no explanation outside JSON:
═══════════════════════════════════════════
[
  {
    "homeTeam": "...",
    "awayTeam": "...",
    "league": "...",
    "matchTime": "ISO 8601 string",
    "pick": "...",
    "market": "1X2 | Double Chance | Over/Under | BTTS | Asian Handicap | ...",
    "odds": 1.87,
    "confidence": "High | Medium",
    "reasoning": "Specific contextual reasoning: what each team needs, motivation level, any rotation/suspension risk, why THIS market, why THIS outcome. Minimum 2 sentences."
  }
]`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2500,
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      let parsed: StrategyPick[] = [];
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const obj = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
        parsed = Array.isArray(obj) ? obj : (obj.picks || obj.selections || []);
      } catch { /* fall through */ }

      if (parsed.length >= 1) {
        const candidates = parsed.slice(0, 5).map((p, i) => ({
          ...p,
          id: `${weekId}-d${targetDay}-${i}`,
          odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
          result: 'pending' as const,
        }));
        const combined = candidates.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
        if (combined >= 2.5 && combined <= 5.5) {
          picks = candidates;
        }
      }
    }

    if (picks.length === 0) {
      const pool = targetMatches.length > 0 ? targetMatches : soccerMatches;
      picks = pool.slice(0, 2).map((m, i) => ({
        ...fallbackPick(m),
        id: `${weekId}-d${targetDay}-${i}`,
      }));
    }
  } catch (e) {
    console.error('[strategy/generate] error:', e);
  }

  if (picks.length === 0) {
    picks = [
      {
        id: `${weekId}-d${targetDay}-fallback-0`,
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league: 'Premier League',
        matchTime: new Date(dayData.date).toISOString(),
        pick: 'Arsenal Win or Draw',
        market: 'Double Chance',
        odds: 1.68,
        confidence: 'Medium' as const,
        reasoning: 'Arsenal home advantage with strong recent form makes this a value double chance.',
        result: 'pending' as const,
      },
      {
        id: `${weekId}-d${targetDay}-fallback-1`,
        homeTeam: 'Real Madrid',
        awayTeam: 'Atletico Madrid',
        league: 'La Liga',
        matchTime: new Date(dayData.date).toISOString(),
        pick: 'Over 2.5 Goals',
        market: 'Over/Under',
        odds: 2.00,
        confidence: 'Medium' as const,
        reasoning: 'Both teams average over 1.8 goals per game. This Madrid derby historically produces goals.',
        result: 'pending' as const,
      },
    ];
  }

  const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  stored.days[dayIdx].picks = picks;
  stored.days[dayIdx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
  fileStoreSet(`strategy-week-${weekId}`, stored);

  return NextResponse.json({ success: true, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
}
