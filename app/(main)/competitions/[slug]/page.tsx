import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import {
  Trophy, Timer, ArrowLeft, ListChecks,
  Target, ArrowUp, Medal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { JoinCompetitionButton } from '@/components/competitions/join-competition-button';
import { CompetitionLiveStandings } from '@/components/competitions/competition-live-standings';
import { getCompetitionBySlugAsync, getJoinedUserIds } from '@/lib/competitions-store';
import { computeLeaderboard } from '@/lib/competition-league-utils';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface PageParams { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const comp = await getCompetitionBySlugAsync(slug);
  const siteName = 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

  if (!comp) {
    return {
      title: `Competition Not Found`,
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
  const title = `${comp.name} | Win ${prizeFormatted}`;

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
  const comp = await getCompetitionBySlugAsync(slug);
  if (!comp) notFound();

  const started = new Date(comp.startDate) <= new Date();

  const joinedUserIds = await getJoinedUserIds(comp.id);

  const minTipsRule = (comp.ruleConfig ?? []).find((r: { type: string }) => r.type === 'min_tips');
  const minTipsRequired = minTipsRule ? Number((minTipsRule as { value?: number }).value ?? 1) : 1;

  // Show a leaderboard preview even for upcoming competitions when they are
  // scoped to a league or specific kickoff window — fake tipsters already have
  // picks for those matches, so there is real data to display.
  const isLeagueScopedComp = !!(comp.leagueId || comp.leagueName || comp.matchKickoffFrom);
  const shouldComputeLeaderboard = started || isLeagueScopedComp;

  const [currentUser, leaderboard] = await Promise.all([
    getCurrentUser(),
    shouldComputeLeaderboard
      ? computeLeaderboard({
          startDate: comp.startDate,
          endDate: comp.endDate,
          leagueId: comp.leagueId,
          leagueName: comp.leagueName,
          sportFocus: comp.sportFocus,
          matchKickoffFrom: comp.matchKickoffFrom,
          matchKickoffTo: comp.matchKickoffTo,
          minTips: 1,
          limit: 500,
          // For upcoming comps: don't restrict to joined users — show anyone
          // with qualifying tips so visitors can see activity before joining.
          allowedUserIds: started ? joinedUserIds : null,
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
    prizeEligible: r.totalTips >= minTipsRequired,
  }));

  const isLeagueScoped = !!(comp.leagueId || comp.leagueName || comp.matchKickoffFrom);
  const participants = ranked.length > 0
    ? ranked
    : comp.participants.map(p => ({
        ...p,
        lost: Math.max(0, p.tips - p.won),
        pending: 0,
        isFake: p.tipsterId >= 1000,
      }));

  const totalParticipants = Math.max(participants.length, joinedUserIds.length);
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

        {/* ── Winner Podium (completed competitions) ── */}
        {comp.status === 'completed' && participants.length > 0 && (() => {
          const top3 = participants.slice(0, 3)
          const medalColors = [
            { ring: 'ring-yellow-500/60', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-yellow-500 text-yellow-950', emoji: '🥇', label: '1st Place' },
            { ring: 'ring-gray-400/50',   bg: 'bg-gray-400/10',   text: 'text-gray-500 dark:text-gray-300',     badge: 'bg-gray-300 text-gray-700',     emoji: '🥈', label: '2nd Place' },
            { ring: 'ring-amber-700/50',  bg: 'bg-amber-700/10',  text: 'text-amber-700 dark:text-amber-500',   badge: 'bg-amber-700 text-amber-100',   emoji: '🥉', label: '3rd Place' },
          ]
          // Podium order: 2nd | 1st | 3rd
          const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean)
          const podiumHeights = top3[1] ? ['h-20', 'h-28', 'h-16'] : ['h-28', 'h-20', 'h-16']

          return (
            <div className="mb-3 rounded-xl border-2 border-yellow-500/30 bg-gradient-to-b from-yellow-500/8 via-amber-500/5 to-transparent overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-center gap-2 pt-3 pb-1">
                <span className="text-lg">🏆</span>
                <div className="text-center">
                  <div className="text-sm font-black text-yellow-600 dark:text-yellow-400 leading-none">Competition Ended!</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Final results — congratulations to our winners</div>
                </div>
                <span className="text-lg">🏆</span>
              </div>

              {/* Sparkle row */}
              <div className="flex justify-center gap-1 text-[10px] py-1 opacity-60 select-none pointer-events-none">
                {'✨🌟⭐✨🌟⭐✨'.split('').map((c, i) => (
                  <span key={i} style={{ animationDelay: `${i * 0.15}s` }} className="animate-pulse">{c}</span>
                ))}
              </div>

              {/* Podium */}
              <div className="flex items-end justify-center gap-2 px-4 pt-2 pb-0">
                {podiumOrder.map((p, podiumPos) => {
                  if (!p) return null
                  const origRank = top3.indexOf(p)
                  const colors = medalColors[origRank]
                  const height = podiumHeights[podiumPos]
                  const prizeAmt = comp.prizes[origRank]?.amount

                  return (
                    <div key={p.tipsterId} className="flex flex-col items-center gap-1 flex-1 max-w-[120px]">
                      {/* Avatar */}
                      <div className={cn('relative ring-2 rounded-full shrink-0', colors.ring, origRank === 0 && 'ring-offset-2 ring-offset-background')}>
                        {p.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar} alt="" className={cn('rounded-full object-cover', origRank === 0 ? 'h-14 w-14' : 'h-11 w-11')} />
                        ) : (
                          <div className={cn('flex items-center justify-center rounded-full font-black text-primary-foreground', origRank === 0 ? 'h-14 w-14 text-lg bg-primary' : 'h-11 w-11 text-sm bg-primary/80')}>
                            {(p.displayName || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={cn('absolute -top-2 left-1/2 -translate-x-1/2 text-base leading-none', origRank === 0 && 'text-xl')}>
                          {colors.emoji}
                        </span>
                      </div>

                      {/* Name */}
                      <div className="text-center min-w-0 w-full px-1">
                        <div className={cn('text-[11px] font-bold leading-tight truncate', colors.text)}>
                          {p.displayName}
                        </div>
                        <div className="text-[9px] text-muted-foreground truncate">@{p.username}</div>
                        <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                          {p.points} pts · {p.winRate}%
                        </div>
                        {prizeAmt && (
                          <div className={cn('mt-1 text-[10px] font-black leading-none', colors.text)}>
                            {comp.currency} {prizeAmt.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Podium block */}
                      <div className={cn(
                        'w-full rounded-t-lg flex items-center justify-center font-black text-sm',
                        height,
                        colors.badge,
                      )}>
                        {origRank + 1}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Prizes — top 3 podium (only shown once games have kicked off and results are coming in) */}
        {comp.prizes.length > 0 && comp.status !== 'completed' && started && participants.some(p => (p.won ?? 0) > 0 || (p.lost ?? 0) > 0) && (
          <div className="mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5 px-0.5">
              <Trophy className="h-3 w-3 text-warning" /> Prize Breakdown
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {comp.prizes[1] && (
                <div className="rounded-xl border border-gray-400/30 bg-gray-400/8 p-3 text-center flex flex-col items-center gap-0.5">
                  <span className="text-xl leading-none">🥈</span>
                  <div className="text-[10px] font-semibold text-gray-500 mt-1">2nd Place</div>
                  <div className="text-base font-black text-gray-600 dark:text-gray-300 leading-tight">{comp.currency} {comp.prizes[1].amount.toLocaleString()}</div>
                </div>
              )}
              {comp.prizes[0] && (
                <div className="rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 p-3 text-center flex flex-col items-center gap-0.5 shadow-sm order-first sm:order-none">
                  <span className="text-2xl leading-none">🥇</span>
                  <div className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 mt-1">1st Place</div>
                  <div className="text-lg font-black text-yellow-600 dark:text-yellow-400 leading-tight">{comp.currency} {comp.prizes[0].amount.toLocaleString()}</div>
                </div>
              )}
              {comp.prizes[2] && (
                <div className="rounded-xl border border-amber-700/30 bg-amber-700/8 p-3 text-center flex flex-col items-center gap-0.5">
                  <span className="text-xl leading-none">🥉</span>
                  <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-500 mt-1">3rd Place</div>
                  <div className="text-base font-black text-amber-700 dark:text-amber-500 leading-tight">{comp.currency} {comp.prizes[2].amount.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

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

        {/* Live Standings — client component with auto-refresh */}
        <CompetitionLiveStandings
          slug={slug}
          initialParticipants={participants}
          currentUserId={currentUser?.userId ?? null}
          isActive={comp.status === 'active'}
          isCompleted={comp.status === 'completed'}
          isUpcoming={comp.status === 'upcoming'}
          leagueName={comp.leagueName}
          sportFocus={comp.sportFocus}
          matchKickoffFrom={comp.matchKickoffFrom ?? null}
          matchKickoffTo={comp.matchKickoffTo ?? null}
          prizes={comp.prizes}
          currency={comp.currency}
          minimumTips={minTipsRequired}
        />
      </div>
    </div>
  );
}
