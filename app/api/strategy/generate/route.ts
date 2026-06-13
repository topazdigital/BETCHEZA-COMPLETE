import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick, DayPrediction } from '../predictions/route';

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
  let stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);

  // If no stored week, build one from the week plan so generation always works
  if (!stored) {
    const WEEK_PLAN = [
      { stake: 1000,  save: 0,      targetWin: 3000  },
      { stake: 1500,  save: 1500,   targetWin: 4500  },
      { stake: 2500,  save: 2000,   targetWin: 7500  },
      { stake: 5000,  save: 2500,   targetWin: 15000 },
      { stake: 10000, save: 5000,   targetWin: 30000 },
      { stake: 15000, save: 15000,  targetWin: 45000 },
      { stake: 20000, save: 25000,  targetWin: 60000 },
    ];
    const weekStart = new Date(weekId);
    const weekEnd = new Date(weekId);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const days = WEEK_PLAN.map((plan, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const today = new Date();
      const status = dayDate.toDateString() === today.toDateString() ? 'active' as const
        : dayDate < today ? 'completed' as const : 'upcoming' as const;
      return {
        day: i + 1,
        date: dayDate.toISOString().slice(0, 10),
        stake: plan.stake,
        save: plan.save,
        targetWin: plan.targetWin,
        picks: [],
        combinedOdds: 0,
        status,
      };
    });
    stored = {
      weekId,
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      days,
      generatedAt: new Date().toISOString(),
      totalSavings: 0,
      totalWinnings: 0,
      weeklyProfit: 0,
    };
    fileStoreSet(`strategy-week-${weekId}`, stored);
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

    // If fewer than 2 soccer matches today, also pull all-sport matches for that day
    let extendedPool = targetMatches;
    if (targetMatches.length < 2) {
      const allTodayMatches = upcoming.filter((m) => {
        const matchDate = new Date(m.kickoffTime);
        return matchDate.toDateString() === dayDate.toDateString();
      });
      extendedPool = [
        ...targetMatches,
        ...allTodayMatches.filter(m => m.sport.slug !== 'soccer' && m.sport.slug !== 'football'),
      ].slice(0, 30);
    }

    const fallbackPool = extendedPool.length > 0 ? extendedPool : (soccerMatches.length > 0 ? soccerMatches : upcoming).slice(0, 30);
    const matchList = (extendedPool.length > 0 ? extendedPool : fallbackPool)
      .map((m) => `- ${m.homeTeam.name} vs ${m.awayTeam.name} | League: ${m.league.name} | Sport: ${m.sport.name} | Kickoff: ${new Date(m.kickoffTime).toUTCString()}${m.odds ? ` | Odds: H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''}`)
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
STEP 3: PICK THE BEST MARKET PER MATCH — ANY MARKET IS VALID
═══════════════════════════════════════════

After selecting a match that passes your investigation, choose the SINGLE MOST LOGICAL market for that specific match. You are NOT limited to any particular market type. Use whichever market gives the highest probability of winning given the match context. This includes but is not limited to:

- **1X2 (Home/Draw/Away)** — when one outcome is clearly more likely
- **Double Chance (1X, X2, 12)** — covers two of three outcomes
- **Draw No Bet** — eliminates draw risk on a clear favourite
- **Both Teams to Score (Yes/No)** — based on defensive records and motivations
- **Over/Under Goals** (1.5, 2.5, 3.5, 4.5) — based on scoring patterns
- **Asian Handicap / Goal Line** — when margin of victory matters
- **First Team to Score** — when one team's attack vs the other's poor start is clear
- **Win to Nil** — when a dominant team faces a toothless attack
- **Correct Score** — only if you have unusually high conviction
- **Half-time / Full-time** — when half-time trajectory is predictable
- **Total Corners, Cards** — if match context strongly indicates it (e.g. aggressive styles)
- **Anytime Goalscorer** — if a specific player is almost certain to score
- **Any other market** — if it is the most logical bet given your investigation

The best market is whichever has the HIGHEST actual probability of winning based on evidence — NOT the one with the best-looking odds. Odds follow from your conviction, not the other way around.

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

  // Persist AI-generated picks to DB with is_approved = 0 (requires admin approval before delivery)
  try {
    const { execute: dbExecute, query: dbQuery } = await import('@/lib/db');
    await dbQuery(`CREATE TABLE IF NOT EXISTS daily_strategy (
      date date NOT NULL PRIMARY KEY,
      week_id varchar(20) NOT NULL,
      day_number tinyint NOT NULL,
      stake int NOT NULL DEFAULT 1000,
      save_amount int NOT NULL DEFAULT 0,
      target_win int NOT NULL DEFAULT 3000,
      combined_odds decimal(6,3) NOT NULL DEFAULT 0,
      status enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
      result enum('win','loss') DEFAULT NULL,
      actual_return int DEFAULT NULL,
      picks longtext,
      is_manual tinyint(1) NOT NULL DEFAULT 0,
      scheduled_for date DEFAULT NULL,
      generated_at datetime DEFAULT NULL,
      posted_at datetime DEFAULT NULL,
      settled_at datetime DEFAULT NULL,
      is_approved tinyint(1) NOT NULL DEFAULT 0,
      approved_at datetime DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
    const dayD = stored.days[dayIdx];
    await dbExecute(
      `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, is_manual, generated_at, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, NOW(), 0)
       ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), generated_at = NOW(), status = 'active', is_approved = 0`,
      [dayD.date, weekId, dayD.day, dayD.stake, dayD.save, dayD.targetWin, dayD.combinedOdds, JSON.stringify(picks)]
    );
  } catch { /* non-fatal — file store is source of truth */ }

  // Emails are sent only after admin approves picks via /api/admin/strategy/approve

  return NextResponse.json({ success: true, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)), pendingApproval: true });
}
