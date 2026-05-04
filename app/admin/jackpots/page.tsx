'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Plus, Trash2, RefreshCw, Brain, Edit3, Save, X, ChevronDown, ChevronUp, Sparkles, AlertCircle, Check, CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import type { Jackpot, JackpotGame, Prediction, JackpotResult } from '@/lib/jackpot-types';

const PICKS: Prediction[] = ['1', 'X', '2', '1X', 'X2', '12'];
const PICK_COLORS: Record<string, string> = {
  '1': 'bg-green-100 text-green-700 border-green-300',
  'X': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  '2': 'bg-blue-100 text-blue-700 border-blue-300',
  '1X': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'X2': 'bg-sky-100 text-sky-700 border-sky-300',
  '12': 'bg-violet-100 text-violet-700 border-violet-300',
};

interface SettleForm {
  winnersCount: string;
  prizePerWinner: string;
  notes: string;
  gameResults: Array<{ result: '1' | 'X' | '2' | ''; homeScore: string; awayScore: string }>;
}

export default function AdminJackpotsPage() {
  const [jackpots, setJackpots] = useState<Jackpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [predicting, setPredicting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState<SettleForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [newForm, setNewForm] = useState({
    bookmakerSlug: 'sportpesa',
    title: '',
    jackpotAmount: '',
    currency: 'KES',
    deadline: '',
    games: '',
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jackpot');
      const data = await res.json() as { jackpots: Jackpot[] };
      setJackpots(data.jackpots || []);
    } catch { showMsg('Failed to load jackpots', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function scrape() {
    setScraping(true);
    try {
      const res = await fetch('/api/jackpot/scrape', {
        headers: { authorization: 'Bearer betcheza-cron' },
      });
      const data = await res.json() as { message: string };
      showMsg(data.message || 'Scrape complete — real matches loaded');
      await load();
    } catch { showMsg('Scrape failed', 'error'); }
    setScraping(false);
  }

  async function predictAll() {
    setPredicting('all');
    try {
      const res = await fetch('/api/jackpot/predict', {
        headers: { authorization: 'Bearer betcheza-cron' },
      });
      const data = await res.json() as { predicted: number; total: number };
      showMsg(`AI predicted ${data.predicted} of ${data.total} jackpots`);
      await load();
    } catch { showMsg('Prediction failed', 'error'); }
    setPredicting(null);
  }

  async function predictOne(id: string) {
    setPredicting(id);
    try {
      const res = await fetch('/api/jackpot/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jackpotId: id }),
      });
      const data = await res.json() as { jackpot: Jackpot };
      showMsg('AI predictions generated!');
      setJackpots(prev => prev.map(j => j.id === id ? data.jackpot : j));
    } catch { showMsg('Prediction failed', 'error'); }
    setPredicting(null);
  }

  async function deleteJackpot(id: string) {
    if (!confirm('Delete this jackpot?')) return;
    try {
      await fetch(`/api/jackpot?id=${id}`, { method: 'DELETE' });
      setJackpots(prev => prev.filter(j => j.id !== id));
      showMsg('Deleted');
    } catch { showMsg('Delete failed', 'error'); }
  }

  async function updateGame(jackpotId: string, gameIdx: number, field: keyof JackpotGame, value: string | number) {
    const jackpot = jackpots.find(j => j.id === jackpotId);
    if (!jackpot) return;
    const games = jackpot.games.map((g, i) => i === gameIdx ? { ...g, [field]: value } : g);
    try {
      const res = await fetch('/api/jackpot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jackpotId, games }),
      });
      const data = await res.json() as { jackpot: Jackpot };
      setJackpots(prev => prev.map(j => j.id === jackpotId ? data.jackpot : j));
    } catch { showMsg('Save failed', 'error'); }
  }

  async function updateJackpotField(id: string, patch: Partial<Jackpot>) {
    setSaving(true);
    try {
      const res = await fetch('/api/jackpot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json() as { jackpot: Jackpot };
      setJackpots(prev => prev.map(j => j.id === id ? data.jackpot : j));
      setEditingId(null);
      showMsg('Saved');
    } catch { showMsg('Save failed', 'error'); }
    setSaving(false);
  }

  function openSettleDialog(jackpot: Jackpot) {
    setSettlingId(jackpot.id);
    setSettleForm({
      winnersCount: '',
      prizePerWinner: '',
      notes: '',
      gameResults: jackpot.games.map(() => ({ result: '', homeScore: '', awayScore: '' })),
    });
  }

  async function submitSettle() {
    if (!settlingId || !settleForm) return;
    setSaving(true);
    try {
      const jackpot = jackpots.find(j => j.id === settlingId);
      if (!jackpot) return;

      const gameResults = settleForm.gameResults
        .map((gr, i) => ({
          index: i,
          result: gr.result as '1' | 'X' | '2',
          homeScore: parseInt(gr.homeScore) || 0,
          awayScore: parseInt(gr.awayScore) || 0,
        }))
        .filter(gr => gr.result);

      const winningCombination = settleForm.gameResults
        .map(gr => gr.result || '?')
        .join(' ');

      const result: JackpotResult = {
        winnersCount: parseInt(settleForm.winnersCount) || 0,
        prizePerWinner: settleForm.prizePerWinner || undefined,
        winningCombination,
        settledAt: new Date().toISOString(),
        notes: settleForm.notes || undefined,
      };

      const res = await fetch('/api/jackpot/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jackpotId: settlingId, result, gameResults }),
      });
      const data = await res.json() as { jackpot: Jackpot };
      if (data.jackpot) {
        setJackpots(prev => prev.map(j => j.id === settlingId ? data.jackpot : j));
        showMsg('Jackpot settled and moved to results history');
        setSettlingId(null);
        setSettleForm(null);
      }
    } catch { showMsg('Settle failed', 'error'); }
    setSaving(false);
  }

  async function createJackpot() {
    if (!newForm.title || !newForm.jackpotAmount || !newForm.deadline) {
      showMsg('Fill title, amount and deadline', 'error'); return;
    }
    setSaving(true);
    try {
      const games: JackpotGame[] = newForm.games
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, i) => {
          const [home, ...rest] = line.split(' vs ');
          const away = rest.join(' vs ').trim();
          return { id: `g${i}`, home: home?.trim() || 'TBD', away: away || 'TBD' };
        });

      const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === newForm.bookmakerSlug);
      const res = await fetch('/api/jackpot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookmakerSlug: newForm.bookmakerSlug,
          bookmakerName: bk?.name || newForm.bookmakerSlug,
          title: newForm.title,
          jackpotAmount: newForm.jackpotAmount,
          currency: newForm.currency,
          deadline: new Date(newForm.deadline).toISOString(),
          games: games.length > 0 ? games : [{ id: 'g0', home: 'TBD', away: 'TBD' }],
          status: 'active',
        }),
      });
      const data = await res.json() as { jackpot: Jackpot };
      setJackpots(prev => [data.jackpot, ...prev]);
      setCreating(false);
      setNewForm({ bookmakerSlug: 'sportpesa', title: '', jackpotAmount: '', currency: 'KES', deadline: '', games: '' });
      showMsg('Jackpot created!');
    } catch { showMsg('Create failed', 'error'); }
    setSaving(false);
  }

  const active = jackpots.filter(j => j.status === 'active');
  const closed = jackpots.filter(j => j.status === 'closed');
  const settled = jackpots.filter(j => j.status === 'settled');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-amber-500" /> Jackpot Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{active.length} active · {settled.length} settled · {SUPPORTED_BOOKMAKERS.length} bookmakers</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/jackpots/results" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-4 w-4" /> View Public Results
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={scrape} disabled={scraping} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', scraping && 'animate-spin')} />
            {scraping ? 'Scraping real matches…' : 'Scrape Real Matches'}
          </Button>
          <Button variant="outline" size="sm" onClick={predictAll} disabled={!!predicting} className="gap-1.5">
            <Brain className={cn('h-4 w-4', predicting === 'all' && 'animate-pulse')} />
            {predicting === 'all' ? 'Predicting…' : 'AI Predict All'}
          </Button>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Jackpot
          </Button>
        </div>
      </div>

      {msg && (
        <div className={cn('rounded-lg px-4 py-2.5 text-sm flex items-center gap-2', msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800' : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800')}>
          {msg.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* Settle Dialog */}
      {settlingId && settleForm && (() => {
        const jackpot = jackpots.find(j => j.id === settlingId);
        if (!jackpot) return null;
        return (
          <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
                Settle: {jackpot.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Enter results for each match, then submit to move this jackpot to the public results history.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Number of Winners</Label>
                  <Input className="h-8 text-xs" type="number" placeholder="0" value={settleForm.winnersCount}
                    onChange={e => setSettleForm(f => f ? { ...f, winnersCount: e.target.value } : f)} />
                </div>
                <div>
                  <Label className="text-xs">Prize Per Winner (KES)</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. 50000000" value={settleForm.prizePerWinner}
                    onChange={e => setSettleForm(f => f ? { ...f, prizePerWinner: e.target.value } : f)} />
                </div>
                <div>
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. Jackpot rolled over" value={settleForm.notes}
                    onChange={e => setSettleForm(f => f ? { ...f, notes: e.target.value } : f)} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Match Results</p>
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {jackpot.games.map((game, i) => (
                    <div key={game.id || i} className="flex items-center gap-2 bg-background rounded-lg border border-border/40 px-3 py-2">
                      <span className="text-[10px] text-muted-foreground w-5 shrink-0 text-center">{i + 1}</span>
                      <span className="text-xs flex-1 min-w-0 truncate font-medium">{game.home} <span className="text-muted-foreground font-normal">vs</span> {game.away}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          className="h-6 w-10 text-xs text-center px-1"
                          placeholder="H"
                          value={settleForm.gameResults[i]?.homeScore ?? ''}
                          onChange={e => setSettleForm(f => {
                            if (!f) return f;
                            const gr = [...f.gameResults];
                            gr[i] = { ...gr[i], homeScore: e.target.value };
                            return { ...f, gameResults: gr };
                          })}
                        />
                        <span className="text-[10px] text-muted-foreground">–</span>
                        <Input
                          className="h-6 w-10 text-xs text-center px-1"
                          placeholder="A"
                          value={settleForm.gameResults[i]?.awayScore ?? ''}
                          onChange={e => setSettleForm(f => {
                            if (!f) return f;
                            const gr = [...f.gameResults];
                            gr[i] = { ...gr[i], awayScore: e.target.value };
                            return { ...f, gameResults: gr };
                          })}
                        />
                        <Select
                          value={settleForm.gameResults[i]?.result ?? ''}
                          onValueChange={v => setSettleForm(f => {
                            if (!f) return f;
                            const gr = [...f.gameResults];
                            gr[i] = { ...gr[i], result: v as '1' | 'X' | '2' };
                            return { ...f, gameResults: gr };
                          })}
                        >
                          <SelectTrigger className="h-6 w-14 text-xs">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 (H)</SelectItem>
                            <SelectItem value="X">X (D)</SelectItem>
                            <SelectItem value="2">2 (A)</SelectItem>
                          </SelectContent>
                        </Select>
                        {game.aiPrediction && (
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-bold', PICK_COLORS[game.aiPrediction] || '')}>
                            AI: {game.aiPrediction}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={submitSettle} disabled={saving} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />{saving ? 'Settling…' : 'Settle & Publish Results'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setSettlingId(null); setSettleForm(null); }} className="gap-1.5">
                  <X className="h-3.5 w-3.5" />Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Create form */}
      {creating && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add New Jackpot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bookmaker</Label>
                <Select value={newForm.bookmakerSlug} onValueChange={v => setNewForm(f => ({ ...f, bookmakerSlug: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORTED_BOOKMAKERS.map(b => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input className="h-8 text-xs" placeholder="e.g. Mega Jackpot" value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Prize Amount</Label>
                <Input className="h-8 text-xs" type="number" placeholder="e.g. 100000000" value={newForm.jackpotAmount} onChange={e => setNewForm(f => ({ ...f, jackpotAmount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={newForm.currency} onValueChange={v => setNewForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="KES">KES</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="UGX">UGX</SelectItem><SelectItem value="TZS">TZS</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Deadline</Label>
                <Input className="h-8 text-xs" type="datetime-local" value={newForm.deadline} onChange={e => setNewForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Games (one per line: Home vs Away)</Label>
              <Textarea className="text-xs min-h-[120px]" placeholder={"Arsenal vs Chelsea\nMan City vs Liverpool\nBarcelona vs Real Madrid"} value={newForm.games} onChange={e => setNewForm(f => ({ ...f, games: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createJackpot} disabled={saving} className="gap-1.5"><Save className="h-3.5 w-3.5" />{saving ? 'Saving…' : 'Create Jackpot'}</Button>
              <Button size="sm" variant="outline" onClick={() => setCreating(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Jackpots */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Active ({active.length})</h2>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />)}</div>
        ) : active.length === 0 ? (
          <Card><CardContent className="p-8 text-center"><Trophy className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">No active jackpots. Click "Scrape Real Matches" to fetch the latest real fixtures.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {active.map(jackpot => {
              const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === jackpot.bookmakerSlug);
              const hasPreds = jackpot.games.some(g => g.aiPrediction);
              const isExpanded = expandedId === jackpot.id;
              return (
                <Card key={jackpot.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="h-1" style={{ background: bk?.color || '#888' }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{jackpot.title}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{jackpot.games.length} games</Badge>
                            {hasPreds ? (
                              <Badge className="text-[10px] h-4 bg-primary/10 text-primary border-primary/20"><Brain className="h-2.5 w-2.5 mr-0.5" />AI Done</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] h-4">No AI yet</Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] h-4"
                              style={{ color: bk?.color, borderColor: bk?.color + '60' }}>
                              {bk?.name || jackpot.bookmakerSlug}
                            </Badge>
                          </div>
                          <p className="text-lg font-extrabold mt-1" style={{ color: bk?.color || '#888' }}>
                            {jackpot.currency} {parseInt(jackpot.jackpotAmount).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Closes: {new Date(jackpot.deadline).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => predictOne(jackpot.id)} disabled={!!predicting}>
                            <Sparkles className={cn('h-3.5 w-3.5', predicting === jackpot.id && 'animate-spin')} />
                            {predicting === jackpot.id ? '…' : 'Predict'}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setExpandedId(isExpanded ? null : jackpot.id); setEditingId(null); }}>
                            <Edit3 className="h-3.5 w-3.5" />
                            {isExpanded ? 'Close' : 'Edit Games'}
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => openSettleDialog(jackpot)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />Settle
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteJackpot(jackpot.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 border-t pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground">EDIT GAMES & PICKS</p>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={async () => {
                              await updateJackpotField(jackpot.id, { status: 'closed' });
                              showMsg('Jackpot closed');
                            }}>Close Jackpot</Button>
                          </div>
                          <div className="space-y-1.5">
                            {jackpot.games.map((game, i) => (
                              <div key={game.id} className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground w-5 text-center shrink-0">{i + 1}</span>
                                <Input
                                  className="h-7 text-xs flex-1 min-w-[120px]"
                                  defaultValue={game.home}
                                  onBlur={e => { if (e.target.value !== game.home) updateGame(jackpot.id, i, 'home', e.target.value); }}
                                  placeholder="Home"
                                />
                                <span className="text-xs text-muted-foreground">vs</span>
                                <Input
                                  className="h-7 text-xs flex-1 min-w-[120px]"
                                  defaultValue={game.away}
                                  onBlur={e => { if (e.target.value !== game.away) updateGame(jackpot.id, i, 'away', e.target.value); }}
                                  placeholder="Away"
                                />
                                <Select
                                  value={game.aiPrediction || game.prediction || ''}
                                  onValueChange={v => updateGame(jackpot.id, i, 'aiPrediction', v as Prediction)}
                                >
                                  <SelectTrigger className="h-7 w-16 text-xs">
                                    <SelectValue placeholder="Pick" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">—</SelectItem>
                                    {PICKS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                {(game.aiPrediction || game.prediction) && (
                                  <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', PICK_COLORS[game.aiPrediction || game.prediction || ''] || '')}>
                                    {game.aiPrediction || game.prediction}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Closed */}
      {closed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Closed ({closed.length})</h2>
          <div className="space-y-2">
            {closed.map(jackpot => {
              const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === jackpot.bookmakerSlug);
              return (
                <Card key={jackpot.id} className="opacity-70">
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">{jackpot.title}</p>
                      <p className="text-[10px] text-muted-foreground">{bk?.name} · {jackpot.currency} {parseInt(jackpot.jackpotAmount).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 text-[10px] bg-amber-500 hover:bg-amber-600 text-white gap-1" onClick={() => openSettleDialog(jackpot)}>
                        <CheckCircle2 className="h-3 w-3" />Settle
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateJackpotField(jackpot.id, { status: 'active' })}>Reopen</Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteJackpot(jackpot.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Settled */}
      {settled.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Settled / Results ({settled.length})
          </h2>
          <div className="space-y-2">
            {settled.map(jackpot => {
              const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === jackpot.bookmakerSlug);
              return (
                <Card key={jackpot.id} className="border-green-200 dark:border-green-900/40 bg-green-50/20 dark:bg-green-950/10">
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{jackpot.title}</p>
                        <Badge className="text-[10px] h-4 bg-green-100 text-green-700 border-green-200">Settled</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {bk?.name} · {jackpot.currency} {parseInt(jackpot.jackpotAmount).toLocaleString()}
                        {jackpot.result?.winnersCount !== undefined && ` · ${jackpot.result.winnersCount} winner${jackpot.result.winnersCount !== 1 ? 's' : ''}`}
                        {jackpot.result?.settledAt && ` · ${new Date(jackpot.result.settledAt).toLocaleDateString()}`}
                      </p>
                      {jackpot.result?.winningCombination && (
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-xs">
                          {jackpot.result.winningCombination}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateJackpotField(jackpot.id, { status: 'active' })}>Reopen</Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteJackpot(jackpot.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
