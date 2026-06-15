import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Best Jackpot Predictions Kenya Today | Free AI Tips',
  description: 'Get the best free jackpot predictions in Kenya today — AI-powered tips for SportPesa Midweek & Mega Jackpot, Betika Grand Jackpot, Odibets, Betin and Mozzartbet. Most accurate jackpot banker picks updated daily.',
  keywords: [
    'best jackpot predictions Kenya', 'Kenya jackpot predictions today',
    'free jackpot predictions Kenya', 'most accurate jackpot tips Kenya',
    'SportPesa jackpot predictions', 'SportPesa Mega Jackpot predictions',
    'SportPesa Midweek Jackpot tips', 'SportPesa jackpot banker today',
    'Betika jackpot predictions', 'Betika Grand Jackpot tips',
    'Betika jackpot banker today', 'OdiBets jackpot predictions',
    'Betin jackpot predictions', 'Mozzartbet jackpot tips',
    'AI jackpot tips Kenya', 'jackpot tips today Kenya',
    'how to win jackpot Kenya', 'sure jackpot prediction Kenya',
    'jackpot analysis Kenya', 'jackpot free picks Kenya',
    'Betcheza jackpot', 'jackpot winners Kenya',
    'best betting tips Kenya jackpot', 'winning jackpot strategy Kenya',
  ],
  openGraph: { title: 'Kenya Jackpot Predictions | Free AI Tips — Betcheza', description: 'Get free AI predictions for SportPesa Mega & Midweek Jackpot, Betika Grand Jackpot, OdiBets, Betin and Mozzartbet. Updated daily.', url: 'https://betcheza.co.ke/jackpots', type: 'website', siteName: 'Betcheza' },
  twitter: { card: 'summary_large_image', title: 'Kenya Jackpot Predictions Today | Betcheza', description: 'Free AI jackpot tips for SportPesa, Betika, OdiBets, Betin & Mozzartbet. Updated daily.' },
  alternates: { canonical: 'https://betcheza.co.ke/jackpots' },
  robots: { index: true, follow: true },
};
export default function JackpotsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
