'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { MatchWithDetails } from '@/lib/types';
import { MatchCard } from './match-card';
import { LeagueFlag } from '@/components/ui/team-logo';

interface MatchListProps {
  title: string;
  matches: MatchWithDetails[];
  defaultExpanded?: boolean;
  showCount?: boolean;
}

export function MatchList({ title, matches, defaultExpanded = true, showCount = true }: MatchListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (matches.length === 0) {
    return null;
  }

  // Group matches by league
  const groupedMatches = matches.reduce((acc, match) => {
    const leagueId = match.league.id;
    if (!acc[leagueId]) {
      acc[leagueId] = {
        league: match.league,
        country: match.country,
        matches: [],
      };
    }
    acc[leagueId].matches.push(match);
    return acc;
  }, {} as Record<number, { league: typeof matches[0]['league']; country?: typeof matches[0]['country']; matches: MatchWithDetails[] }>);

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground">{title}</h2>
          {showCount && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {matches.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border">
          {Object.values(groupedMatches).map(({ league, country, matches: leagueMatches }) => (
            <div key={league.id}>
              {/* League Header */}
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
                {country?.code ? (
                  <LeagueFlag countryCode={country.code} size="sm" />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-semibold">
                    {league.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm font-medium text-foreground">{league.name}</span>
                <span className="text-xs text-muted-foreground">({leagueMatches.length})</span>
              </div>

              {/* Matches */}
              <div className="divide-y divide-border">
                {leagueMatches.map((match) => (
                  <div key={match.id} className="p-3">
                    <MatchCard
                      match={match}
                      odds={{ home: 1.5 + Math.random() * 2, draw: 2.5 + Math.random() * 1.5, away: 2 + Math.random() * 3 }}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
