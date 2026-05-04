import type { Metadata } from 'next';
import { Trophy } from 'lucide-react';
import BookmakerCards from './bookmaker-cards';

export const metadata: Metadata = {
  title: 'Kenya Jackpot Predictions Today | Free AI Tips — Betcheza',
  description: 'Free AI-powered jackpot predictions for all Kenyan bookmakers. SportPesa Midweek & Mega Jackpot, Betika Grand Jackpot, OdiBets, Betin, Mozzartbet tips — updated daily with confidence ratings.',
  keywords: ['Kenya jackpot predictions','jackpot predictions today Kenya','SportPesa jackpot predictions','SportPesa Mega Jackpot','SportPesa Midweek Jackpot','Betika jackpot predictions','Betika Grand Jackpot','OdiBets jackpot','Betin jackpot','Mozzartbet jackpot','free jackpot tips Kenya','AI jackpot Kenya','Betcheza jackpot'],
  openGraph: {
    title: 'Kenya Jackpot Predictions | Free AI Tips — Betcheza',
    description: 'Free AI-powered jackpot predictions for SportPesa, Betika, OdiBets, Betin and Mozzartbet. Updated daily.',
    url: 'https://betcheza.co.ke/jackpots',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kenya Jackpot Predictions Today | Betcheza',
    description: 'Free AI jackpot tips for SportPesa, Betika, OdiBets, Betin & Mozzartbet.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/jackpots' },
  robots: { index: true, follow: true },
};

export default function JackpotsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Kenya Jackpot Predictions Today',
    description: 'Free AI-powered jackpot predictions for all Kenyan bookmakers — SportPesa, Betika, OdiBets, Betin, Mozzartbet.',
    url: 'https://betcheza.co.ke/jackpots',
    publisher: { '@type': 'Organization', name: 'Betcheza', url: 'https://betcheza.co.ke' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://betcheza.co.ke' },
        { '@type': 'ListItem', position: 2, name: 'Jackpots', item: 'https://betcheza.co.ke/jackpots' },
      ],
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Kenya Jackpot Predictions</h1>
              <p className="text-sm text-muted-foreground">Free AI tips for all major Kenyan bookmaker jackpots — updated daily</p>
            </div>
          </div>
        </div>
        <BookmakerCards />
        <div className="pt-2 border-t text-center">
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            <strong className="text-foreground">Disclaimer:</strong> AI predictions are for informational purposes only and do not guarantee wins. Please gamble responsibly. Kenya helpline: <strong>0800 723 253</strong> (free, 24/7).
          </p>
        </div>
      </div>
    </>
  );
}
