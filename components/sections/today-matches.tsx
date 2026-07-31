'use client';

import { Calendar } from 'lucide-react';
import { MatchCardNew } from '@/components/matches/match-card-new';
import { Spinner } from '@/components/ui/spinner';
import { useTodayMatches } from '@/lib/hooks/use-matches';

export function TodayMatchesSection() {
  const { matches: todayMatches, isLoading } = useTodayMatches();

  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-3">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Today&apos;s Matches</h2>
      </div>

      {todayMatches.length > 0 ? (
        <div className="space-y-2">
          {todayMatches.slice(0, 10).map((match) => (
            <MatchCardNew key={match.id} match={match} variant="compact" showSport />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No scheduled matches for today</p>
        </div>
      )}
    </section>
  );
}
