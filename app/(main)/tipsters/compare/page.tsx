'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, X, Plus, Trophy, TrendingUp, Flame, Users, Target, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { SidebarNew } from '@/components/layout/sidebar-new';
import { cn } from '@/lib/utils';
import { tipsterHref } from '@/lib/utils/slug';

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
  lostTips: number;
  pendingTips: number;
  avgOdds: number;
  streak: number;
  rank: number;
  followers: number;
  isPro: boolean;
  subscriptionPrice: number | null;
  verified: boolean;
  countryCode: string | null;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());
const MAX_COMPARE = 4;

function ComparePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const idsParam = params.get('ids') || '';
  const initialIds = idsParam.split(',').map(s => Number(s.trim())).filter(Boolean);

  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Sync URL when selection changes
  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    if (selectedIds.length > 0) next.set('ids', selectedIds.join(','));
    else next.delete('ids');
    router.replace(`/tipsters/compare?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const { data: tipsterList, isLoading: loadingList } = useSWR<{ tipsters: Tipster[] }>(
    `/api/tipsters?limit=500`, fetcher,
  );
  const all = tipsterList?.tipsters ?? [];
  const selected: Tipster[] = useMemo(
    () => selectedIds.map(id => all.find(t => t.id === id)).filter(Boolean) as Tipster[],
    [selectedIds, all],
  );

  function add(id: number) {
    setSelectedIds(prev => prev.includes(id) || prev.length >= MAX_COMPARE ? prev : [...prev, id]);
    setSearch('');
    setPickerOpen(false);
  }
  function remove(id: number) { setSelectedIds(prev => prev.filter(x => x !== id)); }

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter(t => !selectedIds.includes(t.id))
      .filter(t => !q || t.username.toLowerCase().includes(q) || (t.displayName || '').toLowerCase().includes(q))
      .slice(0, 60);
  }, [all, selectedIds, search]);

  // Per-metric winners
  const best = useMemo(() => {
    if (selected.length < 2) return {} as Record<string, number>;
    const max = (key: keyof Tipster) =>
      selected.reduce((b, t) => ((t[key] as number) > (b[key] as number) ? t : b), selected[0]).id;
    return {
      winRate: max('winRate'),
      roi: max('roi'),
      totalTips: max('totalTips'),
      streak: max('streak'),
      followers: max('followers'),
      avgOdds: max('avgOdds'),
    };
  }, [selected]);

  return (
    <div className="flex">
      <SidebarNew />
      <div className="flex-1 overflow-hidden">
        <div className="px-3 py-2.5 pb-24">
          <Button variant="ghost" size="sm" asChild className="mb-2 h-7 text-xs">
            <Link href="/tipsters"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back to tipsters</Link>
          </Button>

          <div className="mb-4">
            <h1 className="text-lg font-bold">Compare tipsters</h1>
            <p className="text-xs text-muted-foreground">
              Pick up to {MAX_COMPARE} tipsters to compare side-by-side. Best value in each row is highlighted.
            </p>
          </div>

          {loadingList ? (
            <div className="flex h-64 items-center justify-center"><Spinner className="h-6 w-6" /></div>
          ) : (
            <>
              {/* Slot row */}
              <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {Array.from({ length: MAX_COMPARE }).map((_, idx) => {
                  const t = selected[idx];
                  if (t) {
                    return (
                      <div key={t.id} className="relative rounded-lg border border-border bg-card p-2.5">
                        <button onClick={() => remove(t.id)}
                          className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted">
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <Link href={tipsterHref(t.username || t.displayName, t.username || t.id)} className="flex flex-col items-center text-center">
                          {t.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.avatar} alt="" className="h-10 w-10 rounded-full bg-muted" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                              {t.displayName.charAt(0)}
                            </div>
                          )}
                          <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold">
                            {t.displayName}
                            {t.verified && <Check className="h-3 w-3 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground">@{t.username}</div>
                          {t.isPro && <Badge className="mt-1 h-3.5 bg-primary px-1 text-[8px]">PRO</Badge>}
                        </Link>
                      </div>
                    );
                  }
                  return (
                    <button key={`slot-${idx}`}
                      onClick={() => setPickerOpen(true)}
                      className="flex h-[110px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Plus className="mb-0.5 h-5 w-5" />
                      <span className="text-[10px]">Add tipster</span>
                    </button>
                  );
                })}
              </div>

              {/* Comparison table */}
              {selected.length >= 2 ? (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Performance comparison</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto -mx-3 px-3">
                      <table className="w-full min-w-[500px] text-xs">
                        <thead>
                          <tr className="border-b text-[11px] uppercase text-muted-foreground">
                            <th className="py-1.5 text-left font-medium">Metric</th>
                            {selected.map(t => (
                              <th key={t.id} className="py-1.5 text-center font-medium">{t.displayName.split(' ')[0]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <Row label="Win rate" icon={Trophy} fmt={(v) => `${v}%`} values={selected.map(t => ({ id: t.id, v: t.winRate }))} bestId={best.winRate} />
                          <Row label="ROI" icon={TrendingUp} fmt={(v) => `+${v}%`} values={selected.map(t => ({ id: t.id, v: t.roi }))} bestId={best.roi} />
                          <Row label="Total tips" icon={Target} fmt={(v) => v.toLocaleString()} values={selected.map(t => ({ id: t.id, v: t.totalTips }))} bestId={best.totalTips} />
                          <Row label="Win streak" icon={Flame} fmt={(v) => `${v}`} values={selected.map(t => ({ id: t.id, v: t.streak }))} bestId={best.streak} />
                          <Row label="Followers" icon={Users} fmt={(v) => v.toLocaleString()} values={selected.map(t => ({ id: t.id, v: t.followers }))} bestId={best.followers} />
                          <Row label="Avg odds" icon={Target} fmt={(v) => v.toFixed(2)} values={selected.map(t => ({ id: t.id, v: t.avgOdds }))} bestId={best.avgOdds} />
                          <tr className="border-b">
                            <td className="py-1.5 text-muted-foreground text-[11px] uppercase tracking-wider">Won / Lost / Pending</td>
                            {selected.map(t => (
                              <td key={t.id} className="py-1.5 text-center text-[10px] font-medium">
                                <span className="text-success">{t.wonTips}</span> / <span className="text-destructive">{t.lostTips}</span> / <span className="text-warning">{t.pendingTips}</span>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-1.5 text-muted-foreground text-[11px] uppercase tracking-wider">Subscription</td>
                            {selected.map(t => (
                              <td key={t.id} className="py-1.5 text-center">
                                {t.isPro && t.subscriptionPrice
                                  ? <span className="text-[10px] font-medium">KES {t.subscriptionPrice}/mo</span>
                                  : <span className="text-[10px] text-muted-foreground">Free</span>}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
                  Pick at least 2 tipsters to see a side-by-side comparison.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
             onClick={() => setPickerOpen(false)}>
          <div className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-2.5">
              <span className="text-xs font-semibold">Add a tipster</span>
              <button onClick={() => setPickerOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus placeholder="Search..." value={search}
                       onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">No matches.</div>
              ) : candidates.map(t => (
                <button key={t.id} onClick={() => add(t.id)}
                        className="flex w-full items-center gap-2.5 border-b border-border p-2 text-left hover:bg-muted">
                  {t.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatar} alt="" className="h-8 w-8 rounded-full bg-muted" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {t.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[11px] font-semibold">
                      {t.displayName}
                      {t.verified && <Check className="h-3 w-3 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground">@{t.username} · {t.winRate}% · ROI +{t.roi}%</div>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, icon: Icon, fmt, values, bestId }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  fmt: (v: number) => string;
  values: { id: number; v: number }[];
  bestId?: number;
}) {
  return (
    <tr className="border-b">
      <td className="py-2 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Icon className="h-3 w-3" />{label}</span>
      </td>
      {values.map(({ id, v }) => (
        <td key={id} className={cn(
          'py-2 text-center font-semibold',
          id === bestId && 'text-success',
        )}>
          {fmt(v)}
          {id === bestId && <span className="ml-1 text-[10px] uppercase text-success">best</span>}
        </td>
      ))}
    </tr>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex-1 p-8 text-center"><Spinner className="mx-auto h-8 w-8" /></div>}>
      <ComparePageInner />
    </Suspense>
  );
}
