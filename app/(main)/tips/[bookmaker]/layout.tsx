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
    title: 'SportPesa Tips Today | Free Mega Jackpot Predictions | Betcheza Kenya',
    description: "Free SportPesa betting tips today — Mega Jackpot predictions, midweek jackpot bankers and daily match tips. Expert AI analysis for SportPesa Kenya users. Get the best SportPesa tips to maximize your winnings on Betcheza.",
    keywords: [
      'SportPesa tips today', 'SportPesa predictions', 'SportPesa Mega Jackpot tips',
      'SportPesa jackpot analysis', 'SportPesa bankers today', 'free SportPesa tips Kenya',
      'SportPesa midweek jackpot tips', 'SportPesa accumulator tips', 'SportPesa odds today',
      'best SportPesa tips today', 'SportPesa winning tips Kenya', 'SportPesa football tips',
      'SportPesa betting guide Kenya', 'SportPesa tip of the day',
    ],
    jackpot: 'Mega Jackpot',
  },
  betika: {
    name: 'Betika',
    fullName: 'Betika Kenya',
    title: 'Betika Tips Today | Free Grand Jackpot Predictions | Betcheza Kenya',
    description: "Free Betika betting tips today — Grand Jackpot predictions, daily jackpot analysis and match tips. Expert picks for Betika Kenya users including bankers, accumulators and live betting tips. Updated daily on Betcheza.",
    keywords: [
      'Betika tips today', 'Betika predictions', 'Betika Grand Jackpot tips',
      'Betika jackpot analysis', 'Betika bankers today', 'free Betika tips Kenya',
      'Betika daily jackpot tips', 'Betika accumulator tips', 'Betika odds today',
      'best Betika tips today', 'Betika winning tips Kenya', 'Betika football tips',
      'Betika betting guide Kenya', 'Betika jackpot banker',
    ],
    jackpot: 'Grand Jackpot',
  },
  odibets: {
    name: 'Odibets',
    fullName: 'Odibets Kenya',
    title: 'Odibets Tips Today | Free Betting Predictions | Betcheza Kenya',
    description: "Free Odibets betting tips today — daily match predictions, accumulator tips and jackpot analysis. Expert AI picks for Odibets Kenya users. Get the best Odibets tips to win more on Betcheza.",
    keywords: [
      'Odibets tips today', 'Odibets predictions', 'Odibets jackpot tips',
      'free Odibets tips Kenya', 'Odibets accumulator tips', 'Odibets odds today',
      'best Odibets tips today', 'Odibets winning tips Kenya', 'Odibets football tips',
      'Odibets Odibonanza tips', 'Odibets betting guide Kenya',
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
      'Betway in-play tips Kenya', 'Betway jackpot tips',
    ],
  },
  mozzartbet: {
    name: 'Mozzartbet',
    fullName: 'Mozzartbet Kenya',
    title: 'Mozzartbet Tips Today | Free Predictions Kenya | Betcheza',
    description: "Free Mozzartbet betting tips today — daily match predictions, jackpot analysis and accumulator tips for Mozzartbet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Mozzartbet tips today', 'Mozzartbet predictions Kenya', 'free Mozzartbet tips Kenya',
      'Mozzartbet football tips', 'Mozzartbet jackpot tips', 'Mozzartbet odds today',
      'best Mozzartbet tips', 'Mozzartbet winning tips Kenya',
    ],
  },
  '1xbet': {
    name: '1xBet',
    fullName: '1xBet Kenya',
    title: '1xBet Tips Today | Free Predictions Kenya | Betcheza',
    description: "Free 1xBet betting tips today — match predictions, accumulator tips and live betting analysis for 1xBet Kenya. Multi-sport expert picks including football, tennis, basketball and cricket on Betcheza.",
    keywords: [
      '1xBet tips today', '1xBet predictions Kenya', 'free 1xBet tips Kenya',
      '1xBet football tips', '1xBet tennis tips', '1xBet basketball tips',
      '1xBet accumulator Kenya', '1xBet odds today', 'best 1xBet tips today',
      '1xBet winning tips Kenya', '1xBet live betting tips',
    ],
  },
  premiertabet: {
    name: 'Premiertabet',
    fullName: 'Premiertabet Kenya',
    title: 'Premiertabet Tips Today | Free Jackpot Predictions | Betcheza Kenya',
    description: "Free Premiertabet betting tips today — jackpot predictions, daily match tips and accumulator analysis for Premiertabet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Premiertabet tips today', 'Premiertabet predictions', 'Premiertabet jackpot tips',
      'free Premiertabet tips Kenya', 'Premiertabet football tips', 'Premiertabet winning tips',
    ],
  },
  shabiki: {
    name: 'Shabiki',
    fullName: 'Shabiki Kenya',
    title: 'Shabiki Tips Today | Free Jackpot & Midweek Predictions | Betcheza Kenya',
    description: "Free Shabiki betting tips today — jackpot predictions, midweek tips and daily match analysis for Shabiki Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Shabiki tips today', 'Shabiki predictions', 'Shabiki jackpot tips',
      'free Shabiki tips Kenya', 'Shabiki football tips', 'Shabiki midweek tips',
      'Shabiki winning tips Kenya', 'Shabiki bet of the day',
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
      'best Helabet tips', 'Helabet winning tips Kenya',
    ],
  },
  bangbet: {
    name: 'Bangbet',
    fullName: 'Bangbet Kenya',
    title: 'Bangbet Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free Bangbet betting tips today — daily match predictions, accumulator tips and jackpot analysis for Bangbet Kenya users. Expert picks updated daily on Betcheza.",
    keywords: [
      'Bangbet tips today', 'Bangbet predictions Kenya', 'free Bangbet tips Kenya',
      'Bangbet football tips', 'Bangbet jackpot tips', 'Bangbet winning tips Kenya',
    ],
  },
  '22bet': {
    name: '22Bet',
    fullName: '22Bet Kenya',
    title: '22Bet Tips Today | Free Predictions Kenya | Betcheza',
    description: "Free 22Bet betting tips today — multi-sport match predictions, accumulator tips and in-play analysis for 22Bet Kenya. Expert picks for football, tennis, basketball, esports and more on Betcheza.",
    keywords: [
      '22Bet tips today', '22Bet predictions Kenya', 'free 22Bet tips Kenya',
      '22Bet football tips', '22Bet esports tips', '22Bet accumulator Kenya',
      'best 22Bet tips', '22Bet winning tips Kenya',
    ],
  },
  msport: {
    name: 'MSport',
    fullName: 'MSport Kenya',
    title: 'MSport Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free MSport betting tips today — daily match predictions, jackpot analysis and accumulator tips for MSport Kenya. Expert picks updated daily on Betcheza.",
    keywords: [
      'MSport tips today', 'MSport predictions Kenya', 'free MSport tips Kenya',
      'MSport football tips', 'MSport jackpot tips', 'MSport winning tips Kenya',
    ],
  },
  betin: {
    name: 'Betin',
    fullName: 'Betin Kenya',
    title: 'Betin Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free Betin betting tips today — daily match predictions, accumulator tips and jackpot analysis for Betin Kenya. Expert picks updated daily on Betcheza.",
    keywords: [
      'Betin tips today', 'Betin predictions Kenya', 'free Betin tips Kenya',
      'Betin football tips', 'Betin jackpot tips', 'Betin winning tips Kenya',
    ],
  },
  elitebet: {
    name: 'Elitebet',
    fullName: 'Elitebet Kenya',
    title: 'Elitebet Tips Today | Free Betting Predictions Kenya | Betcheza',
    description: "Free Elitebet betting tips today — daily match predictions, accumulator tips and jackpot analysis for Elitebet Kenya. Expert picks updated daily on Betcheza.",
    keywords: [
      'Elitebet tips today', 'Elitebet predictions Kenya', 'free Elitebet tips Kenya',
      'Elitebet football tips', 'Elitebet jackpot tips', 'Elitebet winning tips Kenya',
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
