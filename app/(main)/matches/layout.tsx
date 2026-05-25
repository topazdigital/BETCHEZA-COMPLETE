import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Best Free Betting Tips Today Kenya | Football Predictions | Betcheza',
  description: 'Get the best free betting tips in Kenya today — AI predictions and expert tipster picks for every football match. SportPesa, Betika and Odibets tips updated daily. The most trusted source for free sure tips in Kenya.',
  keywords: [
    'best free betting tips Kenya today', 'best betting tips in Kenya',
    'free football tips today Kenya', 'free betting tips Kenya today',
    'today football tips Kenya', 'betting tips today Kenya',
    'most trusted betting tips Kenya', 'sure tips today Kenya',
    'free sure football tips Kenya', 'football matches today Kenya',
    'SportPesa tips today', 'Betika tips today', 'Odibets tips today',
    'football fixtures Kenya', 'free football predictions today Kenya',
    'correct score tips Kenya', 'over 2.5 goals today Kenya',
    'BTTS tips today Kenya', 'Premier League predictions Kenya',
    'Champions League tips Kenya', 'La Liga predictions Kenya',
    'Bundesliga tips Kenya', 'Serie A predictions Kenya',
    'Kenya Premier League tips KPL', 'FKF Premier League predictions',
    'live football odds Kenya', 'accumulator tips today Kenya',
    'double chance tips Kenya', 'Asian handicap tips Kenya',
    'football betting odds Kenya', 'high accuracy football tips Kenya',
    'which site gives correct football predictions Kenya',
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
