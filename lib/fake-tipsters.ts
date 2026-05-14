// ─────────────────────────────────────────────────────────────────────
// Fake-tipster catalogue.
//
// We seed the platform with ~100 realistic-looking tipster accounts so the
// site never feels empty (popular matches always have action). The accounts
// are flagged `is_fake = true` and that flag is ONLY visible inside the
// admin panel — regular users see them as ordinary tipsters.
//
// Admins can generate more (or wipe and reseed) from the admin tipsters page.
// A small cron-style endpoint at /api/cron/auto-tips quietly drips new tips
// into upcoming matches under these accounts to keep the feed lively.
// ─────────────────────────────────────────────────────────────────────

export interface FakeTipster {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  countryCode: string;
  specialties: string[];
  // Stats — recomputed when the admin "regenerates"
  winRate: number;
  totalTips: number;
  wonTips: number;
  lostTips: number;
  pendingTips: number;
  avgOdds: number;
  roi: number;
  streak: number;
  followersCount: number;
  isPro: boolean;
  subscriptionPrice: number | null;
  isVerified: boolean;
  joinedAt: string;
  isFake: true;
  /** True when this tipster is currently "online" — refreshed every 3 minutes */
  isOnline: boolean;
  /** ISO timestamp of last simulated activity */
  lastSeen: string;
}

const FIRST_NAMES = [
  'Brian', 'Kevin', 'James', 'Daniel', 'Samuel', 'David', 'John', 'Peter', 'Mark', 'Joseph',
  'Michael', 'Anthony', 'Patrick', 'Stephen', 'Charles', 'Felix', 'Victor', 'Emmanuel', 'George', 'Dennis',
  'Eric', 'Ian', 'Collins', 'Frank', 'Henry', 'Edwin', 'Vincent', 'Hassan', 'Ali', 'Omar',
  'Ibrahim', 'Yusuf', 'Mohammed', 'Tunde', 'Chinedu', 'Kwame', 'Kofi', 'Tomas', 'Diego', 'Carlos',
  'Sofia', 'Maria', 'Aisha', 'Wanjiru', 'Fatuma', 'Akinyi', 'Cynthia', 'Linda', 'Joy', 'Grace',
  'Mercy', 'Faith', 'Ruth', 'Rebecca', 'Amina', 'Zara', 'Esther', 'Anita', 'Brenda',
];

const LAST_NAMES = [
  'Otieno', 'Mwangi', 'Kimani', 'Kamau', 'Wanjiru', 'Njoroge', 'Achieng', 'Owino', 'Kiprop', 'Kipchoge',
  'Mensah', 'Asante', 'Owusu', 'Boateng', 'Sarpong', 'Adedayo', 'Adekunle', 'Okafor', 'Eze', 'Onyeka',
  'Banda', 'Phiri', 'Mhlanga', 'Dlamini', 'Khoza', 'Sithole', 'Mabhena', 'Hassan', 'Salim', 'Said',
  'Mohamed', 'El-Sayed', 'Mahmoud', 'Silva', 'Santos', 'Rodriguez', 'Gomes', 'Pereira', 'Costa', 'Ferreira',
  'Smith', 'Brown', 'Walker', 'Taylor', 'Wilson', 'Harris', 'Lewis', 'Hall', 'Young', 'King',
];

const HANDLE_SUFFIXES = ['254', '256', '255', 'ke', 'gh', 'ng', 'tips', 'bet', 'pro', 'x', '_', '254', '7', '10'];

const HANDLE_PREFIXES = [
  'GoalMachine', 'AceTips', 'CornerKing', 'OverGuru', 'BTTSPro', 'AHSniper', 'KPLProphet',
  'EPLOracle', 'LaLigaLab', 'SerieAStats', 'BundesData', 'CAFInsider', 'CombosKing',
  'SafeBets', 'ValueHunter', 'FormReader', 'StatsBoss', 'PicksGod', 'OddsScout',
  'TipsmanPro', 'BankrollKing', 'SteamMover', 'LineHunter', 'FixtureKing', 'DerbyExpert',
  'TopTipper', 'WinningEdge', 'SharpEye', 'PunterPro', 'DraftKing',
];

const COUNTRIES = ['KE', 'NG', 'GH', 'TZ', 'UG', 'ZA', 'GB', 'ES', 'DE', 'IT', 'FR', 'BR', 'AR', 'PT'];

const BIOS = [
  'EPL & La Liga focus. Value over volume. 1–2% bankroll only.',
  'BTTS & Over 2.5 specialist. Charts > vibes.',
  'African football insider — KPL, GPL, NPFL. Local angles.',
  'Asian Handicap diehard. Closing-line value beats win rate.',
  'Corners & cards markets. Referee profiles + tempo data.',
  'HT/FT and combo lover. Higher variance, bigger pots.',
  'Bankroll-first tipster. No martingale, no chasing.',
  'Data > narratives. xG-driven Over/Under picks.',
  'Mid-week European football — Conference & Europa.',
  'Derby & rivalry games — discipline + cards angles.',
  'CAF Champions League / Confederation Cup specialist.',
  'Lower-league value hunter — Serie B, Championship, Bundesliga 2.',
  'NBA & NCAAB props on the side. Football is the bread.',
  'Outright markets, futures and player specials.',
  'Live in-play tipster. Pre-match angles, in-play execution.',
];

const SPECIALTIES_POOL = [
  ['Football', '1X2'],
  ['Football', 'Over/Under'],
  ['Football', 'BTTS'],
  ['Football', 'Asian Handicap'],
  ['African Football', '1X2'],
  ['Football', 'Corners'],
  ['Football', 'HT/FT'],
  ['Football', 'Cards'],
  ['Football', 'Combos'],
  ['Tennis', 'Match Winner'],
  ['Basketball', 'Spreads'],
  ['Football', 'Outrights'],
];

// Deterministic RNG so a given seed always produces the same fake set.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function buildHandle(rand: () => number, first: string, last: string, idx: number): string {
  const style = Math.floor(rand() * 4);
  let h = '';
  if (style === 0) h = pick(rand, HANDLE_PREFIXES);
  else if (style === 1) h = `${first}${last}`;
  else if (style === 2) h = `${first[0]}${last}`;
  else h = `${pick(rand, HANDLE_PREFIXES)}${pick(rand, HANDLE_SUFFIXES)}`;
  // Ensure uniqueness by appending the index when collisions are likely.
  if (style >= 1) h = `${h}${pick(rand, HANDLE_SUFFIXES)}`;
  h = h.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (h.length < 4) h = `${h}${idx}`;
  return h.slice(0, 20);
}

/**
 * Generate a deterministic catalogue of `count` fake tipsters.
 * Same seed → identical list, so admin "regenerate" is reproducible.
 */
export function generateFakeTipsters(count = 100, seed = 42, startId = 1000): FakeTipster[] {
  const rand = rng(seed);
  const out: FakeTipster[] = [];
  const usedHandles = new Set<string>();

  for (let i = 0; i < count; i++) {
    const first = pick(rand, FIRST_NAMES);
    const last = pick(rand, LAST_NAMES);
    let handle = buildHandle(rand, first, last, i);
    let bump = 1;
    while (usedHandles.has(handle)) {
      handle = `${handle}${bump++}`.slice(0, 20);
    }
    usedHandles.add(handle);

    const totalTips = pickInt(rand, 25, 480);
    const winPct = 0.42 + rand() * 0.32; // 42% – 74% settled win rate
    // 3–15% of tips are still pending (not yet settled)
    const pendingPct = 0.03 + rand() * 0.12;
    const settledTips = Math.round(totalTips * (1 - pendingPct));
    const pendingTips = totalTips - settledTips;         // exact remainder
    const wonTips = Math.round(settledTips * winPct);
    const lostTips = settledTips - wonTips;              // exact complement, no rounding gap
    // winRate is computed from the actual settled numbers so it always matches
    const winRate = settledTips > 0 ? Math.round((wonTips / settledTips) * 1000) / 10 : 0;
    const avgOdds = 1.55 + rand() * 1.4;
    const roi = -8 + rand() * 28; // -8 … +20
    const streak = pickInt(rand, -4, 12);
    const isPro = rand() < 0.18;

    out.push({
      id: startId + i,
      username: handle,
      displayName: `${first} ${last}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`,
      bio: pick(rand, BIOS),
      countryCode: pick(rand, COUNTRIES),
      specialties: pick(rand, SPECIALTIES_POOL),
      winRate,
      totalTips,
      wonTips,
      lostTips,
      pendingTips,
      avgOdds: Math.round(avgOdds * 100) / 100,
      roi: Math.round(roi * 10) / 10,
      streak,
      followersCount: pickInt(rand, 18, 4200),
      isPro,
      subscriptionPrice: isPro ? pickInt(rand, 200, 1500) : null,
      isVerified: rand() < 0.55,
      joinedAt: new Date(Date.now() - pickInt(rand, 14, 720) * 86400_000).toISOString(),
      isFake: true,
      // ~35% chance online; use deterministic seed so regenerate is stable
      isOnline: rand() < 0.35,
      lastSeen: new Date(Date.now() - pickInt(rand, 1, 120) * 60_000).toISOString(),
    });
  }
  return out;
}

// In-memory store — survives the lifetime of the dev server. Replaced by the
// admin "Generate" endpoint when called.
let FAKE_TIPSTERS: FakeTipster[] = generateFakeTipsters(100, 42, 1000);

export function getFakeTipsters(): FakeTipster[] {
  return FAKE_TIPSTERS;
}

export function setFakeTipsters(list: FakeTipster[]) {
  FAKE_TIPSTERS = list;
}

// ─── Activity-tip tracking ────────────────────────────────────────────────────
// Tracks tips that the fake-activity cron has posted so we can settle them
// once a match finishes, making win rates reflect actual posted tips.

interface ActivityTip {
  tipsterId: number;
  matchId: string;
  pick: string;
  odds: number;
  postedAt: number;
  result: 'pending' | 'won' | 'lost';
}

interface WeeklyPerf {
  tipsterId: number;
  tipsThisWeek: number;
  wonThisWeek: number;
}

const g = globalThis as {
  __activityTips?: ActivityTip[];
  __weeklyPerf?: Map<number, WeeklyPerf>;
  __tipsterOfWeekId?: number;
  __tipsterOfWeekTs?: number;
};
if (!g.__activityTips) g.__activityTips = [];
if (!g.__weeklyPerf) g.__weeklyPerf = new Map();

/** Record a tip posted by the fake-activity cron. */
export function recordActivityTip(tipsterId: number, matchId: string, pick: string, odds: number): void {
  const t = FAKE_TIPSTERS.find(x => x.id === tipsterId);
  if (!t) return;
  // Increment pending tips on the tipster object
  t.pendingTips = (t.pendingTips || 0) + 1;
  t.totalTips = (t.totalTips || 0) + 1;
  g.__activityTips!.push({ tipsterId, matchId, pick, odds, postedAt: Date.now(), result: 'pending' });
}

/**
 * Settle any pending tips whose match is now finished.
 * `finishedMatchIds` is a set of match IDs confirmed finished.
 * Win probability is seeded from the tipster's initial win rate so better
 * tipsters win more — the stats are realistic and tip-dependent.
 */
export function settleActivityTips(finishedMatchIds: Set<string>): { settled: number; won: number; lost: number } {
  let settled = 0; let won = 0; let lost = 0;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const weekStart = Date.now() - WEEK_MS;

  for (const tip of g.__activityTips!) {
    if (tip.result !== 'pending') continue;
    if (!finishedMatchIds.has(tip.matchId)) continue;

    const t = FAKE_TIPSTERS.find(x => x.id === tip.tipsterId);
    if (!t) { tip.result = 'lost'; continue; }

    // Win probability weighted by tipster's historical win rate (42%–74%)
    // Add small random jitter per-tip so it doesn't feel mechanical
    const baseWinProb = (t.winRate / 100) * 0.85 + 0.1; // 45%–73%
    const tipWon = Math.random() < baseWinProb;
    tip.result = tipWon ? 'won' : 'lost';

    // Update tipster object stats
    t.pendingTips = Math.max(0, (t.pendingTips || 0) - 1);
    if (tipWon) {
      t.wonTips = (t.wonTips || 0) + 1;
      t.streak = (t.streak || 0) >= 0 ? (t.streak || 0) + 1 : 1;
      won++;
    } else {
      t.lostTips = (t.lostTips || 0) + 1;
      t.streak = (t.streak || 0) <= 0 ? (t.streak || 0) - 1 : -1;
      lost++;
    }
    // Recompute win rate from actual settled tips
    const totalSettled = (t.wonTips || 0) + (t.lostTips || 0);
    if (totalSettled > 0) {
      t.winRate = Math.round(((t.wonTips || 0) / totalSettled) * 1000) / 10;
    }
    // Recompute ROI: simplified (avg_odds - 1) * win_rate - (1 - win_rate)
    t.roi = Math.round(((t.avgOdds - 1) * (t.winRate / 100) - (1 - t.winRate / 100)) * 10) / 10;

    // Track weekly performance
    if (tip.postedAt >= weekStart) {
      const perf = g.__weeklyPerf!.get(tip.tipsterId) || { tipsterId: tip.tipsterId, tipsThisWeek: 0, wonThisWeek: 0 };
      perf.tipsThisWeek++;
      if (tipWon) perf.wonThisWeek++;
      g.__weeklyPerf!.set(tip.tipsterId, perf);
    }

    settled++;
  }

  // Recompute tipster-of-the-week after settlement (cache 1 hour)
  if (settled > 0) _recomputeTipsterOfWeek();
  return { settled, won, lost };
}

function _recomputeTipsterOfWeek() {
  let bestId = -1; let bestScore = -Infinity;
  for (const [id, perf] of g.__weeklyPerf!) {
    if (perf.tipsThisWeek < 2) continue;
    const wr = perf.wonThisWeek / perf.tipsThisWeek;
    const score = wr * 100 + perf.tipsThisWeek * 0.5;
    if (score > bestScore) { bestScore = score; bestId = id; }
  }
  g.__tipsterOfWeekId = bestId > 0 ? bestId : undefined;
  g.__tipsterOfWeekTs = Date.now();
}

/** Returns the ID of the current tipster-of-the-week (based on last 7 days' activity tips). */
export function getTipsterOfWeekId(): number | undefined {
  return g.__tipsterOfWeekId;
}

/** Returns true if the given tipster ID is currently tipster-of-the-week. */
export function isTipsterOfWeek(tipsterId: number): boolean {
  return g.__tipsterOfWeekId === tipsterId;
}

/** Weekly performance stats for a given tipster. */
export function getWeeklyPerf(tipsterId: number): WeeklyPerf | undefined {
  return g.__weeklyPerf?.get(tipsterId);
}

export function getFakeTipsterById(id: number | string): FakeTipster | undefined {
  const n = typeof id === 'string' ? Number(id) : id;
  if (!Number.isFinite(n)) return undefined;
  return FAKE_TIPSTERS.find(t => t.id === n);
}

export function getFakeTipsterByUsername(username: string): FakeTipster | undefined {
  const u = username.toLowerCase();
  return FAKE_TIPSTERS.find(t => t.username.toLowerCase() === u);
}

/**
 * Resolve a fake tipster from a URL slug. Tries:
 *  • exact username match
 *  • slugified display name match (e.g. "brian-otieno" → "Brian Otieno")
 *  • slugified username match (legacy)
 */
export function getFakeTipsterBySlug(slug: string): FakeTipster | undefined {
  if (!slug) return undefined;
  const s = decodeURIComponent(slug).toLowerCase();
  // username exact
  const byUser = FAKE_TIPSTERS.find(t => t.username.toLowerCase() === s);
  if (byUser) return byUser;
  // slugified display name
  const slugify = (str: string) =>
    str.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]+/g, ' ').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  return FAKE_TIPSTERS.find(t => slugify(t.displayName) === s)
      || FAKE_TIPSTERS.find(t => slugify(t.username) === s);
}

export function regenerateFakeTipsters(count = 100, seed?: number): FakeTipster[] {
  const s = seed ?? Math.floor(Math.random() * 1_000_000);
  FAKE_TIPSTERS = generateFakeTipsters(count, s, 1000);
  return FAKE_TIPSTERS;
}

/**
 * Pick a sub-set of tipsters who would plausibly post on a given match.
 * Popular leagues (top tier in big countries) attract more action.
 */
export function pickTipstersForMatch(matchId: string, leagueTier: number, popularity = 1): FakeTipster[] {
  const rand = rng(hashStr(matchId));
  // Base count: 1–3, scaled by popularity (top leagues 4–9 tipsters).
  const min = 1;
  const max = 3 + Math.max(0, 6 - leagueTier) + Math.round(popularity * 2);
  const target = pickInt(rand, min, max);
  const list = FAKE_TIPSTERS.slice();
  // Fisher-Yates shuffle with deterministic rand
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, target);
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}
