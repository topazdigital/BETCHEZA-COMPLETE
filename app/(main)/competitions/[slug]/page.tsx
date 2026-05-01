import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Trophy, Timer, Users, Gift, Star, Flame, ArrowLeft, ChevronRight, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SidebarNew } from '@/components/layout/sidebar-new';
import { FlagIcon } from '@/components/ui/flag-icon';
import { JoinCompetitionButton } from '@/components/competitions/join-competition-button';
import { getCompetitionBySlug } from '@/lib/competitions-store';
import { tipsterHref } from '@/lib/utils/slug';
import { cn } from '@/lib/utils';

interface PageParams { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) return { title: 'Competition not found · Betcheza' };
  const desc = `${comp.description} Prize pool ${comp.currency} ${comp.prizePool.toLocaleString()}, ${comp.participants.length} tipsters competing.`;
  return {
    title: `${comp.name} · Betcheza`,
    description: desc,
    openGraph: { title: comp.name, description: desc, type: 'article' },
  };
}

function formatTimeLeft(end: string): string {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return 'Ending soon';
}

export default async function CompetitionDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound();

  const fillPct = Math.min(100, Math.round((comp.participants.length / comp.maxParticipants) * 100));

  return (
    <div className="flex">
      <SidebarNew />
      <div className="flex-1 overflow-hidden">
        <div className="px-3 py-2.5">
          <Button variant="ghost" size="sm" className="mb-2 h-7 text-xs" asChild>
            <Link href="/competitions"><ArrowLeft className="mr-1 h-3.5 w-3.5" />All competitions</Link>
          </Button>

          {/* Hero */}
          <div className={cn(
            'rounded-xl border bg-card p-3 mb-3',
            comp.status === 'active' && 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent',
          )}>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {comp.status === 'active' && (
                <Badge variant="destructive" className="bg-live h-5 text-[10px]">
                  <Timer className="mr-1 h-2.5 w-2.5" />{formatTimeLeft(comp.endDate)}
                </Badge>
              )}
              {comp.status === 'upcoming' && (
                <Badge className="h-5 text-[10px] bg-blue-500/15 text-blue-500 border-blue-500/30">Upcoming</Badge>
              )}
              <Badge variant="outline" className="h-5 text-[10px] capitalize">{comp.type}</Badge>
              <Badge variant="outline" className="h-5 text-[10px] capitalize">{comp.sportFocus}</Badge>
              {comp.entryFee === 0 && (
                <Badge className="h-5 text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Free entry</Badge>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold leading-tight flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-warning" />
                  {comp.name}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">{comp.description}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-warning leading-none">
                  {comp.currency} {comp.prizePool.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prize pool</div>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{comp.participants.length} / {comp.maxParticipants} tipsters</span>
                <span className="font-medium">{fillPct}% full</span>
              </div>
              <Progress value={fillPct} className="h-1.5" />
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
              <div className="text-[11px] text-muted-foreground">
                Entry: <span className="font-semibold text-foreground">
                  {comp.entryFee === 0 ? 'Free' : `${comp.currency} ${comp.entryFee}`}
                </span>
              </div>
              <JoinCompetitionButton
                slug={comp.slug}
                isFull={comp.participants.length >= comp.maxParticipants}
                isCompleted={comp.status === 'completed'}
                entryFee={comp.entryFee}
                currency={comp.currency}
                competitionName={comp.name}
              />
            </div>
          </div>

          {/* Prizes */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {comp.prizes.map((prize, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg p-2 text-center border border-border',
                  idx === 0 && 'bg-yellow-500/10 border-yellow-500/30',
                  idx === 1 && 'bg-gray-300/10 border-gray-300/30',
                  idx === 2 && 'bg-amber-700/10 border-amber-700/30',
                )}
              >
                <div className={cn(
                  'text-[10px] font-medium uppercase tracking-wide',
                  idx === 0 && 'text-yellow-600',
                  idx === 1 && 'text-gray-500',
                  idx === 2 && 'text-amber-700',
                  idx > 2 && 'text-muted-foreground',
                )}>
                  {prize.place}
                </div>
                <div className="text-sm font-bold leading-tight">{comp.currency} {prize.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Rules */}
          <div className="rounded-xl border border-border bg-card p-3 mb-3">
            <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-primary" /> Rules
            </h2>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {comp.rules.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 text-primary">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Leaderboard */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
              <h2 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-warning" /> Live Standings
              </h2>
              <div className="text-[10px] text-muted-foreground">{comp.participants.length} tipsters</div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-muted-foreground tracking-wider">#</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium uppercase text-muted-foreground tracking-wider">Tipster</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">Pts</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">Win%</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider hidden sm:table-cell">Tips</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">ROI</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider hidden md:table-cell">Streak</th>
                </tr>
              </thead>
              <tbody>
                {comp.participants.slice(0, 30).map(p => (
                  <tr key={p.tipsterId} className={cn(
                    'border-b border-border hover:bg-muted/30',
                    p.rank === 1 && 'bg-yellow-500/5',
                    p.rank === 2 && 'bg-gray-300/5',
                    p.rank === 3 && 'bg-amber-700/5',
                  )}>
                    <td className="px-3 py-1.5">
                      <div className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                        p.rank === 1 && 'bg-yellow-500 text-yellow-950',
                        p.rank === 2 && 'bg-gray-300 text-gray-700',
                        p.rank === 3 && 'bg-amber-700 text-amber-100',
                        p.rank > 3 && 'bg-muted text-muted-foreground',
                      )}>{p.rank}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <Link href={tipsterHref(p.username, p.username)} className="flex items-center gap-2 hover:text-primary">
                        {p.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar} alt="" className="h-7 w-7 rounded-full object-cover bg-muted shrink-0" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
                            {(p.displayName || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate flex items-center gap-1">
                            {p.displayName}
                            {p.isVerified && <Star className="h-2.5 w-2.5 fill-primary text-primary shrink-0" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                            @{p.username}
                            {p.countryCode && <FlagIcon countryCode={p.countryCode} size="sm" />}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs font-bold">{p.points}</td>
                    <td className="px-2 py-1.5 text-center text-xs font-semibold text-success">{p.winRate}%</td>
                    <td className="px-2 py-1.5 text-center text-xs hidden sm:table-cell">{p.won}/{p.tips}</td>
                    <td className="px-2 py-1.5 text-center text-xs font-semibold text-primary">+{p.roi}%</td>
                    <td className="px-2 py-1.5 text-center hidden md:table-cell">
                      {p.streak > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          <Flame className="h-2.5 w-2.5" />{p.streak}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {comp.participants.length > 30 && (
              <div className="border-t border-border bg-muted/10 px-3 py-2 text-center text-[10px] text-muted-foreground">
                Showing top 30 of {comp.participants.length} tipsters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
