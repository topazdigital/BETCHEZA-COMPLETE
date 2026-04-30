// ─────────────────────────────────────────────────────────────────────
// Bookmakers store — single source of truth for the bookmakers shown on
// /bookmakers, the admin manager at /admin/bookmakers, AND the affiliate
// links used when surfacing odds inside match details ("Bet now" CTAs).
//
// Persistence: JSON file at .local/state/bookmakers.json. Seeded from the
// hardcoded `BOOKMAKERS` list in lib/sports-data.ts on first load so we
// don't lose the existing catalogue.
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { BOOKMAKERS as SEED } from './sports-data';

export interface BookmakerRow {
  id: number;
  name: string;
  slug: string;
  /** Two-letter shorthand shown in the bookmaker tile (e.g. "B365"). */
  logo: string;
  /** Optional logo image URL. */
  logoUrl?: string;
  /** Affiliate URL — the user's tracking link. */
  affiliateUrl: string;
  /** Plain bonus copy shown on the card. */
  bonus: string;
  /** Optional promo / signup code. */
  bonusCode?: string;
  /** 1.0 — 5.0 star rating. */
  rating: number;
  /** Two-letter region codes (KE, NG, UK, US, …). */
  regions: string[];
  /** Bullet list of features. */
  features: string[];
  /** Minimum deposit in their default currency. */
  minDeposit: number;
  paymentMethods: string[];
  pros: string[];
  cons: string[];
  /** Year the book was established. */
  established?: number;
  /** Featured = appears in the homepage strip + match-details "Bet now" buttons. */
  featured: boolean;
  /** Hide entirely from the public list (admin-only soft delete). */
  archived?: boolean;
  /** Order on the public page (lower = first). */
  sortOrder?: number;
  /** Last update time. */
  updatedAt: string;
}

const STORE_DIR = path.join(process.cwd(), '.local', 'state');
const STORE_FILE = path.join(STORE_DIR, 'bookmakers.json');

function ensureDir() {
  try { fs.mkdirSync(STORE_DIR, { recursive: true }); } catch { /* ignore */ }
}

// Reasonable defaults for the seed catalogue so first-run looks complete.
function seedRow(s: typeof SEED[number]): BookmakerRow {
  const initials = s.name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    logo: initials,
    affiliateUrl: s.affiliateUrl,
    bonus: 'Welcome bonus available',
    rating: 4.3,
    regions: s.regions,
    features: ['Live Betting', 'Mobile App', 'Cash Out'],
    minDeposit: 10,
    paymentMethods: ['Visa', 'Mastercard'],
    pros: ['Trusted brand'],
    cons: [],
    featured: s.featured,
    sortOrder: s.id,
    updatedAt: new Date().toISOString(),
  };
}

function load(): Record<number, BookmakerRow> {
  ensureDir();
  let data: Record<number, BookmakerRow> = {};
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, BookmakerRow>;
      for (const [k, v] of Object.entries(parsed)) data[Number(k)] = v;
    }
  } catch (e) {
    console.warn('[bookmakers] failed to read store:', e);
  }
  // Merge in any seed entries we don't have yet (so adding to the seed
  // catalogue auto-extends production without wiping admin edits).
  for (const s of SEED) {
    if (!data[s.id]) data[s.id] = seedRow(s);
  }
  return data;
}

function persist(rows: Record<number, BookmakerRow>) {
  ensureDir();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(rows, null, 2), 'utf-8');
  } catch (e) {
    console.error('[bookmakers] failed to write store:', e);
  }
}

const g = globalThis as { __bookmakersCache?: Record<number, BookmakerRow> };
function cache(): Record<number, BookmakerRow> {
  if (!g.__bookmakersCache) g.__bookmakersCache = load();
  return g.__bookmakersCache!;
}

/** Public list — only non-archived. Sorted by sortOrder, then id. */
export function listPublicBookmakers(): BookmakerRow[] {
  return Object.values(cache())
    .filter(b => !b.archived)
    .sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));
}

/** Admin list — including archived. */
export function listAllBookmakers(): BookmakerRow[] {
  return Object.values(cache()).sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));
}

export function getBookmakerById(id: number): BookmakerRow | undefined {
  return cache()[id];
}

/** Slug or canonical id (e.g. "fanduel", "1xbet") — used by the SGO bookmaker
 * lines panel to look up the matching affiliate link. */
export function getBookmakerBySlug(slug: string): BookmakerRow | undefined {
  const want = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.values(cache()).find(b => b.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === want);
}

export function upsertBookmaker(input: Partial<BookmakerRow> & { name: string; slug: string; affiliateUrl: string }): BookmakerRow {
  const map = cache();
  const id = input.id ?? (Math.max(0, ...Object.keys(map).map(Number)) + 1);
  const existing = map[id];
  const row: BookmakerRow = {
    id,
    name: input.name,
    slug: input.slug,
    logo: (input.logo || existing?.logo || input.name.slice(0, 2)).toUpperCase(),
    logoUrl: input.logoUrl ?? existing?.logoUrl,
    affiliateUrl: input.affiliateUrl,
    bonus: input.bonus ?? existing?.bonus ?? 'Welcome bonus available',
    bonusCode: input.bonusCode ?? existing?.bonusCode,
    rating: typeof input.rating === 'number' ? Math.max(0, Math.min(5, input.rating)) : (existing?.rating ?? 4.0),
    regions: input.regions ?? existing?.regions ?? [],
    features: input.features ?? existing?.features ?? [],
    minDeposit: typeof input.minDeposit === 'number' ? input.minDeposit : (existing?.minDeposit ?? 10),
    paymentMethods: input.paymentMethods ?? existing?.paymentMethods ?? [],
    pros: input.pros ?? existing?.pros ?? [],
    cons: input.cons ?? existing?.cons ?? [],
    established: input.established ?? existing?.established,
    featured: input.featured ?? existing?.featured ?? true,
    archived: input.archived ?? existing?.archived ?? false,
    sortOrder: input.sortOrder ?? existing?.sortOrder ?? id,
    updatedAt: new Date().toISOString(),
  };
  map[id] = row;
  persist(map);
  return row;
}

export function deleteBookmaker(id: number): boolean {
  const map = cache();
  if (!map[id]) return false;
  delete map[id];
  persist(map);
  return true;
}

/**
 * Append the affiliate URL when we have a tracker. Falls back to the bookmaker's
 * native deeplink (or the affiliate root) when nothing better is available.
 *
 * `nativeLink` is the per-event deeplink we got from SportsGameOdds.
 *
 * Strategy: most bookmaker affiliate networks accept a `?go=` or `?url=` style
 * forwarding param. Since we don't know the user's network we just preserve the
 * affiliate URL but stash the deeplink in a `target` query so admins can wire it
 * up properly later. For most affiliate links, just hitting the root URL is fine
 * — the cookie attribution is what matters.
 */
export function buildAffiliateLink(slug: string, nativeLink?: string): string | null {
  const book = getBookmakerBySlug(slug);
  if (!book) return nativeLink || null;
  const base = book.affiliateUrl;
  if (!base) return nativeLink || null;
  if (!nativeLink) return base;
  // If the affiliate URL already contains a redirect param, append the deeplink there.
  try {
    const u = new URL(base);
    if (u.searchParams.has('url') || u.searchParams.has('redirect') || u.searchParams.has('go')) {
      const k = u.searchParams.has('url') ? 'url' : u.searchParams.has('redirect') ? 'redirect' : 'go';
      u.searchParams.set(k, nativeLink);
      return u.toString();
    }
    return base;
  } catch {
    return base;
  }
}
