export type JackpotStatus = 'active' | 'closed' | 'settled';
export type Prediction = '1' | 'X' | '2' | '1X' | 'X2' | '12';

export interface Bookmaker {
  slug: string; name: string; color: string; accentColor: string;
  logo?: string; website: string; jackpotTypes: string[];
}

export const SUPPORTED_BOOKMAKERS: Bookmaker[] = [
  { slug: 'sportpesa', name: 'SportPesa', color: '#00A550', accentColor: '#F7A600', website: 'https://www.sportpesa.co.ke/jackpots', jackpotTypes: ['Mega Jackpot', 'Midweek Jackpot'] },
  { slug: 'betika', name: 'Betika', color: '#1565C0', accentColor: '#00BCD4', website: 'https://www.betika.com/en-ke/jackpot', jackpotTypes: ['Grand Jackpot', 'Midweek Jackpot', 'Daily Jackpot'] },
  { slug: 'odibets', name: 'OdiBets', color: '#E53935', accentColor: '#FF8F00', website: 'https://odibets.com/jackpot', jackpotTypes: ['Jackpot Bonanza'] },
  { slug: 'betin', name: 'Betin Kenya', color: '#6A1B9A', accentColor: '#E91E63', website: 'https://ke.betin.com/jackpot', jackpotTypes: ['Grand Jackpot', 'Midweek Jackpot'] },
  { slug: 'mozzartbet', name: 'Mozzartbet', color: '#B71C1C', accentColor: '#FFD600', website: 'https://ke.mozzartbet.com/en/jackpot', jackpotTypes: ['Mega Jackpot', 'Midweek Jackpot'] },
];

export interface JackpotGame {
  id: string; home: string; away: string; league?: string; kickoffTime?: string;
  prediction?: Prediction; aiPrediction?: Prediction; aiConfidence?: number; aiReasoning?: string;
  /** Actual result after match is settled */
  result?: '1' | 'X' | '2';
  homeScore?: number;
  awayScore?: number;
}

export interface JackpotResult {
  /** Number of people who got all picks correct */
  winnersCount: number;
  /** Prize paid to each winner */
  prizePerWinner?: string;
  /** Total prize pool paid out */
  totalPrizePaid?: string;
  /** The winning combination e.g. "1 X 2 1 1 X 2 1 X 2 1 1 X" */
  winningCombination?: string;
  /** When this jackpot was settled */
  settledAt: string;
  /** Optional note from admin e.g. "Jackpot rolled over" */
  notes?: string;
}

export interface Jackpot {
  id: string; bookmakerSlug: string; bookmakerName: string; title: string;
  jackpotAmount: string; currency: string; deadline: string; games: JackpotGame[];
  status: JackpotStatus; createdAt: string; updatedAt: string;
  aiAnalysis?: string; seoTitle?: string; seoDescription?: string;
  /** Populated when status === 'settled' */
  result?: JackpotResult;
}
