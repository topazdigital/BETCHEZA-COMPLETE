/**
 * Utility to detect if a match is a women's or youth/age-group fixture,
 * and return an appropriate badge label.
 *
 * Smart rules:
 *  - Only add a badge if the team name doesn't already make it obvious
 *    (e.g. "Arsenal Women", "London City Lionesses" → no badge needed)
 *  - Detect from the league name / ESPN league slug
 */

const ALREADY_WOMENS_IN_NAME = /\b(women|woman|female|ladies|girls|lionesses|dames?|féminin|féminines?|fem(me)?s?|wfc\b)\b/i;
const WOMENS_LEAGUE_PATTERN = /\b(women('?s?)?|female|ladies|girls|dames?|féminin|feminine|femminile|frauen|nwsl|wsl|dam(es?)?\b|femenina|feminine)\b/i;
const YOUTH_AGE_PATTERN = /\bu\s*-?\s*(\d{2})\b/i;

export interface TeamCategoryBadge {
  /** If true, show a "W" badge (women's team not obvious from name) */
  isWomens: boolean;
  /** If a youth/age-group tournament, the age label e.g. "U21", "U19" */
  youthLabel: string | null;
}

/**
 * Returns badge info for a team/league combination.
 *
 * @param teamName   - The team's display name
 * @param leagueName - The league's display name (e.g. "Women's Super League")
 * @param leagueSlug - Optional ESPN league slug (e.g. "eng.w.1", "uefa.euro.u21")
 */
export function getTeamCategoryBadge(
  teamName: string,
  leagueName?: string | null,
  leagueSlug?: string | null,
): TeamCategoryBadge {
  const nameAlreadyClear = ALREADY_WOMENS_IN_NAME.test(teamName);

  // Detect women's from league name or slug
  const slugIsWomens = !!(leagueSlug && /\.w\.|\.w$|nwsl|wchampions|wwc|weuro|w-league/i.test(leagueSlug));
  const nameIsWomens = !!(leagueName && WOMENS_LEAGUE_PATTERN.test(leagueName));
  const isWomens = !nameAlreadyClear && (slugIsWomens || nameIsWomens);

  // Detect youth/age-group from league name or slug
  let youthLabel: string | null = null;
  const slugMatch = leagueSlug?.match(/\.u(\d{2})\b/i) || leagueSlug?.match(/u(\d{2})/i);
  const nameMatch = leagueName?.match(YOUTH_AGE_PATTERN);
  if (slugMatch) {
    youthLabel = `U${slugMatch[1]}`;
  } else if (nameMatch) {
    youthLabel = `U${nameMatch[1]}`;
  }

  return { isWomens, youthLabel };
}
