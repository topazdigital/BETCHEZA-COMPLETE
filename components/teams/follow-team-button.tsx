'use client';

import { useEffect, useState } from 'react';
import { Star, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { ensurePushSubscribed, isPushSupported } from '@/lib/push-client';

interface FollowTeamButtonProps {
  teamId: string;
  teamName: string;
  teamLogo?: string | null;
  leagueId?: number | null;
  leagueSlug?: string | null;
  leagueName?: string | null;
  sportSlug?: string | null;
  countryCode?: string | null;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
  /** Optional callback fired AFTER a successful follow/unfollow round-trip.
   *  The team page passes a SWR `mutate` here so the followers counter on
   *  screen refreshes immediately without a hard reload. */
  onChange?: (followingNow: boolean) => void;
}

export function FollowTeamButton({
  teamId,
  teamName,
  teamLogo,
  leagueId,
  leagueSlug,
  leagueName,
  sportSlug,
  countryCode,
  size = 'md',
  variant = 'default',
  className,
  onChange,
}: FollowTeamButtonProps) {
  const { open: openAuthModal } = useAuthModal();
  const { isAuthenticated } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setFollowing(false);
      return;
    }
    let alive = true;
    fetch(`/api/teams/${encodeURIComponent(teamId)}/follow`)
      .then(r => r.json())
      .then(d => { if (alive) setFollowing(!!d.following); })
      .catch(() => { if (alive) setFollowing(false); });
    return () => { alive = false; };
  }, [teamId, isAuthenticated]);

  async function toggle() {
    if (busy) return;
    if (!isAuthenticated) {
      // Open the auth modal in place so the user stays on the same page
      // (team / match / leaderboard / etc). Previously we used router.push to
      // a /login route which dropped them on Compare Players via referrer
      // resolution.
      openAuthModal('login');
      return;
    }
    setBusy(true);
    try {
      if (following) {
        const r = await fetch(`/api/teams/${encodeURIComponent(teamId)}/follow`, { method: 'DELETE' });
        if (r.ok) {
          setFollowing(false);
          onChange?.(false);
        }
      } else {
        const r = await fetch(`/api/teams/${encodeURIComponent(teamId)}/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamName, teamLogo, leagueId, leagueSlug, leagueName, sportSlug, countryCode }),
        });
        if (r.ok) {
          setFollowing(true);
          setShowHint(true);
          setTimeout(() => setShowHint(false), 4000);
          onChange?.(true);
          if (isPushSupported()) {
            ensurePushSubscribed({ topics: ['match_reminders', 'team_news'], countryCode: countryCode || null }).catch(() => {});
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-sm',
  }[size];

  if (variant === 'icon') {
    return (
      <button
        onClick={toggle}
        disabled={busy || following === null}
        title={following ? 'Unfollow team' : 'Follow team'}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all shrink-0',
          following
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
            : 'border-border bg-card text-muted-foreground hover:bg-muted',
          className
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Star className={cn('h-4 w-4', following && 'fill-current')} />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggle}
        disabled={busy || following === null}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all',
          following
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
            : 'border-border bg-card hover:bg-muted',
          className
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : following ? <Check className="h-3 w-3" /> : <Star className="h-3 w-3" />}
        {following ? 'Following' : 'Follow'}
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={toggle}
        disabled={busy || following === null}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg font-semibold border transition-all',
          sizeClasses,
          following
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
            : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          className
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : following ? (
          <Star className="h-4 w-4 fill-current" />
        ) : (
          <Star className="h-4 w-4" />
        )}
        {following ? 'Following' : 'Follow Team'}
      </button>
      {showHint && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
          <p className="font-semibold text-foreground">Added to your dashboard!</p>
          <p className="mt-1 text-muted-foreground">View fixtures, results & AI tips for {teamName} in your personalised dashboard.</p>
          <a href="/dashboard" className="mt-2 inline-block font-semibold text-primary hover:underline">Go to dashboard →</a>
        </div>
      )}
    </div>
  );
}
