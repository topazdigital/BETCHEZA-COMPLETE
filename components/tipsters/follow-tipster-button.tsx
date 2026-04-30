'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { ensurePushSubscribed, isPushSupported } from '@/lib/push-client';

interface Props {
  tipsterId: number;
  tipsterName?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'pill';
  className?: string;
  onFollowChange?: (following: boolean) => void;
}

export function FollowTipsterButton({
  tipsterId,
  tipsterName,
  size = 'md',
  variant = 'default',
  className,
  onFollowChange,
}: Props) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setFollowing(false);
      return;
    }
    let alive = true;
    fetch(`/api/tipsters/${tipsterId}/follow`)
      .then(r => r.json())
      .then(d => { if (alive) setFollowing(!!d.following); })
      .catch(() => { if (alive) setFollowing(false); });
    return () => { alive = false; };
  }, [tipsterId, isAuthenticated]);

  async function toggle(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (busy) return;
    if (!isAuthenticated) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setBusy(true);
    try {
      if (following) {
        const r = await fetch(`/api/tipsters/${tipsterId}/follow`, { method: 'DELETE' });
        if (r.ok) {
          setFollowing(false);
          onFollowChange?.(false);
        }
      } else {
        const r = await fetch(`/api/tipsters/${tipsterId}/follow`, { method: 'POST' });
        if (r.ok) {
          setFollowing(true);
          onFollowChange?.(true);
          setHint('Following!');
          setTimeout(() => setHint(null), 2500);
          if (isPushSupported()) {
            ensurePushSubscribed({ topics: ['tipster_picks', 'match_reminders'] }).catch(() => {});
          }
        } else if (r.status === 401) {
          router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const sizeCls = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-5 text-sm',
  }[size];

  if (variant === 'pill') {
    return (
      <button
        onClick={toggle}
        disabled={busy || following === null}
        title={tipsterName ? (following ? `Unfollow ${tipsterName}` : `Follow ${tipsterName}`) : undefined}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all',
          following
            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
            : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5',
          className,
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" />
          : following ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
        {following ? 'Following' : 'Follow'}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggle}
        disabled={busy || following === null}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all',
          following
            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
            : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          className,
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" />
          : following ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
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
          'inline-flex items-center gap-2 rounded-lg border font-semibold transition-all',
          sizeCls,
          following
            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
            : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          className,
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" />
          : following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {following ? 'Following' : 'Follow'}
      </button>
      {hint && (
        <div className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg">
          {hint}
        </div>
      )}
    </div>
  );
}
