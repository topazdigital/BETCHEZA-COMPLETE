'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Trophy, Calendar, Star, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STATIC_SPORTS = [
  { id: 1, name: 'Football', slug: 'football' },
  { id: 2, name: 'Basketball', slug: 'basketball' },
  { id: 3, name: 'Tennis', slug: 'tennis' },
  { id: 4, name: 'Rugby', slug: 'rugby' },
  { id: 5, name: 'Cricket', slug: 'cricket' },
];

const STATIC_LEAGUES = [
  { id: 1, name: 'Premier League', slug: 'premier-league' },
  { id: 2, name: 'La Liga', slug: 'la-liga' },
  { id: 3, name: 'Champions League', slug: 'champions-league' },
  { id: 4, name: 'Bundesliga', slug: 'bundesliga' },
  { id: 5, name: 'Serie A', slug: 'serie-a' },
  { id: 6, name: 'Ligue 1', slug: 'ligue-1' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: bookmakersData } = useSWR('/api/bookmakers', fetcher);
  const bookmakers = bookmakersData?.bookmakers ?? [];

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-none p-4">
        {/* Sports Filter */}
        <div className="mb-6">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sports
          </h3>
          <nav className="space-y-1">
            {STATIC_SPORTS.map((sport) => (
              <Link
                key={sport.id}
                href={`/matches?sport=${sport.slug}`}
                className={cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                  pathname.includes(`sport=${sport.slug}`)
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <span>{sport.name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </nav>
        </div>

        {/* Top Leagues */}
        <div className="mb-6">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top Leagues
          </h3>
          <nav className="space-y-1">
            {STATIC_LEAGUES.map((league) => (
              <Link
                key={league.id}
                href={`/matches?league=${league.slug}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  pathname.includes(`league=${league.slug}`)
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs">
                  {league.name.charAt(0)}
                </div>
                <span className="truncate">{league.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Quick Links */}
        <div className="mb-6">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Links
          </h3>
          <nav className="space-y-1">
            <Link
              href="/results"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Results</span>
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span>Leaderboard</span>
            </Link>
            <Link
              href="/competitions"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Star className="h-4 w-4 text-muted-foreground" />
              <span>Competitions</span>
            </Link>
            <Link
              href="/bookmakers"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>Bookmakers</span>
            </Link>
          </nav>
        </div>

        {/* Featured Bookmakers */}
        {bookmakers.length > 0 && (
          <div>
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Bookmakers
            </h3>
            <div className="space-y-2">
              {bookmakers.slice(0, 4).map((bookmaker: { id: number; slug: string; name: string; logoUrl?: string; logo?: string }) => (
                <a
                  key={bookmaker.id}
                  href={`/api/r/bookmaker/${encodeURIComponent(bookmaker.slug)}?placement=sidebar`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-bold">
                    {bookmaker.name.charAt(0)}
                  </div>
                  <span className="font-medium">{bookmaker.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
