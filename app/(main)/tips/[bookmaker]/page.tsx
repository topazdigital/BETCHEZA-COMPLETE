import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Star, TrendingUp, Trophy, Target, Zap, Shield, Users } from 'lucide-react';

// ── Bookmaker catalogue ──────────────────────────────────────────────────────

interface BookmakerInfo {
  slug: string;
  name: string;
  fullName: string;
  country: string;
  jackpot?: string;
  jackpotGames?: number;
  jackpotPrize?: string;
  description: string;
  markets: string[];
  features: string[];
  minBet: string;
  bonuses?: string;
  mpesa: boolean;
}

const BOOKMAKERS: Record<string, BookmakerInfo> = {
  sportpesa: {
    slug: 'sportpesa', name: 'SportPesa', fullName: 'SportPesa Kenya',
    country: 'Kenya', jackpot: 'Mega Jackpot', jackpotGames: 13, jackpotPrize: 'KES 100M+',
    description: 'Kenya\'s largest sports betting platform with 13-game Mega Jackpot and midweek jackpot. Get daily free predictions, jackpot bankers, and accumulator tips.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Correct Score', 'Asian Handicap', 'Outrights'],
    features: ['Mega Jackpot (13 games)', 'Midweek Jackpot', 'Live Betting', 'Virtual Sports'],
    minBet: 'KES 10', bonuses: 'Welcome bonus up to KES 1,000', mpesa: true,
  },
  betika: {
    slug: 'betika', name: 'Betika', fullName: 'Betika Kenya',
    country: 'Kenya', jackpot: 'Grand Jackpot', jackpotGames: 17, jackpotPrize: 'KES 50M+',
    description: 'Betika Kenya\'s 17-game Grand Jackpot is one of the most popular in Kenya. Get expert jackpot analysis, banker picks, and free tips updated daily.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Correct Score', 'HT/FT', 'Handicap'],
    features: ['Grand Jackpot (17 games)', 'Daily Jackpot', 'Live Betting', 'Betika Games'],
    minBet: 'KES 1', bonuses: 'Jackpot bonuses', mpesa: true,
  },
  odibets: {
    slug: 'odibets', name: 'Odibets', fullName: 'Odibets Kenya',
    country: 'Kenya', jackpot: 'Odibets Jackpot',
    description: 'Odibets is Kenya\'s fastest growing betting site. Get free Odibets predictions, jackpot tips, and daily analysis from our expert tipsters.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Double Chance', 'Correct Score'],
    features: ['Daily Jackpot', 'Live Betting', 'Casino', 'Aviator'],
    minBet: 'KES 1', bonuses: 'Free bets on first deposit', mpesa: true,
  },
  betway: {
    slug: 'betway', name: 'Betway', fullName: 'Betway Kenya',
    country: 'Kenya',
    description: 'Betway Kenya offers premium football tips, live betting, and some of the best odds in Kenya. Get expert Betway predictions updated daily.',
    markets: ['1X2', 'Asian Handicap', 'Over/Under', 'BTTS', 'Player Props', 'Live Bets'],
    features: ['Live Betting', 'Cash Out', 'Best Odds Guarantee', 'Same Game Multi'],
    minBet: 'KES 50', bonuses: 'Welcome bonus up to KES 5,000', mpesa: true,
  },
  mozzartbet: {
    slug: 'mozzartbet', name: 'Mozzartbet', fullName: 'Mozzartbet Kenya',
    country: 'Kenya',
    description: 'Mozzartbet Kenya is famous for its Keno game and generous football odds. Expert predictions, jackpot tips and free picks updated daily.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Correct Score', 'Handicap'],
    features: ['Keno', 'Live Betting', 'Jackpot', 'Virtual Sports'],
    minBet: 'KES 10', mpesa: true,
  },
  '1xbet': {
    slug: '1xbet', name: '1xBet', fullName: '1xBet Kenya',
    country: 'Kenya',
    description: '1xBet Kenya has the widest range of sports markets in Kenya. Get free 1xBet tips, accumulator predictions, and expert analysis across all sports.',
    markets: ['1X2', 'Asian Handicap', 'Over/Under', 'BTTS', 'Exact Goals', 'Player Props', 'Esports'],
    features: ['35+ Sports', 'Live Casino', 'Cybersport', 'Live Streaming'],
    minBet: 'KES 10', bonuses: '100% first deposit bonus', mpesa: true,
  },
  premiertabet: {
    slug: 'premiertabet', name: 'Premiertabet', fullName: 'Premiertabet Kenya',
    country: 'Kenya', jackpot: 'Weekly Jackpot',
    description: 'Premiertabet Kenya offers competitive odds and a weekly jackpot. Free Premiertabet tips, predictions, and jackpot analysis for Kenyan bettors.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Handicap'],
    features: ['Weekly Jackpot', 'Live Betting', 'Casino'],
    minBet: 'KES 10', mpesa: true,
  },
  shabiki: {
    slug: 'shabiki', name: 'Shabiki', fullName: 'Shabiki Kenya',
    country: 'Kenya', jackpot: 'Shabiki Jackpot',
    description: 'Shabiki Kenya\'s pool betting jackpot is unique in the market. Get free Shabiki tips, pool betting strategies, and jackpot banker predictions.',
    markets: ['Pool Betting', '1X2', 'Over/Under'],
    features: ['Pool Jackpot', 'Fixed Odds', 'Daily Competitions'],
    minBet: 'KES 30', mpesa: true,
  },
  elitebet: {
    slug: 'elitebet', name: 'Elitebet', fullName: 'Elitebet Kenya',
    country: 'Kenya',
    description: 'Elitebet Kenya specialises in live betting and competitive odds. Expert Elitebet predictions, live tips, and daily analysis.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Live Markets'],
    features: ['Live Betting', 'Cash Out', 'Early Cash Out'],
    minBet: 'KES 10', mpesa: true,
  },
  helabet: {
    slug: 'helabet', name: 'Helabet', fullName: 'Helabet Kenya',
    country: 'Kenya',
    description: 'Helabet Kenya brings European-style betting to Kenya with excellent live odds. Free Helabet tips and predictions from verified tipsters.',
    markets: ['1X2', 'Asian Handicap', 'Over/Under', 'BTTS', 'Live Markets'],
    features: ['Live Betting', 'Casino', 'Virtual Sports', 'Best Odds'],
    minBet: 'KES 10', bonuses: 'Welcome bonus', mpesa: true,
  },
  bangbet: {
    slug: 'bangbet', name: 'Bangbet', fullName: 'Bangbet Kenya',
    country: 'Kenya',
    description: 'Bangbet Kenya is a rapidly growing platform offering great KPL and EPL odds. Get free Bangbet predictions and daily betting tips.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Jackpot'],
    features: ['Jackpot', 'Live Betting', 'Free Bets'],
    minBet: 'KES 10', mpesa: true,
  },
  '22bet': {
    slug: '22bet', name: '22bet', fullName: '22bet Kenya',
    country: 'Kenya',
    description: '22bet Kenya covers 50+ sports with deep market coverage. Free 22bet tips and expert predictions across football, basketball, tennis, and more.',
    markets: ['1X2', 'Asian Handicap', 'Over/Under', 'BTTS', 'Corners', 'Cards'],
    features: ['50+ Sports', 'Live Betting', 'Poker', 'Casino'],
    minBet: 'KES 25', mpesa: true,
  },
  msport: {
    slug: 'msport', name: 'MSport', fullName: 'MSport Kenya',
    country: 'Kenya',
    description: 'MSport Kenya offers competitive odds and a growing jackpot. Expert MSport tips, free predictions, and jackpot analysis.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Handicap'],
    features: ['Jackpot', 'Live Betting', 'Virtual Sports'],
    minBet: 'KES 10', mpesa: true,
  },
  betin: {
    slug: 'betin', name: 'Betin', fullName: 'Betin Kenya',
    country: 'Kenya',
    description: 'Betin Kenya is a licensed bookmaker with reliable payouts. Get Betin predictions, jackpot tips, and free daily betting analysis.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Correct Score'],
    features: ['Jackpot', 'Live Betting', 'Keno', 'Quick Games'],
    minBet: 'KES 10', mpesa: true,
  },
  bahatibet: {
    slug: 'bahatibet', name: 'Bahatibet', fullName: 'Bahatibet Kenya',
    country: 'Kenya', jackpot: 'Bahatibet Jackpot',
    description: 'Bahatibet Kenya is a popular betting site offering competitive football odds and a lucrative jackpot. Get free Bahatibet tips, jackpot predictions, and daily accumulator picks from expert tipsters.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Double Chance', 'Correct Score', 'Jackpot'],
    features: ['Daily Jackpot', 'Live Betting', 'Casino', 'Aviator Game'],
    minBet: 'KES 10', bonuses: 'Welcome bonus on first deposit', mpesa: true,
  },
  betlion: {
    slug: 'betlion', name: 'Betlion', fullName: 'Betlion Kenya',
    country: 'Kenya', jackpot: 'Super Jackpot',
    description: 'Betlion Kenya offers a Super Jackpot and great football odds. Get free Betlion predictions, jackpot banker picks, and expert accumulator tips.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Handicap', 'Correct Score'],
    features: ['Super Jackpot', 'Live Betting', 'Virtual Sports', 'Casino'],
    minBet: 'KES 10', mpesa: true,
  },
  wazabet: {
    slug: 'wazabet', name: 'Wazabet', fullName: 'Wazabet Kenya',
    country: 'Kenya',
    description: 'Wazabet Kenya is a fast-growing betting platform with competitive odds. Get free Wazabet tips, daily predictions, and expert analysis from verified tipsters.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Double Chance'],
    features: ['Live Betting', 'Casino', 'Daily Jackpot', 'Free Bets'],
    minBet: 'KES 10', mpesa: true,
  },
  sportybet: {
    slug: 'sportybet', name: 'Sportybet', fullName: 'Sportybet Kenya',
    country: 'Kenya', jackpot: 'Sportybet Jackpot',
    description: 'Sportybet Kenya offers one of the fastest bet slip processing times in Kenya. Get free Sportybet predictions, jackpot banker tips, and daily accumulator picks.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Asian Handicap', 'Jackpot'],
    features: ['Fast Payouts', 'Daily Jackpot', 'Live Betting', 'Free Bets'],
    minBet: 'KES 10', mpesa: true,
  },
  betika24: {
    slug: 'betika24', name: 'Betika24', fullName: 'Betika24 Kenya',
    country: 'Kenya',
    description: 'Betika24 Kenya is a rising platform with round-the-clock betting action. Get free Betika24 tips, predictions, and expert analysis.',
    markets: ['1X2', 'Over/Under', 'BTTS', 'Jackpot'],
    features: ['24/7 Betting', 'Live Betting', 'Casino', 'Jackpot'],
    minBet: 'KES 10', mpesa: true,
  },
  dafabet: {
    slug: 'dafabet', name: 'Dafabet', fullName: 'Dafabet Kenya',
    country: 'Kenya',
    description: 'Dafabet Kenya offers Asian handicap and European odds with a wide sports selection. Get free Dafabet tips, predictions, and expert analysis for Kenyan bettors.',
    markets: ['1X2', 'Asian Handicap', 'Over/Under', 'BTTS', 'Player Props'],
    features: ['Asian Handicap', 'Live Betting', 'Cash Out', 'Wide Sports Coverage'],
    minBet: 'KES 50', mpesa: true,
  },
};

type Props = { params: Promise<{ bookmaker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookmaker } = await params;
  const bm = BOOKMAKERS[bookmaker];
  const siteName = 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  if (!bm) return { title: `Tips | ${siteName}` };

  const canonical = `${baseUrl}/tips/${bookmaker}`;
  const jackpotStr = bm.jackpot ? ` ${bm.jackpot} Predictions,` : '';
  const title = `${bm.name} Tips & Predictions Today | Free ${bm.name} Kenya Tips | ${siteName}`;
  const description = `Free ${bm.name} Kenya tips today. Expert${jackpotStr} football predictions, jackpot banker picks and accumulator tips for ${bm.name}. Updated daily by verified tipsters.`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    keywords: [
      `${bm.name} tips`, `${bm.name} predictions`, `${bm.name} tips today`,
      `${bm.name} Kenya tips`, `${bm.name} Kenya predictions`, `free ${bm.name} tips`,
      `${bm.name} jackpot tips`, `${bm.name} jackpot predictions`, `${bm.name} jackpot banker`,
      `${bm.name} free tips today`, `${bm.name} winning tips`, `${bm.name} football tips`,
      `how to win ${bm.name} jackpot`, `${bm.name} accumulator tips`,
      `best ${bm.name} tips`, `${bm.name} analysis`, 'betting tips Kenya',
      'free tips Kenya', 'jackpot tips Kenya', siteName,
    ],
    openGraph: {
      title: `Free ${bm.name} Tips Today — ${siteName}`,
      description: bm.description,
      type: 'website',
      url: canonical,
      siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(BOOKMAKERS).map(b => ({ bookmaker: b }));
}

export const dynamicParams = true;

export default async function BookmakerTipsPage({ params }: Props) {
  const { bookmaker } = await params;
  const bm = BOOKMAKERS[bookmaker];
  if (!bm) notFound();

  const relatedBookmakers = Object.values(BOOKMAKERS)
    .filter(b => b.slug !== bookmaker)
    .slice(0, 6);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/tips/${bookmaker}`;

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    url: canonical,
    name: `Free ${bm.name} Tips & Predictions Today`,
    description: bm.description,
    isPartOf: { '@id': `${baseUrl}/#website` },
    about: {
      '@type': 'Organization',
      name: bm.fullName,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Betcheza', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Bookmakers', item: `${baseUrl}/bookmakers` },
        { '@type': 'ListItem', position: 3, name: `${bm.name} Tips`, item: canonical },
      ],
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Where can I get free ${bm.name} tips today?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Betcheza provides free daily ${bm.name} tips, jackpot banker picks and football predictions updated by verified tipsters. Visit betcheza.co.ke/tips/${bookmaker}.`,
        },
      },
      ...(bm.jackpot ? [{
        '@type': 'Question',
        name: `How do I win the ${bm.name} ${bm.jackpot}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ${bm.name} ${bm.jackpot} requires correctly predicting ${bm.jackpotGames ?? 'all'} matches. Betcheza's AI predictor and community tipsters publish daily banker picks and analysis to help you pick the best selections.`,
        },
      }] : []),
      {
        '@type': 'Question',
        name: `Is ${bm.name} available in Kenya?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. ${bm.fullName} is a licensed betting operator in Kenya${bm.mpesa ? ', accepting M-Pesa deposits and withdrawals' : ''}. Minimum bet is ${bm.minBet}.`,
        },
      },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/bookmakers" className="hover:text-foreground transition-colors">Bookmakers</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{bm.name} Tips</span>
      </nav>

      {/* Hero */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-3 py-0.5 text-xs font-semibold text-primary">
                Free Tips
              </span>
              {bm.jackpot && (
                <span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {bm.jackpot}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">
              {bm.name}{' '}Tips &amp; Predictions
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Free {bm.name} Kenya tips updated daily by AI-powered analysis and verified tipsters
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 md:items-end">
            <Link
              href="/predictor"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors text-center"
            >
              Get AI Predictions
            </Link>
            <Link
              href="/tipsters"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors text-center"
            >
              View Top Tipsters
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Star, label: 'Min Bet', value: bm.minBet },
          { icon: TrendingUp, label: 'Markets', value: `${bm.markets.length} types` },
          { icon: Shield, label: 'M-Pesa', value: bm.mpesa ? 'Supported' : 'No' },
          { icon: Users, label: 'Tipsters', value: '50,000+' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
            <Icon className="mx-auto mb-1 h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 md:col-span-2">
          {/* About */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-xl font-bold">About {bm.name} Tips</h2>
            <p className="leading-relaxed text-muted-foreground">{bm.description}</p>
            {bm.bonuses && (
              <div className="mt-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                <strong>Bonus:</strong> {bm.bonuses}
              </div>
            )}
          </section>

          {/* Jackpot section */}
          {bm.jackpot && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
              <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
                <Trophy className="h-5 w-5 text-amber-500" />
                {bm.name} {bm.jackpot} Tips
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {bm.jackpotGames && (
                  <div className="rounded-lg bg-background/70 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{bm.jackpotGames}</p>
                    <p className="text-xs text-muted-foreground">Games to predict</p>
                  </div>
                )}
                {bm.jackpotPrize && (
                  <div className="rounded-lg bg-background/70 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{bm.jackpotPrize}</p>
                    <p className="text-xs text-muted-foreground">Jackpot prize</p>
                  </div>
                )}
                <div className="rounded-lg bg-background/70 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">AI</p>
                  <p className="text-xs text-muted-foreground">Powered picks</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Our AI model analyses form, head-to-head records, home/away performance, and odds movement to generate {bm.jackpotGames ?? ''}-game jackpot predictions. Our tipsters verify each pick before publishing.
              </p>
              <div className="mt-4">
                <Link
                  href="/jackpots"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  <Target className="h-4 w-4" />
                  View Jackpot Predictions
                </Link>
              </div>
            </section>
          )}

          {/* How we pick tips */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold">How We Pick {bm.name} Tips</h2>
            <div className="space-y-3">
              {[
                { icon: Zap, title: 'AI-Powered Analysis', desc: 'Our AI scans 35+ data points including form, injuries, head-to-head, and market odds movement for every match.' },
                { icon: Users, title: 'Verified Tipsters', desc: 'Over 50,000 tipsters on Betcheza submit picks. We surface the top performers with a 60%+ long-term win rate.' },
                { icon: TrendingUp, title: 'Value Hunting', desc: 'We identify odds where the bookmaker\'s implied probability is lower than our model\'s prediction — that\'s where profit lives.' },
                { icon: Shield, title: 'Responsible Betting', desc: 'Every tip includes confidence rating. We recommend bankroll management strategies to protect your funds.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SEO article */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold">Free {bm.name} Kenya Tips Today</h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Finding reliable <strong className="text-foreground">{bm.name} tips in Kenya</strong> is crucial to long-term betting success. Betcheza provides daily free {bm.name} predictions vetted by AI and our community of 50,000+ verified tipsters.
              </p>
              <p>
                Our approach combines statistical analysis — including expected goals (xG), possession data, team form over the last five matches, and injury reports — with market intelligence. When the odds on offer represent value against our model, we flag it as a tip.
              </p>
              {bm.jackpot && (
                <p>
                  For the <strong className="text-foreground">{bm.name} {bm.jackpot}</strong>, we generate banker picks — our highest-confidence selections — that are ideal for anchoring your jackpot entries. Jackpot analysis is updated the moment fixtures are announced and revised as team news arrives.
                </p>
              )}
              <p>
                Whether you want single match predictions, accumulator tips, or jackpot bankers, Betcheza covers every market offered by {bm.name} Kenya including {bm.markets.slice(0, 3).join(', ')}, and more. All tips are free and updated daily.
              </p>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Markets */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 font-bold">Available Markets</h3>
            <ul className="space-y-1.5">
              {bm.markets.map(m => (
                <li key={m} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {m}
                </li>
              ))}
            </ul>
          </div>

          {/* Features */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 font-bold">Platform Features</h3>
            <ul className="space-y-1.5">
              {bm.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="rounded-xl bg-primary/10 p-5 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="mb-1 font-bold">Get Today&apos;s Best Bets</p>
            <p className="mb-3 text-xs text-muted-foreground">AI-powered picks updated daily</p>
            <Link
              href="/matches"
              className="block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Browse Predictions
            </Link>
          </div>

          {/* Other bookmakers */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 font-bold">Other Bookmakers</h3>
            <ul className="space-y-1">
              {relatedBookmakers.map(rb => (
                <li key={rb.slug}>
                  <Link
                    href={`/tips/${rb.slug}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    {rb.name} Tips
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* FAQ Schema section */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-5 text-xl font-bold">Frequently Asked Questions — {bm.name} Tips</h2>
        <div className="space-y-4">
          {[
            {
              q: `Are ${bm.name} tips on Betcheza free?`,
              a: `Yes. All ${bm.name} predictions on Betcheza are completely free. We cover daily match tips, jackpot banker picks, and accumulator suggestions at no cost.`,
            },
            {
              q: `How accurate are ${bm.name} predictions?`,
              a: `Our top tipsters maintain win rates of 60–73%. Accuracy varies by market — 1X2 tips on heavy favourites tend to be more consistent; correct score and BTTS tips carry higher odds with slightly lower hit rates. Always bet responsibly.`,
            },
            {
              q: bm.jackpot ? `How do I use the ${bm.name} ${bm.jackpot} predictions?` : `Which markets do ${bm.name} tips cover?`,
              a: bm.jackpot
                ? `Visit the Jackpots page on Betcheza and select ${bm.name}. You'll see the full ${bm.jackpotGames ?? ''}-game lineup with our AI confidence ratings, banker picks (our highest confidence games), and community consensus from 50,000+ tipsters.`
                : `Our ${bm.name} tips cover all major markets: 1X2, Over/Under goals, Both Teams to Score, Double Chance, Correct Score, Asian Handicap, and accumulator combinations.`,
            },
            {
              q: `Can I bet on ${bm.name} via M-Pesa?`,
              a: bm.mpesa
                ? `Yes — ${bm.name} Kenya supports M-Pesa deposits and withdrawals. Minimum bet is ${bm.minBet}. Betcheza is fully integrated with M-Pesa for wallet top-ups and cash-outs.`
                : `Check ${bm.name} Kenya directly for payment methods. Betcheza supports M-Pesa for community wallet top-ups.`,
            },
          ].map(({ q, a }) => (
            <details key={q} className="group rounded-lg border border-border bg-background">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium">
                {q}
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90 text-muted-foreground" />
              </summary>
              <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* JSON-LD FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `Are ${bm.name} tips on Betcheza free?`,
                acceptedAnswer: { '@type': 'Answer', text: `Yes. All ${bm.name} predictions on Betcheza are completely free.` },
              },
              {
                '@type': 'Question',
                name: `How accurate are ${bm.name} predictions?`,
                acceptedAnswer: { '@type': 'Answer', text: 'Our top tipsters maintain win rates of 60–73%. Always bet responsibly.' },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
