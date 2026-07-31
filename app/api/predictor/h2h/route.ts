import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORT_LEAGUE_MAP: Record<string, { sport: string; leagues: string[] }> = {
  football: { sport: 'soccer', leagues: ['eng.1','esp.1','ger.1','ita.1','fra.1','ned.1','por.1','sco.1','bel.1','tur.1','uefa.champions','uefa.europa','usa.1','bra.1','arg.1','ksa.1','mex.1','aus.1','jpn.1'] },
  soccer: { sport: 'soccer', leagues: ['eng.1','esp.1','ger.1','ita.1','fra.1','ned.1','por.1','sco.1','bel.1','tur.1','uefa.champions','uefa.europa','usa.1','bra.1','arg.1','ksa.1','mex.1'] },
  basketball: { sport: 'basketball', leagues: ['nba'] },
  'american-football': { sport: 'football', leagues: ['nfl'] },
  baseball: { sport: 'baseball', leagues: ['mlb'] },
  'ice-hockey': { sport: 'hockey', leagues: ['nhl'] },
};

interface ESPNCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
  score?: { value?: number; displayValue?: string } | string;
  team: {
    id: string;
    displayName: string;
    shortDisplayName?: string;
    logos?: Array<{ href: string }>;
  };
}

interface ESPNEvent {
  id: string;
  date: string;
  name: string;
  competitions: Array<{
    id: string;
    status?: { type?: { name?: string; completed?: boolean } };
    competitors: ESPNCompetitor[];
    venue?: { fullName?: string };
    season?: { displayName?: string };
  }>;
  season?: { displayName?: string };
  seasonType?: { name?: string };
}

function getScore(s: ESPNCompetitor['score']): number | null {
  if (s == null) return null;
  if (typeof s === 'object' && s !== null) {
    if (typeof s.value === 'number') return s.value;
    if (s.displayValue) return parseFloat(s.displayValue);
  }
  if (typeof s === 'string') return parseFloat(s);
  return null;
}

async function fetchTeamSchedule(sport: string, league: string, teamId: string, season: number): Promise<ESPNEvent[]> {
  try {
    const url = `${ESPN_BASE}/${sport}/${league}/teams/${teamId}/schedule?season=${season}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const d = await res.json() as { events?: ESPNEvent[] };
    return d.events ?? [];
  } catch {
    return [];
  }
}

function inferSportLeagues(sportSlug?: string): Array<{ sport: string; league: string }> {
  const key = (sportSlug ?? 'football').toLowerCase().replace(/[-_ ]/g, '-');
  const cfg = SPORT_LEAGUE_MAP[key] ?? SPORT_LEAGUE_MAP['football'];
  return cfg.leagues.map(l => ({ sport: cfg.sport, league: l }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const homeId = searchParams.get('homeId');
  const awayId = searchParams.get('awayId');
  const homeName = searchParams.get('homeName') ?? 'Home';
  const awayName = searchParams.get('awayName') ?? 'Away';
  const homeLogo = searchParams.get('homeLogo') ?? '';
  const awayLogo = searchParams.get('awayLogo') ?? '';
  const sportSlug = searchParams.get('sport') ?? 'football';

  if (!homeId || !awayId) {
    return NextResponse.json({ error: 'homeId and awayId are required' }, { status: 400 });
  }

  const configs = inferSportLeagues(sportSlug);
  const currentYear = new Date().getFullYear();
  const seasons = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  // Fetch home team schedule across multiple seasons and leagues
  // Try leagues in priority order, stop when we find events
  let allHomeEvents: ESPNEvent[] = [];
  let usedSport = configs[0].sport;
  let usedLeague = configs[0].league;

  const schedulePromises: Promise<ESPNEvent[]>[] = [];
  // Try top 4 leagues with recent 2 seasons to find where this team plays
  const leaguesToTry = configs.slice(0, 6);
  const seasonsToTry = seasons.slice(0, 2);

  for (const { sport, league } of leaguesToTry) {
    for (const season of seasonsToTry) {
      schedulePromises.push(
        fetchTeamSchedule(sport, league, homeId, season).then(evts => {
          if (evts.length > 0) {
            usedSport = sport;
            usedLeague = league;
          }
          return evts;
        })
      );
    }
  }

  const allResults = await Promise.allSettled(schedulePromises);
  for (const r of allResults) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      allHomeEvents = [...allHomeEvents, ...r.value];
    }
  }

  // If nothing found in first 6 leagues, try remaining leagues with current season only
  if (allHomeEvents.length === 0) {
    const fallbackPromises = configs.slice(6).map(({ sport, league }) =>
      fetchTeamSchedule(sport, league, homeId, currentYear)
    );
    const fallbackResults = await Promise.allSettled(fallbackPromises);
    let fi = 6;
    for (const r of fallbackResults) {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        allHomeEvents = [...allHomeEvents, ...r.value];
        usedSport = configs[fi].sport;
        usedLeague = configs[fi].league;
        break;
      }
      fi++;
    }
  }

  // Filter to only completed matches where away team also played
  interface MeetingRecord {
    date: string;
    homeScore: number;
    awayScore: number;
    competition: string;
    homeWasHome: boolean;
  }

  const meetings: MeetingRecord[] = [];
  let homeGoals = 0;
  let awayGoals = 0;

  for (const evt of allHomeEvents) {
    const comp = evt.competitions?.[0];
    if (!comp) continue;
    const statusName = comp.status?.type?.name ?? '';
    const completed = (comp.status?.type?.completed ?? false) || statusName.includes('FULL_TIME') || statusName.includes('FINAL') || statusName.includes('FT') || statusName.includes('STATUS_FINAL');
    if (!completed) continue;

    const competitors = comp.competitors ?? [];
    const homeComp = competitors.find(c => c.homeAway === 'home');
    const awayComp = competitors.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const allIds = competitors.map(c => c.id);
    if (!allIds.includes(awayId)) continue;

    const homeTeamComp = competitors.find(c => c.id === homeId);
    const awayTeamComp = competitors.find(c => c.id === awayId);
    if (!homeTeamComp || !awayTeamComp) continue;

    const hScore = getScore(homeTeamComp.score);
    const aScore = getScore(awayTeamComp.score);
    if (hScore == null || aScore == null) continue;

    const homeWasHome = homeTeamComp.homeAway === 'home';
    const actualHomeScore = homeWasHome ? hScore : aScore;
    const actualAwayScore = homeWasHome ? aScore : hScore;

    const seasonLabel = evt.season?.displayName ?? comp.season?.displayName ?? '';
    const competition = seasonLabel || evt.name.split(' at ')[0] || 'Unknown competition';

    meetings.push({
      date: evt.date.split('T')[0],
      homeScore: actualHomeScore,
      awayScore: actualAwayScore,
      competition,
      homeWasHome,
    });

    homeGoals += actualHomeScore;
    awayGoals += actualAwayScore;
  }

  // Deduplicate by date (same match can appear in multiple season fetches)
  const seen = new Set<string>();
  const dedupedMeetings = meetings.filter(m => {
    const key = `${m.date}-${m.homeScore}-${m.awayScore}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  dedupedMeetings.sort((a, b) => b.date.localeCompare(a.date));

  const played = dedupedMeetings.length;

  if (played === 0) {
    // No historical data — return a data-source error rather than fake data
    return NextResponse.json({
      noData: true,
      homeTeam: homeName,
      awayTeam: awayName,
      homeLogo,
      awayLogo,
      message: 'No historical meetings found between these teams in available data sources.',
    });
  }

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;

  for (const m of dedupedMeetings) {
    totalHomeGoals += m.homeScore;
    totalAwayGoals += m.awayScore;
    if (m.homeScore > m.awayScore) homeWins++;
    else if (m.awayScore > m.homeScore) awayWins++;
    else draws++;
  }

  const homeWinPct = homeWins / played;
  const awayWinPct = awayWins / played;

  let winner: 'home' | 'away' | 'draw';
  if (homeWinPct >= awayWinPct && homeWinPct >= draws / played) winner = homeWinPct > 0.35 ? 'home' : 'draw';
  else if (awayWinPct > homeWinPct) winner = 'away';
  else winner = 'draw';

  const confidence = Math.min(85, Math.round(
    50 + Math.abs(homeWinPct - awayWinPct) * 60 + (played >= 5 ? 10 : played * 2)
  ));

  const tip: Record<'home' | 'away' | 'draw', string> = {
    home: `${homeName} have the better H2H record — back them to win.`,
    away: `${awayName} edge these meetings historically — value in the away win.`,
    draw: `These sides are closely matched over ${played} meetings — a draw is likely.`,
  };

  const p = 1.06;
  const homeOdds = +(Math.max(1.25, p / Math.max(0.12, homeWinPct + 0.05))).toFixed(2);
  const drawOdds = draws > 0 ? +(Math.max(2.6, p / Math.max(0.08, draws / played))).toFixed(2) : undefined;
  const awayOdds = +(Math.max(1.25, p / Math.max(0.12, awayWinPct + 0.05))).toFixed(2);

  return NextResponse.json({
    homeTeam: homeName,
    awayTeam: awayName,
    homeLogo,
    awayLogo,
    played,
    homeWins,
    draws,
    awayWins,
    homeGoals: totalHomeGoals,
    awayGoals: totalAwayGoals,
    lastMeetings: dedupedMeetings.slice(0, 8).map(m => ({
      date: m.date,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      competition: m.competition,
    })),
    prediction: {
      winner,
      confidence,
      tip: tip[winner],
      reasoning: `Based on ${played} real historical meetings: ${homeName} won ${homeWins}, draws ${draws}, ${awayName} won ${awayWins}.`,
    },
    odds: { home: homeOdds, draw: drawOdds, away: awayOdds },
    dataSource: 'ESPN',
  });
}
