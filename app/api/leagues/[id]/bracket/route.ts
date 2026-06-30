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
// `slugs` lists ESPN season.slug values that map to this round
// (used when competitions[0].notes[0].headline is absent — e.g. FIFA World Cup).
const ROUND_ORDER: Array<{ rx: RegExp; code: string; label: string; order: number; slugs: string[] }> = [
  { rx: /round of 64|r64/i,            code: 'R64', label: 'Round of 64',    order: 1, slugs: ['round-of-64'] },
  { rx: /round of 32|r32/i,            code: 'R32', label: 'Round of 32',    order: 2, slugs: ['round-of-32'] },
  { rx: /round of 16|r16|last 16/i,    code: 'R16', label: 'Round of 16',    order: 3, slugs: ['round-of-16'] },
  { rx: /quarter[- ]?final|qf/i,       code: 'QF',  label: 'Quarter-finals', order: 4, slugs: ['quarterfinals', 'quarter-finals', 'quarterfinal'] },
  { rx: /semi[- ]?final|sf/i,          code: 'SF',  label: 'Semi-finals',    order: 5, slugs: ['semifinals', 'semi-finals', 'semifinal'] },
  { rx: /third[- ]place|3rd[- ]place/i, code: '3P', label: '3rd Place',      order: 6, slugs: ['3rd-place-match', '3rd-place', 'third-place', 'third-place-match'] },
  { rx: /\bfinal\b/i,                  code: 'F',   label: 'Final',          order: 7, slugs: ['final', 'championship', 'championship-match'] },
];

/**
 * Determine the knockout round from an ESPN event.
 *
 * ESPN delivers round information via two separate fields depending on the
 * competition:
 *   • competitions[0].notes[0].headline  — used by UEFA CL, EFL Cup, Copa, etc.
 *     (may also carry "1st Leg" / "2nd Leg" for two-legged ties)
 *   • ev.season.slug                     — used by FIFA World Cup 2026 and other
 *     FIFA tournaments where notes are absent
 *
 * We check the headline first (richer, includes leg info), then fall back to
 * the season slug.
 */
function parseRound(
  headline: string | undefined | null,
  seasonSlug?: string | null,
): { code: string; label: string; order: number; leg: 1 | 2 | 0 } | null {
  const text = (headline || '').toString();

  // 1. Try headline regex (works for UEFA competitions and FA Cup).
  let round = ROUND_ORDER.find(r => r.rx.test(text));

  // 2. Fall back to season.slug (works for FIFA World Cup, FIFA U20/U17, etc.).
  // Normalize the slug: lowercase, strip hyphens/underscores, so variants like
  // 'quarter-finals', 'quarterfinals', 'quarter_finals' all match.
  if (!round && seasonSlug) {
    const rawSlug = seasonSlug.toLowerCase();
    // First try exact match in known slug list.
    round = ROUND_ORDER.find(r => r.slugs.includes(rawSlug));
    // If still no match, try normalized (no separators) comparison.
    if (!round) {
      const normSlug = rawSlug.replace(/[-_\s]+/g, '');
      round = ROUND_ORDER.find(r =>
        r.slugs.some(s => s.replace(/[-_\s]+/g, '') === normSlug)
      );
    }
    // Last-resort: try slug against the headline regex patterns.
    if (!round) {
      const slugAsText = rawSlug.replace(/-/g, ' ');
      round = ROUND_ORDER.find(r => r.rx.test(slugAsText));
    }
  }

  if (!round) return null;

  // Leg detection — only meaningful when headline carries "1st Leg" / "2nd Leg".
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
  /** ESPN season metadata — `slug` carries the round name for FIFA tournaments */
  season?: { year?: number; type?: number; slug?: string; name?: string };
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
    const seasonSlug = ev.season?.slug;
    const round = parseRound(headline, seasonSlug);
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

  // Known cup / knockout-format competition IDs. For these we show a
  // "knockout stage not yet published" placeholder instead of nothing.
  const CUP_LEAGUE_IDS = new Set([
    29,  // FIFA World Cup
    9,   // Champions League
    10,  // Europa League
    26,  // Conference League
    25,  // Copa Libertadores
    109, // FIFA Club World Cup
    30,  // Euro Championship
    44,  // FA Cup
    45,  // EFL Cup
    47,  // Copa del Rey
    49,  // DFB Pokal
    51,  // Coppa Italia
    53,  // Coupe de France
    77,  // US Open Cup
    110, // FIFA U20 World Cup
    211, // FIFA U17 World Cup
  ]);
  const isCupCompetition = CUP_LEAGUE_IDS.has(leagueId);

  // Some cups (FA Cup, MLS Playoffs in single-leg years) don't expose a
  // round headline at all; in that case we can't build a meaningful bracket.
  if (knockoutEventCount === 0) {
    return NextResponse.json({ isKnockout: false, isCupCompetition, rounds: [], season: '' });
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
        const state = ev.status?.type?.state || 'pre';
        const completed = !!ev.status?.type?.completed;
        // Only read scores when the match has actually started — ESPN returns
        // score "0" even for pre-game events, which causes every upcoming
        // match to show 0-0 instead of "Upcoming".
        const hScore = state !== 'pre' && h?.score != null && h.score !== '' ? Number(h.score) : null;
        const aScore = state !== 'pre' && a?.score != null && a.score !== '' ? Number(a.score) : null;
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
        const round = parseRound(ev.competitions?.[0]?.notes?.[0]?.headline, ev.season?.slug);
        legObjs.push({
          matchId: `espn_${cfg.league.replace(/[^a-z0-9]/gi, '')}_${ev.id}`,
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

    // Sort ties chronologically by their first leg date.
    // Do NOT sort by status (finished-first) — that destroys bracket pairing order
    // (e.g. all finished R32 matches would cluster together even if they're in
    //  different halves of the bracket).
    ties.sort((a, b) => {
      const da = a.legs[0]?.date ?? '';
      const db = b.legs[0]?.date ?? '';
      return da.localeCompare(db);
    });

    rounds.push({ code, label: meta.label, order: meta.order, ties });
  }

  rounds.sort((a, b) => a.order - b.order);

  // ── Bracket-slot reordering ──────────────────────────────────────────────
  // The bracket component groups consecutive tie pairs ([0,1], [2,3], …)
  // and draws connector lines between each pair and the corresponding next-
  // round slot. For the pairs to be correct we must ensure the two R32 ties
  // that feed into the same R16 slot are truly adjacent in the tie array.
  //
  // ESPN doesn't expose a bracketSequence field, but later-round events DO
  // include the real team IDs of the winners. We use those IDs to trace back
  // to the correct earlier-round ties and reorder them.
  //
  // We apply the reorder from the deepest round pair inward so that each
  // pass can benefit from an already-corrected later round.
  for (let i = 0; i < rounds.length - 1; i++) {
    reorderByNextRound(rounds[i], rounds[i + 1]);
  }

  return NextResponse.json({
    isKnockout: rounds.length > 0,
    rounds,
    season: events[0]?.season?.year ? String(events[0].season.year) : '',
  });
}

/**
 * Re-orders `earlyRound.ties` so that the two ties that feed into each
 * `laterRound` slot are adjacent (as consecutive pairs).
 *
 * Strategy:
 *   1. Build a map  teamId → earlyRound tie  for all real (non-placeholder)
 *      teams. ESPN uses large synthetic IDs (≥ 100 000) for unresolved
 *      bracket slots; we skip those.
 *   2. Walk laterRound.ties in their current (date-sorted) order. For each
 *      later-round tie, look up both team IDs in the map. If found and not
 *      yet assigned, those are the two early-round feeders for this slot.
 *   3. Any early-round ties not resolved via team-ID lookup are appended in
 *      chronological order after all resolved pairs, filling null slots.
 */
function reorderByNextRound(earlyRound: RoundOut, laterRound: RoundOut): void {
  const PLACEHOLDER_THRESHOLD = 100_000;

  const teamIdToTie = new Map<string, Tie>();
  for (const tie of earlyRound.ties) {
    const hNum = parseInt(tie.homeTeam.id, 10);
    const aNum = parseInt(tie.awayTeam.id, 10);
    if (!isNaN(hNum) && hNum < PLACEHOLDER_THRESHOLD) teamIdToTie.set(tie.homeTeam.id, tie);
    if (!isNaN(aNum) && aNum < PLACEHOLDER_THRESHOLD) teamIdToTie.set(tie.awayTeam.id, tie);
  }

  const assigned = new Set<string>(); // tie.id values already placed
  const pairs: Array<[Tie | null, Tie | null]> = [];

  for (const laterTie of laterRound.ties) {
    let slotA: Tie | null = null;
    let slotB: Tie | null = null;

    for (const teamId of [laterTie.homeTeam.id, laterTie.awayTeam.id]) {
      if (!teamIdToTie.has(teamId)) continue;
      const candidate = teamIdToTie.get(teamId)!;
      if (assigned.has(candidate.id)) continue;
      assigned.add(candidate.id);
      if (slotA === null) slotA = candidate;
      else slotB = candidate;
    }

    pairs.push([slotA, slotB]);
  }

  // Remaining ties not resolved via team-ID — sorted chronologically.
  const remaining = earlyRound.ties
    .filter(t => !assigned.has(t.id))
    .sort((a, b) => (a.legs[0]?.date ?? '').localeCompare(b.legs[0]?.date ?? ''));

  let remIdx = 0;
  for (const pair of pairs) {
    if (pair[0] === null) pair[0] = remaining[remIdx++] ?? null;
    if (pair[1] === null) pair[1] = remaining[remIdx++] ?? null;
  }

  const result: Tie[] = [];
  for (const [a, b] of pairs) {
    if (a) result.push(a);
    if (b) result.push(b);
  }
  while (remIdx < remaining.length) result.push(remaining[remIdx++]);

  if (result.length > 0) earlyRound.ties = result;
}
