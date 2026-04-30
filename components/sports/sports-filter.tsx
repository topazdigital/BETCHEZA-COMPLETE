'use client';

import { cn } from '@/lib/utils';
import { ALL_SPORTS, getSportIcon } from '@/lib/sports-data';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface SportsFilterProps {
  selectedSportId: number | null;
  onSelectSport: (sportId: number | null) => void;
  matchCounts?: Record<number, number>;
  variant?: 'horizontal' | 'dropdown';
}

export function SportsFilter({ 
  selectedSportId, 
  onSelectSport, 
  matchCounts = {},
  variant = 'horizontal'
}: SportsFilterProps) {
  // Show every sport in the horizontal pill row, ordered popular-first.
  // The strip is fully horizontally scrollable, so users can swipe / scroll
  // to discover Esports, Chess, Cycling, etc. without any "show more" toggle.
  const popularSports = ALL_SPORTS.filter(s => s.category === 'popular');
  const otherSports = ALL_SPORTS.filter(s => s.category !== 'popular');
  const displayedSports = [...popularSports, ...otherSports];

  const selectedSport = selectedSportId 
    ? ALL_SPORTS.find(s => s.id === selectedSportId) 
    : null;

  // The dropdown variant still benefits from a separate "Popular" group, so
  // it keeps its own popularSports/otherSports references below.
  void otherSports;

  if (variant === 'dropdown') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            {selectedSport ? (
              <>
                <span className="text-lg">{getSportIcon(selectedSport.slug)}</span>
                <span>{selectedSport.name}</span>
              </>
            ) : (
              <>
                <span className="text-lg">🏆</span>
                <span>All Sports</span>
              </>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
          <DropdownMenuItem 
            onClick={() => onSelectSport(null)}
            className={cn(!selectedSportId && 'bg-accent')}
          >
            <span className="mr-2 text-lg">🏆</span>
            <span>All Sports</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Popular</DropdownMenuLabel>
          {popularSports.map(sport => (
            <DropdownMenuItem 
              key={sport.id}
              onClick={() => onSelectSport(sport.id)}
              className={cn(selectedSportId === sport.id && 'bg-accent')}
            >
              <span className="mr-2 text-lg">{getSportIcon(sport.slug)}</span>
              <span className="flex-1">{sport.name}</span>
              {matchCounts[sport.id] && (
                <span className="text-xs text-muted-foreground">{matchCounts[sport.id]}</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>All Sports</DropdownMenuLabel>
          {otherSports.map(sport => (
            <DropdownMenuItem 
              key={sport.id}
              onClick={() => onSelectSport(sport.id)}
              className={cn(selectedSportId === sport.id && 'bg-accent')}
            >
              <span className="mr-2 text-lg">{getSportIcon(sport.slug)}</span>
              <span className="flex-1">{sport.name}</span>
              {matchCounts[sport.id] && (
                <span className="text-xs text-muted-foreground">{matchCounts[sport.id]}</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="w-full">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-3">
          {/* All Sports */}
          <button
            onClick={() => onSelectSport(null)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
              !selectedSportId 
                ? 'border-primary bg-primary text-primary-foreground' 
                : 'border-border bg-card text-foreground hover:border-primary/50'
            )}
          >
            <span className="text-base">🏆</span>
            <span>All Sports</span>
          </button>

          {/* Sports */}
          {displayedSports.map(sport => (
            <button
              key={sport.id}
              onClick={() => onSelectSport(sport.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
                selectedSportId === sport.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              )}
            >
              <span className="text-base">{getSportIcon(sport.slug)}</span>
              <span>{sport.name}</span>
              {matchCounts[sport.id] && (
                <span className={cn(
                  'rounded-full px-1.5 text-xs',
                  selectedSportId === sport.id ? 'bg-primary-foreground/20' : 'bg-muted'
                )}>
                  {matchCounts[sport.id]}
                </span>
              )}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

// Sport badge for compact display
export function SportBadge({ 
  sportId, 
  size = 'sm' 
}: { 
  sportId: number; 
  size?: 'sm' | 'md' | 'lg';
}) {
  const sport = ALL_SPORTS.find(s => s.id === sportId);
  if (!sport) return null;

  return (
    <div className={cn(
      'flex items-center gap-1 rounded-full bg-muted px-2 py-0.5',
      size === 'lg' && 'px-3 py-1',
      size === 'md' && 'px-2.5 py-0.5'
    )}>
      <span className={cn(
        size === 'sm' && 'text-sm',
        size === 'md' && 'text-base',
        size === 'lg' && 'text-lg'
      )}>
        {getSportIcon(sport.slug)}
      </span>
      <span className={cn(
        'font-medium',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        size === 'lg' && 'text-base'
      )}>
        {sport.name}
      </span>
    </div>
  );
}
