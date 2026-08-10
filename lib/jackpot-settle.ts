import {
  getActiveJackpots,
  updateJackpot,
} from '@/lib/jackpot-store';
import { matchTeamWords, normalizeTeam } from '@/lib/strategy-settle';
import type { Jackpot, JackpotGame } from '@/lib/jackpot-types';
import type { UnifiedMatch } from '@/lib/api/unified-sports-api';

const FINISHED_STATUSES = new Set([
  'finished',
  'ft',
  'full-time',
  'final',
  'ended',
  'post',
  'aet',
  'pen',
  'walkover',
  'awarded',
]);

function hasFinalScore(match: UnifiedMatch): boolean {
  return Number.isFinite(match.homeScore) &&
    Number.isFinite(match.awayScore) &&
    (match.homeScore ?? -1) >= 0 &&
    (match.awayScore ?? -1) >= 0;
}

function namesMatch(game: JackpotGame, match: UnifiedMatch): boolean {
  const gameHome = normalizeTeam(game.home);
  const gameAway = normalizeTeam(game.away);
  const matchHome = normalizeTeam(match.homeTeam.name);
  const matchAway = normalizeTeam(match.awayTeam.name);

  const homeMatches =
    matchHome === gameHome ||
    (gameHome.length > 2 && matchHome.includes(gameHome)) ||
    (matchHome.length > 2 && gameHome.includes(matchHome)) ||
    matchTeamWords(match.homeTeam.name, game.home);
  const awayMatches =
    matchAway === gameAway ||
    (gameAway.length > 2 && matchAway.includes(gameAway)) ||
    (matchAway.length > 2 && gameAway.includes(matchAway)) ||
    matchTeamWords(match.awayTeam.name, game.away);

  return homeMatches && awayMatches;
}

function kickoffDistance(game: JackpotGame, match: UnifiedMatch): number {
  if (!game.kickoffTime) return Number.MAX_SAFE_INTEGER;
  const gameTime = new Date(game.kickoffTime).getTime();
  const matchTime = new Date(match.kickoffTime).getTime();
  if (!Number.isFinite(gameTime) || !Number.isFinite(matchTime)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.abs(gameTime - matchTime);
}

function findFinishedMatch(game: JackpotGame, matches: UnifiedMatch[]): UnifiedMatch | null {
  const candidates = matches.filter(match =>
    FINISHED_STATUSES.has(String(match.status).toLowerCase()) &&
    hasFinalScore(match) &&
    namesMatch(game, match)
  );

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => kickoffDistance(game, a) - kickoffDistance(game, b))[0];
}

function resultForScore(homeScore: number, awayScore: number): '1' | 'X' | '2' {
  if (homeScore > awayScore) return '1';
  if (homeScore < awayScore) return '2';
  return 'X';
}

/**
 * Settles active jackpots only after every game has a confirmed final score.
 *
 * A jackpot is intentionally left active when even one fixture cannot be
 * matched. This prevents a partial provider response or an ambiguous team-name
 * match from publishing an incorrect winning combination.
 */
export function settleFinishedJackpots(matches: UnifiedMatch[]): {
  settled: number;
  waiting: number;
} {
  if (matches.length === 0) return { settled: 0, waiting: 0 };

  let settled = 0;
  let waiting = 0;

  for (const jackpot of getActiveJackpots()) {
    const resolvedGames = jackpot.games.map(game => {
      const finished = findFinishedMatch(game, matches);
      if (!finished) return null;

      const homeScore = finished.homeScore as number;
      const awayScore = finished.awayScore as number;
      return {
        ...game,
        result: resultForScore(homeScore, awayScore),
        homeScore,
        awayScore,
      };
    });

    if (resolvedGames.some(game => game === null)) {
      waiting++;
      continue;
    }

    const games = resolvedGames as JackpotGame[];
    const winningCombination = games.map(game => game.result).join(' ');
    const updated = updateJackpot(jackpot.id, {
      status: 'settled',
      games,
      result: {
        winnersCount: jackpot.result?.winnersCount ?? 0,
        prizePerWinner: jackpot.result?.prizePerWinner,
        totalPrizePaid: jackpot.result?.totalPrizePaid,
        winningCombination,
        settledAt: new Date().toISOString(),
        notes: 'Automatically settled using confirmed final scores.',
      },
    });

    if (updated) {
      settled++;
      console.log(`[jackpot-settle] Settled ${jackpot.title}: ${winningCombination}`);
    }
  }

  return { settled, waiting };
}