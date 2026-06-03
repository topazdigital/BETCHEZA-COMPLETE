// Client-safe helpers for challenge pick options and evaluation.
// No server-only imports (no fs, db, mysql2).

export interface PickOption {
  label: string;
  value: string;
  group: string;
}

export function pickOptionsForSport(sport: string): PickOption[] {
  const s = (sport || '').toLowerCase();
  if (s.includes('football') || s.includes('soccer')) {
    return [
      { group: 'Match Result', label: 'Home Win', value: 'Home Win' },
      { group: 'Match Result', label: 'Draw', value: 'Draw' },
      { group: 'Match Result', label: 'Away Win', value: 'Away Win' },
      { group: 'Total Goals', label: 'Over 2.5', value: 'Over 2.5' },
      { group: 'Total Goals', label: 'Under 2.5', value: 'Under 2.5' },
      { group: 'Total Goals', label: 'Over 1.5', value: 'Over 1.5' },
      { group: 'Total Goals', label: 'Under 1.5', value: 'Under 1.5' },
      { group: 'Both Teams Score', label: 'BTTS Yes', value: 'BTTS Yes' },
      { group: 'Both Teams Score', label: 'BTTS No', value: 'BTTS No' },
      { group: 'Double Chance', label: '1X (Home or Draw)', value: '1X' },
      { group: 'Double Chance', label: 'X2 (Draw or Away)', value: 'X2' },
      { group: 'Double Chance', label: '12 (Either Team Wins)', value: '12' },
    ];
  }
  if (s.includes('basketball')) {
    return [
      { group: 'Match Result', label: 'Home Win', value: 'Home Win' },
      { group: 'Match Result', label: 'Away Win', value: 'Away Win' },
    ];
  }
  if (s.includes('tennis')) {
    return [
      { group: 'Match Result', label: 'Home Player Wins', value: 'Home Win' },
      { group: 'Match Result', label: 'Away Player Wins', value: 'Away Win' },
    ];
  }
  if (s.includes('cricket')) {
    return [
      { group: 'Match Result', label: 'Home Team Wins', value: 'Home Win' },
      { group: 'Match Result', label: 'Away Team Wins', value: 'Away Win' },
      { group: 'Match Result', label: 'Draw / Tie', value: 'Draw' },
    ];
  }
  return [
    { group: 'Match Result', label: 'Home Win', value: 'Home Win' },
    { group: 'Match Result', label: 'Draw', value: 'Draw' },
    { group: 'Match Result', label: 'Away Win', value: 'Away Win' },
  ];
}

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
