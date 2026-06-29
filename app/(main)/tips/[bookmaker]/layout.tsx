import type { Metadata } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

interface BookmakerSEO {
  name: string;
  fullName: string;
  title: string;
  description: string;
  keywords: string[];
  jackpot?: string;
}

const BOOKMAKER_SEO: Record<string, BookmakerSEO> = {
  sportpesa: {
    name: 'SportPesa',
    fullName: 'SportPesa Kenya',
    title: 'SportPesa Tips Today | Free Mega Jackpot 17 Games Predictions | Betcheza Kenya',
    description: "Free SportPesa betting tips today — Mega Jackpot 17 games predictions, midweek jackpot bankers and daily match tips. Expert AI analysis for SportPesa Kenya users. Updated daily. Get the best SportPesa tips on Betcheza.",
    keywords: [
      'SportPesa tips today', 'SportPesa predictions today', 'SportPesa Mega Jackpot tips',
      'SportPesa mega jackpot prediction today', 'SportPesa mega jackpot 17 games',
      'SportPesa jackpot analysis', 'SportPesa bankers today', 'free SportPesa tips Kenya',
      'SportPesa midweek jackpot tips', 'SportPesa midweek jackpot prediction',
      'SportPesa accumulator tips', 'SportPesa odds today', 'best SportPesa tips today',
      'SportPesa winning tips Kenya', 'SportPesa football tips', 'SportPesa jackpot banker picks',
      'SportPesa betting guide Kenya', 'SportPesa tip of the day', 'SportPesa jackpot prediction this week',
      'how to win SportPesa mega jackpot', 'SportPesa prediction 17 games today',
      'SportPesa jackpot sure banker', 'SportPesa tips and analysis',
    ],
    jackpot: 'Mega Jackpot',
  },
  betika: {
    name: 'Betika',
    fullName: 'Betika Kenya',
    title: 'Betika Tips Today | Free Grand Jackpot 17 Games Predictions | Betcheza Kenya',
    description: "Free Betika betting tips today — Grand Jackpot 17 games predictions, daily jackpot analysis, midweek jackpot and match tips. Expert picks for Betika Kenya users including bankers, accumulators and live betting tips. Updated daily on Betcheza.",
    keywords: [
      'Betika tips today', 'Betika predictions today', 'Betika Grand Jackpot tips',
      'Betika grand jackpot prediction today', 'Betika grand jackpot 17 games',
      'Betika jackpot analysis', 'Betika bankers today', 'free Betika tips Kenya',
      'Betika daily jackpot tips', 'Betika midweek jackpot tips', 'Betika midweek jackpot prediction',
      'Betika accumulator tips', 'Betika odds today', 'best Betika tips today',
      'Betika winning tips Kenya', 'Betika football tips', 'Betika jackpot banker',
      'Betika betting guide Kenya', 'Betika jackpot prediction this week',
      'how to win Betika grand jackpot', 'Betika jackpot sure banker', 'Betika tips and analysis',
      'Betika daily jackpot prediction', 'Betika grand jackpot results',
    ],
    jackpot: 'Grand Jackpot',
  },
  odibets: {
    name: 'Odibets',
    fullName: 'Odibets Kenya',
    title: 'Odibets Tips Today | Free Jackpot Bonanza Predictions Kenya | Betcheza',
    description: "Free Odibets betting tips today — Jackpot Bonanza predictions, daily match analysis and accumulator tips. Expert AI picks for Odibets Kenya. Get the best Odibets tips on Betcheza updated daily.",
    keywords: [
      'Odibets tips today', 'Odibets predictions today', 'Odibets jackpot tips',
      'Odibets jackpot bonanza prediction', 'Odibets jackpot bonanza tips today',
      'free Odibets tips Kenya', 'Odibets accumulator tips', 'Odibets odds today',
      'best Odibets tips today', 'Odibets winning tips Kenya', 'Odibets football tips',
      'Odibets Odibonanza tips', 'Odibets jackpot banker', 'Odibets betting guide Kenya',
      'how to win Odibets jackpot', 'Odibets jackpot prediction today', 'Odibets free tips',
    ],
  },
  betway: {
    name: 'Betway',
    fullName: 'Betway Kenya',
    title: 'Betway Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free Betway betting tips today — match predictions, accumulator tips and in-play betting analysis for Betway Kenya. Expert AI picks for football, tennis, basketball and more on Betcheza.",
    keywords: [
      'Betway tips today', 'Betway predictions Kenya', 'free Betway tips Kenya',
      'Betway football tips', 'Betway accumulator Kenya', 'Betway odds today',
      'best Betway tips today', 'Betway winning tips Kenya', 'Betway betting guide Kenya',
      'Betway in-play tips Kenya', 'Betway jackpot tips', 'Betway predictions today',
      'Betway free tips', 'Betway banker tips Kenya', 'Betway sure tips today',
    ],
  },
  mozzartbet: {
    name: 'Mozzartbet',
    fullName: 'Mozzartbet Kenya',
    title: 'Mozzartbet Tips Today | Free Mega Jackpot Predictions Kenya | Betcheza',
    description: "Free Mozzartbet betting tips today — Mega Jackpot predictions, midweek jackpot analysis and accumulator tips for Mozzartbet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Mozzartbet tips today', 'Mozzartbet predictions today', 'free Mozzartbet tips Kenya',
      'Mozzartbet football tips', 'Mozzartbet jackpot tips', 'Mozzartbet odds today',
      'best Mozzartbet tips', 'Mozzartbet winning tips Kenya', 'Mozzartbet mega jackpot tips',
      'Mozzartbet mega jackpot prediction', 'Mozzartbet midweek jackpot tips',
      'Mozzartbet jackpot banker', 'Mozzartbet jackpot prediction today',
      'how to win Mozzartbet jackpot', 'Mozzartbet accumulator tips Kenya',
    ],
  },
  betin: {
    name: 'Betin',
    fullName: 'Betin Kenya',
    title: 'Betin Tips Today | Free Grand Jackpot Predictions Kenya | Betcheza',
    description: "Free Betin betting tips today — Grand Jackpot predictions, midweek jackpot analysis and daily match tips for Betin Kenya. Expert picks updated daily on Betcheza.",
    keywords: [
      'Betin tips today', 'Betin predictions today', 'free Betin tips Kenya',
      'Betin football tips', 'Betin jackpot tips', 'Betin winning tips Kenya',
      'Betin grand jackpot tips', 'Betin grand jackpot prediction', 'Betin midweek jackpot tips',
      'Betin jackpot banker', 'Betin jackpot prediction today', 'Betin accumulator tips Kenya',
      'how to win Betin jackpot', 'Betin free tips', 'Betin betting guide Kenya',
    ],
  },
  '1xbet': {
    name: '1xBet',
    fullName: '1xBet Kenya',
    title: '1xBet Tips Today | Free Multi-Sport Predictions Kenya | Betcheza',
    description: "Free 1xBet betting tips today — match predictions, accumulator tips and live betting analysis for 1xBet Kenya. Multi-sport expert picks including football, tennis, basketball and cricket on Betcheza.",
    keywords: [
      '1xBet tips today', '1xBet predictions Kenya', 'free 1xBet tips Kenya',
      '1xBet football tips', '1xBet tennis tips', '1xBet basketball tips',
      '1xBet accumulator Kenya', '1xBet odds today', 'best 1xBet tips today',
      '1xBet winning tips Kenya', '1xBet live betting tips', '1xBet free tips Kenya',
      '1xBet sure tips today', '1xBet cricket tips Kenya', '1xBet banker tips',
    ],
  },
  premiertabet: {
    name: 'Premiertabet',
    fullName: 'Premiertabet Kenya',
    title: 'Premiertabet Tips Today | Free Jackpot Predictions Kenya | Betcheza',
    description: "Free Premiertabet betting tips today — jackpot predictions, daily match tips and accumulator analysis for Premiertabet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Premiertabet tips today', 'Premiertabet predictions', 'Premiertabet jackpot tips',
      'free Premiertabet tips Kenya', 'Premiertabet football tips', 'Premiertabet winning tips',
      'Premiertabet jackpot prediction today', 'Premiertabet accumulator tips',
      'Premiertabet sure tips', 'Premiertabet banker picks Kenya',
    ],
  },
  shabiki: {
    name: 'Shabiki',
    fullName: 'Shabiki Kenya',
    title: 'Shabiki Tips Today | Free Jackpot & Pool Betting Predictions | Betcheza Kenya',
    description: "Free Shabiki betting tips today — jackpot predictions, pool betting strategies and daily match analysis for Shabiki Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Shabiki tips today', 'Shabiki predictions', 'Shabiki jackpot tips',
      'free Shabiki tips Kenya', 'Shabiki football tips', 'Shabiki midweek tips',
      'Shabiki winning tips Kenya', 'Shabiki bet of the day', 'Shabiki pool betting tips',
      'Shabiki jackpot prediction today', 'Shabiki accumulator tips', 'Shabiki banker picks',
    ],
  },
  helabet: {
    name: 'Helabet',
    fullName: 'Helabet Kenya',
    title: 'Helabet Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free Helabet betting tips today — match predictions, accumulator tips and in-play analysis for Helabet Kenya. Expert picks for football, tennis, basketball and more on Betcheza.",
    keywords: [
      'Helabet tips today', 'Helabet predictions Kenya', 'free Helabet tips Kenya',
      'Helabet football tips', 'Helabet accumulator Kenya', 'Helabet odds today',
      'best Helabet tips', 'Helabet winning tips Kenya', 'Helabet free tips',
      'Helabet sure tips Kenya', 'Helabet banker tips today', 'Helabet live betting tips',
    ],
  },
  bangbet: {
    name: 'Bangbet',
    fullName: 'Bangbet Kenya',
    title: 'Bangbet Tips Today | Free Jackpot & Football Predictions Kenya | Betcheza',
    description: "Free Bangbet betting tips today — daily match predictions, accumulator tips and jackpot analysis for Bangbet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Bangbet tips today', 'Bangbet predictions Kenya', 'free Bangbet tips Kenya',
      'Bangbet football tips', 'Bangbet jackpot tips', 'Bangbet winning tips Kenya',
      'Bangbet sure tips today', 'Bangbet accumulator Kenya', 'Bangbet free tips',
      'Bangbet jackpot prediction today', 'Bangbet banker picks Kenya',
    ],
  },
  '22bet': {
    name: '22Bet',
    fullName: '22Bet Kenya',
    title: '22Bet Tips Today | Free Multi-Sport Predictions Kenya | Betcheza',
    description: "Free 22Bet betting tips today — multi-sport match predictions, accumulator tips and in-play analysis for 22Bet Kenya. Expert picks for football, tennis, basketball, esports and more on Betcheza.",
    keywords: [
      '22Bet tips today', '22Bet predictions Kenya', 'free 22Bet tips Kenya',
      '22Bet football tips', '22Bet esports tips', '22Bet accumulator Kenya',
      'best 22Bet tips', '22Bet winning tips Kenya', '22Bet sure tips today',
      '22Bet basketball tips Kenya', '22Bet tennis tips Kenya', '22Bet free tips',
      '22Bet banker picks Kenya', '22Bet live betting tips',
    ],
  },
  msport: {
    name: 'MSport',
    fullName: 'MSport Kenya',
    title: 'MSport Tips Today | Free Jackpot & Football Predictions Kenya | Betcheza',
    description: "Free MSport betting tips today — daily match predictions, jackpot analysis and accumulator tips for MSport Kenya. Expert picks updated daily on Betcheza.",
    keywords: [
      'MSport tips today', 'MSport predictions Kenya', 'free MSport tips Kenya',
      'MSport football tips', 'MSport jackpot tips', 'MSport winning tips Kenya',
      'MSport jackpot prediction today', 'MSport accumulator Kenya', 'MSport free tips',
      'MSport sure tips today', 'MSport banker picks Kenya',
    ],
  },
  elitebet: {
    name: 'Elitebet',
    fullName: 'Elitebet Kenya',
    title: 'Elitebet Tips Today | Free Live Betting Predictions Kenya | Betcheza',
    description: "Free Elitebet betting tips today — daily match predictions, live betting tips and jackpot analysis for Elitebet Kenya. Expert picks updated daily on Betcheza.",
    keywords: [
      'Elitebet tips today', 'Elitebet predictions Kenya', 'free Elitebet tips Kenya',
      'Elitebet football tips', 'Elitebet jackpot tips', 'Elitebet winning tips Kenya',
      'Elitebet live betting tips', 'Elitebet sure tips today', 'Elitebet free tips',
      'Elitebet accumulator Kenya', 'Elitebet banker picks Kenya',
    ],
  },
  bahatibet: {
    name: 'Bahatibet',
    fullName: 'Bahatibet Kenya',
    title: 'Bahatibet Tips Today | Free Jackpot Predictions Kenya | Betcheza',
    description: "Free Bahatibet betting tips today — jackpot predictions, daily match tips and accumulator analysis for Bahatibet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Bahatibet tips today', 'Bahatibet predictions Kenya', 'free Bahatibet tips Kenya',
      'Bahatibet football tips', 'Bahatibet jackpot tips', 'Bahatibet winning tips Kenya',
      'Bahatibet jackpot prediction today', 'Bahatibet accumulator tips', 'Bahatibet free tips',
      'Bahatibet sure tips', 'Bahatibet banker picks Kenya',
    ],
  },
  betlion: {
    name: 'Betlion',
    fullName: 'Betlion Kenya',
    title: 'Betlion Tips Today | Free Super Jackpot Predictions Kenya | Betcheza',
    description: "Free Betlion betting tips today — Super Jackpot predictions, daily match tips and accumulator analysis for Betlion Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Betlion tips today', 'Betlion predictions Kenya', 'free Betlion tips Kenya',
      'Betlion football tips', 'Betlion jackpot tips', 'Betlion winning tips Kenya',
      'Betlion super jackpot tips', 'Betlion super jackpot prediction today',
      'Betlion jackpot banker', 'Betlion accumulator tips', 'Betlion free tips Kenya',
    ],
  },
  wazabet: {
    name: 'Wazabet',
    fullName: 'Wazabet Kenya',
    title: 'Wazabet Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free Wazabet betting tips today — daily match predictions, accumulator tips and jackpot analysis for Wazabet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Wazabet tips today', 'Wazabet predictions Kenya', 'free Wazabet tips Kenya',
      'Wazabet football tips', 'Wazabet jackpot tips', 'Wazabet winning tips Kenya',
      'Wazabet sure tips today', 'Wazabet accumulator Kenya', 'Wazabet free tips',
    ],
  },
  sportybet: {
    name: 'Sportybet',
    fullName: 'Sportybet Kenya',
    title: 'Sportybet Tips Today | Free Jackpot Predictions Kenya | Betcheza',
    description: "Free Sportybet betting tips today — jackpot predictions, daily match tips and accumulator analysis for Sportybet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Sportybet tips today', 'Sportybet predictions Kenya', 'free Sportybet tips Kenya',
      'Sportybet football tips', 'Sportybet jackpot tips', 'Sportybet winning tips Kenya',
      'Sportybet jackpot prediction today', 'Sportybet accumulator tips', 'Sportybet free tips',
      'Sportybet sure tips', 'Sportybet banker picks Kenya',
    ],
  },
  betika24: {
    name: 'Betika24',
    fullName: 'Betika24 Kenya',
    title: 'Betika24 Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free Betika24 betting tips today — round-the-clock match predictions, jackpot analysis and accumulator tips for Betika24 Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Betika24 tips today', 'Betika24 predictions Kenya', 'free Betika24 tips Kenya',
      'Betika24 football tips', 'Betika24 jackpot tips', 'Betika24 winning tips Kenya',
      'Betika24 sure tips today', 'Betika24 accumulator Kenya', 'Betika24 free tips',
    ],
  },
  dafabet: {
    name: 'Dafabet',
    fullName: 'Dafabet Kenya',
    title: 'Dafabet Tips Today | Free Asian Handicap Predictions Kenya | Betcheza',
    description: "Free Dafabet betting tips today — Asian handicap predictions, accumulator tips and match analysis for Dafabet Kenya. Expert picks for football, tennis and more on Betcheza.",
    keywords: [
      'Dafabet tips today', 'Dafabet predictions Kenya', 'free Dafabet tips Kenya',
      'Dafabet football tips', 'Dafabet Asian handicap tips', 'Dafabet winning tips Kenya',
      'Dafabet accumulator Kenya', 'Dafabet odds today', 'Dafabet free tips',
      'Dafabet sure tips Kenya', 'Dafabet banker tips',
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bookmaker: string }>;
}): Promise<Metadata> {
  const { bookmaker } = await params;
  const slug = bookmaker.toLowerCase();
  const seo = BOOKMAKER_SEO[slug];

  const canonical = `${BASE_URL}/tips/${slug}`;

  if (!seo) {
    const name = slug.charAt(0).toUpperCase() + slug.slice(1);
    return {
      title: `${name} Tips Today | Free Betting Predictions Kenya | Betcheza`,
      description: `Free ${name} betting tips today — daily match predictions, accumulator tips and analysis for ${name} Kenya users. Expert picks on Betcheza.`,
      keywords: [`${name} tips today`, `${name} predictions Kenya`, `free ${name} tips Kenya`, `${name} football tips`],
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title: `${name} Tips Today | Betcheza Kenya`,
        description: `Free ${name} betting tips today — expert predictions for ${name} Kenya.`,
        url: canonical,
        type: 'website',
        siteName: 'Betcheza',
      },
      twitter: { card: 'summary_large_image', title: `${name} Tips | Betcheza`, description: `Free ${name} tips updated daily.` },
    };
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Betcheza', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Betting Tips', item: `${BASE_URL}/tips` },
      { '@type': 'ListItem', position: 3, name: `${seo.name} Tips`, item: canonical },
    ],
  };

  return {
    title: seo.title,
    description: seo.description,
    keywords: [
      ...seo.keywords,
      'free betting tips Kenya', 'sure tips today Kenya', 'AI football predictions Kenya',
      'best betting tips Kenya today', 'Betcheza tips today',
    ],
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      type: 'website',
      siteName: 'Betcheza',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      site: '@betcheza',
    },
    other: {
      'schema:BreadcrumbList': JSON.stringify(breadcrumbSchema),
    },
  };
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bookmaker: string }>;
}) {
  const { bookmaker } = await params;
  const slug = bookmaker.toLowerCase();
  const seo = BOOKMAKER_SEO[slug];
  const canonical = `${BASE_URL}/tips/${slug}`;
  const name = seo?.name ?? (slug.charAt(0).toUpperCase() + slug.slice(1));

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Betcheza', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Betting Tips', item: `${BASE_URL}/tips` },
      { '@type': 'ListItem', position: 3, name: `${name} Tips`, item: canonical },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
