import type { Metadata } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

const SPORT_SEO: Record<string, {
  name: string; title: string; description: string; keywords: string[];
}> = {
  football: {
    name: 'Football',
    title: "Football Results Today | Yesterday's Scores & Tips | Betcheza Kenya",
    description: "Today and yesterday's football results with final scores, match stats and tipster outcomes. Check Premier League, Champions League, Kenya Premier League and all major league results on Betcheza.",
    keywords: [
      'football results today Kenya', 'yesterday football results', 'football scores today',
      'Premier League results today', 'Champions League results', 'Kenya Premier League results',
      'football final scores Kenya', 'SportPesa results today', 'Betika tips results',
      'football match results today', 'La Liga results', 'Bundesliga results today',
    ],
  },
  tennis: {
    name: 'Tennis',
    title: "Tennis Results Today | ATP & WTA Scores | Betcheza Kenya",
    description: "Latest tennis match results with final scores. ATP Tour, WTA Tour, Grand Slam and Challenger series results updated in real time. Expert post-match analysis on Betcheza Kenya.",
    keywords: [
      'tennis results today', 'ATP results today', 'WTA results today', 'tennis scores today',
      'Grand Slam results', 'Wimbledon results', 'US Open results', 'Australian Open results',
      'tennis match scores Kenya', 'ATP live results', 'WTA live scores',
    ],
  },
  basketball: {
    name: 'Basketball',
    title: "Basketball Results Today | NBA Scores & Analysis | Betcheza Kenya",
    description: "Latest NBA and international basketball results with final scores. EuroLeague, FIBA, NBL and NBA results updated live on Betcheza Kenya. Check how tips performed.",
    keywords: [
      'NBA results today', 'basketball results today', 'NBA scores today',
      'basketball final scores', 'EuroLeague results', 'FIBA results', 'NBA scores Kenya',
    ],
  },
  cricket: {
    name: 'Cricket',
    title: "Cricket Results Today | Test, ODI & T20 Scores | Betcheza Kenya",
    description: "Latest cricket match results — Test, ODI, T20 and IPL scores with full match analysis. ICC, IPL and international cricket results updated daily on Betcheza Kenya.",
    keywords: [
      'cricket results today', 'IPL results today', 'Test match results', 'ODI results',
      'T20 results today', 'cricket scores Kenya', 'ICC results', 'cricket match scores',
    ],
  },
  rugby: {
    name: 'Rugby',
    title: "Rugby Results Today | Six Nations, Premiership & Super Rugby Scores | Betcheza",
    description: "Latest rugby union and league results. Six Nations, Premiership, Super Rugby, URC and World Cup scores with expert post-match analysis on Betcheza Kenya.",
    keywords: [
      'rugby results today', 'Six Nations results', 'rugby union results', 'Super Rugby results',
      'rugby scores today', 'rugby league results', 'URC results', 'Premiership rugby results',
    ],
  },
  'american-football': {
    name: 'American Football',
    title: "NFL Results Today | American Football Scores | Betcheza Kenya",
    description: "Latest NFL and college football results with final scores and analysis. NFL standings, scores and game-by-game results on Betcheza Kenya.",
    keywords: [
      'NFL results today', 'NFL scores today', 'American football results',
      'NFL game results', 'NFL standings', 'college football results',
    ],
  },
  'ice-hockey': {
    name: 'Ice Hockey',
    title: "NHL Results Today | Ice Hockey Scores | Betcheza Kenya",
    description: "Latest NHL and international ice hockey results. NHL standings, scores and game results with analysis on Betcheza Kenya.",
    keywords: [
      'NHL results today', 'NHL scores today', 'ice hockey results', 'NHL game scores',
      'hockey scores today', 'NHL standings', 'KHL results',
    ],
  },
  baseball: {
    name: 'Baseball',
    title: "MLB Results Today | Baseball Scores | Betcheza Kenya",
    description: "Latest MLB and international baseball results. MLB standings, game scores and post-match analysis on Betcheza Kenya.",
    keywords: [
      'MLB results today', 'baseball results today', 'MLB scores today',
      'baseball scores Kenya', 'MLB standings', 'MLB game results',
    ],
  },
  mma: {
    name: 'MMA',
    title: "UFC Results Today | MMA Fight Results | Betcheza Kenya",
    description: "Latest UFC and MMA fight results with full card outcomes. Post-fight analysis, method of victory and judge decisions on Betcheza Kenya.",
    keywords: [
      'UFC results today', 'MMA results today', 'UFC fight results', 'MMA fight outcomes',
      'UFC card results', 'fight night results Kenya',
    ],
  },
  boxing: {
    name: 'Boxing',
    title: "Boxing Results Today | Fight Scores & Outcomes | Betcheza Kenya",
    description: "Latest boxing fight results with full card outcomes. Method of victory, judge scorecards and post-fight analysis on Betcheza Kenya.",
    keywords: [
      'boxing results today', 'boxing fight results', 'boxing scores Kenya',
      'boxing outcomes today', 'boxing card results', 'heavyweight boxing results',
    ],
  },
};

function leagueSlugToName(slug: string): string {
  const MAP: Record<string, string> = {
    'eng.1': 'Premier League', 'esp.1': 'La Liga', 'ger.1': 'Bundesliga',
    'ita.1': 'Serie A', 'fra.1': 'Ligue 1', 'ned.1': 'Eredivisie',
    'uefa.champions': 'Champions League', 'uefa.europa': 'Europa League',
    'nba': 'NBA', 'nfl': 'NFL', 'mlb': 'MLB', 'nhl': 'NHL',
    'kpl': 'Kenya Premier League', 'fkf': 'FKF Premier League',
    'premier-league': 'Premier League', 'la-liga': 'La Liga',
    'bundesliga': 'Bundesliga', 'serie-a': 'Serie A',
    'champions-league': 'Champions League',
  };
  if (!slug || slug === 'all') return '';
  return MAP[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; league?: string; date?: string }>;
}): Promise<Metadata> {
  const { sport, league } = await searchParams;

  const sportKey = sport?.toLowerCase() ?? 'football';
  const seo = SPORT_SEO[sportKey] ?? SPORT_SEO.football;
  const leagueName = league && league !== 'all' ? leagueSlugToName(league) : null;

  let title = seo.title;
  let description = seo.description;
  const keywords = [...seo.keywords,
    'match results Kenya', 'sports scores Kenya', `${seo.name.toLowerCase()} betting tips results`,
    'SportPesa results today', 'Betika tips results', 'free tips results Kenya',
    'sure tips results today', 'tipster results Kenya',
  ];

  if (leagueName) {
    title = `${leagueName} Results Today | Scores & Tips | Betcheza Kenya`;
    description = `Latest ${leagueName} match results with final scores, stats and tipster outcomes. See how our expert picks performed on Betcheza Kenya.`;
    keywords.push(`${leagueName} results`, `${leagueName} scores today`, `${leagueName} tips results`);
  }

  const canonical = `${BASE_URL}/results`;

  return {
    title,
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
      siteName: 'Betcheza',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
