'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { TeamLogo } from '@/components/ui/team-logo';
import { matchToSlug } from '@/lib/utils/match-url';
import type { Match } from '@/lib/hooks/use-matches';

export function LiveSidePanel({
  liveMatches,
  upcomingMatches,
}: {
  liveMatches: Match[];
  upcomingMatches: Match[];
}) {
  const hasLive = liveMatches.length > 0;
  const displayMatches = hasLive ? liveMatches.slice(0, 8) : upcomingMatches.slice(0, 8);
  const label = hasLive ? 'Live Now' : 'Up Next';
  const allHref = hasLive ? '/matches?status=live' : '/matches?status=scheduled';

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            hasLive ? 'animate-ping bg-live' : 'bg-muted-foreground/40',
          )}></span>
          <span className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            hasLive ? 'bg-live' : 'bg-muted-foreground/60',
          )}></span>
        </span>
        <h3 className="text-xs font-bold text-foreground">{label}</h3>
        <Badge variant={hasLive ? 'destructive' : 'secondary'} className="h-4 px-1 text-[9px]">
          {displayMatches.length}
        </Badge>
        <Link href={allHref} className="ml-auto text-[10px] text-primary hover:underline">
          All
        </Link>
      </div>
      <div className="space-y-1">
        {displayMatches.map(m => {
          const t = new Date(m.kickoffTime);
          const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <Link
              key={m.id}
              href={`/matches/${matchToSlug(m.id, m.homeTeam.name, m.awayTeam.name)}`}
              className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] transition-colors hover:border-primary/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate">
                  <TeamLogo teamName={m.homeTeam.name} logoUrl={m.homeTeam.logo} sportSlug={m.sport?.slug} size="xs" />
                  <span className="truncate font-medium text-foreground group-hover:text-primary">
                    {(m.homeTeam as { shortName?: string }).shortName || m.homeTeam.name}
                  </span>
                  <span className="text-muted-foreground mx-0.5">vs</span>
                  <TeamLogo teamName={m.awayTeam.name} logoUrl={m.awayTeam.logo} sportSlug={m.sport?.slug} size="xs" />
                  <span className="truncate font-medium text-foreground group-hover:text-primary">
                    {(m.awayTeam as { shortName?: string }).shortName || m.awayTeam.name}
                  </span>
                </div>
                <p className="truncate text-[9px] text-muted-foreground">{m.league?.name || m.sport?.name}</p>
              </div>
              <div className="shrink-0 text-right">
                {m.status === 'live' || m.status === 'halftime' ? (
                  <span className="rounded bg-live/20 px-1 py-0.5 text-[9px] font-bold text-live">
                    {m.status === 'halftime' ? 'HT' : (m as { minute?: number | null }).minute ? `${(m as { minute?: number | null }).minute}'` : 'LIVE'}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-foreground">{time}</span>
                )}
              </div>
            </Link>
          );
        })}
        {displayMatches.length === 0 && (
          <p className="py-2 text-center text-[10px] text-muted-foreground">No matches right now</p>
        )}
      </div>
    </div>
  );
}
