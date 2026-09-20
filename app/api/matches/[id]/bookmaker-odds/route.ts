import { NextRequest, NextResponse } from 'next/server';
import {
  getMatchById,
  extractEspnOdds,
  fetchESPNSummary,
  getEspnEventIdFromMatchId,
  getEspnLeagueConfigForId,
} from '@/lib/api/unified-sports-api';
import { getSgoBookmakerLines } from '@/lib/api/sportsgameodds';
import { getSharpApiBookmakerLines } from '@/lib/api/sharpapi';
import { getTheOddsApiMatchLines } from '@/lib/api/the-odds-api-match';
import { getSofaScoreOdds, extractSofaScoreEventId } from '@/lib/api/sofascore-odds';
import { getPinnacleOdds, getPinnacleLiveOdds } from '@/lib/api/pinnacle';
import { findSofaScoreEventId } from '@/lib/api/sofascore';
import { getBetfairOdds, isBetfairConfigured } from '@/lib/api/betfair';

const NO_DRAW_SPORTS = new Set([
  'basketball', 'baseball', 'tennis', 'mma', 'boxing', 'golf',
  'formula-1', 'racing', 'horse-racing', 'darts', 'snooker',
  'american-football', 'ice-hockey', 'table-tennis', 'cricket',
  'badminton', 'volleyball',
]);

const FINISHED_STATUSES = new Set([
  'finished', 'ft', 'full-time', 'final', 'ended', 'post',
  'complete', 'completed', 'aet', 'pen',
]);

const LIVE_STATUSES = new Set([
  'live', 'in-progress', 'inprogress', 'halftime',
  'extra_time', 'penalties', 'in_play',
]);

// Sports that Pinnacle covers (free guest API, via CF proxy)
const PINNACLE_SUPPORTED_SPORTS = new Set([
  'tennis', 'basketball', 'baseball', 'ice-hockey', 'hockey',
  'american-football', 'mma', 'boxing', 'esports', 'volleyball',
  'table-tennis', 'badminton', 'darts', 'rugby', 'rugby-league', 'snooker',
  'football', 'soccer',
]);

function pinnacleLineToBookmakerLine(
  pinnLine: { home: number; draw?: number; away: number },
  hasDraw: boolean,
  label = 'Pinnacle',
) {
  return {
    bookmaker: 'pinnacle',
    display: label,
    home: pinnLine.home,
    draw: hasDraw && pinnLine.draw ? pinnLine.draw : undefined,
    away: pinnLine.away,
  };
}

function bookmakerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mergeBookmakerLines(
  target: Array<{
    bookmaker: string;
    display: string;
    home: number;
    draw?: number;
    away: number;
    links?: { home?: string; draw?: string; away?: string };
  }>,
  incoming: Array<{
    bookmaker: string;
    display: string;
    home: number;
    draw?: number;
    away: number;
    links?: { home?: string; draw?: string; away?: string };
  }>,
) {
  const seen = new Set(target.map(line => bookmakerKey(line.bookmaker || line.display)));
  for (const line of incoming) {
    if (!line || !Number.isFinite(line.home) || !Number.isFinite(line.away) ||
        line.home <= 1 || line.away <= 1) continue;
    const key = bookmakerKey(line.bookmaker || line.display);
    if (!key || seen.has(key)) continue;
    target.push(line);
    seen.add(key);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const match = await getMatchById(id);
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const sportSlug = match.sport?.slug || 'football';
    const hasDraw   = !NO_DRAW_SPORTS.has(sportSlug);
    const status    = (match.status || '').toLowerCase();
    const isFinished = FINISHED_STATUSES.has(status);
    const isLive     = LIVE_STATUSES.has(status);

    // Don't serve odds for finished matches — no betting value
    if (isFinished) {
      return NextResponse.json(
        { lines: [], hasDraw, status, isFinished: true },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }

    const isoKickoff =
      typeof match.kickoffTime === 'string'
        ? match.kickoffTime
        : match.kickoffTime instanceof Date
        ? match.kickoffTime.toISOString()
        : new Date().toISOString();
    const kickoffMs = new Date(isoKickoff).getTime();

    // ── Source 1: SGO (SportsGameOdds) ──────────────────────────────────────
    // Best multi-book coverage when SPORTSGAMEODDS_API_KEY is configured.
    let lines = await getSgoBookmakerLines(
      match.homeTeam.name,
      match.awayTeam.name,
      isoKickoff,
      hasDraw,
    );

    // ── Source 2: ESPN embedded odds ─────────────────────────────────────────
    // The match cache can be older than the detail request, and ESPN often
    // embeds a live DraftKings/FanDuel line only in the summary response.
    // Fetch that response directly here so the bookmaker panel does not depend
    // on a separately refreshed all-matches cache.
    try {
      const cfg = getEspnLeagueConfigForId(match.id);
      const eventId = getEspnEventIdFromMatchId(match.id);
      const summary = cfg && eventId
        ? await Promise.race([
            fetchESPNSummary(cfg.sport, cfg.league, eventId),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 4_000)),
          ])
        : null;
      if (summary) {
        const { odds } = extractEspnOdds(
          [...(summary.pickcenter || []), ...(summary.odds || [])],
          hasDraw,
          cfg?.sportType || sportSlug,
          match.homeTeam.name,
          match.awayTeam.name,
        );
        if (odds) {
          mergeBookmakerLines(lines, [{
            bookmaker: odds.bookmaker || 'espn',
            display: odds.bookmaker || 'ESPN',
            home: odds.home,
            draw: odds.draw,
            away: odds.away,
          }]);
        }
      }
    } catch { /* ESPN is an optional real-provider source */ }

    // Cached match odds are also accepted only when they are provider-backed.
    const cachedOdds = match.odds && !(
      (match.odds as unknown as { isComputed?: boolean }).isComputed === true ||
      /estimated|computed|model/i.test(String((match.odds as unknown as { bookmaker?: string }).bookmaker || ''))
    ) ? match.odds : null;
    if (cachedOdds) {
      mergeBookmakerLines(lines, [{
        bookmaker: cachedOdds.bookmaker || 'espn',
        display: cachedOdds.bookmaker || 'ESPN',
        home: cachedOdds.home,
        draw: cachedOdds.draw,
        away: cachedOdds.away,
      }]);
    }

    // ── Source 3: TheOddsAPI h2h ─────────────────────────────────────────────
    // Covers ALL sports (tennis, basketball, cricket, NHL, NFL, MMA, rugby…).
    if (lines.length === 0) {
      const leagueName = match.league?.name ?? match.league?.slug ?? '';
      const theoddsLines = await getTheOddsApiMatchLines(
        match.homeTeam.name,
        match.awayTeam.name,
        isoKickoff,
        sportSlug,
        hasDraw,
        leagueName,
      );
      mergeBookmakerLines(lines, theoddsLines);
    }

    // ── Source 4a: Pinnacle LIVE (in-play) ─────────────────────────────────
    // For live matches: try Pinnacle's isLive=true endpoint first (60s cache).
    // Pinnacle offers live betting on tennis, basketball, football, MMA, etc.
    if (lines.length === 0 && isLive && PINNACLE_SUPPORTED_SPORTS.has(sportSlug)) {
      try {
        const pinnLive = await getPinnacleLiveOdds(
          match.homeTeam.name,
          match.awayTeam.name,
          sportSlug,
        );
        if (pinnLive && pinnLive.home > 1 && pinnLive.away > 1) {
          mergeBookmakerLines(lines, [pinnacleLineToBookmakerLine(pinnLive, hasDraw, 'Pinnacle (Live)')]);
        }
      } catch { /* silent */ }
    }

    // ── Source 4b: Pinnacle PRE-MATCH ────────────────────────────────────────
    // For upcoming matches (and as fallback for live if live endpoint is empty).
    if (lines.length === 0 && PINNACLE_SUPPORTED_SPORTS.has(sportSlug)) {
      try {
        const pinnLine = await getPinnacleOdds(
          match.homeTeam.name,
          match.awayTeam.name,
          sportSlug,
          kickoffMs,
        );
        if (pinnLine && pinnLine.home > 1 && pinnLine.away > 1) {
          mergeBookmakerLines(lines, [pinnacleLineToBookmakerLine(pinnLine, hasDraw)]);
        }
      } catch { /* silent */ }
    }

    // ── Source 5: Betfair Exchange (live + pre-match) ────────────────────────
    // Free developer API — exchange odds (no bookmaker margin).
    // Covers football, tennis, cricket, basketball, rugby, MMA, darts, snooker.
    // Activate by setting BETFAIR_APP_KEY + BETFAIR_USERNAME + BETFAIR_PASSWORD.
    if (lines.length === 0 && isBetfairConfigured()) {
      try {
        const bfOdds = await getBetfairOdds(
          match.homeTeam.name,
          match.awayTeam.name,
          sportSlug,
          kickoffMs,
          isLive,
        );
        if (bfOdds && bfOdds.home > 1 && bfOdds.away > 1) {
          mergeBookmakerLines(lines, [{
            bookmaker: 'betfair',
            display:   bfOdds.inPlay ? 'Betfair Exchange (Live)' : 'Betfair Exchange',
            home:  bfOdds.home,
            draw:  hasDraw && bfOdds.draw ? bfOdds.draw : undefined,
            away:  bfOdds.away,
          }]);
        }
      } catch { /* silent */ }
    }

    // ── Source 6: SofaScore odds (free, via CF proxy) ────────────────────────
    // Covers ALL sports including cricket. Cross-references ESPN matches by
    // team name + kickoff time when the match ID isn't a SofaScore ID.
    if (lines.length === 0) {
      let ssEventId = extractSofaScoreEventId(match.id);

      if (ssEventId === null && kickoffMs) {
        try {
          ssEventId = await findSofaScoreEventId(
            match.homeTeam.name,
            match.awayTeam.name,
            kickoffMs,
            sportSlug,
          );
        } catch { /* silent */ }
      }

      if (ssEventId !== null) {
        const ssLines = await getSofaScoreOdds(ssEventId, hasDraw);
        mergeBookmakerLines(lines, ssLines);
      }
    }

    // ── Source 7: SharpAPI (DraftKings + FanDuel free tier) ──────────────────
    // Last resort for football when all other sources are empty.
    if (lines.length === 0) {
      const sharpLines = await getSharpApiBookmakerLines(
        match.homeTeam.name,
        match.awayTeam.name,
        isoKickoff,
        hasDraw,
      );
      mergeBookmakerLines(lines, sharpLines);
    }

    return NextResponse.json(
      { lines, hasDraw, status, isFinished: false, isLive },
      {
        headers: {
          // SWR polls this endpoint; CDN caching would make a refresh return
          // the previous bookmaker snapshot even after the provider changed.
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (err) {
    console.error('[bookmaker-odds]', err);
    return NextResponse.json({ lines: [], hasDraw: true, status: '', isFinished: false, isLive: false });
  }
}
