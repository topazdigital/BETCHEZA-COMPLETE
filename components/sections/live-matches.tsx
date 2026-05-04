'use client';

import Link from 'next/link';
import { ChevronRight, Clock, Radio } from 'lucide-react';
import { MatchCardNew } from '@/components/matches/match-card-new';
import { LiveIndicator } from '@/components/matches/live-indicator';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { useLiveMatches, useUpcomingMatches } from '@/lib/hooks/use-matches';
import { matchIdToSlug } from '@/lib/utils/match-url';
import { useUserSettings } from '@/contexts/user-settings-context';
import { formatTime, formatDate, isToday, isTomorrow } from '@/lib/utils/timezone';

/**
 * Live Now is meant to be ALWAYS visible on the homepage. When there are no
 * actually-live matches, we show a friendly "no live games right now" panel
 * with the next few upcoming kickoffs so the section never silently
 * disappears (the user always knows something is happening).
 */
export function LiveMatchesSection() {
  const { settings } = useUserSettings();
  const { matches: liveMatches, isLoading } = useLiveMatches();
  const { matches: upcoming } = useUpcomingMatches(6);

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LiveIndicator />
          <h2 className="text-lg font-semibold text-foreground">Live Now</h2>
          <span className="rounded-full bg-live/10 px-2 py-0.5 text-xs font-medium text-live">
            {liveMatches.length}
          </span>
        </div>
        <Link
          href="/matches?status=live"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : liveMatches.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {liveMatches.map((match) => (
            <div key={match.id} className="w-72 shrink-0">
              <MatchCardNew match={match} showSport />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-live/10 p-2 text-live">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">No live games right now</p>
                <p className="text-xs text-muted-foreground">
                  We refresh this list every 10 seconds. Here's what's coming up next.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/matches?status=scheduled">
                See full schedule
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {upcoming.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.slice(0, 6).map((m) => {
                const t = new Date(m.kickoffTime);
                const tz = settings.timezone;
                const time = formatTime(t, tz);
                const day = isToday(t, tz) ? 'Today' : isTomorrow(t, tz) ? 'Tomorrow' : formatDate(t, tz);
                return (
                  <Link
                    key={m.id}
                    href={`/matches/${matchIdToSlug(m.id)}`}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {m.homeTeam.name} vs {m.awayTeam.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.league?.name || m.sport?.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-foreground">{time}</p>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {day}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
