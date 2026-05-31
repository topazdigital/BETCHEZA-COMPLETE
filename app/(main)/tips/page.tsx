import type { Metadata } from 'next';
import { TipsFeedClient } from '@/components/tips/tips-feed-client';

export const metadata: Metadata = {
  title: 'Free Betting Tips Today | Community Tips & Predictions | Betcheza',
  description: "Browse today's best free betting tips from Kenya's top-ranked tipsters. Filter by sport, odds, and more. Daily picks for football, basketball, rugby and 35+ sports.",
  alternates: { canonical: 'https://betcheza.co.ke/tips' },
};

export default function TipsPage() {
  return <TipsFeedClient />;
}
