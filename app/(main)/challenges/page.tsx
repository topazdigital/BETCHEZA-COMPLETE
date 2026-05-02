'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Swords, Trophy, Crown, Flame, Clock, Plus, Users, ChevronRight, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { tipsterHref } from '@/lib/utils/slug';

interface Participant {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  tips: number;
  won: number;
  streak: number;
}

interface Challenge {
  id: string;
  title: string;
  sport: string;
  startDate: string;
  endDate: string;
  status: 'live' | 'upcoming' | 'finished';
  stake?: string;
  participants: [Participant, Participant];
  winnerIndex?: 0 | 1;
  watchers: number;
  prizePool?: string;
  description: string;
}

const MOCK_CHALLENGES: Challenge[] = [
  {
    id: 'c1',
    title: 'Weekend Premier League Showdown',
    sport: 'Football ⚽',
    startDate: '2026-05-02',
    endDate: '2026-05-04',
    status: 'live',
    watchers: 312,
    prizePool: '500 pts',
    description: 'Best win-rate over the PL weekend fixtures. First to 5 correct tips wins.',
    participants: [
      { id: 1, username: 'sharptips', displayName: 'SharpTips', avatar: null, tips: 4, won: 3, streak: 3 },
      { id: 2, username: 'goalmaster', displayName: 'GoalMaster', avatar: null, tips: 4, won: 2, streak: 1 },
    ],
  },
  {
    id: 'c2',
    title: 'Champions League ROI Battle',
    sport: 'Football ⚽',
    startDate: '2026-05-06',
    endDate: '2026-05-08',
    status: 'upcoming',
    stake: '1000 pts',
    watchers: 89,
    description: 'Highest ROI across all CL quarter-final ties. Minimum 3 tips required.',
    participants: [
      { id: 3, username: 'ucl_oracle', displayName: 'UCL Oracle', avatar: null, tips: 0, won: 0, streak: 7 },
      { id: 4, username: 'betlab', displayName: 'BetLab', avatar: null, tips: 0, won: 0, streak: 4 },
    ],
  },
  {
    id: 'c3',
    title: 'NBA Playoffs Hot-Streak Race',
    sport: 'Basketball 🏀',
    startDate: '2026-04-22',
    endDate: '2026-04-30',
    status: 'finished',
    stake: '750 pts',
    watchers: 501,
    description: 'Longest consecutive winning streak during NBA first-round games.',
    participants: [
      { id: 5, username: 'nba_king', displayName: 'NBA King', avatar: null, tips: 12, won: 9, streak: 6 },
      { id: 6, username: 'courtside', displayName: 'Courtside', avatar: null, tips: 12, won: 7, streak: 4 },
    ],
    winnerIndex: 0,
  },
  {
    id: 'c4',
    title: 'La Liga Weekend Decider',
    sport: 'Football ⚽',
    startDate: '2026-05-09',
    endDate: '2026-05-11',
    status: 'upcoming',
    watchers: 44,
    description: 'Tips on all La Liga matchday 36 fixtures. Best accuracy wins.',
    participants: [
      { id: 7, username: 'laliga_pro', displayName: 'LaLiga Pro', avatar: null, tips: 0, won: 0, streak: 2 },
      { id: 8, username: 'tiki_tips', displayName: 'TikiTips', avatar: null, tips: 0, won: 0, streak: 5 },
    ],
  },
];

function AvatarCircle({ user, size = 'md' }: { user: Participant; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-14 w-14 text-xl' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs';
  return (
    <div className={cn('shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary', s)}>
      {(user.displayName || user.username).charAt(0).toUpperCase()}
    </div>
  );
}

function ChallengeCard({ c }: { c: Challenge }) {
  const [p1, p2] = c.participants;
  const statusColor = c.status === 'live' ? 'bg-red-500' : c.status === 'upcoming' ? 'bg-amber-500' : 'bg-muted-foreground';
  const p1Rate = p1.tips > 0 ? Math.round((p1.won / p1.tips) * 100) : 0;
  const p2Rate = p2.tips > 0 ? Math.round((p2.won / p2.tips) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium text-muted-foreground">{c.sport}</span>
            <div className="flex items-center gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', statusColor, c.status === 'live' && 'animate-pulse')} />
              <span className={cn('text-[10px] font-bold uppercase', c.status === 'live' ? 'text-red-600' : c.status === 'upcoming' ? 'text-amber-600' : 'text-muted-foreground')}>
                {c.status}
              </span>
            </div>
          </div>
          <h3 className="mt-0.5 text-sm font-bold leading-snug">{c.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{c.description}</p>
        </div>
        {c.prizePool && (
          <div className="shrink-0 text-right">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Prize</div>
            <div className="text-sm font-bold text-amber-600 flex items-center gap-1">
              <Crown className="h-3 w-3" />{c.prizePool}
            </div>
          </div>
        )}
      </div>

      {/* VS section */}
      <div className="mx-4 my-2 rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          {/* P1 */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <AvatarCircle user={p1} />
            <div className="text-center">
              <div className="text-xs font-bold">{p1.displayName}</div>
              {c.status !== 'upcoming' && (
                <div className="text-[10px] text-muted-foreground">{p1.won}/{p1.tips} · {p1Rate}%</div>
              )}
              {p1.streak > 2 && (
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600">
                  <Flame className="h-2.5 w-2.5" />{p1.streak}
                </div>
              )}
            </div>
            {c.winnerIndex === 0 && (
              <Badge className="text-[9px] bg-amber-500 text-white">Winner 🏆</Badge>
            )}
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center shrink-0">
            {c.status !== 'upcoming' ? (
              <div className="text-2xl font-black tabular-nums">{p1.won} – {p2.won}</div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground font-bold">
                <Swords className="h-5 w-5" />
              </div>
            )}
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {c.status === 'live' ? 'LIVE' : new Date(c.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>

          {/* P2 */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <AvatarCircle user={p2} />
            <div className="text-center">
              <div className="text-xs font-bold">{p2.displayName}</div>
              {c.status !== 'upcoming' && (
                <div className="text-[10px] text-muted-foreground">{p2.won}/{p2.tips} · {p2Rate}%</div>
              )}
              {p2.streak > 2 && (
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-amber-600">
                  <Flame className="h-2.5 w-2.5" />{p2.streak}
                </div>
              )}
            </div>
            {c.winnerIndex === 1 && (
              <Badge className="text-[9px] bg-amber-500 text-white">Winner 🏆</Badge>
            )}
          </div>
        </div>

        {/* Progress bar — only for live */}
        {c.status === 'live' && p1.tips > 0 && (
          <div className="mt-2 flex gap-0.5 rounded-full overflow-hidden h-1.5">
            <div className="bg-emerald-500" style={{ width: `${p1Rate}%` }} />
            <div className="flex-1 bg-blue-500" style={{ width: `${p2Rate}%` }} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pb-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.watchers} watching</span>
          {c.stake && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />Stake: {c.stake}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(c.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}

function CreateChallengeModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Create a Challenge</h2>
        <p className="text-xs text-muted-foreground mb-4">Challenge any tipster to a head-to-head prediction battle over a set fixture list.</p>
        {step === 1 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-semibold mb-1">How it works</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>Pick a sport and fixture window (e.g. this weekend)</li>
                <li>Challenge a specific tipster or open it publicly</li>
                <li>Set a tip limit and scoring method (win rate / ROI)</li>
                <li>Best performer at the end wins the points stake</li>
              </ul>
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>Get Started <ChevronRight className="ml-1 h-4 w-4" /></Button>
            <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-sm">Challenge Builder</p>
              <p className="text-xs text-muted-foreground mt-1">Full challenge creation — match selection, opponent invite, and live tracking — is coming in the next update.</p>
            </div>
            <div className="text-center">
              <button className="text-xs text-primary hover:underline" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChallengesPage() {
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [showCreate, setShowCreate] = useState(false);

  const live = MOCK_CHALLENGES.filter(c => c.status === 'live');
  const upcoming = MOCK_CHALLENGES.filter(c => c.status === 'upcoming');
  const finished = MOCK_CHALLENGES.filter(c => c.status === 'finished');

  function handleCreate() {
    if (!isAuthenticated) { openAuthModal('login'); return; }
    setShowCreate(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-3 py-5 md:px-5">
      {showCreate && <CreateChallengeModal onClose={() => setShowCreate(false)} />}

      {/* Hero */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" /> Tipster Challenges
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Head-to-head prediction battles between tipsters. Watch live challenges or create your own.
          </p>
        </div>
        <Button onClick={handleCreate} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Challenge
        </Button>
      </div>

      {/* Stats banner */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Live Now', value: live.length, icon: <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" /> },
          { label: 'Upcoming', value: upcoming.length, icon: <Clock className="h-3.5 w-3.5 text-amber-500" /> },
          { label: 'Completed', value: finished.length + 24, icon: <Trophy className="h-3.5 w-3.5 text-primary" /> },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
              {s.icon} {s.label}
            </div>
            <div className="text-xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="live" className="flex-1">
            Live <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 text-red-600 text-[10px] font-bold">{live.length}</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
          <TabsTrigger value="finished" className="flex-1">Finished</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-3">
          {live.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <Swords className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-semibold">No live challenges right now</p>
              <p className="mt-1 text-xs text-muted-foreground">Check back on match days or create one yourself.</p>
            </div>
          ) : live.map(c => <ChallengeCard key={c.id} c={c} />)}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-3">
          {upcoming.map(c => <ChallengeCard key={c.id} c={c} />)}
          <div className="rounded-xl border border-dashed border-border bg-card p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="text-xs text-muted-foreground">
              Want to run your own challenge? Hit <strong>Challenge</strong> above to set one up in minutes.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finished" className="space-y-3">
          {finished.map(c => <ChallengeCard key={c.id} c={c} />)}
        </TabsContent>
      </Tabs>

      {/* How scoring works */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold">How Challenges Work</h2>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
          {[
            { icon: '🎯', title: 'Pick a Battle', desc: 'Choose a sport, fixture window, and scoring method (win rate or ROI).' },
            { icon: '⚔️', title: 'Invite or Open', desc: 'Challenge a specific tipster or open it to all — first accepted opponent joins.' },
            { icon: '🏆', title: 'Compete & Win', desc: 'Post your tips live. The leaderboard updates in real-time. Top scorer wins the stake.' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-muted/40 p-3">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="font-semibold text-foreground text-[11px] mb-0.5">{s.title}</div>
              <div>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
