/**
 * Competition league detection and scoring utilities.
 *
 * Parses a competition name to detect the target league/sport,
 * validates it against known ESPN leagues, and computes real
 * tip-based scores from the auto_tips table.
 */

import { query } from '@/lib/db';

// ── Canonical league list (mirrors ESPN_LEAGUES leagueId→leagueName) ──────────
export interface LeagueRef {
  leagueId: number;
  leagueName: string;
  sportFocus: string; // 'football' | 'basketball' | 'tennis' | etc.
  espnKey: string;    // e.g. 'eng.1'
  aliases: string[];  // additional keywords to match
}

export const KNOWN_LEAGUES: LeagueRef[] = [
  // Football / Soccer
  { leagueId: 1,  leagueName: 'Premier League',       sportFocus: 'football', espnKey: 'eng.1',                  aliases: ['epl', 'english premier league', 'prem', 'bpl'] },
  { leagueId: 2,  leagueName: 'La Liga',               sportFocus: 'football', espnKey: 'esp.1',                  aliases: ['laliga', 'spanish league', 'la liga santander'] },
  { leagueId: 3,  leagueName: 'Bundesliga',             sportFocus: 'football', espnKey: 'ger.1',                  aliases: ['german bundesliga', 'buli'] },
  { leagueId: 4,  leagueName: 'Serie A',               sportFocus: 'football', espnKey: 'ita.1',                  aliases: ['italian serie a', 'calcio'] },
  { leagueId: 5,  leagueName: 'Ligue 1',               sportFocus: 'football', espnKey: 'fra.1',                  aliases: ['french ligue 1', 'ligue1'] },
  { leagueId: 6,  leagueName: 'Eredivisie',            sportFocus: 'football', espnKey: 'ned.1',                  aliases: ['dutch eredivisie', 'netherlands league'] },
  { leagueId: 7,  leagueName: 'Primeira Liga',         sportFocus: 'football', espnKey: 'por.1',                  aliases: ['portuguese league', 'liga nos', 'liga portugal'] },
  { leagueId: 8,  leagueName: 'Scottish Premiership',  sportFocus: 'football', espnKey: 'sco.1',                  aliases: ['spfl', 'scottish premier league'] },
  { leagueId: 9,  leagueName: 'Champions League',      sportFocus: 'football', espnKey: 'uefa.champions',         aliases: ['ucl', 'uefa champions league', 'cl'] },
  { leagueId: 10, leagueName: 'Europa League',         sportFocus: 'football', espnKey: 'uefa.europa',            aliases: ['uel', 'uefa europa'] },
  { leagueId: 11, leagueName: 'MLS',                   sportFocus: 'football', espnKey: 'usa.1',                  aliases: ['major league soccer', 'mls soccer'] },
  { leagueId: 12, leagueName: 'Brazilian Serie A',     sportFocus: 'football', espnKey: 'bra.1',                  aliases: ['brasileirao', 'brazil serie a', 'campeonato brasileiro'] },
  { leagueId: 13, leagueName: 'Argentine Primera',     sportFocus: 'football', espnKey: 'arg.1',                  aliases: ['argentina primera division', 'liga profesional'] },
  { leagueId: 14, leagueName: 'Saudi Pro League',      sportFocus: 'football', espnKey: 'sau.1',                  aliases: ['spl', 'saudi league'] },
  { leagueId: 15, leagueName: 'Turkish Super Lig',     sportFocus: 'football', espnKey: 'tur.1',                  aliases: ['super lig', 'tsl'] },
  { leagueId: 16, leagueName: 'Belgian Pro League',    sportFocus: 'football', espnKey: 'bel.1',                  aliases: ['jupiler pro league', 'belgian league'] },
  { leagueId: 25, leagueName: 'Copa Libertadores',     sportFocus: 'football', espnKey: 'conmebol.libertadores',  aliases: ['libertadores'] },
  { leagueId: 26, leagueName: 'Conference League',     sportFocus: 'football', espnKey: 'uefa.europa.conf',       aliases: ['uecl', 'conference'] },
  { leagueId: 27, leagueName: 'Liga MX',               sportFocus: 'football', espnKey: 'mex.1',                  aliases: ['mexican league', 'mexico'] },
  { leagueId: 41, leagueName: 'EFL Championship',      sportFocus: 'football', espnKey: 'eng.2',                  aliases: ['championship', 'eng championship'] },
  { leagueId: 44, leagueName: 'FA Cup',                sportFocus: 'football', espnKey: 'eng.fa',                 aliases: ['facup'] },
  // Basketball
  { leagueId: 101, leagueName: 'NBA',                  sportFocus: 'basketball', espnKey: 'nba',                  aliases: ['national basketball association'] },
  { leagueId: 102, leagueName: 'EuroLeague',           sportFocus: 'basketball', espnKey: 'euroleague',           aliases: ['euroleague basketball'] },
  // American Football
  { leagueId: 401, leagueName: 'NFL',                  sportFocus: 'american-football', espnKey: 'nfl',           aliases: ['national football league', 'nfl football'] },
  // Baseball
  { leagueId: 501, leagueName: 'MLB',                  sportFocus: 'baseball', espnKey: 'mlb',                    aliases: ['major league baseball'] },
  // Ice Hockey
  { leagueId: 601, leagueName: 'NHL',                  sportFocus: 'ice-hockey', espnKey: 'nhl',                  aliases: ['national hockey league'] },
  // Tennis
  { leagueId: 701, leagueName: 'ATP Tour',             sportFocus: 'tennis', espnKey: 'atp',                      aliases: ['atp', 'mens tennis'] },
  { leagueId: 702, leagueName: 'WTA Tour',             sportFocus: 'tennis', espnKey: 'wta',                      aliases: ['wta', 'womens tennis'] },
  // MMA
  { leagueId: 2701, leagueName: 'UFC',                 sportFocus: 'mma', espnKey: 'ufc',                         aliases: ['ultimate fighting championship'] },
];

/**
 * Detect which league (if any) a competition name refers to.
 * Returns null if the competition is general (no specific league).
 */
export function detectLeagueFromName(name: string): LeagueRef | null {
  const n = name.toLowerCase().trim();

  for (const league of KNOWN_LEAGUES) {
    // Check primary name
    if (n.includes(league.leagueName.toLowerCase())) return league;
    // Check aliases
    for (const alias of league.aliases) {
      if (n.includes(alias.toLowerCase())) return league;
    }
  }
  return null;
}

/**
 * Given a competition name, returns sport focus even for general competitions.
 * e.g. "Football Weekly" → 'football', "NBA Daily" → 'basketball'
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
 * Returns a validation result with detected league info.
 */
export function validateCompetitionLeague(name: string): {
  valid: boolean;
  detected: LeagueRef | null;
  sportFocus: string;
  warning: string | null;
} {
  const detected = detectLeagueFromName(name);
  const sportFocus = detectSportFocusFromName(name);

  // Check for "sounds like a league" patterns that we couldn't match
  const leagueSoundingWords = /\b(league|cup|premier|liga|serie|ligue|bundesliga|championship|division)\b/i;
  const hasLeagueWord = leagueSoundingWords.test(name);

  if (hasLeagueWord && !detected) {
    return {
      valid: false,
      detected: null,
      sportFocus,
      warning: `The name "${name}" sounds like a specific league competition but no matching league was found. Use a recognised league name (e.g. "Premier League Weekly", "La Liga Daily") or a general name (e.g. "Weekly Football Challenge").`,
    };
  }

  return { valid: true, detected, sportFocus, warning: null };
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
  points: number;  // primary sort key
  roi: number;     // tie-breaker
  winRate: number;
  isFake: boolean; // tipster_id >= 1000
}

/**
 * Points formula:
 *   +10 per win
 *   +floor(odds) bonus per win (rewards backing value picks)
 *   -5 per loss
 *   ties broken by ROI
 *
 * Minimum 3 tips to qualify (configurable).
 */
function calculatePoints(won: number, lost: number, totalOdds: number, wonCount: number): number {
  const winBonus = wonCount > 0 ? Math.floor(totalOdds / wonCount) : 0;
  return won * 10 + won * winBonus - lost * 5;
}

/**
 * Compute real competition leaderboard from the auto_tips table.
 * Filters by:
 *   - competition time window (startDate → endDate)
 *   - league (if leagueId or leagueName is set)
 *   - sport (if sportFocus is set and not multi-sport)
 */
export async function computeLeaderboard(params: {
  startDate: string;
  endDate: string;
  leagueId?: number | null;
  leagueName?: string | null;
  sportFocus?: string | null;
  minTips?: number;
  limit?: number;
  /**
   * When provided, only real users (tipster_id < 1000) who are in this list
   * are included. Fake tipsters (>= 1000) are always included regardless.
   * Pass `null` or omit to include all users (backward-compat / admin views).
   */
  allowedUserIds?: number[] | null;
}): Promise<CompetitorScore[]> {
  const { startDate, endDate, leagueId, leagueName, sportFocus, minTips = 3, limit = 100, allowedUserIds } = params;

  // Build WHERE clause dynamically
  const conditions: string[] = [
    'at.created_at >= ?',
    'at.created_at <= ?',
    'at.status IN (\'won\', \'lost\', \'pending\')',
  ];
  const sqlParams: (string | number)[] = [startDate, endDate];

  // Join-gate: real users (< 1000) must have joined; fake tipsters (>= 1000) always allowed.
  if (allowedUserIds !== null && allowedUserIds !== undefined) {
    if (allowedUserIds.length > 0) {
      const placeholders = allowedUserIds.map(() => '?').join(',');
      conditions.push(`(at.tipster_id >= 1000 OR at.tipster_id IN (${placeholders}))`);
      sqlParams.push(...allowedUserIds);
    } else {
      // No real users have joined yet — only show fakes
      conditions.push('at.tipster_id >= 1000');
    }
  }
  // If allowedUserIds is null/undefined → no restriction (backward-compat).

  // League filter: match on league name stored in auto_tips.league column
  if (leagueName) {
    conditions.push('at.league LIKE ?');
    sqlParams.push(`%${leagueName}%`);
  } else if (leagueId) {
    // Look up league name from KNOWN_LEAGUES
    const ref = KNOWN_LEAGUES.find(l => l.leagueId === leagueId);
    if (ref) {
      conditions.push('at.league LIKE ?');
      sqlParams.push(`%${ref.leagueName}%`);
    }
  } else if (sportFocus && sportFocus !== 'multi-sport') {
    // Sport-level filter (no specific league)
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
      JOIN users u ON u.id = at.tipster_id
      LEFT JOIN user_profiles up ON up.user_id = at.tipster_id
      WHERE ${whereClause}
      GROUP BY at.tipster_id, u.username, up.display_name, up.avatar_url
      HAVING total_tips >= ?
      ORDER BY
        (SUM(at.status = 'won') * 10 + FLOOR(COALESCE(SUM(CASE WHEN at.status = 'won' THEN at.odds ELSE 0 END) / NULLIF(SUM(at.status = 'won'), 0), 0)) - SUM(at.status = 'lost') * 5) DESC,
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

      return {
        userId: tipsterId,
        username: row.username,
        displayName: row.display_name,
        avatar: row.avatar_url,
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
    console.warn('[computeLeaderboard] DB error:', e);
    return [];
  }
}

/**
 * Find the end time of a league's current round.
 * Queries the auto_tips table for the last kickoff of the current/upcoming week
 * in the given league, then adds a 2-hour buffer for the match to finish.
 */
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

    // Add 2 hours for 90-min match + HT + injury time
    const endDate = new Date(last);
    endDate.setHours(endDate.getHours() + 2);
    return endDate.toISOString();
  } catch {
    return null;
  }
}

/**
 * Run the DB migration to add missing columns to the competitions table.
 * Safe to call multiple times — uses ADD COLUMN IF NOT EXISTS (MySQL 8+)
 * or catches errors on older MySQL.
 */
export async function migrateCompetitionsTable(): Promise<void> {
  const migrations = [
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS type ENUM('daily','weekly','monthly','special') DEFAULT 'weekly'`,
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS sport_focus VARCHAR(100) DEFAULT 'multi-sport'`,
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS league_id INT DEFAULT NULL`,
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS league_name VARCHAR(200) DEFAULT NULL`,
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'KES'`,
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS prize_breakdown JSON DEFAULT NULL`,
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS slug VARCHAR(200) DEFAULT NULL`,
    `ALTER TABLE competitions ADD COLUMN IF NOT EXISTS sport_type VARCHAR(100) DEFAULT NULL`,
  ];

  for (const sql of migrations) {
    await query(sql, []).catch(e => {
      // Ignore "duplicate column" errors gracefully
      if (!String(e).includes('Duplicate column')) {
        console.warn('[migrateCompetitionsTable]', sql.slice(0, 60), '→', e);
      }
    });
  }

  // Also add score column to competition_entries if missing
  await query(
    `ALTER TABLE competition_entries ADD COLUMN IF NOT EXISTS points INT DEFAULT 0`,
    []
  ).catch(() => {});
  await query(
    `ALTER TABLE competition_entries ADD COLUMN IF NOT EXISTS won INT DEFAULT 0`,
    []
  ).catch(() => {});
  await query(
    `ALTER TABLE competition_entries ADD COLUMN IF NOT EXISTS lost INT DEFAULT 0`,
    []
  ).catch(() => {});
  await query(
    `ALTER TABLE competition_entries ADD COLUMN IF NOT EXISTS avg_odds DECIMAL(8,2) DEFAULT 0`,
    []
  ).catch(() => {});
}
