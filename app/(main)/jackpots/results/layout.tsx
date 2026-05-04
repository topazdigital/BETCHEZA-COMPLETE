import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jackpot Results & History | Winning Combinations — Betcheza Kenya',
  description: 'View past jackpot results, winning combinations and payouts for SportPesa, Betika, OdiBets, Betin and Mozzartbet.',
  robots: { index: true, follow: true },
};

export default function JackpotResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
