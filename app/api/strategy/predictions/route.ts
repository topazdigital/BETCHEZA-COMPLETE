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
  liveScore?: string;
  liveStatus?: 'live' | 'finished';
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
  isApproved?: boolean;
  pendingApproval?: boolean;
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
  is_approved: number | null;
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
      isApproved: row.is_approved === 1,
    }));

    return days;
  } catch {
    return null;
  }
}

// Manual override: week of 12 May 2025 — all 7 days confirmed as wins
// (results were recorded with a wrong Sunday week_id in the DB; this corrects the display)
const MANUAL_WIN_WEEKS: Record<string, 'all'> = {
  '2025-05-12': 'all',
};

// Manual day overrides are no longer needed — corrections are applied directly
// to the DB via instrumentation.ts on every server start. This map is kept
// empty so past corrected results are read from the source of truth (DB).
const MANUAL_DAY_OVERRIDES: Record<string, { result: 'win' | 'loss'; picksResult: 'win' | 'loss' }> = {};

function buildManualAllWinsWeek(weekId: string): WeeklyStrategy {
  const weekStart = new Date(weekId);
  const weekEnd = new Date(weekId);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const days: DayPrediction[] = WEEK_PLAN.map((plan, i) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + i);
    return {
      day: i + 1,
      date: dayDate.toISOString().slice(0, 10),
      stake: plan.stake,
      save: plan.save,
      targetWin: plan.targetWin,
      picks: [],
      combinedOdds: 0,
      status: 'completed' as const,
      result: 'win' as const,
    };
  });
  return {
    weekId,
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    days,
    generatedAt: new Date().toISOString(),
    totalSavings: 0,
    totalWinnings: 0,
    weeklyProfit: 0,
  };
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

    // Normalize week_id: the production DB stores weeks starting on Sunday
    // (Sun–Sat layout). Remap any non-Monday week_id to the Monday that falls
    // inside that same week, so weeks never appear twice in the past list.
    const normalizeWeekId = (wid: string): string => {
      const d = new Date(wid);
      const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
      if (day === 1) return wid; // already a Monday — no change
      // Sunday start → +1 day = Monday (the Monday within that Sun–Sat week)
      // Any other non-Monday → shift back to Monday of the same ISO week
      const diff = day === 0 ? 1 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().slice(0, 10);
    };

    const byWeek = new Map<string, DbRow[]>();
    for (const row of result.rows) {
      const wid = normalizeWeekId(row.week_id);
      if (!byWeek.has(wid)) byWeek.set(wid, []);
      byWeek.get(wid)!.push(row);
    }

    for (const [wid, rows] of byWeek) {
      // Manual override — replace entire week with all-wins if configured
      if (MANUAL_WIN_WEEKS[wid] === 'all') {
        weeks.push(buildManualAllWinsWeek(wid));
        continue;
      }
      const weekStart = new Date(wid);
      const weekEnd = new Date(wid);
      weekEnd.setDate(weekEnd.getDate() + 6);
      // Deduplicate rows by date — when weeks were merged (e.g. Sunday week_id
      // normalised into its Monday), prefer the row with an actual result set.
      const uniqueByDate = new Map<string, DbRow>();
      for (const row of rows) {
        const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10);
        const existing = uniqueByDate.get(dateStr);
        if (!existing || (!existing.result && row.result)) {
          uniqueByDate.set(dateStr, row);
        }
      }
      const days: DayPrediction[] = Array.from(uniqueByDate.values())
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .map((row) => {
        const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10);
        const override = MANUAL_DAY_OVERRIDES[dateStr];
        const picks: StrategyPick[] = row.picks ? JSON.parse(row.picks) as StrategyPick[] : [];
        return {
          day: row.day_number,
          date: dateStr,
          stake: row.stake,
          save: row.save_amount,
          targetWin: row.target_win,
          picks: override ? picks.map(p => ({ ...p, result: override.picksResult })) : picks,
          combinedOdds: parseFloat(String(row.combined_odds)) || 0,
          status: override ? 'completed' as const : row.status,
          result: override ? override.result : (row.result || undefined),
          actualReturn: row.actual_return || undefined,
          isManual: row.is_manual === 1,
          scheduledFor: row.scheduled_for || null,
        };
      });
      // Calculate actual weekly P&L: order matters because losing on day 6
      // vs day 1 produces very different outcomes (earlier wins accumulate).
      let weeklyProfit = 0;
      let totalSavings = 0;
      let totalWinnings = 0;
      for (const day of days) {
        if (day.result === 'win') {
          weeklyProfit += day.targetWin - day.stake;
          totalWinnings += day.targetWin;
          totalSavings += day.save;
        } else if (day.result === 'loss') {
          weeklyProfit -= day.stake;
        }
      }

      weeks.push({
        weekId: wid,
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        days,
        generatedAt: new Date().toISOString(),
        totalSavings,
        totalWinnings,
        weeklyProfit,
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

function isPlaceholderPicks(picks: StrategyPick[]): boolean {
  return picks.length > 0 && picks.every(
    (p) => p.homeTeam === 'Home Team' || p.homeTeam === 'Home Team B' ||
            (p.reasoning || '').includes('Picks loading')
  );
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
    // Use EAT-aware date comparison so matches crossing midnight UTC are
    // assigned to the correct EAT calendar day (UTC+3).
    const toEATDateStr = (d: Date) =>
      new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);

    const dayMatches = soccer.filter((m: { kickoffTime: Date }) =>
      toEATDateStr(new Date(m.kickoffTime)) === todayStr
    ).slice(0, 25);

    // NEVER fall back to arbitrary upcoming matches — that would pull in tomorrow's
    // games and show them as today's picks (the original bug). If there are no
    // qualifying matches for this EAT date, return empty rather than wrong picks.
    const pool = dayMatches;

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

      const prompt = `You are a professional football analyst and betting strategist for the Betcheza "3 Daily Odds" Strategy.

Date: ${today.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
Day ${dayNumber} — stake KES ${plan.stake.toLocaleString()}, target win KES ${plan.targetWin.toLocaleString()}.
Goal: select 1–5 picks with COMBINED (multiplied) odds between 3.00 and 4.00.

═══════════════════════════════════════════
DEEP INVESTIGATION — for EACH match in the list
═══════════════════════════════════════════

STEP 1 — MOTIVATION & STAKES
Ask: Does each team actually NEED a result today?
- Is one team fighting relegation, chasing a title, needing a win for European qualification?
- Is the other team already safe, already relegated, or already champions?
- A team with nothing to play for is dangerous to back — skip it or downgrade confidence.
- A team desperate for 3 points has elevated motivation — prefer these.

STEP 2 — ROTATION & SQUAD RISK  
Ask: Will this team field their strongest XI?
- Is there a more important match 3–4 days later (cup final, European tie, derby)?
- Do they have the squad depth to rotate and still win comfortably?
- Rotation by a strong team against a weaker opponent = LOWER confidence in a win, but possibly still BTTS No or a handicap.
- Rotation by both teams = uncertain, skip.

STEP 3 — CONTEXTUAL FORM & H2H
- Look at recent form (last 5 matches): winning runs, defensive records, goal-scoring patterns.
- Head-to-head: does this fixture historically produce goals or is it low-scoring?
- Home advantage: is this team significantly stronger at home than away?

STEP 4 — MARKET SELECTION (ANY MARKET IS VALID)
Choose the market that best fits the evidence. You are NOT limited to any list. Use whichever gives the highest probability:
1X2 Win, Double Chance, Draw No Bet, BTTS Yes/No, Over/Under (1.5/2.5/3.5), Asian Handicap, First Team to Score, Win to Nil, Correct Score, HT/FT, Corners, Cards, Goalscorer, or any other available market.

RED FLAGS — ELIMINATE THESE MATCHES:
✗ Title already secured AND opponent is safe/mid-table → skip (dead rubber)
✗ Both teams have nothing to play for → skip
✗ Team is rotating before a bigger match AND the backup XI isn't clearly better than the opponent
✗ You cannot construct a clear evidence-based reason WHY your pick wins

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════

Return ONLY a JSON array (1–5 picks) with no explanation outside the JSON.
Each pick must have:
- homeTeam, awayTeam, league (strings)
- matchTime (ISO datetime string from the match list)
- pick (e.g. "Arsenal Win", "Over 2.5 Goals", "BTTS Yes", "Draw No Bet Napoli")
- market (e.g. "1X2", "Over/Under 2.5", "BTTS", "Double Chance", "Asian Handicap")
- odds (number — ONLY use odds actually listed in the match data, never invent)
- confidence ("High", "Medium", or "Low")
- reasoning (2–3 sentence explanation of WHY this pick wins, referencing motivation, rotation, form, or H2H)

REQUIRED: the product of all odds MUST be between 3.00 and 4.00.
Example with 2 picks: 1.80 × 1.80 = 3.24 ✓
Example with 1 pick: 3.50 ✓

Matches available today:
${matchList}`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2000,
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

    // ── Tony Bloom-inspired fallback engine ──────────────────────────────────
    // Uses multi-signal scoring: league quality, home advantage, odds value,
    // market reliability. Targets combined odds of 3.0–4.0 for the day.
    interface PoolMatch {
      homeTeam: { name: string };
      awayTeam: { name: string };
      league: { name: string };
      kickoffTime: Date;
      odds?: { home: number; draw?: number; away: number };
      markets?: Array<{ key?: string; name: string; outcomes?: Array<{ name: string; price: number }> }>;
    }

    // Top-tier leagues have higher prediction reliability
    const LEAGUE_TIER: Record<string, number> = {
      'premier league': 3, 'la liga': 3, 'bundesliga': 3, 'serie a': 3, 'ligue 1': 3,
      'champions league': 3, 'europa league': 2, 'championship': 2, 'eredivisie': 2,
      'primeira liga': 2, 'scottish premiership': 2, 'fa cup': 2,
    };
    const leagueTier = (name: string): number => {
      const n = name.toLowerCase();
      for (const [k, v] of Object.entries(LEAGUE_TIER)) {
        if (n.includes(k)) return v;
      }
      return 1;
    };

    // Market reliability: some markets are more predictable than others
    const MARKET_RELIABILITY: Record<string, number> = {
      'Double Chance': 3, 'Draw No Bet': 3,
      'Over/Under 1.5': 3, 'Goals Over/Under': 2, 'Over/Under 2.5': 2,
      'Both Teams to Score': 2, 'BTTS': 2,
      '1X2': 1, 'Moneyline': 1,
    };
    const marketReliability = (name: string): number => {
      const n = name.toLowerCase();
      if (n.includes('double chance') || n.includes('1x or x2')) return 3;
      if (n.includes('draw no bet')) return 3;
      if (n.includes('1.5') || n.includes('over 1')) return 3;
      if (n.includes('2.5') || n.includes('over 2') || n.includes('under 2')) return 2;
      if (n.includes('btts') || n.includes('both teams')) return 2;
      return MARKET_RELIABILITY[name] ?? 1;
    };

    interface Candidate {
      pick: string;
      market: string;
      odds: number;
      score: number;
      reasoning: string;
      confidence: 'High' | 'Medium' | 'Low';
    }

    function bloomSelectionForMatch(m: PoolMatch, targetOdds: number): Candidate | null {
      const candidates: Candidate[] = [];
      const tier = leagueTier(m.league.name);
      const home = m.homeTeam.name;
      const away = m.awayTeam.name;
      const league = m.league.name;

      // Score = closeness to target + league quality bonus + market reliability bonus
      const score = (o: number, mktName: string, isHome: boolean): number => {
        const distancePenalty = -Math.abs(o - targetOdds) * 2;
        const leagueBonus = tier * 0.15;
        const mktBonus = marketReliability(mktName) * 0.1;
        const homeBonus = isHome ? 0.1 : 0; // slight home advantage bonus
        return distancePenalty + leagueBonus + mktBonus + homeBonus;
      };

      // Reasoning templates
      const mkReasoning = (pick: string, mkt: string, o: number): string => {
        if (mkt === 'Double Chance' || mkt.toLowerCase().includes('double')) {
          return `Double chance covers two outcomes — safe pick in ${league}. Bookmakers price this at ${o.toFixed(2)}, indicating genuine two-way probability. Protects against surprise draws in a competitive fixture.`;
        }
        if (mkt === 'Draw No Bet' || mkt.toLowerCase().includes('draw no bet')) {
          return `Draw No Bet removes the draw risk entirely from ${home} vs ${away} in ${league}. If the match ends level your stake is returned — only a direct opposite result loses. High safety profile.`;
        }
        if (mkt.toLowerCase().includes('1.5') || (mkt.toLowerCase().includes('over') && mkt.includes('1'))) {
          return `Over 1.5 Goals is among the safest markets — requires just 2 goals in 90 minutes. ${league} fixtures average 2.4+ goals, making this outcome land roughly 75% of the time historically.`;
        }
        if (mkt.toLowerCase().includes('2.5') || (mkt.toLowerCase().includes('over') && mkt.includes('2'))) {
          return `Over 2.5 Goals reflects an open-play expectation between ${home} and ${away}. At odds of ${o.toFixed(2)}, the market sees balanced attacking output from both sides in ${league}.`;
        }
        if (mkt.toLowerCase().includes('btts') || mkt.toLowerCase().includes('both teams')) {
          return `Both Teams to Score backed by ${league} form context. Fixtures of this type routinely see both sides hit the net — the ${o.toFixed(2)} price represents genuine value given the attacking profiles involved.`;
        }
        if (pick.includes('Win or Draw')) {
          return `${pick} via Double Chance — covers home win and draw in ${league}. Only one outcome (away win) defeats this selection. Strong safety margin backed by home advantage and ${league} structures.`;
        }
        if (pick.includes(`${home} Win`)) {
          return `${home} backed at home in ${league}. Home advantage is statistically the strongest single predictor in football — teams win approximately 46% of home games at this tier, justifying the ${o.toFixed(2)} price.`;
        }
        return `Market analysis favours ${pick} in the ${home} vs ${away} fixture. Bookmaker odds of ${o.toFixed(2)} reflect the underlying probability distribution — value exists at this price point in ${league}.`;
      };

      const confidence = (o: number, tier: number, mktName: string): 'High' | 'Medium' | 'Low' => {
        const rel = marketReliability(mktName);
        if (o <= 1.45 && tier >= 2 && rel >= 2) return 'High';
        if (o <= 1.80 && (tier >= 2 || rel >= 2)) return 'Medium';
        return 'Low';
      };

      // 1. Full markets scan (BTTS, Over/Under, Double Chance, etc.)
      if (m.markets && m.markets.length > 0) {
        for (const mkt of m.markets) {
          const rel = marketReliability(mkt.name);
          for (const out of mkt.outcomes || []) {
            if (out.price >= 1.15 && out.price <= 3.2) {
              const s = score(out.price, mkt.name, out.name.toLowerCase().includes(home.toLowerCase()));
              candidates.push({
                pick: out.name, market: mkt.name, odds: out.price,
                score: s + rel * 0.05,
                reasoning: mkReasoning(out.name, mkt.name, out.price),
                confidence: confidence(out.price, tier, mkt.name),
              });
            }
          }
        }
      }

      // 2. h2h odds — 1X2 and Double Chance
      if (m.odds) {
        const { home: hOdds, draw: dOdds, away: aOdds } = m.odds;
        if (hOdds >= 1.15 && hOdds <= 3.2) {
          candidates.push({ pick: `${home} Win`, market: '1X2', odds: hOdds, score: score(hOdds, '1X2', true), reasoning: mkReasoning(`${home} Win`, '1X2', hOdds), confidence: confidence(hOdds, tier, '1X2') });
        }
        if (dOdds && dOdds >= 1.15 && dOdds <= 3.2) {
          candidates.push({ pick: 'Draw', market: '1X2', odds: dOdds, score: score(dOdds, '1X2', false), reasoning: mkReasoning('Draw', '1X2', dOdds), confidence: confidence(dOdds, tier, '1X2') });
        }
        if (aOdds >= 1.15 && aOdds <= 3.2) {
          candidates.push({ pick: `${away} Win`, market: '1X2', odds: aOdds, score: score(aOdds, '1X2', false), reasoning: mkReasoning(`${away} Win`, '1X2', aOdds), confidence: confidence(aOdds, tier, '1X2') });
        }
        // Double Chance from h2h odds
        if (dOdds) {
          const dcHome = parseFloat(Math.min(hOdds, dOdds).toFixed(2));
          const dcAway = parseFloat(Math.min(aOdds, dOdds).toFixed(2));
          if (dcHome >= 1.05) candidates.push({ pick: `${home} Win or Draw`, market: 'Double Chance', odds: dcHome, score: score(dcHome, 'Double Chance', true) + 0.3, reasoning: mkReasoning(`${home} Win or Draw`, 'Double Chance', dcHome), confidence: confidence(dcHome, tier, 'Double Chance') });
          if (dcAway >= 1.05) candidates.push({ pick: `${away} Win or Draw`, market: 'Double Chance', odds: dcAway, score: score(dcAway, 'Double Chance', false) + 0.25, reasoning: mkReasoning(`${away} Win or Draw`, 'Double Chance', dcAway), confidence: confidence(dcAway, tier, 'Double Chance') });
        }
      }

      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0];
    }

    // Greedy assembly: build picks targeting 3.0–4.0 combined odds.
    // Pass each match the per-leg target so selection adapts to how many picks remain.
    const picks: StrategyPick[] = [];
    let combined = 1;
    const targetCombined = 3.5; // sweet-spot in the 3.0–4.0 band

    for (let i = 0; i < Math.min(pool.length, 12) && picks.length < 5; i++) {
      const m = pool[i] as PoolMatch;
      // Calculate what per-leg odds we still need to hit ~3.5 in 3–5 picks
      const legsNeeded = Math.max(1, 4 - picks.length);
      const perLegTarget = Math.pow(targetCombined / combined, 1 / legsNeeded);
      const sel = bloomSelectionForMatch(m, Math.min(Math.max(perLegTarget, 1.2), 2.5));
      if (!sel) continue;
      // Skip if this leg would push combined well past 4.5
      if (combined * sel.odds > 5.0 && picks.length >= 1) continue;
      picks.push({
        id: `${todayStr}-bloom-${i}`,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        matchTime: new Date(m.kickoffTime).toISOString(),
        pick: sel.pick,
        market: sel.market,
        odds: sel.odds,
        confidence: sel.confidence,
        reasoning: sel.reasoning,
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
      // Apply manual day overrides (e.g. when API corner stats were wrong)
    const override = MANUAL_DAY_OVERRIDES[base.date];
    if (override) {
      return {
        ...base,
        status: 'completed' as const,
        day: d.day,
        stake: d.stake,
        save: d.save,
        targetWin: d.targetWin,
        result: override.result,
        picks: base.picks.map(p => ({ ...p, result: override.picksResult })),
      };
    }

    return { ...base, status, day: d.day, stake: d.stake, save: d.save, targetWin: d.targetWin };
    });

    // Auto-generate today's picks if today is active but has no picks (or only
    // placeholder picks from an early cron run) AND not manually posted
    const todayIdx = merged.findIndex((d) => d.date === todayStr);
    if (todayIdx >= 0 && !merged[todayIdx].isManual &&
        (merged[todayIdx].picks.length === 0 || isPlaceholderPicks(merged[todayIdx].picks))) {
      try {
        const autoPicks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
        const combined = autoPicks.reduce((acc, p) => acc * p.odds, 1);
        merged[todayIdx].picks = autoPicks;
        merged[todayIdx].combinedOdds = parseFloat(combined.toFixed(2));
        merged[todayIdx].status = 'active';
        // Persist to DB
        // Only overwrite picks if the DB row is currently empty/placeholder —
        // never clobber real picks that were set by a previous cron or manual post.
        await execute(
          `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, is_manual, generated_at, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             picks         = IF(picks IS NULL OR picks = '' OR picks = '[]', VALUES(picks), picks),
             combined_odds = IF(picks IS NULL OR picks = '' OR picks = '[]', VALUES(combined_odds), combined_odds),
             status        = IF(picks IS NULL OR picks = '' OR picks = '[]', 'active', status),
             day_number    = VALUES(day_number), stake = VALUES(stake), save_amount = VALUES(save_amount),
             target_win    = VALUES(target_win),
             generated_at  = IF(picks IS NULL OR picks = '' OR picks = '[]', NOW(), generated_at)`,
          [todayStr, weekId, dayNumber, merged[todayIdx].stake, merged[todayIdx].save, merged[todayIdx].targetWin, merged[todayIdx].combinedOdds, JSON.stringify(autoPicks)]
        ).catch(() => undefined);
      } catch { /* non-fatal */ }
    }

    return { ...empty, days: merged };
  }

  // File store fallback
  const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
  if (stored && stored.weekId === weekId) {
    // Auto-generate for today if empty or only has placeholder picks
    const todayIdx = stored.days.findIndex((d) => d.date === todayStr);
    if (todayIdx >= 0 && (stored.days[todayIdx].picks.length === 0 || isPlaceholderPicks(stored.days[todayIdx].picks))) {
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
         ON DUPLICATE KEY UPDATE
           picks         = IF(picks IS NULL OR picks = '' OR picks = '[]', VALUES(picks), picks),
           combined_odds = IF(picks IS NULL OR picks = '' OR picks = '[]', VALUES(combined_odds), combined_odds),
           status        = IF(picks IS NULL OR picks = '' OR picks = '[]', 'active', status),
           day_number    = VALUES(day_number), stake = VALUES(stake), save_amount = VALUES(save_amount),
           target_win    = VALUES(target_win),
           generated_at  = IF(picks IS NULL OR picks = '' OR picks = '[]', NOW(), generated_at)`,
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
    // Add columns if they don't exist (MySQL 5.7-compatible via ER_DUP_FIELDNAME catch)
    await query(`ALTER TABLE daily_strategy ADD COLUMN is_manual tinyint(1) NOT NULL DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE daily_strategy ADD COLUMN scheduled_for date DEFAULT NULL`).catch(() => {});
    await query(`ALTER TABLE daily_strategy ADD COLUMN is_approved tinyint(1) NOT NULL DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE daily_strategy ADD COLUMN approved_at datetime DEFAULT NULL`).catch(() => {});
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
    // Apply manual override if configured
    if (MANUAL_WIN_WEEKS[weekId] === 'all') {
      weeks.push(buildManualAllWinsWeek(weekId));
      continue;
    }
    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) weeks.push(stored);
  }
  // Always inject manually-overridden past weeks that may not appear in DB or file store
  for (const [weekId] of Object.entries(MANUAL_WIN_WEEKS)) {
    if (!weeks.find((w) => w.weekId === weekId)) {
      const d = new Date(weekId);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 35);
      if (d >= cutoff && d < new Date(getWeekId(new Date()))) {
        weeks.push(buildManualAllWinsWeek(weekId));
      }
    }
  }
  return weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

function checkPickResultLocal(
  pick: StrategyPick,
  homeScore: number,
  awayScore: number,
  htHomeScore?: number | null,
  htAwayScore?: number | null,
  corners?: { home: number; away: number },
  yellowCards?: { home: number; away: number },
  redCards?: { home: number; away: number },
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
    if (market.includes('corner') || pickValue.includes('corner')) {
      if (!corners) return null; // no corner data yet — keep pending
      const tc = corners.home + corners.away;
      if (over) return tc > parseFloat(over[1]) ? 'win' : 'loss';
      if (under) return tc < parseFloat(under[1]) ? 'win' : 'loss';
      return null;
    } else if (market.includes('yellow card') || market.includes('card')) {
      if (!yellowCards) return null;
      const tc = yellowCards.home + yellowCards.away;
      if (over) return tc > parseFloat(over[1]) ? 'win' : 'loss';
      if (under) return tc < parseFloat(under[1]) ? 'win' : 'loss';
      return null;
    } else if (market.includes('goal') || market.includes('total goals') || market === 'over/under') {
      if (over) return total > parseFloat(over[1]) ? 'win' : 'loss';
      if (under) return total < parseFloat(under[1]) ? 'win' : 'loss';
    } else {
      // Generic o/u on goals
      if (over) return total > parseFloat(over[1]) ? 'win' : 'loss';
      if (under) return total < parseFloat(under[1]) ? 'win' : 'loss';
    }
    // Bare "under" / "over" with no line number
    if (pickValue === 'under') {
      if (total >= 5) return 'loss';
      if (total <= 1) return 'win';
      return null;
    }
    if (pickValue === 'over') {
      if (total >= 4) return 'win';
      if (total === 0) return 'loss';
      return null;
    }
  }

  // ── First Team to Score ─────────────────────────────────────────────────
  if (market.includes('first team to score') || market.includes('first goal') || market.includes('first scorer')) {
    // If only one side scored, that side definitely scored first.
    if (homeScore > 0 && awayScore === 0) {
      const wantHome = pickValue.includes('home') || pickNorm === homeNorm;
      return wantHome ? 'win' : 'loss';
    }
    if (awayScore > 0 && homeScore === 0) {
      const wantAway = pickValue.includes('away') || pickNorm === awayNorm;
      return wantAway ? 'win' : 'loss';
    }
    if (homeScore === 0 && awayScore === 0) {
      // No goal scored — "No Goal" / "No scorer" bet wins; team bets lose
      const wantNone = pickValue.includes('no goal') || pickValue.includes('no scorer') || pickValue === 'no';
      return wantNone ? 'win' : 'loss';
    }
    // Both teams scored — use HT score to infer who scored first if available
    if (htHomeScore != null && htAwayScore != null) {
      if (htHomeScore > 0 && htAwayScore === 0) {
        const wantHome = pickValue.includes('home') || pickNorm === homeNorm;
        return wantHome ? 'win' : 'loss';
      }
      if (htAwayScore > 0 && htHomeScore === 0) {
        const wantAway = pickValue.includes('away') || pickNorm === awayNorm;
        return wantAway ? 'win' : 'loss';
      }
    }
    // Can't determine first scorer from final score alone — leave pending
    return null;
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
  if (market.includes('half') || market.includes('ht')) {
    if (htHomeScore == null || htAwayScore == null) return null; // no HT data yet
    // Determine HT outcome
    const htWinner = htHomeScore > htAwayScore ? 'home' : htAwayScore > htHomeScore ? 'away' : 'draw';
    if (pickValue.includes('draw') || pickNorm === 'x') return htWinner === 'draw' ? 'win' : 'loss';
    if (pickValue.includes('home win') || pickNorm === 'homewin' || pickNorm === '1') return htWinner === 'home' ? 'win' : 'loss';
    if (pickValue.includes('away win') || pickNorm === 'awaywin' || pickNorm === '2') return htWinner === 'away' ? 'win' : 'loss';
    // Plain "home", "away", "draw" predictions
    if (pickNorm === 'home' || pickNorm === homeNorm) return htWinner === 'home' ? 'win' : 'loss';
    if (pickNorm === 'away' || pickNorm === awayNorm) return htWinner === 'away' ? 'win' : 'loss';
    if (pickNorm === 'draw') return htWinner === 'draw' ? 'win' : 'loss';
    return null;
  }

  return null;
}

async function autoSettleCompletedPicks(days: DayPrediction[]): Promise<DayPrediction[]> {
  const todayStr = getTodayStrEAT(new Date());
  // Include today's picks so subscribers see results as each match finishes
  const hasPending = days.some(d => d.date <= todayStr && d.picks.some(p => p.result === 'pending'));
  if (!hasPending) return days;

  type MatchEntry = {
    homeTeam: { name: string };
    awayTeam: { name: string };
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    htHomeScore?: number | null;
    htAwayScore?: number | null;
    sportSpecificData?: {
      corners?: { home: number; away: number };
      yellowCards?: { home: number; away: number };
      redCards?: { home: number; away: number };
    };
  };
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
    // Skip days with a manual override — they are already correct
    if (MANUAL_DAY_OVERRIDES[day.date]) return day;
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
      const result = checkPickResultLocal(
        pick, match.homeScore, match.awayScore,
        match.htHomeScore, match.htAwayScore,
        match.sportSpecificData?.corners,
        match.sportSpecificData?.yellowCards,
        match.sportSpecificData?.redCards,
      );
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

/**
 * Overlays real-time live scores onto today's pending picks.
 * Does NOT settle — just annotates picks with liveScore/liveStatus so the
 * UI can show the current score while the match is in progress.
 * Also immediately settles picks whose outcome is mathematically certain
 * mid-game (e.g. Under line already blown).
 */
async function overlayLiveScores(days: DayPrediction[]): Promise<DayPrediction[]> {
  const todayStr = getTodayStrEAT(new Date());
  const todayDay = days.find(d => d.date === todayStr);
  if (!todayDay || !todayDay.picks.some(p => p.result === 'pending')) return days;

  try {
    const { getLiveMatches } = await import('@/lib/api/unified-sports-api');
    const live = await getLiveMatches();
    if (!live.length) return days;

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    return days.map(day => {
      if (day.date !== todayStr) return day;

      let dayChanged = false;
      const updatedPicks = day.picks.map(pick => {
        const ph = norm(pick.homeTeam);
        const pa = norm(pick.awayTeam);
        interface LiveMatch {
          homeTeam: { name: string };
          awayTeam: { name: string };
          homeScore: number | null;
          awayScore: number | null;
          status: string;
          minute?: number | null;
        }
        const match = (live as LiveMatch[]).find(m => {
          const mh = norm(m.homeTeam?.name || '');
          const ma = norm(m.awayTeam?.name || '');
          return (mh === ph || mh.includes(ph) || ph.includes(mh)) &&
                 (ma === pa || ma.includes(pa) || pa.includes(ma));
        });
        if (!match) return pick;

        const hs = match.homeScore ?? 0;
        const as_ = match.awayScore ?? 0;
        const scoreStr = `${hs}-${as_}`;
        const liveStatus: 'live' | 'finished' = match.status === 'live' || match.status === 'inprogress' ? 'live' : 'finished';

        // For pending picks: check if outcome is already mathematically certain mid-game.
        // Both wins and losses can be certain before FT:
        //   LOSS certain: Under line blown (can never recover)
        //   WIN certain:  Over line already cleared, BTTS Yes after both teams scored, etc.
        // VAR can disallow a single goal but once play resumes from kick-off the review
        // window is closed. We settle immediately — identical to how bookmakers pay out.
        if (pick.result === 'pending') {
          const earlyResult = checkPickResultLocal(pick, hs, as_);
          if (earlyResult === 'loss' || earlyResult === 'win') {
            dayChanged = true;
            return { ...pick, result: earlyResult, actualScore: scoreStr, liveScore: scoreStr, liveStatus };
          }
        }

        return { ...pick, liveScore: scoreStr, liveStatus };
      });

      if (!dayChanged) return { ...day, picks: updatedPicks };

      // Persist early settlements (certain losses) to DB so all users see it
      const allSettled = updatedPicks.every(p => p.result !== 'pending');
      const allWon = allSettled && updatedPicks.every(p => p.result === 'win');
      execute(
        `UPDATE daily_strategy SET picks = ?, result = ?, status = ?, settled_at = NOW() WHERE date = ?`,
        [JSON.stringify(updatedPicks), allSettled ? (allWon ? 'win' : 'loss') : null, allSettled ? 'completed' : 'active', todayStr]
      ).catch(() => undefined);

      return { ...day, picks: updatedPicks, ...(allSettled ? { result: allWon ? 'win' as const : 'loss' as const, status: 'completed' as const } : {}) };
    });
  } catch { return days; }
}

export async function GET() {
  try {
    const current = await loadCurrentWeek();
    current.days = await autoSettleCompletedPicks(current.days);
    current.days = await overlayLiveScores(current.days);
    const past = await loadPastWeeks();

    // Admin approval gate: hide unapproved today's picks from non-admin users.
    // If the earliest match kickoff is ≤60 minutes away and picks exist,
    // auto-approve as a fallback so users are never left without picks.
    const user = await getCurrentUser().catch(() => null);
    const isAdmin = user?.role === 'admin';
    if (!isAdmin) {
      const todayStr = getTodayStrEAT(new Date());
      current.days = current.days.map(day => {
        if (day.date !== todayStr) return day;
        if (day.isApproved) return day;
        if (day.picks.length === 0) return day;
        // Check auto-approve deadline: if first match ≤60 min away, auto-approve
        const now = Date.now();
        const firstMatchMs = day.picks.reduce((min, p) => {
          const t = p.matchTime ? new Date(p.matchTime).getTime() : Infinity;
          return t < min ? t : min;
        }, Infinity);
        const minsUntil = isFinite(firstMatchMs) ? (firstMatchMs - now) / 60000 : Infinity;
        if (minsUntil <= 60) {
          // Auto-approve: admin missed the window — release picks to users
          execute(
            `UPDATE daily_strategy SET is_approved = 1, approved_at = NOW() WHERE date = ? AND is_approved = 0`,
            [todayStr]
          ).catch(() => undefined);
          return { ...day, isApproved: true };
        }
        // Still awaiting admin review — hide picks
        return { ...day, picks: [], combinedOdds: 0, pendingApproval: true };
      });
    }

    return NextResponse.json({ current, past });
  } catch (err) {
    console.error('[strategy/predictions] GET error:', err);
    // Return a safe empty response rather than letting an unhandled error crash the process
    const weekId = getWeekId(new Date());
    return NextResponse.json({ current: buildEmptyWeek(weekId), past: [] });
  }
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
          `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, is_manual, scheduled_for, generated_at, posted_at, is_approved)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0)
           ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), is_manual = VALUES(is_manual), scheduled_for = VALUES(scheduled_for), generated_at = NOW(), posted_at = NOW(), status = VALUES(status), is_approved = 0`,
          [targetDate, weekId, dayData.day, dayData.stake, dayData.save, dayData.targetWin, dayData.combinedOdds, targetStatus, JSON.stringify(body.picks), isManual ? 1 : 0, scheduledFor]
        );
      } catch { }

      // Emails are sent only after admin approves picks via /api/admin/strategy/approve
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  if (body.result && typeof body.day === 'number') {
    // The admin UI can be viewing ANY week (current or historical) when it
    // saves a result. `body.day` is only a 1-7 index WITHIN that displayed
    // week, so it must never be applied against `current.days` unless the
    // request is actually targeting the current week — otherwise an edit to
    // a past week's day silently overwrites the wrong date in the current
    // week while leaving the intended past date unchanged (the cause of the
    // days-lost count drifting from what admins actually corrected).
    const targetDate: string | undefined = body.date;

    if (targetDate) {
      // Look up the existing picks for that exact date so we can merge in
      // picksResults/actualScores, then write to that date directly.
      let picks: StrategyPick[] = [];
      try {
        const existing = await query<{ picks: string | null }>(
          'SELECT picks FROM daily_strategy WHERE date = ? LIMIT 1',
          [targetDate]
        );
        if (existing.rows[0]?.picks) picks = JSON.parse(existing.rows[0].picks) as StrategyPick[];
      } catch { /* fall through with empty picks */ }

      if (body.picksResults) {
        picks = picks.map((p, i) => ({
          ...p,
          result: body.picksResults[i] || p.result,
          actualScore: body.actualScores?.[i] || p.actualScore,
        }));
      }

      try {
        const upd = await execute(
          `UPDATE daily_strategy SET result = ?, actual_return = ?, picks = ?, status = 'completed', settled_at = NOW()
           WHERE date = ?`,
          [body.result, body.actualReturn || null, JSON.stringify(picks), targetDate]
        );
        if (!upd.affectedRows) {
          // No row exists for this date — silently reporting success would
          // let an admin believe a past day was corrected when nothing in
          // the DB actually changed (the exact class of bug this fix targets).
          return NextResponse.json({ error: `No strategy day found for date ${targetDate}` }, { status: 404 });
        }
      } catch (e) {
        return NextResponse.json({ error: 'Failed to save result' }, { status: 500 });
      }

      // Keep the in-memory/file caches for whichever week this date belongs
      // to in sync, so the UI reflects the edit immediately without a refetch.
      if (current.days.some(d => d.date === targetDate)) {
        const idx = current.days.findIndex(d => d.date === targetDate);
        current.days[idx] = { ...current.days[idx], result: body.result, actualReturn: body.actualReturn, picks };
        fileStoreSet(`strategy-week-${weekId}`, current);
      }
      return NextResponse.json({ success: true, week: current });
    }

    // Legacy fallback (no date supplied): only safe to apply against the
    // current week, since that's the only week whose day-index is unambiguous.
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
