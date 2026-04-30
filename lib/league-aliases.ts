// Maps ESPN-style and other short league codes to canonical slugs in
// `ALL_LEAGUES`. This lets URLs like `/leagues/ken-1` (Kenya Premier League)
// or `/leagues/eng-1` resolve to the friendly slug used in our data.

import { ALL_LEAGUES } from './sports-data';

export const ESPN_LEAGUE_ALIASES: Record<string, string> = {
  // England
  'eng-1': 'premier-league',
  'eng.1': 'premier-league',
  'eng_premier': 'premier-league',
  // Spain
  'esp-1': 'la-liga',
  'esp.1': 'la-liga',
  // Italy
  'ita-1': 'serie-a',
  'ita.1': 'serie-a',
  // Germany
  'ger-1': 'bundesliga',
  'ger.1': 'bundesliga',
  // France
  'fra-1': 'ligue-1',
  'fra.1': 'ligue-1',
  // Netherlands
  'ned-1': 'eredivisie',
  'ned.1': 'eredivisie',
  // Portugal
  'por-1': 'primeira-liga',
  'por.1': 'primeira-liga',
  // Scotland
  'sco-1': 'scottish-premiership',
  'sco.1': 'scottish-premiership',
  // Belgium
  'bel-1': 'belgian-pro-league',
  // Russia
  'rus-1': 'russian-premier-league',
  // Turkey
  'tur-1': 'turkish-super-lig',
  // USA
  'usa-1': 'mls',
  'usa.1': 'mls',
  'mls-1': 'mls',
  // Mexico (alias to Liga MX which doesn't exist yet — fall back to MLS)
  // Brazil
  'bra-1': 'brazilian-serie-a',
  'bra.1': 'brazilian-serie-a',
  // Argentina
  'arg-1': 'argentine-primera',
  'arg.1': 'argentine-primera',
  // Saudi
  'sau-1': 'saudi-pro-league',
  'ksa-1': 'saudi-pro-league',
  // Japan
  'jpn-1': 'j-league',
  'jpn.1': 'j-league',
  // Korea
  'kor-1': 'k-league',
  'kor.1': 'k-league',
  // Australia
  'aus-1': 'a-league',
  // Africa — Kenya
  'ken-1': 'kenya-premier-league',
  'ken.1': 'kenya-premier-league',
  'ke-1': 'kenya-premier-league',
  'kpl': 'kenya-premier-league',
  // Ghana
  'gha-1': 'ghana-premier-league',
  'gha.1': 'ghana-premier-league',
  'gh-1': 'ghana-premier-league',
  'ghpl': 'ghana-premier-league',
  // Nigeria
  'nga-1': 'nigerian-premier-league',
  'nga.1': 'nigerian-premier-league',
  'ng-1': 'nigerian-premier-league',
  'npfl': 'nigerian-premier-league',
  // Tanzania
  'tan-1': 'tanzanian-premier-league',
  'tza-1': 'tanzanian-premier-league',
  'tz-1': 'tanzanian-premier-league',
  // Uganda
  'uga-1': 'ugandan-premier-league',
  'ug-1': 'ugandan-premier-league',
  'upl': 'ugandan-premier-league',
  // South Africa
  'rsa-1': 'south-african-premier-soccer-league',
  'za-1': 'south-african-premier-soccer-league',
  'psl': 'south-african-premier-soccer-league',
  // Morocco
  'mar-1': 'moroccan-botola-pro',
  'ma-1': 'moroccan-botola-pro',
  // Tunisia
  'tun-1': 'tunisian-ligue-1',
  'tn-1': 'tunisian-ligue-1',
  // Algeria
  'alg-1': 'algerian-ligue-1',
  'dz-1': 'algerian-ligue-1',
  // Egypt
  'egy-1': 'egyptian-premier-league',
  'egy.1': 'egyptian-premier-league',
  'eg-1': 'egyptian-premier-league',
  // CAF / continental
  'caf-cl': 'caf-champions-league',
  'caf-champions': 'caf-champions-league',
  'caf-cc': 'caf-confederation-cup',
  'caf-confed': 'caf-confederation-cup',
  'afcon': 'afcon',
  'caf-afcon': 'afcon',
  // England cups / lower
  'eng-fa': 'fa-cup',
  'eng-fac': 'fa-cup',
  'fa-cup': 'fa-cup',
  'eng-2': 'efl-championship',
  'efl-ch': 'efl-championship',
  // Spain cup
  'esp-cdr': 'copa-del-rey',
  'copa-del-rey': 'copa-del-rey',
  // Italy cup
  'ita-cop': 'coppa-italia',
  'coppa-italia': 'coppa-italia',
  // Germany cup
  'ger-pok': 'dfb-pokal',
  'dfb-pokal': 'dfb-pokal',
  // UEFA Conference
  'uefa-uecl': 'uefa-conference-league',
  'uefa-conference': 'uefa-conference-league',
  // UEFA / continental
  'uefa-champions': 'champions-league',
  'uefa-cl': 'champions-league',
  'uefa.champions': 'champions-league',
  'uefa-europa': 'europa-league',
  'uefa-el': 'europa-league',
  'uefa.europa': 'europa-league',
  // Conmebol
  'conmebol-l': 'copa-libertadores',
  'conmebol-libertadores': 'copa-libertadores',
};

/** Resolve any incoming slug to a canonical league slug from ALL_LEAGUES. */
export function resolveLeagueSlug(input: string): string | null {
  if (!input) return null;
  const lower = input.toLowerCase().trim();

  // Direct match
  if (ALL_LEAGUES.find(l => l.slug === lower)) return lower;

  // Manual alias map
  if (ESPN_LEAGUE_ALIASES[lower]) return ESPN_LEAGUE_ALIASES[lower];

  // Heuristic: country code + tier (e.g. "ke-1", "gb-eng-1")
  // Match by countryCode (case insensitive) and tier.
  const parts = lower.split(/[-.]/);
  if (parts.length >= 2) {
    const tier = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(tier)) {
      const cc = parts.slice(0, -1).join('-').toUpperCase();
      const found = ALL_LEAGUES.find(
        l => l.countryCode.toUpperCase() === cc && l.tier === tier && l.sportId === 1,
      );
      if (found) return found.slug;
    }
  }

  return null;
}
