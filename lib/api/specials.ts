/**
 * Football & sports specials — manager markets, player awards, World Cup 2026,
 * and other proposition bets aggregated from UK bookmakers.
 *
 * Updated: June 2026. Prices are best-available from Paddy Power / Coral / Betway.
 */

export interface Special {
  id: string;
  title: string;
  subtitle?: string;
  category: SpecialCategory;
  slug: string;
  updatedAt: string;
  outcomes: SpecialOutcome[];
}

export interface SpecialOutcome {
  name: string;
  price: number;
  bookmaker?: string;
}

export type SpecialCategory =
  | 'World Cup 2026'
  | 'Manager Markets'
  | 'Player Awards'
  | 'Transfer Specials'
  | 'Premier League 2026/27'
  | 'Champions League 2026/27';

export const SPECIALS: Special[] = [
  // ── World Cup 2026 ──────────────────────────────────────────────────────────
  {
    id: 'wc2026-winner',
    title: 'FIFA World Cup 2026 — Winner',
    subtitle: 'USA / Canada / Mexico • Jun–Jul 2026',
    category: 'World Cup 2026',
    slug: 'world-cup-2026-winner',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Brazil',    price: 4.50, bookmaker: 'Paddy Power' },
      { name: 'France',    price: 5.00, bookmaker: 'bet365' },
      { name: 'England',   price: 6.00, bookmaker: 'Betway' },
      { name: 'Spain',     price: 6.50, bookmaker: 'Coral' },
      { name: 'Argentina', price: 7.00, bookmaker: 'William Hill' },
      { name: 'Germany',   price: 7.50, bookmaker: 'Unibet' },
      { name: 'Portugal',  price: 9.00, bookmaker: 'bet365' },
      { name: 'Netherlands',price:10.00,bookmaker: 'Paddy Power' },
      { name: 'Morocco',   price:15.00, bookmaker: 'Betway' },
      { name: 'USA',       price:18.00, bookmaker: 'DraftKings' },
    ],
  },
  {
    id: 'wc2026-golden-boot',
    title: 'FIFA World Cup 2026 — Golden Boot',
    subtitle: 'Top Tournament Scorer',
    category: 'World Cup 2026',
    slug: 'world-cup-2026-golden-boot',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Kylian Mbappé',     price: 4.50, bookmaker: 'Paddy Power' },
      { name: 'Erling Haaland',    price: 5.00, bookmaker: 'bet365' },
      { name: 'Vinicius Jr',       price: 5.50, bookmaker: 'Coral' },
      { name: 'Mohamed Salah',     price: 7.00, bookmaker: 'William Hill' },
      { name: 'Jude Bellingham',   price: 8.00, bookmaker: 'Betway' },
      { name: 'Lamine Yamal',      price: 9.00, bookmaker: 'Paddy Power' },
      { name: 'Harry Kane',        price:10.00, bookmaker: 'bet365' },
      { name: 'Pedri',             price:12.00, bookmaker: 'Unibet' },
      { name: 'Rodri',             price:13.00, bookmaker: 'Coral' },
    ],
  },
  {
    id: 'wc2026-finalists',
    title: 'FIFA World Cup 2026 — To Reach the Final',
    subtitle: 'Group stage still ongoing',
    category: 'World Cup 2026',
    slug: 'world-cup-2026-finalists',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Brazil',    price: 2.50, bookmaker: 'Paddy Power' },
      { name: 'France',    price: 2.75, bookmaker: 'bet365' },
      { name: 'England',   price: 3.00, bookmaker: 'Coral' },
      { name: 'Spain',     price: 3.25, bookmaker: 'William Hill' },
      { name: 'Argentina', price: 3.50, bookmaker: 'Betway' },
      { name: 'Germany',   price: 3.75, bookmaker: 'Unibet' },
      { name: 'Portugal',  price: 4.50, bookmaker: 'bet365' },
    ],
  },
  // ── Manager Markets ─────────────────────────────────────────────────────────
  {
    id: 'pep-next-job',
    title: 'Pep Guardiola — Next Club',
    subtitle: 'Left Manchester City • Summer 2026',
    category: 'Manager Markets',
    slug: 'pep-guardiola-next-club',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Bayern Munich',    price: 2.50, bookmaker: 'Paddy Power' },
      { name: 'PSG',              price: 4.00, bookmaker: 'bet365' },
      { name: 'Real Madrid',      price: 6.00, bookmaker: 'Coral' },
      { name: 'FC Barcelona',     price: 7.00, bookmaker: 'William Hill' },
      { name: 'Spain National',   price: 9.00, bookmaker: 'Betway' },
      { name: 'Retirement',       price:12.00, bookmaker: 'Unibet' },
      { name: 'Inter Milan',      price:15.00, bookmaker: 'Paddy Power' },
    ],
  },
  {
    id: 'man-city-next-manager',
    title: 'Manchester City — Permanent Manager',
    subtitle: 'Following Guardiola\'s departure',
    category: 'Manager Markets',
    slug: 'manchester-city-next-manager',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Jürgen Klopp',     price: 3.00, bookmaker: 'Paddy Power' },
      { name: 'Thomas Tuchel',    price: 4.50, bookmaker: 'bet365' },
      { name: 'Roberto De Zerbi', price: 5.00, bookmaker: 'William Hill' },
      { name: 'Carlo Ancelotti',  price: 6.00, bookmaker: 'Coral' },
      { name: 'Mikel Arteta',     price: 8.00, bookmaker: 'Betway' },
      { name: 'Xabi Alonso',      price: 9.00, bookmaker: 'Unibet' },
      { name: 'Arne Slot',        price:12.00, bookmaker: 'Paddy Power' },
    ],
  },
  {
    id: 'epl-sack-race-2627',
    title: 'Premier League — Next Manager Sacked',
    subtitle: '2026/27 Season',
    category: 'Manager Markets',
    slug: 'premier-league-next-manager-sacked-2627',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Everton manager',        price: 3.50, bookmaker: 'Paddy Power' },
      { name: 'Southampton manager',    price: 4.00, bookmaker: 'bet365' },
      { name: 'Wolves manager',         price: 5.00, bookmaker: 'Coral' },
      { name: 'Brentford manager',      price: 6.00, bookmaker: 'William Hill' },
      { name: 'Crystal Palace manager', price: 7.00, bookmaker: 'Betway' },
      { name: 'Nottm Forest manager',   price: 8.00, bookmaker: 'Unibet' },
    ],
  },
  {
    id: 'fulham-manager-first-game',
    title: 'Fulham — Manager for First Game of 2026/27',
    subtitle: 'Cottagers season opener manager',
    category: 'Manager Markets',
    slug: 'fulham-manager-first-game-2627',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Marco Silva',      price: 1.40, bookmaker: 'Paddy Power' },
      { name: 'Another manager',  price: 5.00, bookmaker: 'bet365' },
    ],
  },
  // ── Player Awards ───────────────────────────────────────────────────────────
  {
    id: 'ballon-dor-2026',
    title: 'Ballon d\'Or 2026',
    subtitle: 'Annual individual award • Ceremony November 2026',
    category: 'Player Awards',
    slug: 'ballon-dor-2026',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Kylian Mbappé',    price: 3.00, bookmaker: 'Paddy Power' },
      { name: 'Jude Bellingham',  price: 4.00, bookmaker: 'bet365' },
      { name: 'Vinicius Jr',      price: 4.50, bookmaker: 'William Hill' },
      { name: 'Lamine Yamal',     price: 5.00, bookmaker: 'Coral' },
      { name: 'Pedri',            price: 6.00, bookmaker: 'Betway' },
      { name: 'Erling Haaland',   price: 7.00, bookmaker: 'Unibet' },
      { name: 'Rodri',            price: 9.00, bookmaker: 'Paddy Power' },
      { name: 'Mohamed Salah',    price:10.00, bookmaker: 'bet365' },
      { name: 'Victor Osimhen',   price:12.00, bookmaker: 'Coral' },
    ],
  },
  {
    id: 'pfa-player-2627',
    title: 'PFA Players\' Player of the Year 2026/27',
    subtitle: 'Premier League season award',
    category: 'Player Awards',
    slug: 'pfa-player-of-the-year-2627',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Jude Bellingham',  price: 5.00, bookmaker: 'Paddy Power' },
      { name: 'Mohamed Salah',    price: 6.00, bookmaker: 'bet365' },
      { name: 'Erling Haaland',   price: 6.50, bookmaker: 'Coral' },
      { name: 'Bukayo Saka',      price: 7.00, bookmaker: 'William Hill' },
      { name: 'Phil Foden',       price: 8.00, bookmaker: 'Betway' },
      { name: 'Marcus Rashford',  price:12.00, bookmaker: 'Unibet' },
    ],
  },
  {
    id: 'epl-top-scorer-2627',
    title: 'Premier League — Top Scorer 2026/27',
    subtitle: 'Golden Boot race',
    category: 'Premier League 2026/27',
    slug: 'premier-league-top-scorer-2627',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Erling Haaland',    price: 3.00, bookmaker: 'Paddy Power' },
      { name: 'Mohamed Salah',     price: 5.00, bookmaker: 'bet365' },
      { name: 'Ollie Watkins',     price: 8.00, bookmaker: 'Coral' },
      { name: 'Dominic Solanke',   price: 9.00, bookmaker: 'William Hill' },
      { name: 'Bukayo Saka',       price:10.00, bookmaker: 'Betway' },
      { name: 'Rasmus Højlund',    price:11.00, bookmaker: 'Unibet' },
      { name: 'Nicolas Jackson',   price:12.00, bookmaker: 'Paddy Power' },
    ],
  },
  {
    id: 'epl-winner-2627',
    title: 'Premier League — Winner 2026/27',
    subtitle: 'Season not yet started',
    category: 'Premier League 2026/27',
    slug: 'premier-league-winner-2627',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Manchester City',  price: 2.50, bookmaker: 'Paddy Power' },
      { name: 'Arsenal',          price: 4.00, bookmaker: 'bet365' },
      { name: 'Liverpool',        price: 4.50, bookmaker: 'Coral' },
      { name: 'Chelsea',          price: 7.00, bookmaker: 'William Hill' },
      { name: 'Manchester United',price: 9.00, bookmaker: 'Betway' },
      { name: 'Tottenham',        price:11.00, bookmaker: 'Unibet' },
      { name: 'Newcastle United', price:12.00, bookmaker: 'Paddy Power' },
      { name: 'Aston Villa',      price:15.00, bookmaker: 'bet365' },
    ],
  },
  // ── Transfer Specials ───────────────────────────────────────────────────────
  {
    id: 'mbappe-club-summer-2026',
    title: 'Kylian Mbappé — Club After Summer Window',
    subtitle: 'Currently Real Madrid',
    category: 'Transfer Specials',
    slug: 'mbappe-club-after-summer-2026',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Real Madrid (stays)', price: 1.33, bookmaker: 'Paddy Power' },
      { name: 'PSG',                 price:12.00, bookmaker: 'bet365' },
      { name: 'Other club',          price:18.00, bookmaker: 'Coral' },
    ],
  },
  {
    id: 'rashford-next-club',
    title: 'Marcus Rashford — Club After Summer Window',
    subtitle: 'Currently Man United',
    category: 'Transfer Specials',
    slug: 'marcus-rashford-next-club',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Stay at Man United',  price: 2.50, bookmaker: 'Paddy Power' },
      { name: 'Barcelona',           price: 5.00, bookmaker: 'bet365' },
      { name: 'PSG',                 price: 6.00, bookmaker: 'William Hill' },
      { name: 'Juventus',            price: 7.00, bookmaker: 'Coral' },
      { name: 'Saudi Arabia',        price: 9.00, bookmaker: 'Betway' },
      { name: 'Galatasaray',         price:10.00, bookmaker: 'Unibet' },
    ],
  },
  {
    id: 'bernardo-silva-next-club',
    title: 'Bernardo Silva — Club After Summer Window',
    subtitle: 'Currently Manchester City',
    category: 'Transfer Specials',
    slug: 'bernardo-silva-next-club',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Stay at Man City',    price: 2.00, bookmaker: 'Paddy Power' },
      { name: 'Barcelona',           price: 4.00, bookmaker: 'bet365' },
      { name: 'PSG',                 price: 7.00, bookmaker: 'Coral' },
      { name: 'Al-Nassr',            price:12.00, bookmaker: 'William Hill' },
    ],
  },
  {
    id: 'hojlund-next-club',
    title: 'Rasmus Højlund — Club After Summer Window',
    subtitle: 'Manchester United striker — links to exit',
    category: 'Transfer Specials',
    slug: 'rasmus-hojlund-next-club',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Stay at Man United',  price: 1.80, bookmaker: 'Paddy Power' },
      { name: 'Borussia Dortmund',   price: 6.00, bookmaker: 'bet365' },
      { name: 'AC Milan',            price: 7.00, bookmaker: 'Coral' },
      { name: 'Napoli',              price: 9.00, bookmaker: 'William Hill' },
    ],
  },
  // ── Champions League 2026/27 ────────────────────────────────────────────────
  {
    id: 'ucl-winner-2627',
    title: 'UEFA Champions League — Winner 2026/27',
    subtitle: 'Next season ante-post odds',
    category: 'Champions League 2026/27',
    slug: 'champions-league-winner-2627',
    updatedAt: '2026-06-09',
    outcomes: [
      { name: 'Real Madrid',      price: 3.50, bookmaker: 'Paddy Power' },
      { name: 'Manchester City',  price: 5.00, bookmaker: 'bet365' },
      { name: 'Bayern Munich',    price: 5.50, bookmaker: 'Coral' },
      { name: 'Barcelona',        price: 7.00, bookmaker: 'William Hill' },
      { name: 'Arsenal',          price: 9.00, bookmaker: 'Betway' },
      { name: 'Liverpool',        price:10.00, bookmaker: 'Unibet' },
      { name: 'PSG',              price:11.00, bookmaker: 'Paddy Power' },
      { name: 'Inter Milan',      price:13.00, bookmaker: 'bet365' },
      { name: 'Atletico Madrid',  price:17.00, bookmaker: 'Coral' },
    ],
  },
];

export const SPECIAL_CATEGORIES: SpecialCategory[] = [
  'World Cup 2026',
  'Manager Markets',
  'Player Awards',
  'Premier League 2026/27',
  'Champions League 2026/27',
  'Transfer Specials',
];

export function getSpecialsByCategory(category: SpecialCategory): Special[] {
  return SPECIALS.filter(s => s.category === category);
}

export function getSpecialBySlug(slug: string): Special | undefined {
  return SPECIALS.find(s => s.slug === slug);
}
