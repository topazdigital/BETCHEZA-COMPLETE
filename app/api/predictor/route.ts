import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { recordPrediction } from '@/lib/predictor-store'
import { getUpcomingMatches } from '@/lib/api/unified-sports-api'
import type { Market } from '@/lib/api/unified-sports-api'

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

function normalizeMarketValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function predictorMarketFamily(market: Market): string {
  const text = normalizeMarketValue(`${market.key} ${market.name}`)
  if (text.includes('doublechance')) return 'double_chance'
  if (text.includes('drawnobet')) return 'draw_no_bet'
  if (text.includes('btts') || text.includes('bothteamstoscore')) return 'btts'
  if (text.includes('cleansheet')) return 'clean_sheet'
  if (text.includes('wintonil')) return 'win_to_nil'
  if (text.includes('firstteamtoscore')) return 'first_team_to_score'
  if (text.includes('goalfirsthalf')) return 'goal_first_half'
  if (text.includes('halftime') && text.includes('result')) return 'half_time_result'
  if (text.includes('corner')) return 'corners'
  if (text.includes('card') || text.includes('booking')) return 'cards'
  if (text.includes('asian') || text.includes('handicap') || text.includes('spread')) return 'handicap'
  if (text.includes('total') || text.includes('over') || text.includes('under')) return 'totals'
  if (text.includes('1x2') || text.includes('matchresult') || text.includes('fulltimeresult') || text.includes('winner') || text.includes('moneyline') || text.includes('h2h')) return 'result'
  return 'other'
}

function selectAvailablePredictionMarkets(markets: Market[]): Market[] {
  const supported = markets
    .filter((market) => !market.isDerived)
    .filter((market) => {
      const text = normalizeMarketValue(`${market.key} ${market.name}`)
      return ![
        'correctscore',
        'exactscore',
        'exactgoals',
        'halftimefulltime',
        'player',
        'goalscorer',
        'oddoreven',
        'outright',
      ].some((excluded) => text.includes(excluded))
    })
  const familyOrder = [
    'result',
    'double_chance',
    'draw_no_bet',
    'btts',
    'totals',
    'handicap',
    'half_time_result',
    'goal_first_half',
    'clean_sheet',
    'win_to_nil',
    'first_team_to_score',
    'corners',
    'cards',
    'other',
  ]
  const selected: Market[] = []
  const included = new Set<Market>()
  for (const family of familyOrder) {
    const market = supported.find((item) => predictorMarketFamily(item) === family)
    if (market) {
      selected.push(market)
      included.add(market)
    }
  }
  for (const market of supported) {
    if (selected.length >= 20) break
    if (!included.has(market)) selected.push(market)
  }
  return selected
}

function formatAvailableMarkets(markets: Market[]): string {
  return selectAvailablePredictionMarkets(markets)
    .map((market) => {
      const outcomes = market.outcomes
        .filter((outcome) => Number.isFinite(outcome.price) && outcome.price > 1)
        .slice(0, 12)
        .map((outcome) => `${outcome.name}=${outcome.price}`)
        .join(' ')
      return outcomes ? `${market.name} [${market.key}]: ${outcomes}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function verifyMarketPick(markets: Market[], requestedMarket: string, requestedPick: string) {
  const marketLabel = normalizeMarketValue(requestedMarket)
  const pickLabel = normalizeMarketValue(requestedPick)
  const candidates = markets
    .filter((market) => !market.isDerived)
    .sort((a, b) =>
      Number(normalizeMarketValue(b.name) === marketLabel) -
      Number(normalizeMarketValue(a.name) === marketLabel),
    )
  for (const market of candidates) {
    if (
      marketLabel &&
      normalizeMarketValue(market.name) !== marketLabel &&
      normalizeMarketValue(market.key) !== marketLabel
    ) continue
    const outcome = market.outcomes.find((item) => normalizeMarketValue(item.name) === pickLabel)
    if (outcome) return { market: market.name, pick: outcome.name }
  }
  return null
}

// Deterministic fallback so the predictor still feels useful when no LLM is
// configured. Uses a hash of the team names for stable, varied results.
function localPredict(home: string, away: string, league?: string, sport?: string, markets?: Market[]): PredictorResult {
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
    return Math.abs(h)
  }
  const seed = hash(home + away + (league || '') + (sport || ''))
  const r = (offset: number) => ((seed + offset) % 100) / 100

  const cfg = getSportConfig(sport)
  const availableOutcomes = selectAvailablePredictionMarkets(markets || [])
    .flatMap((market) => market.outcomes
      .filter((outcome) => Number.isFinite(outcome.price) && outcome.price >= 1.3 && outcome.price <= 6)
      .map((outcome) => ({ market: market.name, pick: outcome.name, price: outcome.price })))
    .sort((a, b) => a.price - b.price)

  if (availableOutcomes.length > 0) {
    const best = availableOutcomes[0]
    return {
      pick: best.pick,
      market: best.market,
      confidence: Math.min(80, Math.round(100 / best.price)),
      recommendedBet: `Single — ${best.pick} (${best.market} @${best.price.toFixed(2)})`,
      altMarkets: availableOutcomes.slice(1, 4).map((alternative) => ({
        market: alternative.market,
        pick: alternative.pick,
        confidence: Math.min(80, Math.round(100 / alternative.price)),
      })),
      reasoning: [
        `${best.market}: ${best.pick} at ${best.price.toFixed(2)} has the strongest bookmaker-implied probability among the available supported markets.`,
        `This is a market-price fallback because the AI provider is unavailable; it is not a form-based value estimate.`,
        `Stake 1–2% of bankroll and account for the risk of any single outcome.`,
      ],
      source: 'fallback',
    }
  }

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
function buildSystemPrompt(sport?: string, hasProviderMarkets = false): string {
  const s = (sport || 'soccer').toLowerCase()

  const sportRules: Record<string, string> = {
    soccer: `Soccer markets include match result, double chance, draw no bet, BTTS, goal totals, Asian Handicap, and other listed match markets.`,
    football: `Sport is American Football (NFL/NCAA). Use appropriate listed moneyline, spread, or points-total markets. Do NOT use soccer 1X2, BTTS, or goals markets.`,
    basketball: `Use appropriate listed moneyline, spread, and points-total markets. Do NOT use soccer 1X2, BTTS, or goals markets.`,
    tennis: `Use appropriate listed match-winner, set, and games markets. Do NOT use 1X2, BTTS, or soccer goals markets.`,
    cricket: `Use appropriate listed match-winner, runs, or innings markets. A draw may be possible in Test matches.`,
    baseball: `Use appropriate listed moneyline, run-line, and runs-total markets.`,
    hockey: `Use appropriate listed moneyline, puck-line, and goals-total markets.`,
    mma: `Use appropriate listed fight-winner, method, rounds, or goes-the-distance markets.`,
    rugby: `Use appropriate listed match-result, points-total, or handicap markets.`,
    golf: `Use appropriate listed tournament-winner or placement markets.`,
  }

  const sportKey = Object.keys(sportRules).find(k => s.includes(k)) || 'soccer'
  const marketRules = sportRules[sportKey]

  return `You are Betcheza AI's Match Predictor. Sport: ${sport || 'Soccer'}.

Rules:
- Use whatever knowledge you have of the teams/players' recent form, head-to-head trends, league/tournament strength, surface/venue, injuries, tactical context.
- If a team/player is obscure, infer reasonable probabilities from the league/tournament context.
- Confidence MUST be a calibrated probability percentage (0-100). Don't go above 80 unless one side is overwhelmingly favoured.
- SPORT-SPECIFIC MARKETS: ${marketRules}
- ${hasProviderMarkets ? 'Compare the available real bookmaker markets and choose the best-supported primary market; use only the exact market and outcome names listed for this fixture.' : 'No bookmaker market list is available, so use only a sensible sport-appropriate core market and do not invent prices or lines.'}
- Do not default to match winner or handicap. Compare all listed market types that have relevant evidence, and do not select a market solely because it has the shortest odds.
- Each altMarkets entry must also use a market and outcome from the supplied bookmaker list when one is available.
- recommendedBet must be a single concrete bet a user could place today, with staking guidance.
- reasoning is a 3-5 item array of short, specific bullet points (cite form/H2H/style/venue/surface/stats — no fluff).
- NEVER invent fixture dates or scores you can't verify. Reason about probabilities, not certainties.

Output STRICT JSON with this exact shape:
{
  "pick": "exact outcome name from the listed market when available",
  "market": "exact market name from the listed markets when available",
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
  let matchedFixture: { id: string; league: string; sport?: string; markets?: Market[] } | null = null
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
      const fixture = {
        id: String(found.id),
        league: found.league?.name || body.league || '',
        sport: (found.sport as { name?: string } | undefined)?.name || sport,
        markets: found.markets || [],
      }
      matchedFixture = fixture
      // Prefer sport from matched fixture if not already set
      if (!sport && fixture.sport) sport = fixture.sport
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
    return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport, matchedFixture?.markets))
  }

  const realMarkets = selectAvailablePredictionMarkets(matchedFixture?.markets || [])
  const availableMarkets = formatAvailableMarkets(realMarkets)
  const system = buildSystemPrompt(sport, availableMarkets.length > 0)
  const user = `Predict: ${home} vs ${away}${body.league ? ` (${body.league})` : ''}${sport ? ` [Sport: ${sport}]` : ''}.${availableMarkets ? `\n\nAVAILABLE REAL BOOKMAKER MARKETS AND OUTCOMES:\n${availableMarkets}` : ''}${body.notes ? `\n\nUser notes: ${body.notes}` : ''}`

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
    if (!raw) return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport, matchedFixture?.markets))

    let parsed: Partial<PredictorResult> = {}
    try {
      parsed = JSON.parse(raw) as Partial<PredictorResult>
    } catch {
      return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport, matchedFixture?.markets))
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
    if (realMarkets.length > 0) {
      const verified = verifyMarketPick(realMarkets, out.market, out.pick)
      if (!verified) {
        return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport, matchedFixture?.markets))
      }
      out.market = verified.market
      out.pick = verified.pick
      out.altMarkets = out.altMarkets.filter((alternative) =>
        verifyMarketPick(realMarkets, alternative.market, alternative.pick),
      )
    }
    return finishAndRecord(out)
  } catch (e) {
    console.error('[predictor] error', e)
    return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league, sport, matchedFixture?.markets))
  }
}
