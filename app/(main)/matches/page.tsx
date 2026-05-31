import type { Metadata } from 'next';
import MatchesClientPage from './_matches-client';

const SITE_NAME = 'Betcheza';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

const LEAGUE_NAMES: Record<string, string> = {
  'eng.1': 'Premier League', 'esp.1': 'La Liga', 'ger.1': 'Bundesliga',
  'ita.1': 'Serie A', 'fra.1': 'Ligue 1', 'ned.1': 'Eredivisie',
  'por.1': 'Primeira Liga', 'sco.1': 'Scottish Premiership',
  'uefa.champions': 'Champions League', 'uefa.europa': 'Europa League',
  'uefa.europa.conf': 'Conference League', 'fifa.world': 'FIFA World Cup',
  'world-cup': 'FIFA World Cup', 'uefa.euro': 'UEFA Euro',
  'conmebol.copa': 'Copa America', 'afcon': 'AFCON',
  'caf.champions': 'CAF Champions League',
  'nba': 'NBA', 'nfl': 'NFL', 'mlb': 'MLB', 'nhl': 'NHL',
  'kpl': 'Kenya Premier League', 'fkf': 'FKF Premier League',
  'premier-league': 'Premier League', 'la-liga': 'La Liga',
  'bundesliga': 'Bundesliga', 'serie-a': 'Serie A',
  'ligue-1': 'Ligue 1', 'champions-league': 'Champions League',
};

function leagueSlugToName(slug: string): string {
  if (!slug || slug === 'all') return '';
  const mapped = LEAGUE_NAMES[slug];
  if (mapped) return mapped;
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; tab?: string; date?: string; sport?: string }>;
}): Promise<Metadata> {
  const { league, tab, date, sport } = await searchParams;

  const leagueName = league && league !== 'all' ? leagueSlugToName(league) : null;
  const canonical = `${BASE_URL}/matches`;

  const KE_BOOKMAKERS = 'SportPesa, Betika, Odibets, Betway, BahatiБет, Mozzartbet, 1xBet, Helabet';

  let title: string;
  let description: string;

  if (leagueName && tab === 'upcoming') {
    title = `${leagueName} Upcoming Matches & Predictions | ${SITE_NAME}`;
    description = `Browse all upcoming ${leagueName} fixtures with AI predictions and free betting tips. Odds comparison for ${KE_BOOKMAKERS}. Updated daily on ${SITE_NAME} Kenya.`;
  } else if (leagueName && date) {
    const dateDisplay = formatDate(date);
    title = `${leagueName} Matches on ${dateDisplay} | Tips & Predictions | ${SITE_NAME}`;
    description = `${leagueName} fixtures on ${dateDisplay}. Free AI predictions, odds, and expert tips for every match. Available on ${KE_BOOKMAKERS}. ${SITE_NAME} Kenya.`;
  } else if (leagueName) {
    title = `${leagueName} Matches, Tips & Predictions | ${SITE_NAME}`;
    description = `Live scores, upcoming fixtures, AI match predictions and free betting tips for ${leagueName}. Compare odds on ${KE_BOOKMAKERS}. ${SITE_NAME} Kenya.`;
  } else if (tab === 'upcoming') {
    title = `Upcoming Football Matches & Free Predictions Kenya | ${SITE_NAME}`;
    description = `All upcoming football fixtures with free AI predictions and expert betting tips. SportPesa, Betika, Odibets, Betway tips updated daily. ${SITE_NAME} Kenya.`;
  } else if (date) {
    const dateDisplay = formatDate(date);
    title = `Football Matches on ${dateDisplay} | Free Betting Tips | ${SITE_NAME}`;
    description = `All football fixtures on ${dateDisplay} with free AI predictions and expert tips. Odds from ${KE_BOOKMAKERS}. ${SITE_NAME} Kenya.`;
  } else if (sport) {
    const sportName = sport.charAt(0).toUpperCase() + sport.slice(1);
    title = `${sportName} Matches Today — Free Tips & Predictions | ${SITE_NAME}`;
    description = `Live ${sportName} scores, upcoming fixtures, and free betting tips. AI predictions updated in real time. ${SITE_NAME} Kenya.`;
  } else {
    title = 'Best Free Betting Tips Today Kenya | Football Predictions | Betcheza';
    description = 'Get the best free betting tips in Kenya today — AI predictions and expert tipster picks for every football match. SportPesa, Betika, Odibets, Betway, BahatiБет tips updated daily. The most trusted source for free sure tips in Kenya.';
  }

  const keywords = [
    'best free betting tips Kenya today', 'free betting tips Kenya today',
    'football predictions today Kenya', 'sure tips today Kenya',
    'SportPesa tips today', 'Betika tips today', 'Odibets tips today',
    'Betway tips Kenya', 'Bahatibet tips Kenya', 'Mozzartbet tips Kenya',
    '1xBet tips Kenya', 'Helabet tips Kenya', 'Bangbet tips Kenya',
    'MSport tips Kenya', 'Betin tips Kenya', '22bet tips Kenya',
    'free football tips today Kenya', 'accumulator tips Kenya',
    'over 2.5 goals today Kenya', 'BTTS tips today Kenya',
    'double chance tips Kenya', 'correct score tips Kenya',
    'Premier League predictions Kenya', 'Champions League tips Kenya',
    'Kenya Premier League tips KPL', 'FKF Premier League predictions',
    'live football odds Kenya', 'football betting odds Kenya',
    'AI football predictions Kenya', 'high accuracy football tips Kenya',
    ...(leagueName ? [
      `${leagueName} predictions`, `${leagueName} tips today`,
      `${leagueName} betting tips Kenya`, `${leagueName} odds Kenya`,
    ] : []),
  ];

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function MatchesPage() {
  return <MatchesClientPage />;
}
