import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Scores Today | Football Live Results & In-Play Tips | Betcheza',
  description: 'Live football scores, real-time updates and in-play betting tips. Follow live matches for Premier League, Champions League, Kenya Premier League and all major leagues.',
  keywords: [
    'live football scores today', 'live scores Kenya', 'football live results today',
    'in-play betting tips Kenya', 'live Premier League scores', 'live Champions League',
    'live Kenya Premier League', 'live match updates', 'football live today Kenya',
    'live betting tips Kenya', 'live scores SportPesa', 'real-time football scores',
    'live score today football', 'in-play odds Kenya',
  ],
  openGraph: {
    title: 'Live Football Scores & In-Play Tips | Betcheza Kenya',
    description: 'Real-time live scores and in-play betting tips for all major leagues. Updated every minute.',
    url: 'https://betcheza.co.ke/live',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Scores & In-Play Tips | Betcheza',
    description: 'Real-time football scores and live betting tips. Updated every minute.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/live' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
