import type { Metadata } from 'next';
import MatchesClientPage from './_matches-client';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

const SITE_NAME = 'Betcheza';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

const SPORT_SEO: Record<string, { name: string; description: string; keywords: string[] }> = {
  football: {
    name: 'Football',
    description: 'Live football scores today, upcoming fixtures and free AI betting tips. Compare odds on SportPesa, Betika, Odibets and more — updated every minute on Betcheza Kenya.',
    keywords: ['football tips today Kenya', 'live football scores', 'football predictions Kenya', 'football betting tips Kenya', 'sure football tips today', 'over 2.5 goals today', 'BTTS tips today', 'football accumulator tips Kenya'],
  },
  soccer: {
    name: 'Football',
    description: 'Live football scores today, upcoming fixtures and free AI betting tips. Compare odds on SportPesa, Betika, Odibets and more — updated every minute on Betcheza Kenya.',
    keywords: ['football tips today Kenya', 'live football scores', 'football predictions Kenya', 'sure football tips today', 'football betting odds Kenya'],
  },
  tennis: {
    name: 'Tennis',
    description: 'Live tennis scores today, ATP & WTA match predictions and free betting tips. Follow Grand Slams, ATP Tour and WTA Tour results in real time on Betcheza.',
    keywords: ['tennis predictions today', 'ATP tips today', 'WTA tips today', 'tennis betting tips Kenya', 'live tennis scores', 'Grand Slam predictions', 'Wimbledon tips', 'US Open tips', 'tennis match winner tips'],
  },
  basketball: {
    name: 'Basketball',
    description: 'Live NBA scores today, basketball match predictions and free betting tips. Follow NBA, EuroLeague and FIBA results with AI-powered picks on Betcheza Kenya.',
    keywords: ['NBA tips today', 'basketball betting tips Kenya', 'NBA predictions today', 'live NBA scores', 'basketball match winner', 'NBA totals tips', 'EuroLeague tips'],
  },
  cricket: {
    name: 'Cricket',
    description: 'Live cricket scores today — Test, ODI and T20 match predictions with free betting tips. IPL, World Cup and international cricket AI picks on Betcheza Kenya.',
    keywords: ['cricket predictions today', 'IPL tips today', 'cricket betting tips Kenya', 'live cricket scores', 'T20 tips today', 'cricket match winner tips', 'IPL winner prediction'],
  },
  rugby: {
    name: 'Rugby',
    description: 'Live rugby scores today — Six Nations, Premiership, Super Rugby and World Cup predictions with free betting tips. Rugby union & league AI picks on Betcheza.',
    keywords: ['rugby tips today', 'Six Nations predictions', 'rugby union betting tips', 'Super Rugby tips', 'rugby betting Kenya', 'rugby match winner tips'],
  },
  baseball: {
    name: 'Baseball',
    description: 'Live MLB scores today, baseball match predictions and free betting tips. Money line, run line and totals picks with AI analysis on Betcheza.',
    keywords: ['MLB tips today', 'baseball betting tips', 'MLB predictions today', 'baseball money line tips', 'live MLB scores', 'MLB run line tips'],
  },
  hockey: {
    name: 'Ice Hockey',
    description: 'Live NHL scores today, ice hockey match predictions and free betting tips. Money line, puck line and totals picks with AI analysis on Betcheza.',
    keywords: ['NHL tips today', 'hockey betting tips', 'NHL predictions today', 'ice hockey tips', 'live NHL scores', 'NHL money line tips'],
  },
  mma: {
    name: 'MMA',
    description: 'Live UFC results today, MMA fight predictions and free betting tips. Method of victory, round betting and fight winner AI picks on Betcheza.',
    keywords: ['UFC tips today', 'MMA betting tips', 'UFC predictions today', 'fight night tips', 'MMA winner tips', 'UFC round betting'],
  },
  boxing: {
    name: 'Boxing',
    description: 'Live boxing results today, fight predictions and free betting tips. Method of victory, round betting and boxing winner AI picks on Betcheza.',
    keywords: ['boxing tips today', 'boxing betting tips', 'boxing fight predictions', 'boxing winner tips', 'boxing round tips'],
  },
  golf: {
    name: 'Golf',
    description: 'Golf tournament predictions and free betting tips today. PGA Tour, European Tour and Major tournament AI outright picks on Betcheza.',
    keywords: ['golf tips today', 'golf betting tips', 'PGA Tour predictions', 'golf outright tips', 'Masters golf tips', 'Ryder Cup tips'],
  },
  'american football': {
    name: 'American Football',
    description: 'Live NFL scores today, American football predictions and free betting tips. Spread, totals and money line picks with AI analysis on Betcheza.',
    keywords: ['NFL tips today', 'NFL betting tips', 'NFL predictions today', 'NFL spread tips', 'NFL totals tips', 'live NFL scores'],
  },
};

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
  searchParams?: Promise<{ league?: string; tab?: string; date?: string; sport?: string }>;
}): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const { league, tab, date, sport } = params;

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
  } else if (sport && tab === 'upcoming') {
    const seo = SPORT_SEO[sport.toLowerCase()] ?? { name: sport.charAt(0).toUpperCase() + sport.slice(1), description: '' };
    title = `Upcoming ${seo.name} Matches & Free Predictions | ${SITE_NAME}`;
    description = `Upcoming ${seo.name} fixtures with free AI predictions and expert betting tips. Odds from ${KE_BOOKMAKERS}. Updated daily on ${SITE_NAME} Kenya.`;
  } else if (sport && date) {
    const seo = SPORT_SEO[sport.toLowerCase()] ?? { name: sport.charAt(0).toUpperCase() + sport.slice(1), description: '' };
    const dateDisplay = formatDate(date);
    title = `${seo.name} Matches on ${dateDisplay} | Free Tips | ${SITE_NAME}`;
    description = `${seo.name} fixtures on ${dateDisplay}. Free AI predictions, odds and expert tips. Available on ${KE_BOOKMAKERS}. ${SITE_NAME} Kenya.`;
  } else if (tab === 'upcoming') {
    title = `Upcoming Matches & Free Predictions | All Sports | ${SITE_NAME}`;
    description = `Browse all upcoming sports fixtures with free AI predictions and expert betting tips. Football, Tennis, Basketball, Cricket and more. ${SITE_NAME} Kenya.`;
  } else if (date) {
    const dateDisplay = formatDate(date);
    title = `Matches on ${dateDisplay} | Free Betting Tips | ${SITE_NAME}`;
    description = `All sports fixtures on ${dateDisplay} with free AI predictions and expert tips. Odds from ${KE_BOOKMAKERS}. ${SITE_NAME} Kenya.`;
  } else if (sport) {
    const seo = SPORT_SEO[sport.toLowerCase()] ?? { name: sport.charAt(0).toUpperCase() + sport.slice(1), description: '' };
    title = `${seo.name} Matches Today — Free Tips & Predictions | ${SITE_NAME}`;
    description = seo.description || `Live ${seo.name} scores, upcoming fixtures, and free betting tips. AI predictions updated in real time. ${SITE_NAME} Kenya.`;
  } else {
    title = 'Best Free Betting Tips Today Kenya | All Sports Predictions | Betcheza';
    description = 'Get the best free betting tips in Kenya today — AI predictions and expert tipster picks for football, tennis, basketball, cricket and more. SportPesa, Betika, Odibets, Betway tips updated daily on Betcheza Kenya.';
  }

  const sportSeoExtra = sport ? (SPORT_SEO[sport.toLowerCase()]?.keywords ?? []) : [];
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
    // Tennis
    'tennis predictions Kenya', 'ATP tips Kenya', 'WTA tips Kenya',
    // Basketball
    'NBA tips Kenya', 'basketball predictions Kenya',
    // Cricket
    'cricket tips Kenya', 'IPL predictions Kenya',
    // MMA
    'UFC tips Kenya', 'MMA predictions Kenya',
    ...sportSeoExtra,
    ...(leagueName ? [
      `${leagueName} predictions`, `${leagueName} tips today`,
      `${leagueName} betting tips Kenya`, `${leagueName} odds Kenya`,
    ] : []),
  ];

  const sportSlug = sport?.toLowerCase() ?? 'football';
  const ogImageUrl = `${BASE_URL}/api/og?${new URLSearchParams({
    home: leagueName ? `${leagueName} Matches` : `${SPORT_SEO[sportSlug]?.name ?? 'Sport'} Tips`,
    away: 'Betcheza Kenya',
    league: leagueName || (SPORT_SEO[sportSlug]?.name ? `${SPORT_SEO[sportSlug].name} Today` : 'All Sports Today'),
    sport: sportSlug,
    status: 'scheduled',
  }).toString()}`;

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: SITE_NAME,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@betcheza',
      images: [ogImageUrl],
    },
  };
}

export default async function MatchesPage() {
  // Pre-warm the match cache on the server so the client never hits "No matches found"
  // on cold start. Timeout is generous (4 s) to handle first-boot ESPN fetches;
  // on cache-hit this resolves in < 50 ms.
  let initialMatches: import('./_matches-client').Match[] | undefined;
  try {
    const result = await Promise.race([
      getAllMatches(),
      new Promise<null>(res => setTimeout(() => res(null), 4000)),
    ]);
    if (result && result.length > 0) {
      // Shape UnifiedMatch → Match (only the fields the client needs)
      initialMatches = result.map(m => ({
        id: m.id,
        sportId: m.sport.id,
        leagueId: m.league.id,
        homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName || m.homeTeam.name, logo: m.homeTeam.logo },
        awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName || m.awayTeam.name, logo: m.awayTeam.logo },
        kickoffTime: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : m.kickoffTime,
        status: m.status,
        homeScore: m.homeScore ?? null,
        awayScore: m.awayScore ?? null,
        minute: m.minute,
        period: m.period,
        league: { id: m.league.id, name: m.league.name, slug: m.league.slug, country: m.league.country, countryCode: m.league.countryCode || '', tier: m.league.tier || 1, logo: m.league.logo },
        sport: { id: m.sport.id, name: m.sport.name, slug: m.sport.slug, icon: m.sport.icon },
        odds: m.odds ? { home: m.odds.home, draw: m.odds.draw, away: m.odds.away } : undefined,
        tipsCount: 0,
        source: m.source,
        venue: m.venue,
      }));
    }
  } catch {
    // Fallback: client will fetch on mount
  }

  return <MatchesClientPage initialMatches={initialMatches} />;
}
