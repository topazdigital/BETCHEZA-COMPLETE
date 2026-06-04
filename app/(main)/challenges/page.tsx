'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { pickOptionsForSport } from '@/lib/challenge-picks';
import { isPushSupported, ensurePushSubscribed } from '@/lib/push-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchOdds { home: number; draw: number; away: number }

interface MatchOption {
  id: string;
  homeTeam: string; awayTeam: string;
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
  stakeKes: number; platformFeePct: number;
  status: string; escrowStatus: string;
  isFake: boolean; winnerId: number | null;
  drawRefunded: boolean; isPublic: boolean; watchers: number;
  challengerVotes: number; opponentVotes: number;
  challenger: Participant | null; challenged: Participant | null;
  createdAt: string; updatedAt: string;
}

interface LiveMatchData {
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  minute: number | null;
  odds: MatchOdds | null;
}

interface PickOption { label: string; value: string; group: string }

const fetcher = (url: string) => fetch(url).then(r => r.json());

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
  if (diff <= 0) return 'Started';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getPickOdds(pickValue: string, odds?: MatchOdds | null): number | null {
  if (!odds) return null;
  const p = pickValue.toLowerCase();
  if (p === 'home win') return odds.home > 1 ? odds.home : null;
  if (p === 'draw') return odds.draw > 1 ? odds.draw : null;
  if (p === 'away win') return odds.away > 1 ? odds.away : null;
  return null;
}

// Determine which pick is currently "winning" based on live score
function getPickOutcome(pick: string, homeScore: number | null, awayScore: number | null): 'winning' | 'losing' | 'draw' | null {
  if (homeScore === null || awayScore === null) return null;
  const p = pick.toLowerCase();
  if (p === 'home win') return homeScore > awayScore ? 'winning' : homeScore === awayScore ? 'draw' : 'losing';
  if (p === 'away win') return awayScore > homeScore ? 'winning' : homeScore === awayScore ? 'draw' : 'losing';
  if (p === 'draw') return homeScore === awayScore ? 'winning' : 'losing';
  if (p === 'over 2.5') return (homeScore + awayScore) > 2 ? 'winning' : 'losing';
  if (p === 'under 2.5') return (homeScore + awayScore) < 2 ? 'winning' : 'losing';
  if (p === 'both teams score') return (homeScore > 0 && awayScore > 0) ? 'winning' : 'losing';
  return null;
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

// ─── Participant Avatar ───────────────────────────────────────────────────────

function ParticipantAvatar({ avatar, name, size = 28 }: { avatar: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!avatar || err) {
    return (
      <div className="rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <Image src={avatar} alt={name} width={size} height={size}
    className="rounded-full object-cover shrink-0"
    style={{ width: size, height: size }} onError={() => setErr(true)} unoptimized />;
}

// ─── Pick Badge ───────────────────────────────────────────────────────────────

function PickBadge({ pick, outcome }: { pick: string; outcome?: 'winning' | 'losing' | 'draw' | null }) {
  const cls = outcome === 'winning'
    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
    : outcome === 'draw'
    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
    : outcome === 'losing'
    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
    : 'bg-muted text-muted-foreground border border-border';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{pick}</span>;
}

// ─── Live Momentum Panel ──────────────────────────────────────────────────────

function LivePanel({ challenge, liveData }: { challenge: Challenge; liveData: LiveMatchData }) {
  const { homeScore, awayScore, minute, odds } = liveData;
  const isLive = ['live', 'halftime', 'extra_time', 'inprogress', '1h', '2h', 'ht'].some(s =>
    liveData.status.toLowerCase().includes(s)
  );

  const challengerOutcome = getPickOutcome(challenge.challengerPick, homeScore, awayScore);
  const opponentOutcome = getPickOutcome(challenge.challengedPick || '', homeScore, awayScore);

  // Momentum: which side's pick is currently winning?
  const challengerMomentum = challengerOutcome === 'winning' ? 1 : challengerOutcome === 'draw' ? 0.5 : 0;
  const opponentMomentum = opponentOutcome === 'winning' ? 1 : opponentOutcome === 'draw' ? 0.5 : 0;

  if (!isLive && homeScore === null) return null;

  return (
    <div className="mt-2 rounded-xl bg-muted/30 border border-border/60 overflow-hidden">
      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
          <span className="text-xs font-bold text-red-400 uppercase tracking-wide">
            {isLive ? (minute ? `${minute}'` : 'LIVE') : 'FT'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-lg font-extrabold tabular-nums">
          <span className="text-foreground">{homeScore ?? '-'}</span>
          <span className="text-muted-foreground text-sm">:</span>
          <span className="text-foreground">{awayScore ?? '-'}</span>
        </div>
        <div className="text-xs text-muted-foreground">{challenge.matchHomeTeam.split(' ')[0]} – {challenge.matchAwayTeam.split(' ')[0]}</div>
      </div>

      {/* Which pick is currently winning */}
      {(challengerOutcome || opponentOutcome) && challenge.challengedPick && (
        <div className="px-4 pb-2.5 grid grid-cols-2 gap-2">
          <div className={`rounded-lg p-2 text-center ${challengerOutcome === 'winning' ? 'bg-green-500/10 border border-green-500/30' : challengerOutcome === 'losing' ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/50 border border-border/40'}`}>
            <div className="text-xs font-semibold text-foreground truncate">{challenge.challenger?.displayName?.split(' ')[0] || 'C1'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{challenge.challengerPick}</div>
            <div className={`text-xs font-bold mt-0.5 ${challengerOutcome === 'winning' ? 'text-green-400' : challengerOutcome === 'losing' ? 'text-red-400' : 'text-yellow-400'}`}>
              {challengerOutcome === 'winning' ? '✓ Winning' : challengerOutcome === 'draw' ? '≈ Draw' : '✗ Losing'}
            </div>
          </div>
          <div className={`rounded-lg p-2 text-center ${opponentOutcome === 'winning' ? 'bg-green-500/10 border border-green-500/30' : opponentOutcome === 'losing' ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/50 border border-border/40'}`}>
            <div className="text-xs font-semibold text-foreground truncate">{challenge.challenged?.displayName?.split(' ')[0] || 'C2'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{challenge.challengedPick}</div>
            <div className={`text-xs font-bold mt-0.5 ${opponentOutcome === 'winning' ? 'text-green-400' : opponentOutcome === 'losing' ? 'text-red-400' : 'text-yellow-400'}`}>
              {opponentOutcome === 'winning' ? '✓ Winning' : opponentOutcome === 'draw' ? '≈ Draw' : '✗ Losing'}
            </div>
          </div>
        </div>
      )}

      {/* Live odds momentum */}
      {odds && isLive && (
        <div className="px-4 pb-2.5">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Live odds
          </div>
          <div className="flex gap-1.5">
            {odds.home > 1 && (
              <div className="flex-1 bg-muted/50 rounded-lg px-2 py-1 text-center">
                <div className="text-xs text-muted-foreground">Home</div>
                <div className="text-sm font-bold text-foreground tabular-nums">{odds.home.toFixed(2)}</div>
              </div>
            )}
            {odds.draw > 1 && (
              <div className="flex-1 bg-muted/50 rounded-lg px-2 py-1 text-center">
                <div className="text-xs text-muted-foreground">Draw</div>
                <div className="text-sm font-bold text-foreground tabular-nums">{odds.draw.toFixed(2)}</div>
              </div>
            )}
            {odds.away > 1 && (
              <div className="flex-1 bg-muted/50 rounded-lg px-2 py-1 text-center">
                <div className="text-xs text-muted-foreground">Away</div>
                <div className="text-sm font-bold text-foreground tabular-nums">{odds.away.toFixed(2)}</div>
              </div>
            )}
          </div>
          {/* Momentum bar */}
          {challengerMomentum !== opponentMomentum && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Momentum</div>
              <div className="h-1.5 rounded-full bg-muted flex overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-1000"
                  style={{ width: `${(challengerMomentum / (challengerMomentum + opponentMomentum + 0.001)) * 100}%` }}
                />
                <div
                  className="h-full bg-purple-500 transition-all duration-1000"
                  style={{ width: `${(opponentMomentum / (challengerMomentum + opponentMomentum + 0.001)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                <span className="text-blue-400">{challenge.challenger?.displayName?.split(' ')[0]}</span>
                <span className="text-purple-400">{challenge.challenged?.displayName?.split(' ')[0]}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({ challengerVotes, opponentVotes, challengerName, opponentName }: {
  challengerVotes: number; opponentVotes: number;
  challengerName: string; opponentName: string;
}) {
  const total = challengerVotes + opponentVotes;
  if (total === 0) return null;
  const cPct = Math.round((challengerVotes / total) * 100);
  const oPct = 100 - cPct;
  return (
    <div className="mt-2 px-0.5">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span className="font-medium text-blue-400">{cPct}% {challengerName.split(' ')[0]}</span>
        <span className="text-muted-foreground">{total} community votes</span>
        <span className="font-medium text-purple-400">{opponentName.split(' ')[0]} {oPct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex bg-muted">
        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${cPct}%` }} />
        <div className="h-full bg-purple-500 transition-all duration-700" style={{ width: `${oPct}%` }} />
      </div>
    </div>
  );
}

// ─── Match Search ─────────────────────────────────────────────────────────────

function MatchSearch({ onSelect }: { onSelect: (m: MatchOption) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
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

  useEffect(() => { clearTimeout(timer.current); timer.current = setTimeout(() => search(q), q ? 300 : 0); }, [q, search]);
  useEffect(() => { search(''); }, [search]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={wrap} className="relative">
      <input type="text" placeholder="Search team or league…" value={q}
        onChange={e => setQ(e.target.value)} onFocus={() => setOpen(true)}
        className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors" />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
          {loading && <div className="p-3 text-center text-muted-foreground text-sm">Searching…</div>}
          {!loading && results.length === 0 && <div className="p-3 text-center text-muted-foreground text-sm">No upcoming matches found</div>}
          {results.map(m => (
            <button key={m.id} onClick={() => { onSelect(m); setQ(`${m.homeTeam} vs ${m.awayTeam}`); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left border-b border-border/50 last:border-0">
              <TeamLogo src={m.homeLogo} name={m.homeTeam} size={22} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{m.homeTeam} <span className="text-muted-foreground">vs</span> {m.awayTeam}</div>
                <div className="text-xs text-muted-foreground truncate">{m.league} · {formatKickoff(m.kickoff)}</div>
              </div>
              <TeamLogo src={m.awayLogo} name={m.awayTeam} size={22} />
              {m.status === 'live' && <span className="text-xs font-bold text-red-400 animate-pulse shrink-0">LIVE</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [selectedMatch, setSelectedMatch] = useState<MatchOption | null>(null);
  const [pick, setPick] = useState('');
  const [stakeKes, setStakeKes] = useState(500);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  const pickOptions: PickOption[] = selectedMatch ? pickOptionsForSport(selectedMatch.sport) : [];
  const grouped = pickOptions.reduce<Record<string, PickOption[]>>((acc, o) => {
    (acc[o.group] = acc[o.group] || []).push(o); return acc;
  }, {});

  const handleSubmit = async () => {
    if (!selectedMatch) { setError('Please select a match'); return; }
    if (!pick) { setError('Please choose your prediction'); return; }
    setSubmitting(true); setError(''); setInsufficientBalance(false);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          matchSnapshot: {
            id: selectedMatch.id, homeTeam: selectedMatch.homeTeam, awayTeam: selectedMatch.awayTeam,
            homeLogo: selectedMatch.homeLogo, awayLogo: selectedMatch.awayLogo,
            league: selectedMatch.league, sport: selectedMatch.sport,
            kickoff: selectedMatch.kickoff, status: selectedMatch.status,
          },
          challengerPick: pick, stakeKes, isPublic,
        }),
      });
      const data = await res.json() as { error?: string; insufficientBalance?: boolean };
      if (!res.ok) { if (data.insufficientBalance) setInsufficientBalance(true); setError(data.error || 'Failed to create challenge'); }
      else { onCreated(); onClose(); }
    } catch { setError('Network error. Please try again.'); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">⚔️ Create a Challenge</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pick a match · Choose your prediction · Set your stake</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">1. Select Match</label>
            <MatchSearch onSelect={m => { setSelectedMatch(m); setPick(''); }} />
            {selectedMatch && (
              <div className="mt-2 p-3 rounded-xl bg-muted border border-border">
                <div className="flex items-center gap-3 justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <TeamLogo src={selectedMatch.homeLogo} name={selectedMatch.homeTeam} size={36} />
                    <span className="text-xs font-medium text-foreground text-center leading-tight max-w-[72px]">{selectedMatch.homeTeam}</span>
                  </div>
                  <div className="text-center flex-1">
                    {selectedMatch.status === 'live' ? (
                      <>
                        <div className="text-xl font-extrabold text-foreground tabular-nums">{selectedMatch.homeScore ?? 0} – {selectedMatch.awayScore ?? 0}</div>
                        <div className="text-xs font-bold text-red-400 animate-pulse">🔴 LIVE</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{selectedMatch.league}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-muted-foreground text-xs font-medium">VS</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{selectedMatch.league}</div>
                        <div className="text-xs text-primary mt-0.5">{formatKickoff(selectedMatch.kickoff)}</div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <TeamLogo src={selectedMatch.awayLogo} name={selectedMatch.awayTeam} size={36} />
                    <span className="text-xs font-medium text-foreground text-center leading-tight max-w-[72px]">{selectedMatch.awayTeam}</span>
                  </div>
                </div>
                {selectedMatch.odds && (selectedMatch.odds.home > 0 || selectedMatch.odds.away > 0) && (
                  <div className="mt-3 pt-2.5 border-t border-border flex justify-center gap-5">
                    {selectedMatch.odds.home > 0 && (
                      <div className="text-center"><div className="text-xs text-muted-foreground">1 Home</div><div className="text-sm font-bold text-foreground">{selectedMatch.odds.home.toFixed(2)}</div></div>
                    )}
                    {selectedMatch.odds.draw > 0 && (
                      <div className="text-center"><div className="text-xs text-muted-foreground">X Draw</div><div className="text-sm font-bold text-foreground">{selectedMatch.odds.draw.toFixed(2)}</div></div>
                    )}
                    {selectedMatch.odds.away > 0 && (
                      <div className="text-center"><div className="text-xs text-muted-foreground">2 Away</div><div className="text-sm font-bold text-foreground">{selectedMatch.odds.away.toFixed(2)}</div></div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedMatch && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">2. Your Prediction</label>
              {Object.entries(grouped).map(([group, opts]) => (
                <div key={group} className="mb-3">
                  <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">{group}</div>
                  <div className="flex flex-wrap gap-2">
                    {opts.map(o => {
                      const odd = getPickOdds(o.value, selectedMatch.odds);
                      return (
                        <button key={o.value} onClick={() => setPick(o.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex flex-col items-center leading-tight ${pick === o.value ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-border text-foreground hover:border-primary/50'}`}>
                          <span>{o.label}</span>
                          {odd !== null && <span className={`text-xs font-bold mt-0.5 ${pick === o.value ? 'text-primary-foreground/80' : 'text-yellow-500'}`}>{odd.toFixed(2)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedMatch && pick && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">3. Stake Amount</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {[0, 200, 500, 1000, 2000, 5000].map(v => (
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
                <p className="text-xs text-muted-foreground mt-2">
                  Winner takes <span className="text-green-500 font-semibold">KES {Math.round(stakeKes * 2 * 0.9).toLocaleString()}</span>
                  <span className="text-muted-foreground"> · 10% platform fee · Draw = full refund</span>
                </p>
              )}
              <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <button onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${isPublic ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-foreground">{isPublic ? 'Open — any tipster can accept' : 'Private — invite only'}</div>
                  <div className="text-xs text-muted-foreground">{isPublic ? 'Appears in the Open tab for everyone' : 'Only your opponent can join'}</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {error}
              {insufficientBalance && <a href="/dashboard/wallet" className="block mt-1.5 text-primary text-xs underline">Top up wallet →</a>}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!selectedMatch || !pick || submitting}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-bold transition-colors">
            {submitting ? 'Creating…' : `Post Challenge${stakeKes > 0 ? ` · KES ${stakeKes.toLocaleString()}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Accept Modal ─────────────────────────────────────────────────────────────

function AcceptModal({ challenge, onClose, onAccepted }: { challenge: Challenge; onClose: () => void; onAccepted: () => void }) {
  const pickOptions = pickOptionsForSport(challenge.matchSport);
  const [pick, setPick] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const grouped = pickOptions.reduce<Record<string, PickOption[]>>((acc, o) => {
    (acc[o.group] = acc[o.group] || []).push(o); return acc;
  }, {});

  const handleAccept = async () => {
    if (!pick) { setError('Please select your prediction'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', pick }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) setError(data.error || 'Failed to accept');
      else { onAccepted(); onClose(); }
    } catch { setError('Network error'); } finally { setSubmitting(false); }
  };

  const payout = Math.round(challenge.stakeKes * 2 * 0.9);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">⚔️ Accept Challenge</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Counter-pick · May the best tipster win</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-muted border border-border">
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <TeamLogo src={challenge.matchHomeLogo} name={challenge.matchHomeTeam} size={32} />
                <span className="text-xs text-foreground font-medium">{challenge.matchHomeTeam}</span>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-bold">VS</div>
                <div className="text-xs text-muted-foreground">{challenge.matchLeague}</div>
                <div className="text-xs text-primary">{formatKickoff(challenge.matchKickoff)}</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <TeamLogo src={challenge.matchAwayLogo} name={challenge.matchAwayTeam} size={32} />
                <span className="text-xs text-foreground font-medium">{challenge.matchAwayTeam}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border">
            <ParticipantAvatar avatar={challenge.challenger?.avatar ?? null} name={challenge.challenger?.displayName || '?'} size={32} />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-foreground">{challenge.challenger?.displayName || `User #${challenge.challengerId}`}</div>
              <div className="text-muted-foreground text-xs mt-0.5">picked <PickBadge pick={challenge.challengerPick} /></div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Your Counter-Pick</label>
            {Object.entries(grouped).map(([group, opts]) => (
              <div key={group} className="mb-3">
                <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {opts.map(o => {
                    const taken = o.value === challenge.challengerPick;
                    return (
                      <button key={o.value} onClick={() => !taken && setPick(o.value)} disabled={taken}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${taken ? 'opacity-25 cursor-not-allowed bg-muted border-border text-muted-foreground' : pick === o.value ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-border text-foreground hover:border-primary/50'}`}>
                        {o.label}{taken ? ' (taken)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {challenge.stakeKes > 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600 dark:text-yellow-400">
              ⚠️ Accepting locks <strong>KES {challenge.stakeKes.toLocaleString()}</strong> · Winner takes <strong>KES {payout.toLocaleString()}</strong> · Draw = full refund
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors">Cancel</button>
          <button onClick={handleAccept} disabled={!pick || submitting}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold transition-colors">
            {submitting ? 'Accepting…' : `Accept${challenge.stakeKes > 0 ? ` · KES ${challenge.stakeKes.toLocaleString()}` : ' Challenge'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Watch Button ─────────────────────────────────────────────────────────────

function WatchButton({ challengeId, initialWatchers }: { challengeId: number; initialWatchers: number }) {
  const [watching, setWatching] = useState(false);
  const [count, setCount] = useState(initialWatchers);
  const [busy, setBusy] = useState(false);
  const storageKey = `watched_challenge_${challengeId}`;
  useEffect(() => { setWatching(!!localStorage.getItem(storageKey)); }, [storageKey]);

  async function handleWatch() {
    if (watching || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/challenges/${challengeId}/watch`, { method: 'POST' });
      setCount(c => c + 1); setWatching(true); localStorage.setItem(storageKey, '1');
      if (isPushSupported()) await ensurePushSubscribed({ topics: [`challenge_${challengeId}`, 'challenge_results'] });
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <button onClick={handleWatch} disabled={watching || busy}
      title={watching ? 'Watching — notified when this settles' : 'Watch for result notification'}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors border ${watching ? 'border-purple-500/40 bg-purple-500/10 text-purple-400 cursor-default' : 'border-border bg-muted/60 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>
      <span>👁</span>
      <span>{count > 0 ? count : ''}{watching ? ' Watching' : ' Watch'}</span>
    </button>
  );
}

// ─── Challenge Card ───────────────────────────────────────────────────────────

function ChallengeCard({ challenge, currentUserId, onAccept, onCancel, liveData }: {
  challenge: Challenge; currentUserId?: number;
  onAccept: (c: Challenge) => void; onCancel: (id: number) => void;
  liveData?: LiveMatchData;
}) {
  const { challengerId, challengedId, winnerId, drawRefunded, status } = challenge;
  const settled = status === 'settled';
  const active = status === 'active';
  const pending = status === 'pending';
  const challengerWon = settled && winnerId === challengerId && !drawRefunded;
  const challengedWon = settled && winnerId === challengedId && !drawRefunded;
  const isDraw = settled && drawRefunded;
  const canAccept = pending && !!currentUserId && currentUserId !== challengerId && (!challengedId || challengedId === currentUserId);
  const canCancel = (pending || active) && currentUserId === challengerId;
  const payout = Math.round(challenge.stakeKes * 2 * 0.9);

  const isMatchLive = liveData && ['live', 'halftime', 'extra_time', 'inprogress', '1h', '2h', 'ht'].some(s =>
    liveData.status.toLowerCase().includes(s));

  const challengerOutcome = active && liveData
    ? getPickOutcome(challenge.challengerPick, liveData.homeScore, liveData.awayScore)
    : null;
  const challengedOutcome = active && liveData && challenge.challengedPick
    ? getPickOutcome(challenge.challengedPick, liveData.homeScore, liveData.awayScore)
    : null;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${settled ? 'border-border/50 bg-card/60' : active ? 'border-border bg-card shadow-md' : 'border-border bg-card hover:border-primary/30'}`}>
      {/* Match header */}
      <div className="px-4 pt-3 pb-2 border-b border-border/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{challenge.matchLeague}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {!settled && <WatchButton challengeId={challenge.id} initialWatchers={challenge.watchers} />}
            {settled ? (
              isDraw ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">🤝 Draw</span>
                : <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/15 text-green-500 border border-green-500/30">✅ Settled</span>
            ) : active ? (
              isMatchLive
                ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">🔴 LIVE</span>
                : <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/15 text-green-500 border border-green-500/30">⚔️ Active</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/15 text-primary border border-primary/30">🔓 Open</span>
            )}
          </div>
        </div>
        {/* Teams row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <TeamLogo src={challenge.matchHomeLogo} name={challenge.matchHomeTeam} size={26} />
            <span className="text-sm font-semibold text-foreground truncate">{challenge.matchHomeTeam}</span>
          </div>
          <div className="text-center shrink-0 px-1">
            {isMatchLive && liveData ? (
              <>
                <div className="text-lg font-extrabold tabular-nums text-foreground leading-none">{liveData.homeScore ?? 0} – {liveData.awayScore ?? 0}</div>
                <div className="text-xs text-red-400 font-bold">{liveData.minute ? `${liveData.minute}'` : 'LIVE'}</div>
              </>
            ) : challenge.matchKickoff && !settled ? (
              <>
                <div className="text-xs text-muted-foreground">{formatKickoff(challenge.matchKickoff)}</div>
                <div className="text-xs font-bold text-primary">{countdown(challenge.matchKickoff)}</div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">{settled ? 'FT' : 'TBD'}</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-foreground truncate text-right">{challenge.matchAwayTeam}</span>
            <TeamLogo src={challenge.matchAwayLogo} name={challenge.matchAwayTeam} size={26} />
          </div>
        </div>
      </div>

      {/* Battle */}
      <div className="px-4 py-3">
        <div className="flex items-stretch gap-2">
          {/* Challenger */}
          <div className={`flex-1 rounded-xl p-3 border ${challengerWon ? 'bg-green-500/10 border-green-500/40' : isDraw ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-muted/50 border-border/50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <ParticipantAvatar avatar={challenge.challenger?.avatar ?? null} name={challenge.challenger?.displayName || `U${challengerId}`} size={26} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{challenge.challenger?.displayName || `User #${challengerId}`}</div>
                <div className="text-xs text-muted-foreground">{challenge.challenger?.won ?? 0}W / {challenge.challenger?.lost ?? 0}L</div>
              </div>
              {challengerWon && <span className="text-sm shrink-0">🏆</span>}
            </div>
            <PickBadge pick={challenge.challengerPick} outcome={challengerOutcome} />
          </div>

          {/* Centre VS */}
          <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 px-1">
            <span className="text-muted-foreground text-xs font-bold">VS</span>
            {challenge.stakeKes > 0 && (
              <div className="text-center">
                <div className="text-xs font-bold text-yellow-500">KES {(challenge.stakeKes * 2).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">pot</div>
              </div>
            )}
          </div>

          {/* Challenged / Open slot */}
          <div className={`flex-1 rounded-xl p-3 border ${challengedWon ? 'bg-green-500/10 border-green-500/40' : isDraw ? 'bg-yellow-500/10 border-yellow-500/30' : challenge.challenged ? 'bg-muted/50 border-border/50' : 'bg-muted/20 border-dashed border-border'}`}>
            {challenge.challenged ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {challengedWon && <span className="text-sm shrink-0">🏆</span>}
                  <ParticipantAvatar avatar={challenge.challenged.avatar ?? null} name={challenge.challenged.displayName || `U${challengedId}`} size={26} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{challenge.challenged.displayName}</div>
                    <div className="text-xs text-muted-foreground">{challenge.challenged.won ?? 0}W / {challenge.challenged.lost ?? 0}L</div>
                  </div>
                </div>
                {challenge.challengedPick
                  ? <PickBadge pick={challenge.challengedPick} outcome={challengedOutcome} />
                  : <span className="text-xs text-muted-foreground italic">Awaiting pick…</span>}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-1 text-center py-0.5">
                <div className="text-lg">🎯</div>
                <div className="text-xs font-semibold text-foreground">Open slot</div>
                <div className="text-xs text-muted-foreground">Any tipster</div>
                {canAccept && (
                  <button onClick={() => onAccept(challenge)}
                    className="mt-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors">
                    ⚔️ Join
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live panel — score + odds + momentum */}
        {active && liveData && (
          <LivePanel challenge={challenge} liveData={liveData} />
        )}

        {/* Community vote bar */}
        {(challenge.challengerVotes + challenge.opponentVotes) > 0 && (
          <VoteBar
            challengerVotes={challenge.challengerVotes}
            opponentVotes={challenge.opponentVotes}
            challengerName={challenge.challenger?.displayName || 'Challenger'}
            opponentName={challenge.challenged?.displayName || 'Opponent'}
          />
        )}

        {/* Result line */}
        {settled && challenge.stakeKes > 0 && (
          <div className="mt-2 text-center text-xs">
            {isDraw ? (
              <span className="text-yellow-500">Stakes refunded · Draw on this market</span>
            ) : winnerId ? (
              <span className="text-green-500 font-medium">
                {winnerId === challengerId ? challenge.challenger?.displayName : challenge.challenged?.displayName} won KES {payout.toLocaleString()} 🏆
              </span>
            ) : null}
          </div>
        )}

        {/* Action buttons */}
        {((canAccept && !challenge.challenged) || canCancel) && (
          <div className="mt-3 flex gap-2">
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
  type Stats = { name: string; avatar: string | null; won: number; total: number };
  const stats: Record<number, Stats> = {};

  for (const c of challenges) {
    if (c.status !== 'settled') continue;
    const upsert = (id: number, p: typeof c.challenger) => {
      if (!p) return;
      if (!stats[id]) stats[id] = { name: p.displayName, avatar: p.avatar, won: 0, total: 0 };
      stats[id].total++;
      if (c.winnerId === id && !c.drawRefunded) stats[id].won++;
    };
    upsert(c.challengerId, c.challenger);
    if (c.challengedId && c.challenged) upsert(c.challengedId, c.challenged);
  }

  const leaders = Object.entries(stats)
    .filter(([, s]) => s.total >= 1)
    .sort(([, a], [, b]) => (b.won / b.total) - (a.won / a.total) || b.won - a.won)
    .slice(0, 8);

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        🏆 Top Challengers
      </div>
      {leaders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No settled challenges yet — first battle wins the top spot!</p>
      ) : (
        <div className="space-y-2.5">
          {leaders.map(([id, s], i) => {
            const winPct = Math.round((s.won / s.total) * 100);
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="w-5 text-center text-sm shrink-0">{MEDALS[i] ?? <span className="text-xs text-muted-foreground font-bold">{i + 1}</span>}</span>
                <ParticipantAvatar avatar={s.avatar} name={s.name} size={26} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.won}W / {s.total - s.won}L</div>
                </div>
                <div className={`text-xs font-bold shrink-0 ${winPct >= 70 ? 'text-green-500' : winPct >= 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
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

function RecentActivity({ challenges }: { challenges: Challenge[] }) {
  const recent = challenges
    .filter(c => c.status === 'settled' && c.winnerId && !c.drawRefunded)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  if (recent.length === 0) return null;
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

const STATUS_TABS = [
  { label: '⚔️ Live', value: 'active' },
  { label: '🔓 Open', value: 'pending' },
  { label: '✅ Settled', value: 'settled' },
];

export default function ChallengesPage() {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<Challenge | null>(null);
  const [statusTab, setStatusTab] = useState('active');
  const [sportFilter, setSportFilter] = useState('');

  const { data, mutate, isLoading } = useSWR<{ challenges: Challenge[] }>(
    '/api/challenges?status=all', fetcher, { refreshInterval: 30000 });

  const all = data?.challenges || [];
  const liveMatchIds = all.filter(c => c.status === 'active').map(c => c.matchId).filter(Boolean);

  // Fetch live data for all active challenge matches (updates every 45s)
  const liveKey = liveMatchIds.length > 0
    ? `/api/challenges/live-data?matchIds=${liveMatchIds.join(',')}`
    : null;
  const { data: liveDataResp } = useSWR<{ data: Record<string, LiveMatchData> }>(
    liveKey, fetcher, { refreshInterval: 45000 });
  const liveDataMap: Record<string, LiveMatchData> = liveDataResp?.data || {};

  const filtered = all.filter(c => {
    if (c.status !== statusTab) return false;
    if (sportFilter && !c.matchSport.toLowerCase().includes(sportFilter)) return false;
    return true;
  });

  const stats = {
    live: all.filter(c => c.status === 'active').length,
    open: all.filter(c => c.status === 'pending').length,
    settled: all.filter(c => c.status === 'settled').length,
  };

  useEffect(() => {
    if (!isLoading && stats.live === 0 && stats.open > 0 && statusTab === 'active') {
      setStatusTab('pending');
    }
  }, [isLoading, stats.live, stats.open, statusTab]);

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
              Pick a real match, call the result, stake KES. Correct prediction wins 90% of the pot. Draw = full refund.
            </p>
          </div>
          {user && (
            <button onClick={() => setShowCreate(true)}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg transition-colors flex items-center gap-2">
              + Challenge
            </button>
          )}
        </div>

        {/* 3-column layout: left sidebar | cards | right sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Left sidebar ── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Arena stats */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Arena</div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Live Battles
                  </span>
                  <span className="font-bold text-foreground">{stats.live}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Open</span><span className="font-bold text-foreground">{stats.open}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Settled</span><span className="font-bold text-foreground">{stats.settled}</span></div>
              </div>
            </div>

            {/* Sport filter */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Sport</div>
              <div className="flex flex-col gap-1">
                {[
                  { label: 'All', value: '' },
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

            {/* How it works */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">How It Works</div>
              <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                <li>Choose a real upcoming match</li>
                <li>Pick your prediction — 1X2, Over/Under, BTTS…</li>
                <li>Set your KES stake · Opponent matches it</li>
                <li>Match ends → correct pick wins 90% of pot</li>
                <li>Draw = both stakes refunded, no fee</li>
              </ol>
            </div>
          </div>

          {/* ── Centre: tabs + cards ── */}
          <div className="lg:col-span-6">
            <div className="flex gap-1 p-1 bg-muted rounded-xl border border-border mb-4">
              {STATUS_TABS.map(t => (
                <button key={t.value} onClick={() => setStatusTab(t.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${statusTab === t.value ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t.label}
                  {t.value === 'active' && stats.live > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{stats.live}</span>}
                  {t.value === 'pending' && stats.open > 0 && <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">{stats.open}</span>}
                </button>
              ))}
            </div>

            {isLoading && (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">⚔️</div>
                <div className="text-lg font-semibold text-foreground mb-1">
                  {statusTab === 'active' ? 'No live battles right now' : statusTab === 'pending' ? 'No open challenges' : 'No settled challenges yet'}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {statusTab === 'settled' ? 'Challenges settle automatically when the match finishes.' : 'Be the first — pick a match and post a challenge.'}
                </p>
                {user && statusTab !== 'settled' && (
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
                  liveData={liveDataMap[c.matchId]} />
              ))}
            </div>
          </div>

          {/* ── Right sidebar: leaderboard + recent wins ── */}
          <div className="lg:col-span-3 space-y-4">
            <ChallengeLeaderboard challenges={all} />
            <RecentActivity challenges={all} />

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

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => mutate()} />}
      {acceptTarget && <AcceptModal challenge={acceptTarget} onClose={() => setAcceptTarget(null)} onAccepted={() => { mutate(); setAcceptTarget(null); }} />}
    </div>
  );
}
