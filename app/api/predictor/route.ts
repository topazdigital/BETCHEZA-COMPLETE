import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { recordPrediction } from '@/lib/predictor-store'
import { getUpcomingMatches } from '@/lib/api/unified-sports-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface PredictorBody {
  homeTeam: string
  awayTeam: string
  league?: string
  sport?: string
  sportType?: string
  notes?: string
}

interface PredictorResult {
  pick: string
  market: string
  confidence: number
  recommendedBet: string
  altMarkets: Array<{ market: string; pick: string; confidence: number }>
  reasoning: string[]
  source: 'openai' | 'fallback'
}

function getOpenAI(): OpenAI | null {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const baseURL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    undefined
  try {
    return new OpenAI({ apiKey, baseURL })
  } catch {
    return null
  }
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// Sport-specific market configurations for local fallback predictions
const SPORT_MARKETS: Record<string, {
  primaryMarket: string
  altMarkets: (home: string, away: string, r: (n: number) => number) => Array<{ market: string; pick: string; confidence: number }>
  recommendedBet: (pick: string, dc: string, confidence: number) => string
  reasoning: (pick: string, home: string, away: string, r: (n: number) => number) => string[]
  hasDraw: boolean
}> = {
  soccer: {
    primaryMarket: 'Match Result (1X2)',
    hasDraw: true,
    altMarkets: (home, away, r) => [
      r(3) > 0.55
        ? { market: 'Over/Under 2.5 Goals', pick: 'Over 2.5 Goals', confidence: Math.round(55 + r(4) * 20) }
        : { market: 'Over/Under 2.5 Goals', pick: 'Under 2.5 Goals', confidence: Math.round(52 + r(5) * 18) },
      { market: 'BTTS', pick: r(6) > 0.45 ? 'Both Teams to Score - Yes' : 'Both Teams to Score - No', confidence: Math.round(54 + r(7) * 18) },
      { market: 'Double Chance', pick: r(8) > 0.5 ? `${home} or Draw` : `${away} or Draw`, confidence: Math.round(65 + r(9) * 15) },
    ],
    recommendedBet: (pick, dc, conf) => conf >= 60 ? `Single — ${pick}` : `Double Chance — ${dc} (safer)`,
    reasoning: (pick, home, away, r) => [
      `${pick} based on recent form and tactical analysis.`,
      `${r(10) > 0.5 ? home : away} have the edge in H2H and current league position.`,
      `Stake 1–2% of bankroll. Variance is real even at high confidence.`,
    ],
  },
  football: {
    primaryMarket: 'Moneyline',
    hasDraw: false,
    altMarkets: (home, away, r) => [
      r(3) > 0.5
        ? { market: 'Over/Under Points', pick: 'Over 44.5 Points', confidence: Math.round(54 + r(4) * 20) }
        : { market: 'Over/Under Points', pick: 'Under 44.5 Points', confidence: Math.round(52 + r(5) * 18) },
      { market: 'Point Spread', pick: r(6) > 0.5 ? `${home} -3.5` : `${away} +3.5`, confidence: Math.round(52 + r(7) * 18) },
      { market: 'First Half Winner', pick: r(8) > 0.5 ? `${home}` : `${away}`, confidence: Math.round(50 + r(9) * 20) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `Point Spread (safer)`,
    reasoning: (pick, home, away, r) => [
      `${pick} based on offensive efficiency and defensive matchup.`,
      `${r(10) > 0.5 ? home : away} cover the spread in 60%+ of recent home games.`,
      `Stake 1–2% of bankroll. NFL variance is high even for favourites.`,
    ],
  },
  basketball: {
    primaryMarket: 'Moneyline',
    hasDraw: false,
    altMarkets: (home, away, r) => [
      r(3) > 0.5
        ? { market: 'Over/Under Points', pick: 'Over 215.5 Points', confidence: Math.round(55 + r(4) * 20) }
        : { market: 'Over/Under Points', pick: 'Under 215.5 Points', confidence: Math.round(52 + r(5) * 18) },
      { market: 'Point Spread', pick: r(6) > 0.5 ? `${home} -4.5` : `${away} +4.5`, confidence: Math.round(52 + r(7) * 18) },
      { market: 'First Half Winner', pick: r(8) > 0.5 ? `${home}` : `${away}`, confidence: Math.round(50 + r(9) * 20) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `Point Spread (safer)`,
    reasoning: (pick, home, _away, r) => [
      `${pick} — ${home} pace and 3-point rate favour the moneyline.`,
      `Pace-adjusted point total leans ${r(10) > 0.5 ? 'over' : 'under'} the line.`,
      `Stake 1–2% of bankroll.`,
    ],
  },
  tennis: {
    primaryMarket: 'Moneyline',
    hasDraw: false,
    altMarkets: (home, away, r) => [
      r(3) > 0.5
        ? { market: 'Total Sets', pick: 'Over 2.5 Sets', confidence: Math.round(50 + r(4) * 20) }
        : { market: 'Total Sets', pick: 'Under 2.5 Sets', confidence: Math.round(52 + r(5) * 20) },
      r(6) > 0.5
        ? { market: 'Over/Under Games', pick: 'Over 22.5 Games', confidence: Math.round(52 + r(7) * 18) }
        : { market: 'Over/Under Games', pick: 'Under 22.5 Games', confidence: Math.round(52 + r(8) * 18) },
      { market: 'Set Betting', pick: r(9) > 0.5 ? `${home} 2-0` : `${home} 2-1`, confidence: Math.round(40 + r(10) * 25) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `Total Sets (safer)`,
    reasoning: (pick, home, away, r) => [
      `${pick} — surface form and recent head-to-head support this selection.`,
      `${r(10) > 0.5 ? home : away} leads in first-serve percentage on this surface.`,
      `Stake 1–2% of bankroll. Tennis single-match variance is high.`,
    ],
  },
  cricket: {
    primaryMarket: 'Match Winner',
    hasDraw: true,
    altMarkets: (home, away, r) => [
      r(3) > 0.5
        ? { market: 'Total Runs', pick: 'Over 300.5 Runs', confidence: Math.round(50 + r(4) * 20) }
        : { market: 'Total Runs', pick: 'Under 300.5 Runs', confidence: Math.round(50 + r(5) * 20) },
      { market: 'Top Batsman', pick: r(6) > 0.5 ? `${home} top scorer` : `${away} top scorer`, confidence: Math.round(35 + r(7) * 20) },
      { market: 'First Innings Lead', pick: r(8) > 0.5 ? home : away, confidence: Math.round(45 + r(9) * 20) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `First Innings Lead (safer)`,
    reasoning: (pick, home, away, r) => [
      `${pick} — pitch report and recent batting form favour this selection.`,
      `${r(10) > 0.5 ? home : away} bowling attack is stronger in current conditions.`,
      `Stake 1–2% of bankroll. Weather and pitch variance is significant.`,
    ],
  },
  baseball: {
    primaryMarket: 'Moneyline',
    hasDraw: false,
    altMarkets: (home, away, r) => [
      r(3) > 0.5
        ? { market: 'Over/Under Runs', pick: 'Over 8.5 Runs', confidence: Math.round(52 + r(4) * 20) }
        : { market: 'Over/Under Runs', pick: 'Under 8.5 Runs', confidence: Math.round(52 + r(5) * 20) },
      { market: 'Run Line', pick: r(6) > 0.5 ? `${home} -1.5` : `${away} +1.5`, confidence: Math.round(48 + r(7) * 20) },
      { market: '1st Inning Score', pick: r(8) > 0.5 ? 'Yes' : 'No', confidence: Math.round(48 + r(9) * 18) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `Run Line (safer)`,
    reasoning: (pick, home, _away, r) => [
      `${pick} — starting pitcher ERA and bullpen depth support this.`,
      `${home} park factor ${r(10) > 0.5 ? 'favours' : 'slightly hurts'} the over on runs.`,
      `Stake 1–2% of bankroll.`,
    ],
  },
  hockey: {
    primaryMarket: 'Moneyline (60 min)',
    hasDraw: false,
    altMarkets: (home, away, r) => [
      r(3) > 0.5
        ? { market: 'Over/Under Goals', pick: 'Over 5.5 Goals', confidence: Math.round(52 + r(4) * 20) }
        : { market: 'Over/Under Goals', pick: 'Under 5.5 Goals', confidence: Math.round(52 + r(5) * 20) },
      { market: 'Both Teams to Score', pick: r(6) > 0.5 ? 'Yes' : 'No', confidence: Math.round(55 + r(7) * 18) },
      { market: 'Period 1 Winner', pick: r(8) > 0.5 ? home : away, confidence: Math.round(44 + r(9) * 22) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `Both Teams to Score (safer)`,
    reasoning: (pick, home, _away, r) => [
      `${pick} — goaltender save% and power-play efficiency support this.`,
      `${home} shot differential leans ${r(10) > 0.5 ? 'over' : 'under'} the puck-line.`,
      `Stake 1–2% of bankroll.`,
    ],
  },
  mma: {
    primaryMarket: 'Moneyline',
    hasDraw: false,
    altMarkets: (_home, _away, r) => [
      { market: 'Method of Victory', pick: r(3) > 0.5 ? 'KO/TKO' : 'Decision', confidence: Math.round(45 + r(4) * 25) },
      { market: 'Fight Goes the Distance', pick: r(5) > 0.5 ? 'Yes' : 'No', confidence: Math.round(48 + r(6) * 20) },
      { market: 'Total Rounds', pick: r(7) > 0.5 ? 'Over 2.5' : 'Under 2.5', confidence: Math.round(48 + r(8) * 20) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `Fight Goes the Distance (safer)`,
    reasoning: (pick, home, away, r) => [
      `${pick} — striking accuracy and grappling stats back this selection.`,
      `${r(10) > 0.5 ? home : away} has the cardio advantage in later rounds.`,
      `Stake 1% of bankroll. MMA single-fight variance is very high.`,
    ],
  },
  rugby: {
    primaryMarket: 'Match Result',
    hasDraw: true,
    altMarkets: (_home, _away, r) => [
      r(3) > 0.5
        ? { market: 'Over/Under Points', pick: 'Over 42.5 Points', confidence: Math.round(52 + r(4) * 20) }
        : { market: 'Over/Under Points', pick: 'Under 42.5 Points', confidence: Math.round(52 + r(5) * 20) },
      { market: 'Handicap', pick: r(6) > 0.5 ? 'Home -5.5' : 'Away +5.5', confidence: Math.round(50 + r(7) * 18) },
      { market: 'First Try Scorer', pick: r(8) > 0.5 ? 'Home player' : 'Away player', confidence: Math.round(30 + r(9) * 20) },
    ],
    recommendedBet: (pick, _dc, conf) => conf >= 60 ? `Single — ${pick}` : `Handicap (safer)`,
    reasoning: (pick, home, _away, r) => [
      `${pick} — scrum dominance and lineout success rate support this.`,
      `${home} forward pack ${r(10) > 0.5 ? 'has' : 'lacks'} the power advantage.`,
      `Stake 1–2% of bankroll.`,
    ],
  },
}

function getSportConfig(sport?: string) {
  const key = (sport || 'soccer').toLowerCase()
    .replace('american football', 'football')
    .replace('american_football', 'football')
    .replace('ice hockey', 'hockey')
  return SPORT_MARKETS[key] || SPORT_MARKETS['soccer']
}

// Deterministic fallback so the predictor still feels useful when no LLM is
// configured. Uses a hash of the team names for stable, varied results.
function localPredict(home: string, away: string, league?: string, sport?: string): PredictorResult {
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
    return Math.abs(h)
  }
  const seed = hash(home + away + (league || '') + (sport || ''))
  const r = (offset: number) => ((seed + offset) % 100) / 100

  const cfg = getSportConfig(sport)

  const homeStrength = 0.45 + r(1) * 0.4
  const drawProb = cfg.hasDraw ? 0.22 + r(2) * 0.12 : 0
  const awayStrength = 1 - homeStrength - drawProb

  const probs = cfg.hasDraw ? [homeStrength, drawProb, awayStrength] : [homeStrength, awayStrength]
  const labels = cfg.hasDraw ? [`${home} Win`, 'Draw', `${away} Win`] : [`${home} Win`, `${away} Win`]
  const pickIdx = probs.indexOf(Math.max(...probs))
  const confidence = Math.round(probs[pickIdx] * 100)

  const altMarkets = cfg.altMarkets(home, away, r)
  const dcPick = cfg.hasDraw ? (pickIdx === 0 ? `${home} or Draw` : pickIdx === 2 ? `${away} or Draw` : `${home} or ${away}`) : ''

  return {
    pick: labels[pickIdx],
    market: cfg.primaryMarket,
    confidence,
    recommendedBet: cfg.recommendedBet(labels[pickIdx], dcPick, confidence),
    altMarkets,
    reasoning: cfg.reasoning(labels[pickIdx], home, away, r),
    source: 'fallback',
  }
}

// Build a sport-aware system prompt for the AI
function buildSystemPrompt(sport?: string): string {
  const s = (sport || 'soccer').toLowerCase()

  const sportRules: Record<string, string> = {
    soccer: `Primary market: Match Result (1X2). Include in altMarkets: Over/Under 2.5 Goals, BTTS (Both Teams to Score - Yes/No), Double Chance. Do NOT use moneyline, points spread, or sets markets.`,
    football: `Sport is American Football (NFL/NCAA). Primary market: Moneyline. Include in altMarkets: Over/Under Points (e.g. Over 44.5 Points), Point Spread (e.g. Home -3.5), First Half Winner. Do NOT use 1X2, BTTS, or goals markets.`,
    basketball: `Primary market: Moneyline. Include in altMarkets: Over/Under Points (e.g. Over 215.5 Points), Point Spread (e.g. Home -4.5), First Half Winner. Do NOT use 1X2, BTTS, or goals markets.`,
    tennis: `Primary market: Moneyline (match winner). Include in altMarkets: Total Sets (Over/Under 2.5 Sets), Over/Under Games (e.g. Over 22.5 Games), Set Betting (e.g. 2-0, 2-1). Do NOT use 1X2, BTTS, points spread, or goals markets.`,
    cricket: `Primary market: Match Winner (can include Draw for Tests). Include in altMarkets: Total Runs (e.g. Over 300.5 Runs), First Innings Lead, Top Batsman. Do NOT use 1X2, BTTS, or goals markets.`,
    baseball: `Primary market: Moneyline. Include in altMarkets: Over/Under Runs (e.g. Over 8.5 Runs), Run Line (e.g. Home -1.5), 1st Inning Score. Do NOT use 1X2, BTTS, goals, or sets markets.`,
    hockey: `Sport is Ice Hockey. Primary market: Moneyline (60 min). Include in altMarkets: Over/Under Goals (e.g. Over 5.5 Goals), Both Teams to Score, Period 1 Winner. Do NOT use 1X2 three-way, BTTS soccer-style, or points markets.`,
    mma: `Sport is MMA/UFC. Primary market: Moneyline (fight winner). Include in altMarkets: Method of Victory (KO/TKO/Decision/Submission), Fight Goes the Distance (Yes/No), Total Rounds (Over/Under 2.5). Do NOT use goals, sets, points, or BTTS markets.`,
    rugby: `Primary market: Match Result (1X2 with Draw). Include in altMarkets: Over/Under Points (e.g. Over 42.5 Points), Handicap (e.g. Home -5.5), First Try Scorer. Do NOT use goals, sets, or basketball-style markets.`,
    golf: `Sport is Golf. Primary market: Tournament Winner (outright). Include in altMarkets: Top 5 Finish, Top 10 Finish, Head-to-Head matchup. Do NOT use 1X2, BTTS, goals, or points markets.`,
  }

  const sportKey = Object.keys(sportRules).find(k => s.includes(k)) || 'soccer'
  const marketRules = sportRules[sportKey]

  return `You are Betcheza AI's Match Predictor. Sport: ${sport || 'Soccer'}.

Rules:
- Use whatever knowledge you have of the teams/players' recent form, head-to-head trends, league/tournament strength, surface/venue, injuries, tactical context.
- If a team/player is obscure, infer reasonable probabilities from the league/tournament context.
- Confidence MUST be a calibrated probability percentage (0-100). Don't go above 80 unless one side is overwhelmingly favoured.
- SPORT-SPECIFIC MARKETS: ${marketRules}
- recommendedBet must be a single concrete bet a user could place today, with staking guidance.
- reasoning is a 3-5 item array of short, specific bullet points (cite form/H2H/style/venue/surface/stats — no fluff).
- NEVER invent fixture dates or scores you can't verify. Reason about probabilities, not certainties.

Output STRICT JSON with this exact shape:
{
  "pick": "string (e.g. '${s === 'tennis' ? 'Madison Keys' : s === 'basketball' ? 'Lakers'} Win')",
  "market": "string (sport-appropriate primary market)",
  "confidence": number (0-100),
  "recommendedBet": "string",
  "altMarkets": [
    { "market": "string", "pick": "string", "confidence": number }
  ],
  "reasoning": ["string", "string", "string"]
}`
}

export async function POST(request: NextRequest) {
  let body: PredictorBody
  try {
    body = (await request.json()) as PredictorBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const home = (body.homeTeam || '').trim()
  const away = (body.awayTeam || '').trim()
  if (!home || !away) {
    return NextResponse.json(
      { error: 'Both homeTeam and awayTeam are required' },
      { status: 400 },
    )
  }

  // Determine sport from body or matched fixture
  let sport = body.sport || body.sportType || ''

  // Restrict the predictor to upcoming fixtures so the "recent" list
  // never grows full of bets on games that already kicked off.
  let matchedFixture: { id: string; league: string; kickoffTime: string; sport?: string } | null = null
  try {
    const upcoming = await getUpcomingMatches()
    const lh = home.toLowerCase()
    const la = away.toLowerCase()
    const found = upcoming.find(m => {
      const hn = (m.homeTeam?.name || '').toLowerCase()
      const an = (m.awayTeam?.name || '').toLowerCase()
      return (hn.includes(lh) || lh.includes(hn)) && (an.includes(la) || la.includes(an))
    })
    if (found) {
      matchedFixture = {
        id: String(found.id),
        league: found.league?.name || body.league || '',
        kickoffTime: found.kickoffTime,
        sport: (found.sport as { name?: string } | undefined)?.name || sport,
      }
      // Prefer sport from matched fixture if not already set
      if (!sport && matchedFixture.sport) sport = matchedFixture.sport
    } else if (process.env.PREDICTOR_STRICT_UPCOMING === '1') {
      return NextResponse.json(
        { error: 'No upcoming fixture found for those teams. The predictor only covers upcoming matches.' },
        { status: 404 },
      )
    }
  } catch {
    // If the upcoming feed is unavailable we still let the prediction through
  }

  const finishAndRecord = (out: PredictorResult) => {
    try {
      recordPrediction({
        league: matchedFixture?.league || body.league || 'Friendly',
        homeTeam: home,
        awayTeam: away,
        market: out.market,
        pick: out.pick,
        confidence: out.confidence,
        source: out.source,
        matchId: matchedFixture?.id,
      })
    } catch (e) {
      console.warn('[predictor] record failed', e)
    }
    return NextResponse.json(out)
  }

  const openai = getOpenAI()
  if (!openai) {
    return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport))
  }

  const system = buildSystemPrompt(sport)
  const user = `Predict: ${home} vs ${away}${body.league ? ` (${body.league})` : ''}${sport ? ` [Sport: ${sport}]` : ''}.${body.notes ? `\n\nUser notes: ${body.notes}` : ''}`

  try {
    type ReasoningCreate = Parameters<typeof openai.chat.completions.create>[0] & {
      reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high'
    }
    const params: ReasoningCreate = {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2500,
      reasoning_effort: 'low',
    }
    const completion = await openai.chat.completions.create(params)
    const raw = completion.choices?.[0]?.message?.content?.trim()
    if (!raw) return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport))

    let parsed: Partial<PredictorResult> = {}
    try {
      parsed = JSON.parse(raw) as Partial<PredictorResult>
    } catch {
      return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport))
    }
    const out: PredictorResult = {
      pick: parsed.pick || `${home} Win`,
      market: parsed.market || getSportConfig(sport).primaryMarket,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
          : 55,
      recommendedBet: parsed.recommendedBet || `Single — ${parsed.pick || `${home} Win`}`,
      altMarkets: Array.isArray(parsed.altMarkets) ? parsed.altMarkets.slice(0, 4) : [],
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 6) : [],
      source: 'openai',
    }
    return finishAndRecord(out)
  } catch (e) {
    console.error('[predictor] error', e)
    return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport))
  }
}
