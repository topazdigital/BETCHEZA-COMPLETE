'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brain, Trophy, Clock, Copy, Check, AlertCircle, TrendingUp, Shield, Star, ExternalLink, RefreshCw, Zap, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Jackpot, Bookmaker } from '@/lib/jackpot-types';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';

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
  const hasPredictions = jackpot.games.some(g => g.aiPrediction || g.prediction);
  const avgConfidence = hasPredictions ? Math.round(jackpot.games.reduce((s, g) => s + (g.aiConfidence || 60), 0) / jackpot.games.length) : null;
  return (
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
              {hasPredictions && <CopyPicksButton jackpot={jackpot} />}
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
              {jackpot.games.slice(0, 8).map((game, i) => {
                const pick = game.aiPrediction || game.prediction;
                return (
                  <div key={game.id} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{i+1}.</span>
                    {pick && <Badge variant="outline" className={cn('text-xs font-bold px-1.5 py-0 h-5', PICK_COLORS[pick] || '')}>{pick}</Badge>}
                  </div>
                );
              })}
              {jackpot.games.length > 8 && <span className="text-xs text-muted-foreground self-center">+{jackpot.games.length - 8} more</span>}
            </div>
          )}
          {expanded && (
            <div className="space-y-1.5 border-t pt-3">
              {!hasPredictions ? (
                <div className="py-4 text-center"><AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-xs text-muted-foreground">AI predictions coming soon.</p></div>
              ) : jackpot.games.map((game, i) => {
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BookmakerJackpotClient({ bookmaker }: { bookmaker: Bookmaker }) {
  const [jackpots, setJackpots] = useState<Jackpot[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jackpot?active=true&bookmaker=${bookmaker.slug}`);
      const data = await res.json() as { jackpots: Jackpot[] };
      setJackpots(data.jackpots || []);
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
