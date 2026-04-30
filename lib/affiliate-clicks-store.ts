// ─────────────────────────────────────────────────────────────────────
// Affiliate clicks + conversion store — captures every outbound click on
// a bookmaker link AND ties downstream signups/deposits back to the
// click that drove them. Powers the conversion funnel in the admin
// dashboard (clicks → signups → deposits → revenue, per bookmaker).
//
// Persistence: JSON file at .local/state/affiliate-clicks.json. Same
// pattern as bookmakers-store.ts — survives restarts, no DB required.
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

export interface AffiliateClick {
  id: number;
  ts: number;                 // unix ms
  bookmakerId: number;
  bookmakerSlug: string;
  bookmakerName: string;
  placement: string;          // 'odds-table' | 'sidebar' | 'bookmakers-page' | 'match-tip' | 'unknown'
  sport?: string;             // e.g. 'football'
  league?: string;            // e.g. 'premier-league'
  matchId?: string;           // string to handle external IDs from sportsgameodds
  matchLabel?: string;        // 'Arsenal vs Chelsea'
  market?: string;            // optional market context (e.g. '1x2')
  selection?: string;         // optional selection context (e.g. 'home')
  userId?: number;            // logged-in user (if any)
  country?: string;           // request country (header)
  device: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  referer?: string;
}

export interface AttributionRecord {
  userId: number;
  bookmakerId: number;
  bookmakerSlug: string;
  bookmakerName: string;
  clickId?: number;
  signedUpAt: number;
}

export interface ConversionEvent {
  id: number;
  ts: number;
  type: 'signup' | 'deposit';
  userId: number;
  bookmakerId: number;
  bookmakerSlug: string;
  bookmakerName: string;
  amount?: number;            // deposit amount
  currency?: string;          // deposit currency
  clickId?: number;
}

const STORE_DIR = path.join(process.cwd(), '.local', 'state');
const STORE_FILE = path.join(STORE_DIR, 'affiliate-clicks.json');
const MAX_CLICKS = 50_000; // hard cap so the JSON file doesn't grow unbounded
const MAX_CONVERSIONS = 50_000;

interface ClicksFile {
  nextId: number;
  clicks: AffiliateClick[];
  // Conversion tracking — added in v2. Optional in older files so we
  // gracefully migrate when reading legacy stores.
  nextConvId?: number;
  conversions?: ConversionEvent[];
  attribution?: Record<number, AttributionRecord>; // userId -> attribution
}

function ensureDir() {
  try { fs.mkdirSync(STORE_DIR, { recursive: true }); } catch { /* ignore */ }
}

function load(): ClicksFile {
  ensureDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ClicksFile;
      if (parsed && Array.isArray(parsed.clicks)) {
        return {
          nextId: parsed.nextId || (parsed.clicks.length + 1),
          clicks: parsed.clicks,
          nextConvId: parsed.nextConvId || (parsed.conversions?.length || 0) + 1,
          conversions: parsed.conversions || [],
          attribution: parsed.attribution || {},
        };
      }
    }
  } catch (e) {
    console.warn('[affiliate-clicks] failed to read store:', e);
  }
  return { nextId: 1, clicks: [], nextConvId: 1, conversions: [], attribution: {} };
}

function persist(state: ClicksFile) {
  ensureDir();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[affiliate-clicks] failed to write store:', e);
  }
}

const g = globalThis as { __affiliateClicksCache?: ClicksFile };
function cache(): ClicksFile {
  if (!g.__affiliateClicksCache) g.__affiliateClicksCache = load();
  // Defensive: if an older cache predates conversion fields, hydrate them.
  const c = g.__affiliateClicksCache!;
  if (!c.conversions) c.conversions = [];
  if (!c.attribution) c.attribution = {};
  if (!c.nextConvId) c.nextConvId = (c.conversions.length || 0) + 1;
  return c;
}

export function recordClick(input: Omit<AffiliateClick, 'id' | 'ts'>): AffiliateClick {
  const state = cache();
  const click: AffiliateClick = {
    id: state.nextId++,
    ts: Date.now(),
    ...input,
  };
  state.clicks.push(click);
  // Trim oldest if we go over the cap.
  if (state.clicks.length > MAX_CLICKS) {
    state.clicks.splice(0, state.clicks.length - MAX_CLICKS);
  }
  persist(state);
  return click;
}

// ─── Conversion tracking ────────────────────────────────────────────

/**
 * Record that a user signed up after clicking through to a bookmaker.
 * Called from /api/auth/register when the bz_aff cookie is present.
 * Also stamps the user's attribution so future deposits roll up here.
 */
export function recordSignup(opts: {
  userId: number;
  bookmakerId: number;
  bookmakerSlug: string;
  bookmakerName: string;
  clickId?: number;
}): ConversionEvent {
  const state = cache();
  state.attribution![opts.userId] = {
    userId: opts.userId,
    bookmakerId: opts.bookmakerId,
    bookmakerSlug: opts.bookmakerSlug,
    bookmakerName: opts.bookmakerName,
    clickId: opts.clickId,
    signedUpAt: Date.now(),
  };
  const event: ConversionEvent = {
    id: state.nextConvId!++,
    ts: Date.now(),
    type: 'signup',
    userId: opts.userId,
    bookmakerId: opts.bookmakerId,
    bookmakerSlug: opts.bookmakerSlug,
    bookmakerName: opts.bookmakerName,
    clickId: opts.clickId,
  };
  state.conversions!.push(event);
  if (state.conversions!.length > MAX_CONVERSIONS) {
    state.conversions!.splice(0, state.conversions!.length - MAX_CONVERSIONS);
  }
  persist(state);
  return event;
}

/**
 * Record a deposit. If the user has an attribution record (i.e. they
 * arrived via an affiliate click), the deposit is tied back to that
 * bookmaker so the funnel can show revenue-per-click.
 */
export function recordDeposit(opts: {
  userId: number;
  amount: number;
  currency?: string;
}): ConversionEvent | null {
  const state = cache();
  const attr = state.attribution![opts.userId];
  if (!attr) return null;
  const event: ConversionEvent = {
    id: state.nextConvId!++,
    ts: Date.now(),
    type: 'deposit',
    userId: opts.userId,
    bookmakerId: attr.bookmakerId,
    bookmakerSlug: attr.bookmakerSlug,
    bookmakerName: attr.bookmakerName,
    amount: opts.amount,
    currency: opts.currency || 'KES',
    clickId: attr.clickId,
  };
  state.conversions!.push(event);
  if (state.conversions!.length > MAX_CONVERSIONS) {
    state.conversions!.splice(0, state.conversions!.length - MAX_CONVERSIONS);
  }
  persist(state);
  return event;
}

export function getAttribution(userId: number): AttributionRecord | undefined {
  return cache().attribution![userId];
}

// ─── Stats / aggregations ───────────────────────────────────────────

export interface FunnelRow {
  bookmakerId: number;
  bookmakerName: string;
  bookmakerSlug: string;
  clicks: number;
  signups: number;
  conversionRate: number;       // signups / clicks (%)
  deposits: number;             // # of deposits
  uniqueDepositors: number;
  revenue: number;              // total deposit amount
  revenuePerClick: number;      // revenue / clicks
  arpu: number;                 // revenue / unique depositors
}

export interface ClickStats {
  total: number;
  last24h: number;
  last7d: number;
  byBookmaker: Array<{ bookmakerId: number; bookmakerName: string; bookmakerSlug: string; clicks: number; last24h: number }>;
  bySport: Array<{ sport: string; clicks: number }>;
  byLeague: Array<{ league: string; clicks: number }>;
  byMatch: Array<{ matchId: string; matchLabel: string; clicks: number }>;
  byPlacement: Array<{ placement: string; clicks: number }>;
  byDevice: Array<{ device: string; clicks: number }>;
  byDay: Array<{ date: string; clicks: number }>;
  recent: AffiliateClick[];
  funnel: FunnelRow[];
  funnelTotals: {
    clicks: number;
    signups: number;
    conversionRate: number;
    deposits: number;
    uniqueDepositors: number;
    revenue: number;
    revenuePerClick: number;
  };
  recentConversions: ConversionEvent[];
}

export function getStats(opts: { days?: number } = {}): ClickStats {
  const state = cache();
  const now = Date.now();
  const days = opts.days ?? 30;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;

  const inWindow = state.clicks.filter(c => c.ts >= cutoff);
  const conversionsInWindow = (state.conversions || []).filter(c => c.ts >= cutoff);

  function topBy<K extends string>(keyFn: (c: AffiliateClick) => string | undefined, labelFn: (key: string, sample: AffiliateClick) => Record<K, string | number>): Array<Record<K, string | number> & { clicks: number }> {
    const map = new Map<string, { sample: AffiliateClick; count: number }>();
    for (const c of inWindow) {
      const k = keyFn(c);
      if (!k) continue;
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { sample: c, count: 1 });
    }
    return [...map.entries()]
      .map(([k, v]) => ({ ...labelFn(k, v.sample), clicks: v.count }))
      .sort((a, b) => b.clicks - a.clicks);
  }

  // Per bookmaker (also compute last-24h)
  const byBookMap = new Map<number, { name: string; slug: string; total: number; last24h: number }>();
  for (const c of inWindow) {
    const cur = byBookMap.get(c.bookmakerId) || { name: c.bookmakerName, slug: c.bookmakerSlug, total: 0, last24h: 0 };
    cur.total++;
    if (c.ts >= now - dayMs) cur.last24h++;
    byBookMap.set(c.bookmakerId, cur);
  }
  const byBookmaker = [...byBookMap.entries()]
    .map(([id, v]) => ({ bookmakerId: id, bookmakerName: v.name, bookmakerSlug: v.slug, clicks: v.total, last24h: v.last24h }))
    .sort((a, b) => b.clicks - a.clicks);

  // Per day (oldest -> newest)
  const dayMap = new Map<string, number>();
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now - d * dayMs).toISOString().slice(0, 10);
    dayMap.set(date, 0);
  }
  for (const c of inWindow) {
    const date = new Date(c.ts).toISOString().slice(0, 10);
    if (dayMap.has(date)) dayMap.set(date, (dayMap.get(date) || 0) + 1);
  }
  const byDay = [...dayMap.entries()].map(([date, clicks]) => ({ date, clicks }));

  // ── Funnel: per-bookmaker clicks → signups → deposits → revenue ──
  // Build a unified bookmaker key set from all sources so a bookmaker
  // shows up even if it has signups but zero clicks in this window.
  const allBookIds = new Set<number>();
  byBookmaker.forEach(b => allBookIds.add(b.bookmakerId));
  conversionsInWindow.forEach(c => allBookIds.add(c.bookmakerId));

  const funnel: FunnelRow[] = [];
  let totalSignups = 0;
  let totalDeposits = 0;
  let totalRevenue = 0;
  const allDepositors = new Set<number>();

  for (const bookId of allBookIds) {
    const bookClicks = byBookmaker.find(b => b.bookmakerId === bookId);
    const clickCount = bookClicks?.clicks ?? 0;
    const bookConvs = conversionsInWindow.filter(c => c.bookmakerId === bookId);
    const signups = bookConvs.filter(c => c.type === 'signup');
    const deposits = bookConvs.filter(c => c.type === 'deposit');
    const revenue = deposits.reduce((s, d) => s + (d.amount || 0), 0);
    const depositors = new Set(deposits.map(d => d.userId));
    deposits.forEach(d => allDepositors.add(d.userId));

    const sample = bookClicks ?? bookConvs[0];
    if (!sample) continue;
    const name = bookClicks?.bookmakerName ?? bookConvs[0].bookmakerName;
    const slug = bookClicks?.bookmakerSlug ?? bookConvs[0].bookmakerSlug;

    totalSignups += signups.length;
    totalDeposits += deposits.length;
    totalRevenue += revenue;

    funnel.push({
      bookmakerId: bookId,
      bookmakerName: name,
      bookmakerSlug: slug,
      clicks: clickCount,
      signups: signups.length,
      conversionRate: clickCount > 0 ? (signups.length / clickCount) * 100 : 0,
      deposits: deposits.length,
      uniqueDepositors: depositors.size,
      revenue,
      revenuePerClick: clickCount > 0 ? revenue / clickCount : 0,
      arpu: depositors.size > 0 ? revenue / depositors.size : 0,
    });
  }
  funnel.sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);

  return {
    total: state.clicks.length,
    last24h: state.clicks.filter(c => c.ts >= now - dayMs).length,
    last7d: state.clicks.filter(c => c.ts >= now - 7 * dayMs).length,
    byBookmaker,
    bySport: topBy<'sport'>(c => c.sport, (k) => ({ sport: k })) as Array<{ sport: string; clicks: number }>,
    byLeague: topBy<'league'>(c => c.league, (k) => ({ league: k })) as Array<{ league: string; clicks: number }>,
    byMatch: topBy<'matchId' | 'matchLabel'>(
      c => (c.matchId ? c.matchId : undefined),
      (k, sample) => ({ matchId: k, matchLabel: sample.matchLabel || k }),
    ).slice(0, 50) as Array<{ matchId: string; matchLabel: string; clicks: number }>,
    byPlacement: topBy<'placement'>(c => c.placement || 'unknown', (k) => ({ placement: k })) as Array<{ placement: string; clicks: number }>,
    byDevice: topBy<'device'>(c => c.device || 'unknown', (k) => ({ device: k })) as Array<{ device: string; clicks: number }>,
    byDay,
    recent: [...inWindow].sort((a, b) => b.ts - a.ts).slice(0, 50),
    funnel,
    funnelTotals: {
      clicks: inWindow.length,
      signups: totalSignups,
      conversionRate: inWindow.length > 0 ? (totalSignups / inWindow.length) * 100 : 0,
      deposits: totalDeposits,
      uniqueDepositors: allDepositors.size,
      revenue: totalRevenue,
      revenuePerClick: inWindow.length > 0 ? totalRevenue / inWindow.length : 0,
    },
    recentConversions: [...conversionsInWindow].sort((a, b) => b.ts - a.ts).slice(0, 30),
  };
}

export function clearAll(): void {
  const state = cache();
  state.clicks = [];
  state.nextId = 1;
  state.conversions = [];
  state.attribution = {};
  state.nextConvId = 1;
  persist(state);
}
