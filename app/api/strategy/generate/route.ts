import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick, DayPrediction } from '../predictions/route';

// EAT = UTC+3
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
function toEATDateStr(d: Date): string {
  return new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

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
  // Safe-market fallback: prefer Double Chance (Home or Draw) over straight 1X2.
  // Double Chance covers 2 of 3 outcomes, dramatically improving hit rate.
  let odds = 1.35;
  let pick = `${match.homeTeam.name} or Draw`;
  let market = 'Double Chance';

  if (match.odds) {
    const { home, draw } = match.odds;
    // Home or Draw (1X) — protects against a draw killing a straight home win bet
    const dc1X = parseFloat(((home * draw) / (home + draw)).toFixed(2));
    if (dc1X >= 1.10 && dc1X <= 1.65) {
      odds = dc1X;
      pick = `${match.homeTeam.name} or Draw`;
      market = 'Double Chance';
    } else if (home >= 1.30 && home <= 1.70) {
      // Strong favourite — use Draw No Bet instead of straight win
      odds = home;
      pick = `${match.homeTeam.name} (Draw No Bet)`;
      market = 'Draw No Bet';
    }
    // else: keep default Double Chance at 1.35
  }

  return {
    id: `${Date.now()}-fp`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: new Date(match.kickoffTime).toISOString(),
    pick,
    market,
    odds: parseFloat(odds.toFixed(2)),
    confidence: 'High',
    reasoning: `${pick} at ${odds.toFixed(2)} — safe market covering two outcomes. Used as a conservative fallback when AI generation is unavailable.`,
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
    // Use getAllMatches (not getUpcomingMatches) so live matches are included —
    // today's games may already be in-progress when the admin clicks Override.
    const allMatches = await getAllMatches();
    const targetDateEAT = dayData.date; // YYYY-MM-DD in EAT

    const soccerToday = allMatches.filter(
      (m) =>
        (m.sport.slug === 'soccer' || m.sport.slug === 'football') &&
        toEATDateStr(new Date(m.kickoffTime)) === targetDateEAT
    ).slice(0, 30);

    // If fewer than 2 soccer matches, extend with all-sport matches for that EAT day
    let extendedPool = soccerToday;
    if (soccerToday.length < 2) {
      const allToday = allMatches.filter(
        (m) => toEATDateStr(new Date(m.kickoffTime)) === targetDateEAT
      );
      extendedPool = [
        ...soccerToday,
        ...allToday.filter(m => m.sport.slug !== 'soccer' && m.sport.slug !== 'football'),
      ].slice(0, 30);
    }

    // If still no matches for this date, return a clear error — never use other days' games.
    if (extendedPool.length === 0) {
      return NextResponse.json(
        { error: `No matches found for ${targetDateEAT}. The sports cache may still be warming up — try again in a minute.` },
        { status: 404 }
      );
    }

    const matchList = extendedPool
      .map((m) => {
        let oddsStr = '';
        if (m.odds) {
          const { home, draw, away } = m.odds;
          const implH = home > 0 ? Math.round(100 / home) : 0;
          const implD = draw > 0 ? Math.round(100 / draw) : 0;
          const implA = away > 0 ? Math.round(100 / away) : 0;
          oddsStr = ` | Odds: H=${home}(${implH}%) D=${draw}(${implD}%) A=${away}(${implA}%)`;
        }
        return `- ${m.homeTeam.name} vs ${m.awayTeam.name} | League: ${m.league.name} | Sport: ${m.sport.name} | Kickoff: ${new Date(m.kickoffTime).toUTCString()}${oddsStr}`;
      })
      .join('\n');

    const today = new Date(dayData.date).toDateString();

    const openai = getOpenAI();
    if (openai && matchList) {
      const prompt = `You are an elite football intelligence analyst for Betcheza Daily Strategy — a real-money subscription service in Kenya. Subscribers stake serious money every day. Losses cost them real cash and cost us their trust. Your one job is to find the most predictable outcomes and combine them so the accumulator odds land between 3.00 and 4.00.

Today: ${today} | Strategy Day ${targetDay} | Stake: KES ${dayData.stake.toLocaleString()} | Target: KES ${dayData.targetWin.toLocaleString()}

════════════════════════════════════════════════════
THE ONLY FIXED RULE: COMBINED ODDS = 3.00 to 4.00
════════════════════════════════════════════════════

You may select 1 pick or up to 10 picks — the NUMBER does not matter at all.
What matters is that all picks multiplied together land STRICTLY between 3.00 and 4.00.

Examples:
- 1 pick with odds 3.50 = valid (3.50 is within 3.00–4.00)
- 2 picks: 1.80 × 1.90 = 3.42 = valid
- 3 picks: 1.50 × 1.40 × 1.55 = 3.26 = valid
- 4 picks: 1.30 × 1.30 × 1.30 × 1.45 = 3.20 = valid
- 5 picks: 1.20 × 1.20 × 1.20 × 1.20 × 1.45 = 2.99 = INVALID (below 3.00)
- 2 picks: 2.50 × 1.80 = 4.50 = INVALID (above 4.00)

Adjust the number of picks and which markets you use until the product is between 3.00 and 4.00.

════════════════════════════════════════════════════
STEP 1: INVESTIGATE EVERY MATCH (do this before selecting)
════════════════════════════════════════════════════

For each match consider:

A. MOTIVATION — What does each team actually need?
   - Already won the title / already relegated? They will rest players — avoid backing them as favourites.
   - Cup Final or European fixture within 4 days? Rotation is near-certain — massive upset risk.
   - Underdog fighting for survival vs complacent champion? Red flag on the favourite.

B. SQUAD RISK — Rotation, suspensions, injury to key players.

C. FORM IN CONTEXT — Home form vs away form. Weak opposition in recent run?

D. HEAD-TO-HEAD — Does the underdog historically perform well here? Derby factor?

E. MARKET SIGNALS — Where are bookmakers uncertain? Odds close to evens = neither team strongly favoured.

════════════════════════════════════════════════════
STEP 2: ELIMINATE RED FLAGS
════════════════════════════════════════════════════

DISCARD any match where:
- The favourite has secured everything (title/promotion/safety) and the game is meaningless
- Rotation risk is near-certain (upcoming big fixture)
- You cannot construct a clear evidence-based reason for the outcome
- The only reason is "they are the bigger club" with no context

════════════════════════════════════════════════════
STEP 3: CHOOSE THE BEST MARKET FOR EACH MATCH
════════════════════════════════════════════════════

Any market is valid. Use whichever gives the HIGHEST probability for that specific match:

- 1X2 (Home/Draw/Away) — when one outcome is clearly more likely
- Double Chance (1X, X2, 12) — covers two of three outcomes
- Draw No Bet — removes draw risk on a strong favourite
- Both Teams to Score Yes/No — based on defensive records
- Over/Under Goals (0.5, 1.5, 2.5, 3.5, 4.5) — based on scoring patterns
- Asian Handicap — when margin of victory is predictable
- Win to Nil — dominant team vs toothless attack
- Correct Score — only with unusually high conviction
- Half-time/Full-time — when half-time trajectory is clear
- Anytime Goalscorer — when a specific player is almost certain to score
- Any other market — if it is the most logical given the context

Pick the market with the HIGHEST actual probability, not the best-looking odds.

════════════════════════════════════════════════════
STEP 4: BUILD THE ACCUMULATOR TO HIT 3.00–4.00
════════════════════════════════════════════════════

- Start with your highest-confidence picks.
- Multiply odds as you add picks.
- Stop adding picks once the product is in the 3.00–4.00 window.
- If a single match has odds between 3.00 and 4.00, that alone is a valid selection.
- If you are at 3.80 and the next pick would push to 5.20 — stop at the current picks.
- NEVER go below 3.00 combined. NEVER go above 4.00 combined.
- Quality over quantity: 3 confident picks at 3.20 combined beats 7 guesses at 3.80.
- For confidence: "High" = 3+ strong contextual reasons; "Medium" = 1–2 solid reasons.

════════════════════════════════════════════════════
AVAILABLE MATCHES — ${today}
════════════════════════════════════════════════════
${matchList || 'No match data available — use your football knowledge for this date'}

════════════════════════════════════════════════════
OUTPUT — Return ONLY valid JSON. No markdown. No text outside the JSON array.
════════════════════════════════════════════════════
[
  {
    "homeTeam": "exact name from match list",
    "awayTeam": "exact name from match list",
    "league": "league name",
    "matchTime": "ISO 8601 datetime string",
    "pick": "e.g. Over 2.5 Goals | Manchester City | Draw No Bet | Home or Draw",
    "market": "1X2 | Double Chance | Over/Under | BTTS | Draw No Bet | Asian Handicap | ...",
    "odds": 1.75,
    "confidence": "High | Medium",
    "reasoning": "What each team needs, form context, why THIS market and THIS outcome. Minimum 2 sentences."
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
        const candidates = parsed.slice(0, 10).map((p, i) => ({
          ...p,
          id: `${weekId}-d${targetDay}-${i}`,
          odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
          result: 'pending' as const,
        }));
        const combined = candidates.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
        if (combined >= 3.0 && combined <= 4.0) {
          picks = candidates;
        }
      }
    }

    if (picks.length === 0) {
      // Non-AI fallback: pick first 2 real matches from the pool using rules-based selection.
      // extendedPool is guaranteed non-empty (we returned 404 above if it was empty).
      picks = extendedPool.slice(0, 2).map((m, i) => ({
        ...fallbackPick(m),
        id: `${weekId}-d${targetDay}-${i}`,
      }));
    }
  } catch (e) {
    console.error('[strategy/generate] error:', e);
    return NextResponse.json(
      { error: 'Failed to generate picks. Please try again.' },
      { status: 500 }
    );
  }

  if (picks.length === 0) {
    return NextResponse.json(
      { error: 'Could not generate picks for this day. No qualifying matches found.' },
      { status: 404 }
    );
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
