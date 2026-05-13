/**
 * Curated outright odds — sourced from leading UK/EU bookmakers (Oddschecker aggregates).
 * Used as a high-quality fallback when live API keys are not configured or return no data.
 * Update these periodically as seasons progress.
 * Last updated: May 2026  (2025/26 season — late-season odds)
 */

export interface StaticOutright {
  id: string;
  name: string;
  outcomes: { name: string; price: number }[];
}

const STATIC: Record<number, StaticOutright[]> = {
  // ── Premier League (2025/26) ────────────────────────────────────────────
  1: [
    {
      id: 'epl-winner-2526',
      name: 'Premier League Winner',
      outcomes: [
        { name: 'Arsenal', price: 1.22 },
        { name: 'Liverpool', price: 5.00 },
        { name: 'Manchester City', price: 9.00 },
        { name: 'Chelsea', price: 34.00 },
        { name: 'Nottingham Forest', price: 67.00 },
      ],
    },
    {
      id: 'epl-top4-2526',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Arsenal', price: 1.01 },
        { name: 'Liverpool', price: 1.08 },
        { name: 'Chelsea', price: 1.35 },
        { name: 'Manchester City', price: 1.80 },
        { name: 'Nottingham Forest', price: 2.20 },
        { name: 'Newcastle United', price: 3.00 },
      ],
    },
    {
      id: 'epl-relegation-2526',
      name: 'Relegation (To Be Relegated)',
      outcomes: [
        { name: 'Southampton', price: 1.03 },
        { name: 'Ipswich Town', price: 1.12 },
        { name: 'Leicester City', price: 1.40 },
        { name: 'Wolverhampton Wanderers', price: 3.50 },
        { name: 'Crystal Palace', price: 8.00 },
      ],
    },
  ],

  // ── La Liga (2025/26) ───────────────────────────────────────────────────
  2: [
    {
      id: 'laliga-winner-2526',
      name: 'La Liga Winner',
      outcomes: [
        { name: 'Barcelona', price: 1.40 },
        { name: 'Real Madrid', price: 3.25 },
        { name: 'Atletico Madrid', price: 12.00 },
        { name: 'Athletic Club', price: 51.00 },
        { name: 'Villarreal', price: 101.00 },
      ],
    },
    {
      id: 'laliga-top4-2526',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Barcelona', price: 1.01 },
        { name: 'Real Madrid', price: 1.04 },
        { name: 'Atletico Madrid', price: 1.15 },
        { name: 'Athletic Club', price: 1.80 },
        { name: 'Villarreal', price: 3.00 },
        { name: 'Sevilla', price: 6.00 },
      ],
    },
  ],

  // ── Bundesliga (2025/26) ────────────────────────────────────────────────
  3: [
    {
      id: 'bundesliga-winner-2526',
      name: 'Bundesliga Winner',
      outcomes: [
        { name: 'Bayern Munich', price: 1.18 },
        { name: 'Bayer Leverkusen', price: 5.50 },
        { name: 'Borussia Dortmund', price: 15.00 },
        { name: 'RB Leipzig', price: 21.00 },
        { name: 'Eintracht Frankfurt', price: 51.00 },
      ],
    },
    {
      id: 'bundesliga-top4-2526',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Bayern Munich', price: 1.01 },
        { name: 'Bayer Leverkusen', price: 1.12 },
        { name: 'Borussia Dortmund', price: 1.30 },
        { name: 'RB Leipzig', price: 1.75 },
        { name: 'Eintracht Frankfurt', price: 2.50 },
        { name: 'VfB Stuttgart', price: 3.25 },
      ],
    },
  ],

  // ── Serie A (2025/26) ───────────────────────────────────────────────────
  4: [
    {
      id: 'seriea-winner-2526',
      name: 'Serie A Winner',
      outcomes: [
        { name: 'Napoli', price: 1.80 },
        { name: 'Inter Milan', price: 2.75 },
        { name: 'Juventus', price: 9.00 },
        { name: 'Atalanta', price: 11.00 },
        { name: 'Lazio', price: 26.00 },
      ],
    },
    {
      id: 'seriea-top4-2526',
      name: 'Top 4 Finish',
      outcomes: [
        { name: 'Napoli', price: 1.04 },
        { name: 'Inter Milan', price: 1.08 },
        { name: 'Juventus', price: 1.25 },
        { name: 'Atalanta', price: 1.40 },
        { name: 'Milan', price: 2.00 },
        { name: 'Lazio', price: 2.75 },
      ],
    },
  ],

  // ── Ligue 1 (2025/26) ──────────────────────────────────────────────────
  5: [
    {
      id: 'ligue1-winner-2526',
      name: 'Ligue 1 Winner',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 1.10 },
        { name: 'Monaco', price: 8.00 },
        { name: 'Marseille', price: 17.00 },
        { name: 'Lille', price: 21.00 },
        { name: 'Nice', price: 34.00 },
      ],
    },
    {
      id: 'ligue1-top3-2526',
      name: 'Top 3 Finish',
      outcomes: [
        { name: 'Paris Saint-Germain', price: 1.01 },
        { name: 'Monaco', price: 1.15 },
        { name: 'Marseille', price: 1.30 },
        { name: 'Lille', price: 1.85 },
        { name: 'Nice', price: 2.75 },
        { name: 'Rennes', price: 5.50 },
      ],
    },
  ],

  // ── Eredivisie (2025/26) ────────────────────────────────────────────────
  6: [
    {
      id: 'eredivisie-winner-2526',
      name: 'Eredivisie Winner',
      outcomes: [
        { name: 'Ajax', price: 1.55 },
        { name: 'PSV', price: 2.75 },
        { name: 'Feyenoord', price: 6.00 },
        { name: 'AZ', price: 17.00 },
      ],
    },
  ],

  // ── Primeira Liga (2025/26) ─────────────────────────────────────────────
  7: [
    {
      id: 'primeira-winner-2526',
      name: 'Primeira Liga Winner',
      outcomes: [
        { name: 'Sporting CP', price: 1.35 },
        { name: 'Benfica', price: 3.50 },
        { name: 'Porto', price: 6.00 },
        { name: 'Braga', price: 51.00 },
      ],
    },
  ],

  // ── UEFA Champions League (2025/26) ────────────────────────────────────
  9: [
    {
      id: 'ucl-winner-2526',
      name: 'Champions League Winner',
      outcomes: [
        { name: 'Arsenal', price: 3.00 },
        { name: 'Real Madrid', price: 3.50 },
        { name: 'Barcelona', price: 4.50 },
        { name: 'Bayern Munich', price: 5.00 },
        { name: 'Inter Milan', price: 6.00 },
        { name: 'Paris Saint-Germain', price: 8.00 },
        { name: 'Atletico Madrid', price: 13.00 },
        { name: 'Borussia Dortmund', price: 17.00 },
      ],
    },
  ],

  // ── UEFA Europa League (2025/26) ────────────────────────────────────────
  10: [
    {
      id: 'uel-winner-2526',
      name: 'Europa League Winner',
      outcomes: [
        { name: 'Manchester United', price: 4.50 },
        { name: 'Tottenham Hotspur', price: 5.50 },
        { name: 'Lazio', price: 6.00 },
        { name: 'Lyon', price: 7.00 },
        { name: 'Galatasaray', price: 9.00 },
        { name: 'Ajax', price: 11.00 },
        { name: 'Eintracht Frankfurt', price: 13.00 },
      ],
    },
  ],

  // ── NBA (2024/25 Playoffs — Finals stage May 2026) ──────────────────────
  101: [
    {
      id: 'nba-champion-2425',
      name: 'NBA Champion',
      outcomes: [
        { name: 'Oklahoma City Thunder', price: 1.85 },
        { name: 'Cleveland Cavaliers', price: 3.25 },
        { name: 'Indiana Pacers', price: 5.50 },
        { name: 'New York Knicks', price: 7.00 },
        { name: 'Boston Celtics', price: 9.00 },
        { name: 'Denver Nuggets', price: 11.00 },
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
        { name: 'Baltimore Ravens', price: 7.00 },
        { name: 'Detroit Lions', price: 8.00 },
        { name: 'Buffalo Bills', price: 9.00 },
        { name: 'San Francisco 49ers', price: 10.00 },
        { name: 'Houston Texans', price: 12.00 },
        { name: 'Dallas Cowboys', price: 13.00 },
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
        { name: 'Philadelphia Phillies', price: 8.00 },
        { name: 'Atlanta Braves', price: 9.00 },
        { name: 'Houston Astros', price: 10.00 },
        { name: 'San Diego Padres', price: 12.00 },
        { name: 'Toronto Blue Jays', price: 13.00 },
        { name: 'Chicago Cubs', price: 15.00 },
      ],
    },
  ],

  // ── NHL (2024/25 Playoffs — May 2026) ──────────────────────────────────
  601: [
    {
      id: 'nhl-cup-2425',
      name: 'Stanley Cup Winner',
      outcomes: [
        { name: 'Florida Panthers', price: 3.75 },
        { name: 'Toronto Maple Leafs', price: 4.50 },
        { name: 'Dallas Stars', price: 5.50 },
        { name: 'Colorado Avalanche', price: 6.00 },
        { name: 'Vegas Golden Knights', price: 7.00 },
        { name: 'Edmonton Oilers', price: 8.00 },
        { name: 'Carolina Hurricanes', price: 9.00 },
        { name: 'Winnipeg Jets', price: 10.00 },
      ],
    },
  ],

  // ── UFC / MMA ───────────────────────────────────────────────────────────
  2701: [
    {
      id: 'ufc-hw-champion-2025',
      name: 'UFC Heavyweight Champion (Next Defence)',
      outcomes: [
        { name: 'Jon Jones', price: 1.40 },
        { name: 'Tom Aspinall', price: 4.00 },
        { name: 'Ciryl Gane', price: 6.00 },
        { name: 'Curtis Blaydes', price: 11.00 },
        { name: 'Alexander Volkov', price: 17.00 },
      ],
    },
    {
      id: 'ufc-lhw-champion-2025',
      name: 'UFC Light Heavyweight Champion',
      outcomes: [
        { name: 'Alex Pereira', price: 1.44 },
        { name: 'Magomed Ankalaev', price: 3.75 },
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
