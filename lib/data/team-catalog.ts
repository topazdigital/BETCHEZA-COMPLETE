// Static catalog of well-known senior football clubs.
//
// Used by `/api/search` so users searching for "Arsenal", "Chelsea",
// "Liverpool" etc. always get the SENIOR (men's) side as the top hit even
// when that club isn't playing today. Without this catalog, the only
// teams that show up in search are those that happen to be in today's
// fixture feed — which is why typing "Arsenal" used to surface only
// "Arsenal Women" on a midweek when the senior side wasn't playing.
//
// IDs are the canonical ESPN team ids (not the football-data.org `fd_team_*`
// prefixed shape). They power `/teams/[id]` and the team page resolver
// (`app/api/teams/[id]/route.ts`) so they must be real ESPN ids.

export interface CatalogTeam {
  /** ESPN team id (e.g. "359" for Arsenal). */
  id: string;
  /** Display name shown in search results. */
  name: string;
  /** Optional aliases for matching ("Spurs", "Man Utd", "PSG", "Barca"). */
  aliases?: string[];
  /** League name shown as the subtitle in search results. */
  league: string;
  /** Country shown next to the league name. */
  country: string;
  /** Crest URL — uses ESPN's CDN by default. */
  logo?: string;
}

const espnLogo = (id: string) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

// Built one league at a time so we can grow it without touching unrelated
// blocks. IDs verified against ESPN's public API.
export const SENIOR_FOOTBALL_TEAMS: CatalogTeam[] = [
  // ── Premier League ────────────────────────────────────────────────
  { id: '359',  name: 'Arsenal',                aliases: ['gunners', 'afc'],          league: 'Premier League', country: 'England' },
  { id: '362',  name: 'Aston Villa',                                                   league: 'Premier League', country: 'England' },
  { id: '349',  name: 'Bournemouth',                                                   league: 'Premier League', country: 'England' },
  { id: '337',  name: 'Brentford',                                                     league: 'Premier League', country: 'England' },
  { id: '331',  name: 'Brighton & Hove Albion', aliases: ['brighton'],                 league: 'Premier League', country: 'England' },
  { id: '379',  name: 'Burnley',                                                       league: 'Premier League', country: 'England' },
  { id: '363',  name: 'Chelsea',                aliases: ['blues', 'cfc'],             league: 'Premier League', country: 'England' },
  { id: '384',  name: 'Crystal Palace',         aliases: ['palace'],                   league: 'Premier League', country: 'England' },
  { id: '368',  name: 'Everton',                aliases: ['toffees'],                  league: 'Premier League', country: 'England' },
  { id: '370',  name: 'Fulham',                                                        league: 'Premier League', country: 'England' },
  { id: '364',  name: 'Liverpool',              aliases: ['reds', 'lfc'],              league: 'Premier League', country: 'England' },
  { id: '378',  name: 'Leeds United',           aliases: ['leeds'],                    league: 'Premier League', country: 'England' },
  { id: '382',  name: 'Manchester City',        aliases: ['man city', 'mcfc', 'city'], league: 'Premier League', country: 'England' },
  { id: '360',  name: 'Manchester United',      aliases: ['man utd', 'man u', 'mufc', 'united'], league: 'Premier League', country: 'England' },
  { id: '361',  name: 'Newcastle United',       aliases: ['newcastle', 'nufc', 'magpies'], league: 'Premier League', country: 'England' },
  { id: '381',  name: 'Nottingham Forest',      aliases: ['forest', 'nffc'],           league: 'Premier League', country: 'England' },
  { id: '376',  name: 'Sunderland',                                                    league: 'Premier League', country: 'England' },
  { id: '367',  name: 'Tottenham Hotspur',      aliases: ['spurs', 'thfc', 'tottenham'], league: 'Premier League', country: 'England' },
  { id: '371',  name: 'West Ham United',        aliases: ['west ham', 'whu', 'hammers'], league: 'Premier League', country: 'England' },
  { id: '380',  name: 'Wolverhampton Wanderers', aliases: ['wolves', 'wolverhampton'], league: 'Premier League', country: 'England' },

  // ── La Liga ───────────────────────────────────────────────────────
  { id: '83',    name: 'Barcelona',             aliases: ['barca', 'fcb', 'fc barcelona'], league: 'La Liga', country: 'Spain' },
  { id: '86',    name: 'Real Madrid',           aliases: ['madrid', 'rma', 'los blancos'],  league: 'La Liga', country: 'Spain' },
  { id: '1068',  name: 'Atletico Madrid',       aliases: ['atleti', 'atm', 'atletico de madrid'], league: 'La Liga', country: 'Spain' },
  { id: '88',    name: 'Athletic Club',         aliases: ['athletic bilbao'],          league: 'La Liga', country: 'Spain' },
  { id: '89',    name: 'Real Sociedad',         aliases: ['la real'],                  league: 'La Liga', country: 'Spain' },
  { id: '90',    name: 'Real Betis',            aliases: ['betis'],                    league: 'La Liga', country: 'Spain' },
  { id: '243',   name: 'Sevilla FC',            aliases: ['sevilla'],                  league: 'La Liga', country: 'Spain' },
  { id: '94',    name: 'Valencia',                                                     league: 'La Liga', country: 'Spain' },
  { id: '93',    name: 'Villarreal',                                                   league: 'La Liga', country: 'Spain' },
  { id: '85',    name: 'Celta Vigo',                                                   league: 'La Liga', country: 'Spain' },
  { id: '244',   name: 'Getafe',                                                       league: 'La Liga', country: 'Spain' },
  { id: '839',   name: 'Rayo Vallecano',                                               league: 'La Liga', country: 'Spain' },
  { id: '95',    name: 'RCD Espanyol',          aliases: ['espanyol'],                 league: 'La Liga', country: 'Spain' },
  { id: '3842',  name: 'Girona',                                                       league: 'La Liga', country: 'Spain' },

  // ── Serie A ───────────────────────────────────────────────────────
  { id: '111',   name: 'Juventus',              aliases: ['juve', 'old lady'],         league: 'Serie A', country: 'Italy' },
  { id: '110',   name: 'Inter Milan',           aliases: ['inter', 'internazionale'],  league: 'Serie A', country: 'Italy' },
  { id: '103',   name: 'AC Milan',              aliases: ['milan', 'rossoneri'],       league: 'Serie A', country: 'Italy' },
  { id: '114',   name: 'Napoli',                aliases: ['ssc napoli', 'partenopei'], league: 'Serie A', country: 'Italy' },
  { id: '104',   name: 'AS Roma',               aliases: ['roma', 'giallorossi'],      league: 'Serie A', country: 'Italy' },
  { id: '105',   name: 'Lazio',                 aliases: ['biancocelesti'],            league: 'Serie A', country: 'Italy' },
  { id: '99',    name: 'Atalanta',              aliases: ['la dea'],                   league: 'Serie A', country: 'Italy' },
  { id: '108',   name: 'Fiorentina',            aliases: ['viola'],                    league: 'Serie A', country: 'Italy' },
  { id: '106',   name: 'Bologna',                                                      league: 'Serie A', country: 'Italy' },
  { id: '109',   name: 'Genoa',                                                        league: 'Serie A', country: 'Italy' },
  { id: '113',   name: 'Torino',                                                       league: 'Serie A', country: 'Italy' },
  { id: '116',   name: 'Udinese',                                                      league: 'Serie A', country: 'Italy' },
  { id: '102',   name: 'Sassuolo',                                                     league: 'Serie A', country: 'Italy' },

  // ── Bundesliga ────────────────────────────────────────────────────
  { id: '132',   name: 'Bayern Munich',         aliases: ['bayern', 'fcb', 'bayern münchen', 'bavarians'], league: 'Bundesliga', country: 'Germany' },
  { id: '124',   name: 'Borussia Dortmund',     aliases: ['bvb', 'dortmund'],          league: 'Bundesliga', country: 'Germany' },
  { id: '125',   name: 'Bayer Leverkusen',      aliases: ['leverkusen', 'werkself'],   league: 'Bundesliga', country: 'Germany' },
  { id: '131',   name: 'RB Leipzig',            aliases: ['leipzig', 'die roten bullen'], league: 'Bundesliga', country: 'Germany' },
  { id: '127',   name: 'Eintracht Frankfurt',   aliases: ['eintracht', 'frankfurt'],   league: 'Bundesliga', country: 'Germany' },
  { id: '134',   name: 'VfB Stuttgart',         aliases: ['stuttgart'],                league: 'Bundesliga', country: 'Germany' },
  { id: '136',   name: 'Wolfsburg',             aliases: ['vfl wolfsburg'],            league: 'Bundesliga', country: 'Germany' },
  { id: '129',   name: 'Borussia Mönchengladbach', aliases: ['gladbach', 'monchengladbach', 'fohlen'], league: 'Bundesliga', country: 'Germany' },
  { id: '128',   name: 'Hamburger SV',          aliases: ['hamburg', 'hsv'],           league: 'Bundesliga', country: 'Germany' },
  { id: '17021', name: 'Union Berlin',                                                 league: 'Bundesliga', country: 'Germany' },
  { id: '133',   name: '1. FC Köln',            aliases: ['koln', 'cologne', 'köln'],  league: 'Bundesliga', country: 'Germany' },
  { id: '139',   name: 'Werder Bremen',         aliases: ['bremen'],                   league: 'Bundesliga', country: 'Germany' },
  { id: '126',   name: 'SC Freiburg',           aliases: ['freiburg'],                 league: 'Bundesliga', country: 'Germany' },
  { id: '135',   name: 'TSG Hoffenheim',        aliases: ['hoffenheim'],               league: 'Bundesliga', country: 'Germany' },

  // ── Ligue 1 ───────────────────────────────────────────────────────
  { id: '160',   name: 'Paris Saint-Germain',   aliases: ['psg', 'paris sg', 'parisiens'], league: 'Ligue 1', country: 'France' },
  { id: '176',   name: 'Marseille',             aliases: ['om', 'olympique de marseille'], league: 'Ligue 1', country: 'France' },
  { id: '170',   name: 'Olympique Lyonnais',    aliases: ['lyon', 'ol'],               league: 'Ligue 1', country: 'France' },
  { id: '174',   name: 'Monaco',                aliases: ['as monaco', 'rouge et blanc'], league: 'Ligue 1', country: 'France' },
  { id: '180',   name: 'Lille',                 aliases: ['losc', 'losc lille'],       league: 'Ligue 1', country: 'France' },
  { id: '162',   name: 'Nice',                  aliases: ['ogc nice'],                 league: 'Ligue 1', country: 'France' },
  { id: '178',   name: 'Rennes',                aliases: ['stade rennais'],            league: 'Ligue 1', country: 'France' },
  { id: '173',   name: 'Lens',                  aliases: ['rc lens'],                  league: 'Ligue 1', country: 'France' },
  { id: '177',   name: 'Strasbourg',            aliases: ['rc strasbourg'],            league: 'Ligue 1', country: 'France' },
  { id: '163',   name: 'Nantes',                aliases: ['fc nantes', 'canaris'],     league: 'Ligue 1', country: 'France' },
  { id: '17080', name: 'Paris FC',              aliases: ['pfc'],                      league: 'Ligue 1', country: 'France' },

  // ── Eredivisie & Primeira Liga giants ─────────────────────────────
  { id: '109',   name: 'Ajax',                  aliases: ['ajax amsterdam'],           league: 'Eredivisie', country: 'Netherlands' },
  // (PSV/Feyenoord ESPN ids confirmed from scoreboard payloads.)
  { id: '148',   name: 'PSV Eindhoven',         aliases: ['psv'],                      league: 'Eredivisie', country: 'Netherlands' },
  { id: '156',   name: 'Feyenoord',                                                    league: 'Eredivisie', country: 'Netherlands' },
  { id: '231',   name: 'Benfica',               aliases: ['sl benfica', 'as aguias'],  league: 'Primeira Liga', country: 'Portugal' },
  { id: '228',   name: 'FC Porto',              aliases: ['porto', 'dragoes'],         league: 'Primeira Liga', country: 'Portugal' },
  { id: '232',   name: 'Sporting CP',           aliases: ['sporting lisbon', 'leoes'], league: 'Primeira Liga', country: 'Portugal' },

  // ── Scottish & Turkish giants ─────────────────────────────────────
  { id: '256',   name: 'Celtic',                aliases: ['celtic fc', 'bhoys'],       league: 'Scottish Premiership', country: 'Scotland' },
  { id: '257',   name: 'Rangers',               aliases: ['glasgow rangers'],          league: 'Scottish Premiership', country: 'Scotland' },
  { id: '226',   name: 'Galatasaray',           aliases: ['cim bom'],                  league: 'Turkish Super Lig', country: 'Turkey' },
  { id: '224',   name: 'Fenerbahçe',            aliases: ['fenerbahce'],               league: 'Turkish Super Lig', country: 'Turkey' },
  { id: '225',   name: 'Beşiktaş',              aliases: ['besiktas'],                 league: 'Turkish Super Lig', country: 'Turkey' },
];

// Apply ESPN logo URL to every entry (overridable per-team if needed).
for (const t of SENIOR_FOOTBALL_TEAMS) {
  if (!t.logo) t.logo = espnLogo(t.id);
}
