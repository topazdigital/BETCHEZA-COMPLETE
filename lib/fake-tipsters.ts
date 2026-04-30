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
    const winPct = 0.42 + rand() * 0.32; // 42% – 74%
    const wonTips = Math.round(totalTips * winPct);
    const lostTips = Math.round(totalTips * (1 - winPct) * 0.85);
    const pendingTips = Math.max(0, totalTips - wonTips - lostTips);
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
      winRate: Math.round(winPct * 1000) / 10,
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
