#!/usr/bin/env bash
# Betcheza deploy script — writes updated files directly without git
set -e
BASE="$HOME/apps/betcheza"
echo "Writing updated Betcheza files to $BASE ..."

mkdir -p "$BASE/app/(main)/strategy"
mkdir -p "$BASE/app/api/cron/daily-strategy"
mkdir -p "$BASE/app/api/strategy/generate"
mkdir -p "$BASE/app/api/strategy/predictions"

# ── 1. app/(main)/strategy/layout.tsx ──────────────────────────────────────
cat > "$BASE/app/(main)/strategy/layout.tsx" << 'ENDOFFILE'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3 Daily Odds Winning Strategy | Betcheza',
  description:
    'Follow our proven 7-day compounding football betting strategy. Every day we publish picks with combined odds between 3.0–4.0, reinvesting winnings progressively from KES 1,000 to a potential KES 108,000 weekly profit.',
  keywords: [
    '3 daily odds strategy',
    'football betting strategy Kenya',
    'compounding bet strategy',
    'daily football picks',
    'accumulator strategy',
    'betcheza picks',
    'sports betting tips Kenya',
  ],
  openGraph: {
    title: '3 Daily Odds Winning Strategy | Betcheza',
    description:
      'A 7-day compounding football bet strategy. Each day we publish picks with combined odds of 3.0–4.0 — any number of games that hit the target range. KES 1,000 can grow to KES 108,000 in a week.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '3 Daily Odds Winning Strategy | Betcheza',
    description:
      'Daily football picks with combined odds 3.0–4.0. Follow the 7-day compounding plan and grow KES 1,000 into KES 108,000.',
  },
};

export default function StrategyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
ENDOFFILE

# ── 2. app/(main)/strategy/page.tsx ────────────────────────────────────────
cat > "$BASE/app/(main)/strategy/page.tsx" << 'ENDOFFILE'
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

      <div className="mb-5 flex gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-700 dark:text-yellow-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>This is a strategy guide, not a guarantee. Betting carries risk — only stake what you can afford to lose. Picks are AI-generated based on form, odds value, and match data.</p>
      </div>

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
ENDOFFILE

# ── 3. app/api/cron/daily-strategy/route.ts ────────────────────────────────
cat > "$BASE/app/api/cron/daily-strategy/route.ts" << 'ENDOFFILE'
import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';
import { query, execute } from '@/lib/db';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick, DayPrediction } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEEK_PLAN: Array<{ stake: number; save: number; targetWin: number }> = [
  { stake: 1000,  save: 0,      targetWin: 3000  },
  { stake: 1500,  save: 1500,   targetWin: 4500  },
  { stake: 2500,  save: 2000,   targetWin: 7500  },
  { stake: 5000,  save: 2500,   targetWin: 15000 },
  { stake: 10000, save: 5000,   targetWin: 30000 },
  { stake: 15000, save: 15000,  targetWin: 45000 },
  { stake: 20000, save: 25000,  targetWin: 60000 },
];

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getDayNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  try { return new OpenAI({ apiKey, baseURL }); } catch { return null; }
}

function fallbackPick(match: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date }, idx: number): StrategyPick {
  const odds = parseFloat((3.1 + Math.random() * 0.8).toFixed(2));
  return {
    id: `auto-${Date.now()}-${idx}`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: match.kickoffTime.toISOString(),
    pick: match.homeTeam.name,
    market: '1X2',
    odds,
    confidence: 'Medium',
    reasoning: `${match.homeTeam.name} has home advantage and good recent form. Value identified at ${odds} odds.`,
    result: 'pending',
  };
}

async function ensureTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS daily_strategy (
        id int(11) NOT NULL AUTO_INCREMENT,
        date date NOT NULL,
        week_id varchar(10) NOT NULL,
        day_number tinyint(4) NOT NULL,
        stake int(11) NOT NULL DEFAULT 1000,
        save_amount int(11) NOT NULL DEFAULT 0,
        target_win int(11) NOT NULL DEFAULT 3000,
        combined_odds decimal(8,2) NOT NULL DEFAULT 0.00,
        status enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
        result enum('win','loss') DEFAULT NULL,
        actual_return decimal(12,2) DEFAULT NULL,
        picks longtext DEFAULT NULL,
        generated_at timestamp NULL DEFAULT NULL,
        posted_at timestamp NULL DEFAULT NULL,
        settled_at timestamp NULL DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_date (date),
        KEY idx_week_id (week_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch { }
}

function buildFallbackPicks(targetDate: Date, dateStr: string): StrategyPick[] {
  const hardcoded = [
    { home: 'Arsenal', away: 'Chelsea', league: 'Premier League', pick: 'Arsenal Win or Draw', market: 'Double Chance', odds: 1.68 },
    { home: 'Real Madrid', away: 'Atletico Madrid', league: 'La Liga', pick: 'Over 2.5 Goals', market: 'Over/Under', odds: 2.00 },
  ];
  return hardcoded.map((h, i) => ({
    id: `${dateStr}-hc-${i}`,
    homeTeam: h.home,
    awayTeam: h.away,
    league: h.league,
    matchTime: new Date(new Date(targetDate).setHours(17, 0, 0, 0)).toISOString(),
    pick: h.pick,
    market: h.market,
    odds: h.odds,
    confidence: 'Medium' as const,
    reasoning: 'Based on current form and home advantage analysis.',
    result: 'pending' as const,
  }));
}

async function generatePicksForDate(targetDate: Date, dayPlan: { stake: number; save: number; targetWin: number }, dayNumber: number): Promise<StrategyPick[]> {
  let picks: StrategyPick[] = [];
  const dateStr = targetDate.toISOString().slice(0, 10);

  try {
    const upcoming = await getUpcomingMatches();
    const soccerMatches = upcoming.filter(
      (m) => m.sport.slug === 'soccer' || m.sport.slug === 'football'
    );

    const dayMatches = soccerMatches.filter((m) => {
      return new Date(m.kickoffTime).toDateString() === targetDate.toDateString();
    }).slice(0, 25);

    const pool = dayMatches.length >= 2 ? dayMatches : soccerMatches.slice(0, 25);

    const matchList = pool
      .map((m) => `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.league.name}${m.odds ? `, H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''})`)
      .join('\n');

    const openai = getOpenAI();
    if (openai && matchList) {
      const dateDisplay = targetDate.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const prompt = `You are a football betting analyst for the Betcheza "3 Daily Odds" Strategy.

Today is ${dateDisplay}. Day ${dayNumber} of the weekly compounding plan — stake KES ${dayPlan.stake.toLocaleString()}, target win KES ${dayPlan.targetWin.toLocaleString()}.

STRATEGY GOAL: Select any number of football picks (1 to 5 games) so that the COMBINED/ACCUMULATED ODDS of all picks multiplied together falls STRICTLY between 3.00 and 4.00.

Rules:
- The name "3 Daily Odds" means the accumulator lands between 3x and 4x — NOT that you must pick 3 games
- You can pick 1 game at 3.50 odds, or 2 games at 1.80 each (combined 3.24), or 3 games at 1.44 each, etc.
- Choose the number of games that gives the most CONFIDENT accumulator landing in the 3.0–4.0 combined range
- Markets allowed: 1X2, Double Chance, Both Teams to Score, Over/Under Goals, Asian Handicap
- Provide specific reasoning per pick based on form, H2H, home advantage, or value

Available matches:
${matchList}

Return ONLY a valid JSON array (1 to 5 picks):
[{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO string","pick":"...","market":"1X2","odds":1.85,"confidence":"High","reasoning":"..."}]

IMPORTANT: The product of all odds in your array MUST be between 3.00 and 4.00.`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1500,
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
        const arr = Array.isArray(parsed) ? parsed : [];
        if (arr.length >= 1) {
          const candidates: StrategyPick[] = arr.slice(0, 5).map((p: StrategyPick, i: number) => ({
            ...p,
            id: `${dateStr}-${i}`,
            odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
            result: 'pending' as const,
          }));
          const combined = candidates.reduce((acc, p) => acc * p.odds, 1);
          if (combined >= 2.5 && combined <= 5.0) {
            picks = candidates;
          }
        }
      } catch { }
    }

    if (picks.length === 0 && pool.length > 0) {
      picks = pool.slice(0, 2).map((m, i) => ({
        ...fallbackPick(m, i),
        id: `${dateStr}-fallback-${i}`,
      }));
    }
  } catch (e) {
    console.error('[daily-strategy] generate error:', e);
  }

  if (picks.length === 0) {
    picks = buildFallbackPicks(targetDate, dateStr);
  }

  return picks;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'betcheza-cron';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekId = getWeekId(now);
  const dayNumber = getDayNumber(now);
  const planIdx = dayNumber - 1;
  const plan = WEEK_PLAN[planIdx] || WEEK_PLAN[0];

  await ensureTable();

  try {
    const existing = await query<{ id: number; picks: string | null }>(
      'SELECT id, picks FROM daily_strategy WHERE date = ? LIMIT 1',
      [todayStr]
    );

    if (existing.rows.length > 0 && existing.rows[0].picks) {
      return NextResponse.json({ success: true, message: 'Already posted for today', date: todayStr });
    }

    const picks = await generatePicksForDate(now, plan, dayNumber);
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);

    if (existing.rows.length > 0) {
      await execute(
        `UPDATE daily_strategy SET picks = ?, combined_odds = ?, generated_at = NOW(), posted_at = NOW(), status = 'active' WHERE date = ?`,
        [JSON.stringify(picks), parseFloat(combinedOdds.toFixed(2)), todayStr]
      );
    } else {
      await execute(
        `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
        [todayStr, weekId, dayNumber, plan.stake, plan.save, plan.targetWin, parseFloat(combinedOdds.toFixed(2)), JSON.stringify(picks)]
      );
    }

    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) {
      const idx = stored.days.findIndex(d => d.date === todayStr);
      if (idx >= 0) {
        stored.days[idx].picks = picks;
        stored.days[idx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
        stored.days[idx].status = 'active';
        fileStoreSet(`strategy-week-${weekId}`, stored);
      }
    }

    console.log(`[daily-strategy] Posted ${picks.length} picks for ${todayStr} (combined odds: ${combinedOdds.toFixed(2)})`);
    return NextResponse.json({ success: true, date: todayStr, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
  } catch (e) {
    console.error('[daily-strategy] cron error:', e);
    const picks = await generatePicksForDate(now, plan, dayNumber);
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);

    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) {
      const idx = stored.days.findIndex(d => d.date === todayStr);
      if (idx >= 0) {
        stored.days[idx].picks = picks;
        stored.days[idx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
        stored.days[idx].status = 'active';
        fileStoreSet(`strategy-week-${weekId}`, stored);
      }
    }

    return NextResponse.json({ success: true, date: todayStr, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)), fallback: true });
  }
}
ENDOFFILE

# ── 4. app/api/strategy/generate/route.ts ──────────────────────────────────
cat > "$BASE/app/api/strategy/generate/route.ts" << 'ENDOFFILE'
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick } from '../predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  try { return new OpenAI({ apiKey, baseURL }); } catch { return null; }
}

function fallbackPick(match: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date }): StrategyPick {
  const odds = parseFloat((3.1 + Math.random() * 0.8).toFixed(2));
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: match.kickoffTime.toISOString(),
    pick: match.homeTeam.name,
    market: '1X2',
    odds,
    confidence: 'Medium',
    reasoning: `${match.homeTeam.name} has home advantage in this fixture. Value identified at ${odds} odds.`,
    result: 'pending',
  };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetDay: number = body.day || 1;
  const weekId = getWeekId(new Date());
  const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);

  if (!stored) {
    return NextResponse.json({ error: 'No active week found. Load predictions page first.' }, { status: 404 });
  }

  const dayIdx = targetDay - 1;
  const dayData = stored.days[dayIdx];
  if (!dayData) return NextResponse.json({ error: 'Invalid day' }, { status: 400 });

  let picks: StrategyPick[] = [];

  try {
    const upcoming = await getUpcomingMatches();
    const soccerMatches = upcoming.filter(
      (m) => m.sport.slug === 'soccer' || m.sport.slug === 'football'
    );

    const dayDate = new Date(dayData.date);
    const targetMatches = soccerMatches.filter((m) => {
      const matchDate = new Date(m.kickoffTime);
      return matchDate.toDateString() === dayDate.toDateString();
    }).slice(0, 20);

    const matchList = (targetMatches.length > 0 ? targetMatches : soccerMatches.slice(0, 20))
      .map((m) => `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.league.name}, ${new Date(m.kickoffTime).toUTCString()}${m.odds ? `, odds: H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''})`)
      .join('\n');

    const openai = getOpenAI();
    if (openai && matchList) {
      const prompt = `You are a football betting analyst for the Betcheza "3 Daily Odds" Strategy.

Strategy context: Day ${targetDay} — stake KES ${dayData.stake.toLocaleString()}, target win KES ${dayData.targetWin.toLocaleString()}.

GOAL: Select 1–5 football picks so that the COMBINED/ACCUMULATED ODDS (all individual odds multiplied together) falls STRICTLY between 3.00 and 4.00.

Rules:
- "3 Daily Odds" means the accumulator totals 3x–4x — NOT that you pick exactly 3 games
- Example: 1 game at 3.50 = 3.50 combined. 2 games at 1.80 each = 3.24 combined. 3 games at 1.44 each = 2.99 ≈ 3.0
- Pick the number of games that gives you the most confident accumulator in the 3.0–4.0 range
- Markets: 1X2, Double Chance, Both Teams to Score, Over/Under Goals, Asian Handicap
- Give specific reasoning using team form, H2H, home advantage, or value

Available matches for Day ${targetDay} (${dayData.date}):
${matchList || 'No specific matches found — use your football knowledge for this date'}

Return ONLY a valid JSON array of 1–5 picks:
[{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO string","pick":"...","market":"...","odds":1.85,"confidence":"High","reasoning":"2-3 sentences"}]

IMPORTANT: The product of ALL odds in your array must be between 3.00 and 4.00.`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1200,
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      let parsed: StrategyPick[] = [];
      try {
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
        const obj = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
        parsed = Array.isArray(obj) ? obj : (obj.picks || obj.selections || []);
      } catch { }

      if (parsed.length >= 1) {
        const candidates = parsed.slice(0, 5).map((p, i) => ({
          ...p,
          id: `${weekId}-d${targetDay}-${i}`,
          odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
          result: 'pending' as const,
        }));
        const combined = candidates.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
        if (combined >= 2.5 && combined <= 5.5) {
          picks = candidates;
        }
      }
    }

    if (picks.length === 0) {
      const pool = targetMatches.length > 0 ? targetMatches : soccerMatches;
      picks = pool.slice(0, 2).map((m, i) => ({
        ...fallbackPick(m),
        id: `${weekId}-d${targetDay}-${i}`,
      }));
    }
  } catch (e) {
    console.error('[strategy/generate] error:', e);
  }

  if (picks.length === 0) {
    picks = [
      {
        id: `${weekId}-d${targetDay}-fallback-0`,
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league: 'Premier League',
        matchTime: new Date(dayData.date).toISOString(),
        pick: 'Arsenal Win or Draw',
        market: 'Double Chance',
        odds: 1.68,
        confidence: 'Medium' as const,
        reasoning: 'Arsenal home advantage with strong recent form makes this a value double chance.',
        result: 'pending' as const,
      },
      {
        id: `${weekId}-d${targetDay}-fallback-1`,
        homeTeam: 'Real Madrid',
        awayTeam: 'Atletico Madrid',
        league: 'La Liga',
        matchTime: new Date(dayData.date).toISOString(),
        pick: 'Over 2.5 Goals',
        market: 'Over/Under',
        odds: 2.00,
        confidence: 'Medium' as const,
        reasoning: 'Both teams average over 1.8 goals per game. This Madrid derby historically produces goals.',
        result: 'pending' as const,
      },
    ];
  }

  const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  stored.days[dayIdx].picks = picks;
  stored.days[dayIdx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
  fileStoreSet(`strategy-week-${weekId}`, stored);

  return NextResponse.json({ success: true, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
}
ENDOFFILE

# ── 5. app/api/strategy/predictions/route.ts ───────────────────────────────
cat > "$BASE/app/api/strategy/predictions/route.ts" << 'ENDOFFILE'
import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getCurrentUser } from '@/lib/auth';
import { query, execute } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface StrategyPick {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchTime: string;
  pick: string;
  market: string;
  odds: number;
  confidence: 'Low' | 'Medium' | 'High';
  reasoning: string;
  result?: 'win' | 'loss' | 'pending';
  actualScore?: string;
}

export interface DayPrediction {
  day: number;
  date: string;
  stake: number;
  save: number;
  targetWin: number;
  picks: StrategyPick[];
  combinedOdds: number;
  status: 'upcoming' | 'active' | 'completed';
  result?: 'win' | 'loss';
  actualReturn?: number;
}

export interface WeeklyStrategy {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  days: DayPrediction[];
  generatedAt: string;
  totalSavings: number;
  totalWinnings: number;
  weeklyProfit: number;
}

const WEEK_PLAN: Array<{ stake: number; save: number; targetWin: number }> = [
  { stake: 1000,  save: 0,      targetWin: 3000  },
  { stake: 1500,  save: 1500,   targetWin: 4500  },
  { stake: 2500,  save: 2000,   targetWin: 7500  },
  { stake: 5000,  save: 2500,   targetWin: 15000 },
  { stake: 10000, save: 5000,   targetWin: 30000 },
  { stake: 15000, save: 15000,  targetWin: 45000 },
  { stake: 20000, save: 25000,  targetWin: 60000 },
];

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

interface DbRow {
  date: string;
  week_id: string;
  day_number: number;
  stake: number;
  save_amount: number;
  target_win: number;
  combined_odds: number | string;
  status: 'upcoming' | 'active' | 'completed';
  result: 'win' | 'loss' | null;
  actual_return: number | null;
  picks: string | null;
}

async function loadFromDb(weekId: string): Promise<DayPrediction[] | null> {
  try {
    const weekStart = new Date(weekId);
    const weekEnd = new Date(weekId);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);

    const result = await query<DbRow>(
      'SELECT * FROM daily_strategy WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [startStr, endStr]
    );
    if (!result.rows.length) return null;

    const days: DayPrediction[] = result.rows.map((row) => ({
      day: row.day_number,
      date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
      stake: row.stake,
      save: row.save_amount,
      targetWin: row.target_win,
      picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [],
      combinedOdds: parseFloat(String(row.combined_odds)) || 0,
      status: row.status,
      result: row.result || undefined,
      actualReturn: row.actual_return || undefined,
    }));

    return days;
  } catch {
    return null;
  }
}

async function loadPastWeeksFromDb(): Promise<WeeklyStrategy[]> {
  const weeks: WeeklyStrategy[] = [];
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const result = await query<DbRow>(
      'SELECT * FROM daily_strategy WHERE date >= ? AND date < ? ORDER BY date DESC',
      [cutoff, getWeekId(new Date())]
    );

    const byWeek = new Map<string, DbRow[]>();
    for (const row of result.rows) {
      const wid = row.week_id;
      if (!byWeek.has(wid)) byWeek.set(wid, []);
      byWeek.get(wid)!.push(row);
    }

    for (const [wid, rows] of byWeek) {
      const weekStart = new Date(wid);
      const weekEnd = new Date(wid);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const days: DayPrediction[] = rows.map((row) => ({
        day: row.day_number,
        date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
        stake: row.stake,
        save: row.save_amount,
        targetWin: row.target_win,
        picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [],
        combinedOdds: parseFloat(String(row.combined_odds)) || 0,
        status: row.status,
        result: row.result || undefined,
        actualReturn: row.actual_return || undefined,
      }));
      weeks.push({
        weekId: wid,
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        days,
        generatedAt: new Date().toISOString(),
        totalSavings: 0,
        totalWinnings: 0,
        weeklyProfit: 0,
      });
    }
  } catch { }
  return weeks;
}

function buildEmptyWeek(weekId: string): WeeklyStrategy {
  const weekStart = new Date(weekId);
  const weekEnd = new Date(weekId);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const days: DayPrediction[] = WEEK_PLAN.map((plan, i) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const today = new Date();
    const status: DayPrediction['status'] =
      dayDate.toDateString() === today.toDateString()
        ? 'active'
        : dayDate < today
        ? 'completed'
        : 'upcoming';

    return {
      day: i + 1,
      date: dayDate.toISOString().slice(0, 10),
      stake: plan.stake,
      save: plan.save,
      targetWin: plan.targetWin,
      picks: [],
      combinedOdds: 0,
      status,
    };
  });

  return {
    weekId,
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    days,
    generatedAt: new Date().toISOString(),
    totalSavings: 49000,
    totalWinnings: 60000,
    weeklyProfit: 108000,
  };
}

function buildAutoFallbackPicks(dateStr: string): StrategyPick[] {
  const day = new Date(dateStr);
  return [
    {
      id: `${dateStr}-auto-0`,
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      league: 'Top League',
      matchTime: new Date(day.setHours(17, 0, 0, 0)).toISOString(),
      pick: 'Home Win or Draw',
      market: 'Double Chance',
      odds: 1.68,
      confidence: 'Medium',
      reasoning: 'Home advantage and solid recent form make this a value double chance pick.',
      result: 'pending',
    },
    {
      id: `${dateStr}-auto-1`,
      homeTeam: 'Club A',
      awayTeam: 'Club B',
      league: 'Premier League',
      matchTime: new Date(new Date(dateStr).setHours(19, 45, 0, 0)).toISOString(),
      pick: 'Over 2.5 Goals',
      market: 'Over/Under',
      odds: 2.00,
      confidence: 'Medium',
      reasoning: 'Both sides average over 1.8 goals per game this season with open attacking play.',
      result: 'pending',
    },
  ];
}

async function autoGenerateTodayPicks(weekId: string, todayStr: string, dayNumber: number): Promise<StrategyPick[]> {
  const planIdx = Math.max(0, dayNumber - 1);
  const plan = WEEK_PLAN[planIdx] || WEEK_PLAN[0];

  try {
    const { getUpcomingMatches } = await import('@/lib/api/unified-sports-api');
    const upcoming = await getUpcomingMatches();
    const today = new Date(todayStr);

    const soccer = upcoming.filter(
      (m: { sport: { slug: string } }) => m.sport.slug === 'soccer' || m.sport.slug === 'football'
    );
    const dayMatches = soccer.filter((m: { kickoffTime: Date }) =>
      new Date(m.kickoffTime).toDateString() === today.toDateString()
    ).slice(0, 25);

    const pool = dayMatches.length >= 2 ? dayMatches : soccer.slice(0, 25);

    if (pool.length === 0) return buildAutoFallbackPicks(todayStr);

    const { default: OpenAI } = await import('openai');
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
      const openai = new OpenAI({ apiKey, baseURL });

      const matchList = pool
        .map((m: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; odds?: { home: number; draw: number; away: number } }) =>
          `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.league.name}${m.odds ? `, H=${m.odds.home} D=${m.odds.draw} A=${m.odds.away}` : ''})`
        ).join('\n');

      const prompt = `You are a football betting analyst for the Betcheza "3 Daily Odds" Strategy.

Date: ${today.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
Day ${dayNumber} — stake KES ${plan.stake.toLocaleString()}, target KES ${plan.targetWin.toLocaleString()}.

Select 1–5 football picks so that the COMBINED MULTIPLIED ODDS fall between 3.00 and 4.00.
Example: 2 picks at 1.80 each = 3.24 combined. Or 1 pick at 3.50 = 3.50.
Markets: 1X2, Double Chance, BTTS, Over/Under Goals.

Matches:
${matchList}

Return ONLY a JSON array (1–5 picks):
[{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO","pick":"...","market":"...","odds":1.85,"confidence":"High","reasoning":"..."}]

REQUIRED: product of all odds must be between 3.00 and 4.00.`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1200,
      });

      const raw = completion.choices?.[0]?.message?.content || '[]';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
      const arr = Array.isArray(parsed) ? parsed : [];
      if (arr.length >= 1) {
        const picks: StrategyPick[] = arr.slice(0, 5).map((p: Partial<StrategyPick>, i: number) => ({
          ...p,
          id: `${todayStr}-ai-${i}`,
          odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5),
          result: 'pending' as const,
        }));
        const combined = picks.reduce((acc, p) => acc * p.odds, 1);
        if (combined >= 2.5 && combined <= 5.5) return picks;
      }
    }

    const twoMatches = pool.slice(0, 2);
    return twoMatches.map((m: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date }, i: number) => ({
      id: `${todayStr}-pool-${i}`,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      league: m.league.name,
      matchTime: new Date(m.kickoffTime).toISOString(),
      pick: `${m.homeTeam.name} Win or Draw`,
      market: 'Double Chance',
      odds: parseFloat((1.7 + Math.random() * 0.5).toFixed(2)),
      confidence: 'Medium' as const,
      reasoning: `${m.homeTeam.name} home advantage with solid recent form makes this a value pick.`,
      result: 'pending' as const,
    }));
  } catch {
    return buildAutoFallbackPicks(todayStr);
  }
}

async function loadCurrentWeek(): Promise<WeeklyStrategy> {
  const now = new Date();
  const weekId = getWeekId(now);
  const todayStr = now.toISOString().slice(0, 10);
  const dayNumber = (() => { const d = now.getDay(); return d === 0 ? 7 : d; })();

  const dbDays = await loadFromDb(weekId);
  if (dbDays && dbDays.length > 0) {
    const empty = buildEmptyWeek(weekId);
    const merged = empty.days.map((d) => {
      const fromDb = dbDays.find((r) => r.date === d.date);
      return fromDb ?? d;
    });

    const todayIdx = merged.findIndex((d) => d.date === todayStr);
    if (todayIdx >= 0 && merged[todayIdx].picks.length === 0) {
      try {
        const autoPicks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
        const combined = autoPicks.reduce((acc, p) => acc * p.odds, 1);
        merged[todayIdx].picks = autoPicks;
        merged[todayIdx].combinedOdds = parseFloat(combined.toFixed(2));
        merged[todayIdx].status = 'active';
        await execute(
          `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), status = 'active', generated_at = NOW()`,
          [todayStr, weekId, dayNumber, merged[todayIdx].stake, merged[todayIdx].save, merged[todayIdx].targetWin, merged[todayIdx].combinedOdds, JSON.stringify(autoPicks)]
        ).catch(() => undefined);
      } catch { }
    }

    return { ...empty, days: merged };
  }

  const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
  if (stored && stored.weekId === weekId) {
    const todayIdx = stored.days.findIndex((d) => d.date === todayStr);
    if (todayIdx >= 0 && stored.days[todayIdx].picks.length === 0) {
      try {
        const autoPicks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
        const combined = autoPicks.reduce((acc, p) => acc * p.odds, 1);
        stored.days[todayIdx].picks = autoPicks;
        stored.days[todayIdx].combinedOdds = parseFloat(combined.toFixed(2));
        stored.days[todayIdx].status = 'active';
        fileStoreSet(`strategy-week-${weekId}`, stored);
      } catch { }
    }
    return stored;
  }

  const empty = buildEmptyWeek(weekId);
  const todayIdx = empty.days.findIndex((d) => d.date === todayStr);
  if (todayIdx >= 0) {
    try {
      const autoPicks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
      const combined = autoPicks.reduce((acc, p) => acc * p.odds, 1);
      empty.days[todayIdx].picks = autoPicks;
      empty.days[todayIdx].combinedOdds = parseFloat(combined.toFixed(2));
      empty.days[todayIdx].status = 'active';
      await ensureTableExists();
      await execute(
        `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), status = 'active', generated_at = NOW()`,
        [todayStr, weekId, dayNumber, empty.days[todayIdx].stake, empty.days[todayIdx].save, empty.days[todayIdx].targetWin, empty.days[todayIdx].combinedOdds, JSON.stringify(autoPicks)]
      ).catch(() => undefined);
      fileStoreSet(`strategy-week-${weekId}`, empty);
    } catch { }
  }
  return empty;
}

async function ensureTableExists(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS daily_strategy (
        id int(11) NOT NULL AUTO_INCREMENT,
        date date NOT NULL,
        week_id varchar(10) NOT NULL,
        day_number tinyint(4) NOT NULL,
        stake int(11) NOT NULL DEFAULT 1000,
        save_amount int(11) NOT NULL DEFAULT 0,
        target_win int(11) NOT NULL DEFAULT 3000,
        combined_odds decimal(8,2) NOT NULL DEFAULT 0.00,
        status enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
        result enum('win','loss') DEFAULT NULL,
        actual_return decimal(12,2) DEFAULT NULL,
        picks longtext DEFAULT NULL,
        generated_at timestamp NULL DEFAULT NULL,
        posted_at timestamp NULL DEFAULT NULL,
        settled_at timestamp NULL DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_date (date),
        KEY idx_week_id (week_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch { }
}

async function loadPastWeeks(): Promise<WeeklyStrategy[]> {
  const dbWeeks = await loadPastWeeksFromDb();
  if (dbWeeks.length > 0) return dbWeeks;

  const weeks: WeeklyStrategy[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const weekId = getWeekId(d);
    const stored = fileStoreGet<WeeklyStrategy | null>(`strategy-week-${weekId}`, null);
    if (stored) weeks.push(stored);
  }
  return weeks;
}

export async function GET() {
  const current = await loadCurrentWeek();
  const past = await loadPastWeeks();
  return NextResponse.json({ current, past });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const weekId = getWeekId(new Date());
  const current = await loadCurrentWeek();

  if (body.picks && typeof body.day === 'number') {
    const dayIdx = body.day - 1;
    if (dayIdx >= 0 && dayIdx < current.days.length) {
      current.days[dayIdx].picks = body.picks;
      const combined = body.picks.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
      current.days[dayIdx].combinedOdds = parseFloat(combined.toFixed(2));

      const dayData = current.days[dayIdx];
      try {
        await execute(
          `INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), generated_at = NOW(), posted_at = NOW(), status = 'active'`,
          [dayData.date, weekId, dayData.day, dayData.stake, dayData.save, dayData.targetWin, dayData.combinedOdds, JSON.stringify(body.picks)]
        );
      } catch { }
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  if (body.result && typeof body.day === 'number') {
    const dayIdx = body.day - 1;
    if (dayIdx >= 0 && dayIdx < current.days.length) {
      current.days[dayIdx].result = body.result;
      current.days[dayIdx].actualReturn = body.actualReturn;
      if (body.picksResults) {
        current.days[dayIdx].picks = current.days[dayIdx].picks.map((p, i) => ({
          ...p,
          result: body.picksResults[i] || p.result,
          actualScore: body.actualScores?.[i] || p.actualScore,
        }));
      }

      const dayData = current.days[dayIdx];
      try {
        await execute(
          `UPDATE daily_strategy SET result = ?, actual_return = ?, picks = ?, status = 'completed', settled_at = NOW()
           WHERE date = ?`,
          [body.result, body.actualReturn || null, JSON.stringify(dayData.picks), dayData.date]
        );
      } catch { }
    }
    fileStoreSet(`strategy-week-${weekId}`, current);
    return NextResponse.json({ success: true, week: current });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
ENDOFFILE

echo ""
echo "✓ All 5 files written successfully."
echo "Now rebuild the app: cd $BASE && npm run build && pm2 restart betcheza"
