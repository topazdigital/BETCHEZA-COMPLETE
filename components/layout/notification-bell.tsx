'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Bell, Check, Loader2, ExternalLink, X,
  Heart, MessageSquare, UserPlus, Trophy,
  Newspaper, AlertCircle, Megaphone, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  post_like: Heart, post_comment: MessageSquare, comment_reply: MessageSquare,
  follow_new: UserPlus, tipster_post: Megaphone, tipster_new_tip: Trophy,
  tipster_tip_won: Trophy, team_match_starting: Zap, team_result: Trophy,
  team_news: Newspaper, match_lineup: Zap, odds_drop: AlertCircle,
  admin_broadcast: Megaphone,
};
const TYPE_COLORS: Record<string, string> = {
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
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
    const t = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(t);
  }, [user, fetchNotifications]);

  // Close on outside click or touch
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // Prevent body scroll when mobile panel open
  useEffect(() => {
    if (isMobile && open) { document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, open]);

  async function markAllRead() {
    if (!user || marking || unreadCount === 0) return;
    setMarking(true);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch { void fetchNotifications(); }
    finally { setMarking(false); }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      void fetchNotifications();
      if (unreadCount > 0) setTimeout(markAllRead, 1500);
    }
  }

  if (!user) return null;

  // ── Panel content (shared between portal and inline render) ──────────────
  const panel = (
    <div
      ref={panelRef}
      className={cn(
        'z-[9999] flex flex-col overflow-hidden border border-border bg-popover shadow-2xl',
        isMobile
          ? 'fixed inset-x-0 bottom-0 rounded-t-2xl'
          : 'absolute right-0 top-full mt-2 w-80 rounded-xl',
      )}
      style={isMobile ? { maxHeight: '85dvh' } : { maxHeight: 'calc(100dvh - 70px)' }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Notifications</h3>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Mark all read
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground">Follow tipsters &amp; teams to get updates</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map(n => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              const color = TYPE_COLORS[n.type] || 'text-muted-foreground bg-muted';
              const body = (
                <div className={cn(
                  'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                  !n.isRead && 'bg-primary/5',
                )}>
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className={cn('flex-1 text-sm leading-snug', !n.isRead && 'font-medium')}>{n.title}</p>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.content}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link
                    ? <Link href={n.link} onClick={() => setOpen(false)}>{body}</Link>
                    : body}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-4 py-2.5">
        <Link
          href="/notifications"
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setOpen(false)}
        >
          View all notification settings <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile backdrop + bottom-sheet panel via portal */}
      {open && isMobile && mounted && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {panel}
        </>,
        document.body,
      )}

      {/* Desktop dropdown (inline, not portalled) */}
      {open && !isMobile && panel}
    </div>
  );
}
