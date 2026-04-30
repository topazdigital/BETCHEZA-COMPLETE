import { NextRequest, NextResponse } from 'next/server';
import { ESPN_LEAGUES } from '@/lib/api/unified-sports-api';

// Knockout bracket endpoint for cup competitions.
// Pulls the season's scoreboard from ESPN (no API key needed), parses the
// round label out of `competitions[0].notes[0].headline`, and groups fixtures
// into rounds. Two-legged ties (Champions League knockouts, etc.) are paired
// across "1st Leg"/"2nd Leg" and the aggregate score is computed.
//
// Returns:
//   { isKnockout: boolean, rounds: Round[], season: string }
//
// where each Round has ordered ties — each tie has a homeTeam, awayTeam,
// optional aggregate, and the underlying legs. The shape is intentionally
// flat so the React bracket component can render columns trivially.

export const dynamic = 'force-dynamic';
export const revalidate = 600;
export const runtime = 'nodejs';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

// Round name → code + sort order. Lowest order = earliest round in the bracket.
const ROUND_ORDER: Array<{ rx: RegExp; code: string; label: string; order: number }> = [
  { rx: /round of 64|r64/i,        code: 'R64', label: 'Round of 64',     order: 1 },
  { rx: /round of 32|r32/i,        code: 'R32', label: 'Round of 32',     order: 2 },
  { rx: /round of 16|r16|last 16/i, code: 'R16', label: 'Round of 16',     order: 3 },
  { rx: /quarter[- ]?final|qf/i,   code: 'QF',  label: 'Quarter-finals',  order: 4 },
  { rx: /semi[- ]?final|sf/i,      code: 'SF',  label: 'Semi-finals',     order: 5 },
  { rx: /third[- ]place|3rd[- ]place/i, code: '3P', label: '3rd Place',  order: 6 },
  { rx: /\bfinal\b/i,              code: 'F',   label: 'Final',           order: 7 },
];

function parseRound(headline: string | undefined | null): { code: string; label: string; order: number; leg: 1 | 2 | 0 } | null {
  if (!headline) return null;
  const text = headline.toString();
  const round = ROUND_ORDER.find(r => r.rx.test(text));
  if (!round) return null;
  // Leg detection — "1st Leg", "2nd Leg", "Leg 1", or no leg (single-match round).
  let leg: 1 | 2 | 0 = 0;
  if (/\b1st leg|leg 1|first leg\b/i.test(text)) leg = 1;
  else if (/\b2nd leg|leg 2|second leg\b/i.test(text)) leg = 2;
  return { code: round.code, label: round.label, order: round.order, leg };
}

interface ESPNCompetitor {
  id?: string;
  homeAway?: 'home' | 'away';
  score?: string;
  team?: { id?: string; displayName?: string; shortDisplayName?: string; logo?: string; abbreviation?: string };
  winner?: boolean;
}
interface ESPNEvent {
  id: string;
  date: string;
  status?: { type?: { state?: string; completed?: boolean; description?: string } };
  competitions?: Array<{
    notes?: Array<{ type?: string; headline?: string }>;
    competitors?: ESPNCompetitor[];
  }>;
  season?: { year?: number; type?: { name?: string } };
}

interface Leg {
  matchId: string;
  date: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  legNumber: 1 | 2 | 0;
}

interface Tie {
  id: string;
  homeTeam: { id: string; name: string; logo?: string };
  awayTeam: { id: string; name: string; logo?: string };
  legs: Leg[];
  aggregate: { home: number; away: number } | null;
  winnerSide: 'home' | 'away' | 'draw' | null;
  status: 'scheduled' | 'in-progress' | 'finished';
}

interface RoundOut {
  code: string;
  label: string;
  order: number;
  ties: Tie[];
}

function fmt(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function fetchAllEvents(sport: string, league: string): Promise<ESPNEvent[]> {
  // Knockout phases run roughly Feb–June for UEFA, Jan–May for FA Cup.
  // Walk the year in 30-day windows so we capture all rounds without
  // hammering ESPN. Cached by Next.js revalidate per URL.
  const today = new Date();
  const starts: Date[] = [];
  // Look back 9 months and forward 6 months — enough to cover an entire knockout season.
  for (let m = -9; m <= 6; m++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m, 1));
    starts.push(d);
  }
  const urls = starts.map((s) => {
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
    return `${ESPN_BASE}/${sport}/${league}/scoreboard?dates=${fmt(s)}-${fmt(e)}`;
  });

  const results = await Promise.allSettled(
    urls.map(url => fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 600 },
    }).then(r => r.ok ? r.json() : null).catch(() => null))
  );

  const seen = new Set<string>();
  const events: ESPNEvent[] = [];
  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    const data = res.value as { events?: ESPNEvent[] };
    for (const ev of data.events || []) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      events.push(ev);
    }
  }
  return events;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leagueId = parseInt(id, 10);
  if (!Number.isFinite(leagueId)) {
    return NextResponse.json({ isKnockout: false, rounds: [] }, { status: 400 });
  }
  const cfg = ESPN_LEAGUES.find(l => l.leagueId === leagueId);
  if (!cfg) {
    // Unknown / non-ESPN league — bracket simply not available.
    return NextResponse.json({ isKnockout: false, rounds: [] });
  }

  const events = await fetchAllEvents(cfg.sport, cfg.league);

  // Bucket events by round code, then by team-pair for two-legged ties.
  type Bucket = Map<string, { events: ESPNEvent[]; round: ReturnType<typeof parseRound> }>;
  const byRound = new Map<string, Bucket>();
  let knockoutEventCount = 0;

  for (const ev of events) {
    const headline = ev.competitions?.[0]?.notes?.[0]?.headline;
    const round = parseRound(headline);
    if (!round) continue;
    knockoutEventCount += 1;

    const competitors = ev.competitions?.[0]?.competitors || [];
    if (competitors.length < 2) continue;
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
    const homeId = home.team?.id || home.id || 'h';
    const awayId = away.team?.id || away.id || 'a';
    // Pair key is order-independent — same two teams across two legs share a key.
    const pairKey = [homeId, awayId].sort().join('-');

    const roundBucket = byRound.get(round.code) ?? new Map();
    const tieBucket = roundBucket.get(pairKey) ?? { events: [], round };
    tieBucket.events.push(ev);
    roundBucket.set(pairKey, tieBucket);
    byRound.set(round.code, roundBucket);
  }

  // Some cups (FA Cup, MLS Playoffs in single-leg years) don't expose a
  // round headline at all; in that case we can't build a meaningful bracket.
  if (knockoutEventCount === 0) {
    return NextResponse.json({ isKnockout: false, rounds: [], season: '' });
  }

  const rounds: RoundOut[] = [];
  for (const [code, bucket] of byRound.entries()) {
    const meta = ROUND_ORDER.find(r => r.code === code)!;
    const ties: Tie[] = [];

    for (const [, tie] of bucket.entries()) {
      // Sort legs by date so leg 1 comes first.
      const legs = [...tie.events].sort((a, b) => +new Date(a.date) - +new Date(b.date));
      const first = legs[0];
      const compsFirst = first.competitions?.[0]?.competitors || [];
      const homeComp = compsFirst.find(c => c.homeAway === 'home') || compsFirst[0];
      const awayComp = compsFirst.find(c => c.homeAway === 'away') || compsFirst[1];
      // For two-legged ties we standardise the "tie home" as the team that
      // hosted leg 1 (UEFA convention). Aggregate then sums each side's
      // goals across both legs ignoring venue.
      const tieHomeId = homeComp?.team?.id;
      const tieAwayId = awayComp?.team?.id;

      let aggHome = 0;
      let aggAway = 0;
      let anyScored = false;
      let anyInProgress = false;
      let anyScheduled = false;
      let anyFinished = false;
      const legObjs: Leg[] = [];

      for (const ev of legs) {
        const c = ev.competitions?.[0]?.competitors || [];
        const h = c.find(x => x.homeAway === 'home') || c[0];
        const a = c.find(x => x.homeAway === 'away') || c[1];
        const hScore = h?.score != null && h.score !== '' ? Number(h.score) : null;
        const aScore = a?.score != null && a.score !== '' ? Number(a.score) : null;
        const state = ev.status?.type?.state || 'pre';
        const completed = !!ev.status?.type?.completed;
        if (state === 'in') anyInProgress = true;
        else if (state === 'pre') anyScheduled = true;
        if (completed) anyFinished = true;

        if (hScore != null && aScore != null) {
          anyScored = true;
          // Map the leg's home/away to the tie's standard home/away.
          if (h?.team?.id === tieHomeId) {
            aggHome += hScore;
            aggAway += aScore;
          } else {
            aggHome += aScore;
            aggAway += hScore;
          }
        }
        const round = parseRound(ev.competitions?.[0]?.notes?.[0]?.headline);
        legObjs.push({
          matchId: ev.id,
          date: ev.date,
          homeScore: hScore,
          awayScore: aScore,
          status: state,
          legNumber: round?.leg ?? 0,
        });
      }

      const status: Tie['status'] =
        anyInProgress ? 'in-progress'
        : (anyFinished && !anyScheduled) ? 'finished'
        : 'scheduled';

      const winnerSide: Tie['winnerSide'] = status === 'finished'
        ? aggHome > aggAway ? 'home' : aggHome < aggAway ? 'away' : 'draw'
        : null;

      ties.push({
        id: `${meta.code}-${tieHomeId || 'x'}-${tieAwayId || 'y'}`,
        homeTeam: { id: tieHomeId || 'h', name: homeComp?.team?.displayName || 'TBD', logo: homeComp?.team?.logo },
        awayTeam: { id: tieAwayId || 'a', name: awayComp?.team?.displayName || 'TBD', logo: awayComp?.team?.logo },
        legs: legObjs,
        aggregate: anyScored ? { home: aggHome, away: aggAway } : null,
        winnerSide,
        status,
      });
    }

    // Tie ordering within a round: finished first (chronological), then in-play, then upcoming.
    ties.sort((a, b) => {
      const order = { finished: 0, 'in-progress': 1, scheduled: 2 } as const;
      return order[a.status] - order[b.status];
    });

    rounds.push({ code, label: meta.label, order: meta.order, ties });
  }

  rounds.sort((a, b) => a.order - b.order);

  return NextResponse.json({
    isKnockout: rounds.length > 0,
    rounds,
    season: events[0]?.season?.year ? String(events[0].season.year) : '',
  });
}
