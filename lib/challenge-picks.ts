// Client-safe helpers for challenge pick options and evaluation.
// No server-only imports (no fs, db, mysql2).

export interface PickOption {
  label: string;
  value: string;
  group: string;
  defaultOdds: number;
}

export interface PickSelection {
  pick: string;
  odds: number;
  group: string;
}

// ─── Market odds from match ────────────────────────────────────────────────────

export function resolvePickOdds(
  pick: string,
  matchOdds: { home: number; draw: number; away: number } | null | undefined,
  defaultOdds: number,
): number {
  if (matchOdds) {
    const p = pick.toLowerCase();
    if (p === 'home win' && matchOdds.home > 1) return matchOdds.home;
    if (p === 'draw' && matchOdds.draw > 1) return matchOdds.draw;
    if (p === 'away win' && matchOdds.away > 1) return matchOdds.away;
    // Derived odds for secondary markets from 1X2
    if (matchOdds.home > 1 && matchOdds.away > 1) {
      const implied = (1 / matchOdds.home) + (matchOdds.draw > 1 ? 1 / matchOdds.draw : 0) + (1 / matchOdds.away);
      const _ = implied; void _;
    }
  }
  return defaultOdds;
}

// ─── Pick options per sport ────────────────────────────────────────────────────

export function pickOptionsForSport(sport: string): PickOption[] {
  const s = (sport || '').toLowerCase();
  if (s.includes('football') || s.includes('soccer')) {
    return [
      { group: 'Match Result', label: 'Home Win', value: 'Home Win', defaultOdds: 2.20 },
      { group: 'Match Result', label: 'Draw', value: 'Draw', defaultOdds: 3.20 },
      { group: 'Match Result', label: 'Away Win', value: 'Away Win', defaultOdds: 2.80 },
      { group: 'Goals', label: 'Over 2.5', value: 'Over 2.5', defaultOdds: 1.85 },
      { group: 'Goals', label: 'Under 2.5', value: 'Under 2.5', defaultOdds: 1.95 },
      { group: 'Goals', label: 'Over 1.5', value: 'Over 1.5', defaultOdds: 1.35 },
      { group: 'Goals', label: 'Under 1.5', value: 'Under 1.5', defaultOdds: 2.75 },
      { group: 'Both Teams Score', label: 'BTTS Yes', value: 'BTTS Yes', defaultOdds: 1.75 },
      { group: 'Both Teams Score', label: 'BTTS No', value: 'BTTS No', defaultOdds: 2.05 },
      { group: 'Double Chance', label: '1X (Home/Draw)', value: '1X', defaultOdds: 1.40 },
      { group: 'Double Chance', label: 'X2 (Draw/Away)', value: 'X2', defaultOdds: 1.45 },
      { group: 'Double Chance', label: '12 (Home or Away)', value: '12', defaultOdds: 1.40 },
    ];
  }
  if (s.includes('basketball')) {
    return [
      { group: 'Match Result', label: 'Home Win', value: 'Home Win', defaultOdds: 1.90 },
      { group: 'Match Result', label: 'Away Win', value: 'Away Win', defaultOdds: 1.90 },
    ];
  }
  if (s.includes('tennis')) {
    return [
      { group: 'Match Result', label: 'Home Player Wins', value: 'Home Win', defaultOdds: 1.80 },
      { group: 'Match Result', label: 'Away Player Wins', value: 'Away Win', defaultOdds: 1.95 },
    ];
  }
  if (s.includes('cricket')) {
    return [
      { group: 'Match Result', label: 'Home Team Wins', value: 'Home Win', defaultOdds: 1.85 },
      { group: 'Match Result', label: 'Away Team Wins', value: 'Away Win', defaultOdds: 2.10 },
      { group: 'Match Result', label: 'Draw / Tie', value: 'Draw', defaultOdds: 4.50 },
    ];
  }
  return [
    { group: 'Match Result', label: 'Home Win', value: 'Home Win', defaultOdds: 2.20 },
    { group: 'Match Result', label: 'Draw', value: 'Draw', defaultOdds: 3.20 },
    { group: 'Match Result', label: 'Away Win', value: 'Away Win', defaultOdds: 2.80 },
  ];
}

// ─── Evaluate a single pick against a score ────────────────────────────────────

export function evaluatePick(pick: string, homeScore: number, awayScore: number): boolean {
  const p = (pick || '').toLowerCase().trim();
  const total = homeScore + awayScore;
  if (p === 'home win' || p === '1') return homeScore > awayScore;
  if (p === 'draw' || p === 'x') return homeScore === awayScore;
  if (p === 'away win' || p === '2') return homeScore < awayScore;
  if (p === 'over 0.5') return total > 0.5;
  if (p === 'under 0.5') return total <= 0.5;
  if (p === 'over 1.5') return total > 1.5;
  if (p === 'under 1.5') return total <= 1.5;
  if (p === 'over 2.5') return total > 2.5;
  if (p === 'under 2.5') return total <= 2.5;
  if (p === 'over 3.5') return total > 3.5;
  if (p === 'under 3.5') return total <= 3.5;
  if (p === 'over 4.5') return total > 4.5;
  if (p === 'under 4.5') return total <= 4.5;
  if (p === 'btts yes' || p === 'both teams to score') return homeScore > 0 && awayScore > 0;
  if (p === 'btts no') return homeScore === 0 || awayScore === 0;
  if (p === '1x' || p === 'double chance 1x') return homeScore >= awayScore;
  if (p === 'x2' || p === 'double chance x2') return awayScore >= homeScore;
  if (p === '12' || p === 'double chance 12') return homeScore !== awayScore;
  return false;
}

// ─── Multi-pick points calculation ────────────────────────────────────────────

export function calcPoints(picks: PickSelection[], homeScore: number, awayScore: number): number {
  if (!picks.length) return 0;
  return picks.reduce((sum, p) => sum + (evaluatePick(p.pick, homeScore, awayScore) ? p.odds : 0), 0);
}

// Max possible points if all picks win
export function maxPoints(picks: PickSelection[]): number {
  return picks.reduce((sum, p) => sum + p.odds, 0);
}

// ─── Parse raw pick field (backward compat) ───────────────────────────────────

export function parsePicks(raw: string | null | undefined): PickSelection[] {
  if (!raw) return [];
  const s = raw.trim();
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as PickSelection[];
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  // Legacy single pick — wrap it
  if (s) return [{ pick: s, odds: 2.00, group: 'Match Result' }];
  return [];
}

// ─── Outcome for a single pick given live or final score ──────────────────────

export type PickOutcome = 'winning' | 'losing' | 'pending';

export function pickOutcome(pick: string, homeScore: number | null, awayScore: number | null): PickOutcome {
  if (homeScore === null || awayScore === null) return 'pending';
  return evaluatePick(pick, homeScore, awayScore) ? 'winning' : 'losing';
}
