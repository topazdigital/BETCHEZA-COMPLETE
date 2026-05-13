import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Today\'s Football Matches & Betting Odds | Betcheza Kenya',
  description: 'View today\'s football, basketball and tennis fixtures with live odds, AI predictions and tipster tips. Free betting tips for SportPesa, Betika, Odibets and all Kenyan bookmakers.',
  keywords: [
    'football matches today Kenya', 'today football tips Kenya', 'betting tips today',
    'SportPesa tips today', 'Betika tips today', 'football fixtures Kenya',
    'free football predictions today', 'correct score tips Kenya', 'over 2.5 goals today',
    'BTTS tips today', 'Premier League predictions', 'Champions League tips',
    'La Liga predictions', 'Bundesliga tips', 'Serie A predictions',
    'Kenya Premier League tips KPL', 'live football odds', 'accumulator tips today',
    'double chance tips', 'Asian handicap tips', 'football betting odds Kenya',
  ],
  openGraph: {
    title: 'Today\'s Matches & Free Betting Tips | Betcheza',
    description: 'Live odds, AI predictions and free betting tips for all today\'s matches. SportPesa, Betika, Odibets tips included.',
    url: 'https://betcheza.co.ke/matches',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Today\'s Matches & Free Tips | Betcheza Kenya',
    description: 'AI predictions + free tips for all today\'s fixtures. Updated every 60 seconds.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/matches' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
