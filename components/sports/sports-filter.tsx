'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ALL_SPORTS, getSportIcon } from '@/lib/sports-data';
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

const VISIBLE_POPULAR_COUNT = 8;

export function SportsFilter({ 
  selectedSportId, 
  onSelectSport, 
  matchCounts = {},
  variant = 'horizontal'
}: SportsFilterProps) {
  const popularSports = ALL_SPORTS.filter(s => s.category === 'popular');
  const otherSports = ALL_SPORTS.filter(s => s.category !== 'popular');

  const selectedSport = selectedSportId 
    ? ALL_SPORTS.find(s => s.id === selectedSportId) 
    : null;

  const visibleSports = popularSports.slice(0, VISIBLE_POPULAR_COUNT);
  const moreSports = [...popularSports.slice(VISIBLE_POPULAR_COUNT), ...otherSports];
  const selectedInMore = selectedSport && !visibleSports.find(s => s.id === selectedSport.id) && selectedSport.id !== null;

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
              {matchCounts[sport.id] ? (
                <span className="text-xs text-muted-foreground">{matchCounts[sport.id]}</span>
              ) : null}
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
              {matchCounts[sport.id] ? (
                <span className="text-xs text-muted-foreground">{matchCounts[sport.id]}</span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5">
        {/* All Sports pill */}
        <button
          onClick={() => onSelectSport(null)}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
            !selectedSportId 
              ? 'border-primary bg-primary text-primary-foreground' 
              : 'border-border bg-card text-foreground hover:border-primary/50'
          )}
        >
          <span className="text-sm">🏆</span>
          <span>All</span>
        </button>

        {/* Visible popular sports */}
        {visibleSports.map(sport => (
          <button
            key={sport.id}
            onClick={() => onSelectSport(sport.id)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
              selectedSportId === sport.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/50'
            )}
          >
            <span className="text-sm">{getSportIcon(sport.slug)}</span>
            <span className="hidden sm:inline">{sport.name}</span>
            <span className="sm:hidden">{sport.name.split(' ')[0]}</span>
            {matchCounts[sport.id] ? (
              <span className={cn(
                'hidden rounded-full px-1 text-[10px] sm:inline-block',
                selectedSportId === sport.id ? 'bg-primary-foreground/20' : 'bg-muted'
              )}>
                {matchCounts[sport.id]}
              </span>
            ) : null}
          </button>
        ))}

        {/* More sports dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                selectedInMore
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              )}
            >
              {selectedInMore ? (
                <>
                  <span className="text-sm">{getSportIcon(selectedSport!.slug)}</span>
                  <span className="hidden sm:inline">{selectedSport!.name}</span>
                </>
              ) : (
                <>
                  <span>More</span>
                </>
              )}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-48 overflow-y-auto">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              More Sports
            </DropdownMenuLabel>
            {moreSports.map(sport => (
              <DropdownMenuItem 
                key={sport.id}
                onClick={() => onSelectSport(sport.id)}
                className={cn('gap-2', selectedSportId === sport.id && 'bg-accent')}
              >
                <span className="text-base leading-none">{getSportIcon(sport.slug)}</span>
                <span className="flex-1 text-sm">{sport.name}</span>
                {matchCounts[sport.id] ? (
                  <span className="text-[11px] text-muted-foreground">{matchCounts[sport.id]}</span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

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
