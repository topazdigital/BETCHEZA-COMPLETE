import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Best Betting Sites Kenya 2025 — Compare Bookmakers | Betcheza',
  description:
    'Compare the top bookmakers in Kenya: Betika, Sportybet, 1xBet, Betway, 22Bet and more. Find the best welcome bonuses, highest odds, and trusted betting sites reviewed by Betcheza experts.',
  keywords: [
    'best betting sites Kenya', 'bookmakers Kenya', 'Betika', 'Sportybet', 'Betway Kenya',
    '1xBet Kenya', '22Bet Kenya', 'sports betting Kenya', 'online betting Kenya',
    'betting bonuses Kenya', 'highest odds Kenya', 'licensed bookmakers Kenya',
  ],
  openGraph: {
    title: 'Best Betting Sites Kenya 2025 — Betcheza',
    description: 'Compare top-rated bookmakers in Kenya. Find exclusive bonuses and the best odds from trusted betting sites.',
    url: 'https://betcheza.co.ke/bookmakers',
    siteName: 'Betcheza',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Betting Sites Kenya 2025',
    description: 'Compare the top bookmakers in Kenya with exclusive bonuses — reviewed by Betcheza.',
  },
  alternates: {
    canonical: 'https://betcheza.co.ke/bookmakers',
  },
};

export default function BookmakersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
