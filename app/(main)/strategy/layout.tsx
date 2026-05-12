import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3 Daily Odds Winning Strategy | Betcheza',
  description:
    'Follow our proven 7-day compounding football betting strategy. Every day we publish picks with combined odds between 3.0–4.0, reinvesting winnings progressively from KES 1,000 to a potential KES 108,000 weekly profit.',
  keywords: [
    '3 daily odds strategy',
    'football betting strategy Kenya',
    'compounding bet strategy',
    'daily football picks',
    'accumulator strategy',
    'betcheza picks',
    'sports betting tips Kenya',
  ],
  openGraph: {
    title: '3 Daily Odds Winning Strategy | Betcheza',
    description:
      'A 7-day compounding football bet strategy. Each day we publish picks with combined odds of 3.0–4.0 — any number of games that hit the target range. KES 1,000 can grow to KES 108,000 in a week.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '3 Daily Odds Winning Strategy | Betcheza',
    description:
      'Daily football picks with combined odds 3.0–4.0. Follow the 7-day compounding plan and grow KES 1,000 into KES 108,000.',
  },
};

export default function StrategyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
