import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Kenya Jackpot Predictions Today | Free AI Tips — Betcheza',
  description: 'Free AI-powered jackpot predictions for all Kenyan bookmakers. SportPesa Midweek & Mega Jackpot, Betika Grand Jackpot, OdiBets, Betin, Mozzartbet tips — updated daily with confidence ratings.',
  keywords: ['Kenya jackpot predictions','jackpot predictions today Kenya','SportPesa jackpot predictions','SportPesa Mega Jackpot predictions','SportPesa Midweek Jackpot tips','Betika jackpot predictions','Betika Grand Jackpot tips','OdiBets jackpot predictions','Betin jackpot predictions','Mozzartbet jackpot tips','free jackpot predictions Kenya','AI jackpot tips Kenya','jackpot tips today','Betcheza jackpot'],
  openGraph: { title: 'Kenya Jackpot Predictions | Free AI Tips — Betcheza', description: 'Get free AI predictions for SportPesa Mega & Midweek Jackpot, Betika Grand Jackpot, OdiBets, Betin and Mozzartbet. Updated daily.', url: 'https://betcheza.co.ke/jackpots', type: 'website', siteName: 'Betcheza' },
  twitter: { card: 'summary_large_image', title: 'Kenya Jackpot Predictions Today | Betcheza', description: 'Free AI jackpot tips for SportPesa, Betika, OdiBets, Betin & Mozzartbet. Updated daily.' },
  alternates: { canonical: 'https://betcheza.co.ke/jackpots' },
  robots: { index: true, follow: true },
};
export default function JackpotsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
