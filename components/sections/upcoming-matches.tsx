'use client';

import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { MatchCardNew } from '@/components/matches/match-card-new';
import { Spinner } from '@/components/ui/spinner';
import { useUpcomingMatches } from '@/lib/hooks/use-matches';

export function UpcomingMatchesSection() {
  const { matches: upcomingMatches, isLoading } = useUpcomingMatches(6);

  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      </section>
    );
  }

  if (upcomingMatches.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Upcoming</h2>
        </div>
        <Link
          href="/matches"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {upcomingMatches.map((match) => (
          <MatchCardNew key={match.id} match={match} showSport />
        ))}
      </div>
    </section>
  );
}
