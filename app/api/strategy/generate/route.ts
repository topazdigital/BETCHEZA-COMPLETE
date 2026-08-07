import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getAllMatches, deriveSoccerMarkets } from '@/lib/api/unified-sports-api';
import type { Market } from '@/lib/api/unified-sports-api';
import OpenAI from 'openai';
import { getApiKey } from '@/lib/api-keys';
import type { WeeklyStrategy, StrategyPick, DayPrediction } from '../predictions/route';
import {
  normalizeStrategyTeamName,
  selectStrategyMatchPool,
  strategyMatchKey,
} from '@/lib/strategy-match-selection';

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

interface AIProvider { name: string; apiKey: string; baseURL?: string; model: string; }

async function getStrategyProviders(): Promise<AIProvider[]> {
  const [adminOpenAI, adminGroq] = await Promise.all([
    getApiKey('openai_api_key').catch(() => ''),
    getApiKey('groq_api_key').catch(() => ''),
  ]);
  const providers: AIProvider[] = [];
  // Groq first — free tier, no quota issues
  const groqKey = process.env.GROQ_API_KEY || adminGroq;
  if (groqKey) providers.push({ name: 'Groq', apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' });
  // OpenAI as fallback
  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || adminOpenAI;
  if (openaiKey) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
    providers.push({ name: 'OpenAI', apiKey: openaiKey, baseURL, model: process.env.OPENAI_MODEL || 'gpt-4o' });
  }
  return providers;
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

// Preferred market keys in priority order for the rules-based fallback.
// We only draw outcomes from these markets — they have clear real-world meaning.
const FALLBACK_MARKET_PRIORITY = [
  'double_chance',    // DC 1X / X2 / 12 — covers 2 of 3 outcomes
  'draw_no_bet',      // DNB — removes draw risk
  'totals_1_5',       // Over 1.5 goals — fires in ~75% of soccer matches
  'btts',             // Both Teams to Score
  'totals_2_5',       // Over/Under 2.5 goals
  'goal_first_half',  // Goal in 1st half
  'clean_sheet_home', // Home team keeps a clean sheet
  'clean_sheet_away', // Away team keeps a clean sheet
  'win_to_nil',       // Win without conceding
  'totals_3_5',       // Over 3.5 for high-scoring games
];

interface MatchCandidate {
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoffTime: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  prob: number;
}

function buildRulesBasedPicks(
  pool: Array<{
    homeTeam: { name: string };
    awayTeam: { name: string };
    league: { name: string };
    kickoffTime: Date | string;
    sport: { slug: string };
    odds?: { home: number; draw?: number | null; away: number } | null;
    markets?: Market[] | null;
  }>,
  weekId: string,
  targetDay: number,
): StrategyPick[] {
  const allCandidates: MatchCandidate[] = [];

  for (const m of pool) {
    const isSoccer = m.sport.slug === 'soccer' || m.sport.slug === 'football';
    if (!isSoccer || !m.odds) continue;
    const { home, away } = m.odds;
    const draw = m.odds.draw ?? 3.5;
    if (!home || !away) continue;

    // Derive full market suite from 1X2 via Poisson model
    const derived = deriveSoccerMarkets(home, draw, away, m.homeTeam.name, m.awayTeam.name);

    // Merge real bookmaker markets (they take priority)
    const markets = [...derived];
    if (m.markets?.length) {
      for (const bk of m.markets) {
        const idx = markets.findIndex(d => d.key === bk.key);
        if (idx >= 0) markets[idx] = bk; else markets.push(bk);
      }
    }

    const matchKey = `${m.homeTeam.name}|${m.awayTeam.name}`;

    for (const priorityKey of FALLBACK_MARKET_PRIORITY) {
      const mk = markets.find(m => m.key === priorityKey);
      if (!mk) continue;

      // Pick the single best outcome from this market
      // "Best" = highest implied probability within a sensible odds range (1.10–2.20)
      const best = mk.outcomes
        .filter(o => o.price >= 1.10 && o.price <= 2.20)
        .sort((a, b) => a.price - b.price)[0]; // lowest odds = highest probability

      if (!best) continue;

      allCandidates.push({
        matchKey,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        kickoffTime: new Date(m.kickoffTime).toISOString(),
        marketName: mk.name,
        outcomeName: best.name,
        odds: best.price,
        prob: 1 / best.price,
      });
      break; // one market per match per candidate (lowest-odds market wins)
    }
  }

  // Sort by probability descending (highest probability = lowest odds first)
  allCandidates.sort((a, b) => b.prob - a.prob);

  // Greedy accumulator: add picks until combined odds lands in 3.00–4.00
  const chosen: MatchCandidate[] = [];
  const usedMatches = new Set<string>();
  let combined = 1;

  for (const c of allCandidates) {
    if (usedMatches.has(c.matchKey)) continue; // one pick per match only
    const next = combined * c.odds;
    if (next > 4.25) continue; // this step overshoots — skip to a smaller one
    chosen.push(c);
    usedMatches.add(c.matchKey);
    combined = next;
    if (combined >= 3.0) break; // target window reached
  }

  if (chosen.length === 0) return [];

  return chosen.map((c, i) => ({
    id: `${weekId}-d${targetDay}-rb-${i}`,
    homeTeam: c.homeTeam,
    awayTeam: c.awayTeam,
    league: c.league,
    matchTime: c.kickoffTime,
    pick: c.outcomeName,
    market: c.marketName,
    odds: parseFloat(c.odds.toFixed(2)),
    confidence: c.prob > 0.62 ? 'High' : 'Medium',
    reasoning: `${c.outcomeName} (${c.marketName}) at ${c.odds.toFixed(2)} — implied probability ${Math.round(c.prob * 100)}%. Selected by rules-based Poisson analysis as the highest-confidence outcome available across all markets for this match.`,
    result: 'pending' as const,
  }));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetDay: number = body.day || 1;
  const excludedMatches = Array.isArray(body.excludeMatches)
    ? body.excludeMatches
        .filter((m: unknown): m is { homeTeam?: string; awayTeam?: string } => !!m && typeof m === 'object')
        .map((m: { homeTeam?: string; awayTeam?: string }) => strategyMatchKey(m.homeTeam || '', m.awayTeam || ''))
    : [];
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
    // but the selector below removes live/finished/past events before analysis.
    const allMatches = await getAllMatches();
    const targetDateEAT = dayData.date; // YYYY-MM-DD in EAT

    let extendedPool = selectStrategyMatchPool(allMatches, targetDateEAT, {
      maxMatches: 30,
      excludeMatches: excludedMatches,
    });
    // If regeneration excluded every available alternative, use the eligible
    // pool rather than returning a misleading "no matches" error.
    if (extendedPool.length === 0 && excludedMatches.length > 0) {
      extendedPool = selectStrategyMatchPool(allMatches, targetDateEAT, { maxMatches: 30 });
    }

    // Never use another date's games or already-started matches.
    if (extendedPool.length === 0) {
      return NextResponse.json(
        { error: `No future scheduled football matches found for ${targetDateEAT}. Try again when that day's fixtures are available.` },
        { status: 404 }
      );
    }

    // Keys we actually send to the AI — only the markets useful for game reasoning.
    // Exotic markets (Correct Score, HT/FT, Exact Goals, Odd/Even) balloon the prompt
    // without helping the AI reason about how the match will play out.
    const AI_MARKET_KEYS = [
      'double_chance',    // 1X / X2 / 12
      'draw_no_bet',      // DNB
      'btts',             // Both Teams to Score
      'totals_1_5',       // Over/Under 1.5 Goals
      'totals_2_5',       // Over/Under 2.5 Goals
      'totals_3_5',       // Over/Under 3.5 Goals
      'asian_handicap',   // AH line
      'win_to_nil',       // Win to Nil
    ];

    const matchList = extendedPool
      .map((m) => {
        const isSoccer = m.sport.slug === 'soccer' || m.sport.slug === 'football';

        // ── 1X2 base odds with implied probabilities ─────────────────────────
        let oddsStr = '';
        if (m.odds) {
          const { home, draw, away } = m.odds;
          const implH = home > 0 ? Math.round(100 / home) : 0;
          const implD = draw && draw > 0 ? Math.round(100 / draw) : 0;
          const implA = away > 0 ? Math.round(100 / away) : 0;
          const drawPart = draw ? ` D=${draw}(${implD}%)` : '';
          oddsStr = ` | 1X2: H=${home}(${implH}%)${drawPart} A=${away}(${implA}%)`;
        }

        // ── Derive useful markets (soccer only) ──────────────────────────────
        const mkParts: string[] = [];
        if (isSoccer && m.odds) {
          const { home, away } = m.odds;
          const draw = m.odds.draw ?? 3.5;
          if (home > 1 && away > 1) {
            const derived = deriveSoccerMarkets(home, draw, away, m.homeTeam.name, m.awayTeam.name);

            // Merge bookmaker markets over derived ones
            const merged = [...derived];
            if (m.markets?.length) {
              for (const bk of m.markets) {
                const idx = merged.findIndex(d => d.key === bk.key);
                if (idx >= 0) merged[idx] = bk; else merged.push(bk);
              }
            }

            // Only output the AI-useful keys, compact format
            for (const key of AI_MARKET_KEYS) {
              const mk = merged.find(x => x.key === key);
              if (!mk) continue;
              const outcomes = mk.outcomes.map(o => `${o.name}=${o.price}`).join(' ');
              mkParts.push(`${mk.name}: ${outcomes}`);
            }
          }
        }

        const marketsStr = mkParts.length ? `\n  ↳ ${mkParts.join(' | ')}` : '';
        return `- ${m.homeTeam.name} vs ${m.awayTeam.name} [${m.league.name}] ${new Date(m.kickoffTime).toUTCString()}${oddsStr}${marketsStr}`;
      })
      .join('\n');

    const today = new Date(dayData.date).toDateString();

    const providers = await getStrategyProviders();
    if (providers.length > 0 && matchList) {
      const prompt = `You are a sharp football betting analyst for Betcheza Daily Strategy, a real-money service in Kenya. Your job: study the matches below and build a 2–4 pick accumulator with combined odds between 3.00 and 4.00.

Today: ${today} | Day ${targetDay} | Stake: KES ${dayData.stake.toLocaleString()} | Target: KES ${dayData.targetWin.toLocaleString()}

━━━ THE CONSTRAINT ━━━
Combined odds of ALL your picks multiplied together must land between 3.00 and 4.00.
• 2 picks at 1.75 × 1.90 = 3.33 ✓
• 3 picks at 1.50 × 1.45 × 1.40 = 3.05 ✓
• 2 picks at 1.80 × 1.80 = 3.24 ✓
• 2 picks at 2.20 × 2.00 = 4.40 ✗ (too high)
• 4 picks at 1.10 × 1.14 × 1.16 × 1.78 = 2.59 ✗ (too low)

MINIMUM ODDS PER PICK: Each individual pick must have odds of at least 1.40.
• Do NOT pick anything priced at 1.10, 1.15, 1.20, 1.25, 1.30 — these are bookmaker traps. A single upset destroys the slip, and the return on a correct pick is negligible.
• Prefer 2–3 picks with odds between 1.50 and 2.20 each. This naturally hits 3.00–4.00 combined.
• If a match has no outcome worth at least 1.40, skip it and pick a different match.

━━━ HOW TO ANALYSE EACH MATCH ━━━
For every match, ask: "How will THIS game actually play out?"

Think about:
- MOTIVATION: Does each team need points urgently, or is pressure off? A side with nothing to play for is unpredictable.
- FORM: Not just wins/losses — quality of opposition matters. Five wins against bottom-half sides means little.
- ATTACKING vs DEFENSIVE STYLE: Some teams are set up to grind 1-0 wins. Others always trade goals. This shapes whether to back goals or results.
- HEAD-TO-HEAD PATTERNS: Some fixtures are historically tight and end in draws regardless of form.
- ODDS SIGNAL: When bookmakers price a Draw at 3.20 or higher, they believe it is unlikely. When it is 2.80 or lower, they see it as very possible. Use this.

━━━ PICK THE RIGHT OUTCOME FOR EACH MATCH ━━━
Do NOT default to the lowest odds just because it is the "safest" number. A short-priced favourite can easily lose or draw. Pick what the MATCH CONTEXT points to:

- If two evenly-matched teams with defensive setups face each other → Draw or Under 2.5 may be the right call, even at 2.80–3.40.
- If the away team has won 4 of their last 5 away games → Away win is valid, even at 2.50+.
- If both teams have been conceding and scoring freely → BTTS Yes or Over 2.5 Goals.
- If a dominant home side is facing a weak away attack → Win to Nil or Draw No Bet.
- Use Double Chance (1X or X2) to protect against a single uncertain outcome, not as a default for every match.

Any outcome is valid: Home Win, Draw, Away Win, BTTS, Over/Under, Draw No Bet, Asian Handicap, Win to Nil. Pick what the game context actually supports.

━━━ AVAILABLE MATCHES ━━━
${matchList}

━━━ OUTPUT ━━━
Return ONLY a valid JSON array. No markdown, no explanation outside the array.
[
  {
    "homeTeam": "exact name from match list",
    "awayTeam": "exact name from match list",
    "league": "league name",
    "matchTime": "ISO 8601 datetime",
    "pick": "specific outcome e.g. Draw | Away Win | Over 2.5 Goals | BTTS Yes | Home or Draw",
    "market": "1X2 | Draw | Double Chance | Over/Under | BTTS | Draw No Bet | Win to Nil | Asian Handicap",
    "odds": 1.85,
    "confidence": "High | Medium",
    "reasoning": "2–3 sentences: what the match context tells you and why this specific outcome makes sense for THIS game — not just 'low odds'."
  }
]`;

      for (const provider of providers) {
        try {
          const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL });
          const completion = await client.chat.completions.create({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2500,
            temperature: 0.3,
          });

          const raw = completion.choices?.[0]?.message?.content || '[]';
          let parsed: StrategyPick[] = [];
          try {
            const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
            const obj = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
            parsed = Array.isArray(obj) ? obj : (obj.picks || obj.selections || []);
          } catch { /* try next provider */ }

           if (parsed.length >= 1) {
             const candidates = parsed.slice(0, 10).flatMap((p, i) => {
               const home = normalizeStrategyTeamName(String(p.homeTeam || ''));
               const away = normalizeStrategyTeamName(String(p.awayTeam || ''));
               const source = extendedPool.find((m) =>
                 normalizeStrategyTeamName(m.homeTeam.name) === home &&
                 normalizeStrategyTeamName(m.awayTeam.name) === away
               );
               // Never persist an AI-invented fixture or a kickoff time that
               // differs from the real provider event.
               if (!source) return [];
               return [{
                 ...p,
                 id: `${weekId}-d${targetDay}-${i}`,
                 homeTeam: source.homeTeam.name,
                 awayTeam: source.awayTeam.name,
                 league: source.league.name,
                 matchTime: new Date(source.kickoffTime).toISOString(),
                 odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
                 result: 'pending' as const,
               }];
             });
            const combined = candidates.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
            // Accept if combined odds land in 2.90–4.50 (target 3.00–4.00, small buffer for rounding).
            // 2.59 and below is too low — reject and fall through to rules-based.
            if (combined >= 2.9 && combined <= 4.5) {
              picks = candidates;
              console.log(`[strategy/generate] ✓ Groq picks via ${provider.name}, combined=${combined.toFixed(2)}`);
              break;
            }
            console.warn(`[strategy/generate] ✗ ${provider.name} combined=${combined.toFixed(2)} outside 2.90–4.50 — trying next`);
          }
        } catch (provErr) {
          console.warn(`[strategy/generate] ${provider.name} failed:`, provErr instanceof Error ? provErr.message : provErr);
          // continue to next provider
        }
      }
    }

    if (picks.length === 0) {
      // Rules-based fallback: build an accumulator that targets 3.00–4.00 combined odds.
      // Uses Poisson-derived markets so picks are grounded in real probabilities.
      picks = buildRulesBasedPicks(extendedPool, weekId, targetDay);
      console.log(`[strategy/generate] rules-based fallback: ${picks.length} picks, combined=${picks.reduce((a, p) => a * p.odds, 1).toFixed(2)}`);
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
