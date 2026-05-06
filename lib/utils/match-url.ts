/**
 * Clean match URL utilities
 * Converts internal match IDs (espn_ita.1_737421) to readable URL slugs.
 * New format: team-a-vs-team-b-737421
 * Legacy format (still supported for reading): ita1-737421
 */

function espnLeagueToSlug(leagueKey: string): string {
  return leagueKey.replace(/\./g, '').toLowerCase()
}

function teamNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
}

/**
 * Convert internal match ID to a clean URL slug (legacy format).
 * espn_ita.1_737421 → ita1-737421
 * Use matchToSlug when you have team names available.
 */
export function matchIdToSlug(matchId: string): string {
  const m = matchId.match(/^espn_([a-z0-9.]+)_(\d+)$/i)
  if (!m) {
    return encodeURIComponent(matchId)
  }
  const leagueSlug = espnLeagueToSlug(m[1])
  return `${leagueSlug}-${m[2]}`
}

/**
 * Convert match to a human-readable URL slug using team names.
 * espn_eng.1_740942, "Leeds United", "Burnley" → leeds-united-vs-burnley-740942
 */
export function matchToSlug(matchId: string, homeTeam: string, awayTeam: string): string {
  const m = matchId.match(/^espn_([a-z0-9.]+)_(\d+)$/i)
  if (!m) return encodeURIComponent(matchId)
  const numericId = m[2]
  const homeSlug = teamNameToSlug(homeTeam)
  const awaySlug = teamNameToSlug(awayTeam)
  return `${homeSlug}-vs-${awaySlug}-${numericId}`
}

// Maps slugified league key → original league key with dots
const LEAGUE_KEY_MAP: Record<string, string> = {
  eng1: 'eng.1',
  esp1: 'esp.1',
  ger1: 'ger.1',
  ita1: 'ita.1',
  fra1: 'fra.1',
  ned1: 'ned.1',
  por1: 'por.1',
  sco1: 'sco.1',
  bel1: 'bel.1',
  tur1: 'tur.1',
  ken1: 'ken.1',
  uefachampions: 'uefa.champions',
  uefaeuropa: 'uefa.europa',
  uefaeuropaconf: 'uefa.europa.conf',
  usa1: 'usa.1',
  bra1: 'bra.1',
  arg1: 'arg.1',
  mex1: 'mex.1',
  conmebollibertadores: 'conmebol.libertadores',
  aus1: 'aus.1',
  jpn1: 'jpn.1',
  chn1: 'chn.1',
  sau1: 'sau.1',
  kor1: 'kor.1',
  idn1: 'idn.1',
  tha1: 'tha.1',
  mys1: 'mys.1',
  are1: 'are.1',
  qat1: 'qat.1',
  irn1: 'irn.1',
  isr1: 'isr.1',
  nba: 'nba',
  wnba: 'wnba',
  ncaaw: 'womens-college-basketball',
  ncaam: 'mens-college-basketball',
  euroleague: 'euroleague',
  nfl: 'nfl',
  mlb: 'mlb',
  nhl: 'nhl',
  ufc: 'ufc',
  atp: 'atp',
  wta: 'wta',
  rufc: 'rugbyunion',
  rl: 'rugbyleague',
}

/**
 * Convert a clean URL slug back to the internal match ID.
 * Handles three formats:
 *   1. Full ESPN ID:  espn_ita.1_737421  → pass through (normalised to no-dot form)
 *   2. Legacy format: ita1-737421        → espn_ita1_737421
 *   3. New format:    team-a-vs-team-b-737421 → espn_eventid_737421 (resolved later)
 *
 * IMPORTANT: cached match IDs are generated with
 *   `espn_${league.replace(/[^a-z0-9]/gi, '')}_${eventId}`
 * so dots and hyphens in league keys are always stripped. slugToMatchId MUST
 * produce the same no-dot form so the fast-path cache scan hits correctly.
 */
export function slugToMatchId(slug: string): string {
  const decoded = decodeURIComponent(slug)

  // Already a full ESPN ID — normalise to the no-dot cache format
  if (decoded.startsWith('espn_')) {
    // Strip dots/hyphens from the league segment only
    return decoded.replace(/^(espn_)([^_]+)(_\d+)$/, (_m, prefix, league, suffix) =>
      `${prefix}${league.replace(/[^a-z0-9]/gi, '')}${suffix}`
    )
  }

  // Legacy format: single-segment leagueSlug + numericId
  const legacyMatch = decoded.match(/^([a-z0-9]+)-(\d+)$/i)
  if (legacyMatch) {
    const leagueSlugFromUrl = legacyMatch[1].toLowerCase()
    const eventId = legacyMatch[2]
    // LEAGUE_KEY_MAP may return a value with dots (e.g. 'eng.1') or hyphens
    // ('womens-college-basketball') — strip them to match the cache format.
    const mappedKey = LEAGUE_KEY_MAP[leagueSlugFromUrl]
    const cleanKey = mappedKey
      ? mappedKey.replace(/[^a-z0-9]/gi, '')
      : leagueSlugFromUrl
    return `espn_${cleanKey}_${eventId}`
  }

  // New format: anything-vs-anything-NUMERICID
  // Extract the trailing numeric ID (5-9 digits)
  const numericMatch = decoded.match(/-(\d{5,9})$/)
  if (numericMatch) {
    return `espn_eventid_${numericMatch[1]}`
  }

  return decoded
}
