import type { Metadata } from 'next';
import { Trophy, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import BookmakerCards from './bookmaker-cards';
import { JackpotNotifyButton } from '@/components/jackpots/jackpot-notify-button';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kenya Jackpot Predictions Today | SportPesa Mega Jackpot, Betika Grand Jackpot — Betcheza',
  description: 'Free AI jackpot predictions for all Kenyan bookmakers today. SportPesa Mega Jackpot (17 games), SportPesa Midweek Jackpot, Betika Grand Jackpot, OdiBets Jackpot Bonanza, Mozzartbet Mega Jackpot — banker picks & confidence ratings updated daily.',
  keywords: [
    'Kenya jackpot predictions today',
    'jackpot predictions today Kenya',
    'free jackpot predictions Kenya',
    'Kenya jackpot tips today',
    'best jackpot predictions Kenya',
    'most accurate jackpot tips Kenya',
    'SportPesa jackpot predictions',
    'SportPesa Mega Jackpot prediction',
    'SportPesa Mega Jackpot predictions today',
    'SportPesa Mega Jackpot prediction today',
    'SportPesa Mega Jackpot tips today',
    'SportPesa Mega Jackpot 17 games',
    'mega jackpot prediction 17 games',
    'mega jackpot prediction today',
    'mega jackpot tips today',
    'mega jackpot prediction Kenya',
    'SportPesa Midweek Jackpot predictions',
    'SportPesa Midweek Jackpot tips today',
    'Betika jackpot predictions',
    'Betika Grand Jackpot predictions',
    'Betika Grand Jackpot tips today',
    'OdiBets jackpot predictions',
    'OdiBets jackpot tips today',
    'Mozzartbet jackpot predictions',
    'Mozzartbet Mega Jackpot predictions',
    'Betin jackpot predictions',
    'jackpot banker Kenya',
    'jackpot banker today Kenya',
    'AI jackpot tips Kenya',
    'jackpot analysis Kenya',
    'sure jackpot prediction Kenya',
    'jackpot free picks Kenya',
    'jackpot tips Kenya free',
    'how to win jackpot Kenya',
    'winning jackpot tips Kenya',
    'best betting tips Kenya jackpot',
    'jackpot predictions free Kenya',
    'Betcheza jackpot',
    'jackpot winners Kenya',
  ],
  openGraph: {
    title: 'Kenya Jackpot Predictions Today | Free AI Tips — Betcheza',
    description: 'Free AI-powered jackpot predictions for SportPesa Mega & Midweek Jackpot, Betika Grand Jackpot, OdiBets, Betin and Mozzartbet. All 17-game jackpot cards covered — updated daily.',
    url: 'https://betcheza.co.ke/jackpots',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kenya Jackpot Predictions Today | Betcheza',
    description: 'Free AI jackpot tips for SportPesa Mega Jackpot, Betika Grand Jackpot, OdiBets & Mozzartbet. 17-game predictions with confidence ratings.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/jackpots' },
  robots: { index: true, follow: true },
};

export default function JackpotsPage() {
  const baseUrl = 'https://betcheza.co.ke';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Kenya Jackpot Predictions Today',
    description: 'Free AI-powered jackpot predictions for all Kenyan bookmakers — SportPesa Mega Jackpot, Betika Grand Jackpot, OdiBets Jackpot Bonanza, Mozzartbet Mega Jackpot.',
    url: `${baseUrl}/jackpots`,
    publisher: { '@type': 'Organization', name: 'Betcheza', url: baseUrl },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Jackpots', item: `${baseUrl}/jackpots` },
      ],
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How many games are in the SportPesa Mega Jackpot?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The SportPesa Mega Jackpot has 17 games. You must correctly predict the outcome of all 17 matches to win the jackpot prize of KES 100M+. Betcheza provides free AI predictions for all 17 games with confidence ratings. Visit betcheza.co.ke/jackpots/sportpesa/mega-jackpot for today\'s free picks.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the SportPesa Mega Jackpot prediction today?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Betcheza publishes free AI predictions for the SportPesa Mega Jackpot every weekend. The Mega Jackpot has 17 games with a prize pool of KES 100M+. Visit betcheza.co.ke/jackpots/sportpesa/mega-jackpot for today\'s 17-game tips with confidence ratings and banker picks.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the SportPesa Midweek Jackpot prediction today?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Betcheza publishes free AI predictions for the SportPesa Midweek Jackpot every week. The Midweek Jackpot has 13 games. Visit betcheza.co.ke/jackpots/sportpesa/midweek-jackpot for today\'s tips.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which bookmakers offer jackpots in Kenya?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The main jackpot bookmakers in Kenya are SportPesa (Mega Jackpot and Midweek Jackpot), Betika (Grand Jackpot, Midweek Jackpot, Daily Jackpot), OdiBets (Jackpot Bonanza), Betin Kenya (Grand Jackpot, Midweek Jackpot), and Mozzartbet (Mega Jackpot). Betcheza covers all of them with free AI predictions.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are Betcheza jackpot predictions free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All jackpot predictions on Betcheza are 100% free. No subscription or payment is needed. You get full access to all game picks, confidence ratings, banker tips, and AI reasoning.',
        },
      },
      {
        '@type': 'Question',
        name: 'How accurate are the jackpot predictions?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Betcheza\'s AI analyzes team form, head-to-head records, home/away statistics, goals data, and live odds to generate predictions with confidence percentages. High-confidence picks (80%+) make the best banker selections.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the Betika Grand Jackpot prediction today?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Betcheza provides free AI predictions for the Betika Grand Jackpot every round. Visit betcheza.co.ke/jackpots/betika/grand-jackpot for today\'s 17-game tips with confidence ratings.',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Kenya Jackpot Predictions Today</h1>
                <p className="text-sm text-muted-foreground">Free AI tips for SportPesa Mega Jackpot, Betika Grand Jackpot, OdiBets & more — updated daily</p>
              </div>
            </div>
            <JackpotNotifyButton className="shrink-0 mt-1" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/jackpots/results"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50 px-3 py-1.5 rounded-full transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              View Past Jackpot Results &amp; Winning Combinations
            </Link>
          </div>
        </div>

        {/* Featured jackpots — server-rendered strong internal links for crawlers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* SportPesa Mega Jackpot spotlight */}
          <Link
            href="/jackpots/sportpesa/mega-jackpot"
            className="group flex items-center gap-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-3 hover:border-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-green-800 dark:text-green-300 leading-tight">SportPesa Mega Jackpot Prediction Today</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">17 games · KES 100M+ prize · Free AI picks</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />
          </Link>
          {/* SportPesa Midweek Jackpot spotlight */}
          <Link
            href="/jackpots/sportpesa/midweek-jackpot"
            className="group flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 hover:border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-blue-800 dark:text-blue-300 leading-tight">SportPesa Midweek Jackpot Prediction Today</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">13 games · KES 15M+ prize · Free AI picks</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 ml-auto" />
          </Link>
        </div>

        {/* Quick nav to all jackpot type pages — SEO-rich server-rendered links */}
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_BOOKMAKERS.map(bk =>
            bk.jackpotTypes.map(type => {
              const typeSlug = type.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              return (
                <Link
                  key={`${bk.slug}-${typeSlug}`}
                  href={`/jackpots/${bk.slug}/${typeSlug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 hover:bg-muted px-3 py-1 text-xs font-medium transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: bk.color }} />
                  {bk.name} {type}
                </Link>
              );
            })
          )}
        </div>

        <BookmakerCards />

        {/* SEO content section */}
        <div className="space-y-4 border-t pt-4">
          <h2 className="text-base font-bold">Free Jackpot Predictions for All Kenyan Bookmakers</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Betcheza publishes <strong>free AI jackpot predictions</strong> for every major Kenyan bookmaker jackpot, including the
            <strong> SportPesa Mega Jackpot (17 games)</strong>, SportPesa Midweek Jackpot,
            <strong> Betika Grand Jackpot</strong>, Betika Midweek Jackpot, OdiBets Jackpot Bonanza,
            Mozzartbet Mega Jackpot, and Betin Grand Jackpot.
            Our AI analyses form, head-to-head records, and odds to generate <strong>banker picks</strong> and
            confidence ratings for each game — all free.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <strong>SportPesa Mega Jackpot prediction today</strong> is our most popular page, covering all 17 games with
            AI confidence ratings. We also provide <strong>SportPesa Midweek Jackpot tips</strong> and
            <strong> Betika Grand Jackpot analysis</strong> for every round.
            Use our <strong>jackpot banker tips</strong> to identify the most predictable games and
            double-chance options for trickier fixtures.
          </p>
        </div>

        <div className="pt-2 border-t text-center">
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            <strong className="text-foreground">Disclaimer:</strong> AI predictions are for informational purposes only and do not guarantee wins. Please gamble responsibly. Kenya helpline: <strong>0800 723 253</strong> (free, 24/7).
          </p>
        </div>
      </div>
    </>
  );
}
