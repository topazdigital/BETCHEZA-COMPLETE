/**
 * Clean match URL utilities
 * Converts internal match IDs (espn_ita.1_737421) to readable URL slugs.
 * New format: team-a-vs-team-b-737421
 * Legacy format (still supported for reading): ita1-737421
 * Also handles fd_ (football-data.org) and camel1_ prefixes.
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
 * Stable numeric hash of a string (for non-numeric IDs like camel1f_abc123xyz).
 */
function stableNumericSuffix(str: string): string {
  // Extract any digits first — use them directly if present
  const digits = str.replace(/[^0-9]/g, '').slice(0, 8)
  if (digits.length >= 4) return digits
  // Fall back to a simple djb2-style hash
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i)
    h = h & 0x7fffffff
  }
  return String(h % 1000000).padStart(6, '0')
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
 * Works for ALL match ID formats:
 *   espn_eng.1_740942       → leeds-united-vs-burnley--eng1-740942
 *   espn_eng.league.cup_X   → arsenal-vs-man-city--engleaguecup-X
 *   fd_544563               → rc-celta-de-vigo-vs-levante-ud-544563
 *   camel1_12345            → afghanistan-u20-vs-turkmenistan-u20-12345
 *   camel1f_xyz             → team-a-vs-team-b-<hash>
 *
 * The double-dash (--) before the league slug lets slugToMatchId reconstruct
 * the exact ESPN ID (league + event) without ambiguity, preventing cross-league
 * event-ID collisions (e.g. Carabao Cup final vs Community Shield same ID).
 */
export function matchToSlug(matchId: string, homeTeam: string, awayTeam: string): string {
  const homeSlug = teamNameToSlug(homeTeam)
  const awaySlug = teamNameToSlug(awayTeam)

  // ESPN format: espn_ita.1_737421
  const espnMatch = matchId.match(/^espn_([a-z0-9.]+)_(\d+)$/i)
  if (espnMatch) {
    const leagueSlug = espnLeagueToSlug(espnMatch[1])
    // Embed the league slug separated by -- so slugToMatchId can round-trip exactly
    return `${homeSlug}-vs-${awaySlug}--${leagueSlug}-${espnMatch[2]}`
  }

  // Football-data.org format: fd_544563
  const fdMatch = matchId.match(/^fd_(\d+)$/)
  if (fdMatch) {
    return `${homeSlug}-vs-${awaySlug}-${fdMatch[1]}`
  }

  // Camel1 formats: camel1_12345678 or camel1f_abc123
  const camelMatch = matchId.match(/^camel1[f]?_(.+)$/)
  if (camelMatch) {
    return `${homeSlug}-vs-${awaySlug}-${stableNumericSuffix(camelMatch[1])}`
  }

  // Any other format with a trailing numeric ID separated by underscore
  const genericNumeric = matchId.match(/_(\d{4,})$/)
  if (genericNumeric) {
    return `${homeSlug}-vs-${awaySlug}-${genericNumeric[1]}`
  }

  // URL slug formats — trailing numeric separated by hyphen.
  // Handles legacy slugs ("ken1-401867459") and canonical slugs passed back in
  // ("gor-mahia-vs-nairobi-united-401867459"). In both cases we rebuild from the
  // numeric suffix + current team names so the canonical is always consistent.
  const hyphenNumeric = matchId.match(/-(\d{4,})$/)
  if (hyphenNumeric) {
    return `${homeSlug}-vs-${awaySlug}-${hyphenNumeric[1]}`
  }

  return encodeURIComponent(matchId)
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
  ksa1: 'ksa.1',
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
  // Pre-season / friendly / curtain-raisers
  clubfriendly: 'club.friendly',
  fifafriendly: 'fifa.friendly',
  fifafriendlyw: 'fifa.friendly.w',
  engcharity: 'eng.charity',
  espsupercopa: 'esp.supercopa',
  itasupercoppa: 'ita.supercoppa',
  gersupercup: 'ger.supercup',
  fratropheechampions: 'fra.trophee_champions',
}

/**
 * Convert a clean URL slug back to the internal match ID.
 * Handles five formats:
 *   1. Full ESPN ID:    espn_ita.1_737421            → normalised no-dot form
 *   2. Legacy format:  ita1-737421                  → espn_ita1_737421
 *   3. New format:     team-a-vs-team-b--eng1-737421 → espn_eng1_737421  (exact round-trip)
 *   4. Old new format: team-a-vs-team-b-737421       → espn_eventid_737421 (fallback)
 *   5. fd_/camel1 raw: fd_544563                    → returned as-is
 *
 * IMPORTANT: cached match IDs are generated with
 *   `espn_${league.replace(/[^a-z0-9]/gi, '')}_${eventId}`
 * so dots and hyphens in league keys are always stripped. slugToMatchId MUST
 * produce the same no-dot form so the fast-path cache scan hits correctly.
 *
 * The double-dash (--) separator before the league slug is the unambiguous
 * signal that the league key is embedded and the match can be round-tripped
 * exactly, preventing cross-league event-ID collisions.
 */
export function slugToMatchId(slug: string): string {
  const decoded = decodeURIComponent(slug)

  // Already a full ESPN ID — normalise to the no-dot cache format
  if (decoded.startsWith('espn_')) {
    return decoded.replace(/^(espn_)([^_]+)(_\d+)$/, (_m, prefix, league, suffix) =>
      `${prefix}${league.replace(/[^a-z0-9]/gi, '')}${suffix}`
    )
  }

  // Raw fd_ or camel1_ ID — return as-is, getMatchById will find it directly
  if (decoded.startsWith('fd_') || decoded.startsWith('camel1')) {
    return decoded
  }

  // Legacy format: single-segment leagueSlug + numericId (e.g. ita1-737421)
  const legacyMatch = decoded.match(/^([a-z0-9]+)-(\d+)$/i)
  if (legacyMatch) {
    const leagueSlugFromUrl = legacyMatch[1].toLowerCase()
    const eventId = legacyMatch[2]
    const mappedKey = LEAGUE_KEY_MAP[leagueSlugFromUrl]
    const cleanKey = mappedKey
      ? mappedKey.replace(/[^a-z0-9]/gi, '')
      : leagueSlugFromUrl
    return `espn_${cleanKey}_${eventId}`
  }

  // New format with embedded league key (double-dash separator):
  //   team-a-vs-team-b--engleaguecup-401859037
  //   team-a-vs-team-b--eng1-737421
  const embeddedLeagueMatch = decoded.match(/--([a-z0-9]+)-(\d{4,12})$/)
  if (embeddedLeagueMatch) {
    const leagueSlug = embeddedLeagueMatch[1]
    const eventId = embeddedLeagueMatch[2]
    return `espn_${leagueSlug}_${eventId}`
  }

  // Old new format (no league key): anything-vs-anything-NUMERICID
  // Returns ambiguous espn_eventid_ form — resolved later via cache scan
  const numericMatch = decoded.match(/-(\d{4,9})$/)
  if (numericMatch) {
    return `espn_eventid_${numericMatch[1]}`
  }

  return decoded
}
