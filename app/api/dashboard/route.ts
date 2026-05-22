import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listFollowedTeams, getFollowedTipsters as listFollowedTipsters } from '@/lib/follows-store';
import { getFakeTipsterById } from '@/lib/fake-tipsters';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TeamApiResponse {
  team?: { id?: string; name?: string; logo?: string };
  past?: unknown[];
  upcoming?: unknown[];
}

interface RecentTip {
  id: number;
  market: string;
  selection: string;
  odds: number;
  stake: number;
  status: 'pending' | 'won' | 'lost' | 'void' | string;
  confidence: number;
  createdAt: string;
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    league: string;
    sport: string;
    homeScore: number | null;
    awayScore: number | null;
    kickoffTime: string;
  };
}

interface TipsterApiResponse {
  tipster?: {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
    countryCode?: string | null;
    winRate: number;
    roi: number;
    totalTips: number;
    streak: number;
    isPro?: boolean;
    verified?: boolean;
  };
  recentTips?: RecentTip[];
}

async function fetchTeamData(teamId: string, baseUrl: string): Promise<TeamApiResponse | null> {
  try {
    const r = await fetch(`${baseUrl}/api/teams/${encodeURIComponent(teamId)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!r.ok) return null;
    return (await r.json()) as TeamApiResponse;
  } catch {
    return null;
  }
}

async function fetchTipsterData(tipsterId: number, baseUrl: string): Promise<TipsterApiResponse | null> {
  try {
    const r = await fetch(`${baseUrl}/api/tipsters/${tipsterId}?includeStats=false`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
    });
    if (!r.ok) return null;
    return (await r.json()) as TipsterApiResponse;
  } catch (e) {
    console.warn('[dashboard] tipster fetch failed', tipsterId, e);
    return null;
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      teams: [],
      upcomingMatches: [],
      recentResults: [],
      followedTipsters: [],
    });
  }
  const [followedTeams, followedTipsterIds] = await Promise.all([
    listFollowedTeams(user.userId),
    listFollowedTipsters(user.userId),
  ]);

  // Always use the direct internal loopback so self-fetches bypass any reverse
  // proxy / mTLS / Apache. On VPS production the app listens on port 5001.
  const internalPort = process.env.PORT || (process.env.NODE_ENV === 'production' ? '5001' : '5000');
  const baseUrl = process.env.INTERNAL_BASE_URL || `http://127.0.0.1:${internalPort}`;

  // Run team + tipster data fetches in parallel.
  const [teamData, tipsterData] = await Promise.all([
    Promise.all(
      followedTeams.slice(0, 12).map((t) =>
        fetchTeamData(t.teamId, baseUrl).then((d) => ({ follow: t, data: d })),
      ),
    ),
    Promise.all(
      followedTipsterIds.slice(0, 8).map(async (id) => {
        // For fake tipsters resolve locally without an HTTP hop.
        const fake = getFakeTipsterById(id);
        if (fake) {
          return {
            id,
            data: {
              tipster: {
                id: fake.id,
                username: fake.username,
                displayName: fake.displayName,
                avatar: fake.avatar ?? null,
                countryCode: null as string | null,
                winRate: fake.winRate,
                roi: fake.roi,
                totalTips: fake.totalTips,
                streak: fake.streak,
                isPro: fake.isPro,
                verified: fake.verified,
              },
              recentTips: [] as RecentTip[],
            } as TipsterApiResponse,
          };
        }
        return fetchTipsterData(id, baseUrl).then((d) => ({ id, data: d }));
      }),
    ),
  ]);

  // Build an odds lookup from the enriched match cache (may have Odds API data)
  // Key: normalized "teamA_vs_teamB_date" so we can inject real odds into ESPN events
  type CachedOdds = { home?: number; away?: number; draw?: number };
  const oddsLookup = new Map<string, CachedOdds>();
  try {
    const cachedMatches = await Promise.race([
      getAllMatches(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    for (const m of cachedMatches) {
      if (!m.odds?.home || !m.odds?.away) continue;
      const day = (m.kickoffTime instanceof Date ? m.kickoffTime : new Date(m.kickoffTime))
        .toISOString().slice(0, 10);
      // Key by both home+away and away+home so lookup works for either team perspective
      const k1 = `${m.homeTeam.id}_${m.awayTeam.id}_${day}`;
      const k2 = `${m.awayTeam.id}_${m.homeTeam.id}_${day}`;
      const flipped: CachedOdds = { home: m.odds.away, away: m.odds.home, draw: m.odds.draw };
      oddsLookup.set(k1, m.odds as CachedOdds);
      oddsLookup.set(k2, flipped);
      // Also key by just the team IDs in case dates don't align exactly
      oddsLookup.set(`${m.homeTeam.id}_${m.awayTeam.id}`, m.odds as CachedOdds);
      oddsLookup.set(`${m.awayTeam.id}_${m.homeTeam.id}`, flipped);
    }
  } catch { /* continue without enrichment */ }

  const upcomingMatches: Array<Record<string, unknown>> = [];
  const recentResults: Array<Record<string, unknown>> = [];
  for (const { follow, data } of teamData) {
    const teamObj = {
      id: follow.teamId,
      name: data?.team?.name || follow.teamName,
      logo: data?.team?.logo || follow.teamLogo,
    };
    for (const ev of (data?.upcoming || []).slice(0, 3)) {
      const evObj = ev as Record<string, unknown>;
      // Inject real odds from match cache when ESPN event has no odds
      const existingOdds = evObj.odds as CachedOdds | undefined;
      if (!existingOdds?.home || !existingOdds?.away) {
        const oppId = (evObj.opponent as Record<string, unknown> | undefined)?.id as string | undefined;
        const teamId = follow.teamId;
        const evDate = (evObj.date as string | undefined)?.slice(0, 10) || '';
        const isHome = evObj.isHome as boolean | undefined;
        // Try date-specific key first, then fallback to id-only key
        const lookupKey = isHome
          ? `${teamId}_${oppId}_${evDate}`
          : `${oppId}_${teamId}_${evDate}`;
        const fallbackKey = isHome ? `${teamId}_${oppId}` : `${oppId}_${teamId}`;
        const enrichedOdds = oddsLookup.get(lookupKey) || oddsLookup.get(fallbackKey);
        if (enrichedOdds?.home && enrichedOdds?.away) {
          (evObj as Record<string, unknown>).odds = enrichedOdds;
        }
      }
      upcomingMatches.push({ ...evObj, team: teamObj, league: { name: follow.leagueName, slug: follow.leagueSlug, countryCode: follow.countryCode } });
    }
    for (const ev of (data?.past || []).slice(0, 3)) {
      recentResults.push({ ...(ev as object), team: teamObj, league: { name: follow.leagueName, slug: follow.leagueSlug, countryCode: follow.countryCode } });
    }
  }

  upcomingMatches.sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
  recentResults.sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());

  // Build tipster summaries (with latest tip inline) + flatten recent tips
  const tipsterSummaries = tipsterData
    .filter((x): x is { id: number; data: TipsterApiResponse } => !!x.data?.tipster)
    .map(({ data }) => {
      const tips = data.recentTips || [];
      // Sort and pick the most recent pending or recent overall.
      const sorted = [...tips].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestTip = sorted[0] || null;
      return { ...data.tipster!, latestTip };
    });

  const tipsterFeed: Array<RecentTip & { tipster: { id: number; displayName: string; username: string; avatar: string | null } }> = [];
  for (const { data } of tipsterData) {
    if (!data?.tipster || !data.recentTips) continue;
    for (const tip of data.recentTips) {
      tipsterFeed.push({
        ...tip,
        tipster: {
          id: data.tipster.id,
          displayName: data.tipster.displayName,
          username: data.tipster.username,
          avatar: data.tipster.avatar,
        },
      });
    }
  }
  tipsterFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Aggregate W/L/Pending across followed tipsters' visible recent tips
  let won = 0, lost = 0, pending = 0;
  for (const t of tipsterFeed) {
    if (t.status === 'won') won++;
    else if (t.status === 'lost') lost++;
    else if (t.status === 'pending') pending++;
  }
  const settled = won + lost;
  const winRate = settled > 0 ? Math.round((won / settled) * 1000) / 10 : 0;
  const avgFollowedWinRate = tipsterSummaries.length > 0
    ? Math.round((tipsterSummaries.reduce((s, t) => s + (t.winRate || 0), 0) / tipsterSummaries.length) * 10) / 10
    : 0;
  const avgFollowedRoi = tipsterSummaries.length > 0
    ? Math.round((tipsterSummaries.reduce((s, t) => s + (t.roi || 0), 0) / tipsterSummaries.length) * 10) / 10
    : 0;

  return NextResponse.json({
    authenticated: true,
    teams: followedTeams,
    upcomingMatches: upcomingMatches.slice(0, 20),
    recentResults: recentResults.slice(0, 20),
    followedTipsters: followedTipsterIds,
    tipsters: tipsterSummaries,
    recentTips: tipsterFeed.slice(0, 12),
    stats: {
      teamsFollowed: followedTeams.length,
      tipstersFollowed: followedTipsterIds.length,
      tipsWon: won,
      tipsLost: lost,
      tipsPending: pending,
      winRate,
      avgFollowedWinRate,
      avgFollowedRoi,
    },
  });
}
