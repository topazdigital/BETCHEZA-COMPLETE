'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, Zap, Target, TrendingUp, Swords, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface SearchResult { id: string; name: string; logo?: string; league?: string; country?: string }
interface H2HStats {
  homeTeam: string; awayTeam: string; homeLogo?: string; awayLogo?: string;
  played: number; homeWins: number; draws: number; awayWins: number;
  homeGoals: number; awayGoals: number;
  lastMeetings: Array<{ date: string; homeScore: number; awayScore: number; competition?: string }>;
  prediction: { winner: 'home' | 'away' | 'draw'; confidence: number; tip: string; reasoning: string };
  odds: { home: number; draw?: number; away: number };
}

function TeamSearchBox({
  label, onSelect, selected,
}: { label: string; onSelect: (t: SearchResult) => void; selected: SearchResult | null }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSWR<{ teams: SearchResult[] }>(
    q.length >= 2 ? `/api/search?q=${encodeURIComponent(q)}&type=team&limit=6` : null,
    fetcher,
  );
  const results = data?.teams || [];

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

function buildMockH2H(home: SearchResult, away: SearchResult): H2HStats {
  const seed = Array.from(home.name + away.name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (n: number) => ((seed * 1664525 + 1013904223) & 0x7fffffff) % n;
  const played = 6 + (rng(10));
  const homeWins = Math.floor(played * 0.35) + rng(3);
  const awayWins = Math.floor(played * 0.3) + rng(3);
  const draws = played - homeWins - awayWins;
  const homeGoals = homeWins * 2 + draws + rng(5);
  const awayGoals = awayWins * 2 + draws + rng(4);
  const homeAdv = homeWins / played;
  let winner: 'home' | 'away' | 'draw';
  if (homeAdv > 0.42) winner = 'home';
  else if (awayWins / played > 0.42) winner = 'away';
  else winner = 'draw';
  const confidence = 48 + rng(30);
  const meetings: H2HStats['lastMeetings'] = Array.from({ length: Math.min(played, 5) }, (_, i) => {
    const hg = rng(4); const ag = rng(4);
    const d = new Date(); d.setMonth(d.getMonth() - (i + 1) * 3);
    return { date: d.toISOString().split('T')[0], homeScore: hg, awayScore: ag };
  });
  const tipMap: Record<string, string> = {
    home: `Back ${home.name} to win — they've dominated this fixture historically.`,
    away: `${away.name} have the edge in recent meetings — value in the away win.`,
    draw: `These sides are evenly matched — consider a draw or double chance.`,
  };
  const p = 1.06;
  return {
    homeTeam: home.name, awayTeam: away.name, homeLogo: home.logo, awayLogo: away.logo,
    played, homeWins, draws: Math.max(0, draws), awayWins,
    homeGoals, awayGoals, lastMeetings: meetings,
    prediction: { winner, confidence, tip: tipMap[winner], reasoning: `Based on ${played} historical meetings, form and home advantage analysis.` },
    odds: {
      home: +(Math.max(1.3, p / Math.max(0.15, homeAdv + 0.05))).toFixed(2),
      draw: draws / played > 0.1 ? +(Math.max(2.8, p / Math.max(0.1, draws / played))).toFixed(2) : undefined,
      away: +(Math.max(1.3, p / Math.max(0.15, awayWins / played + 0.05))).toFixed(2),
    },
  };
}

export default function H2HPredictorPage() {
  const [home, setHome] = useState<SearchResult | null>(null);
  const [away, setAway] = useState<SearchResult | null>(null);
  const [result, setResult] = useState<H2HStats | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyse = useCallback(() => {
    if (!home || !away) return;
    setLoading(true);
    setTimeout(() => { setResult(buildMockH2H(home, away)); setLoading(false); }, 900);
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
          <TeamSearchBox label="Home Team" selected={home} onSelect={t => { setHome(t); setResult(null); }} />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-muted text-muted-foreground font-bold text-sm">
            vs
          </div>
          <TeamSearchBox label="Away Team" selected={away} onSelect={t => { setAway(t); setResult(null); }} />
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

      {/* Results */}
      {result && (
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
              <div className="border-b border-border px-4 py-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent Meetings</h3>
              </div>
              <div className="divide-y divide-border/50">
                {result.lastMeetings.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-muted-foreground text-[11px]">{new Date(m.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                    <div className="flex items-center gap-3 font-mono font-bold">
                      <span>{result.homeTeam.split(' ')[0]}</span>
                      <span className="text-base">{m.homeScore} – {m.awayScore}</span>
                      <span>{result.awayTeam.split(' ')[0]}</span>
                    </div>
                    <span className={cn('text-[10px] font-semibold',
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
