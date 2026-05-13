import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Best Tipsters in Kenya | Top Football Predictors | Betcheza',
  description: 'Follow the best football tipsters in Kenya with verified win rates. Compare top predictors for SportPesa, Betika, Odibets and more. Free tips from expert tipsters updated daily.',
  keywords: [
    'best tipsters Kenya', 'top football predictors Kenya', 'free tipsters Kenya',
    'SportPesa tipster', 'Betika tipster', 'football tipster Kenya',
    'verified tipsters Kenya', 'highest win rate tipsters', 'tipster leaderboard Kenya',
    'football prediction experts Kenya', 'best football predictions today',
    'follow tipster Kenya', 'top betting experts Kenya', 'tipster ROI Kenya',
    'free football tips experts', 'tipster community Kenya', 'best betting tipsters Africa',
  ],
  openGraph: {
    title: 'Best Tipsters in Kenya | Top Football Predictors | Betcheza',
    description: 'Find and follow the best verified tipsters in Kenya. Compare win rates, ROI and picks for SportPesa, Betika and Odibets.',
    url: 'https://betcheza.co.ke/tipsters',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Tipsters Kenya | Betcheza',
    description: 'Follow Kenya\'s top verified football tipsters. Free tips from experts with proven win rates.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/tipsters' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
