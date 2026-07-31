import type { Metadata } from 'next';
import { ALL_SPORTS } from '@/lib/sports-data';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

const SPORT_DETAIL: Record<string, {
  title: string;
  description: string;
  keywords: string[];
  leagues?: string[];
}> = {
  football: {
    title: 'Football Predictions, Tips & Live Scores | Betcheza Kenya',
    description: "Kenya's #1 source for football predictions, free betting tips, live scores and AI match analysis. Covering Premier League, Champions League, Kenya Premier League, La Liga, Bundesliga, Serie A and 500+ leagues worldwide.",
    keywords: [
      'football predictions Kenya', 'football tips Kenya', 'football betting tips Kenya',
      'live football scores Kenya', 'Premier League tips', 'Champions League predictions',
      'Kenya Premier League tips', 'FKF Premier League tips', 'AFCON predictions',
      'La Liga tips', 'Bundesliga tips', 'Serie A tips', 'football accumulator Kenya',
      'BTTS tips today Kenya', 'over 2.5 goals Kenya', 'football AI predictions Kenya',
      'SportPesa football tips', 'Betika football tips', 'free football tips Kenya',
    ],
    leagues: ['Premier League', 'Champions League', 'Kenya Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1'],
  },
  tennis: {
    title: 'Tennis Predictions, Tips & Live Scores | ATP & WTA | Betcheza Kenya',
    description: 'Free tennis betting tips, ATP & WTA match predictions and live scores. Expert analysis for Grand Slams, ATP Tour, WTA Tour and Challenger events — updated in real time on Betcheza Kenya.',
    keywords: [
      'tennis predictions Kenya', 'tennis tips Kenya', 'ATP tips today', 'WTA tips today',
      'Grand Slam predictions', 'Wimbledon tips', 'US Open tips', 'French Open tips',
      'Australian Open tips', 'tennis betting tips Kenya', 'live tennis scores',
      'ATP betting tips', 'WTA betting tips', 'tennis match winner tips',
      'tennis over/under tips', 'tennis set betting Kenya',
    ],
    leagues: ['ATP Tour', 'WTA Tour', 'Wimbledon', 'US Open', 'French Open', 'Australian Open', 'ATP Challenger'],
  },
  basketball: {
    title: 'Basketball Predictions, Tips & Live NBA Scores | Betcheza Kenya',
    description: 'Free NBA betting tips, basketball match predictions and live scores. AI-powered picks for NBA, EuroLeague, FIBA, NBL and international basketball on Betcheza Kenya.',
    keywords: [
      'basketball predictions Kenya', 'NBA tips today', 'NBA betting tips Kenya',
      'NBA predictions today', 'live NBA scores', 'EuroLeague tips',
      'basketball match winner Kenya', 'NBA totals tips', 'NBA spread tips',
      'basketball over/under Kenya', 'NBL tips Kenya', 'FIBA predictions',
    ],
    leagues: ['NBA', 'EuroLeague', 'FIBA', 'NBL', 'NBA G League'],
  },
  cricket: {
    title: 'Cricket Predictions, Tips & Live Scores | IPL, Test & T20 | Betcheza Kenya',
    description: 'Free cricket betting tips and live scores for IPL, Test, ODI and T20 cricket. Expert AI analysis for ICC World Cup, IPL, Big Bash, The Hundred and all major tournaments on Betcheza Kenya.',
    keywords: [
      'cricket predictions Kenya', 'cricket tips Kenya', 'IPL tips today',
      'IPL predictions today', 'T20 tips today', 'Test match tips',
      'cricket betting tips Kenya', 'live cricket scores', 'ODI predictions',
      'ICC World Cup tips', 'cricket match winner Kenya', 'Big Bash tips',
    ],
    leagues: ['IPL', 'ICC Test', 'T20 World Cup', 'Big Bash League', 'The Hundred', 'PSL'],
  },
  rugby: {
    title: 'Rugby Predictions, Tips & Live Scores | Six Nations & Super Rugby | Betcheza Kenya',
    description: 'Free rugby union and league betting tips with live scores. Six Nations, Premiership, Super Rugby, URC and Rugby World Cup expert predictions on Betcheza Kenya.',
    keywords: [
      'rugby predictions Kenya', 'rugby tips Kenya', 'Six Nations predictions',
      'Six Nations tips', 'Super Rugby tips', 'Premiership rugby tips',
      'rugby union betting Kenya', 'rugby league tips Kenya', 'URC predictions',
      'Rugby World Cup tips', 'rugby match winner', 'rugby handicap tips',
    ],
    leagues: ['Six Nations', 'Premiership', 'Super Rugby', 'URC', 'Rugby World Cup'],
  },
  'american-football': {
    title: 'NFL Predictions, Tips & Live Scores | American Football | Betcheza Kenya',
    description: 'Free NFL betting tips, spread picks and totals analysis. AI-powered American football predictions for NFL, college football and Super Bowl on Betcheza Kenya.',
    keywords: [
      'NFL predictions Kenya', 'NFL tips today', 'NFL betting tips Kenya',
      'NFL spread tips', 'NFL totals tips', 'live NFL scores',
      'American football tips Kenya', 'Super Bowl predictions', 'NFL money line',
      'college football tips', 'NFL AI predictions',
    ],
    leagues: ['NFL', 'College Football', 'Super Bowl'],
  },
  'ice-hockey': {
    title: 'NHL Predictions, Tips & Live Scores | Ice Hockey | Betcheza Kenya',
    description: 'Free NHL betting tips, puck line picks and totals analysis. AI-powered ice hockey predictions for NHL, KHL and international hockey on Betcheza Kenya.',
    keywords: [
      'NHL predictions Kenya', 'NHL tips today', 'NHL betting tips Kenya',
      'ice hockey tips Kenya', 'NHL puck line tips', 'NHL totals tips',
      'live NHL scores', 'KHL tips', 'ice hockey money line Kenya',
    ],
    leagues: ['NHL', 'KHL', 'AHL', 'IIHF World Championship'],
  },
  baseball: {
    title: 'MLB Predictions, Tips & Live Scores | Baseball | Betcheza Kenya',
    description: 'Free MLB betting tips, run line picks and totals analysis. AI-powered baseball predictions for MLB and international baseball on Betcheza Kenya.',
    keywords: [
      'MLB predictions Kenya', 'MLB tips today', 'baseball betting tips Kenya',
      'MLB money line tips', 'MLB run line tips', 'MLB totals tips', 'live MLB scores',
    ],
    leagues: ['MLB', 'Minor League Baseball', 'World Series'],
  },
  mma: {
    title: 'UFC Predictions, Tips & Live Results | MMA | Betcheza Kenya',
    description: 'Free UFC and MMA betting tips with method of victory, round betting and fight winner picks. AI fight analysis for UFC, Bellator, ONE Championship and more on Betcheza Kenya.',
    keywords: [
      'UFC predictions Kenya', 'UFC tips today', 'MMA betting tips Kenya',
      'UFC fight winner tips', 'UFC method of victory', 'UFC round betting',
      'MMA tips Kenya', 'Bellator tips', 'ONE Championship tips', 'MMA AI predictions',
    ],
    leagues: ['UFC', 'Bellator', 'ONE Championship', 'PFL'],
  },
  boxing: {
    title: 'Boxing Predictions, Tips & Live Results | Betcheza Kenya',
    description: 'Free boxing betting tips with fight winner picks, round betting and method of victory analysis. AI-powered predictions for world title fights and major bouts on Betcheza Kenya.',
    keywords: [
      'boxing predictions Kenya', 'boxing tips today', 'boxing betting tips Kenya',
      'boxing fight winner tips', 'boxing round betting', 'boxing method of victory',
      'heavyweight boxing tips', 'boxing title fight predictions Kenya',
    ],
    leagues: ['World Title Fights', 'WBO', 'WBC', 'IBF', 'WBA'],
  },
  golf: {
    title: 'Golf Predictions, Tips & Live Scores | PGA Tour | Betcheza Kenya',
    description: 'Free golf betting tips with outright winner picks, each-way bets and tournament analysis. PGA Tour, European Tour, Major championships and Ryder Cup predictions on Betcheza Kenya.',
    keywords: [
      'golf predictions Kenya', 'golf tips today', 'golf betting tips Kenya',
      'PGA Tour tips', 'Masters golf tips', 'US Open golf tips', 'Ryder Cup tips',
      'golf outright tips', 'golf each-way tips', 'European Tour tips',
    ],
    leagues: ['PGA Tour', 'DP World Tour', 'The Masters', 'US Open', 'The Open', 'PGA Championship'],
  },
  snooker: {
    title: 'Snooker Predictions, Tips & Live Scores | World Snooker | Betcheza Kenya',
    description: 'Free snooker betting tips with match winner picks, frame betting and outright analysis. World Snooker Championship, Masters and UK Championship predictions on Betcheza Kenya.',
    keywords: [
      'snooker predictions Kenya', 'snooker tips today', 'snooker betting tips Kenya',
      'World Snooker tips', 'snooker match winner Kenya', 'snooker frame betting',
    ],
    leagues: ['World Snooker Championship', 'Masters', 'UK Championship', 'The Tour Championship'],
  },
  darts: {
    title: 'Darts Predictions, Tips & Live Scores | PDC & BDO | Betcheza Kenya',
    description: 'Free darts betting tips with match winner picks, leg betting and set analysis. PDC World Championship, Premier League Darts and Grand Prix predictions on Betcheza Kenya.',
    keywords: [
      'darts predictions Kenya', 'darts tips today', 'darts betting tips Kenya',
      'PDC darts tips', 'World Darts Championship tips', 'Premier League Darts tips',
    ],
    leagues: ['PDC World Championship', 'Premier League Darts', 'The Masters', 'Grand Prix'],
  },
  volleyball: {
    title: 'Volleyball Predictions, Tips & Live Scores | FIVB | Betcheza Kenya',
    description: 'Free volleyball betting tips with match winner picks and set betting. FIVB, CEV Champions League and national league predictions on Betcheza Kenya.',
    keywords: [
      'volleyball predictions Kenya', 'volleyball tips Kenya', 'FIVB tips',
      'volleyball betting tips Kenya', 'beach volleyball tips',
    ],
    leagues: ['FIVB World League', 'CEV Champions League', 'Olympic Volleyball'],
  },
  handball: {
    title: 'Handball Predictions, Tips & Live Scores | EHF Champions League | Betcheza Kenya',
    description: 'Free handball betting tips with match winner picks and goal betting. EHF Champions League, Bundesliga handball and national league predictions on Betcheza Kenya.',
    keywords: [
      'handball predictions Kenya', 'handball tips Kenya', 'EHF Champions League tips',
      'handball betting tips Kenya', 'handball Bundesliga tips',
    ],
    leagues: ['EHF Champions League', 'Bundesliga Handball', 'Starligue'],
  },
};

function getSportDetail(slug: string) {
  const key = slug.toLowerCase();
  return SPORT_DETAIL[key] ?? null;
}

function getSportConfig(slug: string) {
  return ALL_SPORTS.find(s => s.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const config = getSportConfig(slug);
  const detail = getSportDetail(slug);

  const sportName = config?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const canonical = `${BASE_URL}/sports/${slug}`;

  if (!detail) {
    return {
      title: `${sportName} Predictions & Tips | Betcheza Kenya`,
      description: `Free ${sportName} betting tips, live scores and AI-powered match predictions on Betcheza Kenya.`,
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title: `${sportName} Predictions & Tips | Betcheza Kenya`,
        description: `Free ${sportName} betting tips and live scores on Betcheza Kenya.`,
        url: canonical,
        type: 'website',
        siteName: 'Betcheza',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${sportName} Tips | Betcheza Kenya`,
        description: `Free ${sportName} predictions and betting tips on Betcheza.`,
      },
    };
  }

  return {
    title: detail.title,
    description: detail.description,
    keywords: detail.keywords,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    },
    openGraph: {
      title: detail.title,
      description: detail.description,
      url: canonical,
      type: 'website',
      siteName: 'Betcheza',
    },
    twitter: {
      card: 'summary_large_image',
      title: detail.title,
      description: detail.description,
      site: '@betcheza',
    },
  };
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = getSportConfig(slug);
  const detail = getSportDetail(slug);
  const sportName = config?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const canonical = `${BASE_URL}/sports/${slug}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Betcheza', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Sports', item: `${BASE_URL}/sports` },
      { '@type': 'ListItem', position: 3, name: sportName, item: canonical },
    ],
  };

  const sportsOrgSchema = detail ? {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    url: canonical,
    name: detail.title,
    description: detail.description,
    isPartOf: { '@id': `${BASE_URL}/#website` },
    about: {
      '@type': 'Thing',
      name: sportName,
      description: `${sportName} betting tips, predictions and live scores`,
    },
    ...(detail.leagues ? {
      mentions: detail.leagues.map(l => ({ '@type': 'SportsOrganization', name: l })),
    } : {}),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {sportsOrgSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsOrgSchema) }} />
      )}
      {children}
    </>
  );
}
