import { NextRequest, NextResponse } from 'next/server';
import { getMatchById } from '@/lib/api/unified-sports-api';
import { getSgoBookmakerLines } from '@/lib/api/sportsgameodds';
import { getSharpApiBookmakerLines } from '@/lib/api/sharpapi';
import { getTheOddsApiMatchLines } from '@/lib/api/the-odds-api-match';
import { getSofaScoreOdds, extractSofaScoreEventId } from '@/lib/api/sofascore-odds';
import { getPinnacleOdds } from '@/lib/api/pinnacle';
import { findSofaScoreEventId } from '@/lib/api/sofascore';

const NO_DRAW_SPORTS = new Set([
  'basketball', 'baseball', 'tennis', 'mma', 'boxing', 'golf',
  'formula-1', 'racing', 'horse-racing', 'darts', 'snooker',
  'american-football', 'ice-hockey', 'table-tennis', 'cricket',
  'badminton', 'volleyball', 'table-tennis',
]);

const FINISHED_STATUSES = new Set([
  'finished', 'ft', 'full-time', 'final', 'ended', 'post',
  'complete', 'completed', 'aet', 'pen',
]);

// Sports that Pinnacle covers well (no key required, free guest API)
const PINNACLE_SUPPORTED_SPORTS = new Set([
  'tennis', 'basketball', 'baseball', 'ice-hockey', 'hockey',
  'american-football', 'mma', 'boxing', 'esports', 'volleyball',
  'table-tennis', 'badminton', 'darts', 'rugby', 'rugby-league', 'snooker',
  'football', 'soccer',
]);

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
    const hasDraw = !NO_DRAW_SPORTS.has(sportSlug);
    const status = (match.status || '').toLowerCase();
    const isFinished = FINISHED_STATUSES.has(status);

    // Don't serve odds for finished matches — no betting value
    if (isFinished) {
      return NextResponse.json(
        { lines: [], hasDraw, status, isFinished: true },
        { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
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
    // Uses bulk in-memory cache — zero extra API calls for cached matches.
    let lines = await getSgoBookmakerLines(
      match.homeTeam.name,
      match.awayTeam.name,
      isoKickoff,
      hasDraw,
    );

    // ── Source 2: TheOddsAPI h2h ─────────────────────────────────────────────
    // Covers ALL sports (tennis, basketball, cricket, NHL, NFL, MMA, rugby…).
    // One request per sport covers all matches in that sport — quota-efficient.
    // Primary coverage for non-football sports; football is a secondary gap-filler.
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
      if (theoddsLines.length > 0) {
        lines = theoddsLines;
      }
    }

    // ── Source 3: Pinnacle (free guest API, no key required) ─────────────────
    // Pinnacle covers tennis, basketball, baseball, hockey, MMA, esports,
    // darts, badminton, table-tennis, volleyball, rugby, snooker, and more.
    // Works from cloud IPs — no proxy needed. Matches by team name.
    if (lines.length === 0 && PINNACLE_SUPPORTED_SPORTS.has(sportSlug)) {
      try {
        const pinnLine = await getPinnacleOdds(
          match.homeTeam.name,
          match.awayTeam.name,
          sportSlug,
          kickoffMs,
        );
        if (pinnLine && pinnLine.home > 1 && pinnLine.away > 1) {
          lines = [{
            bookmaker: 'pinnacle',
            display: 'Pinnacle',
            home: pinnLine.home,
            draw: hasDraw && pinnLine.draw ? pinnLine.draw : undefined,
            away: pinnLine.away,
          }];
        }
      } catch { /* silent */ }
    }

    // ── Source 4: SofaScore odds (free, no key) ──────────────────────────────
    // SofaScore has odds for ALL sports: tennis, cricket, basketball, etc.
    // Case A: Direct — match already comes from SofaScore (id starts with ss_).
    // Case B: Cross-ref — ESPN/other match; look up the SofaScore event by
    //         team names + kickoff time, then fetch odds. Useful for tennis
    //         and cricket where ESPN doesn't embed odds.
    if (lines.length === 0) {
      let ssEventId = extractSofaScoreEventId(match.id);

      // Case B: cross-reference for non-SofaScore matches
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
        if (ssLines.length > 0) {
          lines = ssLines;
        }
      }
    }

    // ── Source 5: ESPN embedded odds ─────────────────────────────────────────
    // ESPN's scoreboard embeds one bookmaker's line (usually DraftKings).
    // Use it as a single guaranteed line when all sources above are empty.
    if (lines.length === 0 && match.odds && match.odds.bookmaker &&
        typeof match.odds.home === 'number' && typeof match.odds.away === 'number') {
      lines = [{
        bookmaker: match.odds.bookmaker.toLowerCase().replace(/\s+/g, ''),
        display: match.odds.bookmaker,
        home: match.odds.home,
        draw: hasDraw && typeof match.odds.draw === 'number' ? match.odds.draw : undefined,
        away: match.odds.away,
      }];
    }

    // ── Source 6: SharpAPI (DraftKings + FanDuel free tier) ──────────────────
    // Only attempted when all five sources above returned nothing.
    if (lines.length === 0) {
      const sharpLines = await getSharpApiBookmakerLines(
        match.homeTeam.name,
        match.awayTeam.name,
        isoKickoff,
        hasDraw,
      );
      if (sharpLines.length > 0) {
        lines = sharpLines;
      }
    }

    // Cache 2 min for live matches, 10 min for pre-match
    const isLive = ['live', 'in-progress', 'inprogress', 'halftime', 'extra_time', 'penalties'].includes(status);
    const cacheSeconds = isLive ? 120 : 600;

    return NextResponse.json(
      { lines, hasDraw, status, isFinished: false, isLive },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
        },
      },
    );
  } catch (err) {
    console.error('[bookmaker-odds]', err);
    return NextResponse.json({ lines: [], hasDraw: true, status: '', isFinished: false, isLive: false });
  }
}
