'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brain, Trophy, ChevronRight, ExternalLink, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import type { Jackpot } from '@/lib/jackpot-types';
import { cn } from '@/lib/utils';

interface BookmakerSummary {
  slug: string;
  name: string;
  color: string;
  accentColor: string;
  website: string;
  jackpotTypes: string[];
  jackpots: Jackpot[];
  totalPrize: number;
  currency: string;
  hasPredictions: boolean;
}

function formatKES(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function CountdownBadge({ deadline }: { deadline: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    function calc() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setLabel('Closed'); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      if (days > 0) setLabel(`${days}d ${hours}h left`);
      else {
        const m = Math.floor((diff % 3600000) / 60000);
        setLabel(`${hours}h ${m}m left`);
      }
    }
    calc();
    const t = setInterval(calc, 30000);
    return () => clearInterval(t);
  }, [deadline]);
  const isUrgent = new Date(deadline).getTime() - Date.now() < 12 * 3600000;
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
      isUrgent ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-muted text-muted-foreground'
    )}>{label}</span>
  );
}

export default function BookmakerCards() {
  const [summaries, setSummaries] = useState<BookmakerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const summariesRef = useRef<BookmakerSummary[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/jackpot?active=true');
      const data = await res.json() as { jackpots: Jackpot[] };
      const jackpots: Jackpot[] = data.jackpots || [];

      const map = new Map<string, BookmakerSummary>();
      for (const bk of SUPPORTED_BOOKMAKERS) {
        map.set(bk.slug, { ...bk, jackpots: [], totalPrize: 0, currency: 'KES', hasPredictions: false });
      }
      for (const j of jackpots) {
        const entry = map.get(j.bookmakerSlug);
        if (!entry) continue;
        entry.jackpots.push(j);
        entry.totalPrize += parseInt(j.jackpotAmount) || 0;
        entry.currency = j.currency;
        if (j.games.some(g => g.aiPrediction)) entry.hasPredictions = true;
      }
      const result = Array.from(map.values()).filter(s => s.jackpots.length > 0 || SUPPORTED_BOOKMAKERS.some(b => b.slug === s.slug));
      summariesRef.current = result;
      setSummaries(result);
    } catch {}
    setLoading(false);
  }

  async function scrapeAndPredict() {
    setScraping(true);
    try {
      await fetch('/api/jackpot/scrape', { headers: { authorization: 'Bearer betcheza-cron' } });
      await fetch('/api/jackpot/predict', { headers: { authorization: 'Bearer betcheza-cron' } });
      await load();
    } catch {}
    setScraping(false);
  }

  useEffect(() => {
    load().then(() => {
      // Auto-predict if any jackpots have no AI predictions yet
      const jackpots = summariesRef.current;
      const needsPredict = jackpots.some(s => s.jackpots.some(j => j.games.length > 0 && !j.games.some(g => g.aiPrediction)));
      if (needsPredict) {
        fetch('/api/jackpot/predict', { headers: { authorization: 'Bearer betcheza-cron' } })
          .then(() => load())
          .catch(() => {});
      }
    });
  }, []);

  // Show all bookmakers even without jackpots yet
  const allBookmakers = SUPPORTED_BOOKMAKERS;

  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Bookmakers', value: allBookmakers.length, icon: Trophy, color: 'text-amber-500' },
          { label: 'Active Jackpots', value: summaries.reduce((s, b) => s + b.jackpots.length, 0), icon: Sparkles, color: 'text-primary' },
          { label: 'AI Predictions', value: summaries.filter(b => b.hasPredictions).length, icon: Brain, color: 'text-purple-500' },
          { label: 'Max Prize', value: summaries.length > 0 ? `KES ${formatKES(Math.max(...summaries.map(b => b.totalPrize), 100_000_000))}` : 'KES 100M', icon: Trophy, color: 'text-green-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3 flex items-center gap-2">
              <Icon className={cn('h-5 w-5 shrink-0', color)} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-sm">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allBookmakers.map(bk => (
            <div key={bk.slug} className="rounded-xl border border-border/50 h-40 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allBookmakers.map(bk => {
            const summary = summaries.find(s => s.slug === bk.slug);
            const jackpots = summary?.jackpots || [];
            const totalPrize = summary?.totalPrize || 0;
            const hasPreds = summary?.hasPredictions || false;
            const nextDeadline = jackpots.length > 0 ? jackpots.reduce((m, j) => j.deadline < m ? j.deadline : m, jackpots[0].deadline) : null;

            return (
              <Card key={bk.slug} className="group overflow-hidden border-border/60 hover:border-border hover:shadow-md transition-all">
                <CardContent className="p-0">
                  <div className="h-1.5" style={{ background: bk.color }} />
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                          style={{ background: bk.color }}
                        >
                          {bk.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="font-bold text-sm leading-tight">{bk.name}</h2>
                          <p className="text-[10px] text-muted-foreground">{bk.jackpotTypes.join(' · ')}</p>
                        </div>
                      </div>
                      {hasPreds && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                          <Brain className="h-2.5 w-2.5 mr-0.5" /> AI Ready
                        </Badge>
                      )}
                    </div>

                    {jackpots.length > 0 ? (
                      <>
                        <div>
                          <p className="text-2xl font-extrabold" style={{ color: bk.color }}>
                            KES {formatKES(totalPrize)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {jackpots.length} active jackpot{jackpots.length > 1 ? 's' : ''} · {jackpots.reduce((s, j) => s + j.games.length, 0)} games
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {nextDeadline && <CountdownBadge deadline={nextDeadline} />}
                          {jackpots.slice(0, 2).map(j => (
                            <span key={j.id} className="text-[10px] text-muted-foreground border rounded-full px-2 py-0.5 bg-muted/40">
                              {j.title.replace(bk.name, '').trim()}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-2">
                        <p className="text-xs text-muted-foreground">Check back when the next round is published</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">We scrape automatically every hour</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Link href={`/jackpots/${bk.slug}`} className="flex-1">
                        <Button
                          size="sm"
                          className="w-full h-8 text-xs gap-1"
                          style={jackpots.length > 0 ? { background: bk.color, color: '#fff' } : undefined}
                          variant={jackpots.length > 0 ? 'default' : 'outline'}
                        >
                          {jackpots.length > 0 ? 'View Predictions' : 'View Page'}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <a href={bk.website} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={scrapeAndPredict}
          disabled={scraping}
          className="text-xs gap-2"
        >
          {scraping ? (
            <><Sparkles className="h-3.5 w-3.5 animate-spin" /> Updating jackpots…</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5" /> Refresh & Re-predict All</>
          )}
        </Button>
      </div>
    </div>
  );
}
