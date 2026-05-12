'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { TrendingUp, Calendar, Trophy, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Circle, Info, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeeklyStrategy, DayPrediction, StrategyPick } from '@/app/api/strategy/predictions/route';

const WEEK_PLAN = [
  { day: 1, stake: 1000,  save: 0,      targetWin: 3000  },
  { day: 2, stake: 1500,  save: 1500,   targetWin: 4500  },
  { day: 3, stake: 2500,  save: 2000,   targetWin: 7500  },
  { day: 4, stake: 5000,  save: 2500,   targetWin: 15000 },
  { day: 5, stake: 10000, save: 5000,   targetWin: 30000 },
  { day: 6, stake: 15000, save: 15000,  targetWin: 45000 },
  { day: 7, stake: 20000, save: 25000,  targetWin: 60000 },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatKES(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function PickResultIcon({ result }: { result?: string }) {
  if (result === 'win') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (result === 'loss') return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function PickCard({ pick }: { pick: StrategyPick }) {
  const matchTime = pick.matchTime ? new Date(pick.matchTime) : null;
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground truncate">{pick.league}</p>
          <p className="text-sm font-semibold leading-tight truncate">{pick.homeTeam} vs {pick.awayTeam}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PickResultIcon result={pick.result} />
          <span className="font-mono text-base font-bold text-primary">{pick.odds.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{pick.market}</span>
        <span className="text-[12px] font-medium text-foreground">→ {pick.pick}</span>
        <span className={cn(
          'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
          pick.confidence === 'High' ? 'bg-green-500/15 text-green-600' : pick.confidence === 'Medium' ? 'bg-yellow-500/15 text-yellow-600' : 'bg-muted text-muted-foreground'
        )}>{pick.confidence}</span>
        {matchTime && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{matchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      {pick.reasoning && <p className="text-[11px] text-muted-foreground leading-relaxed">{pick.reasoning}</p>}
      {pick.actualScore && <p className="mt-1 text-[11px] font-medium text-foreground">Score: {pick.actualScore}</p>}
    </div>
  );
}

function DayCard({ day, planItem }: { day: DayPrediction; planItem: typeof WEEK_PLAN[0] }) {
  const [open, setOpen] = useState(day.status === 'active');
  const isActive = day.status === 'active';
  const isCompleted = day.status === 'completed';

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      isActive ? 'border-primary/60 bg-primary/5 shadow-md shadow-primary/10' : 'border-border bg-card',
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-3 sm:p-4"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm',
            isActive ? 'bg-primary text-primary-foreground' :
            day.result === 'win' ? 'bg-green-500 text-white' :
            day.result === 'loss' ? 'bg-red-500 text-white' :
            isCompleted ? 'bg-muted text-muted-foreground' : 'bg-muted/60 text-muted-foreground'
          )}>
            {day.result === 'win' ? '✓' : day.result === 'loss' ? '✗' : `D${day.day}`}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Day {day.day}</span>
              {isActive && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">Today</span>}
              {isCompleted && day.result && (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', day.result === 'win' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600')}>
                  {day.result}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4 text-right text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stake</p>
              <p className="font-mono font-bold text-foreground">{formatKES(planItem.stake)}</p>
            </div>
            {planItem.save > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Save</p>
                <p className="font-mono font-bold text-blue-500">{formatKES(planItem.save)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Target Win</p>
              <p className="font-mono font-bold text-green-500">{formatKES(planItem.targetWin)}</p>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Mobile stake info */}
      <div className="sm:hidden flex items-center gap-3 px-3 pb-2 text-xs">
        <span className="text-muted-foreground">Stake: <span className="font-mono font-bold text-foreground">{formatKES(planItem.stake)}</span></span>
        {planItem.save > 0 && <span className="text-muted-foreground">Save: <span className="font-mono font-bold text-blue-500">{formatKES(planItem.save)}</span></span>}
        <span className="text-muted-foreground">Win: <span className="font-mono font-bold text-green-500">{formatKES(planItem.targetWin)}</span></span>
      </div>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-3 sm:px-4 space-y-2">
          {day.picks.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Today's Picks</p>
                {day.combinedOdds > 0 && (
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                    Combined: {day.combinedOdds.toFixed(2)}x
                  </span>
                )}
              </div>
              {day.picks.map((pick) => (
                <PickCard key={pick.id} pick={pick} />
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <Circle className="h-8 w-8 opacity-30" />
              <p className="text-sm">Picks not yet published for this day.</p>
              <p className="text-xs">Check back soon — our AI generates picks daily.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StrategyPage() {
  const { data, isLoading } = useSWR<{ current: WeeklyStrategy; past: WeeklyStrategy[] }>(
    '/api/strategy/predictions',
    fetcher,
    { revalidateOnFocus: false }
  );

  const current = data?.current;
  const past = data?.past || [];

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold">3 Daily Odds Winning Strategy</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          A 7-day compounding football bet strategy. Each day we publish picks whose <strong>combined odds land between 3.0–4.0</strong> — it could be one game or several. Winnings are reinvested progressively each day.
        </p>
      </div>

      {/* Strategy Summary Table */}
      <div className="mb-5 rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Weekly Plan Overview</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Day</th>
                <th className="px-3 py-2 text-right">Stake</th>
                <th className="px-3 py-2 text-right">Save</th>
                <th className="px-3 py-2 text-right">Win</th>
              </tr>
            </thead>
            <tbody>
              {WEEK_PLAN.map((row, i) => {
                const dayData = current?.days[i];
                const isToday = dayData?.status === 'active';
                return (
                  <tr key={row.day} className={cn('border-b border-border/50 last:border-0', isToday && 'bg-primary/5')}>
                    <td className="px-3 py-2 font-medium flex items-center gap-1.5">
                      Day {row.day}
                      {isToday && <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase">Today</span>}
                      {dayData?.result === 'win' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                      {dayData?.result === 'loss' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatKES(row.stake)}</td>
                    <td className="px-3 py-2 text-right font-mono text-blue-500">{row.save > 0 ? formatKES(row.save) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-green-500">{formatKES(row.targetWin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 border-t border-border bg-muted/30">
          <div className="px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Savings</p>
            <p className="font-mono font-bold text-blue-500 text-sm">KES 49,000</p>
          </div>
          <div className="px-3 py-2.5 text-center border-x border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Day 7 Win</p>
            <p className="font-mono font-bold text-green-500 text-sm">KES 60,000</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weekly Profit</p>
            <p className="font-mono font-bold text-primary text-sm">KES 108,000</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mb-5 flex gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-700 dark:text-yellow-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>This is a strategy guide, not a guarantee. Betting carries risk — only stake what you can afford to lose. Picks are AI-generated based on form, odds value, and match data.</p>
      </div>

      {/* Current week days */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              Week of {current ? new Date(current.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '—'}
            </span>
          </div>
          {(current?.days || WEEK_PLAN.map((p, i) => ({
            day: p.day, date: '', picks: [], combinedOdds: 0, status: 'upcoming' as const,
            stake: p.stake, save: p.save, targetWin: p.targetWin,
          }))).map((day, i) => (
            <DayCard key={day.day} day={day} planItem={WEEK_PLAN[i]} />
          ))}
        </div>
      )}

      {/* Past weeks */}
      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            <Coins className="h-4 w-4" /> Past Weeks
          </h2>
          <div className="space-y-3">
            {past.map((week) => {
              const wins = week.days.filter((d) => d.result === 'win').length;
              const losses = week.days.filter((d) => d.result === 'loss').length;
              return (
                <div key={week.weekId} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        Week of {new Date(week.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-muted-foreground">{wins} wins · {losses} losses · {7 - wins - losses} pending</p>
                    </div>
                    <div className="flex gap-1">
                      {week.days.map((d) => (
                        <div key={d.day} className={cn(
                          'h-2 w-2 rounded-full',
                          d.result === 'win' ? 'bg-green-500' : d.result === 'loss' ? 'bg-red-500' : 'bg-muted'
                        )} title={`Day ${d.day}: ${d.result || 'pending'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
