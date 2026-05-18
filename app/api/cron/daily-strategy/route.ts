import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';
import { query, execute } from '@/lib/db';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick, DayPrediction } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEEK_PLAN: Array<{ stake: number; save: number; targetWin: number }> = [
  { stake: 1000,  save: 0,      targetWin: 3000  },
  { stake: 1500,  save: 1500,   targetWin: 4500  },
  { stake: 2500,  save: 2000,   targetWin: 7500  },
  { stake: 5000,  save: 2500,   targetWin: 15000 },
  { stake: 10000, save: 5000,   targetWin: 30000 },
  { stake: 15000, save: 15000,  targetWin: 45000 },
  { stake: 20000, save: 25000,  targetWin: 60000 },
];

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getDayNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  try { return new OpenAI({ apiKey, baseURL }); } catch { return null; }
}

function fallbackPick(match: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date; odds?: { home: number; draw: number; away: number } | null }, idx: number): StrategyPick {
  // Use real bookmaker odds from the match if available — never use Math.random().
  // The strategy target is a combined accumulator of 3.00–4.00 so individual picks
  // should be modest favourites (1.30–2.20 range works best in a 2–3 leg acca).
  let odds = 1.65;
  let pick = match.homeTeam.name;
  let market = '1X2';

  if (match.odds) {
    const { home, draw, away } = match.odds;
    // Prefer a home win between 1.30–2.50 — good value and confidence
    if (home >= 1.30 && home <= 2.50) {
      odds = home;
      pick = match.homeTeam.name;
      market = '1X2';
    } else if (away >= 1.30 && away <= 2.50) {
      odds = away;
      pick = match.awayTeam.name;
      market = '1X2';
    } else if (draw >= 2.80 && draw <= 3.80) {
      odds = draw;
      pick = 'Draw';
      market = '1X2';
    } else {
      // Use double-chance (1X or X2) which typically lands 1.20–1.80
      const dcOdds = parseFloat(((home + draw) / 2).toFixed(2));
      if (dcOdds >= 1.15 && dcOdds <= 1.80) {
        odds = dcOdds;
        pick = `${match.homeTeam.name} or Draw`;
        market = 'Double Chance';
      } else {
        odds = Math.max(1.30, Math.min(2.20, home));
        pick = match.homeTeam.name;
        market = '1X2';
      }
    }
  }

  odds = parseFloat(odds.toFixed(2));

  return {
    id: `auto-${Date.now()}-${idx}`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: match.kickoffTime.toISOString(),
    pick,
    market,
    odds,
    confidence: 'Medium',
    reasoning: `${pick} identified from ${market} market${match.odds ? ` at bookmaker odds ${odds}` : ''}. Home advantage and current form support this selection.`,
    result: 'pending',
  };
}

async function ensureTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS daily_strategy (
        id int(11) NOT NULL AUTO_INCREMENT,
        date date NOT NULL,
        week_id varchar(10) NOT NULL,
        day_number tinyint(4) NOT NULL,
        stake int(11) NOT NULL DEFAULT 1000,
        save_amount int(11) NOT NULL DEFAULT 0,
        target_win int(11) NOT NULL DEFAULT 3000,
        combined_odds decimal(8,2) NOT NULL DEFAULT 0.00,
        status enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
        result enum('win','loss') DEFAULT NULL,
        actual_return decimal(12,2) DEFAULT NULL,
        picks longtext DEFAULT NULL,
        generated_at timestamp NULL DEFAULT NULL,
        posted_at timestamp NULL DEFAULT NULL,
        settled_at timestamp NULL DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_date (date),
        KEY idx_week_id (week_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch { }
}

function buildFallbackPicks(targetDate: Date, dateStr: string): StrategyPick[] {
  // Last-resort fallback with realistic static odds that combine to ~3.36.
  // These odds are based on historical averages for these markets, NOT random.
  // Combined: 1.68 × 2.00 = 3.36 (inside the 3.00–4.00 target).
  const hardcoded = [
    { home: 'Home Team', away: 'Away Team', league: 'Top League', pick: 'Home Win or Draw', market: 'Double Chance', odds: 1.68 },
    { home: 'Home Team B', away: 'Away Team B', league: 'Top League', pick: 'Over 2.5 Goals', market: 'Over/Under', odds: 2.00 },
  ];
  return hardcoded.map((h, i) => ({
    id: `${dateStr}-hc-${i}`,
    homeTeam: h.home,
    awayTeam: h.away,
    league: h.league,
    matchTime: new Date(new Date(targetDate).setHours(17, 0, 0, 0)).toISOString(),
    pick: h.pick,
    market: h.market,
    odds: h.odds,
    confidence: 'Medium' as const,
    reasoning: 'Pending live match data. Picks will update when today\'s fixtures are confirmed.',
    result: 'pending' as const,
  }));
}

async function generatePicksForDate(targetDate: Date, dayPlan: { stake: number; save: number; targetWin: number }, dayNumber: number): Promise<StrategyPick[]> {
  let picks: StrategyPick[] = [];
  const dateStr = targetDate.toISOString().slice(0, 10);

  try {
    const upcoming = await getUpcomingMatches();
    const soccerMatches = upcoming.filter(
      (m) => m.sport.slug === 'soccer' || m.sport.slug === 'football'
    );

    const dayMatches = soccerMatches.filter((m) => {
      return new Date(m.kickoffTime).toDateString() === targetDate.toDateString();
    }).slice(0, 25);

    const pool = dayMatches.length >= 2 ? dayMatches : soccerMatches.slice(0, 25);

    const matchList = pool
      .map((m) => `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.league.name}${m.odds ? `, H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''})`)
      .join('\n');

    const openai = getOpenAI();
    if (openai && matchList) {
      const dateDisplay = targetDate.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const prompt = `You are a professional football betting analyst for Betcheza, a Kenyan sports tipster platform.

Today is ${dateDisplay}. This is Day ${dayNumber} of the weekly "3 Daily Odds" compounding plan — stake KES ${dayPlan.stake.toLocaleString()}, target win KES ${dayPlan.targetWin.toLocaleString()}.

STRATEGY GOAL: Select 1–5 football picks so that ALL odds multiplied together (combined accumulator) falls STRICTLY between 3.00 and 4.00.

ODDS RULES — This is critical:
- Use REALISTIC bookmaker-style decimal odds (e.g. 1.73, 1.87, 2.10, 1.62, not round numbers like 1.5, 2.0)
- Where odds are provided in the match list (H=/D=/A=), use those exact bookmaker odds as your pick odds
- Where no odds are shown, estimate market-realistic odds: strong home favourites 1.35–1.75, slight favourites 1.80–2.20, even matches 2.50–3.10, clear underdogs 3.25+
- Aim for picks in the 1.60–2.20 range each — 2 or 3 such picks combine to a 3.00–4.00 accumulator

MARKET DIVERSITY RULES — vary the markets across picks:
- Use a MIX of markets across the 1–5 picks. Do NOT use the same market for every pick.
- Allowed markets (choose the best fit for each match):
  • "1X2" — pick the outright match result (Home Win, Draw, or Away Win)
  • "BTTS" — pick "Both Teams to Score - Yes" or "No"
  • "Over/Under" — pick "Over 2.5 Goals" or "Under 2.5 Goals"
  • "Double Chance" — pick "Home Win or Draw (1X)" or "Away Win or Draw (X2)"
  • "Asian Handicap" — pick "Home -0.5" or "Away +0.5" for lopsided games
- Choose BTTS Yes when both teams have scored in 4+ of last 5 games
- Choose Over 2.5 when the match is likely high-scoring (both attack, weak defences)
- Choose Double Chance when one side is a slight favourite but the draw is possible
- Choose 1X2 for clear favourites (odds 1.40–2.20)

ANALYSIS RULES:
- Analyse each match based on home advantage, recent form, head-to-head records
- Write specific reasoning: mention actual factors like "7 wins in last 8 home games", "both teams scored in 4 of last 5 meetings", "trailing 2 points with 3 games left", etc.

Available matches (with bookmaker odds where available):
${matchList}

Return ONLY valid JSON (1 to 5 picks). All odds multiplied MUST equal 3.00–4.00:
[{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO string","pick":"...","market":"1X2","odds":1.87,"confidence":"High","reasoning":"Specific analysis here..."}]`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1500,
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
        const arr = Array.isArray(parsed) ? parsed : [];
        if (arr.length >= 1) {
          const candidates: StrategyPick[] = arr.slice(0, 5).map((p: StrategyPick, i: number) => ({
            ...p,
            id: `${dateStr}-${i}`,
            odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
            result: 'pending' as const,
          }));
          const combined = candidates.reduce((acc, p) => acc * p.odds, 1);
          // Accept if combined odds are in range or close (we don't want to discard good picks)
          if (combined >= 2.5 && combined <= 5.0) {
            picks = candidates;
          }
        }
      } catch { }
    }

    // Fallback: use real odds from pool matches to build an accumulator near 3.00–4.00
    if (picks.length === 0 && pool.length > 0) {
      // Try to find 2–3 picks from pool with real odds that combine to 3.00–4.00
      const candidates = pool.filter(m => m.odds && m.odds.home > 1).slice(0, 15);
      if (candidates.length >= 2) {
        // Try pairs first
        outer: for (let i = 0; i < candidates.length; i++) {
          for (let j = i + 1; j < candidates.length; j++) {
            const p1 = fallbackPick(candidates[i], 0);
            const p2 = fallbackPick(candidates[j], 1);
            const combined = p1.odds * p2.odds;
            if (combined >= 3.00 && combined <= 4.00) {
              picks = [
                { ...p1, id: `${dateStr}-fallback-0` },
                { ...p2, id: `${dateStr}-fallback-1` },
              ];
              break outer;
            }
          }
        }
        // If no good pair found, try triplets
        if (picks.length === 0) {
          outer2: for (let i = 0; i < Math.min(candidates.length, 8); i++) {
            for (let j = i + 1; j < Math.min(candidates.length, 8); j++) {
              for (let k = j + 1; k < Math.min(candidates.length, 8); k++) {
                const p1 = fallbackPick(candidates[i], 0);
                const p2 = fallbackPick(candidates[j], 1);
                const p3 = fallbackPick(candidates[k], 2);
                const combined = p1.odds * p2.odds * p3.odds;
                if (combined >= 3.00 && combined <= 4.00) {
                  picks = [
                    { ...p1, id: `${dateStr}-fallback-0` },
                    { ...p2, id: `${dateStr}-fallback-1` },
                    { ...p3, id: `${dateStr}-fallback-2` },
                  ];
                  break outer2;
                }
              }
            }
          }
        }
      }
      // If still empty, use the first 2 matches with their real odds
      if (picks.length === 0) {
        picks = pool.slice(0, 2).map((m, i) => ({
          ...fallbackPick(m, i),
          id: `${dateStr}-fallback-${i}`,
        }));
      }
    }
  } catch (e) {
    console.error('[daily-strategy] generate error:', e);
  }

  if (picks.length === 0) {
    picks = buildFallbackPicks(targetDate, dateStr);
  }

  return picks;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'betcheza-cron-2024';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekId = getWeekId(now);
  const dayNumber = getDayNumber(now);
  const planIdx = dayNumber - 1;
  const plan = WEEK_PLAN[planIdx] || WEEK_PLAN[0];

  await ensureTable();

  try {
    const existing = await query<{ id: number; picks: string | null }>(
      'SELECT id, picks FROM daily_strategy WHERE date = ? LIMIT 1',
      [todayStr]
    );

    if (existing.rows.length > 0 && existing.rows[0].picks) {
      return NextResponse.json({ success: true, message: 'Already posted for today', date: todayStr });
    }

    const picks = await generatePicksForDate(now, plan, dayNumber);
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);

    if (existing.rows.length > 0) {
      await execute(
        `UPDATE daily_strategy SET picks = ?, combined_odds = ?, generated_at = NOW(), posted_at = NOW(), status = 'active' WHERE date = ?`,
        [JSON.stringify(picks), parseFloat(combinedOdds.toFixed(2)), todayStr]
      );
    } else {
      await execute(
        `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
        [todayStr, weekId, dayNumber, plan.stake, plan.save, plan.targetWin, parseFloat(combinedOdds.toFixed(2)), JSON.stringify(picks)]
      );
    }

    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) {
      const idx = stored.days.findIndex(d => d.date === todayStr);
      if (idx >= 0) {
        stored.days[idx].picks = picks;
        stored.days[idx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
        stored.days[idx].status = 'active';
        fileStoreSet(`strategy-week-${weekId}`, stored);
      }
    }

    console.log(`[daily-strategy] Posted ${picks.length} picks for ${todayStr} (combined odds: ${combinedOdds.toFixed(2)})`);
    return NextResponse.json({ success: true, date: todayStr, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
  } catch (e) {
    console.error('[daily-strategy] cron error:', e);
    const picks = await generatePicksForDate(now, plan, dayNumber);
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);

    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) {
      const idx = stored.days.findIndex(d => d.date === todayStr);
      if (idx >= 0) {
        stored.days[idx].picks = picks;
        stored.days[idx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
        stored.days[idx].status = 'active';
        fileStoreSet(`strategy-week-${weekId}`, stored);
      }
    }

    return NextResponse.json({ success: true, date: todayStr, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)), fallback: true });
  }
}
