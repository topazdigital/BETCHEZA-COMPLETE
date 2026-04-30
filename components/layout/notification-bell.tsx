'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchNotifications() {
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
  }

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetchNotifications, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  async function markAllRead() {
    if (!user || marking) return;
    setMarking(true);
    try {
      await fetch('/api/notifications/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {} finally {
      setMarking(false);
    }
  }

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (o && unreadCount > 0) {
      setTimeout(markAllRead, 1500);
    }
  }

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-live px-0.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
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
            <Link href="/notifications" className="text-xs text-primary hover:underline" onClick={() => setOpen(false)}>
              Settings
            </Link>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground/60">New alerts will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(n => (
                <NotificationItem key={n.id} notification={n} onClose={() => setOpen(false)} />
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border px-4 py-2">
          <Link
            href="/notifications"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setOpen(false)}
          >
            View all notification settings
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({ notification: n, onClose }: { notification: Notification; onClose: () => void }) {
  const content = (
    <div className={cn(
      'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
      !n.isRead && 'bg-primary/5'
    )}>
      <div className={cn(
        'mt-0.5 h-2 w-2 shrink-0 rounded-full',
        n.isRead ? 'bg-transparent' : 'bg-primary'
      )} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !n.isRead && 'font-medium')}>{n.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.content}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">{timeAgo(n.createdAt)}</p>
      </div>
    </div>
  );

  if (n.link) {
    return (
      <Link href={n.link} onClick={onClose}>
        {content}
      </Link>
    );
  }
  return content;
}
