'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Trophy, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorldCupOddsEntry {
  team: string;
  price: number;
  bookmaker: string;
}

interface ApiResponse {
  success: boolean;
  outcomes: WorldCupOddsEntry[];
  total: number;
}

const FLAG_MAP: Record<string, string> = {
  'Brazil': '🇧🇷', 'France': '🇫🇷', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Spain': '🇪🇸',
  'Argentina': '🇦🇷', 'Germany': '🇩🇪', 'Portugal': '🇵🇹', 'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪', 'Uruguay': '🇺🇾', 'Italy': '🇮🇹', 'Croatia': '🇭🇷',
  'Mexico': '🇲🇽', 'USA': '🇺🇸', 'United States': '🇺🇸', 'Japan': '🇯🇵',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨',
  'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Canada': '🇨🇦', 'Australia': '🇦🇺',
  'South Korea': '🇰🇷', 'Iran': '🇮🇷', 'Serbia': '🇷🇸', 'Switzerland': '🇨🇭',
  'Denmark': '🇩🇰', 'Poland': '🇵🇱', 'Qatar': '🇶🇦', 'Saudi Arabia': '🇸🇦',
  'Nigeria': '🇳🇬', 'Ghana': '🇬🇭', 'Cameroon': '🇨🇲', 'Algeria': '🇩🇿',
  'Turkey': '🇹🇷', 'Austria': '🇦🇹', 'Ukraine': '🇺🇦', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Czech Republic': '🇨🇿', 'Hungary': '🇭🇺',
  'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳', 'Panama': '🇵🇦', 'Jamaica': '🇯🇲',
};

function getFlag(team: string): string {
  for (const [name, flag] of Object.entries(FLAG_MAP)) {
    if (team.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(team.toLowerCase())) {
      return flag;
    }
  }
  return '🏳';
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

// World Cup 2026 kick-off: June 11, 2026 20:00 UTC
const WC_KICKOFF = new Date('2026-06-11T20:00:00Z');

function useCountdown() {
  const now = Date.now();
  const diff = WC_KICKOFF.getTime() - now;
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours };
}

export function WorldCupOddsCard() {
  const { data, isLoading } = useSWR<ApiResponse>('/api/outrights/worldcup', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });

  const countdown = useCountdown();
  const outcomes = data?.outcomes ?? [];
  const top8 = useMemo(() => outcomes.slice(0, 8), [outcomes]);
  const favourite = top8[0];
  const bookmaker = favourite?.bookmaker ?? '';

  return (
    <section className="mb-4">
      <Link
        href="/specials"
        className="group block rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/10 via-yellow-500/5 to-transparent overflow-hidden transition-all hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/5"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground">FIFA World Cup 2026</span>
                {countdown && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0 text-[9px] font-bold text-emerald-600 border border-emerald-400/30 animate-pulse">
                    {countdown.days}d {countdown.hours}h
                  </span>
                )}
                {!countdown && (
                  <span className="inline-flex items-center rounded-full bg-live/15 px-1.5 py-0 text-[9px] font-bold text-live border border-live/30">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Winner odds · 48 nations · USA, Canada & Mexico
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors shrink-0">
            <TrendingUp className="h-3 w-3" />
            <span>Full odds</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>

        {/* Odds grid */}
        {isLoading ? (
          <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : top8.length > 0 ? (
          <>
            <div className="px-3 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {top8.map((team, i) => (
                <div
                  key={team.team}
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 transition-colors',
                    i === 0
                      ? 'bg-emerald-500/15 border border-emerald-400/30'
                      : 'bg-muted/30 border border-border/50',
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{getFlag(team.team)}</span>
                    <span className="text-[11px] font-medium text-foreground truncate">
                      {team.team}
                    </span>
                  </div>
                  <span className={cn(
                    'shrink-0 text-[11px] font-bold tabular-nums',
                    i === 0 ? 'text-emerald-600' : 'text-primary',
                  )}>
                    {team.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {bookmaker && (
              <div className="px-3 pb-2.5 text-[9px] text-muted-foreground text-right">
                Odds via {bookmaker} · Tap for full markets →
              </div>
            )}
          </>
        ) : (
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between rounded-lg border border-dashed border-emerald-400/30 bg-emerald-500/5 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {countdown
                    ? `Kicks off in ${countdown.days} day${countdown.days !== 1 ? 's' : ''}`
                    : 'Tournament underway'}
                </span>
                {' '}— live winner odds coming soon from bookmakers.
              </p>
              <Trophy className="h-5 w-5 shrink-0 text-emerald-500/50" />
            </div>
          </div>
        )}
      </Link>
    </section>
  );
}
