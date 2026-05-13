'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, X, Trophy, Users, Calendar, UserCheck, Loader2, Radio, Clock, ArrowUpRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TeamLogo, LeagueLogo } from '@/components/ui/team-logo';
import { cn } from '@/lib/utils';

type SearchHit =
  | { type: 'league'; id: string; title: string; subtitle: string; href: string; logoUrl?: string; sportSlug?: string }
  | { type: 'team'; id: string; title: string; subtitle: string; href: string; logoUrl?: string; sportSlug?: string }
  | { type: 'match'; id: string; title: string; subtitle: string; href: string; status: string; kickoffIso?: string }
  | { type: 'tipster'; id: string; title: string; subtitle: string; href: string; avatar?: string | null; verified?: boolean };

type RecentSearch = { q: string; href?: string; title?: string; ts: number };

const RECENT_KEY = 'betcheza_recent_searches';
const MAX_RECENT = 5;

function loadRecent(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch { return []; }
}

function saveRecent(item: RecentSearch) {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadRecent().filter(r => r.q !== item.q);
    const updated = [item, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

function clearRecent() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}

const KIND_META = {
  match: { label: 'Matches', icon: Calendar },
  league: { label: 'Leagues', icon: Trophy },
  team: { label: 'Teams', icon: Users },
  tipster: { label: 'Tipsters', icon: UserCheck },
} as const;

const KIND_ORDER: Array<keyof typeof KIND_META> = ['match', 'league', 'team', 'tipster'];

interface HeaderSearchProps {
  inline?: boolean;
  className?: string;
  placeholder?: string;
}

export function HeaderSearch({ inline = false, className, placeholder }: HeaderSearchProps = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(inline);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const refreshRecent = useCallback(() => {
    setRecentSearches(loadRecent());
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  // Instant search — fires immediately on each keystroke, uses AbortController
  // to cancel the previous in-flight request so results are never stale.
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      ctrlRef.current?.abort();
      return;
    }

    // Cancel any previous in-flight request
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=12`, { signal: ctrl.signal })
      .then(async r => {
        if (!r.ok) throw new Error('bad response');
        const data = (await r.json()) as { hits: SearchHit[] };
        if (!ctrl.signal.aborted) {
          setHits(data.hits || []);
          setActiveIdx(0);
        }
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') setHits([]);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [q, open]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open && !inline) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        if (inline) setShowDropdown(false);
        else close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inline) { setShowDropdown(false); inputRef.current?.blur(); }
        else close();
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
      setQ(''); setHits([]); setActiveIdx(0); setShowDropdown(false);
      return;
    }
    setOpen(false); setQ(''); setHits([]); setActiveIdx(0);
  };

  const go = (hit: SearchHit) => {
    saveRecent({ q: hit.title, href: hit.href, title: hit.title, ts: Date.now() });
    refreshRecent();
    close();
    router.push(hit.href);
  };

  const goRecent = (r: RecentSearch) => {
    if (r.href) {
      close();
      router.push(r.href);
    } else {
      setQ(r.q);
      setShowDropdown(true);
      inputRef.current?.focus();
    }
  };

  const saveQuerySearch = (query: string) => {
    if (query.trim().length >= 2) {
      saveRecent({ q: query.trim(), ts: Date.now() });
      refreshRecent();
    }
  };

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
      else if (q.trim().length >= 2) saveQuerySearch(q.trim());
    }
  };

  const showingQuery = q.trim().length >= 2;
  const dropdownVisible = inline ? showDropdown && (showingQuery || recentSearches.length > 0) : showingQuery || recentSearches.length > 0;

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
            onChange={(e) => { setQ(e.target.value); setShowDropdown(true); }}
            onFocus={() => { refreshRecent(); setShowDropdown(true); }}
            onKeyDown={onKeyDown}
          />
          {q && (
            <button
              type="button"
              onClick={() => { setQ(''); setHits([]); setActiveIdx(0); inputRef.current?.focus(); }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {dropdownVisible && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[32rem] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
            {!showingQuery && recentSearches.length > 0 ? (
              <RecentDropdown
                items={recentSearches}
                onSelect={goRecent}
                onClear={() => { clearRecent(); setRecentSearches([]); }}
              />
            ) : (
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
            )}
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
            refreshRecent();
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
              onFocus={() => { refreshRecent(); }}
              onKeyDown={onKeyDown}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close search">
            <X className="h-4 w-4" />
          </Button>

          {(showingQuery || recentSearches.length > 0) && (
            <div className="absolute right-0 top-full z-50 mt-1 w-[24rem] max-h-[32rem] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              {!showingQuery && recentSearches.length > 0 ? (
                <RecentDropdown
                  items={recentSearches}
                  onSelect={goRecent}
                  onClear={() => { clearRecent(); setRecentSearches([]); }}
                />
              ) : (
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecentDropdown({ items, onSelect, onClear }: {
  items: RecentSearch[];
  onSelect: (r: RecentSearch) => void;
  onClear: () => void;
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-3 w-3" />
          Recent Searches
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(item)}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent/50 text-left"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <span className="flex-1 truncate font-medium">{item.title || item.q}</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        </button>
      ))}
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

function SearchDropdown({ loading, hits, q, grouped, flatOrdered, activeIdx, setActiveIdx, go }: SearchDropdownProps) {
  return (
    <>
      {loading && hits.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      )}
      {!loading && hits.length === 0 && q.trim().length >= 2 && (
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
                      onClick={(e) => { e.preventDefault(); go(hit); }}
                      onMouseEnter={() => setActiveIdx(flatIdx)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                      )}
                    >
                      {hit.type === 'team' && (
                        <TeamLogo teamName={hit.title} logoUrl={hit.logoUrl} sportSlug={hit.sportSlug} size="sm" />
                      )}
                      {hit.type === 'league' && (
                        <LeagueLogo leagueName={hit.title} size="sm" />
                      )}
                      {hit.type === 'tipster' && (
                        hit.avatar ? (
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
