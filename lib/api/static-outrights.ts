/**
 * Curated outright odds — sourced from leading UK/EU bookmakers (Oddschecker aggregates).
 * Used as a high-quality fallback when live API keys are not configured or return no data.
 * Update these periodically as seasons progress.
 * Last updated: May 2026
 */

export interface StaticOutright {
  id: string;
  name: string;
  outcomes: { name: string; price: number }[];
}

const STATIC: Record<number, StaticOutright[]> = {
  // ── Premier League (2024/25) ────────────────────────────────────────────
  1: [
    {
      id: 'epl-winner-2425',
      name: 'Premier League Winner',
      outcomes: [
        { name: 'Arsenal', price: 1.29 },
        { name: 'Manchester City', price: 4.50 },
        { name: 'Liverpool', price: 15.00 },
        { name: 'Chelsea', price: 51.00 },
        { name: 'Nottingham Forest', price: 101.00 },
      ],
    },
    {
      id: 'epl-top4-2425',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Manchester United', price: 1.002 },
        { name: 'Liverpool', price: 1.40 },
        { name: 'Aston Villa', price: 3.60 },
        { name: 'Tottenham', price: 4.50 },
        { name: 'Chelsea', price: 5.00 },
        { name: 'Everton', price: 501.00 },
      ],
    },
    {
      id: 'epl-relegation-2425',
      name: 'Relegation (To Be Relegated)',
      outcomes: [
        { name: 'West Ham', price: 1.30 },
        { name: 'Tottenham', price: 4.50 },
        { name: 'Leeds United', price: 101.00 },
        { name: 'Nottingham Forest', price: 176.00 },
      ],
    },
  ],

  // ── La Liga (2024/25) ───────────────────────────────────────────────────
  2: [
    {
      id: 'laliga-winner-2425',
      name: 'La Liga Winner',
      outcomes: [
        { name: 'Real Madrid', price: 1.12 },
        { name: 'Barcelona', price: 7.00 },
        { name: 'Atletico Madrid', price: 17.00 },
        { name: 'Athletic Club', price: 51.00 },
        { name: 'Villarreal', price: 151.00 },
      ],
    },
    {
      id: 'laliga-top4-2425',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Real Madrid', price: 1.02 },
        { name: 'Barcelona', price: 1.05 },
        { name: 'Atletico Madrid', price: 1.10 },
        { name: 'Athletic Club', price: 1.80 },
        { name: 'Villarreal', price: 3.50 },
        { name: 'Sevilla', price: 7.00 },
      ],
    },
  ],

  // ── Bundesliga (2024/25) ────────────────────────────────────────────────
  3: [
    {
      id: 'bundesliga-winner-2425',
      name: 'Bundesliga Winner',
      outcomes: [
        { name: 'Bayern Munich', price: 1.15 },
        { name: 'Bayer Leverkusen', price: 6.00 },
        { name: 'Borussia Dortmund', price: 19.00 },
        { name: 'RB Leipzig', price: 34.00 },
        { name: 'Eintracht Frankfurt', price: 67.00 },
      ],
    },
    {
      id: 'bundesliga-top4-2425',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Bayern Munich', price: 1.02 },
        { name: 'Bayer Leverkusen', price: 1.10 },
        { name: 'Borussia Dortmund', price: 1.25 },
        { name: 'RB Leipzig', price: 1.80 },
        { name: 'Eintracht Frankfurt', price: 2.50 },
        { name: 'VfB Stuttgart', price: 3.50 },
      ],
    },
  ],

  // ── Serie A (2024/25) ───────────────────────────────────────────────────
  4: [
    {
      id: 'seriea-winner-2425',
      name: 'Serie A Winner',
      outcomes: [
        { name: 'Inter Milan', price: 1.15 },
        { name: 'Napoli', price: 4.50 },
        { name: 'Atalanta', price: 9.00 },
        { name: 'Juventus', price: 17.00 },
        { name: 'Lazio', price: 34.00 },
      ],
    },
    {
      id: 'seriea-top4-2425',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Inter Milan', price: 1.02 },
        { name: 'Napoli', price: 1.08 },
        { name: 'Atalanta', price: 1.20 },
        { name: 'Juventus', price: 1.50 },
        { name: 'Milan', price: 2.20 },
        { name: 'Lazio', price: 3.00 },
      ],
    },
  ],

  // ── Ligue 1 (2024/25) ──────────────────────────────────────────────────
  5: [
    {
      id: 'ligue1-winner-2425',
      name: 'Ligue 1 Winner',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 1.07 },
        { name: 'Monaco', price: 10.00 },
        { name: 'Marseille', price: 21.00 },
        { name: 'Lille', price: 26.00 },
        { name: 'Nice', price: 41.00 },
      ],
    },
    {
      id: 'ligue1-top3-2425',
      name: 'Top 3 Finish',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 1.01 },
        { name: 'Monaco', price: 1.12 },
        { name: 'Marseille', price: 1.25 },
        { name: 'Lille', price: 1.80 },
        { name: 'Nice', price: 2.50 },
        { name: 'Rennes', price: 5.00 },
      ],
    },
  ],

  // ── UEFA Champions League (2024/25) ────────────────────────────────────
  9: [
    {
      id: 'ucl-winner-2425',
      name: 'Champions League Winner',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 2.50 },
        { name: 'Arsenal', price: 3.50 },
        { name: 'Inter Milan', price: 5.00 },
        { name: 'Real Madrid', price: 5.50 },
        { name: 'Bayern Munich', price: 6.00 },
        { name: 'Barcelona', price: 9.00 },
        { name: 'Atletico Madrid', price: 12.00 },
        { name: 'Manchester City', price: 15.00 },
      ],
    },
  ],

  // ── NBA (2024/25 Playoffs) ──────────────────────────────────────────────
  101: [
    {
      id: 'nba-champion-2425',
      name: 'NBA Champion',
      outcomes: [
        { name: 'Oklahoma City Thunder', price: 2.00 },
        { name: 'Cleveland Cavaliers', price: 3.50 },
        { name: 'Boston Celtics', price: 4.50 },
        { name: 'Denver Nuggets', price: 7.00 },
        { name: 'New York Knicks', price: 8.00 },
        { name: 'Golden State Warriors', price: 12.00 },
        { name: 'Memphis Grizzlies', price: 15.00 },
        { name: 'Houston Rockets', price: 17.00 },
      ],
    },
  ],

  // ── NFL (2025/26 Season Futures) ───────────────────────────────────────
  401: [
    {
      id: 'nfl-sb-2526',
      name: 'Super Bowl LX Winner',
      outcomes: [
        { name: 'Kansas City Chiefs', price: 5.50 },
        { name: 'Philadelphia Eagles', price: 6.00 },
        { name: 'Baltimore Ravens', price: 8.00 },
        { name: 'Detroit Lions', price: 8.00 },
        { name: 'Dallas Cowboys', price: 10.00 },
        { name: 'San Francisco 49ers', price: 11.00 },
        { name: 'Houston Texans', price: 13.00 },
        { name: 'Buffalo Bills', price: 13.00 },
      ],
    },
  ],

  // ── MLB (2025 Season) ───────────────────────────────────────────────────
  501: [
    {
      id: 'mlb-ws-2025',
      name: 'World Series Winner',
      outcomes: [
        { name: 'Los Angeles Dodgers', price: 4.00 },
        { name: 'New York Yankees', price: 6.00 },
        { name: 'Atlanta Braves', price: 8.00 },
        { name: 'Houston Astros', price: 9.00 },
        { name: 'Philadelphia Phillies', price: 10.00 },
        { name: 'Toronto Blue Jays', price: 11.00 },
        { name: 'San Diego Padres', price: 13.00 },
        { name: 'Chicago Cubs', price: 15.00 },
      ],
    },
  ],

  // ── NHL (2024/25 Playoffs) ──────────────────────────────────────────────
  601: [
    {
      id: 'nhl-cup-2425',
      name: 'Stanley Cup Winner',
      outcomes: [
        { name: 'Florida Panthers', price: 4.00 },
        { name: 'Toronto Maple Leafs', price: 5.50 },
        { name: 'Colorado Avalanche', price: 6.00 },
        { name: 'Vegas Golden Knights', price: 7.00 },
        { name: 'Dallas Stars', price: 8.00 },
        { name: 'Edmonton Oilers', price: 9.00 },
        { name: 'Carolina Hurricanes', price: 10.00 },
        { name: 'Winnipeg Jets', price: 11.00 },
      ],
    },
  ],

  // ── UFC / MMA ───────────────────────────────────────────────────────────
  2701: [
    {
      id: 'ufc-hw-champion-2025',
      name: 'UFC Heavyweight Champion (Next Defence)',
      outcomes: [
        { name: 'Jon Jones', price: 1.44 },
        { name: 'Ciryl Gane', price: 5.50 },
        { name: 'Tom Aspinall', price: 6.00 },
        { name: 'Stipe Miocic', price: 8.00 },
        { name: 'Curtis Blaydes', price: 15.00 },
      ],
    },
    {
      id: 'ufc-lhw-champion-2025',
      name: 'UFC Light Heavyweight Champion',
      outcomes: [
        { name: 'Alex Pereira', price: 1.50 },
        { name: 'Magomed Ankalaev', price: 4.00 },
        { name: 'Jamahal Hill', price: 6.00 },
        { name: 'Jan Blachowicz', price: 10.00 },
        { name: 'Jiri Prochazka', price: 11.00 },
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
