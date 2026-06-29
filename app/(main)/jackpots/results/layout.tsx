import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jackpot Results & History | SportPesa Betika Odibets — Betcheza Kenya',
  description: 'View past jackpot results, winning combinations and payouts for SportPesa Mega Jackpot, Betika Grand Jackpot, Odibets Jackpot Bonanza, Betin and Mozzartbet Kenya.',
  keywords: [
    'jackpot results Kenya', 'SportPesa mega jackpot results', 'Betika grand jackpot results',
    'Odibets jackpot bonanza results', 'Betin jackpot results', 'Mozzartbet jackpot results',
    'jackpot history Kenya', 'jackpot winning combinations Kenya', 'jackpot prediction results',
  ],
  robots: { index: true, follow: true },
};

export default function JackpotResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
