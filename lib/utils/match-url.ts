/**
 * Clean match URL utilities
 * Converts internal match IDs (espn_ita.1_737421) to readable URL slugs (ita1-737421)
 * and back.
 */

/**
 * Build a league slug from the ESPN league key.
 * eng.1 → eng1, ita.1 → ita1, uefa.champions → uefachampions
 */
function espnLeagueToSlug(leagueKey: string): string {
  return leagueKey.replace(/\./g, '').toLowerCase()
}

/**
 * Convert internal match ID to a clean URL slug.
 * espn_ita.1_737421 → ita1-737421
 * espn_eng.1_450000 → eng1-450000
 */
export function matchIdToSlug(matchId: string): string {
  const m = matchId.match(/^espn_([a-z0-9.]+)_(\d+)$/i)
  if (!m) {
    // Fallback: URL-encode as-is
    return encodeURIComponent(matchId)
  }
  const leagueSlug = espnLeagueToSlug(m[1])
  return `${leagueSlug}-${m[2]}`
}

/**
 * Convert a clean URL slug back to the internal match ID.
 * Tries to reconstruct the full ESPN ID by scanning known league configs.
 * ita1-737421 → espn_ita.1_737421
 */
export function slugToMatchId(slug: string): string {
  // Already a full ESPN ID?
  if (slug.startsWith('espn_')) return decodeURIComponent(slug)

  // Match `leagueSlug-eventId`
  const m = slug.match(/^([a-z0-9]+)-(\d+)$/i)
  if (!m) return decodeURIComponent(slug)

  const leagueSlugFromUrl = m[1].toLowerCase()
  const eventId = m[2]

  // Lazy import ESPN_LEAGUES equivalent — inline the league key mapping
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
    // Basketball
    nba: 'nba',
    wnba: 'wnba',
    ncaaw: 'womens-college-basketball',
    ncaam: 'mens-college-basketball',
    euroleague: 'euroleague',
    // American Football
    nfl: 'nfl',
    // Baseball
    mlb: 'mlb',
    // Hockey
    nhl: 'nhl',
    // MMA
    ufc: 'ufc',
    // Tennis
    atp: 'atp',
    wta: 'wta',
    // Rugby
    rufc: 'rugbyunion',
    rl: 'rugbyleague',
  }

  const originalLeagueKey = LEAGUE_KEY_MAP[leagueSlugFromUrl]
  if (originalLeagueKey) {
    return `espn_${originalLeagueKey}_${eventId}`
  }

  // Fallback: assume no dots needed (e.g. nba, nfl)
  return `espn_${leagueSlugFromUrl}_${eventId}`
}
