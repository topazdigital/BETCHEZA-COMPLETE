import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tipster Leaderboard Kenya | Top Betting Predictors | Betcheza',
  description: 'See the top-ranked football tipsters in Kenya. Daily, weekly and monthly leaderboards showing win rates, ROI and streaks. Find the best SportPesa and Betika tipsters.',
  keywords: [
    'tipster leaderboard Kenya', 'best betting tipsters Kenya', 'top football predictors Kenya',
    'SportPesa tipster leaderboard', 'Betika tipster rankings', 'tipster win rate Kenya',
    'football prediction leaderboard', 'tipster ROI Kenya', 'best tipster community Kenya',
    'free football tips leaderboard', 'tipster rankings Africa', 'football betting experts Kenya',
  ],
  openGraph: {
    title: 'Tipster Leaderboard | Best Predictors in Kenya | Betcheza',
    description: 'Kenya\'s top football tipsters ranked by win rate. Find the best predictors for SportPesa, Betika and Odibets.',
    url: 'https://betcheza.co.ke/leaderboard',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tipster Leaderboard Kenya | Betcheza',
    description: 'Kenya\'s top ranked football tipsters by win rate and ROI.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/leaderboard' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
