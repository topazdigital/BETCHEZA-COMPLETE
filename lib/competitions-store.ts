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
import { getFakeTipsters, type FakeTipster } from './fake-tipsters';

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
  sportFocus: string;
}

const NOW = () => Date.now();
const DAY = 24 * 60 * 60 * 1000;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function pickN<T>(arr: T[], n: number, seed: number): T[] {
  // Deterministic pick using simple LCG
  const out: T[] = [];
  const used = new Set<number>();
  let s = seed >>> 0;
  while (out.length < n && used.size < arr.length) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const idx = s % arr.length;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(arr[idx]);
    }
  }
  return out;
}

function buildParticipants(seed: number, count: number, multiplier: number): CompetitionParticipant[] {
  const all = getFakeTipsters();
  const picked = pickN(all, Math.min(count, all.length), seed);
  // Sort by composite score (winRate + roi) for deterministic ranking.
  const ranked = picked
    .map(t => ({
      t,
      score: t.winRate * 1.2 + t.roi * 2 + t.streak * 0.5,
    }))
    .sort((a, b) => b.score - a.score);
  return ranked.map(({ t }, i) => {
    const tips = Math.max(3, Math.round(t.totalTips * multiplier));
    const won = Math.round(tips * (t.winRate / 100));
    const points = Math.round(won * 12 + (tips - won) * -3 + t.streak * 5);
    return {
      rank: i + 1,
      tipsterId: t.id,
      username: t.username,
      displayName: t.displayName,
      avatar: t.avatar,
      countryCode: t.countryCode,
      winRate: t.winRate,
      roi: t.roi,
      tips,
      won,
      points,
      streak: t.streak,
      isVerified: t.isVerified,
    };
  });
}

// ─── Persistence ──────────────────────────────────────────────────────
// Admin-created competitions and join records persist across restarts in
// .local/state/competitions.json (mirroring auto-tips-store).

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

let _seeded: Competition[] | null = null;

function seedCompetitions(): Competition[] {
  const t0 = NOW();
  const defs: Array<Omit<Competition, 'participants' | 'slug'> & { _seed: number; _mult: number }> = [
    {
      id: 1,
      name: 'Weekly Tipster Challenge',
      description: 'Open competition for all football tipsters. Top performers by ROI win the pot.',
      type: 'weekly',
      status: 'active',
      startDate: new Date(t0 - 2 * DAY).toISOString(),
      endDate: new Date(t0 + 5 * DAY).toISOString(),
      prizePool: 50000,
      currency: 'KES',
      entryFee: 100,
      maxParticipants: 500,
      prizes: [
        { place: '1st', amount: 20000 },
        { place: '2nd', amount: 12000 },
        { place: '3rd', amount: 8000 },
        { place: '4-10th', amount: 1428 },
      ],
      rules: [
        'Minimum 5 tips during the contest window.',
        'Tips must be placed at least 30 minutes before kickoff.',
        'Average odds must be ≥ 1.50.',
      ],
      sportFocus: 'football',
      _seed: 17,
      _mult: 0.18,
    },
    {
      id: 2,
      name: 'Monthly Masters League',
      description: 'The ultimate monthly competition for serious tipsters across all sports.',
      type: 'monthly',
      status: 'active',
      startDate: new Date(t0 - 5 * DAY).toISOString(),
      endDate: new Date(t0 + 25 * DAY).toISOString(),
      prizePool: 200000,
      currency: 'KES',
      entryFee: 500,
      maxParticipants: 200,
      prizes: [
        { place: '1st', amount: 80000 },
        { place: '2nd', amount: 50000 },
        { place: '3rd', amount: 30000 },
        { place: '4-10th', amount: 5714 },
      ],
      rules: [
        'Minimum 25 tips across the month.',
        'Tracked across football, basketball, tennis, and esports.',
        'Verified tipsters earn a 10% point bonus.',
      ],
      sportFocus: 'multi-sport',
      _seed: 91,
      _mult: 0.55,
    },
    {
      id: 3,
      name: 'Daily Football Showdown',
      description: 'Fast-paced 24-hour contest for football tippers. Highest win-rate takes the day.',
      type: 'daily',
      status: 'active',
      startDate: new Date(t0 - 4 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(t0 + 20 * 60 * 60 * 1000).toISOString(),
      prizePool: 10000,
      currency: 'KES',
      entryFee: 50,
      maxParticipants: 250,
      prizes: [
        { place: '1st', amount: 5000 },
        { place: '2nd', amount: 3000 },
        { place: '3rd', amount: 2000 },
        { place: '4-10th', amount: 0 },
      ],
      rules: [
        'Minimum 3 tips during the 24-hour window.',
        'No void/postponed bets count.',
        'Tie-breaker is total ROI.',
      ],
      sportFocus: 'football',
      _seed: 251,
      _mult: 0.05,
    },
    {
      id: 4,
      name: 'Premier League Weekly',
      description: 'EPL-only weekly competition: who can call the Big-6 fixtures best?',
      type: 'weekly',
      status: 'active',
      startDate: new Date(t0 - 1 * DAY).toISOString(),
      endDate: new Date(t0 + 6 * DAY).toISOString(),
      prizePool: 25000,
      currency: 'KES',
      entryFee: 0,
      maxParticipants: 1000,
      prizes: [
        { place: '1st', amount: 12000 },
        { place: '2nd', amount: 7000 },
        { place: '3rd', amount: 4000 },
        { place: '4-10th', amount: 285 },
      ],
      rules: [
        'Free to enter.',
        'Only Premier League fixtures count.',
        'Maximum 10 tips per gameweek.',
      ],
      sportFocus: 'football',
      _seed: 401,
      _mult: 0.12,
    },
    {
      id: 5,
      name: 'Champions League Outright Special',
      description: 'Long-form contest tracking accuracy across the entire Champions League knockout phase.',
      type: 'special',
      status: 'upcoming',
      startDate: new Date(t0 + 7 * DAY).toISOString(),
      endDate: new Date(t0 + 60 * DAY).toISOString(),
      prizePool: 150000,
      currency: 'KES',
      entryFee: 250,
      maxParticipants: 500,
      prizes: [
        { place: '1st', amount: 75000 },
        { place: '2nd', amount: 40000 },
        { place: '3rd', amount: 20000 },
        { place: '4-10th', amount: 2142 },
      ],
      rules: [
        'Tips on UEFA Champions League knockout matches only.',
        'Both team-to-win and over/under markets accepted.',
        'Bonus 50 points for correctly calling the eventual finalists.',
      ],
      sportFocus: 'football',
      _seed: 511,
      _mult: 0.32,
    },
  ];

  return defs.map(d => {
    const { _seed, _mult, ...rest } = d;
    const slug = slugify(d.name);
    const targetParticipants = Math.min(d.maxParticipants, 75);
    return {
      ...rest,
      slug,
      participants: buildParticipants(_seed, targetParticipants, _mult),
    } satisfies Competition;
  });
}

export function getCompetitions(): Competition[] {
  if (!_seeded) _seeded = seedCompetitions();
  return [..._seeded, ...state.added];
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
  sportFocus: string;
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
    sportFocus: input.sportFocus || 'multi-sport',
    // Seed with a small set of fake-tipster participants so the leaderboard
    // is never empty when admins create a brand-new competition.
    participants: buildParticipants(id * 31 + 7, Math.min(40, Math.max(10, Math.floor((Number(input.maxParticipants) || 100) / 5))), 0.15),
  };
  state.added.push(comp);
  persistState();
  return comp;
}

export function updateCompetition(id: number, patch: Partial<NewCompetitionInput>): Competition | null {
  const idx = state.added.findIndex(c => c.id === id);
  if (idx < 0) return null; // seeded ones aren't editable
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
    prizes: c.prizes,
    sportFocus: c.sportFocus,
    topThree: c.participants.slice(0, 3).map(p => ({
      rank: p.rank,
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar,
    })),
  };
}
