'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, Zap, Target, TrendingUp, Swords, Loader2, AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface SearchResult { id: string; name: string; logo?: string; league?: string; country?: string; sportSlug?: string }
interface H2HStats {
  homeTeam: string; awayTeam: string; homeLogo?: string; awayLogo?: string;
  played: number; homeWins: number; draws: number; awayWins: number;
  homeGoals: number; awayGoals: number;
  lastMeetings: Array<{ date: string; homeScore: number; awayScore: number; competition?: string }>;
  prediction: { winner: 'home' | 'away' | 'draw'; confidence: number; tip: string; reasoning: string };
  odds: { home: number; draw?: number; away: number };
  dataSource?: string;
  noData?: boolean;
  message?: string;
}

function TeamSearchBox({
  label, onSelect, selected,
}: { label: string; onSelect: (t: SearchResult) => void; selected: SearchResult | null }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSWR<{ teams?: SearchResult[]; hits?: Array<{ type: string; id: string; title?: string; name?: string; logoUrl?: string; logo?: string; subtitle?: string; league?: string }> }>(
    q.length >= 2 ? `/api/search?q=${encodeURIComponent(q)}&type=team&limit=6` : null,
    fetcher,
  );
  // Support both `teams` (direct) and `hits` (generic search) response shapes
  const results: SearchResult[] = data?.teams ?? (data?.hits ?? [])
    .filter(h => h.type === 'team')
    .map(h => ({
      id: h.id,
      name: h.title || h.name || '',
      logo: h.logoUrl || h.logo,
      league: h.subtitle?.split(' • ')[0] || h.league,
    }));

  return (
    <div className="flex-1 min-w-0">
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {selected.logo && <img src={selected.logo} alt="" className="h-8 w-8 object-contain" />}
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{selected.name}</div>
              {selected.league && <div className="text-[10px] text-muted-foreground truncate">{selected.league}</div>}
            </div>
          </div>
          <button
            onClick={() => { onSelect(null as unknown as SearchResult); setQ(''); }}
            className="shrink-0 text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded-md hover:bg-muted"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Search team name..."
            className="pl-9"
          />
          {open && q.length >= 2 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : results.length > 0 ? (
                results.map(t => (
                  <button
                    key={t.id}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
                    onMouseDown={() => { onSelect(t); setQ(''); setOpen(false); }}
                  >
                    {t.logo && <img src={t.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      {t.league && <div className="text-[10px] text-muted-foreground">{t.league}</div>}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">No teams found for &ldquo;{q}&rdquo;</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function H2HPredictorPage() {
  const [home, setHome] = useState<SearchResult | null>(null);
  const [away, setAway] = useState<SearchResult | null>(null);
  const [result, setResult] = useState<H2HStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyse = useCallback(async () => {
    if (!home || !away) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({
        homeId: home.id,
        awayId: away.id,
        homeName: home.name,
        awayName: away.name,
        ...(home.logo ? { homeLogo: home.logo } : {}),
        ...(away.logo ? { awayLogo: away.logo } : {}),
        sport: home.sportSlug ?? away.sportSlug ?? 'football',
      });
      const res = await fetch(`/api/predictor/h2h?${params}`);
      const data: H2HStats = await res.json();
      if (!res.ok) { setError((data as { error?: string }).error ?? 'Failed to load H2H data'); return; }
      setResult(data);
    } catch {
      setError('Failed to load H2H data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [home, away]);

  const winnerColor = result?.prediction.winner === 'home'
    ? 'text-emerald-600' : result?.prediction.winner === 'away'
    ? 'text-emerald-600' : 'text-amber-600';

  return (
    <div className="max-w-3xl mx-auto px-3 py-5 md:px-5">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/predictor" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> AI Predictor
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-xs font-semibold">Head-to-Head</span>
      </div>

      <div className="mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Swords className="h-6 w-6 text-primary" /> Head-to-Head Predictor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick two teams to see their historical matchup stats and an AI-powered prediction.
        </p>
      </div>

      {/* Team pickers */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <TeamSearchBox label="Home Team" selected={home} onSelect={t => { setHome(t); setResult(null); setError(null); }} />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-muted text-muted-foreground font-bold text-sm">
            vs
          </div>
          <TeamSearchBox label="Away Team" selected={away} onSelect={t => { setAway(t); setResult(null); setError(null); }} />
        </div>
        <Button
          className="mt-4 w-full gap-2"
          disabled={!home || !away || loading || home.id === away.id}
          onClick={handleAnalyse}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {loading ? 'Analysing...' : 'Analyse Matchup'}
        </Button>
        {home && away && home.id === away.id && (
          <p className="mt-2 text-center text-xs text-destructive flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" /> Please pick two different teams
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* No historical data */}
      {result?.noData && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4">
          <Database className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-semibold">No Historical Data Found</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{result.message ?? 'These teams have not met in covered competitions.'}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !result.noData && (
        <div className="mt-5 space-y-4">
          {/* Score header */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-background to-primary/10 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center gap-2 flex-1">
                  {result.homeLogo && <img src={result.homeLogo} alt="" className="h-14 w-14 object-contain" />}
                  <span className="text-sm font-bold text-center">{result.homeTeam}</span>
                </div>
                <div className="flex flex-col items-center px-4">
                  <span className="text-3xl font-black tabular-nums">
                    {result.homeWins} – {result.awayWins}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{result.draws} draws</span>
                  <span className="mt-1 text-[10px] text-muted-foreground">{result.played} meetings</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  {result.awayLogo && <img src={result.awayLogo} alt="" className="h-14 w-14 object-contain" />}
                  <span className="text-sm font-bold text-center">{result.awayTeam}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-1 rounded-full overflow-hidden h-2">
                <div className="bg-emerald-500 transition-all" style={{ width: `${(result.homeWins / result.played) * 100}%` }} />
                <div className="bg-muted" style={{ width: `${(result.draws / result.played) * 100}%` }} />
                <div className="bg-blue-500" style={{ width: `${(result.awayWins / result.played) * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                <span>{Math.round((result.homeWins / result.played) * 100)}% home wins</span>
                <span>{Math.round((result.draws / result.played) * 100)}% draws</span>
                <span>{Math.round((result.awayWins / result.played) * 100)}% away wins</span>
              </div>
            </div>

            {/* Prediction */}
            <div className="border-t border-border px-5 py-3 bg-muted/20 flex items-start gap-3">
              <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">AI Prediction:</span>
                  <span className={`font-bold text-sm ${winnerColor}`}>
                    {result.prediction.winner === 'home' ? result.homeTeam : result.prediction.winner === 'away' ? result.awayTeam : 'Draw'}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {result.prediction.confidence}% confidence
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{result.prediction.tip}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">{result.prediction.reasoning}</p>
              </div>
            </div>
          </div>

          {/* Odds + Stats row */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Odds */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Estimated Odds
              </h3>
              <div className="flex gap-2">
                {[
                  { label: '1 ' + result.homeTeam.split(' ')[0], val: result.odds.home, winner: result.prediction.winner === 'home' },
                  ...(result.odds.draw ? [{ label: 'X Draw', val: result.odds.draw, winner: result.prediction.winner === 'draw' }] : []),
                  { label: '2 ' + result.awayTeam.split(' ')[0], val: result.odds.away, winner: result.prediction.winner === 'away' },
                ].map((o, i) => (
                  <div key={i} className={cn(
                    'flex-1 rounded-lg border p-2 text-center',
                    o.winner ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/30'
                  )}>
                    <div className="text-[9px] text-muted-foreground truncate">{o.label}</div>
                    <div className={cn('text-lg font-bold tabular-nums', o.winner && 'text-primary')}>{o.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goal stats */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Goals Average</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{result.homeTeam} (home)</span>
                  <span className="font-bold">{(result.homeGoals / result.played).toFixed(1)} /game</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{result.awayTeam} (away)</span>
                  <span className="font-bold">{(result.awayGoals / result.played).toFixed(1)} /game</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Total per game</span>
                  <span className="font-bold">{((result.homeGoals + result.awayGoals) / result.played).toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Last meetings */}
          {result.lastMeetings.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent Meetings</h3>
                {result.dataSource && (
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60 font-medium">
                    <Database className="h-2.5 w-2.5" /> {result.dataSource}
                  </span>
                )}
              </div>
              <div className="divide-y divide-border/50">
                {result.lastMeetings.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-muted-foreground text-[11px] whitespace-nowrap">{new Date(m.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                      {m.competition && <span className="truncate text-[9px] text-muted-foreground/50 max-w-[100px]">{m.competition}</span>}
                    </div>
                    <div className="flex items-center gap-3 font-mono font-bold">
                      <span className="text-xs truncate max-w-[60px] text-right">{result.homeTeam.split(' ')[0]}</span>
                      <span className="text-base tabular-nums">{m.homeScore} – {m.awayScore}</span>
                      <span className="text-xs truncate max-w-[60px]">{result.awayTeam.split(' ')[0]}</span>
                    </div>
                    <span className={cn('text-[10px] font-semibold shrink-0',
                      m.homeScore > m.awayScore ? 'text-emerald-600' : m.awayScore > m.homeScore ? 'text-blue-600' : 'text-muted-foreground'
                    )}>
                      {m.homeScore > m.awayScore ? 'H' : m.awayScore > m.homeScore ? 'A' : 'D'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
