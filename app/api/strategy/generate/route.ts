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
      .map((m) => `- ${m.homeTeam.name} vs ${m.awayTeam.name} | League: ${m.league.name} | Sport: ${m.sport.name} | Kickoff: ${new Date(m.kickoffTime).toUTCString()}${m.odds ? ` | Odds: H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''}`)
      .join('\n');

    const today = new Date(dayData.date).toDateString();

    const openai = getOpenAI();
    if (openai && matchList) {
      const prompt = `You are the head analyst for Betcheza Daily Strategy — a paid subscription service in Kenya where subscribers stake REAL money (KES ${dayData.stake.toLocaleString()}) every day. Your job is NOT to be interesting or chase big odds. Your job is to WIN. A subscriber who loses 3 days in a row cancels and tells their friends the service is a scam. Every loss has real consequences.

Today: ${today} | Day ${targetDay} | Stake KES ${dayData.stake.toLocaleString()} | Target KES ${dayData.targetWin.toLocaleString()}

══════════════════════════════════════════════════════
RULE 1: PROBABILITY FIRST — MINIMUM 85% CONFIDENCE PER PICK
══════════════════════════════════════════════════════

Before picking any game, honestly estimate: "What is the probability this outcome occurs?"
If your honest answer is below 85%, DO NOT INCLUDE IT. Period. No exceptions.

APPROVED MARKETS (use ONLY these — they have genuinely high hit rates):

1. OVER 0.5 GOALS — nearly any match between two teams that both try to score.
   Fails only when: extreme defensive setup, goalless derby, both keepers exceptional.
   Typical hit rate: 92–96%. BEST choice for certainty.

2. OVER 1.5 GOALS — high-scoring leagues (Bundesliga, Premier League, Ligue 1, Brazilian top flight).
   Only pick if: both teams average 1.5+ goals/game AND the match has genuine competition.
   Typical hit rate: 75–85%. Only use when scoring signals are very strong.

3. DOUBLE CHANCE — Home or Draw (1X) only.
   Use when: home team is stronger but a draw is possible.
   Never pick "12" (Home or Away) — that removes only the draw, adding risk.
   Typical hit rate: 80–88% for genuine home favourites.

4. DRAW NO BET — back a clear favourite, money back on draw.
   Only use when: favourite odds are 1.30–1.70 and they are clearly the stronger team.
   Typical hit rate: 78–85%.

5. BOTH TEAMS NOT TO SCORE (BTTS No) — when one team has an iron-clad defence.
   Only pick if: at least one team has kept 4+ clean sheets in last 6 competitive games.
   Typical hit rate: 60–70%. Use sparingly, only with very strong defensive evidence.

══════════════════════════════════════════════════════
RULE 2: STRICTLY BANNED MARKETS — NEVER USE THESE
══════════════════════════════════════════════════════

X Correct Score — never 85%+ probability, ever
X First/Anytime Goalscorer — too variable
X Straight Home Win or Away Win (1X2) — a single draw kills it
X BTTS Yes — requires both teams to score; one clean sheet ends it
X Over 2.5 Goals — only ~55% hit rate across most leagues; too risky
X Asian Handicap — unnecessary complexity
X Half-time/Full-time — requires two conditions; probability compounds down
X Corners, Cards — completely unpredictable

══════════════════════════════════════════════════════
RULE 3: MATCH SELECTION — DISCARD ANY RISKY GAME
══════════════════════════════════════════════════════

REJECT immediately if:
X Either team has already secured their objective (title/promotion/survival) — motivation gone
X Either team has a major fixture within 4 days — rotation risk is near-certain
X It is a local derby — form is irrelevant, anything can happen
X The league is obscure or data is unavailable — you cannot analyse what you do not know
X You have any serious doubt about squad selection, motivation, or context

PREFER matches where:
Both teams are competitive, motivated, neither can afford to drop points
The league is well-documented (top 5 European leagues, major South American, MLS, etc.)
The specific outcome you are predicting has at least 3 concrete supporting reasons

══════════════════════════════════════════════════════
RULE 4: ACCUMULATOR SIZE — 2 OR 3 PICKS ONLY
══════════════════════════════════════════════════════

Select EXACTLY 2 or 3 picks. Never more. Here is the math:
  3 picks at 90% each = 73% daily win rate — GOOD
  4 picks at 90% each = 66% daily win rate — mediocre
  5 picks at 85% each = 44% daily win rate — you lose more than you win

Combined odds will naturally be low (1.5x–2.8x). This is correct and intentional.
Subscribers prefer winning KES ${Math.round(dayData.stake * 2.0).toLocaleString()}–${Math.round(dayData.stake * 2.8).toLocaleString()} reliably over chasing KES ${Math.round(dayData.stake * 4).toLocaleString()} and losing constantly.

If you cannot find 2 picks at 85%+ confidence, output ONLY 1 pick.
A single certain pick is better than a padded multi with a weak leg.

══════════════════════════════════════════════════════
AVAILABLE MATCHES — ${today}
══════════════════════════════════════════════════════
${matchList || 'No match data — use your football knowledge for this date'}

══════════════════════════════════════════════════════
OUTPUT — Return ONLY a valid JSON array. No markdown fences. No extra text.
══════════════════════════════════════════════════════
[
  {
    "homeTeam": "exact name from match list",
    "awayTeam": "exact name from match list",
    "league": "league name",
    "matchTime": "ISO 8601 datetime",
    "pick": "e.g. Over 1.5 Goals | Home or Draw | Draw No Bet | Over 0.5 Goals",
    "market": "Over/Under | Double Chance | Draw No Bet | BTTS",
    "odds": 1.20,
    "confidence": "High",
    "reasoning": "State your estimated probability (e.g. 91%). Give 3 specific reasons: scoring average, form, defensive record, motivation. No vague language like 'strong team'."
  }
]

FINAL RULES:
- Every pick must have "confidence": "High". If not High, exclude it.
- Odds must match the ACTUAL market odds (Over 0.5 Goals is ~1.05–1.20; Double Chance ~1.15–1.50).
- Output 1, 2, or 3 picks. Never 0, never 4 or more.
- When in doubt about any pick: leave it out.`;

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
        const candidates = parsed.slice(0, 3).map((p, i) => ({
          ...p,
          id: `${weekId}-d${targetDay}-${i}`,
          odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
          result: 'pending' as const,
        }));
        const combined = candidates.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
        if (combined >= 1.3 && combined <= 4.0) {
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
