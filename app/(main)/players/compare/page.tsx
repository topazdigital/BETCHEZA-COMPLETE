'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, Search, X, Plus, Minus, Equal } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { playerHref } from '@/lib/utils/slug';

interface PlayerProfile {
  id: string;
  name: string;
  position?: string;
  jersey?: string;
  team?: { id?: string; name?: string; logo?: string } | null;
  height?: string;
  weight?: string;
  age?: number;
  nationality?: string;
  experienceYears?: number;
  headshot?: string;
  stats?: unknown;
}

interface StatRow {
  name?: string;
  displayName?: string;
  displayValue?: string;
  value?: number;
}
interface StatCategory {
  name?: string;
  displayName?: string;
  stats?: StatRow[];
}
interface AthleteStats {
  splits?: { categories?: StatCategory[] };
  categories?: StatCategory[];
}

interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  logoUrl?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r)));

function extractCategories(stats: unknown): StatCategory[] {
  if (!stats || typeof stats !== 'object') return [];
  const s = stats as AthleteStats;
  return s.splits?.categories || s.categories || [];
}

function flattenStats(cats: StatCategory[]): Map<string, { value: number | null; display: string; category: string }> {
  const map = new Map<string, { value: number | null; display: string; category: string }>();
  for (const cat of cats) {
    const catName = cat.displayName || cat.name || '';
    for (const s of cat.stats || []) {
      const label = s.displayName || s.name;
      if (!label) continue;
      const numeric = typeof s.value === 'number' ? s.value : null;
      map.set(label, {
        value: numeric,
        display: s.displayValue ?? (numeric != null ? String(numeric) : '—'),
        category: catName,
      });
    }
  }
  return map;
}

function PlayerComparePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const a = params.get('a') || '';
  const b = params.get('b') || '';

  const { data: pa, isLoading: la, error: ea } = useSWR<PlayerProfile>(a ? `/api/players/${a}` : null, fetcher);
  const { data: pb, isLoading: lb, error: eb } = useSWR<PlayerProfile>(b ? `/api/players/${b}` : null, fetcher);

  const aMap = useMemo(() => flattenStats(extractCategories(pa?.stats)), [pa]);
  const bMap = useMemo(() => flattenStats(extractCategories(pb?.stats)), [pb]);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    aMap.forEach((_v, k) => set.add(k));
    bMap.forEach((_v, k) => set.add(k));
    return Array.from(set);
  }, [aMap, bMap]);

  const grouped = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const label of allLabels) {
      const cat = aMap.get(label)?.category || bMap.get(label)?.category || 'Other';
      if (!g.has(cat)) g.set(cat, []);
      g.get(cat)!.push(label);
    }
    return Array.from(g.entries());
  }, [allLabels, aMap, bMap]);

  function setSlot(slot: 'a' | 'b', id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set(slot, id);
    else next.delete(slot);
    router.push(`/players/compare?${next.toString()}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-4">
      <Link
        href="/matches"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back
      </Link>

      <h1 className="mb-4 text-lg font-bold tracking-tight">Compare players</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerSlot
          slot="A"
          player={pa}
          loading={la}
          error={!!ea}
          onPick={(id) => setSlot('a', id)}
          onClear={() => setSlot('a', null)}
        />
        <PlayerSlot
          slot="B"
          player={pb}
          loading={lb}
          error={!!eb}
          onPick={(id) => setSlot('b', id)}
          onClear={() => setSlot('b', null)}
        />
      </div>

      {pa && pb && (
        <div className="mt-6 space-y-4">
          {/* Vital stats */}
          <section className="rounded-xl border border-border bg-card p-3">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Profile</h2>
            <CompareTable
              rows={[
                { label: 'Position', a: pa.position, b: pb.position },
                { label: 'Team', a: pa.team?.name, b: pb.team?.name },
                { label: 'Age', a: pa.age, b: pb.age, higherBetter: false, numeric: true },
                { label: 'Height', a: pa.height, b: pb.height },
                { label: 'Weight', a: pa.weight, b: pb.weight },
                { label: 'Nationality', a: pa.nationality, b: pb.nationality },
                { label: 'Experience (yrs)', a: pa.experienceYears, b: pb.experienceYears, higherBetter: true, numeric: true },
              ]}
            />
          </section>

          {/* Stats by category */}
          {grouped.map(([cat, labels]) => (
            <section key={cat} className="rounded-xl border border-border bg-card p-3">
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{cat}</h2>
              <CompareTable
                rows={labels.map((label) => {
                  const ra = aMap.get(label);
                  const rb = bMap.get(label);
                  return {
                    label,
                    a: ra?.display ?? '—',
                    b: rb?.display ?? '—',
                    aNum: ra?.value,
                    bNum: rb?.value,
                    numeric: ra?.value != null || rb?.value != null,
                    higherBetter: true,
                  };
                })}
              />
            </section>
          ))}

          {grouped.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
              No detailed stats available to compare.
            </div>
          )}
        </div>
      )}

      {(!a || !b) && (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
          Pick two players above to see a side-by-side comparison.
        </p>
      )}
    </div>
  );
}

interface CompareRow {
  label: string;
  a?: string | number | null;
  b?: string | number | null;
  aNum?: number | null;
  bNum?: number | null;
  numeric?: boolean;
  higherBetter?: boolean;
}

function CompareTable({ rows }: { rows: CompareRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => {
            const aN = r.aNum ?? (typeof r.a === 'number' ? r.a : null);
            const bN = r.bNum ?? (typeof r.b === 'number' ? r.b : null);
            let aWin = false;
            let bWin = false;
            let tie = false;
            if (r.numeric && aN != null && bN != null && r.higherBetter !== undefined) {
              if (aN === bN) tie = true;
              else if (r.higherBetter) {
                if (aN > bN) aWin = true; else bWin = true;
              } else {
                if (aN < bN) aWin = true; else bWin = true;
              }
            }
            return (
              <tr key={i} className="border-t border-border first:border-t-0">
                <td className={cn(
                  'w-2/5 px-3 py-2 text-right tabular-nums',
                  aWin && 'bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-400',
                  bWin && 'text-muted-foreground',
                )}>
                  {r.a ?? '—'}
                  {aWin && <Plus className="ml-1 inline h-3 w-3" />}
                </td>
                <td className="w-1/5 bg-muted/30 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                  {tie && <Equal className="mx-auto h-3 w-3" />}
                  {!tie && r.label}
                  {tie && <span className="block text-[10px]">{r.label}</span>}
                </td>
                <td className={cn(
                  'w-2/5 px-3 py-2 text-left tabular-nums',
                  bWin && 'bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-400',
                  aWin && 'text-muted-foreground',
                )}>
                  {bWin && <Plus className="mr-1 inline h-3 w-3" />}
                  {r.b ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerSlot({
  slot,
  player,
  loading,
  error,
  onPick,
  onClear,
}: {
  slot: 'A' | 'B';
  player?: PlayerProfile;
  loading: boolean;
  error: boolean;
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-card">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-4 text-center text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
        Could not load player {slot}. <button onClick={onClear} className="underline">Pick a different one</button>
      </div>
    );
  }

  if (!player) {
    return <PlayerPicker slot={slot} onPick={onPick} />;
  }

  return (
    <div className="relative rounded-2xl border border-border bg-card p-4">
      <button
        onClick={onClear}
        className="absolute right-3 top-3 rounded-full bg-muted p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
        aria-label={`Remove player ${slot}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center gap-3">
        {player.headshot ? (
          <Image
            src={player.headshot}
            alt={player.name}
            width={64}
            height={64}
            className="h-16 w-16 rounded-xl border border-border bg-muted object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {player.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Player {slot}</div>
          <Link href={playerHref(player.name, player.id)} className="block truncate text-base font-bold hover:text-primary">
            {player.name}
          </Link>
          <div className="truncate text-xs text-muted-foreground">
            {[player.position, player.team?.name].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlayerSearchHit {
  id: string;
  name: string;
  position?: string;
  team?: string;
  teamLogo?: string;
  headshot?: string;
  href: string;
}

function PlayerPicker({ slot, onPick }: { slot: 'A' | 'B'; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  // Hit our dedicated player-search endpoint so the picker only ever returns
  // athletes — never teams or leagues. Previously the unified /api/search
  // route surfaced team hits, which made it impossible to actually pick a
  // player from the dropdown.
  const { data, isLoading } = useSWR<{ hits: PlayerSearchHit[] }>(
    q.trim().length >= 2 ? `/api/players/search?q=${encodeURIComponent(q.trim())}&limit=10` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300 },
  );
  const numericId = /^\d+$/.test(q.trim()) ? q.trim() : null;

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Player {slot}</div>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by player name (e.g. Mbappé, Haaland)…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {numericId && (
        <button
          onClick={() => onPick(numericId)}
          className="mt-3 w-full rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          Use player ID “{numericId}”
        </button>
      )}

      {(data?.hits?.length ?? 0) > 0 && (
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {data!.hits.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => onPick(h.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              >
                {h.headshot ? (
                  <Image
                    src={h.headshot}
                    alt={h.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover bg-muted"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {h.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{h.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {[h.position, h.team].filter(Boolean).join(' · ') || 'Player'}
                  </div>
                </div>
                {h.teamLogo && (
                  <Image src={h.teamLogo} alt="" width={20} height={20} className="h-5 w-5 object-contain" unoptimized />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.trim().length >= 2 && !isLoading && (data?.hits?.length ?? 0) === 0 && !numericId && (
        <p className="mt-3 text-xs text-muted-foreground">
          No players match “{q.trim()}”. Try a full name (e.g. “Kylian Mbappé”).
        </p>
      )}

      {q.trim().length < 2 && (
        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" /> Type at least 2 characters
        </p>
      )}
    </div>
  );
}
export default function PlayerComparePage() {
  return (
    <Suspense fallback={null}>
      <PlayerComparePageInner />
    </Suspense>
  );
}
