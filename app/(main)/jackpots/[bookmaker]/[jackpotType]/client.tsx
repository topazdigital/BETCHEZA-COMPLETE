'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brain, Trophy, Clock, Copy, Check, AlertCircle, TrendingUp, Shield, Star, ExternalLink, RefreshCw, Zap, ArrowLeft, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(true);
  const hasPredictions = jackpot.games.some(g => g.aiPrediction || g.prediction);
  const avgConfidence = hasPredictions ? Math.round(jackpot.games.reduce((s, g) => s + (g.aiConfidence || 60), 0) / jackpot.games.length) : null;
  return (
    <Card className="overflow-hidden border-border/60">
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
                {avgConfidence && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" />Avg confidence: {avgConfidence}%</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {hasPredictions && <CopyPicksButton jackpot={jackpot} />}
              <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)} className="h-8 text-xs gap-1">
                {expanded ? <><ChevronUp className="h-3.5 w-3.5" />Hide picks</> : <><ChevronDown className="h-3.5 w-3.5" />Show picks</>}
              </Button>
            </div>
          </div>

          {jackpot.aiAnalysis && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex gap-2">
              <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{jackpot.aiAnalysis}</p>
            </div>
          )}

          {expanded && (
            <div className="space-y-1.5 border-t pt-3">
              {!hasPredictions ? (
                <div className="py-4 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">AI predictions coming soon — check back shortly.</p>
                </div>
              ) : jackpot.games.map((game, i) => {
                const pick = game.aiPrediction || game.prediction;
                return (
                  <div key={game.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                    <span className="text-xs text-muted-foreground w-5 text-center shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{game.home} <span className="text-muted-foreground font-normal">vs</span> {game.away}</p>
                      {game.league && <p className="text-[10px] text-muted-foreground">{game.league}</p>}
                      {game.aiReasoning && <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{game.aiReasoning}</p>}
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

interface Props {
  bookmaker: Bookmaker;
  jackpotTypeSlug: string;
  jackpotTypeTitle: string;
  gameCount: number;
  prize: string;
}

export default function JackpotTypeClient({ bookmaker, jackpotTypeSlug, jackpotTypeTitle, gameCount, prize }: Props) {
  const [jackpots, setJackpots] = useState<Jackpot[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jackpot?active=true&bookmaker=${bookmaker.slug}`);
      const data = await res.json() as { jackpots: Jackpot[] };
      const all: Jackpot[] = data.jackpots || [];
      const filtered = all.filter(j =>
        j.title.toLowerCase().includes(jackpotTypeTitle.toLowerCase()) ||
        j.title.toLowerCase().replace(/\s+/g, '-') === jackpotTypeSlug
      );
      setJackpots(filtered.length > 0 ? filtered : all.slice(0, 1));
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [bookmaker.slug, jackpotTypeSlug]);

  const hasPredictions = jackpots.some(j => j.games.some(g => g.aiPrediction || g.prediction));
  const totalGames = jackpots.reduce((s, j) => s + j.games.length, 0);
  const base = `${bookmaker.name} ${jackpotTypeTitle}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <Link href="/jackpots" className="hover:text-foreground transition-colors">Jackpots</Link>
          <span>/</span>
          <Link href={`/jackpots/${bookmaker.slug}`} className="hover:text-foreground transition-colors">{bookmaker.name}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{jackpotTypeTitle}</span>
        </div>

        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0" style={{ background: bookmaker.color }}>
            {bookmaker.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">{base} Prediction Today</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Free AI tips for all {gameCount} games — updated daily · Prize: {prize}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Brain className="h-3.5 w-3.5 text-primary" /> AI Analysis</span>
          <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-green-500" /> Confidence Ratings</span>
          <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-blue-500" /> Double Chance Tips</span>
          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> {gameCount} games covered</span>
          {!loading && hasPredictions && <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"><Zap className="h-3.5 w-3.5" /> Predictions ready</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading {base} predictions…</p>
        </div>
      ) : jackpots.length === 0 ? (
        <Card><CardContent className="p-10 text-center space-y-3">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <h2 className="font-semibold">No Active {base}</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The {base} predictions will appear here as soon as the games are released by {bookmaker.name}. Check back soon.
          </p>
          <Link href={`/jackpots/${bookmaker.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline mt-2" style={{ color: bookmaker.color }}>
            View all {bookmaker.name} jackpots
          </Link>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">{jackpots.map(j => <JackpotCard key={j.id} jackpot={j} bookmakerColor={bookmaker.color} />)}</div>
      )}

      {jackpots.length > 0 && (
        <div className="flex items-center justify-between">
          <a href={bookmaker.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline" style={{ color: bookmaker.color }}>
            <ExternalLink className="h-3.5 w-3.5" /> Place your {base} picks
          </a>
          {hasPredictions && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Zap className="h-3.5 w-3.5 text-amber-500" /> Powered by Betcheza AI</div>}
        </div>
      )}

      {/* SEO content — keyword-rich article section */}
      <div className="prose prose-sm dark:prose-invert max-w-none border-t pt-6 space-y-4">
        <h2 className="text-lg font-bold">{base} Prediction Today — {gameCount} Games Free Tips</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Betcheza provides free AI-powered <strong>{base} predictions</strong> for all {gameCount} games every week.
          Our machine-learning model analyses team form, head-to-head records, home and away statistics, goals scored and conceded,
          and current market odds to generate accurate <strong>{base} tips today</strong>.
          Each game shows a confidence percentage — focus on high-confidence picks as your banker selections.
        </p>

        <h2 className="text-lg font-bold">How to Win the {base}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          To win the {base} jackpot of {prize}, you need to correctly predict the result of all {gameCount} matches.
          Use our <strong>free {base} prediction</strong> as a guide, paying special attention to games with 80%+ confidence.
          For lower-confidence matches, consider using double chance options (1X, X2, 12) to protect your slip.
          Our <strong>{base} banker tips</strong> help you identify the most predictable games in the {gameCount}-game card.
        </p>

        <h2 className="text-lg font-bold">{base} Games This Week</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The <strong>{base} games today</strong> are selected by {bookmaker.name} from top football leagues around the world,
          including the English Premier League, La Liga, Serie A, Bundesliga, Champions League, and local Kenyan leagues.
          Betcheza updates its <strong>{base} analysis</strong> for every round as soon as the {gameCount} games are published.
        </p>
      </div>

      {/* Other jackpot types for this bookmaker */}
      <div className="border-t pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Other {bookmaker.name} Jackpots</h3>
        <div className="flex flex-wrap gap-2">
          {bookmaker.jackpotTypes
            .filter(t => t !== jackpotTypeTitle)
            .map(t => {
              const slug = t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              return (
                <Link key={t} href={`/jackpots/${bookmaker.slug}/${slug}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors">
                  <div className="h-2 w-2 rounded-full" style={{ background: bookmaker.color }} />{t}
                </Link>
              );
            })}
          <Link href={`/jackpots/${bookmaker.slug}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors">
            <BookOpen className="h-3 w-3" /> All {bookmaker.name} Jackpots
          </Link>
        </div>
      </div>

      {/* Other bookmakers */}
      <div className="border-t pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Other Bookmaker Jackpots</h3>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_BOOKMAKERS.filter(b => b.slug !== bookmaker.slug).map(b => (
            <Link key={b.slug} href={`/jackpots/${b.slug}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors">
              <div className="h-2 w-2 rounded-full" style={{ background: b.color }} />{b.name}
            </Link>
          ))}
        </div>
      </div>

      <Card className="border-dashed"><CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Disclaimer:</strong> Predictions are generated by AI for informational purposes only and do not guarantee wins. Please gamble responsibly. Kenya gambling helpline: <strong>0800 723 253</strong> (free, 24/7).
      </CardContent></Card>
    </div>
  );
}
