import { NextResponse } from 'next/server';
import { getFeaturedConfig } from '@/lib/featured-store';
import {
  getAllMatches,
  getUpcomingMatches,
  getMatchById,
  type UnifiedMatch,
} from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

// Mirror of /api/matches/[id]/tips TIPSTERS so featured panel uses the
// same author pool with the same "rank" semantics.
const TIPSTERS = [
  { id: '1', displayName: 'KingOfTips',  rank: 1, isPremium: true,  verified: true,  followers: 1523, roi: 12.4, winRate: 68.4 },
  { id: '2', displayName: 'AcePredicts', rank: 2, isPremium: true,  verified: true,  followers: 982,  roi: 15.8, winRate: 72.1 },
  { id: '3', displayName: 'LuckyStriker',rank: 3, isPremium: false, verified: false, followers: 678,  roi: 9.2,  winRate: 60.7 },
  { id: '4', displayName: 'EuroExpert',  rank: 4, isPremium: true,  verified: true,  followers: 534,  roi: 7.5,  winRate: 58.3 },
  { id: '5', displayName: 'GoalMachine', rank: 8, isPremium: false, verified: false, followers: 312,  roi: 5.3,  winRate: 58.2 },
  { id: '6', displayName: 'BetWizard',   rank: 6, isPremium: true,  verified: true,  followers: 1102, roi: 18.1, winRate: 69.7 },
];

const PREDICTIONS = [
  { prediction: 'Home Win',             market: 'Match Result (1X2)' },
  { prediction: 'Away Win',             market: 'Match Result (1X2)' },
  { prediction: 'Draw',                 market: 'Match Result (1X2)' },
  { prediction: 'Both Teams to Score',  market: 'BTTS' },
  { prediction: 'Over 2.5 Goals',       market: 'Over/Under 2.5' },
  { prediction: 'Under 2.5 Goals',      market: 'Over/Under 2.5' },
  { prediction: 'Home or Draw (1X)',    market: 'Double Chance' },
  { prediction: 'Away or Draw (X2)',    market: 'Double Chance' },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

interface BestTip {
  tipster: typeof TIPSTERS[number];
  prediction: string;
  market: string;
  odds: number;
  confidence: number;
}

function bestTipFor(matchId: string): BestTip {
  const seed = hashCode(matchId);
  let best: BestTip | null = null;
  for (let i = 0; i < 4; i++) {
    const tipster = TIPSTERS[Math.floor(seededRandom(seed + i * 37) * TIPSTERS.length)];
    const { prediction, market } = PREDICTIONS[Math.floor(seededRandom(seed + i * 53) * PREDICTIONS.length)];
    const odds = Math.round((1.4 + seededRandom(seed + i * 17) * 2.8) * 100) / 100;
    const confidence = 55 + Math.floor(seededRandom(seed + i * 43) * 40);
    if (!best || confidence > best.confidence) best = { tipster, prediction, market, odds, confidence };
  }
  return best!;
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
  tip: BestTip;
}

function toFeatured(match: UnifiedMatch, pinned: boolean): FeaturedItem {
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
    tip: bestTipFor(match.id),
  };
}

export async function GET() {
  const config = await getFeaturedConfig();
  if (!config.enabled) {
    return NextResponse.json({ enabled: false, items: [], config });
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
        pinned.push(toFeatured(m, true));
        seen.add(id);
      }
    } catch (e) {
      console.warn('[featured] pinned match lookup failed:', id, e);
    }
    if (pinned.length >= config.limit) break;
  }

  // 2. Fill remaining slots from upcoming matches that pass criteria.
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
      const tip = bestTipFor(m.id);
      if (tip.confidence < config.minConfidence) continue;
      if (tip.odds < config.minOdds || tip.odds > config.maxOdds) continue;
      if (config.topTipsterOnly && tip.tipster.rank > 5) continue;
      auto.push({ ...toFeatured(m, false), tip });
      if (auto.length >= remaining) break;
    }

    // Sort auto picks by confidence desc.
    auto.sort((a, b) => b.tip.confidence - a.tip.confidence);
  }

  return NextResponse.json({
    enabled: true,
    items: [...pinned, ...auto.slice(0, remaining)],
    config,
  });
}
