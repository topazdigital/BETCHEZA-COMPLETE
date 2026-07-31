/**
 * SofaScore Odds — free, no API key required.
 * Works for ALL sports SofaScore covers: tennis, cricket, basketball, etc.
 *
 * Uses the SofaScore internal event odds endpoint.
 * Routed through the CF Worker proxy (same as all other SofaScore calls)
 * to bypass cloud-IP blocks on api.sofascore.com.
 *
 * Returns an empty array silently on any error so it degrades gracefully.
 */

import { proxyFetch } from './proxy-fetch';

export interface SofaScoreOddsLine {
  bookmaker: string;
  display: string;
  home: number;
  draw?: number;
  away: number;
}

const SS_BASE = 'https://api.sofascore.com/api/v1';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
};

interface SSChoice {
  name: string;
  sourceOdds?: number;
  odds?: string | number;
  fractionalValue?: string;
  winning?: boolean | null;
  initialOdds?: number;
  initialFractionalValue?: string;
}

interface SSMarket {
  marketName: string;
  isLive?: boolean;
  choices?: SSChoice[];
}

interface SSOddsResponse {
  markets?: SSMarket[];
  error?: unknown;
}

/** Extract a decimal odd from a SofaScore choice object. */
function extractOdds(choice: SSChoice): number {
  if (typeof choice.sourceOdds === 'number' && choice.sourceOdds > 1) {
    return choice.sourceOdds;
  }
  const raw = choice.odds;
  if (typeof raw === 'number' && raw > 1) return raw;
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 1) return parsed;
  }
  return 0;
}

/**
 * Fetch bookmaker h2h odds from SofaScore for a given event ID.
 * @param eventId  The numeric SofaScore event ID (from match id like "ss_12345" → 12345)
 * @param hasDraw  Whether the sport supports a draw outcome (false for tennis, cricket, etc.)
 */
export async function getSofaScoreOdds(
  eventId: number,
  hasDraw: boolean,
): Promise<SofaScoreOddsLine[]> {
  // Try a few well-known bookmaker IDs on SofaScore.
  // Bookmaker 1 is typically bet365; 2 is Unibet; 16 is Pinnacle; 22 is 1xBet.
  // We try them in order and return the first one that has valid h2h odds.
  const BOOKMAKER_IDS = [
    { id: 1,  display: 'bet365',  key: 'bet365' },
    { id: 16, display: 'Pinnacle', key: 'pinnacle' },
    { id: 2,  display: 'Unibet',  key: 'unibet' },
    { id: 22, display: '1xBet',   key: '1xbet' },
    { id: 8,  display: 'Betfair', key: 'betfair' },
  ];

  for (const bk of BOOKMAKER_IDS) {
    try {
      const url = `${SS_BASE}/event/${eventId}/odds/${bk.id}/all`;
      const res = await proxyFetch(url, {
        headers: HEADERS,
        timeoutMs: 6_000,
      });

      if (!res.ok) continue;

      const data = await res.json() as SSOddsResponse;
      if (!data?.markets?.length) continue;

      // Find the full-time / match winner market.
      // SofaScore names it differently by sport: "Full time", "Match Winner", "Winner", etc.
      const market = data.markets.find(m => {
        const n = (m.marketName || '').toLowerCase();
        return (
          n === 'full time' ||
          n === 'match winner' ||
          n === 'winner' ||
          n === '1x2' ||
          n === 'moneyline' ||
          n === 'match result'
        );
      }) ?? data.markets[0];

      if (!market?.choices?.length) continue;

      const choices = market.choices;

      // Map by outcome name. SofaScore uses "1", "X", "2" for football and
      // "1" / "2" for no-draw sports (tennis, cricket, basketball…).
      const find = (names: string[]) =>
        choices.find(c => names.includes((c.name || '').trim()));

      const homeChoice = find(['1', 'Home', 'Player 1', 'Team 1']);
      const drawChoice = find(['X', 'Draw']);
      const awayChoice = find(['2', 'Away', 'Player 2', 'Team 2']);

      if (!homeChoice || !awayChoice) continue;

      const homeOdd = extractOdds(homeChoice);
      const awayOdd = extractOdds(awayChoice);
      if (homeOdd <= 1 || awayOdd <= 1) continue;

      const line: SofaScoreOddsLine = {
        bookmaker: bk.key,
        display: bk.display,
        home: homeOdd,
        away: awayOdd,
      };

      if (hasDraw && drawChoice) {
        const drawOdd = extractOdds(drawChoice);
        if (drawOdd > 1) line.draw = drawOdd;
      }

      return [line];
    } catch {
      // Silent — try next bookmaker
    }
  }

  return [];
}

/**
 * Extract the numeric SofaScore event ID from a Betcheza match ID.
 * SofaScore matches have IDs in the format: "ss_12345678"
 * Returns null for non-SofaScore matches.
 */
export function extractSofaScoreEventId(matchId: string): number | null {
  const m = matchId.match(/^ss_(\d+)$/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}
