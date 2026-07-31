'use client';

import { useState } from 'react';
import { Star, Loader2, Target, TrendingUp, ArrowLeftRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export interface OutrightTipData {
  leagueId: number;
  leagueName: string;
  marketName: string;
  marketKey: 'outright_winner' | 'top_scorer' | 'player_transfer' | string;
  prediction: string;
  odds: number;
  matchSlug?: string;
  sport?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: OutrightTipData | null;
  isAuthenticated: boolean;
  isTipster: boolean;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const MARKET_ICONS: Record<string, React.ElementType> = {
  outright_winner: Target,
  top_scorer: TrendingUp,
  player_transfer: ArrowLeftRight,
};

const STAKE_LABELS: Record<number, string> = {
  1: '1 unit (Low)',
  2: '2 units',
  3: '3 units (Mid)',
  4: '4 units',
  5: '5 units (High)',
};

export function OutrightTipModal({ open, onClose, data, isAuthenticated, isTipster, onOpenAuth }: Props) {
  const [analysis, setAnalysis] = useState('');
  const [stake, setStake] = useState(3);
  const [confidence, setConfidence] = useState(70);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setTimeout(() => {
      setAnalysis('');
      setStake(3);
      setConfidence(70);
      setSubmitting(false);
      setSubmitted(false);
      setError(null);
    }, 300);
  }

  async function handleSubmit() {
    if (!data) return;
    if (analysis.trim().length < 20) {
      setError('Please write at least 20 characters of analysis.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/outrights/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: data.leagueId,
          leagueName: data.leagueName,
          marketName: data.marketName,
          marketKey: data.marketKey,
          prediction: data.prediction,
          odds: data.odds,
          stake,
          confidence,
          analysis: analysis.trim(),
          matchSlug: data.matchSlug,
          sport: data.sport || 'football',
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSubmitted(true);
      } else {
        setError(json.error || 'Failed to post tip. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const Icon = data ? (MARKET_ICONS[data.marketKey] || Star) : Star;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-warning" />
            {data ? `Tip: ${data.prediction}` : 'Post a tip'}
          </DialogTitle>
          {data && (
            <DialogDescription className="text-xs">
              {data.marketName} · {data.leagueName}
            </DialogDescription>
          )}
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="space-y-3">
            <div className="rounded-lg border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center">
              <Star className="mx-auto h-8 w-8 fill-amber-400/30 text-amber-400 mb-2" />
              <p className="font-bold text-sm">Sign in to share your tip</p>
              <p className="text-xs text-muted-foreground mt-1">
                Build your reputation as a tipster on this market.
              </p>
              <div className="mt-3 flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={() => { handleClose(); onOpenAuth('login'); }}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => { handleClose(); onOpenAuth('register'); }}>
                  Create account
                </Button>
              </div>
            </div>
          </div>
        ) : !isTipster ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center space-y-2">
            <Star className="mx-auto h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-semibold">Tipsters only</p>
            <p className="text-xs text-muted-foreground">
              You need to be an approved tipster to post tips on outright markets.
            </p>
            <Button size="sm" variant="outline" asChild>
              <a href="/become-tipster">Apply to become a tipster</a>
            </Button>
          </div>
        ) : submitted ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
            <Star className="mx-auto h-6 w-6 fill-amber-400 text-amber-400" />
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Tip posted!</p>
            <p className="text-xs text-muted-foreground">
              Your tip on <strong>{data?.prediction}</strong> @ {data?.odds.toFixed(2)} has been shared.
            </p>
            <Button size="sm" onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {data && (
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                <span className="font-semibold">{data.prediction}</span>
                <span className="font-mono font-bold text-success text-base">{data.odds.toFixed(2)}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your analysis <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={3}
                placeholder="Share your reasoning (min 20 chars)…"
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
                className="resize-none text-sm"
              />
              <p className={cn(
                'text-[10px] text-right',
                analysis.length < 20 ? 'text-muted-foreground' : 'text-emerald-500'
              )}>
                {analysis.length} / 20 min
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stake</label>
                <span className="text-xs font-medium">{STAKE_LABELS[stake]}</span>
              </div>
              <Slider
                min={1} max={5} step={1}
                value={[stake]}
                onValueChange={([v]) => setStake(v)}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confidence</label>
                <span className={cn(
                  'text-xs font-bold',
                  confidence >= 80 ? 'text-success' : confidence >= 60 ? 'text-warning' : 'text-muted-foreground'
                )}>{confidence}%</span>
              </div>
              <Slider
                min={30} max={100} step={5}
                value={[confidence]}
                onValueChange={([v]) => setConfidence(v)}
                className="w-full"
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            <Button
              className="w-full gap-2"
              onClick={handleSubmit}
              disabled={submitting || analysis.trim().length < 20}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              Post tip
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
