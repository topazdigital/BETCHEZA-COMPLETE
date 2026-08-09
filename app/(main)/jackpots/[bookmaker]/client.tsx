'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brain, Trophy, Clock, Copy, Check, AlertCircle, TrendingUp, Shield, Star, ExternalLink, RefreshCw, Zap, ArrowLeft, CheckCircle2, XCircle, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Jackpot, JackpotGame, Bookmaker } from '@/lib/jackpot-types';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import { JackpotLockedGames, JackpotUnlockModal, useJackpotAccess } from '@/components/jackpots/jackpot-unlock';

const PICK_COLORS: Record<string, string> = {
  '1':  'bg-green-500/10 text-green-700 border-green-200 dark:border-green-800 dark:text-green-400',
  'X':  'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:border-yellow-800 dark:text-yellow-400',
  '2':  'bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800 dark:text-blue-400',
  '1X': 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400',
  'X2': 'bg-sky-500/10 text-sky-700 border-sky-200 dark:border-sky-800 dark:text-sky-400',
  '12': 'bg-violet-500/10 text-violet-700 border-violet-200 dark:border-violet-800 dark:text-violet-400',
};

function Countdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    function calc() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Closed'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 48 ? `${Math.floor(h/24)}d ${h%24}h` : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [deadline]);
  const isUrgent = new Date(deadline).getTime() - Date.now() < 3 * 3600000;
  return <span className={cn('font-mono font-bold text-sm', isUrgent ? 'text-red-500' : 'text-foreground')}>{timeLeft}</span>;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-8 text-right">{value}%</span>
    </div>
  );
}

function CopyPicksButton({ jackpot }: { jackpot: Jackpot }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    const lines = jackpot.games.map((g, i) => `${i+1}. ${g.home} vs ${g.away}: ${g.aiPrediction || g.prediction || '?'}`);
    const text = `${jackpot.bookmakerName} ${jackpot.title} Predictions\nPrize: ${jackpot.currency} ${parseInt(jackpot.jackpotAmount).toLocaleString()}\n\n${lines.join('\n')}\n\nPowered by Betcheza.co.ke`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <Button variant="outline" size="sm" onClick={doCopy} className="h-8 gap-1.5 text-xs">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy Picks'}
    </Button>
  );
}

function JackpotCard({ jackpot, bookmakerColor }: { jackpot: Jackpot; bookmakerColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const { hasAccess, walletBalance, openUnlock, closeUnlock, unlockOpen, setAccess } = useJackpotAccess();
  const hasPredictions = jackpot.games.some(g => g.aiPrediction || g.prediction);
  const avgConfidence = hasPredictions ? Math.round(jackpot.games.reduce((s, g) => s + (g.aiConfidence || 60), 0) / jackpot.games.length) : null;
  const lockedCount = Math.min(5, jackpot.games.length);
  const visibleGames = hasAccess ? jackpot.games : jackpot.games.slice(0, Math.max(0, jackpot.games.length - lockedCount));
  return (
    <>
    <Card className="overflow-hidden border-border/60 hover:border-border transition-colors">
      <CardContent className="p-0">
        <div className="h-1 w-full" style={{ background: bookmakerColor }} />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-sm">{jackpot.title}</h2>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{jackpot.games.length} games</Badge>
                {hasPredictions && <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"><Brain className="h-2.5 w-2.5 mr-0.5" /> AI Ready</Badge>}
              </div>
              <p className="text-xl font-extrabold mt-1" style={{ color: bookmakerColor }}>{jackpot.currency} {parseInt(jackpot.jackpotAmount).toLocaleString()}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Closes in <Countdown deadline={jackpot.deadline} /></span>
                {avgConfidence && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" />Avg: {avgConfidence}%</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {hasPredictions && hasAccess && <CopyPicksButton jackpot={jackpot} />}
              <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)} className="h-8 text-xs">{expanded ? 'Hide picks' : 'Show picks'}</Button>
            </div>
          </div>
          {jackpot.aiAnalysis && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex gap-2">
              <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{jackpot.aiAnalysis}</p>
            </div>
          )}
          {!expanded && hasPredictions && (
            <div className="flex flex-wrap gap-1.5">
              {visibleGames.slice(0, 8).map((game, i) => {
                const pick = game.aiPrediction || game.prediction;
                return (
                  <div key={game.id} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{i+1}.</span>
                    {pick && <Badge variant="outline" className={cn('text-xs font-bold px-1.5 py-0 h-5', PICK_COLORS[pick] || '')}>{pick}</Badge>}
                  </div>
                );
              })}
              {visibleGames.length > 8 && <span className="text-xs text-muted-foreground self-center">+{visibleGames.length - 8} more</span>}
            </div>
          )}
          {expanded && (
            <div className="space-y-1.5 border-t pt-3">
              {!hasPredictions ? (
                <div className="py-4 text-center"><AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-xs text-muted-foreground">AI predictions coming soon.</p></div>
              ) : visibleGames.map((game, i) => {
                const pick = game.aiPrediction || game.prediction;
                return (
                  <div key={game.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                    <span className="text-xs text-muted-foreground w-5 text-center shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{game.home} <span className="text-muted-foreground font-normal">vs</span> {game.away}</p>
                      {game.league && <p className="text-[10px] text-muted-foreground">{game.league}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pick && <Badge variant="outline" className={cn('text-xs font-bold px-1.5', PICK_COLORS[pick] || '')}>{pick}</Badge>}
                      {game.aiConfidence && <div className="w-20 hidden sm:block"><ConfidenceBar value={game.aiConfidence} /></div>}
                    </div>
                  </div>
                );
               })}
               {!hasAccess && <JackpotLockedGames count={lockedCount} onUnlock={openUnlock} />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    <JackpotUnlockModal open={unlockOpen} onClose={closeUnlock} walletBalance={walletBalance} onUnlocked={() => setAccess({ hasAccess: true })} />
    </>
  );
}

// ── Settled jackpot result helpers ────────────────────────────────────────────

function FtBadge({ result }: { result?: '1' | 'X' | '2' }) {
  if (!result) return null;
  const colors: Record<string, string> = {
    '1': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
    'X': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    '2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  };
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded border text-[10px] font-bold shrink-0', colors[result])}>
      {result}
    </span>
  );
}

function OutcomePill({ game }: { game: JackpotGame }) {
  const pick = game.aiPrediction || game.prediction;
  if (!game.result) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
        PPD
      </span>
    );
  }
  if (!pick) return null;
  const won = pick.length === 1 ? pick === game.result : pick.includes(game.result);
  return won ? (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 text-[9px] font-bold text-green-700 dark:text-green-400 shrink-0">
      <CheckCircle2 className="h-2.5 w-2.5" />WON
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:text-red-400 shrink-0">
      <XCircle className="h-2.5 w-2.5" />LOST
    </span>
  );
}

function SettledJackpotCard({ jackpot, bookmakerColor }: { jackpot: Jackpot; bookmakerColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const gamesWithResult = jackpot.games.filter(g => g.result);
  const pick = (g: JackpotGame) => g.aiPrediction || g.prediction;
  const correct = gamesWithResult.filter(g => {
    const p = pick(g);
    if (!p || !g.result) return false;
    return p.length === 1 ? p === g.result : p.includes(g.result);
  }).length;
  const postponed = jackpot.games.filter(g => !g.result).length;
  const settledAt = jackpot.result?.settledAt
    ? new Date(jackpot.result.settledAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(jackpot.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Card className="overflow-hidden border-border/50 opacity-90 hover:opacity-100 transition-opacity">
      <CardContent className="p-0">
        <div className="h-0.5 w-full" style={{ background: bookmakerColor }} />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-muted-foreground">{jackpot.title}</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">Settled</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Settled {settledAt} · {jackpot.currency} {parseInt(jackpot.jackpotAmount).toLocaleString()} pool
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
              {gamesWithResult.length > 0 && (
                <span className="font-semibold" style={{ color: bookmakerColor }}>
                  {correct}/{gamesWithResult.length} correct
                </span>
              )}
              {postponed > 0 && <span className="text-slate-400">{postponed} ppd</span>}
            </div>
          </div>

          {/* Winning combination strip */}
          {jackpot.result?.winningCombination && (
            <div className="flex flex-wrap gap-1">
              {jackpot.result.winningCombination.split(/\s+/).map((pick, i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-bold border',
                    pick === '1' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300' :
                    pick === 'X' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    pick === '2' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-muted text-muted-foreground border-border'
                  )}
                >
                  {pick}
                </span>
              ))}
            </div>
          )}

          {/* Toggle game rows */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide' : 'Show'} all {jackpot.games.length} match results
          </button>

          {expanded && (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-0">
              {/* Column headers */}
              <div className="flex items-center gap-2 mb-2 text-[9px] uppercase tracking-wide text-muted-foreground font-medium">
                <span className="w-4" />
                <span className="flex-1">Match · Pick</span>
                <span className="w-10 text-right">Score</span>
                <span className="w-5 text-center">FT</span>
                <span className="w-10 text-right">Result</span>
              </div>
              {jackpot.games.map((game, i) => {
                const p = pick(game);
                const isPostponed = !game.result;
                return (
                  <div
                    key={game.id || i}
                    className={cn('flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0 text-xs', isPostponed && 'opacity-50')}
                  >
                    <span className="w-4 text-[10px] font-mono text-muted-foreground shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate">{game.home}</span>
                      <span className="text-muted-foreground mx-1">vs</span>
                      <span className="font-medium truncate">{game.away}</span>
                      {p && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          (<span className="font-bold text-foreground">{p}</span>)
                        </span>
                      )}
                    </div>
                    {game.homeScore !== undefined && game.awayScore !== undefined ? (
                      <span className="w-10 text-right font-mono font-semibold text-[11px] shrink-0">
                        {game.homeScore}–{game.awayScore}
                      </span>
                    ) : (
                      <span className="w-10 text-right text-[10px] text-muted-foreground italic shrink-0">
                        {isPostponed ? 'ppd' : '—'}
                      </span>
                    )}
                    <div className="w-5 flex justify-center shrink-0">
                      <FtBadge result={game.result} />
                    </div>
                    <div className="w-10 flex justify-end shrink-0">
                      <OutcomePill game={game} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export default function BookmakerJackpotClient({ bookmaker }: { bookmaker: Bookmaker }) {
  const [jackpots, setJackpots] = useState<Jackpot[]>([]);
  const [settled, setSettled] = useState<Jackpot[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const [activeRes, settledRes] = await Promise.all([
        fetch(`/api/jackpot?active=true&bookmaker=${bookmaker.slug}`),
        fetch(`/api/jackpot?settled=true&bookmaker=${bookmaker.slug}`),
      ]);
      const activeData = await activeRes.json() as { jackpots: Jackpot[] };
      const settledData = await settledRes.json() as { jackpots: Jackpot[] };
      setJackpots(activeData.jackpots || []);
      setSettled(settledData.jackpots || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [bookmaker.slug]);

  const hasPredictions = jackpots.some(j => j.games.some(g => g.aiPrediction || g.prediction));
  const totalGames = jackpots.reduce((s, j) => s + j.games.length, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link href="/jackpots" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> All Jackpots
        </Link>
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0" style={{ background: bookmaker.color }}>
            {bookmaker.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">{bookmaker.name} Jackpot Predictions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Free AI predictions for {bookmaker.jackpotTypes.join(', ')} — updated daily</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Brain className="h-3.5 w-3.5 text-primary" /> AI Analysis</span>
          <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-green-500" /> Confidence Ratings</span>
          <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-blue-500" /> Double Chance Tips</span>
          {!loading && jackpots.length > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> {totalGames} games covered</span>}
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading {bookmaker.name} jackpots…</p>
        </div>
      ) : jackpots.length === 0 ? (
        <Card><CardContent className="p-10 text-center space-y-3">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <h2 className="font-semibold">No Active {bookmaker.name} Jackpots</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{bookmaker.name} typically offers: {bookmaker.jackpotTypes.join(', ')}. Check back when the next round is published.</p>
          <a href={bookmaker.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline mt-2" style={{ color: bookmaker.color }}>
            Visit {bookmaker.name} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">{jackpots.map(j => <JackpotCard key={j.id} jackpot={j} bookmakerColor={bookmaker.color} />)}</div>
      )}
      {jackpots.length > 0 && (
        <div className="flex items-center justify-between">
          <a href={bookmaker.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline" style={{ color: bookmaker.color }}>
            <ExternalLink className="h-3.5 w-3.5" /> Place your picks on {bookmaker.name}
          </a>
          {hasPredictions && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Zap className="h-3.5 w-3.5 text-amber-500" /> Predictions by Betcheza AI</div>}
        </div>
      )}
      {/* ── Previous / Settled Jackpots ── */}
      {!loading && settled.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Previous Jackpots</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{settled.length}</span>
          </div>
          <div className="space-y-3">
            {settled.map(j => (
              <SettledJackpotCard key={j.id} jackpot={j} bookmakerColor={bookmaker.color} />
            ))}
          </div>
          <Link href="/jackpots/results" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
            <Trophy className="h-3.5 w-3.5" /> View full results history →
          </Link>
        </div>
      )}

      <div className="pt-4 border-t">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Other Bookmakers</h3>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_BOOKMAKERS.filter(b => b.slug !== bookmaker.slug).map(b => (
            <Link key={b.slug} href={`/jackpots/${b.slug}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors">
              <div className="h-2 w-2 rounded-full" style={{ background: b.color }} />{b.name}
            </Link>
          ))}
        </div>
      </div>
      <Card className="border-dashed"><CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Disclaimer:</strong> Predictions are generated by AI for informational purposes only and do not guarantee wins. Please gamble responsibly. Kenya helpline: <strong>0800 723 253</strong> (free, 24/7).
      </CardContent></Card>
    </div>
  );
}
