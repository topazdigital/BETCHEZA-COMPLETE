import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listFollowedTeams, listFollowedTipsters } from '@/lib/follows-store';

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

  // Use the internal loopback URL so server-side self-fetch works regardless
  // of any reverse proxy / mTLS in front of the app (otherwise on Replit dev
  // the public hostname is unreachable from inside the container and the
  // followed-tipster panel + upcoming/results stay empty).
  const url = new URL(req.url);
  const port = process.env.PORT || '5000';
  const baseUrl = process.env.INTERNAL_BASE_URL
    ? process.env.INTERNAL_BASE_URL
    : (process.env.NODE_ENV === 'production' ? `${url.protocol}//${url.host}` : `http://127.0.0.1:${port}`);

  // Run team + tipster data fetches in parallel.
  const [teamData, tipsterData] = await Promise.all([
    Promise.all(
      followedTeams.slice(0, 12).map((t) =>
        fetchTeamData(t.teamId, baseUrl).then((d) => ({ follow: t, data: d })),
      ),
    ),
    Promise.all(
      followedTipsterIds.slice(0, 8).map((id) =>
        fetchTipsterData(id, baseUrl).then((d) => ({ id, data: d })),
      ),
    ),
  ]);

  const upcomingMatches: Array<Record<string, unknown>> = [];
  const recentResults: Array<Record<string, unknown>> = [];
  for (const { follow, data } of teamData) {
    const teamObj = {
      id: follow.teamId,
      name: data?.team?.name || follow.teamName,
      logo: data?.team?.logo || follow.teamLogo,
    };
    for (const ev of (data?.upcoming || []).slice(0, 3)) {
      upcomingMatches.push({ ...(ev as object), team: teamObj, league: { name: follow.leagueName, slug: follow.leagueSlug, countryCode: follow.countryCode } });
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
