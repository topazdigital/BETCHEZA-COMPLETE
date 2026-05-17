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
