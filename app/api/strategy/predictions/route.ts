import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getCurrentUser } from '@/lib/auth';
import { query, execute } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface StrategyPick {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchTime: string;
  pick: string;
  market: string;
  odds: number;
  confidence: 'Low' | 'Medium' | 'High';
  reasoning: string;
  result?: 'win' | 'loss' | 'pending';
  actualScore?: string;
}

export interface DayPrediction {
  day: number;
  date: string;
  stake: number;
  save: number;
  targetWin: number;
  picks: StrategyPick[];
  combinedOdds: number;
  status: 'upcoming' | 'active' | 'completed';
  result?: 'win' | 'loss';
  actualReturn?: number;
  isManual?: boolean;
  scheduledFor?: string | null;
}

export interface WeeklyStrategy {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  days: DayPrediction[];
  generatedAt: string;
  totalSavings: number;
  totalWinnings: number;
  weeklyProfit: number;
}

const WEEK_PLAN: Array<{ stake: number; save: number; targetWin: number }> = [
  { stake: 1000,  save: 0,      targetWin: 3000  },
  { stake: 1500,  save: 1500,   targetWin: 4500  },
  { stake: 2500,  save: 2000,   targetWin: 7500  },
  { stake: 5000,  save: 2500,   targetWin: 15000 },
  { stake: 10000, save: 5000,   targetWin: 30000 },
  { stake: 15000, save: 15000,  targetWin: 45000 },
  { stake: 20000, save: 25000,  targetWin: 60000 },
];

// Kenya is UTC+3 (EAT). All date logic uses EAT so "today" matches what
// users see in Nairobi regardless of the Replit server's UTC clock.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function toEATDate(utcDate: Date): Date {
  return new Date(utcDate.getTime() + EAT_OFFSET_MS);
}

function getTodayStrEAT(utcDate: Date): string {
  const eat = toEATDate(utcDate);
  return eat.toISOString().slice(0, 10);
}

function getWeekId(date: Date): string {
  const eat = toEATDate(date);
  const monday = new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()));
  const day = monday.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

interface DbRow {
  date: string;
  week_id: string;
  day_number: number;
  stake: number;
  save_amount: number;
  target_win: number;
  combined_odds: number | string;
  status: 'upcoming' | 'active' | 'completed';
  result: 'win' | 'loss' | null;
  actual_return: number | null;
  picks: string | null;
  is_manual: number | null;
  scheduled_for: string | null;
}

async function loadFromDb(weekId: string): Promise<DayPrediction[] | null> {
  try {
    const weekStart = new Date(weekId);
    const weekEnd = new Date(weekId);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);

    const result = await query<DbRow>(
      'SELECT * FROM daily_strategy WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [startStr, endStr]
    );
    if (!result.rows.length) return null;

    const days: DayPrediction[] = result.rows.map((row) => ({
      day: row.day_number,
      date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
      stake: row.stake,
      save: row.save_amount,
      targetWin: row.target_win,
      picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [],
      combinedOdds: parseFloat(String(row.combined_odds)) || 0,
      status: row.status,
      result: row.result || undefined,
      actualReturn: row.actual_return || undefined,
      isManual: row.is_manual === 1,
      scheduledFor: row.scheduled_for || null,
    }));

    return days;
  } catch {
    return null;
  }
}

async function loadPastWeeksFromDb(): Promise<WeeklyStrategy[]> {
  const weeks: WeeklyStrategy[] = [];
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const result = await query<DbRow>(
      'SELECT * FROM daily_strategy WHERE date >= ? AND date < ? ORDER BY date DESC',
      [cutoff, getWeekId(new Date())]
    );

    const byWeek = new Map<string, DbRow[]>();
    for (const row of result.rows) {
      const wid = row.week_id;
      if (!byWeek.has(wid)) byWeek.set(wid, []);
      byWeek.get(wid)!.push(row);
    }

    for (const [wid, rows] of byWeek) {
      const weekStart = new Date(wid);
      const weekEnd = new Date(wid);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const days: DayPrediction[] = rows.map((row) => ({
        day: row.day_number,
        date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
        stake: row.stake,
        save: row.save_amount,
        targetWin: row.target_win,
        picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [],
        combinedOdds: parseFloat(String(row.combined_odds)) || 0,
        status: row.status,
        result: row.result || undefined,
        actualReturn: row.actual_return || undefined,
        isManual: row.is_manual === 1,
        scheduledFor: row.scheduled_for || null,
      }));
      weeks.push({
        weekId: wid,
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        days,
        generatedAt: new Date().toISOString(),
        totalSavings: 0,
        totalWinnings: 0,
        weeklyProfit: 0,
      });
    }
  } catch { }
  return weeks;
}

function buildEmptyWeek(weekId: string): WeeklyStrategy {
  const weekStart = new Date(weekId);
  const weekEnd = new Date(weekId);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const days: DayPrediction[] = WEEK_PLAN.map((plan, i) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const today = new Date();
    const status: DayPrediction['status'] =
      dayDate.toDateString() === today.toDateString()
        ? 'active'
        : dayDate < today
        ? 'completed'
        : 'upcoming';

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

  return {
    weekId,
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    days,
    generatedAt: new Date().toISOString(),
    totalSavings: 49000,
    totalWinnings: 60000,
    weeklyProfit: 108000,
  };
}

function buildAutoFallbackPicks(_dateStr: string): StrategyPick[] {
  // No real matches available — return empty rather than fake placeholder data
  return [];
}

async function autoGenerateTodayPicks(weekId: string, todayStr: string, dayNumber: number): Promise<StrategyPick[]> {
  const planIdx = Math.max(0, dayNumber - 1);
  const plan = WEEK_PLAN[planIdx] || WEEK_PLAN[0];

  try {
    // Try to get matches from the sports API
    const { getUpcomingMatches } = await import('@/lib/api/unified-sports-api');
    const upcoming = await getUpcomingMatches();
    const today = new Date(todayStr);

    const soccer = upcoming.filter(
      (m: { sport: { slug: string } }) => m.sport.slug === 'soccer' || m.sport.slug === 'football'
    );
    const dayMatches = soccer.filter((m: { kickoffTime: Date }) =>
      new Date(m.kickoffTime).toDateString() === today.toDateString()
    ).slice(0, 25);

    const pool = dayMatches.length >= 2 ? dayMatches : soccer.slice(0, 25);

    if (pool.length === 0) return buildAutoFallbackPicks(todayStr);

    // Try AI generation
    const { default: OpenAI } = await import('openai');
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
      const openai = new OpenAI({ apiKey, baseURL });

      const matchList = pool
        .map((m: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; odds?: { home: number; draw: number; away: number } }) =>
          `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.league.name}${m.odds ? `, H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''})`
        ).join('\n');

      const prompt = `You are a football betting analyst for the Betcheza "3 Daily Odds" Strategy.

Date: ${today.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
Day ${dayNumber} — stake KES ${plan.stake.toLocaleString()}, target KES ${plan.targetWin.toLocaleString()}.

Select 1–5 football picks so that the COMBINED MULTIPLIED ODDS fall between 3.00 and 4.00.
Example: 2 picks at 1.80 each = 3.24 combined. Or 1 pick at 3.50 = 3.50.
You may use ANY market available in the odds (1X2 Home/Draw/Away, Double Chance, BTTS Yes/No, Over/Under 2.5, Asian Handicap, etc).
Choose markets that offer the best value based on the odds provided — do not limit to one market type.
Only use odds that are actually listed for the match — never invent odds.

Matches:
${matchList}

Return ONLY a JSON array (1–5 picks):
[{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO","pick":"...","market":"...","odds":1.85,"confidence":"High","reasoning":"..."}]

REQUIRED: product of all odds must be between 3.00 and 4.00.`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1200,
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
      const arr = Array.isArray(parsed) ? parsed : [];
      if (arr.length >= 1) {
        const picks: StrategyPick[] = arr.slice(0, 5).map((p: Partial<StrategyPick>, i: number) => ({
          ...p,
          id: `${todayStr}-ai-${i}`,
          odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
          result: 'pending' as const,
        }));
        const combined = picks.reduce((acc, p) => acc * p.odds, 1);
        if (combined >= 2.5 && combined <= 5.5) return picks;
      }
    }

    // Fallback: pick matches from pool using the best available real bookmaker odds.
    // For each match pick the single best-value selection across ALL available markets.
    interface PoolMatch {
      homeTeam: { name: string };
      awayTeam: { name: string };
      league: { name: string };
      kickoffTime: Date;
      odds?: { home: number; draw?: number; away: number };
      markets?: Array<{ key?: string; name: string; outcomes?: Array<{ name: string; price: number }> }>;
    }

    interface Candidate {
      pick: string;
      market: string;
      odds: number;
      score: number; // how close to target 1.5–2.2 per leg
    }

    function bestSelectionForMatch(m: PoolMatch): { pick: string; market: string; odds: number } | null {
      const candidates: Candidate[] = [];
      const score = (o: number) => -Math.abs(o - 1.75); // target ~1.75 per leg

      // Scan full markets array (BTTS, Over/Under, Asian Handicap, etc.)
      if (m.markets && m.markets.length > 0) {
        for (const mkt of m.markets) {
          for (const out of mkt.outcomes || []) {
            if (out.price >= 1.2 && out.price <= 3.5) {
              candidates.push({ pick: out.name, market: mkt.name, odds: out.price, score: score(out.price) });
            }
          }
        }
      }

      // Also consider h2h (1X2) from the simplified odds object
      if (m.odds) {
        if (m.odds.home >= 1.2 && m.odds.home <= 3.5) {
          candidates.push({ pick: `${m.homeTeam.name} Win`, market: '1X2', odds: m.odds.home, score: score(m.odds.home) });
        }
        if (m.odds.draw && m.odds.draw >= 1.2 && m.odds.draw <= 3.5) {
          candidates.push({ pick: 'Draw', market: '1X2', odds: m.odds.draw, score: score(m.odds.draw) });
        }
        if (m.odds.away >= 1.2 && m.odds.away <= 3.5) {
          candidates.push({ pick: `${m.awayTeam.name} Win`, market: '1X2', odds: m.odds.away, score: score(m.odds.away) });
        }
        // Double Chance: proper bookmaker DC odds use whichever side is shorter
        if (m.odds.draw) {
          const dcHome = parseFloat(Math.min(m.odds.home, m.odds.draw).toFixed(2));
          const dcAway = parseFloat(Math.min(m.odds.away, m.odds.draw).toFixed(2));
          if (dcHome >= 1.05) candidates.push({ pick: `${m.homeTeam.name} Win or Draw`, market: 'Double Chance', odds: dcHome, score: score(dcHome) });
          if (dcAway >= 1.05) candidates.push({ pick: `${m.awayTeam.name} Win or Draw`, market: 'Double Chance', odds: dcAway, score: score(dcAway) });
        }
      }

      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.score - a.score);
      return { pick: candidates[0].pick, market: candidates[0].market, odds: candidates[0].odds };
    }

    // Greedy: keep adding picks until combined odds are 3.0–4.0
    const picks: StrategyPick[] = [];
    let combined = 1;
    for (let i = 0; i < Math.min(pool.length, 10) && picks.length < 5; i++) {
      const m = pool[i] as PoolMatch;
      const sel = bestSelectionForMatch(m);
      if (!sel) continue;
      // Skip if adding this pick would blow past 4.5 combined
      if (combined * sel.odds > 4.5 && picks.length >= 1) continue;
      picks.push({
        id: `${todayStr}-pool-${i}`,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        matchTime: new Date(m.kickoffTime).toISOString(),
        pick: sel.pick,
        market: sel.market,
        odds: sel.odds,
        confidence: 'Medium' as const,
        reasoning: `Value pick based on available bookmaker odds for this fixture.`,
        result: 'pending' as const,
      });
      combined = picks.reduce((acc, p) => acc * p.odds, 1);
      if (combined >= 3.0 && combined <= 4.5) break;
    }
    if (picks.length === 0) return buildAutoFallbackPicks(todayStr);
    return picks;
  } catch {
    return buildAutoFallbackPicks(todayStr);
  }
}

async function loadCurrentWeek(): Promise<WeeklyStrategy> {
  const now = new Date();
  const weekId = getWeekId(now);
  const todayStr = getTodayStrEAT(now);
  const eat = toEATDate(now);
  const dayNumber = (() => { const d = eat.getUTCDay(); return d === 0 ? 7 : d; })();

  // Try DB first
  const dbDays = await loadFromDb(weekId);
  if (dbDays && dbDays.length > 0) {
    const empty = buildEmptyWeek(weekId);
    const merged = empty.days.map((d) => {
      const fromDb = dbDays.find((r) => r.date === d.date);
      const base = fromDb ?? d;
      // Always recompute status from today's actual date — DB status may be stale
      // (a day that was 'active' yesterday stays 'active' in the DB unless settled)
      let status: DayPrediction['status'];
      if (base.date === todayStr) {
        status = 'active';
      } else if (base.date < todayStr) {
        status = 'completed';
      } else {
        status = 'upcoming';
      }
      // Always use the template's day number — DB day_number can be wrong due to
      // timezone differences at the time of insertion (e.g. UTC vs EAT).
      // The correct day number is always the positional index in the week (1=Mon … 7=Sun).
      return { ...base, status, day: d.day, stake: d.stake, save: d.save, targetWin: d.targetWin };
    });

    // Auto-generate today's picks if today is active but has no picks AND not manually posted
    const todayIdx = merged.findIndex((d) => d.date === todayStr);
    if (todayIdx >= 0 && merged[todayIdx].picks.length === 0 && !merged[todayIdx].isManual) {
      try {
        const autoPicks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
        const combined = autoPicks.reduce((acc, p) => acc * p.odds, 1);
        merged[todayIdx].picks = autoPicks;
        merged[todayIdx].combinedOdds = parseFloat(combined.toFixed(2));
        merged[todayIdx].status = 'active';
        // Persist to DB
        await execute(
          `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, is_manual, generated_at, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, NOW(), NOW())
           ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), status = 'active',
             day_number = VALUES(day_number), stake = VALUES(stake), save_amount = VALUES(save_amount),
             target_win = VALUES(target_win), generated_at = NOW()`,
          [todayStr, weekId, dayNumber, merged[todayIdx].stake, merged[todayIdx].save, merged[todayIdx].targetWin, merged[todayIdx].combinedOdds, JSON.stringify(autoPicks)]
        ).catch(() => undefined);
      } catch { /* non-fatal */ }
    }

    return { ...empty, days: merged };
  }

  // File store fallback
  const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
  if (stored && stored.weekId === weekId) {
    // Auto-generate for today if empty
    const todayIdx = stored.days.findIndex((d) => d.date === todayStr);
    if (todayIdx >= 0 && stored.days[todayIdx].picks.length === 0) {
      try {
        const autoPicks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
        const combined = autoPicks.reduce((acc, p) => acc * p.odds, 1);
        stored.days[todayIdx].picks = autoPicks;
        stored.days[todayIdx].combinedOdds = parseFloat(combined.toFixed(2));
        stored.days[todayIdx].status = 'active';
        fileStoreSet(`strategy-week-${weekId}`, stored);
      } catch { /* non-fatal */ }
    }
    return stored;
  }

  // Build empty week and auto-generate today
  const empty = buildEmptyWeek(weekId);
  const todayIdx = empty.days.findIndex((d) => d.date === todayStr);
  if (todayIdx >= 0) {
    try {
      const autoPicks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
      const combined = autoPicks.reduce((acc, p) => acc * p.odds, 1);
      empty.days[todayIdx].picks = autoPicks;
      empty.days[todayIdx].combinedOdds = parseFloat(combined.toFixed(2));
      empty.days[todayIdx].status = 'active';
      // Persist to DB
      await ensureTableExists();
      await execute(
        `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), status = 'active',
           day_number = VALUES(day_number), stake = VALUES(stake), save_amount = VALUES(save_amount),
           target_win = VALUES(target_win), generated_at = NOW()`,
        [todayStr, weekId, dayNumber, empty.days[todayIdx].stake, empty.days[todayIdx].save, empty.days[todayIdx].targetWin, empty.days[todayIdx].combinedOdds, JSON.stringify(autoPicks)]
      ).catch(() => undefined);
      fileStoreSet(`strategy-week-${weekId}`, empty);
    } catch { /* non-fatal */ }
  }
  return empty;
}

async function ensureTableExists(): Promise<void> {
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
        is_manual tinyint(1) NOT NULL DEFAULT 0,
        scheduled_for date DEFAULT NULL,
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
    // Add columns if they don't exist (for existing tables)
    await query(`ALTER TABLE daily_strategy ADD COLUMN IF NOT EXISTS is_manual tinyint(1) NOT NULL DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE daily_strategy ADD COLUMN IF NOT EXISTS scheduled_for date DEFAULT NULL`).catch(() => {});
  } catch { }
}

async function loadPastWeeks(): Promise<WeeklyStrategy[]> {
  // Try DB first
  const dbWeeks = await loadPastWeeksFromDb();
  if (dbWeeks.length > 0) return dbWeeks;

  // File store fallback
  const weeks: WeeklyStrategy[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const weekId = getWeekId(d);
    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) weeks.push(stored);
  }
  return weeks;
}

function checkPickResultLocal(
  pick: StrategyPick,
  homeScore: number,
  awayScore: number,
): 'win' | 'loss' | null {
  const market = (pick.market || '').toLowerCase();
  const pickValue = (pick.pick || '').toLowerCase();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const homeNorm = norm(pick.homeTeam);
  const awayNorm = norm(pick.awayTeam);
  const pickNorm = norm(pickValue);
  const total = homeScore + awayScore;

  // ── 1X2 ────────────────────────────────────────────────────────────────
  if (market === '1x2') {
    if (homeScore > awayScore) return pickNorm === homeNorm || pickValue.includes('home') || pickNorm === 'homewin' ? 'win' : 'loss';
    if (awayScore > homeScore) return pickNorm === awayNorm || pickValue.includes('away') || pickNorm === 'awaywin' ? 'win' : 'loss';
    return pickValue.includes('draw') || pickNorm === 'draw' || pickNorm === 'x' ? 'win' : 'loss';
  }

  // ── Double Chance ───────────────────────────────────────────────────────
  if (market === 'double chance') {
    const isX2 = pickValue.includes('x2') || (pickValue.includes('away') && (pickValue.includes('draw') || pickValue.includes('or')));
    const is1X = pickValue.includes('1x') || (pickValue.includes('home') && (pickValue.includes('draw') || pickValue.includes('or')));
    if (isX2) return awayScore >= homeScore ? 'win' : 'loss';
    if (is1X) return homeScore >= awayScore ? 'win' : 'loss';
    return homeScore !== awayScore ? 'win' : 'loss';
  }

  // ── Draw No Bet ─────────────────────────────────────────────────────────
  if (market === 'draw no bet' || market.includes('draw no bet') || market === 'dnb') {
    if (homeScore === awayScore) return null; // void/push on draw — keep pending display
    if (pickValue.includes('home') || pickNorm === homeNorm) return homeScore > awayScore ? 'win' : 'loss';
    if (pickValue.includes('away') || pickNorm === awayNorm) return awayScore > homeScore ? 'win' : 'loss';
    return null;
  }

  // ── Over/Under (goals, corners, cards, etc.) ────────────────────────────
  if (market.includes('over') || market.includes('under') || market.includes('total') || market.includes('o/u') || market.includes('ou')) {
    const over = pickValue.match(/over\s*([\d.]+)/i);
    const under = pickValue.match(/under\s*([\d.]+)/i);
    // For corners/cards we don't have that data — fall back to goals total
    if (market.includes('goal') || market.includes('total goals') || market === 'over/under') {
      if (over) return total > parseFloat(over[1]) ? 'win' : 'loss';
      if (under) return total < parseFloat(under[1]) ? 'win' : 'loss';
    } else if (market.includes('corner')) {
      // We don't have corner data — cannot settle
      return null;
    } else {
      // Generic o/u on goals
      if (over) return total > parseFloat(over[1]) ? 'win' : 'loss';
      if (under) return total < parseFloat(under[1]) ? 'win' : 'loss';
    }
  }

  // ── BTTS ────────────────────────────────────────────────────────────────
  if (market === 'btts' || market.includes('both teams to score') || market === 'both teams score') {
    const btts = homeScore > 0 && awayScore > 0;
    const wantYes = pickValue === 'yes' || pickValue.includes('yes');
    return wantYes ? (btts ? 'win' : 'loss') : (!btts ? 'win' : 'loss');
  }

  // ── Asian Handicap (approximate) ────────────────────────────────────────
  if (market.includes('asian handicap') || market.includes('handicap')) {
    const hcpMatch = pickValue.match(/([+-]?\d+(?:\.\d+)?)/);
    if (hcpMatch) {
      const hcp = parseFloat(hcpMatch[1]);
      const isHome = pickValue.includes('home') || pickNorm.startsWith(homeNorm.slice(0, 4));
      const adjustedMargin = isHome ? (homeScore - awayScore + hcp) : (awayScore - homeScore + hcp);
      if (adjustedMargin > 0) return 'win';
      if (adjustedMargin < 0) return 'loss';
      return null; // push
    }
  }

  // ── Correct Score ───────────────────────────────────────────────────────
  if (market.includes('correct score')) {
    const scoreMatch = pickValue.match(/(\d+)[:\-](\d+)/);
    if (scoreMatch) {
      return parseInt(scoreMatch[1]) === homeScore && parseInt(scoreMatch[2]) === awayScore ? 'win' : 'loss';
    }
  }

  // ── Half-Time Result ────────────────────────────────────────────────────
  // We don't have HT data from the API — cannot settle
  if (market.includes('half') || market.includes('ht')) return null;

  return null;
}

async function autoSettleCompletedPicks(days: DayPrediction[]): Promise<DayPrediction[]> {
  const todayStr = getTodayStrEAT(new Date());
  // Include today's picks so subscribers see results as each match finishes
  const hasPending = days.some(d => d.date <= todayStr && d.picks.some(p => p.result === 'pending'));
  if (!hasPending) return days;

  type MatchEntry = { homeTeam: { name: string }; awayTeam: { name: string }; status: string; homeScore: number | null; awayScore: number | null };
  let allMatches: MatchEntry[] = [];
  try {
    const { getAllMatches } = await import('@/lib/api/unified-sports-api');
    allMatches = await getAllMatches() as MatchEntry[];
  } catch { /* continue with empty list */ }

  // Secondary: pull finished matches directly from DB match_cache to catch leagues
  // (ISL, CSL, etc.) that may not surface in the in-memory cache at settle time.
  try {
    const dbResult = await query<{ payload: string }>(`SELECT payload FROM match_cache WHERE cache_key = 'all_matches' LIMIT 1`);
    if (dbResult.rows.length) {
      const dbMatches: MatchEntry[] = JSON.parse(dbResult.rows[0].payload);
      const existing = new Set(allMatches.map(m => `${m.homeTeam?.name}|${m.awayTeam?.name}`));
      for (const m of dbMatches) {
        if (m.status === 'finished' && !existing.has(`${m.homeTeam?.name}|${m.awayTeam?.name}`)) {
          allMatches.push(m);
        }
      }
    }
  } catch { /* non-fatal */ }

  if (allMatches.length === 0) return days;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const updated = days.map(day => {
    // Skip future days (but allow today and past)
    if (day.date > todayStr) return day;
    if (!day.picks.some(p => p.result === 'pending')) return day;

    let changed = false;
    const updatedPicks = day.picks.map(pick => {
      if (pick.result !== 'pending') return pick;
      const ph = norm(pick.homeTeam);
      const pa = norm(pick.awayTeam);
      const match = allMatches.find(m => {
        if (m.status !== 'finished' || m.homeScore === null || m.awayScore === null) return false;
        const mh = norm(m.homeTeam.name);
        const ma = norm(m.awayTeam.name);
        return (mh === ph || mh.includes(ph) || ph.includes(mh)) &&
               (ma === pa || ma.includes(pa) || pa.includes(ma));
      });
      if (!match || match.homeScore === null || match.awayScore === null) return pick;
      const result = checkPickResultLocal(pick, match.homeScore, match.awayScore);
      if (!result) return pick;
      changed = true;
      return { ...pick, result, actualScore: `${match.homeScore}-${match.awayScore}` };
    });

    if (!changed) return day;

    const allSettled = updatedPicks.every(p => p.result !== 'pending');
    const allWon = allSettled && updatedPicks.every(p => p.result === 'win');
    const updatedDay: DayPrediction = {
      ...day,
      picks: updatedPicks,
      ...(allSettled ? { result: allWon ? 'win' : 'loss', status: 'completed' as const } : {}),
    };

    execute(
      `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = NOW() WHERE date = ?`,
      [JSON.stringify(updatedPicks), updatedDay.result ?? null, updatedDay.status, day.date]
    ).catch(() => undefined);

    return updatedDay;
  });

  return updated;
}

export async function GET() {
  const current = await loadCurrentWeek();
  current.days = await autoSettleCompletedPicks(current.days);
  const past = await loadPastWeeks();
  return NextResponse.json({ current, past });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const weekId = getWeekId(new Date());
  const current = await loadCurrentWeek();

  if (body.picks && typeof body.day === 'number') {
    const dayIdx = body.day - 1;
    if (dayIdx >= 0 && dayIdx < current.days.length) {
      const isManual = body.isManual === true;
      const scheduledFor: string | null = body.scheduledFor || null;
      current.days[dayIdx].picks = body.picks;
      const combined = body.picks.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
      current.days[dayIdx].combinedOdds = parseFloat(combined.toFixed(2));
      if (isManual) current.days[dayIdx].isManual = true;
      if (scheduledFor) current.days[dayIdx].scheduledFor = scheduledFor;

      const dayData = current.days[dayIdx];
      // For scheduled posts, use the target date instead of today
      const targetDate = scheduledFor || dayData.date;
      const targetStatus = scheduledFor && scheduledFor > getTodayStrEAT(new Date()) ? 'upcoming' : 'active';
      try {
        await ensureTableExists();
        await execute(
          `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, is_manual, scheduled_for, generated_at, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), is_manual = VALUES(is_manual), scheduled_for = VALUES(scheduled_for), generated_at = NOW(), posted_at = NOW(), status = VALUES(status)`,
          [targetDate, weekId, dayData.day, dayData.stake, dayData.save, dayData.targetWin, dayData.combinedOdds, targetStatus, JSON.stringify(body.picks), isManual ? 1 : 0, scheduledFor]
        );
      } catch { }
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  if (body.result && typeof body.day === 'number') {
    const dayIdx = body.day - 1;
    if (dayIdx >= 0 && dayIdx < current.days.length) {
      current.days[dayIdx].result = body.result;
      current.days[dayIdx].actualReturn = body.actualReturn;
      if (body.picksResults) {
        current.days[dayIdx].picks = current.days[dayIdx].picks.map((p, i) => ({
          ...p,
          result: body.picksResults[i] || p.result,
          actualScore: body.actualScores?.[i] || p.actualScore,
        }));
      }

      const dayData = current.days[dayIdx];
      try {
        await execute(
          `UPDATE daily_strategy SET result = ?, actual_return = ?, picks = ?, status = 'completed', settled_at = NOW()
           WHERE date = ?`,
          [body.result, body.actualReturn || null, JSON.stringify(dayData.picks), dayData.date]
        );
      } catch { }
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
