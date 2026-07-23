'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, RefreshCw, CheckCircle2, XCircle, Circle, Save, Loader2, Plus, Trash2, Calendar, Clock, PenLine, Bot, ChevronDown, ChevronUp, Wrench, Users, Mail, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WeeklyStrategy, StrategyPick, DayPrediction } from '@/app/api/strategy/predictions/route';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatKES(n: number) {
  return `KES ${n.toLocaleString()}`;
}

const EMPTY_PICK = (): Partial<StrategyPick> => ({
  homeTeam: '', awayTeam: '', league: '', matchTime: '', pick: '', market: '1X2', odds: 1.80, confidence: 'Medium', reasoning: '',
});

function ManualPickEditor({
  picks,
  onChange,
}: {
  picks: Partial<StrategyPick>[];
  onChange: (picks: Partial<StrategyPick>[]) => void;
}) {
  const combinedOdds = picks.reduce((acc, p) => acc * (parseFloat(String(p.odds)) || 1), 1);

  const updatePick = (i: number, field: keyof StrategyPick, value: string | number) => {
    const updated = picks.map((p, idx) => idx === i ? { ...p, [field]: value } : p);
    onChange(updated);
  };

  const removePick = (i: number) => onChange(picks.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {picks.map((pick, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Pick {i + 1}</span>
            <button onClick={() => removePick(i)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Home Team"
              value={pick.homeTeam || ''}
              onChange={e => updatePick(i, 'homeTeam', e.target.value)}
              className="col-span-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <input
              placeholder="Away Team"
              value={pick.awayTeam || ''}
              onChange={e => updatePick(i, 'awayTeam', e.target.value)}
              className="col-span-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <input
            placeholder="League (e.g. Premier League)"
            value={pick.league || ''}
            onChange={e => updatePick(i, 'league', e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={pick.market || '1X2'}
              onChange={e => updatePick(i, 'market', e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option>1X2</option>
              <option>Double Chance</option>
              <option>Both Teams to Score</option>
              <option>Over/Under</option>
              <option>Total Goals</option>
              <option>Draw No Bet</option>
            </select>
            <input
              placeholder="Pick (e.g. Home Win)"
              value={pick.pick || ''}
              onChange={e => updatePick(i, 'pick', e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <input
              type="number"
              placeholder="Odds"
              step="0.01"
              min="1.01"
              value={pick.odds || ''}
              onChange={e => updatePick(i, 'odds', parseFloat(e.target.value) || 1.5)}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={pick.matchTime ? new Date(pick.matchTime).toISOString().slice(0, 16) : ''}
              onChange={e => updatePick(i, 'matchTime', e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <select
              value={pick.confidence || 'Medium'}
              onChange={e => updatePick(i, 'confidence', e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="High">High Confidence</option>
              <option value="Medium">Medium Confidence</option>
              <option value="Low">Low Confidence</option>
            </select>
          </div>
          <textarea
            placeholder="Reasoning / analysis (optional)"
            value={pick.reasoning || ''}
            onChange={e => updatePick(i, 'reasoning', e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
        </div>
      ))}
      <button
        onClick={() => onChange([...picks, EMPTY_PICK()])}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add Pick
      </button>
      {picks.length > 0 && (
        <div className={cn(
          'rounded-lg px-3 py-2 text-xs font-mono font-bold text-center',
          combinedOdds >= 3.0 && combinedOdds <= 4.0 ? 'bg-green-500/15 text-green-600' :
          combinedOdds >= 2.5 && combinedOdds <= 5.0 ? 'bg-yellow-500/15 text-yellow-600' :
          'bg-red-500/15 text-red-500'
        )}>
          Combined Odds: {combinedOdds.toFixed(2)}x {combinedOdds >= 3.0 && combinedOdds <= 4.0 ? '✓ Target range' : '⚠ Target: 3.00–4.00'}
        </div>
      )}
    </div>
  );
}

function DayPanel({ day, weekId, onRefresh, isHistorical }: { day: DayPrediction; weekId: string; onRefresh: () => void; isHistorical?: boolean }) {
  const [open, setOpen] = useState(day.status === 'active');
  const [mode, setMode] = useState<'view' | 'manual' | 'ai'>('view');
  const [manualPicks, setManualPicks] = useState<Partial<StrategyPick>[]>([EMPTY_PICK()]);
  const [scheduledFor, setScheduledFor] = useState(isHistorical ? (day.date || '') : '');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [dayResult, setDayResult] = useState<'win' | 'loss' | null>(day.result || null);
  // Pre-fill from existing settlement so admin sees what's currently set and can correct it
  const [pickResults, setPickResults] = useState<Record<number, 'win' | 'loss'>>(() => {
    const init: Record<number, 'win' | 'loss'> = {};
    day.picks.forEach((p, i) => { if (p.result === 'win' || p.result === 'loss') init[i] = p.result; });
    return init;
  });
  const [pickScores, setPickScores] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    day.picks.forEach((p, i) => { if (p.actualScore) init[i] = p.actualScore; });
    return init;
  });
  const [msg, setMsg] = useState('');
  const [approving, setApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(!!day.isApproved);

  const handleApprove = async () => {
    setApproving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/strategy/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: day.date }),
      });
      const d = await res.json();
      if (d.success) {
        setIsApproved(true);
        setMsg('Picks approved and emails sent to subscribers!');
        onRefresh();
      } else {
        setMsg(d.error || 'Approval failed');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setApproving(false);
    }
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    setMsg('');
    try {
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: day.day }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`AI picks generated (combined odds: ${d.combinedOdds?.toFixed(2) ?? '?'})`);
        onRefresh();
        setMode('view');
      } else {
        setMsg(d.error || 'AI generation failed');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveManual = async () => {
    const validPicks = manualPicks.filter(p => p.homeTeam && p.awayTeam && p.pick && p.odds && p.odds > 1);
    if (validPicks.length === 0) { setMsg('Add at least one valid pick'); return; }
    setSaving(true);
    setMsg('');
    try {
      const finalPicks: StrategyPick[] = validPicks.map((p, i) => ({
        id: `manual-${day.day}-${i}-${Date.now()}`,
        homeTeam: p.homeTeam!,
        awayTeam: p.awayTeam!,
        league: p.league || '',
        matchTime: p.matchTime || new Date().toISOString(),
        pick: p.pick!,
        market: p.market || '1X2',
        odds: parseFloat(String(p.odds)) || 1.5,
        confidence: (p.confidence as StrategyPick['confidence']) || 'Medium',
        reasoning: p.reasoning || '',
        result: 'pending',
      }));
      const res = await fetch('/api/strategy/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: day.day, picks: finalPicks, isManual: true, scheduledFor: scheduledFor || null }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(scheduledFor ? `Picks scheduled for ${scheduledFor}` : 'Manual picks saved');
        onRefresh();
        setMode('view');
      } else {
        setMsg(d.error || 'Failed to save');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResult = async () => {
    if (!dayResult) return;
    setSavingResult(true);
    try {
      const picksResultsArr = day.picks.map((_, i) => pickResults[i] || null);
      const picksScoresArr = day.picks.map((_, i) => pickScores[i] || null);
      const res = await fetch('/api/strategy/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: day.day, date: day.date, result: dayResult, picksResults: picksResultsArr, actualScores: picksScoresArr }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`Day ${day.day} result saved: ${dayResult}`);
        onRefresh();
      }
    } catch {
      setMsg('Failed to save result');
    } finally {
      setSavingResult(false);
    }
  };

  return (
    <div className={cn('rounded-xl border bg-card', day.status === 'active' && 'border-primary/40 bg-primary/5')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 p-3"
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0',
            day.status === 'active' ? 'bg-primary text-primary-foreground' :
            (dayResult || day.result) === 'win' ? 'bg-green-500 text-white' :
            (dayResult || day.result) === 'loss' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'
          )}>
            {(dayResult || day.result) === 'win' ? '✓' : (dayResult || day.result) === 'loss' ? '✗' : day.day}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">Day {day.day}</span>
              {day.status === 'active' && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">Today</span>}
              {day.isManual && <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-600 uppercase flex items-center gap-0.5"><PenLine className="h-2.5 w-2.5" />Manual</span>}
              {day.scheduledFor && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 uppercase flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />Scheduled</span>}
              {(dayResult || day.result) && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', (dayResult || day.result) === 'win' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600')}>{dayResult || day.result}</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {day.date}{day.scheduledFor && day.scheduledFor !== day.date ? ` → scheduled ${day.scheduledFor}` : ''} · Stake {formatKES(day.stake)} · Target {formatKES(day.targetWin)}
              {day.picks.length > 0 && ` · ${day.picks.length} pick${day.picks.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {day.combinedOdds > 0 && (
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-mono font-bold text-primary">{day.combinedOdds.toFixed(2)}x</span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-3">
          {msg && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{msg}</div>
          )}

          {/* Pending approval banner */}
          {day.picks.length > 0 && !isApproved && day.status === 'active' && mode === 'view' && (
            <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex items-start gap-2">
              <span className="text-amber-600 text-base leading-none mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Awaiting your approval — picks are hidden from subscribers</p>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">Review the picks below, then click <strong>Approve &amp; Send to Users</strong> when you&apos;re happy with them.</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {mode === 'view' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setMode('manual'); setManualPicks(day.picks.length > 0 ? day.picks.map(p => ({ ...p })) : [EMPTY_PICK()]); }} className="gap-1 text-xs h-7">
                <PenLine className="h-3 w-3" /> {day.picks.length > 0 ? 'Edit Manually' : 'Post Manually'}
              </Button>
              {!day.isManual && (
                <Button size="sm" variant="outline" onClick={handleGenerateAI} disabled={generating} className="gap-1 text-xs h-7">
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                  {day.picks.length > 0 ? 'Regenerate AI' : 'Generate AI Picks'}
                </Button>
              )}
              {day.isManual && (
                <Button size="sm" variant="outline" onClick={handleGenerateAI} disabled={generating} className="gap-1 text-xs h-7 text-muted-foreground">
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                  Override with AI
                </Button>
              )}
              {day.picks.length > 0 && !isApproved && (
                <Button size="sm" onClick={handleApprove} disabled={approving} className="gap-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Approve &amp; Send to Users
                </Button>
              )}
              {isApproved && day.picks.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Approved &amp; Sent
                </span>
              )}
            </div>
          )}

          {/* Manual editor */}
          {mode === 'manual' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Manual Picks</p>
                <button onClick={() => setMode('view')} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>

              {/* Schedule option — hidden for historical days (date is fixed) */}
              {!isHistorical && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Schedule for a specific date (optional)
                  </label>
                  <input
                    type="date"
                    value={scheduledFor}
                    onChange={e => setScheduledFor(e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Leave empty to post for today. Set a future date to schedule (AI won&apos;t override scheduled days).</p>
                </div>
              )}
              {isHistorical && day.date && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  Editing past day: <strong>{day.date}</strong>. Picks will be saved under this date.
                </div>
              )}

              <ManualPickEditor picks={manualPicks} onChange={setManualPicks} />

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveManual} disabled={saving} className="gap-1 text-xs h-7">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {scheduledFor ? 'Schedule Picks' : 'Save & Publish'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode('view')} className="text-xs h-7">Cancel</Button>
              </div>
            </div>
          )}

          {/* Existing picks view */}
          {mode === 'view' && day.picks.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Current Picks</p>
              {day.picks.map((pick, i) => (
                <div key={pick.id || i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
                  <div className="mt-0.5 shrink-0">
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
                    {pick.actualScore && <p className="text-[11px] font-medium text-foreground">Score: {pick.actualScore}</p>}

                    {/* Per-pick result override */}
                    <div className="mt-1.5 space-y-1">
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        Wrong result? Enter the real score + click the correct outcome, then Save Result below.
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">Result:</span>
                        <button
                          onClick={() => setPickResults(p => ({ ...p, [i]: 'win' }))}
                          className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors', pickResults[i] === 'win' ? 'bg-green-500 text-white border-green-500' : 'border-border text-muted-foreground hover:border-green-500/40')}
                        >✓ Win</button>
                        <button
                          onClick={() => setPickResults(p => ({ ...p, [i]: 'loss' }))}
                          className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors', pickResults[i] === 'loss' ? 'bg-red-500 text-white border-red-500' : 'border-border text-muted-foreground hover:border-red-500/40')}
                        >✗ Loss</button>
                        <input
                          placeholder="Score e.g. 0-2"
                          value={pickScores[i] || ''}
                          onChange={e => setPickScores(p => ({ ...p, [i]: e.target.value }))}
                          className="w-24 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Overall day result */}
              <div className="flex items-center gap-2 pt-1 flex-wrap border-t border-border mt-2">
                <span className="text-xs text-muted-foreground shrink-0 font-semibold">Overall Day Result:</span>
                <button
                  onClick={() => setDayResult('win')}
                  className={cn('rounded px-2 py-1 text-xs font-bold border flex items-center gap-1 transition-colors', dayResult === 'win' ? 'bg-green-500 text-white border-green-500' : 'border-border text-muted-foreground hover:border-green-500/40')}
                >
                  <CheckCircle2 className="h-3 w-3" /> Win
                </button>
                <button
                  onClick={() => setDayResult('loss')}
                  className={cn('rounded px-2 py-1 text-xs font-bold border flex items-center gap-1 transition-colors', dayResult === 'loss' ? 'bg-red-500 text-white border-red-500' : 'border-border text-muted-foreground hover:border-red-500/40')}
                >
                  <XCircle className="h-3 w-3" /> Loss
                </button>
                {dayResult && (
                  <Button size="sm" onClick={handleSaveResult} disabled={savingResult} className="h-7 gap-1 text-xs">
                    {savingResult ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save Result
                  </Button>
                )}
                {day.result && !dayResult && (
                  <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase', day.result === 'win' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600')}>
                    Recorded: {day.result}
                  </span>
                )}
              </div>
            </div>
          )}

          {mode === 'view' && day.picks.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No picks yet — post manually or generate with AI.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ResettleResult {
  success: boolean;
  summary?: {
    correctedFromStoredScore: number;
    settledFromSportsAPI: number;
    totalFixed: number;
    daysUpdated: number;
  };
  corrections?: Array<{ date: string; match: string; pick: string; score: string; was: string; now: string }>;
  error?: string;
}

function ResettleButton({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResettleResult | null>(null);

  const run = async (forceRefresh = false) => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/strategy/resettle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, forceRefresh }),
      });
      const data: ResettleResult = await res.json();
      setResult(data);
      if (data.success) onDone();
    } catch {
      setResult({ success: false, error: 'Network error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Fix Past Results</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => run(false)} disabled={running} className="h-7 gap-1 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {running ? 'Re-settling…' : 'Re-settle All'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => run(true)} disabled={running} className="h-7 gap-1 text-xs border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10" title="Clears match cache first — use when a score was stored wrong (e.g. settled at half-time)">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Force Re-fetch & Resettle
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        <strong>Re-settle All</strong> — corrects picks where the stored score was wrong based on logic fixes.
        <strong> Force Re-fetch</strong> — clears the match cache and fetches live final scores before re-settling (use when a pick was settled mid-match with the wrong score).
      </p>
      {result && (
        <div className={cn('rounded px-2.5 py-2 text-xs space-y-1', result.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-600')}>
          {result.success ? (
            <>
              <p className="font-semibold">
                {result.summary?.totalFixed === 0
                  ? 'All picks already correct — nothing changed.'
                  : `Fixed ${result.summary?.totalFixed} pick${result.summary?.totalFixed !== 1 ? 's' : ''} across ${result.summary?.daysUpdated} day${result.summary?.daysUpdated !== 1 ? 's' : ''}.`}
              </p>
              {(result.corrections || []).slice(0, 6).map((c, i) => (
                <p key={i} className="text-[10px] font-mono">
                  {c.date} · {c.match} · <span className="font-bold">{c.pick}</span> · score {c.score} → <span className={c.now === 'win' ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{c.now}</span> <span className="opacity-60">(was {c.was})</span>
                </p>
              ))}
              {(result.corrections?.length || 0) > 6 && (
                <p className="text-[10px] opacity-60">…and {result.corrections!.length - 6} more</p>
              )}
            </>
          ) : (
            <p>{result.error || 'Re-settlement failed'}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface SubscriberRow {
  userId: number;
  email: string;
  username: string;
  displayName: string;
  phone: string;
  paidAt: string;
  expiresAt: string;
  daysRemaining: number;
}

function SubscribersPanel() {
  const { data, isLoading } = useSWR<{ active: SubscriberRow[]; expired: SubscriberRow[]; pending: unknown[] }>(
    '/api/admin/strategy-subscribers',
    fetcher,
    { refreshInterval: 30_000 }
  );

  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendMsg, setSendMsg] = useState('');
  const [sendError, setSendError] = useState('');

  const active = data?.active || [];
  const expired = data?.expired || [];

  const sendToAll = async () => {
    setSendingAll(true);
    setSendMsg('');
    setSendError('');
    try {
      const res = await fetch('/api/admin/strategy/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (d.success) {
        setSendMsg(d.message || `Sent to ${d.sent} subscriber${d.sent !== 1 ? 's' : ''}`);
      } else {
        setSendError(d.error || 'Failed to send');
      }
    } catch {
      setSendError('Network error');
    } finally {
      setSendingAll(false);
    }
  };

  const sendToUser = async (userId: number) => {
    setSendingId(userId);
    setSendMsg('');
    setSendError('');
    try {
      const res = await fetch('/api/admin/strategy/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (d.success) {
        setSendMsg(`Email sent.`);
      } else {
        setSendError(d.error || 'Failed');
      }
    } catch {
      setSendError('Network error');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card h-fit sticky top-14">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Subscribers</p>
            <p className="text-[10px] text-muted-foreground">{active.length} active · {expired.length} expired</p>
          </div>
        </div>
      </div>

      {/* Send to all */}
      <div className="p-3 border-b border-border space-y-2">
        <Button
          size="sm"
          onClick={sendToAll}
          disabled={sendingAll || active.length === 0}
          className="w-full h-8 gap-1.5 text-xs"
        >
          {sendingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {sendingAll ? 'Sending…' : `Send Today's Picks to All (${active.length})`}
        </Button>
        {sendMsg && (
          <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 shrink-0" /> {sendMsg}
          </div>
        )}
        {sendError && (
          <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 shrink-0" /> {sendError}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Sends today&apos;s published picks to all active subscribers via email.
        </p>
      </div>

      {/* Subscriber list */}
      <div className="divide-y divide-border max-h-[440px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : active.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No active subscribers yet.
          </div>
        ) : (
          active.map((sub) => (
            <div key={sub.userId} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{sub.displayName || sub.username}</p>
                <p className="text-[10px] text-muted-foreground truncate">{sub.email || sub.phone}</p>
                <p className="text-[10px] text-emerald-600 font-medium">{sub.daysRemaining}d left</p>
              </div>
              <button
                onClick={() => sendToUser(sub.userId)}
                disabled={sendingId === sub.userId}
                title="Send today's picks"
                className="shrink-0 flex items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
              >
                {sendingId === sub.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
              </button>
            </div>
          ))
        )}
      </div>

      {expired.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground">{expired.length} expired subscriber{expired.length !== 1 ? 's' : ''} (not included in sends)</p>
        </div>
      )}
    </div>
  );
}

export default function AdminStrategyPage() {
  const { data, mutate, isLoading } = useSWR<{ current: WeeklyStrategy; past: WeeklyStrategy[] }>(
    '/api/strategy/predictions',
    fetcher
  );

  const current = data?.current;
  const past = data?.past || [];
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const allWeeks: Array<WeeklyStrategy & { label: string }> = [];
  if (current) allWeeks.push({ ...current, label: 'Current Week' });
  past.forEach((w, i) => allWeeks.push({ ...w, label: i === 0 ? 'Last Week' : `${new Date(w.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` }));

  const activeWeekId = selectedWeekId ?? current?.weekId ?? null;
  const displayedWeek = allWeeks.find(w => w.weekId === activeWeekId) ?? allWeeks[0];
  const isHistorical = displayedWeek?.weekId !== current?.weekId;

  return (
    <div className="lg:grid lg:grid-cols-[1fr,300px] lg:gap-4 lg:items-start max-w-5xl">
      {/* Left column — strategy management */}
      <div>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">3 Daily Odds Strategy</h1>
            <p className="text-sm text-muted-foreground">Post picks manually, schedule future days, or generate with AI. Manual posts block AI auto-generation for that day.</p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> How it works
          </p>
          <p><strong>Manual Post:</strong> Write your own picks for any day. AI will not override manually posted days.</p>
          <p><strong>Schedule:</strong> Set picks for tomorrow or any future date — they&apos;ll be live that day.</p>
          <p><strong>AI Generate:</strong> Let the AI create picks from live match data (only if no manual picks exist).</p>
          <p><strong>Record Results:</strong> Mark each pick and the overall day as win/loss after matches finish.</p>
          <p><strong>Email:</strong> Subscribers are automatically emailed when picks are published. Use the panel on the right to resend manually.</p>
        </div>

        <div className="mb-4">
          <ResettleButton onDone={mutate} />
        </div>

        {/* Week selector */}
        {!isLoading && allWeeks.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {allWeeks.map((w) => {
              const wins = w.days.filter(d => d.result === 'win').length;
              const losses = w.days.filter(d => d.result === 'loss').length;
              const isActive = w.weekId === activeWeekId;
              return (
                <button
                  key={w.weekId}
                  onClick={() => setSelectedWeekId(w.weekId)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {w.label}
                  {(wins > 0 || losses > 0) && (
                    <span className={cn('rounded px-1 py-0.5 text-[10px] font-bold', isActive ? 'bg-white/20' : 'bg-muted')}>
                      {wins}W/{losses}L
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {isHistorical && displayedWeek && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Editing past week of <strong>{new Date(displayedWeek.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Changes apply to the specific dates shown in each day.</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : displayedWeek ? (
          <div className="space-y-3">
            {displayedWeek.days.map((day) => (
              <DayPanel key={`${displayedWeek.weekId}-${day.day}`} day={day} weekId={displayedWeek.weekId} onRefresh={mutate} isHistorical={isHistorical} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">No strategy data found.</div>
        )}
      </div>

      {/* Right column — subscribers panel */}
      <div className="mt-6 lg:mt-0">
        <SubscribersPanel />
      </div>
    </div>
  );
}
