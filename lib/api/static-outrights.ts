/**
 * Curated outright odds — sourced from leading UK/EU bookmakers (Oddschecker aggregates).
 * Used as a high-quality fallback when live API keys are not configured or return no data.
 * Update these periodically as seasons progress.
 * Last updated: May 2026  (2025/26 season — end of season / summer futures)
 */

export interface StaticOutright {
  id: string;
  name: string;
  outcomes: { name: string; price: number }[];
}

const STATIC: Record<number, StaticOutright[]> = {
  // ── Premier League (2025/26 — Season Ended, 2026/27 futures) ────────────
  1: [
    {
      id: 'epl-winner-2627',
      name: 'Premier League Winner 2026/27',
      outcomes: [
        { name: 'Manchester City', price: 3.75 },
        { name: 'Liverpool', price: 4.00 },
        { name: 'Arsenal', price: 4.50 },
        { name: 'Chelsea', price: 6.00 },
        { name: 'Newcastle United', price: 9.00 },
        { name: 'Manchester United', price: 13.00 },
        { name: 'Tottenham Hotspur', price: 17.00 },
        { name: 'Aston Villa', price: 21.00 },
      ],
    },
    {
      id: 'epl-top4-2627',
      name: 'Premier League Top 4 2026/27',
      outcomes: [
        { name: 'Manchester City', price: 1.22 },
        { name: 'Liverpool', price: 1.25 },
        { name: 'Arsenal', price: 1.30 },
        { name: 'Chelsea', price: 1.75 },
        { name: 'Newcastle United', price: 2.00 },
        { name: 'Tottenham Hotspur', price: 2.75 },
        { name: 'Manchester United', price: 3.50 },
        { name: 'Aston Villa', price: 4.00 },
      ],
    },
  ],

  // ── La Liga (2025/26 — End of Season / 2026/27 futures) ─────────────────
  2: [
    {
      id: 'laliga-winner-2627',
      name: 'La Liga Winner 2026/27',
      outcomes: [
        { name: 'Real Madrid', price: 2.50 },
        { name: 'Barcelona', price: 2.75 },
        { name: 'Atletico Madrid', price: 7.00 },
        { name: 'Athletic Club', price: 21.00 },
        { name: 'Villarreal', price: 34.00 },
        { name: 'Sevilla', price: 41.00 },
      ],
    },
    {
      id: 'laliga-top4-2627',
      name: 'La Liga Top 4 2026/27',
      outcomes: [
        { name: 'Real Madrid', price: 1.05 },
        { name: 'Barcelona', price: 1.08 },
        { name: 'Atletico Madrid', price: 1.18 },
        { name: 'Athletic Club', price: 1.90 },
        { name: 'Villarreal', price: 2.75 },
        { name: 'Sevilla', price: 3.25 },
      ],
    },
  ],

  // ── Bundesliga (2025/26 — End of Season / 2026/27 futures) ──────────────
  3: [
    {
      id: 'bundesliga-winner-2627',
      name: 'Bundesliga Winner 2026/27',
      outcomes: [
        { name: 'Bayern Munich', price: 1.44 },
        { name: 'Bayer Leverkusen', price: 4.50 },
        { name: 'Borussia Dortmund', price: 9.00 },
        { name: 'RB Leipzig', price: 13.00 },
        { name: 'Eintracht Frankfurt', price: 26.00 },
        { name: 'VfB Stuttgart', price: 34.00 },
      ],
    },
    {
      id: 'bundesliga-top4-2627',
      name: 'Bundesliga Top 4 2026/27',
      outcomes: [
        { name: 'Bayern Munich', price: 1.02 },
        { name: 'Bayer Leverkusen', price: 1.18 },
        { name: 'Borussia Dortmund', price: 1.35 },
        { name: 'RB Leipzig', price: 1.65 },
        { name: 'Eintracht Frankfurt', price: 2.25 },
        { name: 'VfB Stuttgart', price: 3.00 },
      ],
    },
  ],

  // ── Serie A (2025/26 — End of Season / 2026/27 futures) ─────────────────
  4: [
    {
      id: 'seriea-winner-2627',
      name: 'Serie A Winner 2026/27',
      outcomes: [
        { name: 'Napoli', price: 3.25 },
        { name: 'Inter Milan', price: 3.50 },
        { name: 'Juventus', price: 5.00 },
        { name: 'Atalanta', price: 6.50 },
        { name: 'Milan', price: 9.00 },
        { name: 'Lazio', price: 17.00 },
      ],
    },
    {
      id: 'seriea-top4-2627',
      name: 'Serie A Top 4 2026/27',
      outcomes: [
        { name: 'Napoli', price: 1.12 },
        { name: 'Inter Milan', price: 1.15 },
        { name: 'Juventus', price: 1.28 },
        { name: 'Atalanta', price: 1.45 },
        { name: 'Milan', price: 1.90 },
        { name: 'Lazio', price: 2.50 },
      ],
    },
  ],

  // ── Ligue 1 (2025/26 — End of Season / 2026/27 futures) ─────────────────
  5: [
    {
      id: 'ligue1-winner-2627',
      name: 'Ligue 1 Winner 2026/27',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 1.18 },
        { name: 'Monaco', price: 6.00 },
        { name: 'Marseille', price: 11.00 },
        { name: 'Lille', price: 13.00 },
        { name: 'Nice', price: 21.00 },
        { name: 'Rennes', price: 34.00 },
      ],
    },
    {
      id: 'ligue1-top3-2627',
      name: 'Ligue 1 Top 3 2026/27',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 1.01 },
        { name: 'Monaco', price: 1.20 },
        { name: 'Marseille', price: 1.40 },
        { name: 'Lille', price: 1.75 },
        { name: 'Nice', price: 2.50 },
        { name: 'Rennes', price: 4.50 },
      ],
    },
  ],

  // ── Eredivisie (2025/26 — End of Season) ────────────────────────────────
  6: [
    {
      id: 'eredivisie-winner-2627',
      name: 'Eredivisie Winner 2026/27',
      outcomes: [
        { name: 'Ajax', price: 1.75 },
        { name: 'PSV', price: 2.25 },
        { name: 'Feyenoord', price: 5.00 },
        { name: 'AZ', price: 13.00 },
        { name: 'Utrecht', price: 21.00 },
      ],
    },
  ],

  // ── Primeira Liga (2025/26 — End of Season) ──────────────────────────────
  7: [
    {
      id: 'primeira-winner-2627',
      name: 'Primeira Liga Winner 2026/27',
      outcomes: [
        { name: 'Sporting CP', price: 1.65 },
        { name: 'Benfica', price: 2.75 },
        { name: 'Porto', price: 5.00 },
        { name: 'Braga', price: 34.00 },
      ],
    },
  ],

  // ── UEFA Champions League 2025/26 — Final (PSG vs Arsenal, May 31 2026) ─
  9: [
    {
      id: 'ucl-winner-2526',
      name: 'Champions League Winner 2025/26',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 2.25 },
        { name: 'Arsenal', price: 3.00 },
      ],
    },
  ],

  // ── UEFA Europa League 2025/26 ───────────────────────────────────────────
  10: [
    {
      id: 'uel-winner-2526',
      name: 'Europa League Winner 2025/26',
      outcomes: [
        { name: 'Tottenham Hotspur', price: 3.50 },
        { name: 'Manchester United', price: 4.00 },
        { name: 'Lazio', price: 5.50 },
        { name: 'Frankfurt', price: 6.00 },
        { name: 'Lyon', price: 7.00 },
        { name: 'Galatasaray', price: 8.00 },
        { name: 'Ajax', price: 10.00 },
      ],
    },
  ],

  // ── NBA (2024/25 Playoffs — Finals) ─────────────────────────────────────
  101: [
    {
      id: 'nba-champion-2425',
      name: 'NBA Champion 2024/25',
      outcomes: [
        { name: 'Oklahoma City Thunder', price: 1.83 },
        { name: 'Indiana Pacers', price: 4.50 },
        { name: 'Cleveland Cavaliers', price: 6.00 },
        { name: 'New York Knicks', price: 7.00 },
      ],
    },
  ],

  // ── NFL (2025/26 Season Futures) ─────────────────────────────────────────
  401: [
    {
      id: 'nfl-sb-2526',
      name: 'Super Bowl LX Winner 2025/26',
      outcomes: [
        { name: 'Kansas City Chiefs', price: 5.50 },
        { name: 'Philadelphia Eagles', price: 6.00 },
        { name: 'Baltimore Ravens', price: 7.00 },
        { name: 'Detroit Lions', price: 8.00 },
        { name: 'Buffalo Bills', price: 8.50 },
        { name: 'San Francisco 49ers', price: 10.00 },
        { name: 'Houston Texans', price: 11.00 },
        { name: 'Dallas Cowboys', price: 13.00 },
      ],
    },
  ],

  // ── MLB (2025 Season) ────────────────────────────────────────────────────
  501: [
    {
      id: 'mlb-ws-2025',
      name: 'World Series Winner 2025',
      outcomes: [
        { name: 'Los Angeles Dodgers', price: 3.75 },
        { name: 'New York Yankees', price: 5.50 },
        { name: 'Philadelphia Phillies', price: 7.00 },
        { name: 'Atlanta Braves', price: 9.00 },
        { name: 'Houston Astros', price: 9.50 },
        { name: 'San Diego Padres', price: 11.00 },
        { name: 'Toronto Blue Jays', price: 13.00 },
        { name: 'Chicago Cubs', price: 15.00 },
      ],
    },
  ],

  // ── NHL (2024/25 Playoffs) ────────────────────────────────────────────────
  601: [
    {
      id: 'nhl-cup-2425',
      name: 'Stanley Cup Winner 2024/25',
      outcomes: [
        { name: 'Florida Panthers', price: 3.25 },
        { name: 'Toronto Maple Leafs', price: 4.50 },
        { name: 'Dallas Stars', price: 5.00 },
        { name: 'Colorado Avalanche', price: 5.50 },
        { name: 'Vegas Golden Knights', price: 7.00 },
        { name: 'Edmonton Oilers', price: 8.00 },
        { name: 'Carolina Hurricanes', price: 9.00 },
        { name: 'Winnipeg Jets', price: 11.00 },
      ],
    },
  ],

  // ── UFC / MMA ─────────────────────────────────────────────────────────────
  2701: [
    {
      id: 'ufc-hw-champion-2025',
      name: 'UFC Heavyweight Champion (Next Title Fight)',
      outcomes: [
        { name: 'Tom Aspinall', price: 1.57 },
        { name: 'Jon Jones', price: 2.62 },
        { name: 'Ciryl Gane', price: 6.00 },
        { name: 'Curtis Blaydes', price: 9.00 },
      ],
    },
    {
      id: 'ufc-lhw-champion-2025',
      name: 'UFC Light Heavyweight Champion',
      outcomes: [
        { name: 'Alex Pereira', price: 1.44 },
        { name: 'Magomed Ankalaev', price: 3.25 },
        { name: 'Jamahal Hill', price: 6.00 },
        { name: 'Jiri Prochazka', price: 9.00 },
        { name: 'Jan Blachowicz', price: 13.00 },
      ],
    },
  ],
};

/**
 * Returns curated static outrights for the given league ID, or an empty
 * array if no static data is available for that league.
 */
export function getStaticOutrights(leagueId: number): StaticOutright[] {
  return STATIC[leagueId] ?? [];
}

// ── Global discovery format — for the Betting Markets / Specials page ─────
// Matches OutrightDiscovery shape in outright-discovery.ts (without slug/desc).
export interface GlobalStaticDiscovery {
  sportKey: string;
  title: string;
  category: string;
  leagueId?: number;
  markets: Array<{
    eventId: string;
    marketName: string;
    outcomes: Array<{ name: string; price: number }>;
  }>;
}

export const GLOBAL_STATIC_OUTRIGHTS: GlobalStaticDiscovery[] = [
  // ── International ────────────────────────────────────────────────────
  {
    sportKey: 'soccer_fifa_world_cup_2026_winner',
    title: 'FIFA World Cup 2026 Winner',
    category: 'International',
    markets: [{
      eventId: 'wc2026-winner',
      marketName: 'Tournament Winner',
      outcomes: [
        { name: 'Argentina',   price: 4.50  },
        { name: 'France',      price: 5.50  },
        { name: 'Brazil',      price: 6.00  },
        { name: 'England',     price: 7.50  },
        { name: 'Germany',     price: 9.00  },
        { name: 'Spain',       price: 9.00  },
        { name: 'Portugal',    price: 12.00 },
        { name: 'Netherlands', price: 15.00 },
        { name: 'USA',         price: 19.00 },
        { name: 'Uruguay',     price: 25.00 },
        { name: 'Morocco',     price: 29.00 },
        { name: 'Colombia',    price: 34.00 },
        { name: 'Japan',       price: 40.00 },
        { name: 'Mexico',      price: 41.00 },
        { name: 'Senegal',     price: 51.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_fifa_world_cup_2026_golden_boot',
    title: 'FIFA World Cup 2026 Top Scorer',
    category: 'International',
    markets: [{
      eventId: 'wc2026-top-scorer',
      marketName: 'Top Scorer (Golden Boot)',
      outcomes: [
        { name: 'Kylian Mbappé',   price: 8.00  },
        { name: 'Erling Haaland',  price: 9.00  },
        { name: 'Lamine Yamal',    price: 11.00 },
        { name: 'Vinicius Jr',     price: 12.00 },
        { name: 'Harry Kane',      price: 13.00 },
        { name: 'Pedri',           price: 15.00 },
        { name: 'Bukayo Saka',     price: 17.00 },
        { name: 'Jude Bellingham', price: 19.00 },
        { name: 'Phil Foden',      price: 19.00 },
        { name: 'Rodri',           price: 21.00 },
      ],
    }],
  },

  // ── Champions League ─────────────────────────────────────────────────
  {
    sportKey: 'soccer_ucl_2026_27_winner',
    title: 'Champions League 2026/27 Winner',
    category: 'Champions League',
    leagueId: 9,
    markets: [{
      eventId: 'ucl-winner-2627',
      marketName: 'Tournament Winner',
      outcomes: [
        { name: 'Real Madrid',       price: 5.00  },
        { name: 'Manchester City',   price: 6.50  },
        { name: 'Bayern Munich',     price: 7.00  },
        { name: 'Liverpool',         price: 7.50  },
        { name: 'PSG',               price: 8.00  },
        { name: 'Arsenal',           price: 9.00  },
        { name: 'Barcelona',         price: 9.00  },
        { name: 'Inter Milan',       price: 13.00 },
        { name: 'Atletico Madrid',   price: 15.00 },
        { name: 'Borussia Dortmund', price: 17.00 },
      ],
    }],
  },

  // ── League Winners ───────────────────────────────────────────────────
  {
    sportKey: 'soccer_epl_2026_27_winner',
    title: 'Premier League 2026/27 Winner',
    category: 'League Winners',
    leagueId: 1,
    markets: [{
      eventId: 'epl-winner-2627',
      marketName: 'League Winner',
      outcomes: [
        { name: 'Manchester City',   price: 3.00  },
        { name: 'Arsenal',           price: 4.00  },
        { name: 'Liverpool',         price: 4.50  },
        { name: 'Chelsea',           price: 9.00  },
        { name: 'Manchester United', price: 13.00 },
        { name: 'Tottenham',         price: 15.00 },
        { name: 'Newcastle',         price: 19.00 },
        { name: 'Aston Villa',       price: 23.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_laliga_2026_27_winner',
    title: 'La Liga 2026/27 Winner',
    category: 'League Winners',
    leagueId: 2,
    markets: [{
      eventId: 'laliga-winner-2627',
      marketName: 'League Winner',
      outcomes: [
        { name: 'Real Madrid',     price: 1.85  },
        { name: 'Barcelona',       price: 3.75  },
        { name: 'Atletico Madrid', price: 7.00  },
        { name: 'Athletic Club',   price: 23.00 },
        { name: 'Villarreal',      price: 29.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_bundesliga_2026_27_winner',
    title: 'Bundesliga 2026/27 Winner',
    category: 'League Winners',
    leagueId: 3,
    markets: [{
      eventId: 'bundesliga-winner-2627',
      marketName: 'League Winner',
      outcomes: [
        { name: 'Bayern Munich',     price: 1.62  },
        { name: 'Bayer Leverkusen',  price: 5.50  },
        { name: 'Borussia Dortmund', price: 8.00  },
        { name: 'RB Leipzig',        price: 11.00 },
        { name: 'Stuttgart',         price: 17.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_seriea_2026_27_winner',
    title: 'Serie A 2026/27 Winner',
    category: 'League Winners',
    leagueId: 4,
    markets: [{
      eventId: 'seriea-winner-2627',
      marketName: 'League Winner',
      outcomes: [
        { name: 'Inter Milan',  price: 2.10  },
        { name: 'AC Milan',     price: 4.50  },
        { name: 'Napoli',       price: 5.50  },
        { name: 'Juventus',     price: 7.00  },
        { name: 'Roma',         price: 13.00 },
        { name: 'Lazio',        price: 15.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_ligue1_2026_27_winner',
    title: 'Ligue 1 2026/27 Winner',
    category: 'League Winners',
    leagueId: 5,
    markets: [{
      eventId: 'ligue1-winner-2627',
      marketName: 'League Winner',
      outcomes: [
        { name: 'PSG',        price: 1.22  },
        { name: 'Monaco',     price: 9.00  },
        { name: 'Lyon',       price: 13.00 },
        { name: 'Marseille',  price: 15.00 },
        { name: 'Nice',       price: 21.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_championship_2026_27_winner',
    title: 'EFL Championship 2026/27 Winner',
    category: 'League Winners',
    markets: [{
      eventId: 'championship-winner-2627',
      marketName: 'League Winner',
      outcomes: [
        { name: 'Sunderland',          price: 5.50  },
        { name: 'Sheffield United',    price: 7.00  },
        { name: 'Leeds United',        price: 7.50  },
        { name: 'West Brom',           price: 9.00  },
        { name: 'Millwall',            price: 11.00 },
        { name: 'Coventry City',       price: 13.00 },
        { name: 'Norwich City',        price: 13.00 },
        { name: 'Watford',             price: 15.00 },
      ],
    }],
  },

  // ── European Cups ────────────────────────────────────────────────────
  {
    sportKey: 'soccer_uel_2026_27_winner',
    title: 'Europa League 2026/27 Winner',
    category: 'European Cups',
    leagueId: 10,
    markets: [{
      eventId: 'uel-winner-2627',
      marketName: 'Tournament Winner',
      outcomes: [
        { name: 'Manchester United', price: 6.00  },
        { name: 'Roma',              price: 7.00  },
        { name: 'Atletico Madrid',   price: 7.50  },
        { name: 'Lazio',             price: 9.00  },
        { name: 'Porto',             price: 9.00  },
        { name: 'Ajax',              price: 11.00 },
        { name: 'Sevilla',           price: 11.00 },
        { name: 'Galatasaray',       price: 13.00 },
      ],
    }],
  },

  // ── NBA ──────────────────────────────────────────────────────────────
  {
    sportKey: 'basketball_nba_2026_champion',
    title: 'NBA Championship 2026',
    category: 'NBA',
    leagueId: 101,
    markets: [{
      eventId: 'nba-champion-2026',
      marketName: 'Championship Winner',
      outcomes: [
        { name: 'Oklahoma City Thunder',  price: 2.75  },
        { name: 'Boston Celtics',         price: 3.50  },
        { name: 'Cleveland Cavaliers',    price: 5.00  },
        { name: 'Golden State Warriors',  price: 8.00  },
        { name: 'Minnesota Timberwolves', price: 9.00  },
        { name: 'Denver Nuggets',         price: 10.00 },
        { name: 'New York Knicks',        price: 11.00 },
        { name: 'Miami Heat',             price: 23.00 },
      ],
    }],
  },

  // ── NFL ──────────────────────────────────────────────────────────────
  {
    sportKey: 'americanfootball_nfl_super_bowl_lxi',
    title: 'NFL Super Bowl LXI Winner',
    category: 'NFL',
    leagueId: 401,
    markets: [{
      eventId: 'nfl-sb-lxi',
      marketName: 'Super Bowl Winner',
      outcomes: [
        { name: 'Kansas City Chiefs',    price: 6.50  },
        { name: 'San Francisco 49ers',   price: 7.50  },
        { name: 'Philadelphia Eagles',   price: 8.00  },
        { name: 'Buffalo Bills',         price: 9.00  },
        { name: 'Baltimore Ravens',      price: 10.00 },
        { name: 'Dallas Cowboys',        price: 12.00 },
        { name: 'Cincinnati Bengals',    price: 15.00 },
        { name: 'Detroit Lions',         price: 15.00 },
        { name: 'Miami Dolphins',        price: 19.00 },
        { name: 'Houston Texans',        price: 21.00 },
      ],
    }],
  },

  // ── MLB ──────────────────────────────────────────────────────────────
  {
    sportKey: 'baseball_mlb_world_series_2026',
    title: 'MLB World Series 2026',
    category: 'MLB',
    leagueId: 501,
    markets: [{
      eventId: 'mlb-ws-2026',
      marketName: 'World Series Winner',
      outcomes: [
        { name: 'Los Angeles Dodgers',   price: 5.50  },
        { name: 'New York Yankees',      price: 6.00  },
        { name: 'Philadelphia Phillies', price: 9.00  },
        { name: 'Atlanta Braves',        price: 10.00 },
        { name: 'Houston Astros',        price: 11.00 },
        { name: 'Texas Rangers',         price: 12.00 },
        { name: 'San Diego Padres',      price: 13.00 },
        { name: 'Chicago Cubs',          price: 15.00 },
        { name: 'Seattle Mariners',      price: 17.00 },
      ],
    }],
  },

  // ── NHL ──────────────────────────────────────────────────────────────
  {
    sportKey: 'icehockey_nhl_stanley_cup_2026',
    title: 'NHL Stanley Cup 2026',
    category: 'NHL',
    leagueId: 601,
    markets: [{
      eventId: 'nhl-cup-2026',
      marketName: 'Stanley Cup Winner',
      outcomes: [
        { name: 'Florida Panthers',     price: 4.50  },
        { name: 'Colorado Avalanche',   price: 5.50  },
        { name: 'Toronto Maple Leafs',  price: 7.00  },
        { name: 'Vegas Golden Knights', price: 7.50  },
        { name: 'Carolina Hurricanes',  price: 8.00  },
        { name: 'Dallas Stars',         price: 9.00  },
        { name: 'Boston Bruins',        price: 10.00 },
        { name: 'Edmonton Oilers',      price: 11.00 },
      ],
    }],
  },

  // ── Golf ─────────────────────────────────────────────────────────────
  {
    sportKey: 'golf_us_open_2026',
    title: 'US Open 2026 Winner',
    category: 'Golf',
    leagueId: 801,
    markets: [{
      eventId: 'golf-usopen-2026',
      marketName: 'Tournament Winner',
      outcomes: [
        { name: 'Scottie Scheffler',  price: 5.00  },
        { name: 'Rory McIlroy',       price: 8.00  },
        { name: 'Xander Schauffele',  price: 9.00  },
        { name: 'Jon Rahm',           price: 11.00 },
        { name: 'Collin Morikawa',    price: 12.00 },
        { name: 'Viktor Hovland',     price: 15.00 },
        { name: 'Ludvig Åberg',       price: 17.00 },
      ],
    }],
  },
  {
    sportKey: 'golf_the_open_2026',
    title: 'The Open Championship 2026 Winner',
    category: 'Golf',
    leagueId: 801,
    markets: [{
      eventId: 'golf-open-2026',
      marketName: 'Tournament Winner',
      outcomes: [
        { name: 'Rory McIlroy',      price: 7.00  },
        { name: 'Scottie Scheffler', price: 8.00  },
        { name: 'Shane Lowry',       price: 11.00 },
        { name: 'Jon Rahm',          price: 13.00 },
        { name: 'Tommy Fleetwood',   price: 15.00 },
        { name: 'Xander Schauffele', price: 15.00 },
        { name: 'Collin Morikawa',   price: 17.00 },
      ],
    }],
  },

  // ── Tennis ───────────────────────────────────────────────────────────
  {
    sportKey: 'tennis_wimbledon_2026_men',
    title: "Wimbledon 2026 Men's Singles",
    category: 'Tennis',
    leagueId: 901,
    markets: [{
      eventId: 'wimbledon-2026-men',
      marketName: "Men's Champion",
      outcomes: [
        { name: 'Jannik Sinner',    price: 2.88  },
        { name: 'Carlos Alcaraz',   price: 3.50  },
        { name: 'Novak Djokovic',   price: 5.00  },
        { name: 'Alexander Zverev', price: 9.00  },
        { name: 'Daniil Medvedev',  price: 10.00 },
        { name: 'Taylor Fritz',     price: 17.00 },
      ],
    }],
  },
  {
    sportKey: 'tennis_wimbledon_2026_women',
    title: "Wimbledon 2026 Women's Singles",
    category: 'Tennis',
    leagueId: 901,
    markets: [{
      eventId: 'wimbledon-2026-women',
      marketName: "Women's Champion",
      outcomes: [
        { name: 'Iga Swiatek',      price: 2.50  },
        { name: 'Aryna Sabalenka',  price: 3.50  },
        { name: 'Elena Rybakina',   price: 5.50  },
        { name: 'Coco Gauff',       price: 7.00  },
        { name: 'Jessica Pegula',   price: 11.00 },
        { name: 'Madison Keys',     price: 13.00 },
      ],
    }],
  },

  // ── Specials (award & manager markets) ───────────────────────────────
  {
    sportKey: 'soccer_ballon_dor_2026',
    title: "Ballon d'Or 2026 Winner",
    category: 'Specials',
    markets: [{
      eventId: 'ballon-dor-2026',
      marketName: "Ballon d'Or Winner",
      outcomes: [
        { name: 'Lamine Yamal',    price: 3.25  },
        { name: 'Vinicius Jr',     price: 4.00  },
        { name: 'Kylian Mbappé',   price: 5.50  },
        { name: 'Rodri',           price: 6.00  },
        { name: 'Erling Haaland',  price: 7.00  },
        { name: 'Jude Bellingham', price: 9.00  },
        { name: 'Bukayo Saka',     price: 11.00 },
        { name: 'Pedri',           price: 13.00 },
        { name: 'Phil Foden',      price: 15.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_fifa_best_2026',
    title: "FIFA Best Men's Player 2026",
    category: 'Specials',
    markets: [{
      eventId: 'fifa-best-2026',
      marketName: 'FIFA Best Player',
      outcomes: [
        { name: 'Lamine Yamal',    price: 3.50  },
        { name: 'Vinicius Jr',     price: 4.00  },
        { name: 'Kylian Mbappé',   price: 5.00  },
        { name: 'Erling Haaland',  price: 7.00  },
        { name: 'Rodri',           price: 7.50  },
        { name: 'Jude Bellingham', price: 9.00  },
        { name: 'Bukayo Saka',     price: 13.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_prem_top_scorer_2026_27',
    title: 'Premier League Top Scorer 2026/27',
    category: 'Specials',
    leagueId: 1,
    markets: [{
      eventId: 'epl-top-scorer-2627',
      marketName: 'Top Scorer',
      outcomes: [
        { name: 'Erling Haaland',   price: 3.50  },
        { name: 'Alexander Isak',   price: 7.00  },
        { name: 'Cole Palmer',      price: 8.00  },
        { name: 'Mohamed Salah',    price: 9.00  },
        { name: 'Ollie Watkins',    price: 11.00 },
        { name: 'Marcus Rashford',  price: 13.00 },
        { name: 'Dominic Solanke',  price: 15.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_ucl_top_scorer_2026_27',
    title: 'Champions League Top Scorer 2026/27',
    category: 'Specials',
    leagueId: 9,
    markets: [{
      eventId: 'ucl-top-scorer-2627',
      marketName: 'Top Scorer',
      outcomes: [
        { name: 'Erling Haaland',       price: 5.00  },
        { name: 'Kylian Mbappé',        price: 5.50  },
        { name: 'Vinicius Jr',          price: 6.00  },
        { name: 'Harry Kane',           price: 8.00  },
        { name: 'Lamine Yamal',         price: 9.00  },
        { name: 'Robert Lewandowski',   price: 10.00 },
        { name: 'Bukayo Saka',          price: 13.00 },
      ],
    }],
  },
  {
    sportKey: 'soccer_wc2026_golden_glove',
    title: 'FIFA World Cup 2026 Best Goalkeeper',
    category: 'Specials',
    markets: [{
      eventId: 'wc2026-golden-glove',
      marketName: 'Golden Glove Award',
      outcomes: [
        { name: 'Alisson',            price: 6.00  },
        { name: 'Ederson',            price: 7.00  },
        { name: 'Mike Maignan',       price: 8.00  },
        { name: 'Emiliano Martínez',  price: 9.00  },
        { name: 'Jordan Pickford',    price: 11.00 },
        { name: 'Manuel Neuer',       price: 13.00 },
        { name: 'David Raya',         price: 13.00 },
      ],
    }],
  },
];
