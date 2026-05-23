// ─────────────────────────────────────────────────────────────────────
// Tipster competitions store.
//
// Competitions are seeded deterministically from the fake-tipster
// catalogue so leaderboards always have content. They persist in
// memory for the life of the process, with hooks for future MySQL
// persistence (table is created lazily if DATABASE_URL exists).
// ─────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

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

/**
 * Structured rule configuration for auto-enforcement.
 * Each rule has a type + optional numeric value + display label.
 * enforceable = true rules trigger violation checks (kick + email).
 */
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
  /** Structured rule configs used for auto-enforcement (kick + email on violation). */
  ruleConfig?: RuleConfig[];
  sportFocus: string;
  /** Specific league ID (e.g. 1 = Premier League). Null = general / all leagues. */
  leagueId?: number | null;
  /** Display name of the detected league (e.g. "Premier League"). */
  leagueName?: string | null;
  /** Auto-set to true when endDate is derived from round end date */
  roundBased?: boolean;
  /**
   * Optional match-kickoff window filter.
   * When set, only tips on matches whose kickoff falls within this range count.
   * Use this to restrict a competition to a specific match round / gameweek.
   * ISO string (e.g. "2026-05-25T15:00:00.000Z")
   */
  matchKickoffFrom?: string | null;
  matchKickoffTo?: string | null;
  /** User IDs kicked for rule violations */
  kickedUsers?: number[];
}

const NOW = () => Date.now();
const DAY = 24 * 60 * 60 * 1000;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ─── Persistence ──────────────────────────────────────────────────────
// Admin-created competitions persist across restarts in
// .local/state/competitions.json

const STATE_FILE = path.join(process.cwd(), '.local', 'state', 'competitions.json');

interface PersistedState {
  // Competitions added by admin (overlay on top of seeded ones)
  added: Competition[];
  // Per-competition list of joined human-user IDs
  joinedByCompetition: Record<number, number[]>;
}

const g = globalThis as { __competitionsState?: PersistedState };
g.__competitionsState = g.__competitionsState || { added: [], joinedByCompetition: {} };
const state = g.__competitionsState;

function ensureDir(p: string) {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
}

let _stateLoaded = false;
function loadState() {
  if (_stateLoaded) return;
  _stateLoaded = true;
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as PersistedState;
    state.added = Array.isArray(raw.added) ? raw.added : [];
    state.joinedByCompetition = raw.joinedByCompetition || {};
  } catch (e) {
    console.warn('[competitions] load failed', e);
  }
}
loadState();

function persistState() {
  try {
    ensureDir(STATE_FILE);
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {
    console.warn('[competitions] persist failed', e);
  }
}

export function getCompetitions(): Competition[] {
  return [...state.added];
}

export function getCompetitionBySlug(slug: string): Competition | undefined {
  return getCompetitions().find(c => c.slug === slug);
}

export function getCompetitionById(id: number): Competition | undefined {
  return getCompetitions().find(c => c.id === id);
}

// ─── Admin & user mutations ───────────────────────────────────────────

function nextId(): number {
  const all = getCompetitions();
  return Math.max(0, ...all.map(c => c.id)) + 1;
}

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
  /** Structured rule configs for auto-enforcement (kick + email on violation). */
  ruleConfig?: RuleConfig[];
  sportFocus: string;
  /** Detected or overridden league ID (null = general competition) */
  leagueId?: number | null;
  /** Display name of the specific league this competition tracks */
  leagueName?: string | null;
  /** True when the end date was auto-derived from the last match of the round */
  roundBased?: boolean;
  /**
   * Optional match-kickoff window: only tips on matches whose kickoff falls
   * within [matchKickoffFrom, matchKickoffTo] contribute to scoring.
   * Ideal for single-round / final-day competitions (e.g. GW38 only).
   */
  matchKickoffFrom?: string | null;
  matchKickoffTo?: string | null;
}

export function addCompetition(input: NewCompetitionInput): Competition {
  const id = nextId();
  const baseSlug = slugify(input.name) || `competition-${id}`;
  // Avoid slug collisions
  let slug = baseSlug;
  let n = 2;
  while (getCompetitions().some(c => c.slug === slug)) {
    slug = `${baseSlug}-${n++}`;
  }
  const comp: Competition = {
    id,
    slug,
    name: input.name,
    description: input.description || '',
    type: input.type,
    status: input.status || 'upcoming',
    startDate: input.startDate,
    endDate: input.endDate,
    leagueId: input.leagueId ?? null,
    leagueName: input.leagueName ?? null,
    roundBased: input.roundBased ?? false,
    matchKickoffFrom: input.matchKickoffFrom ?? null,
    matchKickoffTo: input.matchKickoffTo ?? null,
    prizePool: Number(input.prizePool) || 0,
    currency: input.currency || 'KES',
    entryFee: Number(input.entryFee) || 0,
    maxParticipants: Number(input.maxParticipants) || 100,
    prizes: input.prizes && input.prizes.length > 0 ? input.prizes : [
      { place: '1st', amount: Math.round((Number(input.prizePool) || 0) * 0.5) },
      { place: '2nd', amount: Math.round((Number(input.prizePool) || 0) * 0.3) },
      { place: '3rd', amount: Math.round((Number(input.prizePool) || 0) * 0.15) },
      { place: '4-10th', amount: Math.round((Number(input.prizePool) || 0) * 0.05 / 7) },
    ],
    rules: input.rules && input.rules.length > 0 ? input.rules : [
      'Tips must be placed before kickoff.',
      'Tie-breaker is total ROI.',
    ],
    ruleConfig: input.ruleConfig && input.ruleConfig.length > 0 ? input.ruleConfig : undefined,
    sportFocus: input.sportFocus || 'multi-sport',
    participants: [],
  };
  state.added.push(comp);
  persistState();
  return comp;
}

export function updateCompetition(id: number, patch: Partial<NewCompetitionInput>): Competition | null {
  const idx = state.added.findIndex(c => c.id === id);
  if (idx < 0) return null;
  const cur = state.added[idx];
  const updated: Competition = {
    ...cur,
    ...patch,
    id: cur.id,
    slug: cur.slug,
    participants: cur.participants,
    prizePool: patch.prizePool !== undefined ? Number(patch.prizePool) : cur.prizePool,
    entryFee: patch.entryFee !== undefined ? Number(patch.entryFee) : cur.entryFee,
    maxParticipants: patch.maxParticipants !== undefined ? Number(patch.maxParticipants) : cur.maxParticipants,
    currency: patch.currency || cur.currency,
    status: (patch.status as Competition['status']) || cur.status,
    type: (patch.type as Competition['type']) || cur.type,
    prizes: patch.prizes && patch.prizes.length > 0 ? patch.prizes : cur.prizes,
    rules: patch.rules && patch.rules.length > 0 ? patch.rules : cur.rules,
    matchKickoffFrom: patch.matchKickoffFrom !== undefined ? (patch.matchKickoffFrom ?? null) : cur.matchKickoffFrom,
    matchKickoffTo: patch.matchKickoffTo !== undefined ? (patch.matchKickoffTo ?? null) : cur.matchKickoffTo,
  };
  state.added[idx] = updated;
  persistState();
  return updated;
}

export function deleteCompetition(id: number): boolean {
  const before = state.added.length;
  state.added = state.added.filter(c => c.id !== id);
  if (state.added.length === before) return false;
  delete state.joinedByCompetition[id];
  persistState();
  return true;
}

export type JoinResult =
  | { ok: true; alreadyJoined: boolean; participantCount: number }
  | { ok: false; error: string };

export function joinCompetition(competitionId: number, userId: number, userName: string): JoinResult {
  const comp = getCompetitionById(competitionId);
  if (!comp) return { ok: false, error: 'Competition not found' };
  if (comp.status === 'completed') return { ok: false, error: 'Competition has already ended' };

  const joined = state.joinedByCompetition[competitionId] || [];
  if (joined.includes(userId)) {
    return { ok: true, alreadyJoined: true, participantCount: comp.participants.length };
  }
  if (comp.participants.length >= comp.maxParticipants) {
    return { ok: false, error: 'Competition is full' };
  }

  // Add the human user as a real participant on top of the fake leaderboard.
  comp.participants.push({
    rank: comp.participants.length + 1,
    tipsterId: userId,
    username: userName,
    displayName: userName,
    avatar: null,
    countryCode: null,
    winRate: 0,
    roi: 0,
    tips: 0,
    won: 0,
    points: 0,
    streak: 0,
    isVerified: false,
  });
  state.joinedByCompetition[competitionId] = [...joined, userId];
  persistState();
  return { ok: true, alreadyJoined: false, participantCount: comp.participants.length };
}

export function hasUserJoined(competitionId: number, userId: number): boolean {
  return (state.joinedByCompetition[competitionId] || []).includes(userId);
}

/** Returns all real user IDs that have joined a competition. */
export function getJoinedUserIds(competitionId: number): number[] {
  return [...(state.joinedByCompetition[competitionId] || [])];
}

/**
 * Kick a user from a competition for a rule violation.
 * Removes them from the joined list and adds to kickedUsers array.
 */
export function kickUserFromCompetition(
  competitionId: number,
  userId: number,
): boolean {
  const comp = getCompetitionById(competitionId);
  if (!comp) return false;

  // Remove from join list
  const joinList = state.joinedByCompetition[competitionId] || [];
  state.joinedByCompetition[competitionId] = joinList.filter(id => id !== userId);

  // Track kicked users
  if (!comp.kickedUsers) comp.kickedUsers = [];
  if (!comp.kickedUsers.includes(userId)) comp.kickedUsers.push(userId);

  // Also remove from participant list if present
  const idx = comp.participants.findIndex(p => p.tipsterId === userId);
  if (idx >= 0) comp.participants.splice(idx, 1);

  persistState();
  return true;
}

// ─── Settlement / prize payout ────────────────────────────────────────
// Marks a competition as `completed`, records who has been paid (so we
// never double-pay) and returns the list of (userId, amount) tuples to
// credit. The actual wallet credit is performed by the admin route so
// that this store stays free of cross-cutting wallet imports.

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

/**
 * Returns the prize pay-outs for the current leaderboard order. Does NOT
 * mutate any wallet — the caller (admin route) is responsible for that.
 * Each `prizes[]` row is matched to as many participants as the place
 * label implies (e.g. "4-10th" → 7 participants starting at rank 4).
 */
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
      // Single-place "1st" fallback by ordinal
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

/**
 * Records a settlement (status → completed, store payouts). Returns the
 * payouts that should now be credited to real (non-fake) user wallets.
 * Idempotent: a second call returns an empty list.
 */
export function settleCompetition(competitionId: number): {
  ok: boolean;
  alreadySettled: boolean;
  toCredit: SettlementRecord['payouts'];
  competition: Competition | null;
} {
  const comp = getCompetitionById(competitionId);
  if (!comp) return { ok: false, alreadySettled: false, toCredit: [], competition: null };

  if (settlements[competitionId]) {
    return {
      ok: true,
      alreadySettled: true,
      toCredit: [],
      competition: comp,
    };
  }

  const payouts = computePayouts(competitionId);
  // Only real human users get credited (fake tipsters have ids ≥ 1000).
  const toCredit = payouts.filter(p => !p.isFakeTipster);
  const totalPaid = toCredit.reduce((a, p) => a + p.amount, 0);

  settlements[competitionId] = {
    paidAt: new Date().toISOString(),
    payouts,
    totalPaid,
  };

  // Mark the competition as completed.
  comp.status = 'completed';
  // Persist the status change for admin-added competitions
  const idx = state.added.findIndex(c => c.id === competitionId);
  if (idx >= 0) {
    state.added[idx] = comp;
    persistState();
  }

  return { ok: true, alreadySettled: false, toCredit, competition: comp };
}

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
