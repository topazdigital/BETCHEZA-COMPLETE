import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getFeaturedConfig } from '@/lib/featured-store';
import {
  getAllMatches,
  getUpcomingMatches,
  getMatchById,
  type UnifiedMatch,
} from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

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

function bestTipFor(matchId: string) {
  const seed = hashCode(matchId);
  let best: { tipster: typeof TIPSTERS[number]; prediction: string; market: string; odds: number; confidence: number } | null = null;
  for (let i = 0; i < 4; i++) {
    const tipster = TIPSTERS[Math.floor(seededRandom(seed + i * 37) * TIPSTERS.length)];
    const { prediction, market } = PREDICTIONS[Math.floor(seededRandom(seed + i * 53) * PREDICTIONS.length)];
    const odds = Math.round((1.4 + seededRandom(seed + i * 17) * 2.8) * 100) / 100;
    const confidence = 55 + Math.floor(seededRandom(seed + i * 43) * 40);
    if (!best || confidence > best.confidence) best = { tipster, prediction, market, odds, confidence };
  }
  return best!;
}

).role !== 'admin') return null;
interface AdminTipItem {
  matchId: string;
  pinned: boolean;
  hidden: boolean;
  qualifies: boolean;
  skipReasons: string[];
  match: {
    id: string;
    homeTeam: { name: string; shortName?: string; logo?: string };
    awayTeam: { name: string; shortName?: string; logo?: string };
    kickoffTime: string;
    status: string;
    league: { name: string; country?: string; countryCode?: string };
    sport: { name: string; slug: string };
  };
  tip: ReturnType<typeof bestTipFor>;
}

function toItem(match: UnifiedMatch, pinned: boolean, hidden: boolean, qualifies: boolean, reasons: string[]): AdminTipItem {
  const tip = bestTipFor(match.id);
  return {
    matchId: match.id,
    pinned,
    hidden,
    qualifies,
    skipReasons: reasons,
    match: {
      id: match.id,
      homeTeam: { name: match.homeTeam.name, shortName: match.homeTeam.shortName, logo: match.homeTeam.logo },
      awayTeam: { name: match.awayTeam.name, shortName: match.awayTeam.shortName, logo: match.awayTeam.logo },
      kickoffTime: typeof match.kickoffTime === 'string' ? match.kickoffTime : new Date(match.kickoffTime).toISOString(),
      status: String(match.status),
      league: { name: match.league.name, country: match.league.country, countryCode: match.league.countryCode },
      sport: { name: match.sport.name, slug: match.sport.slug },
    },
    tip,
  };
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await getFeaturedConfig();
  const pinnedSet = new Set(config.pinnedMatchIds || []);
  const hiddenSet = new Set(config.hiddenMatchIds || []);

  // 1. Resolve pinned matches first so we always show them at the top.
  const pinnedItems: AdminTipItem[] = [];
  const seen = new Set<string>();
  for (const id of config.pinnedMatchIds) {
    if (!id || seen.has(id)) continue;
    try {
      const m = await getMatchById(id);
      if (m) {
        pinnedItems.push(toItem(m, true, hiddenSet.has(id), true, []));
        seen.add(id);
      } else {
        // Pin references a match we can no longer resolve — show as a stub
        // row so the admin can still un-pin it.
        pinnedItems.push({
          matchId: id,
          pinned: true,
          hidden: hiddenSet.has(id),
          qualifies: false,
          skipReasons: ['match not found upstream'],
          match: {
            id,
            homeTeam: { name: 'Unknown', shortName: '', logo: undefined },
            awayTeam: { name: 'Unknown', shortName: '', logo: undefined },
            kickoffTime: new Date().toISOString(),
            status: 'unknown',
            league: { name: 'Unknown', country: '', countryCode: '' },
            sport: { name: '', slug: '' },
          },
          tip: bestTipFor(id),
        });
      }
    } catch (e) {
      console.warn('[admin/featured/tips] pinned lookup failed:', id, e);
    }
  }

  // 2. List today's upcoming matches with qualification flags.
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

  const todayItems: ReturnType<typeof toItem>[] = [];
  for (const m of candidates) {
    if (seen.has(m.id)) continue;
    const ts = new Date(m.kickoffTime).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < now - 2 * 60 * 1000) continue;
    if (ts > endTs) continue;
    const sNorm = String(m.status || '').toLowerCase();
    if (sNorm && sNorm !== 'scheduled' && sNorm !== 'upcoming' && sNorm !== 'ns') continue;

    const reasons: string[] = [];
    const tip = bestTipFor(m.id);
    if (config.sport && m.sport?.slug !== config.sport) reasons.push(`sport ≠ ${config.sport}`);
    if (tip.confidence < config.minConfidence) reasons.push(`confidence ${tip.confidence}% < ${config.minConfidence}%`);
    if (tip.odds < config.minOdds) reasons.push(`odds ${tip.odds} < ${config.minOdds}`);
    if (tip.odds > config.maxOdds) reasons.push(`odds ${tip.odds} > ${config.maxOdds}`);
    if (config.topTipsterOnly && tip.tipster.rank > 5) reasons.push('not a top-5 tipster');
    if (hiddenSet.has(m.id)) reasons.push('hidden by admin');

    const qualifies = reasons.length === 0;
    todayItems.push(toItem(m, pinnedSet.has(m.id), hiddenSet.has(m.id), qualifies, reasons));
    seen.add(m.id);
  }

  // Sort: qualifying first (by confidence desc), then non-qualifying (by kickoff asc).
  todayItems.sort((a, b) => {
    if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
    if (a.qualifies) return b.tip.confidence - a.tip.confidence;
    return new Date(a.match.kickoffTime).getTime() - new Date(b.match.kickoffTime).getTime();
  });

  return NextResponse.json({
    config,
    pinned: pinnedItems,
    today: todayItems,
    counts: {
      pinned: pinnedItems.length,
      qualifying: todayItems.filter(i => i.qualifies).length,
      todayTotal: todayItems.length,
    },
  });
}
