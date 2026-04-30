'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, X, Trophy, Users, Calendar, UserCheck, Loader2, Radio,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TeamLogo, LeagueLogo } from '@/components/ui/team-logo';
import { cn } from '@/lib/utils';

// Header search with debounced typeahead — matches the API contract in
// /app/api/search/route.ts. Designed to feel snappy, fail quietly, and stay
// keyboard-friendly (↑/↓ to navigate, Enter to open, Esc to close).
type SearchHit =
  | { type: 'league'; id: string; title: string; subtitle: string; href: string; logoUrl?: string; sportSlug?: string }
  | { type: 'team'; id: string; title: string; subtitle: string; href: string; logoUrl?: string; sportSlug?: string }
  | { type: 'match'; id: string; title: string; subtitle: string; href: string; status: string; kickoffIso?: string }
  | { type: 'tipster'; id: string; title: string; subtitle: string; href: string; avatar?: string | null; verified?: boolean };

const KIND_META = {
  match: { label: 'Matches', icon: Calendar },
  league: { label: 'Leagues', icon: Trophy },
  team: { label: 'Teams', icon: Users },
  tipster: { label: 'Tipsters', icon: UserCheck },
} as const;

const KIND_ORDER: Array<keyof typeof KIND_META> = ['match', 'league', 'team', 'tipster'];

interface HeaderSearchProps {
  /** When true, render an always-visible full-width input (used in the
   *  page header). When false (default), render a magnifier icon-button
   *  that expands into the search input on click. */
  inline?: boolean;
  /** Additional className applied to the outer wrapper. */
  className?: string;
  /** Custom placeholder shown in the input. */
  placeholder?: string;
}

export function HeaderSearch({ inline = false, className, placeholder }: HeaderSearchProps = {}) {
  const router = useRouter();
  // In inline mode the input is always shown — `open` controls whether
  // the dropdown is visible (mirrors a focused/blurred state).
  const [open, setOpen] = useState(inline);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Debounced fetch — 200ms is the sweet spot for typeahead: feels live but
  // doesn't fire a request on every keystroke.
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=5`, { signal: ctrl.signal });
        if (!r.ok) throw new Error('bad response');
        const data = (await r.json()) as { hits: SearchHit[] };
        setHits(data.hits || []);
        setActiveIdx(0);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, open]);

  // Show dropdown control: in inline mode the input stays mounted, but we
  // hide the dropdown when the user clicks away or hits Escape.
  const [showDropdown, setShowDropdown] = useState(false);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open && !inline) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        if (inline) {
          setShowDropdown(false);
        } else {
          close();
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inline) {
          setShowDropdown(false);
          inputRef.current?.blur();
        } else {
          close();
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, inline]);

  const close = () => {
    if (inline) {
      // Inline mode never collapses — just clear the dropdown state.
      setQ('');
      setHits([]);
      setActiveIdx(0);
      setShowDropdown(false);
      return;
    }
    setOpen(false);
    setQ('');
    setHits([]);
    setActiveIdx(0);
  };

  const go = (hit: SearchHit) => {
    close();
    router.push(hit.href);
  };

  // Group hits by kind so we can render them with section headers, while
  // still respecting flat keyboard navigation order.
  const grouped: Record<string, SearchHit[]> = {};
  for (const kind of KIND_ORDER) grouped[kind] = [];
  for (const h of hits) grouped[h.type].push(h);
  const flatOrdered: SearchHit[] = KIND_ORDER.flatMap(k => grouped[k]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(flatOrdered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const h = flatOrdered[activeIdx];
      if (h) go(h);
    }
  };

  // Whether to actually paint the dropdown right now.
  const dropdownVisible =
    q.trim().length >= 2 && (inline ? showDropdown : true);

  // Inline mode: full-width input, dropdown spans the input width and is
  // anchored under it — used by /(main) and /admin headers.
  if (inline) {
    return (
      <div ref={wrapRef} className={cn('relative', className)}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="search"
            placeholder={placeholder ?? 'Search matches, teams, tipsters…'}
            className="pl-9"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={onKeyDown}
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setHits([]);
                setActiveIdx(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {dropdownVisible && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[28rem] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
            <SearchDropdown
              loading={loading}
              hits={hits}
              q={q}
              grouped={grouped}
              flatOrdered={flatOrdered}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
              go={go}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      {!open ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open search"
          onClick={() => {
            setOpen(true);
            // Defer focus until the input mounts.
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <Search className="h-4 w-4" />
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search matches, teams, tipsters…"
              className="w-72 pl-7"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close search">
            <X className="h-4 w-4" />
          </Button>

          {/* Dropdown */}
          {q.trim().length >= 2 && (
            <div className="absolute right-0 top-full z-50 mt-1 w-[24rem] max-h-[28rem] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              <SearchDropdown
                loading={loading}
                hits={hits}
                q={q}
                grouped={grouped}
                flatOrdered={flatOrdered}
                activeIdx={activeIdx}
                setActiveIdx={setActiveIdx}
                go={go}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchDropdownProps {
  loading: boolean;
  hits: SearchHit[];
  q: string;
  grouped: Record<string, SearchHit[]>;
  flatOrdered: SearchHit[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  go: (hit: SearchHit) => void;
}

function SearchDropdown({
  loading, hits, q, grouped, flatOrdered, activeIdx, setActiveIdx, go,
}: SearchDropdownProps) {
  return (
    <>
      {loading && hits.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      )}
      {!loading && hits.length === 0 && (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          No results for &ldquo;{q.trim()}&rdquo;.
        </div>
      )}
      {hits.length > 0 && (
        <>
          {KIND_ORDER.map((kind) => {
            const items = grouped[kind];
            if (!items.length) return null;
            const Meta = KIND_META[kind];
            const Icon = Meta.icon;
            return (
              <div key={kind} className="py-1">
                <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {Meta.label}
                </div>
                {items.map((hit) => {
                  const flatIdx = flatOrdered.indexOf(hit);
                  const isActive = flatIdx === activeIdx;
                  return (
                    <Link
                      key={`${hit.type}-${hit.id}`}
                      href={hit.href}
                      onClick={(e) => {
                        e.preventDefault();
                        go(hit);
                      }}
                      onMouseEnter={() => setActiveIdx(flatIdx)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                      )}
                    >
                      {/* Visual */}
                      {hit.type === 'team' && (
                        <TeamLogo
                          teamName={hit.title}
                          logoUrl={hit.logoUrl}
                          sportSlug={hit.sportSlug}
                          size="sm"
                        />
                      )}
                      {hit.type === 'league' && (
                        <LeagueLogo leagueName={hit.title} size="sm" />
                      )}
                      {hit.type === 'tipster' && (
                        hit.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hit.avatar} alt={hit.title} className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {hit.title.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                      {hit.type === 'match' && (
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full',
                          hit.status === 'live' ? 'bg-live/20 text-live' : 'bg-muted text-muted-foreground',
                        )}>
                          {hit.status === 'live' ? <Radio className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                        </div>
                      )}

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{hit.title}</span>
                          {hit.type === 'tipster' && hit.verified && (
                            <span className="text-[10px] text-primary" title="Verified">✓</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{hit.subtitle}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
