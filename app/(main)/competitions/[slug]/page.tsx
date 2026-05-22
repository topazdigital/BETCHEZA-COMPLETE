import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Trophy, Timer, Star, Flame, ArrowLeft, ListChecks,
  Target, ArrowUp, Medal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FlagIcon } from '@/components/ui/flag-icon';
import { JoinCompetitionButton } from '@/components/competitions/join-competition-button';
import { getCompetitionBySlug, getJoinedUserIds } from '@/lib/competitions-store';
import { computeLeaderboard } from '@/lib/competition-league-utils';
import { getCurrentUser } from '@/lib/auth';
import { tipsterHref } from '@/lib/utils/slug';
import { cn } from '@/lib/utils';

interface PageParams { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  const siteName = 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

  if (!comp) {
    return {
      title: `Competition Not Found | ${siteName}`,
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${baseUrl}/competitions/${slug}`;
  const prizeFormatted = `${comp.currency} ${comp.prizePool.toLocaleString()}`;
  const entryFormatted = comp.entryFee > 0
    ? `${comp.currency} ${comp.entryFee.toLocaleString()} entry`
    : 'Free entry';
  const sport = comp.sportFocus === 'multi-sport' ? 'multi-sport' : comp.sportFocus;
  const statusLabel = comp.status === 'active'
    ? 'Open now'
    : comp.status === 'upcoming'
    ? 'Coming soon'
    : 'Completed';

  // Title: "Weekly Tipster Challenge | Win KES 50,000 | Betcheza"
  const title = `${comp.name} | Win ${prizeFormatted} | ${siteName}`;

  // Description optimised for click-through
  const topPrize = comp.prizes[0];
  const topPrizeStr = topPrize
    ? `1st place wins ${comp.currency} ${topPrize.amount.toLocaleString()}`
    : `Prize pool: ${prizeFormatted}`;
  const description = `${statusLabel} — ${comp.description || comp.name}. ${topPrizeStr}. ${entryFormatted}. ${comp.maxParticipants} spots available. Compete with tipsters on ${siteName} Kenya.`;

  const keywords: string[] = [
    comp.name,
    `${comp.name} Kenya`,
    `${sport} tipster competition`,
    `${sport} prediction contest Kenya`,
    'betting competition Kenya',
    'sports tipster contest',
    `win ${prizeFormatted}`,
    'betcheza competition',
    'online tipster league Kenya',
    comp.type === 'daily' ? 'daily prediction contest' : comp.type === 'weekly' ? 'weekly tipster challenge' : 'monthly betting league',
  ].filter(Boolean);

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonical,
      siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
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

  const started = new Date(comp.startDate) <= new Date();

  const joinedUserIds = getJoinedUserIds(comp.id);

  const [currentUser, leaderboard] = await Promise.all([
    getCurrentUser(),
    started
      ? computeLeaderboard({
          startDate: comp.startDate,
          endDate: comp.endDate,
          leagueId: comp.leagueId,
          leagueName: comp.leagueName,
          sportFocus: comp.sportFocus,
          minTips: 1,
          limit: 500,
          allowedUserIds: joinedUserIds,
        })
      : Promise.resolve([]),
  ]);

  const ranked = leaderboard.map((r, i) => ({
    rank: i + 1,
    tipsterId: r.userId,
    username: r.username,
    displayName: r.displayName || r.username,
    avatar: r.avatar,
    countryCode: null as string | null,
    winRate: r.winRate,
    roi: r.roi,
    tips: r.totalTips,
    won: r.won,
    lost: r.lost,
    pending: r.pending,
    points: r.points,
    streak: 0,
    isVerified: false,
    isFake: r.isFake,
  }));

  const participants = ranked.length > 0
    ? ranked
    : comp.participants.map(p => ({
        ...p,
        lost: Math.max(0, p.tips - p.won),
        pending: 0,
        isFake: p.tipsterId >= 1000,
      }));

  const totalParticipants = participants.length;
  const fillPct = Math.min(100, Math.round((totalParticipants / comp.maxParticipants) * 100));

  const myStanding = currentUser
    ? participants.find(p => p.tipsterId === currentUser.userId) ?? null
    : null;

  const personAbove = myStanding && myStanding.rank > 1
    ? participants.find(p => p.rank === myStanding.rank - 1) ?? null
    : null;
  const pointsGap = personAbove && myStanding ? Math.max(0, personAbove.points - myStanding.points) : 0;
  const winsNeeded = pointsGap > 0 ? Math.ceil(pointsGap / 10) : 0;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/competitions/${slug}`;
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': canonical,
    name: comp.name,
    description: comp.description || comp.name,
    url: canonical,
    startDate: comp.startDate,
    endDate: comp.endDate,
    eventStatus: comp.status === 'active'
      ? 'https://schema.org/EventScheduled'
      : comp.status === 'upcoming'
      ? 'https://schema.org/EventScheduled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: canonical,
    },
    organizer: {
      '@type': 'Organization',
      name: 'Betcheza',
      url: baseUrl,
    },
    offers: {
      '@type': 'Offer',
      price: comp.entryFee,
      priceCurrency: comp.currency,
      availability: comp.status === 'active'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
      url: canonical,
    },
    ...(comp.prizes[0] ? {
      prize: `${comp.currency} ${comp.prizePool.toLocaleString()} prize pool — 1st place: ${comp.currency} ${comp.prizes[0].amount.toLocaleString()}`,
    } : {}),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Betcheza', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Competitions', item: `${baseUrl}/competitions` },
      { '@type': 'ListItem', position: 3, name: comp.name, item: canonical },
    ],
  };

  return (
    <div className="flex-1 overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
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
            {comp.status === 'completed' && (
              <Badge className="h-5 text-[10px] bg-muted text-muted-foreground">Completed</Badge>
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
              <span>{totalParticipants.toLocaleString()} / {comp.maxParticipants.toLocaleString()} tipsters</span>
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
              isFull={totalParticipants >= comp.maxParticipants}
              isCompleted={comp.status === 'completed'}
              entryFee={comp.entryFee}
              currency={comp.currency}
              competitionName={comp.name}
            />
          </div>
        </div>

        {/* ── My Standing ── */}
        {currentUser && (
          <div className={cn(
            'rounded-xl border p-3 mb-3',
            myStanding
              ? 'border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5'
              : 'border-dashed border-border bg-muted/20',
          )}>
            <h2 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
              <Target className="h-3.5 w-3.5 text-primary" /> My Standing
            </h2>

            {myStanding ? (
              <div className="space-y-2">
                {/* Rank + stat grid */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full font-bold',
                    myStanding.rank === 1 && 'bg-yellow-500 text-yellow-950',
                    myStanding.rank === 2 && 'bg-gray-300 text-gray-700',
                    myStanding.rank === 3 && 'bg-amber-700 text-amber-100',
                    myStanding.rank > 3 && 'bg-primary/15 text-primary',
                  )}>
                    <span className="text-[9px] leading-none opacity-60">RANK</span>
                    <span className="text-lg leading-none">{myStanding.rank}</span>
                  </div>
                  <div className="grid flex-1 grid-cols-4 gap-1.5">
                    <div className="rounded-lg bg-background border border-border p-1.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Pts</div>
                      <div className="text-sm font-bold">{myStanding.points}</div>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-1.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Win%</div>
                      <div className="text-sm font-bold text-success">{myStanding.winRate}%</div>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-1.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">ROI</div>
                      <div className={cn('text-sm font-bold', myStanding.roi >= 0 ? 'text-success' : 'text-destructive')}>
                        {myStanding.roi >= 0 ? '+' : ''}{myStanding.roi}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-1.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">W / L</div>
                      <div className="text-sm font-bold">
                        <span className="text-success">{myStanding.won}</span>
                        <span className="text-muted-foreground mx-0.5">/</span>
                        <span className="text-destructive">{myStanding.lost}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Points breakdown */}
                <div className="rounded-lg bg-background/50 border border-border px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{myStanding.won}W × 10</span>
                  {' + odds bonus − '}
                  <span className="font-semibold text-foreground">{myStanding.lost}L × 5</span>
                  {' = '}
                  <span className="font-bold text-primary">{myStanding.points} pts</span>
                  {myStanding.pending > 0 && (
                    <span className="ml-2 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">
                      {myStanding.pending} pending
                    </span>
                  )}
                </div>

                {/* Climb indicator */}
                {myStanding.rank === 1 ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                    <span className="text-[11px] font-medium text-yellow-600 dark:text-yellow-400">
                      You are leading! Keep posting winning tips to protect your top spot.
                    </span>
                  </div>
                ) : pointsGap > 0 ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                    <ArrowUp className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-[11px] text-muted-foreground">
                      You need{' '}
                      <span className="font-bold text-foreground">{pointsGap} more points</span>
                      {' '}to reach rank{' '}
                      <span className="font-bold text-foreground">#{myStanding.rank - 1}</span>
                      {winsNeeded > 0 && (
                        <> — roughly <span className="font-bold text-foreground">{winsNeeded} more wins</span> at average odds.</>
                      )}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-center py-2.5">
                <Medal className="mx-auto h-7 w-7 text-muted-foreground mb-2" />
                <p className="text-xs font-medium text-foreground">You are not on the board yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Post qualifying tips in{' '}
                  <span className="font-semibold">{comp.leagueName ?? comp.sportFocus}</span>
                  {' '}to earn points and appear here.
                </p>
              </div>
            )}
          </div>
        )}

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
            <div className="text-[10px] text-muted-foreground">{totalParticipants.toLocaleString()} tipsters</div>
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
              {participants.slice(0, 50).map(p => (
                <tr key={p.tipsterId} className={cn(
                  'border-b border-border hover:bg-muted/30 transition-colors',
                  p.rank === 1 && 'bg-yellow-500/5',
                  p.rank === 2 && 'bg-gray-300/5',
                  p.rank === 3 && 'bg-amber-700/5',
                  currentUser && p.tipsterId === currentUser.userId && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
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
                          {currentUser && p.tipsterId === currentUser.userId && (
                            <Badge variant="outline" className="h-3.5 text-[8px] px-1 border-primary text-primary leading-none">You</Badge>
                          )}
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
                  <td className="px-2 py-1.5 text-center text-xs font-semibold text-primary">
                    {p.roi >= 0 ? '+' : ''}{p.roi}%
                  </td>
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
          {participants.length > 50 && (
            <div className="border-t border-border bg-muted/10 px-3 py-2 text-center text-[10px] text-muted-foreground">
              Showing top 50 of {participants.length.toLocaleString()} tipsters
            </div>
          )}
          {participants.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No tips posted yet — be the first to compete!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
