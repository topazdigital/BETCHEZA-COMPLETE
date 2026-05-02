'use client';

import { useEffect, useState } from 'react';
import { UserCheck, UserPlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';

interface Props {
  playerId: string;
  playerName: string;
  playerHeadshot?: string;
  teamId?: string;
  teamName?: string;
  teamLogo?: string;
  sportSlug?: string;
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
}

export function FollowPlayerButton({
  playerId, playerName, playerHeadshot, teamId, teamName, teamLogo, sportSlug,
  variant = 'default', className,
}: Props) {
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setFollowing(false); return; }
    let alive = true;
    fetch(`/api/players/${encodeURIComponent(playerId)}/follow`)
      .then(r => r.json())
      .then(d => { if (alive) setFollowing(!!d.following); })
      .catch(() => { if (alive) setFollowing(false); });
    return () => { alive = false; };
  }, [playerId, isAuthenticated]);

  async function toggle() {
    if (busy) return;
    if (!isAuthenticated) { openAuthModal('login'); return; }
    setBusy(true);
    try {
      if (following) {
        const r = await fetch(`/api/players/${encodeURIComponent(playerId)}/follow`, { method: 'DELETE' });
        if (r.ok) setFollowing(false);
      } else {
        const r = await fetch(`/api/players/${encodeURIComponent(playerId)}/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName, playerHeadshot, teamId, teamName, teamLogo, sportSlug }),
        });
        if (r.ok) { setFollowing(true); setHint(true); setTimeout(() => setHint(false), 4000); }
      }
    } finally { setBusy(false); }
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={toggle}
        disabled={busy || following === null}
        title={following ? 'Unfollow player' : 'Follow player'}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all shrink-0',
          following
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
            : 'border-border bg-card text-muted-foreground hover:bg-muted',
          className
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
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
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
            : 'border-border bg-card hover:bg-muted',
          className
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : following ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
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
          'inline-flex items-center gap-2 rounded-lg font-semibold border h-9 px-4 text-sm transition-all',
          following
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
            : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          className
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {following ? 'Following' : 'Follow Player'}
      </button>
      {hint && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
          <p className="font-semibold text-foreground">Now following {playerName}!</p>
          <p className="mt-1 text-muted-foreground">
            {teamName
              ? `You'll get match alerts for ${teamName} and transfer news.`
              : "You'll get transfer news and match alerts for this player."}
          </p>
        </div>
      )}
    </div>
  );
}
