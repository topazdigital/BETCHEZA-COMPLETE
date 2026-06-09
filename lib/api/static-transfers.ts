/**
 * Curated player transfer odds — sourced from UK/EU bookmakers (Oddschecker, BettingLounge aggregates).
 * Used when The Odds API has no live transfer market data.
 * Last updated: June 2026
 */

export interface TransferOddsEntry {
  player: string;
  currentClub: string;
  photoHint?: string;
  outcomes: { name: string; price: number }[];
}

export interface TransferOddsData {
  [leagueId: number]: TransferOddsEntry[];
  global: TransferOddsEntry[];
}

export const STATIC_TRANSFER_ODDS: TransferOddsData = {
  global: [
    {
      player: 'Mohamed Salah',
      currentClub: 'Liverpool',
      outcomes: [
        { name: 'Liverpool (stay)', price: 1.50 },
        { name: 'Al-Hilal', price: 5.00 },
        { name: 'Barcelona', price: 8.00 },
        { name: 'Inter Miami', price: 11.00 },
        { name: 'Real Madrid', price: 15.00 },
      ],
    },
    {
      player: 'Vinicius Jr',
      currentClub: 'Real Madrid',
      outcomes: [
        { name: 'Real Madrid (stay)', price: 1.30 },
        { name: 'Al-Hilal', price: 5.00 },
        { name: 'Manchester City', price: 9.00 },
        { name: 'Paris Saint Germain', price: 13.00 },
        { name: 'Bayern Munich', price: 17.00 },
      ],
    },
    {
      player: 'Rodri',
      currentClub: 'Manchester City',
      outcomes: [
        { name: 'Manchester City (stay)', price: 1.20 },
        { name: 'Barcelona', price: 8.00 },
        { name: 'Real Madrid', price: 12.00 },
        { name: 'Bayern Munich', price: 21.00 },
      ],
    },
    {
      player: 'Bukayo Saka',
      currentClub: 'Arsenal',
      outcomes: [
        { name: 'Arsenal (stay)', price: 1.10 },
        { name: 'Real Madrid', price: 9.00 },
        { name: 'Manchester City', price: 12.00 },
        { name: 'Bayern Munich', price: 15.00 },
      ],
    },
    {
      player: 'Jadon Sancho',
      currentClub: 'Chelsea',
      outcomes: [
        { name: 'Chelsea (stay)', price: 2.50 },
        { name: 'Borussia Dortmund', price: 3.50 },
        { name: 'Juventus', price: 5.00 },
        { name: 'Manchester United', price: 6.00 },
      ],
    },
    {
      player: 'Marcus Rashford',
      currentClub: 'Aston Villa',
      outcomes: [
        { name: 'Aston Villa (stay)', price: 2.00 },
        { name: 'Galatasaray', price: 4.00 },
        { name: 'Borussia Dortmund', price: 5.00 },
        { name: 'Napoli', price: 7.00 },
      ],
    },
    {
      player: 'Bernardo Silva',
      currentClub: 'Manchester City',
      outcomes: [
        { name: 'Manchester City (stay)', price: 1.80 },
        { name: 'Barcelona', price: 3.50 },
        { name: 'Paris Saint Germain', price: 5.00 },
        { name: 'Al Qadsiah', price: 7.00 },
      ],
    },
    {
      player: 'Erling Haaland',
      currentClub: 'Manchester City',
      outcomes: [
        { name: 'Manchester City (stay)', price: 1.25 },
        { name: 'Real Madrid', price: 6.00 },
        { name: 'Barcelona', price: 9.00 },
        { name: 'Al-Hilal', price: 13.00 },
      ],
    },
    {
      player: 'Trent Alexander-Arnold',
      currentClub: 'Real Madrid',
      outcomes: [
        { name: 'Real Madrid (stay)', price: 1.40 },
        { name: 'Liverpool (return)', price: 8.00 },
        { name: 'Manchester City', price: 17.00 },
      ],
    },
    {
      player: 'Rafael Leão',
      currentClub: 'AC Milan',
      outcomes: [
        { name: 'AC Milan (stay)', price: 2.00 },
        { name: 'Chelsea', price: 4.00 },
        { name: 'Manchester City', price: 5.00 },
        { name: 'Real Madrid', price: 7.00 },
        { name: 'Barcelona', price: 8.00 },
      ],
    },
  ],
  1: [
    {
      player: 'Bukayo Saka',
      currentClub: 'Arsenal',
      outcomes: [
        { name: 'Arsenal (stay)', price: 1.10 },
        { name: 'Real Madrid', price: 9.00 },
        { name: 'Manchester City', price: 12.00 },
        { name: 'Bayern Munich', price: 15.00 },
      ],
    },
    {
      player: 'Jadon Sancho',
      currentClub: 'Chelsea',
      outcomes: [
        { name: 'Chelsea (stay)', price: 2.50 },
        { name: 'Borussia Dortmund', price: 3.50 },
        { name: 'Juventus', price: 5.00 },
        { name: 'Manchester United', price: 6.00 },
      ],
    },
  ],
  2: [
    {
      player: 'Vinicius Jr',
      currentClub: 'Real Madrid',
      outcomes: [
        { name: 'Real Madrid (stay)', price: 1.30 },
        { name: 'Al-Hilal', price: 5.00 },
        { name: 'Manchester City', price: 9.00 },
        { name: 'Paris Saint Germain', price: 13.00 },
      ],
    },
    {
      player: 'Trent Alexander-Arnold',
      currentClub: 'Real Madrid',
      outcomes: [
        { name: 'Real Madrid (stay)', price: 1.40 },
        { name: 'Liverpool (return)', price: 8.00 },
        { name: 'Manchester City', price: 17.00 },
      ],
    },
  ],
};

export function getTransferOddsForLeague(leagueId: number): TransferOddsEntry[] {
  const leagueSpecific = (STATIC_TRANSFER_ODDS as Record<number | 'global', TransferOddsEntry[]>)[leagueId] || [];
  const global = STATIC_TRANSFER_ODDS.global;
  const seen = new Set(leagueSpecific.map(e => e.player));
  return [...leagueSpecific, ...global.filter(e => !seen.has(e.player))];
}
