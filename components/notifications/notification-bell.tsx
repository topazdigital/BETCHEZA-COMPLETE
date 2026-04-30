'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Check, ExternalLink, Loader2, MessageSquare, Heart, UserPlus, Trophy, Newspaper, AlertCircle, Megaphone, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { cn } from '@/lib/utils';

interface NotifRow {
  id: number;
  type: string;
  title: string;
  content: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  post_like: Heart,
  post_comment: MessageSquare,
  comment_reply: MessageSquare,
  follow_new: UserPlus,
  tipster_post: Megaphone,
  tipster_new_tip: Trophy,
  tipster_tip_won: Trophy,
  team_match_starting: Zap,
  team_result: Trophy,
  team_news: Newspaper,
  match_lineup: Zap,
  odds_drop: AlertCircle,
  admin_broadcast: Megaphone,
  system: Bell,
};

const COLORS: Record<string, string> = {
  post_like: 'text-pink-500 bg-pink-500/10',
  post_comment: 'text-blue-500 bg-blue-500/10',
  comment_reply: 'text-blue-500 bg-blue-500/10',
  follow_new: 'text-violet-500 bg-violet-500/10',
  tipster_post: 'text-amber-500 bg-amber-500/10',
  tipster_new_tip: 'text-amber-500 bg-amber-500/10',
  tipster_tip_won: 'text-emerald-500 bg-emerald-500/10',
  team_match_starting: 'text-orange-500 bg-orange-500/10',
  team_result: 'text-emerald-500 bg-emerald-500/10',
  team_news: 'text-sky-500 bg-sky-500/10',
  match_lineup: 'text-cyan-500 bg-cyan-500/10',
  odds_drop: 'text-red-500 bg-red-500/10',
  admin_broadcast: 'text-purple-500 bg-purple-500/10',
  system: 'text-muted-foreground bg-muted',
};

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 604_800_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) { setItems([]); setUnread(0); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications || []);
        setUnread(data.unreadCount || 0);
      }
    } catch {} finally { setLoading(false); }
  }, [isAuthenticated]);

  // Poll for unread count every 45s while authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    void load();
    const t = setInterval(() => { void load(); }, 45_000);
    return () => clearInterval(t);
  }, [isAuthenticated, load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markAllRead() {
    if (unread === 0) return;
    const prev = items;
    setItems(items.map(n => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch { setItems(prev); void load(); }
  }

  async function markOne(id: number) {
    setItems(items.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnread(u => Math.max(u - 1, 0));
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {}
  }

  function toggle() {
    setOpen(o => !o);
    if (!open) void load();
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={toggle} className="relative" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-xs text-muted-foreground">
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 px-2 text-xs">
                  <Check className="mr-1 h-3 w-3" /> Mark all
                </Button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">
            {!isAuthenticated ? (
              <div className="p-6 text-center">
                <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">Sign in to see your notifications</p>
                <Button size="sm" onClick={() => { setOpen(false); openAuthModal('login'); }}>
                  Sign in
                </Button>
              </div>
            ) : loading && items.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Follow tipsters & teams to get updates here
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map(n => {
                  const Icon = ICONS[n.type] || Bell;
                  const color = COLORS[n.type] || COLORS.system;
                  const body = (
                    <div className={cn(
                      'flex gap-3 px-4 py-3 transition-colors',
                      !n.isRead && 'bg-primary/5',
                      n.link && 'hover:bg-muted cursor-pointer',
                    )}>
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{n.title}</p>
                          {!n.isRead && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.content}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id} onClick={() => !n.isRead && markOne(n.id)}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => { setOpen(false); }}>
                          {body}
                        </Link>
                      ) : body}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {isAuthenticated && (
            <div className="border-t border-border p-2">
              <Button asChild variant="ghost" size="sm" className="w-full justify-center text-xs">
                <Link href="/notifications" onClick={() => setOpen(false)}>
                  Notification settings <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
