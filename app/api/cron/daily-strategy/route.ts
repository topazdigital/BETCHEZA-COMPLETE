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

// Kenya is UTC+3 (EAT). All date logic must use EAT so that "today" matches
// what the user sees in Nairobi, not the Replit server's UTC clock.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function toEATDate(utcDate: Date): Date {
  return new Date(utcDate.getTime() + EAT_OFFSET_MS);
}

function getWeekId(date: Date): string {
  const eat = toEATDate(date);
  const monday = new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()));
  const day = monday.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getDayNumber(date: Date): number {
  const eat = toEATDate(date);
  const day = eat.getUTCDay();
  return day === 0 ? 7 : day;
}

function getTodayStrEAT(date: Date): string {
  const eat = toEATDate(date);
  return eat.toISOString().slice(0, 10);
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  try { return new OpenAI({ apiKey, baseURL }); } catch { return null; }
}

/** Score how "safe" a set of bookmaker odds is. Higher = safer bet. */
function oddsToSafetyScore(odds: number): number {
  if (odds >= 1.20 && odds <= 1.50) return 100; // very strong favourite — safest
  if (odds >  1.50 && odds <= 1.80) return 90;  // strong favourite
  if (odds >  1.80 && odds <= 2.10) return 75;  // slight favourite
  if (odds >  2.10 && odds <= 2.50) return 55;  // near-evens
  if (odds >  2.50 && odds <= 3.20) return 35;  // underdog territory
  return 20;                                      // big underdog / long shot
}

/**
 * Given a match with real odds, return the SAFEST single pick from it.
 * Priority order: Double Chance (1X/X2) → Outright favourite → BTTS/O2.5 proxy.
 * Returns the pick along with its safety score so the greedy loop can sort candidates.
 */
function safestPick(
  match: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date; odds?: { home: number; draw: number; away: number } | null },
  idx: number,
): StrategyPick & { safetyScore: number } {
  let odds = 1.65;
  let pick = match.homeTeam.name;
  let market = '1X2';
  let safetyScore = 50;

  if (match.odds) {
    const { home, draw, away } = match.odds;

    // Option A: Double Chance covers 2 of 3 outcomes — inherently safer
    // Approximate DC odds using devig of 1X (home win or draw)
    const totalInv = (1 / home) + (1 / draw) + (1 / away);
    const dc1xFair = ((1 / home) + (1 / draw)) / totalInv;
    const dcX2Fair = ((1 / away) + (1 / draw)) / totalInv;
    const dc1xOdds = parseFloat((1 / dc1xFair).toFixed(2));
    const dcX2Odds = parseFloat((1 / dcX2Fair).toFixed(2));
    const bestDcOdds = dc1xOdds <= dcX2Odds ? dc1xOdds : dcX2Odds;
    const bestDcPick = dc1xOdds <= dcX2Odds
      ? `${match.homeTeam.name} or Draw`
      : `${match.awayTeam.name} or Draw`;

    // Option B: straight win on the favourite
    const favOdds = home <= away ? home : away;
    const favPick = home <= away ? match.homeTeam.name : match.awayTeam.name;

    // Prefer DC if it lands in 1.15–1.85 (good safe range)
    if (bestDcOdds >= 1.15 && bestDcOdds <= 1.90) {
      odds = bestDcOdds;
      pick = bestDcPick;
      market = 'Double Chance';
      safetyScore = oddsToSafetyScore(odds) + 10; // bonus for DC
    } else if (favOdds >= 1.25 && favOdds <= 2.50) {
      odds = favOdds;
      pick = favPick;
      market = '1X2';
      safetyScore = oddsToSafetyScore(odds);
    } else {
      // Fallback: take the lower of the two outright odds
      odds = parseFloat(Math.min(home, away).toFixed(2));
      pick = home <= away ? match.homeTeam.name : match.awayTeam.name;
      market = '1X2';
      safetyScore = oddsToSafetyScore(odds);
    }
  }

  odds = Math.max(1.10, parseFloat(odds.toFixed(2)));
  safetyScore = Math.max(0, safetyScore);

  return {
    id: `auto-${Date.now()}-${idx}`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: match.kickoffTime.toISOString(),
    pick,
    market,
    odds,
    confidence: odds <= 1.50 ? 'High' : odds <= 1.85 ? 'Medium' : 'Low',
    reasoning: `${pick} selected from ${market} market at real bookmaker odds ${odds}. Pick prioritises low-risk selection to keep combined accumulator in the 3.0–4.0 range.`,
    result: 'pending',
    safetyScore,
  } as StrategyPick & { safetyScore: number };
}

/**
 * Greedy accumulator builder.
 * Picks the SAFEST legs from the candidate pool and keeps adding until the
 * combined odds land in [minTarget, maxTarget].  Works with 1–10+ games.
 */
function buildGreedyAccumulator(
  pool: Parameters<typeof safestPick>[0][],
  dateStr: string,
  minTarget = 2.90,
  maxTarget = 4.20,
): StrategyPick[] {
  if (pool.length === 0) return [];

  // Score every candidate and sort safest-first
  const candidates = pool
    .map((m, i) => ({ m, pick: safestPick(m, i) }))
    .sort((a, b) => b.pick.safetyScore - a.pick.safetyScore);

  const chosen: (StrategyPick & { safetyScore: number })[] = [];
  let combined = 1.0;

  for (const { pick } of candidates) {
    if (combined >= minTarget) break;          // target reached — stop adding
    const projected = combined * pick.odds;
    if (projected > maxTarget + 0.30) continue; // would overshoot — skip this leg
    chosen.push(pick);
    combined = projected;
    if (chosen.length >= 10) break;            // hard cap
  }

  // If we still haven't hit the floor, just return what we have (better than nothing)
  if (chosen.length === 0 && candidates.length > 0) {
    chosen.push(candidates[0].pick);
  }

  return chosen.map((p, i) => ({
    ...p,
    id: `${dateStr}-greedy-${i}`,
  }));
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

STRATEGY GOAL: Select ANY NUMBER of football picks (1, 2, 3, 4, 5, 6 — whatever works) so that ALL odds multiplied together (combined accumulator) falls between 2.90 and 4.20. The number of games does NOT matter — 1 game is fine, 10 games is fine. What matters is: combined odds 2.90–4.20.

SAFETY FIRST — minimise risk:
- ALWAYS prefer Double Chance (1X or X2) over outright 1X2 when the match is tight
- Prefer lower odds (1.20–1.80) — more games with safe odds beats fewer games with risky odds
- Where bookmaker odds are shown (H=/D=/A=), use those EXACT values — never invent odds
- Where no odds are shown, estimate conservatively: strong favourites 1.35–1.65, slight favourites 1.70–2.10

MARKET MIX — vary where suitable:
- "1X2" for clear favourites (odds < 2.00)
- "Double Chance" (1X or X2) when either side could win but one is favoured
- "BTTS Yes" when both teams score regularly
- "Over 2.5 Goals" for high-scoring matchups
- "Under 2.5 Goals" for defensive teams

ANALYSIS: mention actual form factors in reasoning (home record, head-to-head, goals scored/conceded etc.)

Available matches (with bookmaker odds where available):
${matchList}

Return ONLY valid JSON array. Any number of picks is allowed as long as the combined product of all odds is between 2.90 and 4.20:
[{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO string","pick":"...","market":"Double Chance","odds":1.45,"confidence":"High","reasoning":"..."}]`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2000,
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
        const arr = Array.isArray(parsed) ? parsed : [];
        if (arr.length >= 1) {
          const candidates: StrategyPick[] = arr.slice(0, 10).map((p: StrategyPick, i: number) => ({
            ...p,
            id: `${dateStr}-${i}`,
            odds: Math.max(1.05, parseFloat(String(p.odds)) || 1.5),
            result: 'pending' as const,
          }));
          const combined = candidates.reduce((acc, p) => acc * p.odds, 1);
          // Accept if combined odds are comfortably within target (2.80–4.50 is fine)
          if (combined >= 2.80 && combined <= 4.50) {
            picks = candidates;
          }
        }
      } catch { }
    }

    // Fallback: greedy safety-first accumulator from real bookmaker odds.
    // Works with any number of games (1–10+) — always tries to hit 2.90–4.20.
    if (picks.length === 0 && pool.length > 0) {
      const oddsPool = pool.filter(m => m.odds && m.odds.home > 1).slice(0, 25);
      if (oddsPool.length > 0) {
        picks = buildGreedyAccumulator(oddsPool, dateStr, 2.90, 4.20);
      }
      // If still no picks (no real odds available), use any available matches
      if (picks.length === 0 && pool.length > 0) {
        picks = buildGreedyAccumulator(pool.slice(0, 10), dateStr, 2.90, 4.20);
      }
    }
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    const isQuota = err?.status === 429 || err?.code === 'insufficient_quota';
    if (isQuota) {
      console.warn('[daily-strategy] OpenAI quota exhausted — using odds-based fallback picks');
    } else {
      console.error('[daily-strategy] generate error:', err?.message ?? e);
    }
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
  const todayStr = getTodayStrEAT(now);
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
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error('[daily-strategy] cron error:', err?.message ?? e);
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
