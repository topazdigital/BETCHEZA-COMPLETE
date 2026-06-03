'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { pickOptionsForSport } from '@/lib/challenge-picks';
import { isPushSupported, ensurePushSubscribed } from '@/lib/push-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

interface MatchOption {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  league: string;
  sport: string;
  sportName: string;
  kickoff: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  odds?: MatchOdds;
}

interface Participant {
  userId: number;
  username: string;
  displayName: string;
  avatar: string | null;
  tips: number;
  won: number;
  lost: number;
  streak: number;
  roi: number;
  isFake: boolean;
}

interface Challenge {
  id: number;
  matchId: string;
  matchHomeTeam: string;
  matchAwayTeam: string;
  matchHomeLogo: string | null;
  matchAwayLogo: string | null;
  matchLeague: string;
  matchSport: string;
  matchKickoff: string | null;
  matchStatus: string;
  challengerId: number;
  challengedId: number | null;
  challengerPick: string;
  challengedPick: string | null;
  stakeKes: number;
  platformFeePct: number;
  status: string;
  escrowStatus: string;
  isFake: boolean;
  winnerId: number | null;
  drawRefunded: boolean;
  isPublic: boolean;
  watchers: number;
  challenger: Participant | null;
  challenged: Participant | null;
  createdAt: string;
  updatedAt: string;
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
  if (h > 48) return `${Math.floor(h / 24)}d away`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Map a pick value to its odds from the match odds object
function getPickOdds(pickValue: string, odds?: MatchOdds): number | null {
  if (!odds) return null;
  const p = pickValue.toLowerCase();
  if (p === 'home win') return odds.home > 0 ? odds.home : null;
  if (p === 'draw') return odds.draw > 0 ? odds.draw : null;
  if (p === 'away win') return odds.away > 0 ? odds.away : null;
  return null;
}

// ─── Team Logo ────────────────────────────────────────────────────────────────

function TeamLogo({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        className="rounded-full bg-gray-700 flex items-center justify-center font-bold text-white shrink-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <Image src={src} alt={name} width={size} height={size}
      className="rounded-full object-contain shrink-0 bg-gray-800"
      style={{ width: size, height: size }} onError={() => setErr(true)} unoptimized />
  );
}

// ─── Participant Avatar ───────────────────────────────────────────────────────

function ParticipantAvatar({ avatar, name, size = 28 }: { avatar: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!avatar || err) {
    return (
      <div
        className="rounded-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center font-bold text-white shrink-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <Image src={avatar} alt={name} width={size} height={size}
      className="rounded-full object-cover shrink-0 bg-gray-800"
      style={{ width: size, height: size }} onError={() => setErr(true)} unoptimized />
  );
}

// ─── Pick Badge ───────────────────────────────────────────────────────────────

function PickBadge({ pick, won, draw }: { pick: string; won?: boolean; draw?: boolean }) {
  const cls = won
    ? 'bg-green-600 text-white'
    : draw
    ? 'bg-yellow-600 text-black'
    : 'bg-gray-700 text-gray-200';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{pick}</span>;
}

// ─── Match Search Dropdown ────────────────────────────────────────────────────

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
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), q ? 300 : 0);
  }, [q, search]);

  useEffect(() => { search(''); }, [search]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={wrap} className="relative">
      <input
        type="text"
        placeholder="Search team or league (e.g. Arsenal, UCL)…"
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
          {loading && <div className="p-3 text-center text-gray-400 text-sm">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="p-3 text-center text-gray-500 text-sm">No upcoming matches found</div>
          )}
          {results.map(m => (
            <button key={m.id}
              onClick={() => { onSelect(m); setQ(`${m.homeTeam} vs ${m.awayTeam}`); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 last:border-0">
              <TeamLogo src={m.homeLogo} name={m.homeTeam} size={24} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {m.homeTeam} <span className="text-gray-500">vs</span> {m.awayTeam}
                </div>
                <div className="text-xs text-gray-400 truncate">{m.league} · {formatKickoff(m.kickoff)}</div>
              </div>
              <TeamLogo src={m.awayLogo} name={m.awayTeam} size={24} />
              {m.status === 'live' && (
                <span className="text-xs font-bold text-red-400 animate-pulse shrink-0">LIVE</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Challenge Modal ───────────────────────────────────────────────────

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
    (acc[o.group] = acc[o.group] || []).push(o);
    return acc;
  }, {});

  const handleSubmit = async () => {
    if (!selectedMatch) { setError('Please select a match'); return; }
    if (!pick) { setError('Please choose your prediction'); return; }
    setSubmitting(true); setError(''); setInsufficientBalance(false);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          matchSnapshot: {
            id: selectedMatch.id,
            homeTeam: selectedMatch.homeTeam, awayTeam: selectedMatch.awayTeam,
            homeLogo: selectedMatch.homeLogo, awayLogo: selectedMatch.awayLogo,
            league: selectedMatch.league, sport: selectedMatch.sport,
            kickoff: selectedMatch.kickoff, status: selectedMatch.status,
          },
          challengerPick: pick,
          stakeKes,
          isPublic,
        }),
      });
      const data = await res.json() as { error?: string; insufficientBalance?: boolean };
      if (!res.ok) {
        if (data.insufficientBalance) setInsufficientBalance(true);
        setError(data.error || 'Failed to create challenge');
      } else {
        onCreated(); onClose();
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">⚔️ Create a Challenge</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose a real match · Pick a prediction · Set your stake</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Step 1 — Match */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              1. Select an Upcoming Match
            </label>
            <MatchSearch onSelect={m => { setSelectedMatch(m); setPick(''); }} />
            {selectedMatch && (
              <div className="mt-2 p-3 rounded-xl bg-gray-800 border border-gray-700">
                <div className="flex items-center gap-3 justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <TeamLogo src={selectedMatch.homeLogo} name={selectedMatch.homeTeam} size={36} />
                    <span className="text-xs font-medium text-white text-center leading-tight max-w-[72px]">{selectedMatch.homeTeam}</span>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-gray-500 text-xs font-medium">VS</div>
                    <div className="text-xs text-gray-400 mt-0.5">{selectedMatch.league}</div>
                    <div className="text-xs text-blue-400 mt-0.5">{formatKickoff(selectedMatch.kickoff)}</div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <TeamLogo src={selectedMatch.awayLogo} name={selectedMatch.awayTeam} size={36} />
                    <span className="text-xs font-medium text-white text-center leading-tight max-w-[72px]">{selectedMatch.awayTeam}</span>
                  </div>
                </div>
                {/* Odds row */}
                {selectedMatch.odds && (selectedMatch.odds.home > 0 || selectedMatch.odds.away > 0) && (
                  <div className="mt-3 pt-2.5 border-t border-gray-700 flex justify-center gap-3">
                    {selectedMatch.odds.home > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500">1 Home</span>
                        <span className="text-sm font-bold text-white">{selectedMatch.odds.home.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedMatch.odds.draw > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500">X Draw</span>
                        <span className="text-sm font-bold text-white">{selectedMatch.odds.draw.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedMatch.odds.away > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-500">2 Away</span>
                        <span className="text-sm font-bold text-white">{selectedMatch.odds.away.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2 — Pick */}
          {selectedMatch && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">2. Your Prediction</label>
              {Object.entries(grouped).map(([group, opts]) => (
                <div key={group} className="mb-3">
                  <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">{group}</div>
                  <div className="flex flex-wrap gap-2">
                    {opts.map(o => {
                      const odd = getPickOdds(o.value, selectedMatch.odds);
                      return (
                        <button key={o.value} onClick={() => setPick(o.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex flex-col items-center leading-tight ${pick === o.value ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'}`}>
                          <span>{o.label}</span>
                          {odd !== null && (
                            <span className={`text-xs font-bold mt-0.5 ${pick === o.value ? 'text-blue-200' : 'text-yellow-400'}`}>
                              {odd.toFixed(2)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3 — Stake */}
          {selectedMatch && pick && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">3. Stake Amount</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {[0, 200, 500, 1000, 2000, 5000].map(v => (
                  <button key={v} onClick={() => setStakeKes(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${stakeKes === v ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                    {v === 0 ? 'Free' : `KES ${v.toLocaleString()}`}
                  </button>
                ))}
              </div>
              <input type="number" min={0} step={50} value={stakeKes}
                onChange={e => setStakeKes(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="Custom amount…"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-blue-500" />
              {stakeKes > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Winner receives <span className="text-green-400 font-semibold">KES {Math.round(stakeKes * 2 * 0.9).toLocaleString()}</span>
                  <span className="text-gray-500"> · 10% platform fee · Draw = full refund</span>
                </p>
              )}

              <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                <button onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${isPublic ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-white">{isPublic ? 'Open challenge — any tipster can accept' : 'Private challenge — invite only'}</div>
                  <div className="text-xs text-gray-400">{isPublic ? 'Goes live on the Open tab for everyone to see' : 'Share your link to invite a specific opponent'}</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg p-3 bg-red-900/30 border border-red-800 text-red-300 text-sm">
              {error}
              {insufficientBalance && (
                <a href="/dashboard/wallet" className="block mt-1.5 text-blue-400 text-xs underline">Top up your wallet →</a>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!selectedMatch || !pick || submitting}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-colors">
            {submitting ? 'Creating…' : `Post Challenge${stakeKes > 0 ? ` · KES ${stakeKes.toLocaleString()}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Accept Modal ─────────────────────────────────────────────────────────────

function AcceptModal({ challenge, onClose, onAccepted }: {
  challenge: Challenge; onClose: () => void; onAccepted: () => void;
}) {
  const pickOptions = pickOptionsForSport(challenge.matchSport);
  const [pick, setPick] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const grouped = pickOptions.reduce<Record<string, PickOption[]>>((acc, o) => {
    (acc[o.group] = acc[o.group] || []).push(o);
    return acc;
  }, {});

  const handleAccept = async () => {
    if (!pick) { setError('Please select your prediction'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', pick }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) setError(data.error || 'Failed to accept');
      else { onAccepted(); onClose(); }
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  const pot = challenge.stakeKes * 2;
  const payout = Math.round(pot * 0.9);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">⚔️ Accept Challenge</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pick the opposite — may the best tipster win</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Match */}
          <div className="p-3 rounded-xl bg-gray-800 border border-gray-700">
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <TeamLogo src={challenge.matchHomeLogo} name={challenge.matchHomeTeam} size={32} />
                <span className="text-xs text-white font-medium">{challenge.matchHomeTeam}</span>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 font-bold">VS</div>
                <div className="text-xs text-gray-400 mt-0.5">{challenge.matchLeague}</div>
                <div className="text-xs text-blue-400">{formatKickoff(challenge.matchKickoff)}</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <TeamLogo src={challenge.matchAwayLogo} name={challenge.matchAwayTeam} size={32} />
                <span className="text-xs text-white font-medium">{challenge.matchAwayTeam}</span>
              </div>
            </div>
          </div>

          {/* Challenger's pick */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-800/50 border border-gray-700">
            <ParticipantAvatar avatar={challenge.challenger?.avatar ?? null} name={challenge.challenger?.displayName || '?'} size={32} />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-white text-sm">{challenge.challenger?.displayName || `User #${challenge.challengerId}`}</div>
              <div className="text-gray-400 text-xs mt-0.5">
                called <PickBadge pick={challenge.challengerPick} />
              </div>
            </div>
            <div className="text-xs text-gray-500 font-medium">their pick</div>
          </div>

          {/* Pick selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Your Counter-Pick</label>
            {Object.entries(grouped).map(([group, opts]) => (
              <div key={group} className="mb-3">
                <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {opts.map(o => {
                    const taken = o.value === challenge.challengerPick;
                    return (
                      <button key={o.value} onClick={() => !taken && setPick(o.value)} disabled={taken}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${taken ? 'opacity-25 cursor-not-allowed bg-gray-800 border-gray-700 text-gray-400' : pick === o.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                        {o.label}{taken ? ' (taken)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {challenge.stakeKes > 0 && (
            <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-800/40 text-xs text-yellow-300">
              ⚠️ Accepting locks <strong>KES {challenge.stakeKes.toLocaleString()}</strong> from your wallet.
              Winner takes <strong>KES {payout.toLocaleString()}</strong> · Draw = full refund.
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors">Cancel</button>
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

  useEffect(() => {
    setWatching(!!localStorage.getItem(storageKey));
  }, [storageKey]);

  async function handleWatch() {
    if (watching || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/challenges/${challengeId}/watch`, { method: 'POST' });
      setCount(c => c + 1);
      setWatching(true);
      localStorage.setItem(storageKey, '1');
      if (isPushSupported()) {
        await ensurePushSubscribed({ topics: [`challenge_${challengeId}`, 'challenge_results'] });
      }
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <button
      onClick={handleWatch}
      disabled={watching || busy}
      title={watching ? 'Watching — you\'ll be notified when this settles' : 'Watch and get notified when this settles'}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors border ${
        watching
          ? 'border-purple-700/50 bg-purple-900/20 text-purple-300 cursor-default'
          : 'border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-500 hover:text-white'
      }`}
    >
      <span className={watching ? 'text-purple-400' : 'text-gray-500'}>👁</span>
      <span>{count > 0 ? count : ''}{watching ? ' Watching' : ' Watch'}</span>
    </button>
  );
}

// ─── Challenge Card ───────────────────────────────────────────────────────────

function ChallengeCard({ challenge, currentUserId, onAccept, onCancel }: {
  challenge: Challenge;
  currentUserId?: number;
  onAccept: (c: Challenge) => void;
  onCancel: (id: number) => void;
}) {
  const { challengerId, challengedId, winnerId, drawRefunded, status } = challenge;
  const settled = status === 'settled';
  const active = status === 'active';
  const pending = status === 'pending';

  const challengerWon = settled && winnerId === challengerId && !drawRefunded;
  const challengedWon = settled && winnerId === challengedId && !drawRefunded;
  const isDraw = settled && drawRefunded;

  const canAccept = pending && currentUserId && currentUserId !== challengerId && (!challengedId || challengedId === currentUserId);
  const canCancel = (pending || active) && currentUserId === challengerId;

  const payout = Math.round(challenge.stakeKes * 2 * 0.9);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${settled ? 'border-gray-800 bg-gray-900/40' : active ? 'border-green-800/60 bg-gray-900 shadow-lg shadow-green-900/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}>
      {/* Match row */}
      <div className="px-4 pt-3 pb-2.5 border-b border-gray-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 truncate">{challenge.matchLeague}</span>
          <div className="flex items-center gap-2 shrink-0">
            {/* Watcher button */}
            {!settled && (
              <WatchButton challengeId={challenge.id} initialWatchers={challenge.watchers} />
            )}
            {settled && challenge.watchers > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <span>👁</span><span>{challenge.watchers}</span>
              </span>
            )}
            {/* Status badge */}
            {settled ? (
              isDraw
                ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-700/30 text-yellow-300 border border-yellow-700/50">🤝 Draw</span>
                : <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-700/30 text-purple-300 border border-purple-700/50">✅ Settled</span>
            ) : active ? (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-700/30 text-green-300 border border-green-700/50 animate-pulse">⚔️ Active</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-700/30 text-blue-300 border border-blue-700/50">🔓 Open</span>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamLogo src={challenge.matchHomeLogo} name={challenge.matchHomeTeam} size={30} />
            <span className="text-sm font-semibold text-white truncate">{challenge.matchHomeTeam}</span>
          </div>
          <div className="text-center shrink-0">
            {challenge.matchKickoff && !settled && (
              <div className="text-xs text-gray-500">{formatKickoff(challenge.matchKickoff)}</div>
            )}
            {challenge.matchKickoff && !settled && (
              <div className="text-xs font-bold text-blue-400">{countdown(challenge.matchKickoff)}</div>
            )}
            {settled && <div className="text-xs text-gray-500">Finished</div>}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-white truncate text-right">{challenge.matchAwayTeam}</span>
            <TeamLogo src={challenge.matchAwayLogo} name={challenge.matchAwayTeam} size={30} />
          </div>
        </div>
      </div>

      {/* Battle section */}
      <div className="px-4 py-3">
        <div className="flex items-stretch gap-2">
          {/* Challenger */}
          <div className={`flex-1 rounded-xl p-3 border ${challengerWon ? 'bg-green-900/20 border-green-700/50' : isDraw ? 'bg-yellow-900/10 border-yellow-700/30' : settled ? 'bg-gray-800/30 border-gray-700/30' : 'bg-gray-800/50 border-gray-700/50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <ParticipantAvatar
                avatar={challenge.challenger?.avatar ?? null}
                name={challenge.challenger?.displayName || `U${challengerId}`}
                size={28}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{challenge.challenger?.displayName || `User #${challengerId}`}</div>
                <div className="text-xs text-gray-500">
                  {challenge.challenger?.won ?? 0}W / {challenge.challenger?.lost ?? 0}L
                </div>
              </div>
              {challengerWon && <span className="text-base shrink-0">🏆</span>}
            </div>
            <PickBadge pick={challenge.challengerPick} won={challengerWon} draw={isDraw} />
          </div>

          {/* Centre */}
          <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-1">
            <span className="text-gray-600 text-xs font-bold">VS</span>
            {challenge.stakeKes > 0 && (
              <div className="text-center">
                <div className="text-xs font-bold text-yellow-400">KES {(challenge.stakeKes * 2).toLocaleString()}</div>
                <div className="text-xs text-gray-600">pot</div>
              </div>
            )}
          </div>

          {/* Challenged */}
          <div className={`flex-1 rounded-xl p-3 border ${challengedWon ? 'bg-green-900/20 border-green-700/50' : isDraw ? 'bg-yellow-900/10 border-yellow-700/30' : settled ? 'bg-gray-800/30 border-gray-700/30' : challenge.challenged ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-800/30 border-dashed border-gray-600'}`}>
            {challenge.challenged ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {challengedWon && <span className="text-base shrink-0">🏆</span>}
                  <ParticipantAvatar
                    avatar={challenge.challenged.avatar ?? null}
                    name={challenge.challenged.displayName || `U${challengedId}`}
                    size={28}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{challenge.challenged.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {challenge.challenged.won ?? 0}W / {challenge.challenged.lost ?? 0}L
                    </div>
                  </div>
                </div>
                {challenge.challengedPick
                  ? <PickBadge pick={challenge.challengedPick} won={challengedWon} draw={isDraw} />
                  : <span className="text-xs text-gray-600 italic">Awaiting pick…</span>
                }
              </>
            ) : (
              /* Open slot — any tipster can join */
              <div className="flex flex-col items-center justify-center h-full gap-1.5 text-center py-1">
                <div className="text-lg">🎯</div>
                <div className="text-xs font-semibold text-gray-300">Open slot</div>
                <div className="text-xs text-gray-500">Any tipster can join</div>
                {canAccept && (
                  <button onClick={() => onAccept(challenge)}
                    className="mt-1 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-green-900/30">
                    ⚔️ Join
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Settled result line */}
        {settled && challenge.stakeKes > 0 && (
          <div className="mt-2.5 text-center text-xs">
            {isDraw ? (
              <span className="text-yellow-400">Both stakes refunded · Match ended in a draw on this market</span>
            ) : winnerId ? (
              <span className="text-green-400 font-medium">
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
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 text-sm transition-colors border border-gray-700">
                Cancel
              </button>
            )}
          </div>
        )}
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
    '/api/challenges?status=all',
    fetcher,
    { refreshInterval: 30000 }
  );

  const all = data?.challenges || [];

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

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this challenge? Your stake will be refunded.')) return;
    await fetch(`/api/challenges/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    mutate();
  };

  // Switch to "Open" tab automatically when there are open challenges but none live
  useEffect(() => {
    if (!isLoading && stats.live === 0 && stats.open > 0 && statusTab === 'active') {
      setStatusTab('pending');
    }
  }, [isLoading, stats.live, stats.open, statusTab]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">⚔️ Tipster Challenges</h1>
            <p className="text-gray-400 text-sm mt-1 max-w-lg">
              Pick any real upcoming match, call the result, stake KES.
              Correct prediction wins 90% of the pot. Draw = full refund.
            </p>
          </div>
          {user && (
            <button onClick={() => setShowCreate(true)}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition-colors flex items-center gap-2">
              + Challenge
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Arena</div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Live Battles
                  </span>
                  <span className="font-bold text-white">{stats.live}</span>
                </div>
                <div className="flex justify-between"><span className="text-gray-400">Open</span><span className="font-bold text-white">{stats.open}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Settled</span><span className="font-bold text-white">{stats.settled}</span></div>
              </div>
            </div>

            {/* Sport filter */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Sport</div>
              <div className="flex flex-col gap-1">
                {[
                  { label: 'All', value: '' },
                  { label: '⚽ Football', value: 'football' },
                  { label: '🏀 Basketball', value: 'basketball' },
                  { label: '🎾 Tennis', value: 'tennis' },
                  { label: '🏏 Cricket', value: 'cricket' },
                ].map(t => (
                  <button key={t.value} onClick={() => setSportFilter(t.value)}
                    className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${sportFilter === t.value ? 'bg-blue-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">How It Works</div>
              <ol className="space-y-2.5 text-xs text-gray-400 list-decimal list-inside">
                <li>Choose a real upcoming match</li>
                <li>Pick your prediction — 1X2, Over/Under, BTTS…</li>
                <li>Set your KES stake · Opponent matches it</li>
                <li>Match ends → correct pick wins 90% of pot</li>
                <li>Draw (both right or both wrong) = full refund</li>
              </ol>
            </div>
          </div>

          {/* Main */}
          <div className="lg:col-span-3">
            {/* Status tabs */}
            <div className="flex gap-1 p-1 bg-gray-900 rounded-xl border border-gray-800 mb-5">
              {STATUS_TABS.map(t => (
                <button key={t.value} onClick={() => setStatusTab(t.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors relative ${statusTab === t.value ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                  {t.label}
                  {t.value === 'active' && stats.live > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white text-xs rounded-full">{stats.live}</span>
                  )}
                  {t.value === 'pending' && stats.open > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">{stats.open}</span>
                  )}
                </button>
              ))}
            </div>

            {isLoading && (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">⚔️</div>
                <div className="text-lg font-semibold text-gray-300 mb-1">
                  {statusTab === 'active' ? 'No live battles right now' : statusTab === 'pending' ? 'No open challenges' : 'No settled challenges yet'}
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  {statusTab === 'settled'
                    ? 'Challenges settle automatically when the match finishes.'
                    : statusTab === 'pending'
                    ? 'Post a challenge and let other tipsters accept it.'
                    : 'Challenges go live once a second tipster accepts.'}
                </p>
                {user && statusTab !== 'settled' && (
                  <button onClick={() => setShowCreate(true)}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors">
                    + Create a Challenge
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              {filtered.map(c => (
                <ChallengeCard key={c.id} challenge={c}
                  currentUserId={user?.id}
                  onAccept={setAcceptTarget}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => mutate()} />}
      {acceptTarget && <AcceptModal challenge={acceptTarget} onClose={() => setAcceptTarget(null)} onAccepted={() => { mutate(); setAcceptTarget(null); }} />}
    </div>
  );
}
