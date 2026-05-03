'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Radio, Trophy, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: boolean;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/live', label: 'Live', icon: Radio, badge: true },
  { href: '/matches', label: 'Matches', icon: Calendar },
  { href: '/feed', label: 'Feed', icon: MessageCircle },
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function BottomNav() {
  const pathname = usePathname();
  
  // Fetch live match count from the live-only endpoint (separate SWR key so it
  // doesn't conflict with the array-typed cache used by useLiveMatches / useMatchStats).
  const { data } = useSWR<{ stats?: { live?: number }; matches?: Array<{ status: string }> }>(
    '/api/matches?status=live',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );

  // Prefer the server-computed stats count; fall back to counting returned matches.
  const liveStatuses = new Set(['live', 'halftime', 'extra_time', 'penalties']);
  const liveCount =
    data?.stats?.live ??
    (data?.matches?.filter(m => liveStatuses.has(m.status)).length ?? 0);

  // Don't show on admin pages or auth pages
  if (pathname.startsWith('/admin') || pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-safe md:hidden">
      <div className="grid h-12 grid-cols-5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                {item.badge && liveCount > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {liveCount > 99 ? '99+' : liveCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
