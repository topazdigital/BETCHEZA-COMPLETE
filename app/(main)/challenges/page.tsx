'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { pickOptionsForSport, resolvePickOdds, maxPoints, parsePicks, pickOutcome } from '@/lib/challenge-picks';
import type { PickSelection, PickOption } from '@/lib/challenge-picks';
import { isPushSupported, ensurePushSubscribed } from '@/lib/push-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchOdds { home: number; draw: number; away: number }

interface MatchOption {
  id: string; homeTeam: string; awayTeam: string;
  homeLogo: string | null; awayLogo: string | null;
  league: string; sport: string; sportName: string;
  kickoff: string | null; status: string;
  homeScore: number | null; awayScore: number | null;
  odds?: MatchOdds;
}

interface Participant {
  userId: number; username: string; displayName: string;
  avatar: string | null; tips: number; won: number; lost: number;
  streak: number; roi: number; isFake: boolean;
}

interface Challenge {
  id: number; matchId: string;
  matchHomeTeam: string; matchAwayTeam: string;
  matchHomeLogo: string | null; matchAwayLogo: string | null;
  matchLeague: string; matchSport: string;
  matchKickoff: string | null; matchStatus: string;
  challengerId: number; challengedId: number | null;
  challengerPick: string; challengedPick: string | null;
  challengerPicks: PickSelection[]; challengedPicks: PickSelection[];
  stakeKes: number; platformFeePct: number;
  status: string; escrowStatus: string;
  isFake: boolean; winnerId: number | null;
  drawRefunded: boolean; isPublic: boolean; watchers: number;
  challengerVotes: number; opponentVotes: number;
  challenger: Participant | null; challenged: Participant | null;
  createdAt: string; updatedAt: string;
}

interface LiveMatchData {
  homeScore: number | null; awayScore: number | null;
  status: string; minute: number | null; odds: MatchOdds | null;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── SSE Live-Points Hook ─────────────────────────────────────────────────────

function useLiveStream(matchIds: string[], onAllFinished?: () => void): Record<string, LiveMatchData> {
  const [liveMap, setLiveMap] = useState<Record<string, LiveMatchData>>({});
  const idsKey = matchIds.join(',');
  const onAllFinishedRef = useRef(onAllFinished);
  onAllFinishedRef.current = onAllFinished;

  useEffect(() => {
    if (!idsKey) return;
    const url = `/api/challenges/points-stream?matchIds=${encodeURIComponent(idsKey)}`;
    let es: EventSource;
    try {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data as string) as {
            data?: Record<string, LiveMatchData>;
            finished?: boolean;
            needsRefresh?: boolean;
          };
          if (payload.data) setLiveMap(prev => ({ ...prev, ...payload.data }));
          if (payload.finished || payload.needsRefresh) {
            // Challenges need to be re-fetched — matches finished, settlement triggered
            onAllFinishedRef.current?.();
            es.close();
          }
        } catch { /* ignore parse errors */ }
      };
      es.onerror = () => { try { es.close(); } catch { /* ignore */ } };
    } catch { /* SSE not supported or blocked */ }
    return () => { try { es?.close(); } catch { /* ignore */ } };
  // idsKey is a stable primitive dep — reconnect only when match set changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return liveMap;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKickoff(iso: string | null): string {
  if (!iso) return 'TBD';
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi',
    });
  } catch { return iso; }
}

function countdown(iso: string | null): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Kick-off!';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `in ${Math.floor(h / 24)}d`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function isMatchFinished(status: string): boolean {
  return ['finished', 'final', 'ft', 'full-time', 'complete', 'completed', 'ended'].includes((status || '').toLowerCase());
}

function isMatchLive(status: string): boolean {
  return ['live', 'halftime', 'extra_time', 'inprogress', '1h', '2h', 'ht'].some(s =>
    (status || '').toLowerCase().includes(s));
}

function calcLivePoints(picks: PickSelection[], homeScore: number | null, awayScore: number | null): number {
  if (homeScore === null || awayScore === null) return 0;
  return picks.reduce((sum, p) => sum + (pickOutcome(p.pick, homeScore, awayScore) === 'winning' ? p.odds : 0), 0);
}

// ─── Team Logo ────────────────────────────────────────────────────────────────

function TeamLogo({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="rounded-full bg-muted flex items-center justify-center font-bold text-foreground shrink-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <Image src={src} alt={name} width={size} height={size}
    className="rounded-full object-contain shrink-0 bg-muted"
    style={{ width: size, height: size }} onError={() => setErr(true)} unoptimized />;
}

function Avatar({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <Image src={src} alt={name} width={size} height={size}
    className="rounded-full object-cover shrink-0"
    style={{ width: size, height: size }} onError={() => setErr(true)} unoptimized />;
}

// ─── Multi-Pick Selector ──────────────────────────────────────────────────────

function PickSelector({
  sport, matchOdds, selectedPicks, onChange, maxPicks = 5,
}: {
  sport: string;
  matchOdds: MatchOdds | null;
  selectedPicks: PickSelection[];
  onChange: (picks: PickSelection[]) => void;
  maxPicks?: number;
}) {
  const options: PickOption[] = useMemo(() => pickOptionsForSport(sport), [sport]);
  const grouped = useMemo(() => options.reduce<Record<string, PickOption[]>>((acc, o) => {
    (acc[o.group] = acc[o.group] || []).push(o); return acc;
  }, {}), [options]);

  const togglePick = (option: PickOption) => {
    const odds = resolvePickOdds(option.value, matchOdds, option.defaultOdds);
    const already = selectedPicks.findIndex(p => p.pick === option.value);
    if (already >= 0) {
      onChange(selectedPicks.filter((_, i) => i !== already));
    } else if (selectedPicks.length < maxPicks) {
      onChange([...selectedPicks, { pick: option.value, odds, group: option.group }]);
    }
  };

  const totalOdds = maxPoints(selectedPicks);

  return (
    <div>
      {selectedPicks.length > 0 && (
        <div className="mb-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary">Your picks ({selectedPicks.length}/{maxPicks})</span>
            <span className="text-sm font-bold text-yellow-500">{totalOdds.toFixed(2)} pts max</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedPicks.map(p => (
              <button key={p.pick} onClick={() => onChange(selectedPicks.filter(x => x.pick !== p.pick))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-xs font-medium text-primary hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors">
                <span>{p.pick}</span>
                <span className="text-yellow-500 font-bold">@{p.odds.toFixed(2)}</span>
                <span className="ml-0.5 opacity-60">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([group, opts]) => (
        <div key={group} className="mb-3">
          <div className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">{group}</div>
          <div className="flex flex-wrap gap-2">
            {opts.map(opt => {
              const odds = resolvePickOdds(opt.value, matchOdds, opt.defaultOdds);
              const isSelected = selectedPicks.some(p => p.pick === opt.value);
              const canAdd = selectedPicks.length < maxPicks || isSelected;
              return (
                <button key={opt.value} onClick={() => canAdd && togglePick(opt)}
                  disabled={!canAdd && !isSelected}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all flex flex-col items-center leading-tight min-w-[76px] ${
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : canAdd
                        ? 'bg-muted border-border text-foreground hover:border-primary/50 hover:bg-muted/80'
                        : 'opacity-30 cursor-not-allowed bg-muted border-border text-muted-foreground'
                  }`}>
                  <span>{opt.label}</span>
                  <span className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-primary-foreground/80' : 'text-yellow-500'}`}>
                    @{odds.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selectedPicks.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1">Select up to {maxPicks} predictions — each correct pick scores its odds as points.</p>
      )}
    </div>
  );
}

// ─── Points Bar (SVG visualization) ──────────────────────────────────────────

function PointsBar({
  challengerPicks, challengedPicks,
  homeScore, awayScore,
  challengerName, challengedName,
  finished, winnerId, challengerId,
}: {
  challengerPicks: PickSelection[]; challengedPicks: PickSelection[];
  homeScore: number | null; awayScore: number | null;
  challengerName: string; challengedName: string;
  finished: boolean; winnerId?: number | null; challengerId?: number;
}) {
  const [flash, setFlash] = useState(false);
  const prevScoreRef = useRef<string | null>(null);
  const cPts = calcLivePoints(challengerPicks, homeScore, awayScore);
  const oPts = calcLivePoints(challengedPicks, homeScore, awayScore);

  useEffect(() => {
    const key = `${homeScore}-${awayScore}`;
    if (prevScoreRef.current !== null && prevScoreRef.current !== key) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 800);
      return () => clearTimeout(t);
    }
    prevScoreRef.current = key;
  }, [homeScore, awayScore]);
  const cMax = maxPoints(challengerPicks);
  const oMax = maxPoints(challengedPicks);
  const totalMax = Math.max(cMax + oMax, 0.01);
  const cPct = (cPts / totalMax) * 100;
  const oPct = (oPts / totalMax) * 100;
  // When settled with a tiebreaker winner, respect the decided winner even when pts are equal
  const settledWinner = finished && winnerId != null
    ? (winnerId === challengerId ? 'challenger' : 'opponent')
    : null;
  const leading = settledWinner ?? (cPts > oPts ? 'challenger' : oPts > cPts ? 'opponent' : 'tie');

  if (homeScore === null) {
    // Pre-match: show max potential comparison
    const cMaxPct = (cMax / totalMax) * 100;
    const oMaxPct = (oMax / totalMax) * 100;
    return (
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span className="font-medium text-blue-400">{challengerName.split(' ')[0]} · {cMax.toFixed(2)} pts max</span>
          <span className="text-muted-foreground">Potential</span>
          <span className="font-medium text-purple-400">{oMax.toFixed(2)} pts max · {challengedName.split(' ')[0]}</span>
        </div>
        <div className="h-2 rounded-full bg-muted flex overflow-hidden">
          <div className="h-full bg-blue-500/40 transition-all duration-700" style={{ width: `${cMaxPct}%` }} />
          <div className="h-full bg-purple-500/40 transition-all duration-700" style={{ width: `${oMaxPct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className={flash ? 'animate-pulse' : ''}>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className={`font-bold tabular-nums transition-colors duration-500 ${leading === 'challenger' ? 'text-green-400' : 'text-blue-400'}`}>
          {challengerName.split(' ')[0]}: {cPts.toFixed(2)} pts
        </span>
        {leading !== 'tie' ? (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${finished ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
            {finished ? '🏆 Won' : '⚡ Leading'}
          </span>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
            {finished ? '🤝 Draw' : '⚖️ Tied'}
          </span>
        )}
        <span className={`font-bold tabular-nums transition-colors duration-500 ${leading === 'opponent' ? 'text-green-400' : 'text-purple-400'}`}>
          {oPts.toFixed(2)} pts · {challengedName.split(' ')[0]}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted flex overflow-hidden relative">
        <div className={`h-full transition-all duration-700 ${leading === 'challenger' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.max(cPct, cPts > 0 ? 3 : 0)}%` }} />
        <div className={`h-full transition-all duration-700 ${leading === 'opponent' ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${Math.max(oPct, oPts > 0 ? 3 : 0)}%` }} />
      </div>
      {!finished && (
        <p className="text-xs text-muted-foreground mt-1 text-center">
          {leading === 'tie' ? 'Equal points — match in progress' :
            leading === 'challenger' ? `${challengerName.split(' ')[0]} leads by ${(cPts - oPts).toFixed(2)} pts` :
            `${challengedName.split(' ')[0]} leads by ${(oPts - cPts).toFixed(2)} pts`}
        </p>
      )}
    </div>
  );
}

// ─── Picks List (for inside card) ────────────────────────────────────────────

function PicksList({
  picks, homeScore, awayScore, finished, live,
}: {
  picks: PickSelection[];
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
  live: boolean;
}) {
  if (!picks.length) return <span className="text-xs text-muted-foreground italic">No picks yet</span>;
  return (
    <div className="space-y-1">
      {picks.map((p, i) => {
        const outcome = (live || finished) ? pickOutcome(p.pick, homeScore, awayScore) : 'pending';
        return (
          <div key={i} className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 ${
            outcome === 'winning' ? 'bg-green-500/10 border border-green-500/20' :
            outcome === 'losing' ? 'bg-red-500/10 border border-red-500/20' :
            'bg-muted/50 border border-border/40'
          }`}>
            <span className={`shrink-0 text-sm leading-none ${
              outcome === 'winning' ? 'text-green-400' :
              outcome === 'losing' ? 'text-red-400' :
              'text-muted-foreground'
            }`}>
              {outcome === 'winning' ? (finished ? '✓' : '↑') :
               outcome === 'losing' ? (finished ? '✗' : '↓') : '○'}
            </span>
            <span className="flex-1 font-medium text-foreground">{p.pick}</span>
            <span className="font-bold text-yellow-500 tabular-nums">@{p.odds.toFixed(2)}</span>
            {outcome === 'winning' && (
              <span className={`font-bold tabular-nums ${finished ? 'text-green-400' : 'text-green-400/70'}`}>
                +{p.odds.toFixed(2)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Community Vote Bar ───────────────────────────────────────────────────────

function VoteBar({ challengerVotes, opponentVotes, challengerName, opponentName }: {
  challengerVotes: number; opponentVotes: number;
  challengerName: string; opponentName: string;
}) {
  const total = challengerVotes + opponentVotes;
  if (total === 0) return null;
  const cPct = Math.round((challengerVotes / total) * 100);
  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span className="font-medium text-blue-400">{cPct}% {challengerName.split(' ')[0]}</span>
        <span>{total} community votes</span>
        <span className="font-medium text-purple-400">{challengerName.split(' ')[0] !== opponentName.split(' ')[0] ? opponentName.split(' ')[0] : 'Opponent'} {100 - cPct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex bg-muted">
        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${cPct}%` }} />
        <div className="h-full bg-purple-500 transition-all duration-700" style={{ width: `${100 - cPct}%` }} />
      </div>
    </div>
  );
}

// ─── Watch Button ─────────────────────────────────────────────────────────────

function WatchButton({ challengeId, initialWatchers }: { challengeId: number; initialWatchers: number }) {
  const [watching, setWatching] = useState(false);
  const [count, setCount] = useState(initialWatchers);
  const [busy, setBusy] = useState(false);
  const key = `watched_${challengeId}`;
  useEffect(() => { setWatching(!!localStorage.getItem(key)); }, [key]);

  async function toggle() {
    if (watching || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/challenges/${challengeId}/watch`, { method: 'POST' });
      setCount(c => c + 1); setWatching(true); localStorage.setItem(key, '1');
      if (isPushSupported()) await ensurePushSubscribed({ topics: [`challenge_${challengeId}`, 'challenge_results'] });
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <button onClick={toggle} disabled={watching || busy}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors border ${watching ? 'border-purple-500/40 bg-purple-500/10 text-purple-400 cursor-default' : 'border-border bg-muted/60 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>
      <span>👁</span><span>{watching ? 'Watching' : 'Watch'}{count > 0 ? ` · ${count}` : ''}</span>
    </button>
  );
}

// ─── Match Search (used inside Create modal) ──────────────────────────────────

function MatchSearch({ onSelect }: { onSelect: (m: MatchOption) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(true);
  const [results, setResults] = useState<MatchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const wrap = useRef<HTMLDivElement>(null);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/challenges/match-search?q=${encodeURIComponent(query)}&limit=14`);
      const data = await res.json() as { matches: MatchOption[] };
      setResults(data.matches || []);
    } catch { setResults([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { search(''); }, [search]);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), q ? 300 : 0);
  }, [q, search]);

  return (
    <div ref={wrap}>
      <input type="text" placeholder="Search team or league…" value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors" />
      {open && (
        <div className="mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
          {loading && <div className="p-3 text-center text-muted-foreground text-sm">Searching…</div>}
          {!loading && results.length === 0 && <div className="p-3 text-center text-muted-foreground text-sm">No matches with odds found</div>}
          {results.map(m => (
            <button key={m.id} onClick={() => { onSelect(m); setQ(`${m.homeTeam} vs ${m.awayTeam}`); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left border-b border-border/40 last:border-0">
              <TeamLogo src={m.homeLogo} name={m.homeTeam} size={22} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{m.homeTeam} <span className="text-muted-foreground">vs</span> {m.awayTeam}</div>
                <div className="text-xs text-muted-foreground truncate">{m.league} · {formatKickoff(m.kickoff)}</div>
              </div>
              <TeamLogo src={m.awayLogo} name={m.awayTeam} size={22} />
              {m.odds && <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{m.odds.home.toFixed(2)}/{m.odds.draw > 1 ? m.odds.draw.toFixed(2) + '/' : ''}{m.odds.away.toFixed(2)}</span>}
              {m.status === 'live' && <span className="text-xs font-bold text-red-400 animate-pulse shrink-0">LIVE</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

const STAKES = [0, 200, 500, 1000, 2000, 5000];

function CreateModal({ onClose, onCreated, prefillOpponentId }: {
  onClose: () => void; onCreated: () => void; prefillOpponentId?: number;
}) {
  const [step, setStep] = useState<'match' | 'picks' | 'stake'>(prefillOpponentId ? 'match' : 'match');
  const [match, setMatch] = useState<MatchOption | null>(null);
  const [picks, setPicks] = useState<PickSelection[]>([]);
  const [stakeKes, setStakeKes] = useState(500);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalOdds = maxPoints(picks);
  const payout = Math.round(stakeKes * 2 * 0.9);

  async function handleSubmit() {
    if (!match || !picks.length) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          matchSnapshot: {
            id: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam,
            homeLogo: match.homeLogo, awayLogo: match.awayLogo,
            league: match.league, sport: match.sport,
            kickoff: match.kickoff, status: match.status,
          },
          picks,
          stakeKes,
          isPublic,
          ...(prefillOpponentId ? { opponentId: prefillOpponentId } : {}),
        }),
      });
      const data = await res.json() as { error?: string; insufficientBalance?: boolean };
      if (!res.ok) {
        setError(data.error || 'Failed to create');
        if (data.insufficientBalance) setStep('stake');
      } else { onCreated(); onClose(); }
    } catch { setError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'match' && (
              <button onClick={() => setStep(step === 'stake' ? 'picks' : 'match')}
                className="text-muted-foreground hover:text-foreground text-lg">←</button>
            )}
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {step === 'match' ? '⚔️ Select a Match' : step === 'picks' ? '🎯 Your Predictions' : '💰 Set Stake'}
              </h2>
              <div className="flex gap-1.5 mt-1">
                {(['match', 'picks', 'stake'] as const).map((s, i) => (
                  <div key={s} className={`h-1 rounded-full transition-all ${step === s ? 'w-8 bg-primary' : i < ['match', 'picks', 'stake'].indexOf(step) ? 'w-4 bg-primary/50' : 'w-4 bg-muted'}`} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">

          {/* Step 1: Select Match */}
          {step === 'match' && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Only matches with real odds are eligible. Start typing to search.</p>
              <MatchSearch onSelect={m => { setMatch(m); setPicks([]); setStep('picks'); }} />
            </div>
          )}

          {/* Step 2: Select Picks */}
          {step === 'picks' && match && (
            <div className="space-y-4">
              {/* Match mini-card */}
              <div className="p-3 rounded-xl bg-muted border border-border">
                <div className="flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TeamLogo src={match.homeLogo} name={match.homeTeam} size={28} />
                    <span className="text-sm font-semibold text-foreground truncate">{match.homeTeam}</span>
                  </div>
                  <div className="text-center shrink-0 px-2">
                    {match.status === 'live' ? (
                      <div className="text-sm font-bold text-red-400 animate-pulse">🔴 LIVE</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">vs</div>
                    )}
                    {match.odds && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {match.odds.home.toFixed(2)} / {match.odds.draw > 1 ? match.odds.draw.toFixed(2) + ' / ' : ''}{match.odds.away.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-sm font-semibold text-foreground truncate text-right">{match.awayTeam}</span>
                    <TeamLogo src={match.awayLogo} name={match.awayTeam} size={28} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-center mt-1.5">{match.league} · {formatKickoff(match.kickoff)}</div>
              </div>

              <PickSelector
                sport={match.sport}
                matchOdds={match.odds || null}
                selectedPicks={picks}
                onChange={setPicks}
                maxPicks={5}
              />

              {picks.length > 0 && (
                <div className="p-3 rounded-xl bg-muted/50 border border-border/50 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground mb-1">How points work:</div>
                  Each correct pick scores its odds as points. {picks.length} pick{picks.length !== 1 ? 's' : ''} selected = up to <strong className="text-yellow-500">{totalOdds.toFixed(2)} pts</strong> max. Highest total points wins.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Set Stake */}
          {step === 'stake' && match && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-3 rounded-xl bg-muted border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <TeamLogo src={match.homeLogo} name={match.homeTeam} size={22} />
                  <span className="text-sm font-medium text-foreground">{match.homeTeam} vs {match.awayTeam}</span>
                  <TeamLogo src={match.awayLogo} name={match.awayTeam} size={22} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {picks.map(p => (
                    <span key={p.pick} className="px-2 py-0.5 rounded-lg bg-primary/15 text-primary text-xs font-medium">
                      {p.pick} @{p.odds.toFixed(2)}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-yellow-500 font-semibold">Max score: {totalOdds.toFixed(2)} pts</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Stake Amount</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {STAKES.map(v => (
                    <button key={v} onClick={() => setStakeKes(v)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${stakeKes === v ? 'bg-green-600 border-green-500 text-white' : 'bg-muted border-border text-foreground hover:border-primary/50'}`}>
                      {v === 0 ? 'Free' : `KES ${v.toLocaleString()}`}
                    </button>
                  ))}
                </div>
                <input type="number" min={0} step={50} value={stakeKes}
                  onChange={e => setStakeKes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
                {stakeKes > 0 && (
                  <div className="mt-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-xs">
                    <div className="flex justify-between text-foreground">
                      <span>Pot (2× stake)</span><span className="font-bold">KES {(stakeKes * 2).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground mt-0.5">
                      <span>Platform fee (10%)</span><span>−KES {Math.round(stakeKes * 2 * 0.1).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-green-500 font-bold mt-1 border-t border-green-500/20 pt-1">
                      <span>Winner receives</span><span>KES {payout.toLocaleString()}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">Draw = full refund, no fee charged.</div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <button onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${isPublic ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-foreground">{isPublic ? 'Open — any tipster can accept' : 'Private — invite only'}</div>
                  <div className="text-xs text-muted-foreground">{isPublic ? 'Visible to all tipsters in the Open tab' : 'Only your specified opponent can join'}</div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors">
            Cancel
          </button>
          {step === 'picks' && (
            <button onClick={() => setStep('stake')} disabled={picks.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-bold transition-colors">
              Next → Set Stake
            </button>
          )}
          {step === 'stake' && (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold transition-colors">
              {submitting ? 'Posting…' : `⚔️ Post Challenge${stakeKes > 0 ? ` · KES ${stakeKes.toLocaleString()}` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accept Modal ─────────────────────────────────────────────────────────────

function AcceptModal({ challenge, onClose, onAccepted }: {
  challenge: Challenge; onClose: () => void; onAccepted: () => void;
}) {
  const [picks, setPicks] = useState<PickSelection[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const payout = Math.round(challenge.stakeKes * 2 * 0.9);
  const totalOdds = maxPoints(picks);

  async function handleAccept() {
    if (!picks.length) { setError('Please select at least one prediction'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', picks }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) setError(data.error || 'Failed to accept');
      else { onAccepted(); onClose(); }
    } catch { setError('Network error'); } finally { setSubmitting(false); }
  }

  const challPicks = challenge.challengerPicks.length ? challenge.challengerPicks : parsePicks(challenge.challengerPick);
  const takenPicks = new Set(challPicks.map(p => p.pick));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">⚔️ Accept Challenge</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Choose your predictions · May the best tipster win</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Match + opponent's picks */}
          <div className="p-3 rounded-xl bg-muted border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TeamLogo src={challenge.matchHomeLogo} name={challenge.matchHomeTeam} size={24} />
              <span className="text-sm font-semibold text-foreground flex-1 truncate">{challenge.matchHomeTeam} vs {challenge.matchAwayTeam}</span>
              <TeamLogo src={challenge.matchAwayLogo} name={challenge.matchAwayTeam} size={24} />
            </div>
            <div className="text-xs text-muted-foreground">{challenge.matchLeague} · {formatKickoff(challenge.matchKickoff)}</div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Avatar src={challenge.challenger?.avatar ?? null} name={challenge.challenger?.displayName || '?'} size={24} />
              <span className="text-sm font-semibold text-foreground">{challenge.challenger?.displayName || `User #${challenge.challengerId}`}</span>
              <span className="text-xs text-muted-foreground ml-auto">picked:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {challPicks.map(p => (
                <span key={p.pick} className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-medium">
                  {p.pick} @{p.odds.toFixed(2)}
                </span>
              ))}
            </div>
            <div className="text-xs text-yellow-500 font-semibold mt-1.5">Max: {maxPoints(challPicks).toFixed(2)} pts</div>
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground mb-2">Your Counter-Picks</div>
            <PickSelector
              sport={challenge.matchSport}
              matchOdds={null}
              selectedPicks={picks}
              onChange={p => setPicks(p.filter(x => !takenPicks.has(x.pick)))}
              maxPicks={5}
            />
            {picks.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Your max score: <strong className="text-yellow-500">{totalOdds.toFixed(2)} pts</strong>
              </p>
            )}
          </div>

          {challenge.stakeKes > 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs">
              <div className="flex justify-between text-foreground font-medium">
                <span>⚠️ Locks your stake</span><span>KES {challenge.stakeKes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-green-500 font-bold mt-1">
                <span>Winner receives</span><span>KES {payout.toLocaleString()}</span>
              </div>
              <div className="text-muted-foreground mt-0.5">Equal points = draw = full refund.</div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-medium">Cancel</button>
          <button onClick={handleAccept} disabled={!picks.length || submitting}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold transition-colors">
            {submitting ? 'Accepting…' : `Accept${challenge.stakeKes > 0 ? ` · KES ${challenge.stakeKes.toLocaleString()}` : ' Challenge'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Challenge Card ───────────────────────────────────────────────────────────

function ChallengeCard({ challenge, currentUserId, onAccept, onCancel, liveData }: {
  challenge: Challenge; currentUserId?: number;
  onAccept: (c: Challenge) => void; onCancel: (id: number) => void;
  liveData?: LiveMatchData;
}) {
  const { status, challengerId, challengedId, winnerId, drawRefunded } = challenge;
  const settled = status === 'settled';
  const active = status === 'active';
  const pending = status === 'pending';
  const canAccept = pending && !!currentUserId && currentUserId !== challengerId && (!challengedId || challengedId === currentUserId);
  const canCancel = (pending || active) && currentUserId === challengerId;

  const live = liveData ? isMatchLive(liveData.status) : false;
  const finished = liveData ? isMatchFinished(liveData.status) : settled;
  const homeScore = liveData?.homeScore ?? null;
  const awayScore = liveData?.awayScore ?? null;

  const challPicks = challenge.challengerPicks.length ? challenge.challengerPicks : parsePicks(challenge.challengerPick);
  const opPicks = challenge.challengedPicks.length ? challenge.challengedPicks : parsePicks(challenge.challengedPick);

  const cPts = (live || finished) ? calcLivePoints(challPicks, homeScore, awayScore) : 0;
  const oPts = (live || finished) ? calcLivePoints(opPicks, homeScore, awayScore) : 0;

  const challengerWon = settled && winnerId === challengerId && !drawRefunded;
  const challengedWon = settled && winnerId === challengedId && !drawRefunded;
  const isDraw = settled && drawRefunded;

  const payout = Math.round(challenge.stakeKes * 2 * 0.9);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      settled ? 'border-border/50 bg-card/80' :
      active && live ? 'border-red-500/30 bg-card shadow-lg shadow-red-500/5' :
      active ? 'border-primary/20 bg-card shadow-md' :
      'border-border bg-card hover:border-primary/30 hover:shadow-md'
    }`}>

      {/* Match header */}
      <div className="px-4 pt-3 pb-2.5 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{challenge.matchLeague}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {!settled && <WatchButton challengeId={challenge.id} initialWatchers={challenge.watchers} />}
            {settled ? (
              isDraw
                ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">🤝 Draw</span>
                : <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/15 text-green-500 border border-green-500/30">✅ Settled</span>
            ) : active && live
              ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">🔴 LIVE</span>
              : active && finished
                ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-muted text-muted-foreground border border-border">⏱ FT</span>
                : active
                  ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/15 text-primary border border-primary/30">⚔️ Active</span>
                  : <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">🔓 Open</span>
            }
          </div>
        </div>
        {/* Score row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <TeamLogo src={challenge.matchHomeLogo} name={challenge.matchHomeTeam} size={24} />
            <span className="text-sm font-semibold text-foreground truncate">{challenge.matchHomeTeam}</span>
          </div>
          <div className="text-center shrink-0 px-2">
            {live && liveData ? (
              <>
                <div className="text-xl font-extrabold tabular-nums text-foreground leading-none">
                  {liveData.homeScore ?? 0} – {liveData.awayScore ?? 0}
                </div>
                <div className="text-xs text-red-400 font-bold">{liveData.minute ? `${liveData.minute}'` : 'LIVE'}</div>
              </>
            ) : (finished || settled) && homeScore !== null ? (
              <>
                <div className="text-lg font-extrabold tabular-nums text-foreground leading-none">
                  {homeScore} – {awayScore}
                </div>
                <div className="text-xs text-muted-foreground font-medium">FT</div>
              </>
            ) : challenge.matchKickoff ? (
              <>
                <div className="text-xs text-muted-foreground">{formatKickoff(challenge.matchKickoff)}</div>
                <div className="text-xs font-bold text-primary">{countdown(challenge.matchKickoff)}</div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">TBD</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-foreground truncate text-right">{challenge.matchAwayTeam}</span>
            <TeamLogo src={challenge.matchAwayLogo} name={challenge.matchAwayTeam} size={24} />
          </div>
        </div>
      </div>

      {/* Battle section */}
      <div className="px-4 py-3 space-y-3">
        {/* Two-column picks battle */}
        <div className="grid grid-cols-2 gap-3">
          {/* Challenger */}
          <div className={`rounded-xl p-3 border ${challengerWon ? 'bg-green-500/10 border-green-500/40' : isDraw ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-muted/40 border-border/60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Avatar src={challenge.challenger?.avatar ?? null} name={challenge.challenger?.displayName || '?'} size={24} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{challenge.challenger?.displayName || `User #${challengerId}`}</div>
                <div className="text-xs text-muted-foreground">{challenge.challenger?.won ?? 0}W · {challenge.challenger?.lost ?? 0}L</div>
              </div>
              {challengerWon && <span className="text-base shrink-0">🏆</span>}
            </div>
            <PicksList picks={challPicks} homeScore={homeScore} awayScore={awayScore} finished={finished || settled} live={live} />
            {(live || finished || settled) && cPts > 0 && (
              <div className={`mt-2 text-center font-bold tabular-nums text-lg ${challengerWon ? 'text-green-400' : cPts > oPts ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                {cPts.toFixed(2)} <span className="text-xs font-normal">pts</span>
              </div>
            )}
          </div>

          {/* Challenged / Open slot */}
          {challenge.challenged && opPicks.length > 0 ? (
            <div className={`rounded-xl p-3 border ${challengedWon ? 'bg-green-500/10 border-green-500/40' : isDraw ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-muted/40 border-border/60'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Avatar src={challenge.challenged.avatar ?? null} name={challenge.challenged.displayName || '?'} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{challenge.challenged.displayName}</div>
                  <div className="text-xs text-muted-foreground">{challenge.challenged.won ?? 0}W · {challenge.challenged.lost ?? 0}L</div>
                </div>
                {challengedWon && <span className="text-base shrink-0">🏆</span>}
              </div>
              <PicksList picks={opPicks} homeScore={homeScore} awayScore={awayScore} finished={finished || settled} live={live} />
              {(live || finished || settled) && oPts > 0 && (
                <div className={`mt-2 text-center font-bold tabular-nums text-lg ${challengedWon ? 'text-green-400' : oPts > cPts ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                  {oPts.toFixed(2)} <span className="text-xs font-normal">pts</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-3 border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 min-h-[100px]">
              {challenge.challenged && !opPicks.length ? (
                <>
                  <Avatar src={challenge.challenged.avatar ?? null} name={challenge.challenged.displayName || '?'} size={28} />
                  <div className="text-xs font-semibold text-foreground text-center">{challenge.challenged.displayName}</div>
                  <span className="text-xs text-muted-foreground italic">Awaiting picks…</span>
                </>
              ) : (
                <>
                  <div className="text-2xl">🎯</div>
                  <div className="text-xs font-semibold text-foreground">Open slot</div>
                  <div className="text-xs text-muted-foreground">Any tipster can join</div>
                  {canAccept && (
                    <button onClick={() => onAccept(challenge)}
                      className="mt-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors">
                      ⚔️ Accept
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* VS + stake in centre (shown above on mobile by floating element) */}
        {challenge.stakeKes > 0 && (
          <div className="flex items-center justify-center gap-2 -mt-1">
            <div className="h-px flex-1 bg-border/50" />
            <div className="text-center px-3">
              <div className="text-sm font-bold text-yellow-500">KES {(challenge.stakeKes * 2).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">prize pot</div>
            </div>
            <div className="h-px flex-1 bg-border/50" />
          </div>
        )}

        {/* Points comparison bar (when both have picks) */}
        {(challPicks.length > 0 && opPicks.length > 0) && (
          <PointsBar
            challengerPicks={challPicks}
            challengedPicks={opPicks}
            homeScore={homeScore}
            awayScore={awayScore}
            challengerName={challenge.challenger?.displayName || 'Challenger'}
            challengedName={challenge.challenged?.displayName || 'Opponent'}
            finished={finished || settled}
            winnerId={settled ? winnerId : undefined}
            challengerId={challengerId}
          />
        )}

        {/* Result line for settled */}
        {settled && (() => {
          const cPtsSettled = calcLivePoints(challPicks, homeScore, awayScore);
          const oPtsSettled = calcLivePoints(opPicks, homeScore, awayScore);
          const tiedOnPts = !isDraw && winnerId !== null && cPtsSettled === oPtsSettled;
          return (
            <div className={`text-center text-sm font-semibold py-1 rounded-lg ${isDraw ? 'text-yellow-500 bg-yellow-500/5' : 'text-green-500 bg-green-500/5'}`}>
              {isDraw ? (
                `🤝 Perfectly tied — draw${challenge.stakeKes > 0 ? ` · KES ${challenge.stakeKes.toLocaleString()} refunded` : ''}`
              ) : tiedOnPts ? (
                <>
                  🏆 {winnerId === challengerId ? challenge.challenger?.displayName : challenge.challenged?.displayName} wins by tiebreaker
                  <span className="text-xs font-normal text-muted-foreground ml-1">(lost fewer pts)</span>
                  {challenge.stakeKes > 0 && ` · KES ${payout.toLocaleString()}`}
                </>
              ) : (
                <>
                  🏆 {winnerId === challengerId ? challenge.challenger?.displayName : challenge.challenged?.displayName} wins
                  {challenge.stakeKes > 0 && ` · KES ${payout.toLocaleString()}`}
                </>
              )}
            </div>
          );
        })()}

        {/* Community vote bar */}
        {(challenge.challengerVotes + challenge.opponentVotes) > 0 && challenge.challenged && (
          <VoteBar
            challengerVotes={challenge.challengerVotes}
            opponentVotes={challenge.opponentVotes}
            challengerName={challenge.challenger?.displayName || 'Challenger'}
            opponentName={challenge.challenged?.displayName || 'Opponent'}
          />
        )}

        {/* Action buttons */}
        {((canAccept && !challenge.challenged) || canCancel) && (
          <div className="flex gap-2 pt-1">
            {canAccept && !challenge.challenged && (
              <button onClick={() => onAccept(challenge)}
                className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors">
                ⚔️ Accept{challenge.stakeKes > 0 ? ` · KES ${challenge.stakeKes.toLocaleString()}` : ' Challenge'}
              </button>
            )}
            {canCancel && (
              <button onClick={() => onCancel(challenge.id)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-sm border border-border transition-colors">
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function ChallengeLeaderboard({ challenges }: { challenges: Challenge[] }) {
  type Stats = { name: string; avatar: string | null; won: number; total: number; ptsFor: number; ptsAgainst: number };
  const stats: Record<number, Stats> = {};

  for (const c of challenges) {
    if (c.status !== 'settled') continue;
    const challPicks = c.challengerPicks.length ? c.challengerPicks : parsePicks(c.challengerPick);
    const opPicks = c.challengedPicks.length ? c.challengedPicks : parsePicks(c.challengedPick);
    const upsert = (id: number, p: typeof c.challenger, picks: PickSelection[], opponentPicks: PickSelection[]) => {
      if (!p) return;
      if (!stats[id]) stats[id] = { name: p.displayName, avatar: p.avatar, won: 0, total: 0, ptsFor: 0, ptsAgainst: 0 };
      stats[id].total++;
      if (c.winnerId === id && !c.drawRefunded) stats[id].won++;
    };
    upsert(c.challengerId, c.challenger, challPicks, opPicks);
    if (c.challengedId && c.challenged) upsert(c.challengedId, c.challenged, opPicks, challPicks);
  }

  const leaders = Object.entries(stats)
    .filter(([, s]) => s.total >= 1)
    .sort(([, a], [, b]) => {
      const aPct = a.won / a.total;
      const bPct = b.won / b.total;
      return bPct - aPct || b.won - a.won;
    })
    .slice(0, 8);

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">🏆 Top Challengers</div>
      {leaders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No settled challenges yet</p>
      ) : (
        <div className="space-y-2.5">
          {leaders.map(([id, s], i) => {
            const winPct = Math.round((s.won / s.total) * 100);
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="w-5 text-center text-sm shrink-0">{MEDALS[i] || <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}</span>
                <Avatar src={s.avatar} name={s.name} size={26} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.won}W / {s.total - s.won}L</div>
                </div>
                <div className={`text-xs font-bold shrink-0 ${winPct >= 70 ? 'text-green-500' : winPct >= 50 ? 'text-yellow-500' : 'text-red-400'}`}>
                  {winPct}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recent Wins ──────────────────────────────────────────────────────────────

function RecentWins({ challenges }: { challenges: Challenge[] }) {
  const recent = challenges
    .filter(c => c.status === 'settled' && c.winnerId && !c.drawRefunded)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  if (!recent.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Recent Wins</div>
      <div className="space-y-2.5">
        {recent.map(c => {
          const winner = c.winnerId === c.challengerId ? c.challenger : c.challenged;
          const payout = Math.round(c.stakeKes * 2 * 0.9);
          return (
            <div key={c.id} className="flex items-center gap-2">
              <span className="text-base shrink-0">🏆</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{winner?.displayName || 'Tipster'}</div>
                <div className="text-xs text-muted-foreground truncate">{c.matchHomeTeam} vs {c.matchAwayTeam}</div>
              </div>
              {payout > 0 && <div className="text-xs font-bold text-green-500 shrink-0">+{payout.toLocaleString()}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: '⚔️ Live', value: 'active' },
  { label: '🔓 Open', value: 'pending' },
  { label: '✅ Settled', value: 'settled' },
];

export default function ChallengesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const opponentParam = searchParams.get('opponent');
  const prefillOpponent = opponentParam ? parseInt(opponentParam, 10) : undefined;

  const [showCreate, setShowCreate] = useState(false);
  const [prefillOpponentId, setPrefillOpponentId] = useState<number | undefined>(undefined);
  const [acceptTarget, setAcceptTarget] = useState<Challenge | null>(null);
  const [tab, setTab] = useState('active');
  const [sportFilter, setSportFilter] = useState('');

  // Auto-open create modal when ?opponent= is in the URL
  useEffect(() => {
    if (prefillOpponent && user) {
      setPrefillOpponentId(prefillOpponent);
      setShowCreate(true);
    }
  }, [prefillOpponent, user]);

  const { data, mutate, isLoading } = useSWR<{ challenges: Challenge[] }>(
    '/api/challenges?status=all', fetcher, { refreshInterval: 30000 });

  const all = data?.challenges || [];

  // Live data for active challenges via SSE (real-time, no polling)
  const liveIds = useMemo(
    () => all.filter(c => c.status === 'active').map(c => c.matchId).filter(Boolean),
    [all]
  );
  // When SSE detects all matches finished & settlement triggered, re-fetch challenges
  const handleAllFinished = useCallback(() => {
    // Small delay to let the server-side settlement complete before re-fetching
    setTimeout(() => { mutate(); }, 2500);
  }, [mutate]);

  const liveMap = useLiveStream(liveIds, handleAllFinished);

  // For the Live tab, exclude challenges whose match is already finished per live data
  // (they're awaiting background settlement — don't show them as "live")
  const activeChallenges = all.filter(c => c.status === 'active');
  const trulyLive = activeChallenges.filter(c => {
    const ld = liveMap[c.matchId];
    if (!ld) return true; // no live data yet — keep visible
    return !isMatchFinished(ld.status);
  });

  const counts = {
    active: trulyLive.length,
    pending: all.filter(c => c.status === 'pending').length,
    settled: all.filter(c => c.status === 'settled').length,
  };

  // Auto-switch to pending tab if no live challenges
  useEffect(() => {
    if (!isLoading && counts.active === 0 && counts.pending > 0 && tab === 'active') setTab('pending');
  }, [isLoading, counts.active, counts.pending, tab]);

  const filtered = all.filter(c => {
    if (c.status !== tab) return false;
    // In the Live tab, hide challenges where the match is already finished per live data
    if (tab === 'active') {
      const ld = liveMap[c.matchId];
      if (ld && isMatchFinished(ld.status)) return false;
    }
    if (sportFilter && !c.matchSport.toLowerCase().includes(sportFilter)) return false;
    return true;
  });

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this challenge? Your stake will be refunded.')) return;
    await fetch(`/api/challenges/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    mutate();
  };

  return (
    <div className="w-full">
      <div className="px-4 py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">⚔️ Tipster Challenges</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Pick a real match · Select your predictions · Points = odds of correct picks · Highest score wins
            </p>
          </div>
          {user && (
            <button onClick={() => setShowCreate(true)}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg transition-colors flex items-center gap-2">
              + Challenge
            </button>
          )}
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Left Sidebar ── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Arena stats */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Arena</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />Live Battles
                  </span>
                  <span className="font-bold text-foreground">{counts.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Open</span>
                  <span className="font-bold text-foreground">{counts.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Settled</span>
                  <span className="font-bold text-foreground">{counts.settled}</span>
                </div>
              </div>
            </div>

            {/* Sport filter */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Sport</div>
              <div className="flex flex-col gap-1">
                {[
                  { label: 'All Sports', value: '' },
                  { label: '⚽ Football', value: 'football' },
                  { label: '🏀 Basketball', value: 'basketball' },
                  { label: '🎾 Tennis', value: 'tennis' },
                  { label: '🏏 Cricket', value: 'cricket' },
                ].map(t => (
                  <button key={t.value} onClick={() => setSportFilter(t.value)}
                    className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${sportFilter === t.value ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* How scoring works */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">How Points Work</div>
              <ol className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary font-bold shrink-0">1.</span>Select 1–5 predictions per match (1X2, Goals, BTTS…)</li>
                <li className="flex gap-2"><span className="text-primary font-bold shrink-0">2.</span>Each correct pick scores its odds as points (e.g. Home Win @2.20 wins = 2.20 pts)</li>
                <li className="flex gap-2"><span className="text-primary font-bold shrink-0">3.</span>Highest total points wins the stake pot (90%)</li>
                <li className="flex gap-2"><span className="text-primary font-bold shrink-0">4.</span>Equal points = draw = full refund</li>
              </ol>
            </div>
          </div>

          {/* ── Centre: Tabs + Cards ── */}
          <div className="lg:col-span-6">
            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl border border-border mb-4">
              {TABS.map(t => (
                <button key={t.value} onClick={() => setTab(t.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors relative ${tab === t.value ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t.label}
                  {t.value === 'active' && counts.active > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{counts.active}</span>
                  )}
                  {t.value === 'pending' && counts.pending > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-yellow-500 text-black text-xs rounded-full">{counts.pending}</span>
                  )}
                </button>
              ))}
            </div>

            {isLoading && (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">⚔️</div>
                <div className="text-lg font-semibold text-foreground mb-1">
                  {tab === 'active' ? 'No live battles right now' : tab === 'pending' ? 'No open challenges' : 'No settled challenges yet'}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {tab === 'settled' ? 'Challenges settle when the match finishes.' : 'Be the first — pick a match and post a challenge.'}
                </p>
                {user && tab !== 'settled' && (
                  <button onClick={() => setShowCreate(true)}
                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-colors">
                    + Create a Challenge
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              {filtered.map(c => (
                <ChallengeCard key={c.id} challenge={c} currentUserId={user?.id}
                  onAccept={setAcceptTarget} onCancel={handleCancel}
                  liveData={liveMap[c.matchId]} />
              ))}
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="lg:col-span-3 space-y-4">
            <ChallengeLeaderboard challenges={all} />
            <RecentWins challenges={all} />
            {!user && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                <div className="text-2xl mb-2">⚔️</div>
                <div className="text-sm font-semibold text-foreground mb-1">Join the Arena</div>
                <p className="text-xs text-muted-foreground mb-3">Sign up to post challenges and compete against other tipsters.</p>
                <a href="/register" className="block py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors">
                  Sign Up Free
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => { setShowCreate(false); setPrefillOpponentId(undefined); }}
          onCreated={() => mutate()}
          prefillOpponentId={prefillOpponentId}
        />
      )}
      {acceptTarget && (
        <AcceptModal challenge={acceptTarget} onClose={() => setAcceptTarget(null)}
          onAccepted={() => { mutate(); setAcceptTarget(null); }} />
      )}
    </div>
  );
}
