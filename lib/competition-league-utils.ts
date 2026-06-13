/**
 * Competition league detection and scoring utilities.
 *
 * Parses a competition name to detect the target league/sport,
 * validates it against known leagues, and computes real
 * tip-based scores from the auto_tips table.
 */

import { query, addColumnIfMissing } from '@/lib/db';
import { getFakeTipsterById } from '@/lib/fake-tipsters';

// ── Canonical league list ─────────────────────────────────────────────────────
export interface LeagueRef {
  leagueId: number;
  leagueName: string;
  sportFocus: string;
  espnKey: string;
  aliases: string[];
}

export const KNOWN_LEAGUES: LeagueRef[] = [
  // ── Africa — East ─────────────────────────────────────────────────────────
  { leagueId: 201, leagueName: 'Kenya Premier League',         sportFocus: 'football', espnKey: 'ken.1',  aliases: ['kpl', 'kenyan premier league', 'fkf premier league', 'fkf pl', 'kenya football federation'] },
  { leagueId: 202, leagueName: 'Tanzania Premier League',      sportFocus: 'football', espnKey: 'tan.1',  aliases: ['tanzanian premier league', 'tpl', 'nbssal'] },
  { leagueId: 203, leagueName: 'Uganda Premier League',        sportFocus: 'football', espnKey: 'uga.1',  aliases: ['ugandan premier league', 'upl', 'fufa premier'] },
  { leagueId: 204, leagueName: 'Ethiopian Premier League',     sportFocus: 'football', espnKey: 'eth.1',  aliases: ['ethiopia premier', 'ethiopian league'] },
  { leagueId: 205, leagueName: 'Rwanda Premier League',        sportFocus: 'football', espnKey: 'rwa.1',  aliases: ['rwandan premier league', 'ferwafa premier'] },
  // ── Africa — West ─────────────────────────────────────────────────────────
  { leagueId: 210, leagueName: 'Nigerian Premier League',      sportFocus: 'football', espnKey: 'nga.1',  aliases: ['npfl', 'nigeria football premier league', 'nigeria premier', 'nfpl'] },
  { leagueId: 211, leagueName: 'Ghana Premier League',         sportFocus: 'football', espnKey: 'gha.1',  aliases: ['ghanaian premier league', 'ghpl', 'gpl'] },
  { leagueId: 212, leagueName: 'Senegal Premier League',       sportFocus: 'football', espnKey: 'sen.1',  aliases: ['senegalese premier league', 'ligue 1 senegal'] },
  { leagueId: 213, leagueName: 'Ivory Coast League',           sportFocus: 'football', espnKey: 'civ.1',  aliases: ['ligue 1 ivory coast', 'cote divoire league'] },
  { leagueId: 214, leagueName: 'Cameroon Premier League',      sportFocus: 'football', espnKey: 'cmr.1',  aliases: ['cameroonian premier league', 'elite one cameroon'] },
  // ── Africa — North/South ──────────────────────────────────────────────────
  { leagueId: 220, leagueName: 'South Africa Premier Soccer League', sportFocus: 'football', espnKey: 'rsa.1', aliases: ['psl', 'south african psl', 'dstv premiership', 'south africa psl'] },
  { leagueId: 221, leagueName: 'Egyptian Premier League',      sportFocus: 'football', espnKey: 'egy.1',  aliases: ['egypt premier league', 'nile premier league'] },
  { leagueId: 222, leagueName: 'Moroccan Botola Pro',          sportFocus: 'football', espnKey: 'mar.1',  aliases: ['moroccan league', 'botola', 'botola pro'] },
  { leagueId: 223, leagueName: 'Tunisian Ligue 1',             sportFocus: 'football', espnKey: 'tun.1',  aliases: ['tunisian league', 'ligue professionnelle 1'] },
  { leagueId: 224, leagueName: 'Algerian Ligue Professionnelle', sportFocus: 'football', espnKey: 'alg.1', aliases: ['algerian league', 'ligue professionnelle 1 algerie'] },
  // ── Africa — Continental ──────────────────────────────────────────────────
  { leagueId: 230, leagueName: 'CAF Champions League',         sportFocus: 'football', espnKey: 'caf.cl', aliases: ['caf cl', 'caf champions'] },
  { leagueId: 231, leagueName: 'CAF Confederation Cup',        sportFocus: 'football', espnKey: 'caf.cc', aliases: ['caf confed', 'caf confederation'] },
  { leagueId: 232, leagueName: 'AFCON',                        sportFocus: 'football', espnKey: 'caf.afcon', aliases: ['africa cup of nations', 'african cup of nations'] },
  // ── Europe — Top 5 ────────────────────────────────────────────────────────
  { leagueId: 1,  leagueName: 'English Premier League',        sportFocus: 'football', espnKey: 'eng.1',  aliases: ['premier league', 'epl', 'english premier league', 'prem', 'bpl', 'barclays premier league'] },
  { leagueId: 2,  leagueName: 'La Liga',                       sportFocus: 'football', espnKey: 'esp.1',  aliases: ['laliga', 'spanish league', 'la liga santander', 'spanish primera division'] },
  { leagueId: 3,  leagueName: 'Bundesliga',                    sportFocus: 'football', espnKey: 'ger.1',  aliases: ['german bundesliga', 'buli', 'german league'] },
  { leagueId: 4,  leagueName: 'Serie A',                       sportFocus: 'football', espnKey: 'ita.1',  aliases: ['italian serie a', 'calcio', 'italian league'] },
  { leagueId: 5,  leagueName: 'Ligue 1',                       sportFocus: 'football', espnKey: 'fra.1',  aliases: ['french ligue 1', 'ligue1', 'french league'] },
  // ── Europe — Other ────────────────────────────────────────────────────────
  { leagueId: 6,  leagueName: 'Eredivisie',                    sportFocus: 'football', espnKey: 'ned.1',  aliases: ['dutch eredivisie', 'netherlands league', 'dutch league'] },
  { leagueId: 7,  leagueName: 'Primeira Liga',                 sportFocus: 'football', espnKey: 'por.1',  aliases: ['portuguese league', 'liga nos', 'liga portugal', 'portugal league'] },
  { leagueId: 8,  leagueName: 'Scottish Premiership',          sportFocus: 'football', espnKey: 'sco.1',  aliases: ['spfl', 'scottish premier league', 'scottish league'] },
  { leagueId: 16, leagueName: 'Belgian Pro League',            sportFocus: 'football', espnKey: 'bel.1',  aliases: ['jupiler pro league', 'belgian league', 'belgium pro'] },
  { leagueId: 15, leagueName: 'Turkish Super Lig',             sportFocus: 'football', espnKey: 'tur.1',  aliases: ['super lig', 'tsl', 'turkey super lig'] },
  { leagueId: 240, leagueName: 'Greek Super League',           sportFocus: 'football', espnKey: 'gre.1',  aliases: ['greek league', 'super league greece'] },
  { leagueId: 241, leagueName: 'Russian Premier League',       sportFocus: 'football', espnKey: 'rus.1',  aliases: ['russian league', 'rpfl'] },
  { leagueId: 242, leagueName: 'Ukrainian Premier League',     sportFocus: 'football', espnKey: 'ukr.1',  aliases: ['ukraine league', 'upl ukraine'] },
  { leagueId: 243, leagueName: 'Austrian Bundesliga',          sportFocus: 'football', espnKey: 'aut.1',  aliases: ['austria bundesliga', 'austrian league'] },
  { leagueId: 244, leagueName: 'Swiss Super League',           sportFocus: 'football', espnKey: 'sui.1',  aliases: ['switzerland league', 'swiss league'] },
  { leagueId: 245, leagueName: 'Danish Superliga',             sportFocus: 'football', espnKey: 'den.1',  aliases: ['denmark superliga', 'danish league'] },
  { leagueId: 246, leagueName: 'Norwegian Eliteserien',        sportFocus: 'football', espnKey: 'nor.1',  aliases: ['norway league', 'eliteserien'] },
  { leagueId: 247, leagueName: 'Swedish Allsvenskan',          sportFocus: 'football', espnKey: 'swe.1',  aliases: ['sweden league', 'allsvenskan'] },
  { leagueId: 248, leagueName: 'Polish Ekstraklasa',           sportFocus: 'football', espnKey: 'pol.1',  aliases: ['poland league', 'ekstraklasa'] },
  { leagueId: 249, leagueName: 'Czech Fortuna Liga',           sportFocus: 'football', espnKey: 'cze.1',  aliases: ['czech league', 'fortuna liga'] },
  { leagueId: 250, leagueName: 'Romanian Liga 1',              sportFocus: 'football', espnKey: 'rou.1',  aliases: ['romania league', 'liga 1 romania'] },
  { leagueId: 251, leagueName: 'Croatian HNL',                 sportFocus: 'football', espnKey: 'cro.1',  aliases: ['croatia league', 'hnl', 'croatia hnl'] },
  { leagueId: 252, leagueName: 'Serbian SuperLiga',            sportFocus: 'football', espnKey: 'srb.1',  aliases: ['serbia league', 'superliga serbia'] },
  // ── Europe — Cups/Continental ─────────────────────────────────────────────
  { leagueId: 9,  leagueName: 'UEFA Champions League',         sportFocus: 'football', espnKey: 'uefa.champions', aliases: ['champions league', 'ucl', 'cl', 'uefa cl'] },
  { leagueId: 10, leagueName: 'UEFA Europa League',            sportFocus: 'football', espnKey: 'uefa.europa',    aliases: ['europa league', 'uel', 'uefa europa'] },
  { leagueId: 26, leagueName: 'UEFA Conference League',        sportFocus: 'football', espnKey: 'uefa.europa.conf', aliases: ['conference league', 'uecl', 'conference'] },
  { leagueId: 44, leagueName: 'FA Cup',                        sportFocus: 'football', espnKey: 'eng.fa',         aliases: ['facup', 'fa cup england'] },
  { leagueId: 41, leagueName: 'EFL Championship',              sportFocus: 'football', espnKey: 'eng.2',          aliases: ['championship', 'english championship', 'efl'] },
  // ── Americas ──────────────────────────────────────────────────────────────
  { leagueId: 11, leagueName: 'MLS',                           sportFocus: 'football', espnKey: 'usa.1',  aliases: ['major league soccer', 'mls soccer', 'us soccer'] },
  { leagueId: 12, leagueName: 'Brazilian Serie A',             sportFocus: 'football', espnKey: 'bra.1',  aliases: ['brasileirao', 'brazil serie a', 'campeonato brasileiro'] },
  { leagueId: 13, leagueName: 'Argentine Primera',             sportFocus: 'football', espnKey: 'arg.1',  aliases: ['argentina primera division', 'liga profesional', 'argentina league'] },
  { leagueId: 25, leagueName: 'Copa Libertadores',             sportFocus: 'football', espnKey: 'conmebol.libertadores', aliases: ['libertadores', 'conmebol libertadores'] },
  { leagueId: 27, leagueName: 'Liga MX',                       sportFocus: 'football', espnKey: 'mex.1',  aliases: ['mexican league', 'mexico liga mx'] },
  { leagueId: 260, leagueName: 'Colombian Primera A',          sportFocus: 'football', espnKey: 'col.1',  aliases: ['colombia league', 'dimayor'] },
  { leagueId: 261, leagueName: 'Chilean Primera Division',     sportFocus: 'football', espnKey: 'chi.1',  aliases: ['chile league', 'primera division chile'] },
  // ── Middle East / Asia ────────────────────────────────────────────────────
  { leagueId: 14, leagueName: 'Saudi Pro League',              sportFocus: 'football', espnKey: 'ksa.1',  aliases: ['spl', 'saudi league', 'roshn saudi league'] },
  { leagueId: 270, leagueName: 'UAE Pro League',               sportFocus: 'football', espnKey: 'uae.1',  aliases: ['uae league', 'arabian gulf league'] },
  { leagueId: 271, leagueName: 'J-League',                     sportFocus: 'football', espnKey: 'jpn.1',  aliases: ['japan j league', 'j1 league', 'japanese league'] },
  { leagueId: 272, leagueName: 'K-League',                     sportFocus: 'football', espnKey: 'kor.1',  aliases: ['korea k league', 'south korea league', 'k1 league'] },
  { leagueId: 273, leagueName: 'Chinese Super League',         sportFocus: 'football', espnKey: 'chn.1',  aliases: ['china super league', 'csl'] },
  { leagueId: 274, leagueName: 'Indian Super League',          sportFocus: 'football', espnKey: 'ind.1',  aliases: ['isl', 'india football', 'isl india'] },
  { leagueId: 275, leagueName: 'A-League',                     sportFocus: 'football', espnKey: 'aus.1',  aliases: ['australia league', 'a league australia', 'australian a-league'] },
  // ── Basketball ────────────────────────────────────────────────────────────
  { leagueId: 101, leagueName: 'NBA',                          sportFocus: 'basketball', espnKey: 'nba',        aliases: ['national basketball association'] },
  { leagueId: 102, leagueName: 'EuroLeague',                   sportFocus: 'basketball', espnKey: 'euroleague', aliases: ['euroleague basketball'] },
  { leagueId: 103, leagueName: 'FIBA World Cup',               sportFocus: 'basketball', espnKey: 'fiba',       aliases: ['fiba basketball', 'basketball world cup'] },
  // ── American Football ─────────────────────────────────────────────────────
  { leagueId: 401, leagueName: 'NFL',                          sportFocus: 'american-football', espnKey: 'nfl', aliases: ['national football league', 'nfl football'] },
  // ── Baseball ──────────────────────────────────────────────────────────────
  { leagueId: 501, leagueName: 'MLB',                          sportFocus: 'baseball', espnKey: 'mlb',          aliases: ['major league baseball'] },
  // ── Ice Hockey ────────────────────────────────────────────────────────────
  { leagueId: 601, leagueName: 'NHL',                          sportFocus: 'ice-hockey', espnKey: 'nhl',        aliases: ['national hockey league'] },
  // ── Tennis ───────────────────────────────────────────────────────────────
  { leagueId: 701, leagueName: 'ATP Tour',                     sportFocus: 'tennis', espnKey: 'atp',            aliases: ['atp', 'mens tennis'] },
  { leagueId: 702, leagueName: 'WTA Tour',                     sportFocus: 'tennis', espnKey: 'wta',            aliases: ['wta', 'womens tennis'] },
  // ── MMA / Combat ─────────────────────────────────────────────────────────
  { leagueId: 2701, leagueName: 'UFC',                         sportFocus: 'mma', espnKey: 'ufc',               aliases: ['ultimate fighting championship'] },
  // ── Rugby ─────────────────────────────────────────────────────────────────
  { leagueId: 800, leagueName: 'Rugby World Cup',              sportFocus: 'rugby', espnKey: 'rugby.world',     aliases: ['rwc', 'world rugby cup'] },
  { leagueId: 801, leagueName: 'Six Nations',                  sportFocus: 'rugby', espnKey: 'rugby.6nations',  aliases: ['6 nations', 'six nations rugby'] },
  // ── Cricket ───────────────────────────────────────────────────────────────
  { leagueId: 900, leagueName: 'ICC Cricket World Cup',        sportFocus: 'cricket', espnKey: 'cricket.wc',   aliases: ['cricket world cup', 'icc wc'] },
  { leagueId: 901, leagueName: 'IPL',                          sportFocus: 'cricket', espnKey: 'cricket.ipl',  aliases: ['indian premier league cricket', 'ipl cricket'] },
  // ── FIFA World Cup ────────────────────────────────────────────────────────
  // Tips are stored as 'World Cup' by the ESPN feed; the competition is named
  // 'FIFA World Cup 2026'. All variants must map to the same leagueId so
  // the LIKE/exact filters in computeLeaderboard resolve them correctly.
  { leagueId: 29, leagueName: 'World Cup',                     sportFocus: 'football', espnKey: 'fifa.world',  aliases: ['fifa world cup', 'fifa world cup 2026', 'world cup 2026', 'world cup football', 'fifa wc', 'wc 2026'] },
];

/**
 * Detect which league (if any) a competition name refers to.
 * Returns null if the competition is general (no specific league).
 *
 * Matching is done longest-match-first so "Kenya Premier League"
 * is caught by its own entry BEFORE it could substring-match
 * the shorter "Premier League" alias.
 */
export function detectLeagueFromName(name: string): LeagueRef | null {
  const n = name.toLowerCase().trim();

  // Build a flat list of (league, term, termLength) candidates,
  // then sort by term length descending so more-specific phrases win.
  type Candidate = { league: LeagueRef; term: string };
  const candidates: Candidate[] = [];

  for (const league of KNOWN_LEAGUES) {
    candidates.push({ league, term: league.leagueName.toLowerCase() });
    for (const alias of league.aliases) {
      candidates.push({ league, term: alias.toLowerCase() });
    }
  }

  // Longest term first — prevents "Kenya Premier League" from
  // accidentally matching the shorter "Premier League".
  candidates.sort((a, b) => b.term.length - a.term.length);

  for (const { league, term } of candidates) {
    // Use word-boundary-aware matching: the term must appear as a complete
    // phrase, not as a fragment of a longer word.
    const idx = n.indexOf(term);
    if (idx === -1) continue;
    const before = idx > 0 ? n[idx - 1] : ' ';
    const after  = idx + term.length < n.length ? n[idx + term.length] : ' ';
    const beforeOk = /[\s,\-_(]/.test(before) || idx === 0;
    const afterOk  = /[\s,\-_)]/.test(after)  || idx + term.length === n.length;
    if (beforeOk && afterOk) return league;
  }

  return null;
}

/**
 * Given a competition name, returns sport focus even for general competitions.
 */
export function detectSportFocusFromName(name: string): string {
  const n = name.toLowerCase();
  const specific = detectLeagueFromName(name);
  if (specific) return specific.sportFocus;

  if (/\b(football|soccer|footy)\b/.test(n)) return 'football';
  if (/\b(basketball|hoops|nba)\b/.test(n)) return 'basketball';
  if (/\b(tennis)\b/.test(n)) return 'tennis';
  if (/\b(baseball|mlb)\b/.test(n)) return 'baseball';
  if (/\b(hockey|nhl|ice)\b/.test(n)) return 'ice-hockey';
  if (/\b(mma|ufc|boxing|combat)\b/.test(n)) return 'mma';
  if (/\b(cricket)\b/.test(n)) return 'cricket';
  if (/\b(rugby)\b/.test(n)) return 'rugby';
  if (/\b(golf)\b/.test(n)) return 'golf';

  return 'multi-sport';
}

/**
 * Validate that a proposed competition name is consistent with available leagues.
 *
 * POLICY: Admin can create competitions for ANY league or competition worldwide.
 * - If a known league is detected → green confirmation.
 * - If name sounds like a league but we don't recognise it → yellow warning
 *   (still valid — admin knows their competition better than the system does).
 * - General names → valid with no warning.
 */
export function validateCompetitionLeague(name: string): {
  valid: boolean;
  detected: LeagueRef | null;
  sportFocus: string;
  warning: string | null;
} {
  const detected = detectLeagueFromName(name);
  const sportFocus = detectSportFocusFromName(name);

  if (detected) {
    return { valid: true, detected, sportFocus, warning: null };
  }

  // Check for "sounds like a specific league" patterns
  const leagueSoundingWords = /\b(league|cup|premier|liga|serie|ligue|bundesliga|championship|division|superliga|premiership|allsvenskan|eliteserien|ekstraklasa)\b/i;
  const hasLeagueWord = leagueSoundingWords.test(name);

  if (hasLeagueWord) {
    // Warn but DO NOT block — admin can create competitions for any league
    return {
      valid: true,
      detected: null,
      sportFocus,
      warning: `"${name}" wasn't matched to a known league — it will run as a general competition. That's fine for local or custom leagues.`,
    };
  }

  return { valid: true, detected: null, sportFocus, warning: null };
}

// ── Scoring engine ────────────────────────────────────────────────────────────

export interface CompetitorScore {
  userId: number;
  username: string;
  displayName: string | null;
  avatar: string | null;
  totalTips: number;
  won: number;
  lost: number;
  pending: number;
  avgOdds: number;
  points: number;
  roi: number;
  winRate: number;
  isFake: boolean;
}

function calculatePoints(won: number, lost: number, totalOdds: number, wonCount: number): number {
  // Odds bonus = (avg_win_odds - 1) × 10, rounded to nearest integer.
  // This means a 1.28 win earns +3 bonus, a 1.39 win earns +4 bonus,
  // a 2.00 win earns +10 bonus, a 3.00 win earns +20 bonus, etc.
  // Previously Math.floor(avg_odds) was used which made 1.28 and 1.39 identical (both = 1).
  const avgWinOdds = wonCount > 0 ? totalOdds / wonCount : 0;
  const winBonus = wonCount > 0 ? Math.round((avgWinOdds - 1) * 10) : 0;
  return won * 10 + won * winBonus - lost * 5;
}


export async function computeLeaderboard(params: {
  startDate: string;
  endDate: string;
  leagueId?: number | null;
  leagueName?: string | null;
  sportFocus?: string | null;
  minTips?: number;
  limit?: number;
  allowedUserIds?: number[] | null;
  /** Only count tips on matches whose kickoff falls within this window (e.g. GW38 only) */
  matchKickoffFrom?: string | null;
  matchKickoffTo?: string | null;
}): Promise<CompetitorScore[]> {
  const { startDate, endDate, leagueId, leagueName, sportFocus, minTips = 3, limit = 100, allowedUserIds, matchKickoffFrom, matchKickoffTo } = params;

  const conditions: string[] = [
    'at.status IN (\'won\', \'lost\', \'pending\')',
  ];
  const sqlParams: (string | number)[] = [];

  if (matchKickoffFrom && matchKickoffTo) {
    // Round-based competition: filter by match kickoff window.
    // Tips count as long as they were placed before the match kicked off,
    // regardless of when the competition officially "started".
    conditions.push('at.kickoff >= ?');
    conditions.push('at.kickoff <= ?');
    conditions.push('at.created_at <= at.kickoff');
    sqlParams.push(matchKickoffFrom, matchKickoffTo);
  } else if (leagueName || leagueId) {
    // League-scoped competition without an explicit kickoff window:
    // Use match kickoff as the anchor so tips posted days before the
    // competition start date (but for matches during the window) are included.
    // Tips must be placed before kickoff and the kickoff must be within the competition window.
    conditions.push('at.kickoff >= ?');
    conditions.push('at.kickoff <= ?');
    conditions.push('at.created_at <= at.kickoff');
    sqlParams.push(startDate, endDate);
  } else {
    // General competition: filter by tip creation date window.
    conditions.push('at.created_at >= ?');
    conditions.push('at.created_at <= ?');
    sqlParams.push(startDate, endDate);
  }

  if (allowedUserIds !== null && allowedUserIds !== undefined) {
    if (allowedUserIds.length > 0) {
      const placeholders = allowedUserIds.map(() => '?').join(',');
      conditions.push(`(at.tipster_id >= 1000 OR at.tipster_id IN (${placeholders}))`);
      sqlParams.push(...allowedUserIds);
    } else {
      conditions.push('at.tipster_id >= 1000');
    }
  }

  if (leagueName || leagueId) {
    // Build a set of all exact name variants for this league so that
    // "English Premier League" also matches tips stored as "Premier League".
    // We use exact equality (= ?) for aliases to avoid false positives —
    // e.g. LIKE '%premier league%' would incorrectly match "Kenya Premier League".
    const ref = leagueId
      ? KNOWN_LEAGUES.find(l => l.leagueId === leagueId)
      : KNOWN_LEAGUES.find(l =>
          l.leagueName.toLowerCase() === (leagueName ?? '').toLowerCase() ||
          l.aliases.some(a => a.toLowerCase() === (leagueName ?? '').toLowerCase())
        );

    if (ref) {
      // Canonical name uses LIKE for partial matches (e.g. "English Premier League" stored with prefix/suffix)
      // Aliases use exact equality to avoid cross-league collisions
      const exactTerms = [ref.leagueName, ...ref.aliases]
        .filter((t, i, arr) => arr.indexOf(t) === i); // dedupe

      const clauses: string[] = exactTerms.map(() => 'at.league = ?');
      // Also keep a LIKE on the canonical name for safety
      clauses.push('at.league LIKE ?');
      conditions.push(`(${clauses.join(' OR ')})`);
      for (const t of exactTerms) sqlParams.push(t);
      sqlParams.push(`%${ref.leagueName}%`);
    } else if (leagueName) {
      // Unknown league — fall back to plain LIKE match on whatever name was given
      conditions.push('at.league LIKE ?');
      sqlParams.push(`%${leagueName}%`);
    }
  } else if (sportFocus && sportFocus !== 'multi-sport') {
    const sportMap: Record<string, string> = {
      football: 'Football',
      basketball: 'Basketball',
      tennis: 'Tennis',
      baseball: 'Baseball',
      'ice-hockey': 'Hockey',
      mma: 'MMA',
      cricket: 'Cricket',
      rugby: 'Rugby',
      golf: 'Golf',
    };
    const sportLabel = sportMap[sportFocus];
    if (sportLabel) {
      conditions.push('at.sport LIKE ?');
      sqlParams.push(`%${sportLabel}%`);
    }
  }

  const whereClause = conditions.join(' AND ');

  try {
    const result = await query<{
      tipster_id: number;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      total_tips: number;
      won: number;
      lost: number;
      pending: number;
      avg_odds: number;
      won_odds_sum: number;
    }>(`
      SELECT
        at.tipster_id,
        COALESCE(up.display_name, u.username, CONCAT('User#', at.tipster_id)) AS username,
        up.display_name,
        up.avatar_url,
        COUNT(*)                                                   AS total_tips,
        SUM(at.status = 'won')                                     AS won,
        SUM(at.status = 'lost')                                    AS lost,
        SUM(at.status = 'pending')                                 AS pending,
        ROUND(AVG(at.odds), 2)                                     AS avg_odds,
        ROUND(SUM(CASE WHEN at.status = 'won' THEN at.odds ELSE 0 END), 2) AS won_odds_sum
      FROM auto_tips at
      LEFT JOIN users u ON u.id = at.tipster_id
      LEFT JOIN user_profiles up ON up.user_id = at.tipster_id
      WHERE ${whereClause}
      GROUP BY at.tipster_id, up.display_name, up.avatar_url
      HAVING total_tips >= ?
      ORDER BY
        (SUM(at.status = 'won') * 10 + SUM(at.status = 'won') * ROUND((COALESCE(SUM(CASE WHEN at.status = 'won' THEN at.odds ELSE 0 END) / NULLIF(SUM(at.status = 'won'), 0), 1) - 1) * 10) - SUM(at.status = 'lost') * 5) DESC,
        ROUND((SUM(at.status = 'won') / NULLIF(SUM(at.status = 'won') + SUM(at.status = 'lost'), 0)) * 100, 1) DESC
      LIMIT ?
    `, [...sqlParams, minTips, limit]);

    return result.rows.map(row => {
      const won = Number(row.won);
      const lost = Number(row.lost);
      const pending = Number(row.pending);
      const avgOdds = Number(row.avg_odds);
      const wonOddsSum = Number(row.won_odds_sum);
      const totalSettled = won + lost;
      const points = calculatePoints(won, lost, wonOddsSum, won);
      const roi = totalSettled > 0 ? ((won * avgOdds - totalSettled) / totalSettled) * 100 : 0;
      const winRate = totalSettled > 0 ? (won / totalSettled) * 100 : 0;
      const tipsterId = Number(row.tipster_id);

      // For fake tipsters (id >= 1000), look up their real name/avatar from the in-memory catalogue
      const fakeTipster = tipsterId >= 1000 ? getFakeTipsterById(tipsterId) : null;

      return {
        userId: tipsterId,
        username: fakeTipster ? fakeTipster.username : (row.username || `User#${tipsterId}`),
        displayName: fakeTipster ? fakeTipster.displayName : (row.display_name || null),
        avatar: fakeTipster ? fakeTipster.avatar : (row.avatar_url || null),
        totalTips: Number(row.total_tips),
        won,
        lost,
        pending,
        avgOdds,
        points,
        roi: Math.round(roi * 10) / 10,
        winRate: Math.round(winRate * 10) / 10,
        isFake: tipsterId >= 1000,
      };
    });
  } catch (e) {
    console.error('[computeLeaderboard] DB query failed:', e);
    return [];
  }
}

export async function findLeagueRoundEndDate(leagueName: string, afterDate: string, beforeDate: string): Promise<string | null> {
  try {
    const result = await query<{ last_kickoff: string }>(`
      SELECT MAX(kickoff) AS last_kickoff
      FROM auto_tips
      WHERE league LIKE ?
        AND kickoff >= ?
        AND kickoff <= ?
        AND status = 'pending'
    `, [`%${leagueName}%`, afterDate, beforeDate]);

    const last = result.rows[0]?.last_kickoff;
    if (!last) return null;

    const endDate = new Date(last);
    endDate.setHours(endDate.getHours() + 2);
    return endDate.toISOString();
  } catch {
    return null;
  }
}

export async function migrateCompetitionsTable(): Promise<void> {
  const competitionsCols: Array<[string, string]> = [
    ['type', `ENUM('daily','weekly','monthly','special') DEFAULT 'weekly'`],
    ['sport_focus', `VARCHAR(100) DEFAULT 'multi-sport'`],
    ['league_id', 'INT DEFAULT NULL'],
    ['league_name', 'VARCHAR(200) DEFAULT NULL'],
    ['currency', `VARCHAR(10) DEFAULT 'KES'`],
    ['prize_breakdown', 'JSON DEFAULT NULL'],
    ['slug', 'VARCHAR(200) DEFAULT NULL'],
    ['sport_type', 'VARCHAR(100) DEFAULT NULL'],
    ['match_kickoff_from', 'DATETIME DEFAULT NULL'],
    ['match_kickoff_to', 'DATETIME DEFAULT NULL'],
  ];
  for (const [col, def] of competitionsCols) {
    await addColumnIfMissing('competitions', col, def);
  }

  const entriesCols: Array<[string, string]> = [
    ['points', 'INT DEFAULT 0'],
    ['won', 'INT DEFAULT 0'],
    ['lost', 'INT DEFAULT 0'],
    ['avg_odds', 'DECIMAL(8,2) DEFAULT 0'],
  ];
  for (const [col, def] of entriesCols) {
    await addColumnIfMissing('competition_entries', col, def);
  }
}
