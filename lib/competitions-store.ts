// ─────────────────────────────────────────────────────────────────────
// Tipster competitions store — MySQL primary, in-memory cache.
//
// All reads/writes go to MySQL (competitions + competition_entries tables).
// An in-memory cache is kept for the lifetime of the process and refreshed
// on demand. Missing columns are added via ALTER TABLE migrations on startup.
// ─────────────────────────────────────────────────────────────────────

import { query, execute, getPool } from './db';

export interface CompetitionParticipant {
  rank: number;
  tipsterId: number;
  username: string;
  displayName: string;
  avatar: string | null;
  countryCode: string | null;
  winRate: number;
  roi: number;
  tips: number;
  won: number;
  points: number;
  streak: number;
  isVerified: boolean;
}

export interface RuleConfig {
  type: 'min_tips' | 'min_avg_odds' | 'max_losses' | 'kickoff_only' | 'league_only' | 'sport_only' | 'score_formula' | 'tiebreaker' | 'custom';
  value?: number | string;
  label: string;
  enforceable: boolean;
}

export interface Competition {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'special';
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  prizePool: number;
  currency: string;
  entryFee: number;
  maxParticipants: number;
  prizes: Array<{ place: string; amount: number }>;
  participants: CompetitionParticipant[];
  rules: string[];
  ruleConfig?: RuleConfig[];
  sportFocus: string;
  leagueId?: number | null;
  leagueName?: string | null;
  roundBased?: boolean;
  matchKickoffFrom?: string | null;
  matchKickoffTo?: string | null;
  kickedUsers?: number[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ─── In-memory cache ───────────────────────────────────────────────────────
const g = globalThis as {
  __competitionsCache?: Competition[];
  __competitionsCacheAt?: number;
  __competitionsDbMigrated?: boolean;
};

const CACHE_TTL_MS = 60_000; // refresh from DB every 60 s

function invalidateCache() {
  g.__competitionsCache = undefined;
  g.__competitionsCacheAt = undefined;
}

// ─── DB migrations ─────────────────────────────────────────────────────────
// Add columns to competitions table that were added after the initial schema.

async function ensureCompetitionColumns() {
  if (g.__competitionsDbMigrated) return;
  g.__competitionsDbMigrated = true;
  if (!getPool()) return;

  try {
    // Get existing columns from DB so we only ADD what is missing
    const colResult = await query<{ Field: string }>(`SHOW COLUMNS FROM competitions`);
    const existing = new Set(colResult.rows.map(r => r.Field));

    const toAdd: Array<[string, string]> = [
      ['match_kickoff_from', 'datetime DEFAULT NULL'],
      ['match_kickoff_to',   'datetime DEFAULT NULL'],
      ['round_based',        'tinyint(1) NOT NULL DEFAULT 0'],
      ['rule_config',        'longtext DEFAULT NULL'],
      ['kicked_users',       'longtext DEFAULT NULL'],
      ['slug',               'varchar(200) DEFAULT NULL'],
      ['currency',           "varchar(10) DEFAULT 'KES'"],
      ['prize_breakdown',    'longtext DEFAULT NULL'],
    ];

    for (const [col, def] of toAdd) {
      if (!existing.has(col)) {
        try {
          await query(`ALTER TABLE competitions ADD COLUMN ${col} ${def}`);
        } catch (e) {
          console.warn(`[competitions] ALTER TABLE ADD COLUMN ${col} failed (may already exist):`, e);
        }
      }
    }
  } catch (e) {
    console.warn('[competitions] migration check failed:', e);
  }
}

// ─── Row → Competition mapping ─────────────────────────────────────────────

interface CompetitionRow {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  prize_pool: number;
  entry_fee: number;
  max_participants: number | null;
  status: string;
  rules: string | null;
  type: string;
  sport_focus: string | null;
  league_id: number | null;
  league_name: string | null;
  currency: string | null;
  prize_breakdown: string | null;
  slug: string | null;
  match_kickoff_from: string | null;
  match_kickoff_to: string | null;
  round_based: number | null;
  rule_config: string | null;
  kicked_users: string | null;
}

function rowToCompetition(row: CompetitionRow): Competition {
  let prizes: Competition['prizes'] = [];
  try { prizes = row.prize_breakdown ? JSON.parse(row.prize_breakdown) : []; } catch {}

  let rules: string[] = [];
  try { rules = row.rules ? JSON.parse(row.rules) : []; } catch {
    // plain text rules (old format)
    if (row.rules) rules = [row.rules];
  }

  let ruleConfig: RuleConfig[] | undefined;
  try { ruleConfig = row.rule_config ? JSON.parse(row.rule_config) : undefined; } catch {}

  let kickedUsers: number[] = [];
  try { kickedUsers = row.kicked_users ? JSON.parse(row.kicked_users) : []; } catch {}

  const slug = row.slug || slugify(row.name) || `competition-${row.id}`;

  // Map DB status 'finished' → 'completed' for app consistency
  let status: Competition['status'] = 'upcoming';
  if (row.status === 'active') status = 'active';
  else if (row.status === 'finished' || row.status === 'completed') status = 'completed';

  return {
    id: row.id,
    slug,
    name: row.name,
    description: row.description || '',
    type: (row.type as Competition['type']) || 'weekly',
    status,
    startDate: row.start_date,
    endDate: row.end_date,
    prizePool: Number(row.prize_pool) || 0,
    currency: row.currency || 'KES',
    entryFee: Number(row.entry_fee) || 0,
    maxParticipants: Number(row.max_participants) || 100,
    prizes,
    participants: [], // populated separately from competition_entries
    rules,
    ruleConfig,
    sportFocus: row.sport_focus || 'multi-sport',
    leagueId: row.league_id ?? null,
    leagueName: row.league_name ?? null,
    roundBased: !!row.round_based,
    matchKickoffFrom: row.match_kickoff_from ?? null,
    matchKickoffTo: row.match_kickoff_to ?? null,
    kickedUsers,
  };
}

// ─── Core read functions ────────────────────────────────────────────────────

export async function getCompetitionsAsync(): Promise<Competition[]> {
  const now = Date.now();
  if (g.__competitionsCache && g.__competitionsCacheAt && now - g.__competitionsCacheAt < CACHE_TTL_MS) {
    return g.__competitionsCache;
  }

  await ensureCompetitionColumns();

  try {
    const result = await query<CompetitionRow>(`
      SELECT id, name, description, start_date, end_date, prize_pool, entry_fee,
             max_participants, status, rules, type, sport_focus, league_id, league_name,
             currency, prize_breakdown, slug, match_kickoff_from, match_kickoff_to,
             round_based, rule_config, kicked_users
      FROM competitions
      ORDER BY start_date DESC
    `);

    const competitions = result.rows.map(rowToCompetition);

    // Load joined user IDs from competition_entries for each competition
    if (competitions.length > 0) {
      const ids = competitions.map(c => c.id);
      const placeholders = ids.map(() => '?').join(',');
      const entries = await query<{ competition_id: number; user_id: number }>(
        `SELECT competition_id, user_id FROM competition_entries WHERE competition_id IN (${placeholders})`,
        ids
      );
      const byComp = new Map<number, number[]>();
      for (const e of entries.rows) {
        const list = byComp.get(e.competition_id) ?? [];
        list.push(e.user_id);
        byComp.set(e.competition_id, list);
      }
      for (const comp of competitions) {
        const userIds = byComp.get(comp.id) ?? [];
        comp.participants = userIds.map((uid, i) => ({
          rank: i + 1,
          tipsterId: uid,
          username: `user_${uid}`,
          displayName: `user_${uid}`,
          avatar: null,
          countryCode: null,
          winRate: 0,
          roi: 0,
          tips: 0,
          won: 0,
          points: 0,
          streak: 0,
          isVerified: false,
        }));
      }
    }

    g.__competitionsCache = competitions;
    g.__competitionsCacheAt = now;
    return competitions;
  } catch (e) {
    console.error('[competitions] DB read failed:', e);
    return g.__competitionsCache ?? [];
  }
}

/** Synchronous getter — returns cached data or empty array. Triggers async refresh in background. */
export function getCompetitions(): Competition[] {
  // Kick off a background refresh if cache is stale
  const now = Date.now();
  if (!g.__competitionsCache || !g.__competitionsCacheAt || now - g.__competitionsCacheAt >= CACHE_TTL_MS) {
    getCompetitionsAsync().catch(() => {});
  }
  return g.__competitionsCache ?? [];
}

export function getCompetitionBySlug(slug: string): Competition | undefined {
  return getCompetitions().find(c => c.slug === slug);
}

export async function getCompetitionBySlugAsync(slug: string): Promise<Competition | undefined> {
  const all = await getCompetitionsAsync();
  const found = all.find(c => c.slug === slug);
  // Lazy-seed the World Cup competition if it wasn't seeded yet (e.g. request
  // arrived before the 3-second instrumentation timeout fired).
  if (!found && slug === WC_COMP_SLUG) {
    await seedWorldCupCompetition();
    const refreshed = await getCompetitionsAsync();
    return refreshed.find(c => c.slug === slug);
  }
  return found;
}

export function getCompetitionById(id: number): Competition | undefined {
  return getCompetitions().find(c => c.id === id);
}

// ─── World Cup 2026 Seed ────────────────────────────────────────────────────

const WC_COMP_SLUG = 'world-cup-2026-tipster-challenge';

function buildWcCompetition(): Competition {
  return {
    id: 9000,
    slug: WC_COMP_SLUG,
    name: 'FIFA World Cup 2026 — Tipster Challenge',
    description: 'The ultimate tipster competition for the biggest football event on the planet. Predict every World Cup match from group stage to the final and top the leaderboard for a massive prize pool. Open to all Betcheza members — KES 200 entry fee, tips locked at kickoff.',
    type: 'special',
    status: 'upcoming',
    startDate: '2026-06-11',
    endDate: '2026-07-19',
    prizePool: 50000,
    currency: 'KES',
    entryFee: 200,
    maxParticipants: 10000,
    prizes: [
      { place: '🥇 1st',      amount: 20000 },
      { place: '🥈 2nd',      amount: 10000 },
      { place: '🥉 3rd',      amount: 5000  },
      { place: '4th–10th',    amount: 1500  },
      { place: '11th–50th',   amount: 250   },
    ],
    participants: [],
    rules: [
      'Entry fee: KES 200. All registered Betcheza members are eligible.',
      'Competition covers the full FIFA World Cup 2026 tournament: Group Stage (Jun 11–Jul 2), Round of 32 (Jul 4–7), Quarter-Finals (Jul 9–10), Semi-Finals (Jul 14–15), Third Place Play-Off (Jul 18), and Final (Jul 19).',
      'Submit a 1X2 tip for each match before its kickoff time. Tips submitted after kickoff are not counted.',
      'Correct result tips earn 3 points. Tips on matches with no submission score 0 points.',
      'Bonus: correctly predicting a draw earns +1 extra point (4 total). Correctly predicting the winning team in a knockout match earns +1 extra point (4 total).',
      'Tie-breaker 1: Total number of correct tips. Tie-breaker 2: Highest tip streak. Tie-breaker 3: Earliest registration date.',
      'Group Stage: 48 matches. Round of 32: 8 matches. Quarter-Finals: 4 matches. Semi-Finals: 2 matches. Third-Place Play-Off: 1 match. Final: 1 match. Total: 64 matches.',
      'Minimum 10 tips must be submitted across the tournament to qualify for prize payouts.',
      'Prizes are credited to Betcheza wallet within 48 hours of the Final (July 19, 2026).',
      'One account per participant. Multi-accounting or use of bots results in immediate disqualification.',
      'Betcheza reserves the right to amend rules in case of match postponements, cancellations, or schedule changes by FIFA.',
      'By entering, you agree to Betcheza terms and conditions and responsible gambling policy.',
    ],
    ruleConfig: [
      { type: 'min_tips',      value: 10,   label: 'Minimum 10 tips required to qualify for prizes', enforceable: true },
      { type: 'score_formula', value: '3 pts correct, +1 for draw/knockout correct pick',             label: 'Scoring: 3 pts per correct result; +1 bonus for correct draw or knockout winner', enforceable: false },
      { type: 'tiebreaker',    value: 'tips_count,streak,registration_date',                           label: 'Tie-breakers: correct tip count → longest streak → earliest registration', enforceable: false },
      { type: 'kickoff_only',                                                                          label: 'Tips must be placed before match kickoff', enforceable: true },
    ],
    sportFocus: 'football',
    leagueId: null,
    leagueName: 'FIFA World Cup 2026',
    roundBased: true,
    matchKickoffFrom: '2026-06-11T00:00:00',
    matchKickoffTo:   '2026-07-19T23:59:59',
    kickedUsers: [],
  };
}

/**
 * Seed the World Cup 2026 competition on startup.
 * — If a DB pool is available: inserts via addCompetition (idempotent — checks slug first).
 * — If no DB pool: injects directly into the in-memory cache so it's always visible.
 */
export async function seedWorldCupCompetition(): Promise<void> {
  try {
    const existing = await getCompetitionsAsync();
    const alreadyExists = existing.find(c => c.slug === WC_COMP_SLUG);

    // If it already exists in DB, sync the entry_fee to the current code value
    if (alreadyExists && getPool()) {
      if (alreadyExists.entryFee !== 200) {
        await execute(`UPDATE competitions SET entry_fee = 200 WHERE slug = ?`, [WC_COMP_SLUG]);
        invalidateCache();
        console.log('[competitions] World Cup 2026 entry_fee synced to 200 KES in DB');
      }
      return;
    }
    if (alreadyExists) return; // in-memory, nothing to do

    const pool = getPool();
    if (pool) {
      // DB available — persist properly
      const input: NewCompetitionInput = {
        name: 'FIFA World Cup 2026 — Tipster Challenge',
        description: buildWcCompetition().description,
        type: 'special',
        status: 'upcoming',
        startDate: '2026-06-11',
        endDate: '2026-07-19',
        prizePool: 50000,
        currency: 'KES',
        entryFee: 200,
        maxParticipants: 10000,
        prizes: buildWcCompetition().prizes,
        rules: buildWcCompetition().rules,
        ruleConfig: buildWcCompetition().ruleConfig,
        sportFocus: 'football',
        leagueId: null,
        leagueName: 'FIFA World Cup 2026',
        roundBased: true,
        matchKickoffFrom: '2026-06-11T00:00:00',
        matchKickoffTo:   '2026-07-19T23:59:59',
      };
      // Override slug to our canonical one
      const comp = await addCompetition(input);
      if (comp.slug !== WC_COMP_SLUG) {
        await execute(`UPDATE competitions SET slug = ? WHERE id = ?`, [WC_COMP_SLUG, comp.id]);
        invalidateCache();
      }
      console.log('[competitions] World Cup 2026 competition seeded to DB');
    } else {
      // No DB — inject into in-memory cache
      if (!g.__competitionsCache) g.__competitionsCache = [];
      g.__competitionsCache.unshift(buildWcCompetition());
      g.__competitionsCacheAt = Date.now();
      console.log('[competitions] World Cup 2026 competition seeded to memory (no DB)');
    }
  } catch (e) {
    console.warn('[competitions] World Cup 2026 seed failed:', e);
  }
}

export async function getCompetitionByIdAsync(id: number): Promise<Competition | undefined> {
  const all = await getCompetitionsAsync();
  return all.find(c => c.id === id);
}

// ─── Write functions ────────────────────────────────────────────────────────

export interface NewCompetitionInput {
  name: string;
  description: string;
  type: Competition['type'];
  status?: Competition['status'];
  startDate: string;
  endDate: string;
  prizePool: number;
  currency?: string;
  entryFee: number;
  maxParticipants: number;
  prizes?: Array<{ place: string; amount: number }>;
  rules?: string[];
  ruleConfig?: RuleConfig[];
  sportFocus: string;
  leagueId?: number | null;
  leagueName?: string | null;
  roundBased?: boolean;
  matchKickoffFrom?: string | null;
  matchKickoffTo?: string | null;
}

export async function addCompetition(input: NewCompetitionInput): Promise<Competition> {
  await ensureCompetitionColumns();

  const allExisting = await getCompetitionsAsync();
  const baseSlug = slugify(input.name) || `competition-${Date.now()}`;
  let slug = baseSlug;
  let n = 2;
  while (allExisting.some(c => c.slug === slug)) {
    slug = `${baseSlug}-${n++}`;
  }

  const prizes = input.prizes && input.prizes.length > 0 ? input.prizes : [
    { place: '1st', amount: Math.round((Number(input.prizePool) || 0) * 0.5) },
    { place: '2nd', amount: Math.round((Number(input.prizePool) || 0) * 0.3) },
    { place: '3rd', amount: Math.round((Number(input.prizePool) || 0) * 0.15) },
    { place: '4-10th', amount: Math.round((Number(input.prizePool) || 0) * 0.05 / 7) },
  ];
  const rules = input.rules && input.rules.length > 0 ? input.rules : [
    'Tips must be placed before kickoff.',
    'Tie-breaker is total ROI.',
  ];

  // Map 'completed' → 'finished' for DB enum
  const dbStatus = input.status === 'completed' ? 'finished' : (input.status || 'upcoming');

  const result = await execute(`
    INSERT INTO competitions
      (name, description, start_date, end_date, prize_pool, entry_fee, max_participants,
       status, rules, type, sport_focus, league_id, league_name, currency,
       prize_breakdown, slug, match_kickoff_from, match_kickoff_to, round_based,
       rule_config, kicked_users)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.name,
    input.description || '',
    input.startDate,
    input.endDate,
    Number(input.prizePool) || 0,
    Number(input.entryFee) || 0,
    Number(input.maxParticipants) || 100,
    dbStatus,
    JSON.stringify(rules),
    input.type,
    input.sportFocus || 'multi-sport',
    input.leagueId ?? null,
    input.leagueName ?? null,
    input.currency || 'KES',
    JSON.stringify(prizes),
    slug,
    input.matchKickoffFrom ?? null,
    input.matchKickoffTo ?? null,
    input.roundBased ? 1 : 0,
    input.ruleConfig ? JSON.stringify(input.ruleConfig) : null,
    null,
  ]);

  invalidateCache();
  const comp = await getCompetitionByIdAsync(result.insertId);
  if (!comp) throw new Error('Failed to load competition after insert');
  return comp;
}

export async function updateCompetition(id: number, patch: Partial<NewCompetitionInput>): Promise<Competition | null> {
  await ensureCompetitionColumns();

  const cur = await getCompetitionByIdAsync(id);
  if (!cur) return null;

  const prizes = patch.prizes && patch.prizes.length > 0 ? patch.prizes : cur.prizes;
  const rules = patch.rules && patch.rules.length > 0 ? patch.rules : cur.rules;
  const rawStatus = patch.status !== undefined ? patch.status : cur.status;
  const dbStatus = rawStatus === 'completed' ? 'finished' : rawStatus;

  const pName        = patch.name ?? cur.name;
  const pDesc        = patch.description ?? cur.description;
  const pStart       = patch.startDate ?? cur.startDate;
  const pEnd         = patch.endDate ?? cur.endDate;
  const pPool        = patch.prizePool !== undefined ? Number(patch.prizePool) : cur.prizePool;
  const pFee         = patch.entryFee !== undefined ? Number(patch.entryFee) : cur.entryFee;
  const pMax         = patch.maxParticipants !== undefined ? Number(patch.maxParticipants) : cur.maxParticipants;
  const pType        = patch.type ?? cur.type;
  const pSport       = patch.sportFocus ?? cur.sportFocus;
  const pLeagueId    = patch.leagueId !== undefined ? (patch.leagueId ?? null) : (cur.leagueId ?? null);
  const pLeagueName  = patch.leagueName !== undefined ? (patch.leagueName ?? null) : (cur.leagueName ?? null);
  const pCurrency    = patch.currency ?? cur.currency;
  const pKickFrom    = patch.matchKickoffFrom !== undefined ? (patch.matchKickoffFrom ?? null) : (cur.matchKickoffFrom ?? null);
  const pKickTo      = patch.matchKickoffTo !== undefined ? (patch.matchKickoffTo ?? null) : (cur.matchKickoffTo ?? null);
  const pRoundBased  = patch.roundBased !== undefined ? (patch.roundBased ? 1 : 0) : (cur.roundBased ? 1 : 0);
  const pRuleConfig  = patch.ruleConfig ? JSON.stringify(patch.ruleConfig) : (cur.ruleConfig ? JSON.stringify(cur.ruleConfig) : null);

  const upd = await execute(`
    UPDATE competitions SET
      name = ?,
      description = ?,
      start_date = ?,
      end_date = ?,
      prize_pool = ?,
      entry_fee = ?,
      max_participants = ?,
      status = ?,
      rules = ?,
      type = ?,
      sport_focus = ?,
      league_id = ?,
      league_name = ?,
      currency = ?,
      prize_breakdown = ?,
      match_kickoff_from = ?,
      match_kickoff_to = ?,
      round_based = ?,
      rule_config = ?
    WHERE id = ?
  `, [
    pName, pDesc, pStart, pEnd, pPool, pFee, pMax,
    dbStatus, JSON.stringify(rules), pType, pSport, pLeagueId, pLeagueName,
    pCurrency, JSON.stringify(prizes), pKickFrom, pKickTo, pRoundBased, pRuleConfig,
    id,
  ]);

  let realId = id;

  if (upd.affectedRows === 0) {
    // Competition only exists in memory (e.g. seeded before DB was available).
    // Insert it into DB now so the edit is persisted and future edits work correctly.
    const ins = await execute(`
      INSERT INTO competitions
        (name, description, start_date, end_date, prize_pool, entry_fee, max_participants,
         status, rules, type, sport_focus, league_id, league_name, currency,
         prize_breakdown, slug, match_kickoff_from, match_kickoff_to, round_based, rule_config, kicked_users)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `, [
      pName, pDesc, pStart, pEnd, pPool, pFee, pMax,
      dbStatus, JSON.stringify(rules), pType, pSport, pLeagueId, pLeagueName,
      pCurrency, JSON.stringify(prizes), cur.slug, pKickFrom, pKickTo, pRoundBased, pRuleConfig,
    ]);
    realId = ins.insertId;
  }

  invalidateCache();
  return (await getCompetitionByIdAsync(realId)) ?? null;
}

export async function deleteCompetition(id: number): Promise<boolean> {
  const result = await execute(`DELETE FROM competitions WHERE id = ?`, [id]);
  if (result.affectedRows === 0) return false;
  await execute(`DELETE FROM competition_entries WHERE competition_id = ?`, [id]);
  invalidateCache();
  return true;
}

// ─── Join / membership ─────────────────────────────────────────────────────

export type JoinResult =
  | { ok: true; alreadyJoined: boolean; participantCount: number }
  | { ok: false; error: string };

export async function joinCompetition(competitionId: number, userId: number, _userName: string): Promise<JoinResult> {
  const comp = await getCompetitionByIdAsync(competitionId);
  if (!comp) return { ok: false, error: 'Competition not found' };
  if (comp.status === 'completed') return { ok: false, error: 'Competition has already ended' };

  // Check if already joined
  const existing = await query<{ id: number }>(
    `SELECT id FROM competition_entries WHERE competition_id = ? AND user_id = ?`,
    [competitionId, userId]
  );
  if (existing.rows.length > 0) {
    return { ok: true, alreadyJoined: true, participantCount: comp.participants.length };
  }

  const countResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM competition_entries WHERE competition_id = ?`,
    [competitionId]
  );
  const currentCount = Number(countResult.rows[0]?.cnt ?? 0);
  if (currentCount >= comp.maxParticipants) {
    return { ok: false, error: 'Competition is full' };
  }

  await execute(
    `INSERT INTO competition_entries (competition_id, user_id) VALUES (?, ?)`,
    [competitionId, userId]
  );

  invalidateCache();
  return { ok: true, alreadyJoined: false, participantCount: currentCount + 1 };
}

export async function hasUserJoined(competitionId: number, userId: number): Promise<boolean> {
  const result = await query<{ id: number }>(
    `SELECT id FROM competition_entries WHERE competition_id = ? AND user_id = ?`,
    [competitionId, userId]
  );
  return result.rows.length > 0;
}

export async function getJoinedUserIds(competitionId: number): Promise<number[]> {
  const result = await query<{ user_id: number }>(
    `SELECT user_id FROM competition_entries WHERE competition_id = ?`,
    [competitionId]
  );
  return result.rows.map(r => r.user_id);
}

export async function kickUserFromCompetition(competitionId: number, userId: number): Promise<boolean> {
  const comp = await getCompetitionByIdAsync(competitionId);
  if (!comp) return false;

  await execute(
    `DELETE FROM competition_entries WHERE competition_id = ? AND user_id = ?`,
    [competitionId, userId]
  );

  // Track in kicked_users JSON column
  const kicked = [...(comp.kickedUsers ?? [])];
  if (!kicked.includes(userId)) kicked.push(userId);
  await execute(
    `UPDATE competitions SET kicked_users = ? WHERE id = ?`,
    [JSON.stringify(kicked), competitionId]
  );

  invalidateCache();
  return true;
}

// ─── Settlement / prize payout ─────────────────────────────────────────────

interface SettlementRecord {
  paidAt: string;
  payouts: Array<{
    rank: number;
    place: string;
    userId: number;
    username: string;
    amount: number;
    isFakeTipster: boolean;
  }>;
  totalPaid: number;
}

const settlements: Record<number, SettlementRecord> = {};

export function getSettlement(competitionId: number): SettlementRecord | null {
  return settlements[competitionId] || null;
}

export function computePayouts(competitionId: number): SettlementRecord['payouts'] {
  const comp = getCompetitionById(competitionId);
  if (!comp) return [];
  const ranked = [...comp.participants].sort((a, b) => b.points - a.points || b.roi - a.roi);
  const payouts: SettlementRecord['payouts'] = [];
  let cursor = 0;
  for (const prize of comp.prizes) {
    if (!prize.amount || prize.amount <= 0) continue;
    const m = prize.place.match(/^(\d+)(?:[-–](\d+))?/);
    if (!m) {
      const slot = ranked[cursor++];
      if (slot) payouts.push({
        rank: slot.rank,
        place: prize.place,
        userId: slot.tipsterId,
        username: slot.username,
        amount: prize.amount,
        isFakeTipster: slot.tipsterId >= 1000,
      });
      continue;
    }
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    for (let r = start; r <= end; r++) {
      const slot = ranked[r - 1];
      if (!slot) break;
      payouts.push({
        rank: r,
        place: prize.place,
        userId: slot.tipsterId,
        username: slot.username,
        amount: prize.amount,
        isFakeTipster: slot.tipsterId >= 1000,
      });
    }
    cursor = end;
  }
  return payouts;
}

export async function settleCompetition(competitionId: number): Promise<{
  ok: boolean;
  alreadySettled: boolean;
  toCredit: SettlementRecord['payouts'];
  competition: Competition | null;
}> {
  const comp = await getCompetitionByIdAsync(competitionId);
  if (!comp) return { ok: false, alreadySettled: false, toCredit: [], competition: null };

  if (settlements[competitionId]) {
    return { ok: true, alreadySettled: true, toCredit: [], competition: comp };
  }

  const payouts = computePayouts(competitionId);
  const toCredit = payouts.filter(p => !p.isFakeTipster);
  const totalPaid = toCredit.reduce((a, p) => a + p.amount, 0);

  settlements[competitionId] = { paidAt: new Date().toISOString(), payouts, totalPaid };

  // Mark as finished in DB
  await execute(
    `UPDATE competitions SET status = 'finished' WHERE id = ?`,
    [competitionId]
  );
  invalidateCache();

  return { ok: true, alreadySettled: false, toCredit, competition: comp };
}

// ─── Public summary (used by API routes) ───────────────────────────────────

export function publicCompetitionSummary(c: Competition) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    type: c.type,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    prizePool: c.prizePool,
    currency: c.currency,
    entryFee: c.entryFee,
    maxParticipants: c.maxParticipants,
    currentParticipants: c.participants.length,
    leagueId: c.leagueId ?? null,
    leagueName: c.leagueName ?? null,
    sportFocus: c.sportFocus,
    roundBased: c.roundBased ?? false,
    matchKickoffFrom: c.matchKickoffFrom ?? null,
    matchKickoffTo: c.matchKickoffTo ?? null,
    prizes: c.prizes,
    topThree: c.participants.slice(0, 3).map(p => ({
      rank: p.rank,
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar,
    })),
  };
}
