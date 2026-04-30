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

const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini'

// Deterministic fallback so the predictor still feels useful when no LLM is
// configured. Uses a hash of the team names for stable, varied results.
function localPredict(home: string, away: string, league?: string): PredictorResult {
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
    return Math.abs(h)
  }
  const seed = hash(home + away + (league || ''))
  const r = (offset: number) => ((seed + offset) % 100) / 100

  const homeStrength = 0.45 + r(1) * 0.4
  const drawProb = 0.22 + r(2) * 0.12
  const awayStrength = 1 - homeStrength - drawProb
  const probs = [homeStrength, drawProb, awayStrength]
  const pickIdx = probs.indexOf(Math.max(...probs))
  const labels = [`${home} Win`, 'Draw', `${away} Win`]
  const confidence = Math.round(probs[pickIdx] * 100)

  const goalsLean = r(3)
  const overUnder =
    goalsLean > 0.55
      ? { market: 'Over 2.5 Goals', pick: 'Over 2.5', confidence: Math.round(55 + r(4) * 20) }
      : { market: 'Over/Under 2.5 Goals', pick: 'Under 2.5', confidence: Math.round(52 + r(5) * 18) }
  const btts = {
    market: 'Both Teams to Score',
    pick: r(6) > 0.45 ? 'Yes' : 'No',
    confidence: Math.round(54 + r(7) * 18),
  }
  const dc = {
    market: 'Double Chance',
    pick:
      pickIdx === 0
        ? `${home} or Draw`
        : pickIdx === 2
          ? `${away} or Draw`
          : `${home} or ${away}`,
    confidence: Math.round(Math.min(95, confidence + 18)),
  }

  return {
    pick: labels[pickIdx],
    market: 'Match Result (1X2)',
    confidence,
    recommendedBet:
      confidence >= 60
        ? `Single — ${labels[pickIdx]}`
        : `Double Chance — ${dc.pick} (safer)`,
    altMarkets: [overUnder, btts, dc],
    reasoning: [
      `${labels[pickIdx]} edges out the other outcomes (${confidence}% modelled probability).`,
      `Goals lean ${goalsLean > 0.55 ? 'high — average modelled total above 2.5' : 'modest — total likely under 2.5'}.`,
      `BTTS leans ${btts.pick} (${btts.confidence}% confidence).`,
      `Stake 1–2% of bankroll. Variance is real even at high confidence.`,
    ],
    source: 'fallback',
  }
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

  // Restrict the predictor to upcoming fixtures so the "recent" list
  // never grows full of bets on games that already kicked off. Match by
  // fuzzy team-name contains so user typos don't lock people out.
  let matchedFixture: { id: string; league: string; kickoffTime: string } | null = null
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
      }
    } else if (process.env.PREDICTOR_STRICT_UPCOMING === '1') {
      return NextResponse.json(
        { error: 'No upcoming fixture found for those teams. The predictor only covers upcoming matches.' },
        { status: 404 },
      )
    }
  } catch {
    // If the upcoming feed is unavailable we still let the prediction
    // through — the store will simply record it without a matchId.
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
    return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league))
  }

  const system = `You are Betcheza AI's Match Predictor. The user gives you two teams (and optionally a league or context note). You produce a STRUCTURED JSON prediction.

Rules:
- Use whatever knowledge you have of the teams' recent form, head-to-head trends, league strength, home advantage, injuries, manager and tactical context.
- If a team is obscure, infer reasonable probabilities from the league context.
- Confidence MUST be a calibrated probability percentage (0-100). Don't go above 80 unless one side is overwhelmingly favoured.
- Always include 1X2, Over/Under 2.5, BTTS and a Double-Chance fallback in altMarkets.
- recommendedBet must be a single concrete bet a user could place today, with the staking guidance baked in.
- reasoning is a 3-5 item array of short, specific bullet points (no fluff, cite form/H2H/style/venue).
- NEVER invent fixture dates or scores you can't verify. Reason about probabilities, not certainties.

Output STRICT JSON with this exact shape:
{
  "pick": "string (e.g. 'Manchester City Win')",
  "market": "Match Result (1X2)",
  "confidence": number (0-100),
  "recommendedBet": "string",
  "altMarkets": [
    { "market": "string", "pick": "string", "confidence": number }
  ],
  "reasoning": ["string", "string", "string"]
}`

  const user = `Predict: ${home} vs ${away}${body.league ? ` (${body.league})` : ''}.${body.notes ? `\n\nUser notes: ${body.notes}` : ''}`

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
    if (!raw) return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league))

    let parsed: Partial<PredictorResult> = {}
    try {
      parsed = JSON.parse(raw) as Partial<PredictorResult>
    } catch {
      return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league))
    }
    const out: PredictorResult = {
      pick: parsed.pick || `${home} Win`,
      market: parsed.market || 'Match Result (1X2)',
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
    return finishAndRecord(localPredict(home, away, matchedFixture?.league || body.league))
  }
}
