import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TipsFeedClient } from '@/components/tips/tips-feed-client';

interface Props {
  searchParams?: Promise<{ sport?: string; day?: string }> | { sport?: string; day?: string };
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
  const sport = (sp.sport ?? '').toLowerCase();
  const day   = (sp.day   ?? 'today') as 'today' | 'tomorrow' | 'upcoming';

  const sportLabel = sport ? cap(sport) : '';
  const dayLabel   = day === 'today' ? "Today's" : day === 'tomorrow' ? "Tomorrow's" : 'Upcoming';

  const title = sport
    ? `${dayLabel} Free ${sportLabel} Betting Tips | Predictions | Betcheza`
    : `${dayLabel} Free Betting Tips | Community Predictions | Betcheza`;

  const description = sport
    ? `Expert ${sport} betting tips from Kenya's top-ranked tipsters. ${dayLabel.replace("'s", '')} picks with in-depth analysis and real odds — updated daily.`
    : `Browse ${dayLabel.toLowerCase()} best free betting tips from Kenya's top-ranked tipsters. Filter by sport, odds range, and more. Daily picks for football, basketball, rugby and 35+ sports.`;

  const canonical = sport
    ? `https://betcheza.co.ke/tips?sport=${encodeURIComponent(sport)}${day !== 'today' ? `&day=${day}` : ''}`
    : day !== 'today'
      ? `https://betcheza.co.ke/tips?day=${day}`
      : 'https://betcheza.co.ke/tips';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Betcheza',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function TipsPage({ searchParams }: Props) {
  const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
  const initialSport = (sp.sport ?? '').toLowerCase();
  const initialDay   = (sp.day ?? 'today') as 'today' | 'tomorrow' | 'upcoming';
  return (
    <Suspense fallback={<div className="w-full px-3 py-8 text-center text-muted-foreground text-sm">Loading tips…</div>}>
      <TipsFeedClient initialSport={initialSport} initialDay={initialDay} />
    </Suspense>
  );
}
