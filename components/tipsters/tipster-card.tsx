'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Users, Target, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FollowTipsterButton } from '@/components/tipsters/follow-tipster-button';
import type { User, TipsterProfile } from '@/lib/types';

interface TipsterCardProps {
  user: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  profile: Pick<TipsterProfile, 'win_rate' | 'roi' | 'total_tips' | 'won_tips' | 'streak' | 'rank' | 'followers_count' | 'is_pro'> & {
    /** Optional — when true a small verified checkmark sits next to the name. */
    is_verified?: boolean;
  };
  compact?: boolean;
}

export function TipsterCard({ user, profile, compact = false }: TipsterCardProps) {
  const isPositiveStreak = profile.streak > 0;

  if (compact) {
    return (
      <Link href={`/tipsters/${user.username}`}>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-sm">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            {profile.is_pro && (
              <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[8px] font-bold text-warning-foreground">
                PRO
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate font-medium text-foreground">{user.display_name}</span>
              {profile.is_verified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified tipster" />
              )}
              <span className="text-xs text-muted-foreground">#{profile.rank}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-success">{profile.win_rate.toFixed(1)}% win</span>
              <span className={cn(profile.roi >= 0 ? 'text-success' : 'text-destructive')}>
                {profile.roi >= 0 ? '+' : ''}{profile.roi.toFixed(1)}% ROI
              </span>
            </div>
          </div>

          {/* Streak */}
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
            isPositiveStreak ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          )}>
            {isPositiveStreak ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(profile.streak)}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Link href={`/tipsters/${user.username}`}>
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            {profile.is_pro && (
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-[8px] font-bold text-warning-foreground">
                PRO
              </div>
            )}
          </div>
        </Link>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/tipsters/${user.username}`} className="hover:underline">
              <span className="font-semibold text-foreground">{user.display_name}</span>
            </Link>
            {profile.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary" title="Verified tipster">
                <BadgeCheck className="h-3 w-3" />
                Verified
              </span>
            )}
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              #{profile.rank}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">@{user.username}</p>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-lg font-bold text-success">{profile.win_rate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
            <div>
              <div className={cn(
                'text-lg font-bold',
                profile.roi >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {profile.roi >= 0 ? '+' : ''}{profile.roi.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">ROI</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-lg font-bold text-foreground">
                <Target className="h-4 w-4 text-muted-foreground" />
                {profile.total_tips}
              </div>
              <div className="text-xs text-muted-foreground">Tips</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-lg font-bold text-foreground">
                <Users className="h-4 w-4 text-muted-foreground" />
                {profile.followers_count}
              </div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/tipsters/${user.username}`}>View</Link>
          </Button>
          <FollowTipsterButton tipsterId={user.id} tipsterName={user.display_name} size="sm" />
        </div>
      </div>

      {/* Streak Bar */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-2">
        <span className="text-xs text-muted-foreground">Current Streak</span>
        <div className={cn(
          'flex items-center gap-1 font-semibold',
          isPositiveStreak ? 'text-success' : 'text-destructive'
        )}>
          {isPositiveStreak ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {Math.abs(profile.streak)} {isPositiveStreak ? 'wins' : 'losses'}
        </div>
      </div>
    </div>
  );
}
