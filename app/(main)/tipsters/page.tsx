'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Search, Filter, Trophy, TrendingUp, Flame, Users, Star, Check,
  GitCompare, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SidebarNew } from '@/components/layout/sidebar-new';
import { FollowTipsterButton } from '@/components/tipsters/follow-tipster-button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { tipsterHref } from '@/lib/utils/slug';

// ───────────────────── types & helpers ─────────────────────
interface Tipster {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  winRate: number;
  roi: number;
  totalTips: number;
  wonTips: number;
  streak: number;
  rank: number;
  followers: number;
  isPro: boolean;
  subscriptionPrice: number | null;
  verified: boolean;
  countryCode: string | null;
}

const sortOptions = [
  { value: 'rank', label: 'Top ranked' },
  { value: 'winRate', label: 'Win rate' },
  { value: 'roi', label: 'ROI' },
  { value: 'followers', label: 'Followers' },
  { value: 'streak', label: 'Hot streak' },
  { value: 'totalTips', label: 'Most tips' },
];

const filterOptions = [
  { value: 'all', label: 'All tipsters' },
  { value: 'pro', label: 'Pro only' },
  { value: 'free', label: 'Free only' },
  { value: 'verified', label: 'Verified' },
];

const PAGE_SIZE = 24;
const fetcher = (url: string) => fetch(url).then(r => r.json());

function flagFor(code: string | null) {
  if (!code) return '';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(127397 + c.charCodeAt(0)),
  );
}

export default function TipstersPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rank');
  const [filterBy, setFilterBy] = useState('all');
  const [page, setPage] = useState(0);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const params = new URLSearchParams({
    sortBy,
    filter: filterBy === 'all' ? '' : filterBy,
    search,
    limit: '500',
  });
  const { data, isLoading } = useSWR<{
    tipsters: Tipster[];
    stats: { totalTipsters: number; proTipsters: number; avgWinRate: number; totalTips: number };
  }>(`/api/tipsters?${params.toString()}`, fetcher);

  const allTipsters = data?.tipsters ?? [];
  const stats = data?.stats ?? { totalTipsters: 0, proTipsters: 0, avgWinRate: 0, totalTips: 0 };

  const visible = useMemo(
    () => allTipsters.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [allTipsters, page],
  );
  const totalPages = Math.max(1, Math.ceil(allTipsters.length / PAGE_SIZE));

  function toggleCompare(id: number) {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 4 ? prev : [...prev, id],
    );
  }
  const compareHref = compareIds.length >= 2
    ? `/tipsters/compare?ids=${compareIds.join(',')}`
    : null;

  return (
    <div className="flex">
      <SidebarNew />
      <div className="flex-1 overflow-hidden">
        <div className="px-3 py-2.5 pb-24">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-foreground">Tipsters</h1>
              <p className="text-xs text-muted-foreground">
                Browse and follow expert tipsters from across Africa
              </p>
            </div>
            <Button variant="outline" size="sm" h-7 className="text-xs" asChild>
              <Link href="/tipsters/compare">
                <GitCompare className="mr-1.5 h-3.5 w-3.5" />
                Compare tipsters
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-2 text-center">
              <Users className="mx-auto h-3.5 w-3.5 text-primary" />
              <div className="mt-0.5 text-xl font-bold">{stats.totalTipsters}</div>
              <div className="text-[11px] uppercase text-muted-foreground">Active tipsters</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2 text-center">
              <Trophy className="mx-auto h-3.5 w-3.5 text-warning" />
              <div className="mt-0.5 text-xl font-bold">{stats.proTipsters}</div>
              <div className="text-[11px] uppercase text-muted-foreground">Pro tipsters</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2 text-center">
              <TrendingUp className="mx-auto h-3.5 w-3.5 text-success" />
              <div className="mt-0.5 text-xl font-bold">{stats.avgWinRate}%</div>
              <div className="text-[11px] uppercase text-muted-foreground">Avg win rate</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2 text-center">
              <Flame className="mx-auto h-3.5 w-3.5 text-live" />
              <div className="mt-0.5 text-xl font-bold">{stats.totalTips.toLocaleString()}</div>
              <div className="text-[11px] uppercase text-muted-foreground">Total tips</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or @handle..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={filterBy} onValueChange={(v) => { setFilterBy(v); setPage(0); }}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sortOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Result count + pager */}
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground uppercase tracking-wider">
            <span>{allTipsters.length} tipster{allTipsters.length !== 1 ? 's' : ''} found</span>
            <span>Page {page + 1} of {totalPages}</span>
          </div>

          {/* List / loader */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
              No tipsters match those filters yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((tipster, idx) => {
                const checked = compareIds.includes(tipster.id);
                const globalRank = page * PAGE_SIZE + idx + 1;
                return (
                  <div
                    key={tipster.id}
                    className={cn(
                      'group relative rounded-lg border bg-card p-3 transition-all hover:shadow-md',
                      checked ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40',
                    )}
                  >
                    {/* Compare checkbox */}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); toggleCompare(tipster.id); }}
                      className={cn(
                        'absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-[10px]',
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary',
                      )}
                      title={checked ? 'Remove from compare' : 'Add to compare'}
                    >
                      <GitCompare className="h-3 w-3" />
                    </button>

                    <Link href={tipsterHref(tipster.username || tipster.displayName, tipster.username || tipster.id)} className="block">
                      <div className="flex items-start gap-2.5 pr-6">
                        <div className="relative shrink-0">
                          {tipster.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tipster.avatar} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                              {tipster.displayName.charAt(0)}
                            </div>
                          )}
                          {globalRank <= 3 && (
                            <div className={cn(
                              'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                              globalRank === 1 && 'bg-yellow-500 text-yellow-950',
                              globalRank === 2 && 'bg-gray-300 text-gray-700',
                              globalRank === 3 && 'bg-amber-700 text-amber-100',
                            )}>{globalRank}</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-xs font-semibold group-hover:text-primary">
                              {tipster.displayName}
                            </span>
                            {tipster.verified && (
                              <Check className="h-3 w-3 shrink-0 rounded-full bg-primary p-0.5 text-primary-foreground" />
                            )}
                            {tipster.isPro && (
                              <Badge className="ml-auto h-3.5 bg-gradient-to-r from-primary to-primary/80 px-1 text-[8px]">
                                <Star className="mr-0.5 h-2 w-2" />PRO
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            <span className="mr-1">{flagFor(tipster.countryCode)}</span>
                            @{tipster.username}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground/80">
                            {tipster.bio}
                          </p>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="mt-2.5 grid grid-cols-4 gap-1 text-center">
                        <div className="rounded-md bg-success/10 px-0.5 py-1">
                          <div className="text-xs font-bold text-success">{tipster.winRate}%</div>
                          <div className="text-[9px] uppercase text-muted-foreground">Win</div>
                        </div>
                        <div className="rounded-md bg-primary/10 px-0.5 py-1">
                          <div className="text-xs font-bold text-primary">+{tipster.roi}%</div>
                          <div className="text-[9px] uppercase text-muted-foreground">ROI</div>
                        </div>
                        <div className="rounded-md bg-warning/10 px-0.5 py-1">
                          <div className="flex items-center justify-center gap-0.5 text-xs font-bold text-warning">
                            {tipster.streak > 2 && <Flame className="h-2.5 w-2.5" />}
                            {tipster.streak}
                          </div>
                          <div className="text-[9px] uppercase text-muted-foreground">Streak</div>
                        </div>
                        <div className="rounded-md bg-muted px-0.5 py-1">
                          <div className="text-xs font-bold">{tipster.totalTips}</div>
                          <div className="text-[9px] uppercase text-muted-foreground">Tips</div>
                        </div>
                      </div>
                    </Link>

                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                        <Users className="h-3 w-3" />
                        {tipster.followers.toLocaleString()}
                      </span>
                      <FollowTipsterButton
                        tipsterId={tipster.id}
                        tipsterName={tipster.displayName}
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Compare floating bar */}
        {compareIds.length > 0 && (
          <div className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-lg md:bottom-6">
            <span className="text-xs font-medium">{compareIds.length} selected</span>
            <Button size="sm" variant="ghost" onClick={() => setCompareIds([])} className="h-6 px-2 text-[10px]">
              Clear
            </Button>
            <Button size="sm" className="h-7 text-xs" disabled={!compareHref} asChild={!!compareHref}>
              {compareHref ? <Link href={compareHref}><GitCompare className="mr-1 h-3 w-3" />Compare</Link>
                           : <span><GitCompare className="mr-1 h-3 w-3" />Pick 2+</span>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
