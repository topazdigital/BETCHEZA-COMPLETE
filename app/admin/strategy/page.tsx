'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, RefreshCw, CheckCircle2, XCircle, Circle, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WeeklyStrategy, StrategyPick } from '@/app/api/strategy/predictions/route';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatKES(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export default function AdminStrategyPage() {
  const { data, mutate, isLoading } = useSWR<{ current: WeeklyStrategy; past: WeeklyStrategy[] }>(
    '/api/strategy/predictions',
    fetcher
  );
  const [generating, setGenerating] = useState<number | null>(null);
  const [savingResult, setSavingResult] = useState<number | null>(null);
  const [dayResults, setDayResults] = useState<Record<number, 'win' | 'loss'>>({});
  const [msg, setMsg] = useState('');

  const current = data?.current;

  const handleGenerate = async (day: number) => {
    setGenerating(day);
    setMsg('');
    try {
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`Day ${day} picks generated (combined odds: ${d.combinedOdds})`);
        mutate();
      } else {
        setMsg(d.error || 'Failed to generate');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setGenerating(null);
    }
  };

  const handleSaveResult = async (day: number) => {
    const result = dayResults[day];
    if (!result) return;
    setSavingResult(day);
    try {
      const res = await fetch('/api/strategy/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, result }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`Day ${day} result saved: ${result}`);
        mutate();
      }
    } catch {
      setMsg('Failed to save result');
    } finally {
      setSavingResult(null);
    }
  };

  return (
    <div className="p-4 max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">3 Daily Odds Strategy</h1>
          <p className="text-sm text-muted-foreground">Manage weekly AI-generated picks and record results</p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
          {msg}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="space-y-4">
          {current?.days.map((day) => (
            <div key={day.day} className={cn(
              'rounded-xl border bg-card',
              day.status === 'active' && 'border-primary/40 bg-primary/5'
            )}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    day.status === 'active' ? 'bg-primary text-primary-foreground' :
                    day.result === 'win' ? 'bg-green-500 text-white' :
                    day.result === 'loss' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'
                  )}>
                    {day.result === 'win' ? '✓' : day.result === 'loss' ? '✗' : day.day}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Day {day.day}</span>
                      {day.status === 'active' && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">Today</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{day.date} · Stake {formatKES(day.stake)} · Target {formatKES(day.targetWin)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {day.combinedOdds > 0 && (
                    <span className="rounded bg-primary/10 px-2 py-1 text-xs font-mono font-bold text-primary">
                      {day.combinedOdds.toFixed(2)}x
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerate(day.day)}
                    disabled={generating === day.day}
                    className="gap-1 text-xs"
                  >
                    {generating === day.day ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {day.picks.length > 0 ? 'Regenerate' : 'Generate AI Picks'}
                  </Button>
                </div>
              </div>

              {day.picks.length > 0 ? (
                <div className="p-3 space-y-2">
                  {day.picks.map((pick) => (
                    <div key={pick.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
                      <div className="mt-0.5">
                        {pick.result === 'win' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                         pick.result === 'loss' ? <XCircle className="h-4 w-4 text-red-500" /> :
                         <Circle className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-muted-foreground">{pick.league}</p>
                        <p className="text-sm font-semibold truncate">{pick.homeTeam} vs {pick.awayTeam}</p>
                        <p className="text-xs text-foreground/80">
                          <span className="font-medium text-primary">{pick.market}:</span> {pick.pick} · <span className="font-mono font-bold">{pick.odds.toFixed(2)}</span> · {pick.confidence}
                        </p>
                        {pick.reasoning && <p className="text-[11px] text-muted-foreground mt-0.5">{pick.reasoning}</p>}
                      </div>
                    </div>
                  ))}

                  {/* Record result */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground shrink-0">Record result:</span>
                    <Button
                      size="sm"
                      variant={dayResults[day.day] === 'win' ? 'default' : 'outline'}
                      onClick={() => setDayResults((p) => ({ ...p, [day.day]: 'win' }))}
                      className="h-7 gap-1 text-xs"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Win
                    </Button>
                    <Button
                      size="sm"
                      variant={dayResults[day.day] === 'loss' ? 'destructive' : 'outline'}
                      onClick={() => setDayResults((p) => ({ ...p, [day.day]: 'loss' }))}
                      className="h-7 gap-1 text-xs"
                    >
                      <XCircle className="h-3 w-3" /> Loss
                    </Button>
                    {dayResults[day.day] && (
                      <Button
                        size="sm"
                        onClick={() => handleSaveResult(day.day)}
                        disabled={savingResult === day.day}
                        className="h-7 gap-1 text-xs"
                      >
                        {savingResult === day.day ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save
                      </Button>
                    )}
                    {day.result && (
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase', day.result === 'win' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600')}>
                        Recorded: {day.result}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                  No picks yet — click "Generate AI Picks" to create today's selections.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
