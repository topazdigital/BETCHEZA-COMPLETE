import { NextResponse } from 'next/server';
import { getFeaturedConfig } from '@/lib/featured-store';
import {
  getAllMatches,
  getUpcomingMatches,
  getMatchById,
  type UnifiedMatch,
} from '@/lib/api/unified-sports-api';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

// ─── In-process stale-while-revalidate cache (30 s TTL) ───────────────────────
const FEATURED_CACHE_TTL = 30_000;
let _featuredCache: { data: unknown; ts: number } | null = null;
let _featuredRefreshing = false;

async function getCachedFeaturedPayload(builder: () => Promise<unknown>): Promise<unknown> {
  const now = Date.now();
  if (_featuredCache && now - _featuredCache.ts < FEATURED_CACHE_TTL) return _featuredCache.data;
  if (_featuredCache && !_featuredRefreshing) {
    _featuredRefreshing = true;
    builder()
      .then(data => { _featuredCache = { data, ts: Date.now() }; })
      .catch(() => {})
      .finally(() => { _featuredRefreshing = false; });
    return _featuredCache.data;
  }
  const data = await builder();
  _featuredCache = { data, ts: Date.now() };
  return data;
}

interface DbAutoTip {
  id: string;
  match_id: string;
  tipster_id: number;
  market: string;
  prediction: string;
  odds: number;
  confidence: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_pro: number | null;
  is_verified: number | null;
  win_rate: number | null;
  roi: number | null;
  followers_count: number | null;
}

async function getBestTipForMatch(matchId: string): Promise<{
  tipster: { id: number; displayName: string; username: string; rank: number; isPremium: boolean; verified: boolean; followers: number; roi: number; winRate: number };
  prediction: string;
  market: string;
  odds: number;
  confidence: number;
} | null> {
  try {
    const result = await query<DbAutoTip>(
      `SELECT at.id, at.match_id, at.tipster_id, at.market, at.prediction,
              at.odds, at.confidence,
              u.username, u.display_name, u.avatar_url,
              tp.is_pro, u.is_verified, tp.win_rate, tp.roi, tp.followers_count
         FROM auto_tips at
         JOIN users u ON u.id = at.tipster_id
         LEFT JOIN tipster_profiles tp ON tp.user_id = at.tipster_id
         WHERE at.match_id = ? AND at.status = 'pending'
         ORDER BY at.confidence DESC
         LIMIT 1`,
      [matchId]
    );
    const rows = result.rows;
    const tip = rows[0];
    if (!tip) return null;
    return {
      tipster: {
        id: tip.tipster_id,
        displayName: tip.display_name || tip.username,
        username: tip.username,
        rank: 1,
        isPremium: !!tip.is_pro,
        verified: !!tip.is_verified,
        followers: Number(tip.followers_count ?? 0),
        roi: Number(tip.roi ?? 0),
        winRate: Number(tip.win_rate ?? 0),
      },
      prediction: tip.prediction,
      market: tip.market,
      odds: Number(tip.odds),
      confidence: Number(tip.confidence),
    };
  } catch {
    return null;
  }
}

interface FeaturedItem {
  matchId: string;
  pinned: boolean;
  match: {
    id: string;
    homeTeam: { name: string; shortName?: string; logo?: string };
    awayTeam: { name: string; shortName?: string; logo?: string };
    kickoffTime: string;
    status: string;
    league: { name: string; country?: string };
    sport: { name: string; slug: string };
  };
  tip: {
    tipster: { id: number; displayName: string; username: string; rank: number; isPremium: boolean; verified: boolean; followers: number; roi: number; winRate: number };
    prediction: string;
    market: string;
    odds: number;
    confidence: number;
  } | null;
}

async function toFeatured(match: UnifiedMatch, pinned: boolean): Promise<FeaturedItem> {
  const tip = await getBestTipForMatch(match.id);
  return {
    matchId: match.id,
    pinned,
    match: {
      id: match.id,
      homeTeam: { name: match.homeTeam.name, shortName: match.homeTeam.shortName, logo: match.homeTeam.logo },
      awayTeam: { name: match.awayTeam.name, shortName: match.awayTeam.shortName, logo: match.awayTeam.logo },
      kickoffTime: typeof match.kickoffTime === 'string' ? match.kickoffTime : new Date(match.kickoffTime).toISOString(),
      status: String(match.status),
      league: { name: match.league.name, country: match.league.country },
      sport: { name: match.sport.name, slug: match.sport.slug },
    },
    tip,
  };
}

async function buildFeaturedPayload() {
  const config = await getFeaturedConfig();
  if (!config.enabled) {
    return { enabled: false, items: [], config };
  }

  const hidden = new Set(config.hiddenMatchIds || []);

  // 1. Resolve pinned matches first (they bypass criteria but still must exist).
  const pinned: FeaturedItem[] = [];
  const seen = new Set<string>();
  for (const id of config.pinnedMatchIds) {
    if (!id || seen.has(id) || hidden.has(id)) continue;
    try {
      const m = await getMatchById(id);
      if (m) {
        pinned.push(await toFeatured(m, true));
        seen.add(id);
      }
    } catch (e) {
      console.warn('[featured] pinned match lookup failed:', id, e);
    }
    if (pinned.length >= config.limit) break;
  }

  // 2. Fill remaining slots from upcoming matches that have real auto-tips.
  const remaining = Math.max(0, config.limit - pinned.length);
  const auto: FeaturedItem[] = [];
  if (remaining > 0) {
    let candidates: UnifiedMatch[] = [];
    try {
      candidates = await getUpcomingMatches();
    } catch {
      try {
        candidates = await getAllMatches();
      } catch {
        candidates = [];
      }
    }
    const now = Date.now();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const endTs = endOfDay.getTime();

    const filtered = candidates
      .filter(m => !seen.has(m.id) && !hidden.has(m.id))
      .filter(m => {
        if (config.sport && m.sport?.slug !== config.sport) return false;
        const ts = new Date(m.kickoffTime).getTime();
        if (!Number.isFinite(ts)) return false;
        if (ts < now - 2 * 60 * 1000) return false;
        if (ts > endTs) return false;
        const sNorm = String(m.status || '').toLowerCase();
        if (sNorm && sNorm !== 'scheduled' && sNorm !== 'upcoming' && sNorm !== 'ns') return false;
        return true;
      });

    for (const m of filtered) {
      if (auto.length >= remaining) break;
      const item = await toFeatured(m, false);
      if (!item.tip) continue; // only include matches with real tips
      if (item.tip.confidence < config.minConfidence) continue;
      if (item.tip.odds < config.minOdds || item.tip.odds > config.maxOdds) continue;
      auto.push(item);
    }

    auto.sort((a, b) => (b.tip?.confidence ?? 0) - (a.tip?.confidence ?? 0));
  }

  return {
    enabled: true,
    items: [...pinned.filter(p => p.tip != null), ...auto.slice(0, remaining)],
    config,
  };
}

export async function GET() {
  const data = await getCachedFeaturedPayload(buildFeaturedPayload);
  return NextResponse.json(data);
}
