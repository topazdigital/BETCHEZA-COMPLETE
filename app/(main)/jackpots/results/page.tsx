import type { Metadata } from 'next';
import { Trophy, CheckCircle2, XCircle, Clock, Users, Brain, TrendingUp, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { getSettledJackpots } from '@/lib/jackpot-store';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import type { Jackpot, JackpotGame } from '@/lib/jackpot-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Jackpot Results & History | Winning Combinations — Betcheza Kenya',
  description: 'View past jackpot results, winning combinations and payouts for SportPesa, Betika, OdiBets, Betin and Mozzartbet. Check if our AI predictions matched the settled outcomes.',
  keywords: ['jackpot results Kenya', 'SportPesa jackpot results', 'Betika jackpot results', 'winning jackpot combinations', 'jackpot history Kenya', 'settled jackpot outcomes'],
  openGraph: {
    title: 'Jackpot Results & History | Betcheza Kenya',
    description: 'Past jackpot results and winning combinations for all major Kenyan bookmakers.',
    url: 'https://betcheza.co.ke/jackpots/results',
    type: 'website',
    siteName: 'Betcheza',
  },
  alternates: { canonical: 'https://betcheza.co.ke/jackpots/results' },
  robots: { index: true, follow: true },
};

function formatKES(str: string): string {
  const n = parseInt(str, 10);
  if (isNaN(n)) return str;
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(0)}K`;
  return `KES ${n.toLocaleString()}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function ResultBadge({ result }: { result?: '1' | 'X' | '2' }) {
  if (!result) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-mono">?</span>;
  const colors: Record<string, string> = {
    '1': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'X': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    '2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${colors[result]}`}>
      {result}
    </span>
  );
}

function PredictionMatchBadge({ predicted, actual }: { predicted?: string; actual?: string }) {
  if (!predicted || !actual) return null;
  return predicted === actual
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
    : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
}

function GameResultRow({ game, index }: { game: JackpotGame; index: number }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0 text-sm">
      <span className="w-5 text-[10px] font-mono text-muted-foreground shrink-0">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate">{game.home}</span>
        <span className="text-muted-foreground mx-1">vs</span>
        <span className="font-medium truncate">{game.away}</span>
        {game.league && <span className="text-[10px] text-muted-foreground ml-1.5">· {game.league}</span>}
      </div>
      {(game.homeScore !== undefined && game.awayScore !== undefined) && (
        <span className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded shrink-0">
          {game.homeScore}–{game.awayScore}
        </span>
      )}
      <ResultBadge result={game.result} />
      <PredictionMatchBadge predicted={game.aiPrediction} actual={game.result} />
    </div>
  );
}

function JackpotResultCard({ jackpot }: { jackpot: Jackpot }) {
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === jackpot.bookmakerSlug);
  const result = jackpot.result;
  const gamesWithResults = jackpot.games.filter(g => g.result);
  const correctPredictions = jackpot.games.filter(g => g.result && g.aiPrediction === g.result).length;
  const totalGames = jackpot.games.length;
  const accuracy = gamesWithResults.length > 0 ? Math.round((correctPredictions / gamesWithResults.length) * 100) : null;

  return (
    <Card className="overflow-hidden border-border/60">
      <div className="h-1" style={{ background: bk?.color || '#888' }} />
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0"
              style={{ background: bk?.color || '#888' }}
            >
              {jackpot.bookmakerName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-base leading-tight">{jackpot.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Settled {result?.settledAt ? formatDate(result.settledAt) : formatDate(jackpot.updatedAt)}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs bg-muted/50">Settled</Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Prize summary */}
        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Jackpot Pool</p>
              <p className="font-extrabold text-sm text-amber-600 dark:text-amber-400 mt-0.5">{formatKES(jackpot.jackpotAmount)}</p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Winners</p>
              <p className="font-extrabold text-sm text-green-600 dark:text-green-400 mt-0.5 flex items-center justify-center gap-1">
                <Users className="h-3.5 w-3.5" />{result.winnersCount}
              </p>
            </div>
            {result.prizePerWinner && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Per Winner</p>
                <p className="font-extrabold text-sm text-blue-600 dark:text-blue-400 mt-0.5">{formatKES(result.prizePerWinner)}</p>
              </div>
            )}
            {accuracy !== null && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">AI Accuracy</p>
                <p className="font-extrabold text-sm text-purple-600 dark:text-purple-400 mt-0.5">{accuracy}%</p>
              </div>
            )}
          </div>
        )}

        {/* Winning combination strip */}
        {result?.winningCombination && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">Winning Combination</p>
            <div className="flex flex-wrap gap-1.5">
              {result.winningCombination.split(/\s+/).map((pick, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold border ${
                    pick === '1' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300' :
                    pick === 'X' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    pick === '2' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {pick}
                </span>
              ))}
            </div>
          </div>
        )}

        {result?.notes && (
          <p className="text-xs text-muted-foreground italic">{result.notes}</p>
        )}

        {/* Game-by-game results */}
        {jackpot.games.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-primary hover:underline select-none flex items-center gap-1.5">
              <span>View all {jackpot.games.length} match results</span>
              <span className="text-muted-foreground group-open:hidden">▸</span>
              <span className="text-muted-foreground hidden group-open:inline">▾</span>
            </summary>
            <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-4 mb-2 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                <span className="flex-1">Match</span>
                <span>Score</span>
                <span>Result</span>
                <span className="w-4">AI</span>
              </div>
              {jackpot.games.map((game, idx) => (
                <GameResultRow key={game.id || idx} game={game} index={idx} />
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

// ─── AI Accuracy Tracker ──────────────────────────────────────────────────────

interface BookmakerStats {
  slug: string;
  name: string;
  color: string;
  totalJackpots: number;
  totalGames: number;
  correctPredictions: number;
  accuracy: number;
}

function AccuracyTracker({ settled }: { settled: Jackpot[] }) {
  const statsBySlug = new Map<string, BookmakerStats>();

  for (const jackpot of settled) {
    const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === jackpot.bookmakerSlug);
    if (!bk) continue;
    const existing = statsBySlug.get(jackpot.bookmakerSlug) || {
      slug: bk.slug, name: bk.name, color: bk.color,
      totalJackpots: 0, totalGames: 0, correctPredictions: 0, accuracy: 0,
    };
    const gamesWithResults = jackpot.games.filter(g => g.result && g.aiPrediction);
    existing.totalJackpots++;
    existing.totalGames += gamesWithResults.length;
    existing.correctPredictions += gamesWithResults.filter(g => g.aiPrediction === g.result).length;
    statsBySlug.set(jackpot.bookmakerSlug, existing);
  }

  const stats = Array.from(statsBySlug.values()).map(s => ({
    ...s,
    accuracy: s.totalGames > 0 ? Math.round((s.correctPredictions / s.totalGames) * 100) : 0,
  })).sort((a, b) => b.accuracy - a.accuracy);

  if (stats.length === 0) return null;

  const overallTotal = stats.reduce((sum, s) => sum + s.totalGames, 0);
  const overallCorrect = stats.reduce((sum, s) => sum + s.correctPredictions, 0);
  const overallAccuracy = overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0;

  return (
    <Card className="border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/10">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-sm text-purple-900 dark:text-purple-200">AI Prediction Accuracy Tracker</CardTitle>
            <p className="text-xs text-muted-foreground">Historical performance across all settled jackpots</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{overallAccuracy}%</p>
            <p className="text-[10px] text-muted-foreground">{overallCorrect}/{overallTotal} correct</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {stats.map(s => (
          <div key={s.slug}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center h-5 w-8 rounded text-[10px] font-black text-white"
                  style={{ background: s.color }}
                >
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-xs font-medium">{s.name}</span>
                <span className="text-[10px] text-muted-foreground">{s.totalJackpots} jackpot{s.totalJackpots !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{s.correctPredictions}/{s.totalGames}</span>
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.accuracy}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${s.accuracy}%`, background: s.color }}
              />
            </div>
          </div>
        ))}

        <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          Accuracy calculated from {settled.length} settled jackpot{settled.length !== 1 ? 's' : ''} · {overallTotal} total predictions
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Overall stats banner ──────────────────────────────────────────────────────

function StatsBanner({ settled }: { settled: Jackpot[] }) {
  const totalWinners = settled.reduce((sum, j) => sum + (j.result?.winnersCount || 0), 0);
  const totalPrize = settled.reduce((sum, j) => sum + parseInt(j.jackpotAmount || '0', 10), 0);
  const gamesWithAI = settled.flatMap(j => j.games.filter(g => g.result && g.aiPrediction));
  const correct = gamesWithAI.filter(g => g.aiPrediction === g.result).length;
  const overallAccuracy = gamesWithAI.length > 0 ? Math.round((correct / gamesWithAI.length) * 100) : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-border/50 bg-card p-3.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Jackpots Settled</p>
        <p className="text-2xl font-black text-foreground mt-1">{settled.length}</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-3.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Winners</p>
        <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{totalWinners.toLocaleString()}</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-3.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Prize Pool</p>
        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
          {totalPrize >= 1_000_000 ? `KES ${(totalPrize / 1_000_000).toFixed(0)}M` : `KES ${totalPrize.toLocaleString()}`}
        </p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-3.5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">AI Accuracy</p>
        <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
          {overallAccuracy !== null ? `${overallAccuracy}%` : '—'}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function JackpotResultsPage() {
  const settled = getSettledJackpots();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Jackpot Results & History</h1>
            <p className="text-sm text-muted-foreground">Settled outcomes, winning combinations and AI prediction accuracy</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <Link href="/jackpots" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
            <Trophy className="h-3.5 w-3.5" /> View Active Jackpots
          </Link>
          {settled.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" /> {settled.length} settled jackpot{settled.length !== 1 ? 's' : ''} tracked
            </span>
          )}
        </div>
      </div>

      {/* Stats banner (only when there are settled jackpots) */}
      {settled.length > 0 && <StatsBanner settled={settled} />}

      {/* Bookmaker filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/jackpots/results"
          className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-medium"
        >
          All Bookmakers
        </Link>
        {SUPPORTED_BOOKMAKERS.map(bk => (
          <Link
            key={bk.slug}
            href={`/jackpots/results?bookmaker=${bk.slug}`}
            className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted font-medium transition-colors"
            style={{ borderColor: bk.color + '50', color: bk.color }}
          >
            {bk.name}
          </Link>
        ))}
      </div>

      {/* AI Accuracy Tracker */}
      {settled.length > 0 && <AccuracyTracker settled={settled} />}

      {/* Results list */}
      {settled.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 p-12 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h2 className="font-semibold text-base mb-1">No settled jackpots yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Results will appear here once jackpots are settled by admins after all matches are played.
            Our AI picks jackpots automatically — settle them to start tracking accuracy.
          </p>
          <Link href="/jackpots" className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline font-medium">
            <Trophy className="h-4 w-4" /> View active jackpot predictions
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {settled.map(jackpot => (
            <JackpotResultCard key={jackpot.id} jackpot={jackpot} />
          ))}
        </div>
      )}

      <div className="pt-2 border-t text-center">
        <p className="text-xs text-muted-foreground max-w-xl mx-auto">
          <strong className="text-foreground">Disclaimer:</strong> AI predictions are for informational purposes only. Past results do not guarantee future outcomes. Please gamble responsibly. Kenya helpline: <strong>0800 723 253</strong> (free, 24/7).
        </p>
      </div>
    </div>
  );
}
