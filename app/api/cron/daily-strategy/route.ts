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

/**
 * Top-tier leagues we actively PREFER for the strategy.
 * Scores: 1 = elite, 2 = top, 3 = good, 4 = acceptable.
 * Leagues NOT on this list get score 5 (acceptable but lower priority).
 */
const LEAGUE_QUALITY: Record<string, number> = {
  // Elite (score 1)
  'premier league': 1, 'english premier league': 1, 'epl': 1,
  'la liga': 1, 'laliga': 1, 'serie a': 1, 'bundesliga': 1,
  'ligue 1': 1, 'champions league': 1, 'uefa champions league': 1,
  'english premier': 1,

  // Top (score 2)
  'eredivisie': 2, 'primeira liga': 2, 'super lig': 2, 'premier league (scotland)': 2,
  'championship': 2, 'english championship': 2, 'serie b': 2, 'liga mx': 2,
  'major league soccer': 2, 'mls': 2, 'a-league': 2, 'argentina primera': 2,
  'brasileirao': 2, 'brasileiro': 2, 'belgian pro league': 2, 'jupiler pro league': 2,
  'russian premier league': 2, 'ukraine premier league': 2, 'europa league': 2,
  'uefa europa league': 2, 'conference league': 2, 'coppa italia': 2, 'dfb-pokal': 2,
  'fa cup': 2, 'efl cup': 2, 'coupe de france': 2, 'copa del rey': 2,
  'saudi pro league': 2, 'chinese super league': 2, 'j1 league': 2,

  // Good (score 3)
  'nwsl': 3, 'süper lig': 3, 'czech first league': 3, 'swiss super league': 3,
  'austrian bundesliga': 3, 'danish superliga': 3, 'norwegian eliteserien': 3,
  'eliteserien': 3, 'allsvenskan': 3, 'ekstraklasa': 3,
  'liga nos': 3, 'scottish premiership': 3, 'greek super league': 3,
  'romanian liga 1': 3, 'south african premier': 3, 'hungarian otp bank liga': 3,
  'league one': 3, 'league two': 3, 'efl league one': 3, 'efl league two': 3,
};

function leagueScore(leagueName: string): number {
  const norm = (leagueName || '').toLowerCase().trim();
  for (const [key, score] of Object.entries(LEAGUE_QUALITY)) {
    if (norm.includes(key)) return score;
  }
  return 5; // acceptable fallback
}

/** Score how "safe" a set of bookmaker odds is. Higher = safer bet. */
function oddsToSafetyScore(odds: number): number {
  if (odds >= 1.15 && odds <= 1.40) return 100;
  if (odds >  1.40 && odds <= 1.60) return 92;
  if (odds >  1.60 && odds <= 1.85) return 80;
  if (odds >  1.85 && odds <= 2.10) return 65;
  if (odds >  2.10 && odds <= 2.50) return 45;
  if (odds >  2.50 && odds <= 3.20) return 28;
  return 12;
}

/**
 * Given a match with real odds, return the SAFEST single pick from it.
 * Priority: Double Chance (1X/X2) → outright favourite.
 */
function safestPick(
  match: {
    homeTeam: { name: string };
    awayTeam: { name: string };
    league: { name: string };
    kickoffTime: Date;
    odds?: { home: number; draw: number; away: number } | null
  },
  idx: number,
): StrategyPick & { safetyScore: number; leagueScore: number } {
  let odds = 1.65;
  let pick = match.homeTeam.name;
  let market = '1X2';
  let safetyScore = 50;
  const lScore = leagueScore(match.league.name);

  if (match.odds) {
    const { home, draw, away } = match.odds;

    // Validate odds are real (bookmakers don't give odds below 1.01 or above 100)
    if (home < 1.01 || away < 1.01 || draw < 1.01) {
      odds = Math.min(home, away);
      pick = home <= away ? match.homeTeam.name : match.awayTeam.name;
      market = '1X2';
      safetyScore = oddsToSafetyScore(odds);
    } else {
      // Derive fair Double Chance odds using devig
      const totalInv = (1 / home) + (1 / draw) + (1 / away);
      const dc1xFair = ((1 / home) + (1 / draw)) / totalInv;
      const dcX2Fair = ((1 / away) + (1 / draw)) / totalInv;
      const dc1xOdds = parseFloat((1 / dc1xFair).toFixed(2));
      const dcX2Odds = parseFloat((1 / dcX2Fair).toFixed(2));

      // Pick the lower DC odds (safer side)
      const bestDcOdds = dc1xOdds <= dcX2Odds ? dc1xOdds : dcX2Odds;
      const bestDcPick = dc1xOdds <= dcX2Odds
        ? `${match.homeTeam.name} or Draw`
        : `${match.awayTeam.name} or Draw`;
      const bestDcType = dc1xOdds <= dcX2Odds ? '1X' : 'X2';

      // Favourite outright odds
      const favOdds = home <= away ? home : away;
      const favPick = home <= away ? match.homeTeam.name : match.awayTeam.name;
      const underdogOdds = home <= away ? away : home;

      // Only use a match if there's a clear favourite (avoid coin-flips)
      const clearFavourite = favOdds <= 2.20 || bestDcOdds <= 1.65;

      if (!clearFavourite) {
        // Very even match — skip if odds are wide open (low value for strategy)
        safetyScore = 15;
        odds = bestDcOdds;
        pick = bestDcPick;
        market = 'Double Chance';
      } else if (bestDcOdds >= 1.10 && bestDcOdds <= 1.75) {
        // Good DC range
        odds = bestDcOdds;
        pick = bestDcPick;
        market = 'Double Chance';
        safetyScore = oddsToSafetyScore(odds) + 12; // DC bonus
      } else if (favOdds >= 1.15 && favOdds <= 1.85) {
        // Clear outright favourite
        odds = favOdds;
        pick = favPick;
        market = '1X2';
        safetyScore = oddsToSafetyScore(odds);
      } else {
        // Fallback: use DC anyway
        odds = bestDcOdds;
        pick = bestDcPick;
        market = 'Double Chance';
        safetyScore = oddsToSafetyScore(odds) + 8;
      }
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
    confidence: odds <= 1.45 ? 'High' : odds <= 1.75 ? 'Medium' : 'Low',
    reasoning: buildReasoning(match.homeTeam.name, match.awayTeam.name, match.league.name, pick, market, odds),
    result: 'pending',
    safetyScore,
    leagueScore: lScore,
  } as StrategyPick & { safetyScore: number; leagueScore: number };
}

function buildReasoning(home: string, away: string, league: string, pick: string, market: string, odds: number): string {
  const leagueTier = leagueScore(league);
  const tierLabel = leagueTier === 1 ? 'elite' : leagueTier === 2 ? 'top-flight' : 'professional';
  if (market === 'Double Chance') {
    const side = pick.includes('or Draw') ? (pick.startsWith(home) ? 'home' : 'away') : '';
    if (side === 'home') {
      return `${home} backed with Double Chance (1X) at ${tierLabel}-level odds ${odds}. Covers a home win or draw — two of three possible outcomes — making this a high-probability selection for the accumulator.`;
    } else {
      return `${away} Double Chance (X2) at ${odds} in ${league}. Away win or draw both pay, covering a dominant two-thirds probability. Low-risk anchor for the accumulator.`;
    }
  }
  return `${pick} selected at ${odds} from ${league} (${tierLabel}). Bookmaker odds reflect a clear probability edge. Single-selection keeps the accumulator risk controlled.`;
}

/**
 * Greedy accumulator builder — safety + league quality sorted.
 * Only uses matches with real bookmaker odds when possible.
 * Combines safety score with league quality to rank candidates.
 */
function buildGreedyAccumulator(
  pool: Parameters<typeof safestPick>[0][],
  dateStr: string,
  minTarget = 2.90,
  maxTarget = 4.20,
): StrategyPick[] {
  if (pool.length === 0) return [];

  // Prefer matches WITH real bookmaker odds
  const withOdds = pool.filter(m => m.odds && m.odds.home > 1.05 && m.odds.away > 1.05);
  const workingPool = withOdds.length >= 3 ? withOdds : pool;

  // Score every candidate — combine safety + league quality (lower leagueScore = better)
  const candidates = workingPool
    .map((m, i) => ({ m, pick: safestPick(m, i) }))
    .sort((a, b) => {
      // Primary: safety score (higher = better)
      const safetyDiff = b.pick.safetyScore - a.pick.safetyScore;
      if (Math.abs(safetyDiff) > 8) return safetyDiff;
      // Secondary: league quality (lower = better)
      return a.pick.leagueScore - b.pick.leagueScore;
    });

  const chosen: (StrategyPick & { safetyScore: number })[] = [];
  let combined = 1.0;

  for (const { pick } of candidates) {
    if (combined >= minTarget) break;
    const projected = combined * pick.odds;
    // More conservative overshoot check
    if (projected > maxTarget + 0.15) continue;
    chosen.push(pick);
    combined = projected;
    if (chosen.length >= 8) break;
  }

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
  return [
    {
      id: `${dateStr}-hc-0`,
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      league: 'Top European League',
      matchTime: new Date(new Date(targetDate).setHours(17, 0, 0, 0)).toISOString(),
      pick: 'Home or Draw',
      market: 'Double Chance',
      odds: 1.55,
      confidence: 'High' as const,
      reasoning: 'Picks loading — real match data will replace these once today\'s fixtures are confirmed by the sports feed.',
      result: 'pending' as const,
    },
    {
      id: `${dateStr}-hc-1`,
      homeTeam: 'Home Team B',
      awayTeam: 'Away Team B',
      league: 'Top European League',
      matchTime: new Date(new Date(targetDate).setHours(19, 0, 0, 0)).toISOString(),
      pick: 'Away or Draw',
      market: 'Double Chance',
      odds: 1.85,
      confidence: 'Medium' as const,
      reasoning: 'Picks loading — real match data will replace these once today\'s fixtures are confirmed by the sports feed.',
      result: 'pending' as const,
    },
  ];
}

async function generatePicksForDate(
  targetDate: Date,
  dayPlan: { stake: number; save: number; targetWin: number },
  dayNumber: number,
): Promise<StrategyPick[]> {
  let picks: StrategyPick[] = [];
  const dateStr = targetDate.toISOString().slice(0, 10);

  try {
    const upcoming = await getUpcomingMatches();
    const soccerMatches = upcoming.filter(
      (m) => m.sport.slug === 'soccer' || m.sport.slug === 'football'
    );

    // Filter to matches today (EAT)
    const dayMatches = soccerMatches.filter((m) => {
      const kickoffEAT = toEATDate(new Date(m.kickoffTime));
      return kickoffEAT.toISOString().slice(0, 10) === getTodayStrEAT(targetDate);
    });

    // Sort by league quality — all kick-off times are acceptable (midnight through late night).
    // Subscribers want picks at any hour as long as they belong to that calendar day in EAT.
    const sortedDay = [...dayMatches].sort((a, b) => {
      return leagueScore(a.league.name) - leagueScore(b.league.name); // league quality only
    });

    // Prefer matches WITH real bookmaker odds in top leagues
    const withOdds = sortedDay.filter(m => m.odds && m.odds.home > 1.05 && m.odds.away > 1.05);

    // Build the candidate pool: prioritise today's games with real odds
    const pool = withOdds.length >= 3
      ? withOdds.slice(0, 30)
      : sortedDay.length >= 2
        ? sortedDay.slice(0, 30)
        : soccerMatches
            .filter(m => m.odds && m.odds.home > 1.05)
            .sort((a, b) => leagueScore(a.league.name) - leagueScore(b.league.name))
            .slice(0, 30);

    // Build a rich match description for AI analysis
    const matchList = pool.map((m) => {
      const oddsStr = m.odds
        ? `Home=${m.odds.home} Draw=${m.odds.draw} Away=${m.odds.away}`
        : 'odds unavailable';
      const lq = leagueScore(m.league.name);
      const lqLabel = lq === 1 ? '★★★★★' : lq === 2 ? '★★★★' : lq === 3 ? '★★★' : '★★';
      const kickEAT = toEATDate(new Date(m.kickoffTime));
      const timeStr = kickEAT.toISOString().slice(11, 16) + ' EAT';
      return `• ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.league.name} ${lqLabel} | KO: ${timeStr} | ${oddsStr}`;
    }).join('\n');

    const openai = getOpenAI();
    if (openai && matchList) {
      const dateDisplay = targetDate.toLocaleDateString('en-KE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      const prompt = `You are the head football analyst at Betcheza — Kenya's #1 tipster platform. Paying subscribers trust this "3 Daily Sure Odds" strategy completely. Getting the picks wrong damages trust, costs people money, and harms the brand. Be extremely careful and accurate.

Date: ${dateDisplay} — Day ${dayNumber} of 7 | Stake: KES ${dayPlan.stake.toLocaleString()} → Target: KES ${dayPlan.targetWin.toLocaleString()}

═══════════════════════════════════════════
OBJECTIVE
═══════════════════════════════════════════
Select 2–6 football picks whose combined accumulator odds multiply to between 2.90 and 4.20.

═══════════════════════════════════════════
STRICT RULES — MUST FOLLOW
═══════════════════════════════════════════
1. ONLY use matches from the list below. Never invent matches or teams.
2. ONLY use the bookmaker odds shown (Home=/Draw=/Away=). If no odds are shown, DO NOT include that match.
3. PREFER top-tier leagues (5-star ★★★★★ and 4-star ★★★★ ratings). Avoid 2-star leagues unless no better option exists.
4. NEVER pick an outright winner unless their odds are ≤ 1.80. Otherwise use Double Chance.
5. PREFER Double Chance (1X or X2) over straight 1X2 picks — covers two outcomes.
6. AVOID coin-flip matches where home and away odds are within 0.30 of each other (balanced match, too risky).
7. Combined odds MUST land in [2.90 – 4.20]. Recalculate before finalising.
8. KICK-OFF TIME: Picks can come from ANY time of day — midnight games, 10pm games, early morning, and afternoon matches are all equally acceptable as long as they fall on the correct date in EAT. Do NOT filter or deprioritise matches based on kick-off hour. Focus entirely on odds quality and league tier.
9. Confidence must be "High" (odds ≤ 1.45), "Medium" (1.46–1.75), or "Low" (1.76+).
10. The "reasoning" field MUST include: (a) why this team is favoured, (b) what the odds tell you, (c) which market you chose and why.

═══════════════════════════════════════════
DEEP ANALYSIS CHECKLIST (for each pick)
═══════════════════════════════════════════
Consider and mention in reasoning where relevant:
• Home vs away record (home advantage is real in football)
• Recent form — are they on a winning streak or struggling?
• Head-to-head pattern — who dominates historically?
• Bookmaker implied probability — does the price reflect the true risk?
• League position / stakes — is this a must-win? End of season pressure?
• Squad strength — is this a top-tier team vs a weaker opponent?
• Market selection — why Double Chance over 1X2? Why this side and not the other?

═══════════════════════════════════════════
AVAILABLE MATCHES
═══════════════════════════════════════════
${matchList}

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════
Return ONLY a valid JSON array. No markdown, no commentary, just the JSON:
[
  {
    "homeTeam": "...",
    "awayTeam": "...",
    "league": "...",
    "matchTime": "ISO-8601 string",
    "pick": "Team Name or Draw",
    "market": "Double Chance",
    "odds": 1.45,
    "confidence": "High",
    "reasoning": "Detailed 2-3 sentence analysis covering form, odds value, and market choice..."
  }
]

Double-check: multiply all odds together. Result MUST be between 2.90 and 4.20.`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 3000,
        temperature: 0.3, // Lower temp = more conservative, consistent picks
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const jsonStr = cleaned.startsWith('[') ? cleaned : `[${cleaned}]`;
        const parsed = JSON.parse(jsonStr);
        const arr = Array.isArray(parsed) ? parsed : [];

        if (arr.length >= 1) {
          const candidates: StrategyPick[] = arr.slice(0, 8).map((p: StrategyPick, i: number) => {
            const rawOdds = parseFloat(String(p.odds));
            // Reject obviously wrong odds (invented, not from bookmaker list)
            const validOdds = rawOdds >= 1.05 && rawOdds <= 20 ? rawOdds : 1.50;
            return {
              ...p,
              id: `${dateStr}-${i}`,
              odds: validOdds,
              confidence: p.confidence || (validOdds <= 1.45 ? 'High' : validOdds <= 1.75 ? 'Medium' : 'Low'),
              result: 'pending' as const,
              reasoning: p.reasoning || buildReasoning(p.homeTeam, p.awayTeam, p.league, p.pick, p.market, validOdds),
            };
          });

          const combined = candidates.reduce((acc, p) => acc * p.odds, 1);

          // Accept if AI got the combined odds right
          if (combined >= 2.70 && combined <= 4.50) {
            picks = candidates;
            console.log(`[daily-strategy] AI picks accepted: ${picks.length} legs, combined=${combined.toFixed(2)}`);
          } else {
            console.warn(`[daily-strategy] AI picks rejected — combined=${combined.toFixed(2)} outside [2.70–4.50]. Using greedy fallback.`);
          }
        }
      } catch (parseErr) {
        console.warn('[daily-strategy] AI JSON parse error:', parseErr);
      }
    }

    // Fallback: greedy safety-first accumulator from real bookmaker odds
    if (picks.length === 0 && pool.length > 0) {
      const oddsPool = pool.filter(m => m.odds && m.odds.home > 1.05 && m.odds.away > 1.05);
      if (oddsPool.length >= 2) {
        picks = buildGreedyAccumulator(oddsPool, dateStr, 2.90, 4.20);
        console.log(`[daily-strategy] Greedy picks: ${picks.length} legs`);
      }
      // If still no picks — use any matches, odds optional
      if (picks.length === 0 && pool.length > 0) {
        picks = buildGreedyAccumulator(pool.slice(0, 15), dateStr, 2.90, 4.20);
      }
    }
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    const isQuota = err?.status === 429 || err?.code === 'insufficient_quota';
    if (isQuota) {
      console.warn('[daily-strategy] OpenAI quota exhausted — using greedy fallback');
    } else {
      console.error('[daily-strategy] generate error:', err?.message ?? e);
    }
  }

  // Never return placeholder picks — return empty so the caller knows
  // to skip persisting and try again later when real data is available.
  if (picks.length === 0) {
    console.warn(`[daily-strategy] No real picks available for ${dateStr} — skipping fallback placeholder save`);
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

    // Skip only if real (non-placeholder) picks already exist
    const isPlaceholder = (picksJson: string | null): boolean => {
      if (!picksJson) return false;
      try {
        const arr = JSON.parse(picksJson) as Array<{ homeTeam?: string; reasoning?: string }>;
        return Array.isArray(arr) && arr.length > 0 && arr.every(
          (p) => p.homeTeam === 'Home Team' || p.homeTeam === 'Home Team B' ||
                  (p.reasoning || '').includes('Picks loading')
        );
      } catch { return false; }
    };

    if (existing.rows.length > 0 && existing.rows[0].picks && !isPlaceholder(existing.rows[0].picks)) {
      return NextResponse.json({ success: true, message: 'Already posted for today', date: todayStr });
    }

    const picks = await generatePicksForDate(now, plan, dayNumber);

    // Don't persist if we got nothing real — try again on next cron run
    if (picks.length === 0) {
      return NextResponse.json({ success: false, message: 'No real picks available yet — will retry', date: todayStr });
    }

    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);

    console.log(`[daily-strategy] Final: ${picks.length} picks, combined=${combinedOdds.toFixed(2)}, leagues=${picks.map(p => p.league).join(' | ')}`);

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
      const idx = stored.days.findIndex((d: DayPrediction) => d.date === todayStr);
      if (idx >= 0) {
        stored.days[idx].picks = picks;
        stored.days[idx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
        stored.days[idx].status = 'active';
        fileStoreSet(`strategy-week-${weekId}`, stored);
      }
    }

    return NextResponse.json({ success: true, date: todayStr, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error('[daily-strategy] cron error:', err?.message ?? e);
    const picks = await generatePicksForDate(now, plan, dayNumber);
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);

    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) {
      const idx = stored.days.findIndex((d: DayPrediction) => d.date === todayStr);
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
