'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FollowTipsterButton } from '@/components/tipsters/follow-tipster-button';
import {
  Heart, MessageCircle, Send, Sparkles, Loader2, Flame, TrendingUp, Users, Lock,
  Crown, Trophy, Star, BarChart3, Activity, Zap, RefreshCcw, WifiOff, Megaphone, Hash, X, Trash2,
  DoorOpen, ChevronRight, Link2, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tipsterHref } from '@/lib/utils/slug';

const fetcher = (url: string) => fetch(url).then(r => r.json());
const POSTS_KEY = '/api/feed/posts';

interface CommunityRoom {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  postCount: number;
  sortOrder: number;
}

function MobileRoomsBar({ activeRoom, onRoomClick }: { activeRoom: string | null; onRoomClick: (slug: string | null) => void }) {
  const { data } = useSWR<{ rooms: CommunityRoom[] }>(
    '/api/feed/rooms',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );
  const rooms = data?.rooms ?? [];

  return (
    <div className="block lg:hidden -mx-0.5 overflow-x-auto scrollbar-none">
      <div className="flex gap-1.5 px-0.5 pb-0.5">
        <button
          onClick={() => onRoomClick(null)}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            activeRoom === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          🌐 All Rooms
        </button>
        {rooms.map(room => (
          <button
            key={room.slug}
            onClick={() => onRoomClick(room.slug)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              activeRoom === room.slug ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {room.icon ?? '💬'} {room.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomsPanel({ activeRoom, onRoomClick }: { activeRoom: string | null; onRoomClick: (slug: string | null) => void }) {
  const { data } = useSWR<{ rooms: CommunityRoom[] }>(
    '/api/feed/rooms',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );
  const rooms = data?.rooms ?? [];

  return (
    <Card className="border-border/60">
      <CardContent className="p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          <DoorOpen className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-bold">Rooms</h3>
        </div>
        <div className="space-y-0.5">
          <button
            onClick={() => onRoomClick(null)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
              activeRoom === null
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="text-sm">🌐</span>
            <span className="flex-1 text-left">All Rooms</span>
            {activeRoom === null && <ChevronRight className="h-3 w-3 opacity-70" />}
          </button>
          {rooms.map(room => (
            <button
              key={room.slug}
              onClick={() => onRoomClick(room.slug)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
                activeRoom === room.slug
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="text-sm">{room.icon ?? '💬'}</span>
              <span className="flex-1 text-left truncate">{room.name}</span>
              {activeRoom === room.slug && <ChevronRight className="h-3 w-3 opacity-70 shrink-0" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface Post {
  id: string;
  userId: number;
  authorName: string;
  authorUsername?: string | null;
  authorRole?: string | null;
  authorAvatar?: string | null;
  content: string;
  matchTitle?: string | null;
  pick?: string | null;
  odds?: number | null;
  likes: number;
  liked?: boolean;
  commentCount: number;
  createdAt: string;
  hashtags?: string[];
}

function renderContent(content: string, onHashtagClick?: (tag: string) => void) {
  const parts = content.split(/(#[a-zA-Z][a-zA-Z0-9_]{0,49})/g);
  return parts.map((part, i) => {
    if (/^#[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(part)) {
      const tag = part.slice(1).toLowerCase();
      return (
        <button
          key={i}
          onClick={() => onHashtagClick?.(tag)}
          className="text-primary font-semibold hover:underline focus:outline-none"
        >
          {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface Comment {
  id: string;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  createdAt: string;
}

interface Me {
  user?: { id: number; username?: string; email?: string; displayName?: string; avatarUrl?: string | null; role?: string | null } | null;
}

interface RecommendedTipster {
  id: number;
  username: string;
  displayName: string;
  avatar?: string | null;
  winRate: number;
  roi: number;
  streak: number;
  followers: number;
  isPro: boolean;
  specialty: string;
  following?: boolean;
  isTipsterOfWeek?: boolean;
  tipsThisWeek?: number;
  wonThisWeek?: number;
  isOnline?: boolean;
}

interface TrendingPick {
  id: string;
  authorName: string;
  authorUsername?: string | null;
  pick?: string | null;
  odds?: number | null;
  matchTitle?: string | null;
  matchId?: string | null;
  likes: number;
  commentCount: number;
  createdAt: string;
}

interface OnlineAvatar {
  id: number;
  name: string;
  avatar: string;
  username: string;
}

interface TrendingResponse {
  trending: TrendingPick[];
  stats: {
    postsToday: number;
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    activeUsers: number;
    onlineTipsters: number;
    onlineAvatars?: OnlineAvatar[];
  };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function avatarInitials(name: string) {
  return name.split(/\s|_/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?';
}

function gradientFor(seed: string) {
  const palettes = [
    'from-pink-500 to-rose-600',
    'from-purple-500 to-indigo-600',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-fuchsia-500 to-pink-600',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return palettes[Math.abs(h) % palettes.length];
}

function Avatar({ src, name, size = 8, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const [imgErr, setImgErr] = useState(false);
  const sizeClass = size === 6 ? 'h-6 w-6 text-[9px]' : size === 5 ? 'h-5 w-5 text-[7px]' : 'h-8 w-8 text-[11px]';
  if (src && !imgErr) {
    return (
      <Image
        src={src}
        alt={name}
        width={size * 4}
        height={size * 4}
        onError={() => setImgErr(true)}
        className={cn(`shrink-0 rounded-full object-cover`, sizeClass, className)}
        unoptimized
      />
    );
  }
  return (
    <div className={cn(`shrink-0 rounded-full bg-gradient-to-br font-bold text-white flex items-center justify-center`, gradientFor(name), sizeClass, className)}>
      {avatarInitials(name)}
    </div>
  );
}

function CommentList({ postId, open }: { postId: string; open: boolean }) {
  const { data } = useSWR<{ comments: Comment[] }>(open ? `/api/feed/posts/${postId}/comments` : null, fetcher);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    const r = await fetch(`/api/feed/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: t }),
    });
    setSending(false);
    if (r.ok) {
      setText('');
      mutate(`/api/feed/posts/${postId}/comments`);
      mutate(POSTS_KEY);
    } else if (r.status === 401) {
      window.location.href = '/login?next=/feed';
    }
  };

  if (!open) return null;
  const comments = data?.comments ?? [];
  return (
    <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-center text-[10px] text-muted-foreground py-1">Be the first to reply.</p>
        ) : comments.map(c => (
          <div key={c.id} className="flex gap-2">
            <Avatar src={c.authorAvatar} name={c.authorName} size={6} className="mt-0.5" />
            <div className="flex-1 rounded-xl bg-muted/40 px-2.5 py-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold">{c.authorName}</span>
                <span className="text-[9px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="text-xs whitespace-pre-wrap break-words">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Reply…"
          className="h-8 flex-1 rounded-full border border-border bg-background px-3 py-0 text-xs outline-none focus:border-primary"
        />
        <Button size="icon" onClick={submit} disabled={sending || !text.trim()} className="h-8 w-8 rounded-full">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function PostCard({ post, initialFollowing = false, currentUserId, isCurrentUserAdmin, onHashtagClick }: { post: Post; initialFollowing?: boolean; currentUserId?: number | null; isCurrentUserAdmin?: boolean; onHashtagClick?: (tag: string) => void }) {
  const [openComments, setOpenComments] = useState(false);
  const [liked, setLiked] = useState(!!post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = `${window.location.origin}/feed#post-${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isAdmin = post.authorRole === 'admin';
  const isOwnPost = currentUserId != null && post.userId === currentUserId;

  const deletePost = async () => {
    if (!confirm(`Delete this post by ${post.authorName}?`)) return;
    const r = await fetch(`/api/admin/feed/${post.id}`, { method: 'DELETE' });
    if (r.ok) {
      setDeleted(true);
      mutate(POSTS_KEY);
    }
  };

  if (deleted) return null;
  const profileHref = post.authorUsername ? tipsterHref(post.authorUsername, post.authorUsername) : null;

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    const optimistic = !liked;
    setLiked(optimistic);
    setLikes(l => l + (optimistic ? 1 : -1));
    const r = await fetch(`/api/feed/posts/${post.id}/like`, { method: 'POST' });
    setBusy(false);
    if (!r.ok) {
      setLiked(!optimistic);
      setLikes(l => l + (optimistic ? -1 : 1));
      if (r.status === 401) window.location.href = '/login?next=/feed';
      return;
    }
    const j = await r.json();
    if (typeof j.likes === 'number') setLikes(j.likes);
  };

  if (isAdmin) {
    return (
      <Card id={`post-${post.id}`} className="overflow-hidden border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent backdrop-blur transition-all hover:border-amber-500/60 hover:shadow-md">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40">
              <Megaphone className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className="h-4 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 text-[10px] px-1.5 font-bold">
                  📢 Community Announcement
                </Badge>
                <span className="text-[10px] text-muted-foreground">· {timeAgo(post.createdAt)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">from Betcheza Admin</p>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-tight font-medium">{renderContent(post.content, onHashtagClick)}</p>
          <div className="mt-3 flex items-center gap-1.5">
            <button onClick={toggleLike} disabled={busy} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors', liked ? 'bg-rose-500/15 text-rose-500' : 'text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500')}>
              <Heart className={cn('h-3.5 w-3.5', liked && 'fill-rose-500')} />{likes}
            </button>
            <button onClick={() => setOpenComments(v => !v)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
              <MessageCircle className="h-3.5 w-3.5" />{post.commentCount}
            </button>
          </div>
          <CommentList postId={post.id} open={openComments} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id={`post-${post.id}`} className="overflow-hidden border-border/60 bg-card/60 backdrop-blur transition-all hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2.5">
          {profileHref ? (
            <Link href={profileHref}><Avatar src={post.authorAvatar} name={post.authorName} size={8} className="mt-0.5 hover:ring-2 hover:ring-primary/40 transition-all rounded-full" /></Link>
          ) : (
            <Avatar src={post.authorAvatar} name={post.authorName} size={8} className="mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {profileHref ? (
                <Link href={profileHref} className="text-xs font-semibold hover:text-primary hover:underline transition-colors">{post.authorName}</Link>
              ) : (
                <span className="text-xs font-semibold">{post.authorName}</span>
              )}
              <span className="text-[10px] text-muted-foreground">· {timeAgo(post.createdAt)}</span>
            </div>
            {post.matchTitle && (
              <p className="text-[10px] text-muted-foreground mt-0">on {post.matchTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isOwnPost && (
              <FollowTipsterButton tipsterId={post.userId} tipsterName={post.authorName} variant="pill" className="h-6 px-2 text-[10px]" initialFollowing={initialFollowing} />
            )}
            {isCurrentUserAdmin && (
              <button onClick={deletePost} title="Delete post" className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-tight">{renderContent(post.content, onHashtagClick)}</p>

        {(post.pick || post.odds) && (
          <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-2 py-1">
            {post.pick && (
              <Badge className="h-4 bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5">
                <TrendingUp className="mr-1 h-2.5 w-2.5" />
                {post.pick}
              </Badge>
            )}
            {post.odds && (
              <span className="text-xs font-bold text-primary">@ {Number(post.odds).toFixed(2)}</span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5">
          <button
            onClick={toggleLike}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors',
              liked ? 'bg-rose-500/15 text-rose-500' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Heart className={cn('h-3.5 w-3.5', liked && 'fill-current')} />
            <span className="font-medium">{likes}</span>
          </button>
          <button
            onClick={() => setOpenComments(o => !o)}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="font-medium">{post.commentCount}</span>
          </button>
          <button
            onClick={copyLink}
            title="Copy link to this post"
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ml-auto',
              copied ? 'text-emerald-500' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            <span className="font-medium">{copied ? 'Copied!' : 'Copy link'}</span>
          </button>
        </div>

        <CommentList postId={post.id} open={openComments} />
      </CardContent>
    </Card>
  );
}

interface MatchSuggestion {
  id: string;
  title: string;
  league: string;
  kickoffTime: string;
  odds?: { home: number; draw?: number; away: number } | null;
  markets?: Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }> | null;
}

// Given a pick label, extract real odds from match data covering all market types
function oddsForPick(pick: string, match: MatchSuggestion): string {
  const p = pick.toLowerCase().trim();

  // 1. Quick lookup from pre-parsed h2h odds
  if (match.odds) {
    if (p === 'home win') return match.odds.home.toFixed(2);
    if (p === 'away win') return match.odds.away.toFixed(2);
    if ((p === 'draw' || p === 'x') && match.odds.draw) return match.odds.draw.toFixed(2);
  }

  if (!match.markets?.length) return '';

  for (const mkt of match.markets) {
    const mktAny = mkt as {
      key?: string; name: string;
      selections?: Array<{ label: string; odds: number }>;
      outcomes?: Array<{ name: string; price: number }>;
    };

    // Helper: find an outcome by normalised name match
    const findIn = (items: Array<{ name?: string; label?: string; price?: number; odds?: number }>, ...queries: string[]) => {
      for (const q of queries) {
        const found = items.find(o => {
          const n = ((o as { name?: string; label?: string }).name ?? (o as { label?: string }).label ?? '').toLowerCase();
          return n === q || n.includes(q);
        });
        if (found) {
          const price = (found as { price?: number; odds?: number }).price ?? (found as { odds?: number }).odds ?? 0;
          if (price > 1) return price.toFixed(2);
        }
      }
      return null;
    };

    const items = mktAny.selections ?? mktAny.outcomes ?? [];
    const mk = (mktAny.key ?? '').toLowerCase();
    const mn = (mktAny.name ?? '').toLowerCase();

    // h2h / match winner
    if (mk === 'h2h' || mn.includes('match') || mn.includes('1x2') || mn.includes('winner')) {
      if (p === 'home win' || p === '1') {
        const r = findIn(items, 'home win', '1');
        if (!r && match.odds) return match.odds.home.toFixed(2);
        if (r) return r;
      }
      if (p === 'away win' || p === '2') {
        const r = findIn(items, 'away win', '2');
        if (!r && match.odds) return match.odds.away.toFixed(2);
        if (r) return r;
      }
      if (p === 'draw' || p === 'x') {
        const r = findIn(items, 'draw', 'x');
        if (!r && match.odds?.draw) return match.odds.draw.toFixed(2);
        if (r) return r;
      }
    }

    // Over/Under totals
    if (mk === 'totals' || mn.includes('over') || mn.includes('under') || mn.includes('total')) {
      const overM = p.match(/over\s*([\d.]+)/);
      const underM = p.match(/under\s*([\d.]+)/);
      if (overM) {
        const r = findIn(items, `over ${overM[1]}`, `over${overM[1]}`, 'over');
        if (r) return r;
      }
      if (underM) {
        const r = findIn(items, `under ${underM[1]}`, `under${underM[1]}`, 'under');
        if (r) return r;
      }
    }

    // BTTS / Both Teams to Score
    if (mk === 'btts' || mn.includes('both teams') || mn.includes('btts')) {
      const isYes = p.includes('yes') || (p.includes('both teams') && !p.includes('no'));
      if (isYes) {
        const r = findIn(items, 'yes');
        if (r) return r;
      } else {
        const r = findIn(items, 'no');
        if (r) return r;
      }
    }

    // Double Chance
    if (mk === 'dc' || mk === 'double_chance' || mn.includes('double chance')) {
      if (p.includes('home or draw') || p === '1x') {
        const r = findIn(items, 'home or draw', '1x', 'home/draw');
        if (r) return r;
      }
      if (p.includes('away or draw') || p === 'x2') {
        const r = findIn(items, 'away or draw', 'x2', 'away/draw');
        if (r) return r;
      }
      if (p.includes('home or away') || p === '12') {
        const r = findIn(items, 'home or away', '12', 'no draw');
        if (r) return r;
      }
    }

    // Generic exact/partial fallback across all items
    const r = findIn(items, p);
    if (r) return r;
  }
  return '';
}

// Flatten a match's markets into a simple list of {market, label, odds} picks
function flattenMarketPicks(match: MatchSuggestion): Array<{ market: string; label: string; odds: string }> {
  const picks: Array<{ market: string; label: string; odds: string }> = [];
  if (!match.markets?.length) {
    // Fallback to basic h2h from odds field
    if (match.odds) {
      picks.push({ market: 'Match Result (1X2)', label: 'Home Win', odds: match.odds.home.toFixed(2) });
      if (match.odds.draw) picks.push({ market: 'Match Result (1X2)', label: 'Draw', odds: match.odds.draw.toFixed(2) });
      picks.push({ market: 'Match Result (1X2)', label: 'Away Win', odds: match.odds.away.toFixed(2) });
    }
    return picks;
  }
  for (const mkt of match.markets) {
    const mktAny = mkt as {
      key?: string; name: string;
      selections?: Array<{ label: string; odds: number }>;
      outcomes?: Array<{ name: string; price: number }>;
    };
    const marketName = mktAny.name;
    const items = mktAny.selections
      ? mktAny.selections.map(s => ({ label: s.label, price: s.odds }))
      : (mktAny.outcomes ?? []).map(o => ({ label: o.name, price: o.price }));
    for (const item of items) {
      if (item.price > 1) {
        picks.push({ market: marketName, label: item.label, odds: item.price.toFixed(2) });
      }
    }
  }
  return picks;
}

function Composer({ me, onPosted, activeRoom }: { me: Me['user'] | null | undefined; onPosted: () => void; activeRoom?: string | null }) {
  const [content, setContent] = useState('');
  const [pick, setPick] = useState('');
  const [odds, setOdds] = useState<string>('');
  const [matchTitle, setMatchTitle] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchSuggestion | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [allMatches, setAllMatches] = useState<MatchSuggestion[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ── Hashtag autocomplete state ──────────────────────────────────
  const [allHashtags, setAllHashtags] = useState<string[]>([]);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [showHashtagSuggest, setShowHashtagSuggest] = useState(false);

  const fetchMatches = async () => {
    if (allMatches.length > 0) return;
    setLoadingMatches(true);
    try {
      const res = await fetch('/api/matches?limit=100');
      const data = await res.json();
      const list: MatchSuggestion[] = (data.matches || []).map((m: {
        id: string; homeTeam: { name: string }; awayTeam: { name: string };
        league: { name: string }; kickoffTime: string;
        odds?: { home: number; draw?: number; away: number };
        markets?: Array<{ key?: string; name: string; selections: Array<{ label: string; odds: number }> }>;
      }) => ({
        id: m.id,
        title: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        league: m.league.name,
        kickoffTime: m.kickoffTime,
        odds: m.odds ?? null,
        markets: m.markets ?? null,
      }));
      setAllMatches(list);
    } catch { /* ignore */ } finally {
      setLoadingMatches(false);
    }
  };

  // ── Hashtag helpers ─────────────────────────────────────────────
  const loadHashtags = async (): Promise<string[]> => {
    if (allHashtags.length > 0) return allHashtags;
    try {
      const res = await fetch('/api/feed/hashtags/trending?limit=30');
      const data = await res.json();
      const tags: string[] = (data.hashtags ?? []).map((h: { tag: string }) => h.tag);
      setAllHashtags(tags);
      return tags;
    } catch { return []; }
  };

  const handleContentChange = async (val: string, cursorPos: number) => {
    setContent(val);
    const textBefore = val.slice(0, cursorPos);
    const match = textBefore.match(/#([a-zA-Z0-9_]{0,49})$/);
    if (match) {
      const q = match[1].toLowerCase();
      const tags = await loadHashtags();
      const filtered = tags.filter(t => q === '' ? true : t.startsWith(q)).slice(0, 8);
      setHashtagSuggestions(filtered);
      setShowHashtagSuggest(filtered.length > 0);
    } else {
      setShowHashtagSuggest(false);
    }
  };

  const insertHashtag = (tag: string) => {
    const cursorPos = ref.current?.selectionStart ?? content.length;
    const textBefore = content.slice(0, cursorPos);
    const match = textBefore.match(/#([a-zA-Z0-9_]{0,49})$/);
    if (!match) { setShowHashtagSuggest(false); return; }
    const start = cursorPos - match[0].length;
    const newContent = content.slice(0, start) + `#${tag} ` + content.slice(cursorPos);
    setContent(newContent);
    setShowHashtagSuggest(false);
    setTimeout(() => {
      if (ref.current) {
        const newPos = start + tag.length + 2;
        ref.current.setSelectionRange(newPos, newPos);
        ref.current.focus();
      }
    }, 0);
  };

  const handleMatchSearchChange = (val: string) => {
    setMatchSearch(val);
    setMatchTitle(val);
    setSelectedMatch(null);
    if (val.trim().length >= 2) {
      const q = val.toLowerCase();
      const filtered = allMatches.filter(m => m.title.toLowerCase().includes(q) || m.league.toLowerCase().includes(q)).slice(0, 6);
      setSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelectMatch = async (match: MatchSuggestion) => {
    setSelectedMatch(match);
    setMatchTitle(match.title);
    setMatchSearch(match.title);
    setShowDropdown(false);
    // Eagerly set odds from whatever we already have
    if (pick) {
      const earlyOdds = oddsForPick(pick, match);
      if (earlyOdds) setOdds(earlyOdds);
    }
    // Fetch full market data so all pick types (BTTS, O/U, DC) have correct odds
    try {
      const res = await fetch(`/api/matches/${match.id}`);
      if (res.ok) {
        const data = await res.json();
        const fullMatch: MatchSuggestion = {
          ...match,
          odds: data.match?.odds ?? data.odds ?? match.odds,
          markets: data.match?.markets ?? data.markets ?? match.markets,
        };
        setSelectedMatch(fullMatch);
        if (pick) {
          const autoOdds = oddsForPick(pick, fullMatch);
          if (autoOdds) setOdds(autoOdds);
        }
      }
    } catch { /* keep existing data */ }
  };

  const handlePickChange = (val: string) => {
    setPick(val);
    if (selectedMatch && val) {
      const autoOdds = oddsForPick(val, selectedMatch);
      if (autoOdds) setOdds(autoOdds);
    }
  };

  if (!me) {
    return (
      <Card className="border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center sm:flex-row sm:text-left">
          <Lock className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Join the conversation</p>
            <p className="text-xs text-muted-foreground">Sign in to share tips and chat with other tipsters.</p>
          </div>
          <Button size="sm" className="h-8 text-xs" asChild><Link href="/login?next=/feed">Sign in</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const submit = async () => {
    const t = content.trim();
    if (!t) return;
    setSubmitting(true);
    const r = await fetch('/api/feed/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: t,
        pick: pick.trim() || null,
        odds: odds.trim() ? Number(odds) : null,
        matchTitle: matchTitle.trim() || null,
        matchId: selectedMatch?.id ?? null,
        room: activeRoom ?? null,
      }),
    });
    setSubmitting(false);
    if (r.ok) {
      setContent(''); setPick(''); setOdds(''); setMatchTitle(''); setMatchSearch('');
      setSelectedMatch(null); setShowExtras(false); setShowHashtagSuggest(false);
      onPosted();
    }
  };

  const name = me.displayName || me.username || me.email || `user_${me.id}`;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-3 sm:p-4">
        <div className="flex gap-2.5">
          <Avatar src={me.avatarUrl} name={name} size={8} className="mt-0.5" />
          <div className="flex-1">
            <div className="relative">
              <Textarea
                ref={ref}
                value={content}
                onChange={e => { void handleContentChange(e.target.value, e.target.selectionStart); }}
                onKeyDown={e => { if (e.key === 'Escape' && showHashtagSuggest) { setShowHashtagSuggest(false); e.preventDefault(); } }}
                onBlur={() => setTimeout(() => setShowHashtagSuggest(false), 150)}
                placeholder="What's your pick today? Type # to tag a topic"
                rows={1}
                className="min-h-0 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
              />
              {/* Hashtag autocomplete dropdown */}
              {showHashtagSuggest && hashtagSuggestions.length > 0 && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] rounded-lg border border-border bg-popover shadow-lg p-2">
                  <p className="mb-1.5 px-1 text-[9px] uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1">
                    <Hash className="h-2.5 w-2.5" /> Trending hashtags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {hashtagSuggestions.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); insertHashtag(tag); }}
                        className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 hover:border-primary/50 transition-colors"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {showExtras && (
              <div className="mt-2 space-y-1.5">
                {/* Match search with autocomplete */}
                <div className="relative" ref={dropdownRef}>
                  <input
                    value={matchSearch}
                    onChange={e => handleMatchSearchChange(e.target.value)}
                    onFocus={() => { fetchMatches(); if (suggestions.length > 0) setShowDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder="Search match (e.g. Arsenal vs Chelsea)"
                    className="h-7 w-full rounded-md border border-border bg-background px-2 py-0 text-[11px] outline-none focus:border-primary"
                  />
                  {loadingMatches && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">loading…</span>}
                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                      {suggestions.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={() => handleSelectMatch(s)}
                          className="flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-accent"
                        >
                          <span className="text-[11px] font-semibold">{s.title}</span>
                          <span className="text-[9px] text-muted-foreground">{s.league}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Market picker — uses real odds when a match with markets is loaded */}
                {selectedMatch && flattenMarketPicks(selectedMatch).length > 0 ? (() => {
                  const allPicks = flattenMarketPicks(selectedMatch);
                  const markets = [...new Set(allPicks.map(p => p.market))];
                  return (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Select a market & pick (real odds):</p>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {markets.map(mkt => (
                          <div key={mkt}>
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold px-0.5 mb-0.5">{mkt}</p>
                            <div className="flex flex-wrap gap-1">
                              {allPicks.filter(p => p.market === mkt).map(p => (
                                <button
                                  key={`${mkt}:${p.label}`}
                                  type="button"
                                  onClick={() => { setPick(p.label); setOdds(p.odds); }}
                                  className={cn(
                                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors',
                                    pick === p.label
                                      ? 'border-primary bg-primary/20 text-primary font-bold'
                                      : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/10',
                                  )}
                                >
                                  <span>{p.label}</span>
                                  <span className={cn('font-bold', pick === p.label ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400')}>
                                    {p.odds}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {pick && (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={odds}
                            onChange={e => setOdds(e.target.value)}
                            type="number"
                            step="0.01"
                            min="1"
                            placeholder="Adjust odds"
                            className="h-6 w-28 rounded-md border border-border bg-background px-2 text-[11px] outline-none focus:border-primary"
                          />
                          <span className="text-[10px] text-muted-foreground">or edit manually</span>
                          <button type="button" onClick={() => { setPick(''); setOdds(''); }} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">✕ clear</button>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      value={pick}
                      onChange={e => handlePickChange(e.target.value)}
                      placeholder="Pick (e.g. Home Win)"
                      className="h-7 rounded-md border border-border bg-background px-2 py-0 text-[11px] outline-none focus:border-primary"
                    />
                    <input
                      value={odds}
                      onChange={e => setOdds(e.target.value)}
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="Odds"
                      className="h-7 rounded-md border border-border bg-background px-2 py-0 text-[11px] outline-none focus:border-primary"
                    />
                  </div>
                )}
                {pick && odds && (
                  <div className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1">
                    <TrendingUp className="h-3 w-3 text-primary" />
                    <span className="text-[11px] font-semibold text-primary">{pick}</span>
                    <span className="text-[11px] font-bold text-primary">@ {Number(odds).toFixed(2)}</span>
                    {selectedMatch && <span className="ml-auto text-[9px] text-muted-foreground truncate">{selectedMatch.title}</span>}
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <button onClick={() => { setShowExtras(s => !s); if (!showExtras) fetchMatches(); }} className="text-[10px] text-primary hover:underline">
                {showExtras ? '− Hide tip details' : '+ Add a tip'}
              </button>
              <Button size="sm" onClick={submit} disabled={submitting || !content.trim()} className="h-7 rounded-full text-xs">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span className="ml-1">Post</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendedTipstersRail() {
  const { data, isLoading } = useSWR<{ tipsters: RecommendedTipster[] }>('/api/feed/recommended-tipsters', fetcher, { refreshInterval: 60000, revalidateOnFocus: false, dedupingInterval: 60_000 });
  const tipsters = data?.tipsters ?? [];

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card to-card/40">
      <CardContent className="p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Crown className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-xs font-bold">Recommended Tipsters</h3>
        </div>
        <div className="space-y-2">
          {isLoading ? (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : tipsters.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">No tipsters yet. Be the first!</p>
          ) : tipsters.map(t => (
            <div key={t.id} className={cn('group flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted/50', t.isTipsterOfWeek && 'ring-1 ring-amber-400/50 bg-amber-500/5')}>
              <Link href={tipsterHref(t.username || t.displayName, t.username || t.id)} className="shrink-0">
                <div className="relative">
                  <Avatar src={t.avatar} name={t.displayName} size={8} />
                  {t.isTipsterOfWeek ? (
                    <span title="Tipster of the Week" className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[7px] font-bold text-amber-950 ring-1 ring-background">★</span>
                  ) : t.isPro ? (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold text-amber-950 ring-1 ring-background">P</span>
                  ) : t.isOnline ? (
                    <span className="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-1 ring-background" />
                  ) : null}
                </div>
              </Link>
              <Link href={tipsterHref(t.username || t.displayName, t.username || t.id)} className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-xs font-semibold group-hover:text-primary">{t.displayName}</span>
                  {t.isTipsterOfWeek && (
                    <span className="shrink-0 rounded-full bg-amber-400/20 px-1 py-0 text-[8px] font-bold text-amber-500">WEEK</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-emerald-500 font-semibold">{t.winRate}%</span>
                  {t.tipsThisWeek ? (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{t.wonThisWeek}/{t.tipsThisWeek} this wk</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-amber-500">{t.specialty}</span>
                    </>
                  )}
                </div>
              </Link>
              <FollowTipsterButton tipsterId={t.id} tipsterName={t.displayName} variant="pill" className="h-6 px-2 text-[10px]" initialFollowing={t.following ?? false} />
            </div>
          ))}
        </div>
        <Link href="/tipsters" className="mt-2.5 block text-center text-[11px] font-semibold text-primary hover:underline">
          See all tipsters →
        </Link>
      </CardContent>
    </Card>
  );
}

interface MyTip {
  id: string;
  matchId: string;
  matchSlug?: string;
  prediction: string;
  market: string;
  odds: number;
  stake: number;
  status: string;
  createdAt: string;
  tipster?: { id: string; displayName: string };
}

function MyTipsPanel({ userId }: { userId?: number | null }) {
  const { data, isLoading } = useSWR<{ tips: MyTip[]; authenticated: boolean }>(
    userId ? '/api/tips/my' : null,
    fetcher,
    { refreshInterval: 120_000, revalidateOnFocus: false },
  );
  const tips = data?.tips ?? [];

  if (!userId || (!isLoading && tips.length === 0)) return null;

  const settled = tips.filter(t => t.status === 'won' || t.status === 'lost');
  const won = settled.filter(t => t.status === 'won').length;
  const lost = settled.filter(t => t.status === 'lost').length;
  const winRate = settled.length > 0 ? Math.round((won / settled.length) * 100) : null;

  // ROI = sum over settled tips of: (won ? (odds - 1) * stake : -stake) / sum(stake) * 100
  let totalStake = 0;
  let totalReturn = 0;
  for (const t of settled) {
    const s = Number(t.stake) || 1;
    totalStake += s;
    totalReturn += t.status === 'won' ? (Number(t.odds) - 1) * s : -s;
  }
  const roi = totalStake > 0 ? Math.round((totalReturn / totalStake) * 1000) / 10 : null;

  const statusColor = (s: string) =>
    s === 'won' ? 'text-emerald-600 bg-emerald-500/15' :
    s === 'lost' ? 'text-rose-600 bg-rose-500/15' :
    s === 'void' ? 'text-muted-foreground bg-muted/40' :
    'text-amber-600 bg-amber-500/15';

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-bold">My Posted Tips</h3>
        </div>
        {winRate !== null && (
          <div className="mb-2 grid grid-cols-3 gap-1 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-1.5">
              <div className="text-sm font-bold text-emerald-500">{won}W</div>
              <div className="text-[9px] uppercase text-muted-foreground">Won</div>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-1.5">
              <div className="text-sm font-bold text-rose-500">{lost}L</div>
              <div className="text-[9px] uppercase text-muted-foreground">Lost</div>
            </div>
            <div className={cn('rounded-lg p-1.5', roi !== null && roi >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
              <div className={cn('text-sm font-bold', roi !== null && roi >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                {roi !== null ? `${roi > 0 ? '+' : ''}${roi}%` : '—'}
              </div>
              <div className="text-[9px] uppercase text-muted-foreground">ROI</div>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded-lg bg-muted/40" />)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {tips.slice(0, 5).map(tip => (
              <div key={tip.id} className="flex items-center gap-1.5 rounded-lg bg-muted/20 px-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold">{tip.prediction}</p>
                  <p className="truncate text-[9px] text-muted-foreground">{tip.market} · @{Number(tip.odds).toFixed(2)}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-1.5 py-0 text-[9px] font-bold uppercase', statusColor(tip.status))}>
                  {tip.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/tips" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">
          View all tips →
        </Link>
      </CardContent>
    </Card>
  );
}

interface StrategyPickSlim {
  homeTeam: string;
  awayTeam: string;
  league: string;
  pick: string;
  market: string;
  odds: number;
  confidence: string;
  matchTime?: string;
}

interface StrategyDaySlim {
  date: string;
  picks: StrategyPickSlim[];
  result?: string;
}

interface StrategyWeekSlim {
  days: StrategyDaySlim[];
}

function TipOfDay() {
  // Try strategy picks first (real verified odds from the daily strategy)
  const { data: stratData } = useSWR<StrategyWeekSlim>('/api/strategy/predictions', fetcher, {
    refreshInterval: 600_000,
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  });

  // Fall back to community trending posts
  const { data: trendData } = useSWR<TrendingResponse>('/api/feed/trending', fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  // Find today's strategy pick (best confidence, then odds closest to 1.90)
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = stratData?.days?.find(d => d.date === today && (!d.result || d.result === 'pending'));
  const stratPicks = todayDay?.picks ?? [];
  const bestStratPick = stratPicks.length > 0
    ? stratPicks.slice().sort((a, b) => {
        const confScore = (c: string) => c === 'High' ? 3 : c === 'Medium' ? 2 : 1;
        const cs = confScore(b.confidence) - confScore(a.confidence);
        if (cs !== 0) return cs;
        return Math.abs(a.odds - 1.90) - Math.abs(b.odds - 1.90);
      })[0]
    : null;

  // Community trending fallback
  const communityPick = trendData?.trending?.find(p => p.pick && p.odds && Number(p.odds) > 1.10) ?? null;

  if (!bestStratPick && !communityPick) return null;

  if (bestStratPick) {
    const matchTitle = `${bestStratPick.homeTeam} vs ${bestStratPick.awayTeam}`;
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card p-4">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Tip of the Day</span>
          </div>
          <Link href="/strategy" className="mb-1 block truncate text-[11px] text-primary hover:underline font-medium">
            {matchTitle}
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-amber-600 font-medium">Pick</div>
              <div className="text-base font-black text-foreground leading-tight truncate">{bestStratPick.pick}</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wide text-emerald-600 font-medium">Odds</div>
              <div className="text-base font-black text-emerald-500">{Number(bestStratPick.odds).toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground truncate">{bestStratPick.market} · {bestStratPick.league}</p>
            <Link href="/strategy" className="text-[9px] font-semibold text-amber-500 hover:underline shrink-0">3 Daily Odds →</Link>
          </div>
        </div>
      </div>
    );
  }

  // Community trending fallback
  const top = communityPick!;
  const matchHref = top.matchId ? `/matches/${top.matchId}` : null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card p-4">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
      <div className="relative">
        <div className="mb-2 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Tip of the Day</span>
        </div>
        {top.matchTitle && (
          matchHref ? (
            <Link href={matchHref} className="mb-1 block truncate text-[11px] text-primary hover:underline font-medium">
              {top.matchTitle}
            </Link>
          ) : (
            <p className="mb-1 text-[11px] text-muted-foreground truncate">{top.matchTitle}</p>
          )
        )}
        <div className="flex items-center gap-3">
          {top.pick && (
            <div className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-amber-600 font-medium">Pick</div>
              <div className="text-base font-black text-foreground leading-tight truncate">{top.pick}</div>
            </div>
          )}
          {top.odds && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wide text-emerald-600 font-medium">Odds</div>
              <div className="text-base font-black text-emerald-500">{Number(top.odds).toFixed(2)}</div>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>by</span>
            {top.authorUsername ? (
              <Link href={`/tipsters/${top.authorUsername}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                {top.authorName}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{top.authorName}</span>
            )}
            <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5 text-rose-400" />{top.likes}</span>
          </div>
          <span className="text-[9px] text-amber-500 font-semibold">Community favourite</span>
        </div>
      </div>
    </div>
  );
}

interface HashtagItem { tag: string; count: number; }

function TrendingHashtags({ onHashtagClick }: { onHashtagClick: (tag: string) => void }) {
  const { data } = useSWR<{ hashtags: HashtagItem[] }>(
    '/api/feed/hashtags/trending?limit=12',
    fetcher,
    { refreshInterval: 120_000, revalidateOnFocus: false, dedupingInterval: 120_000 },
  );
  const tags = data?.hashtags ?? [];
  if (!tags.length) return null;
  return (
    <Card className="border-border/60">
      <CardContent className="p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-bold">Trending Hashtags</h3>
          <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0 text-[9px] font-semibold text-primary">7d</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => onHashtagClick(tag)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors"
            >
              #{tag}
              <span className="text-[9px] text-muted-foreground font-normal">{count}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendingRail({ onHashtagClick }: { onHashtagClick: (tag: string) => void }) {
  const { data } = useSWR<TrendingResponse>('/api/feed/trending', fetcher, { refreshInterval: 60000, revalidateOnFocus: false, dedupingInterval: 60_000 });
  const trending = data?.trending ?? [];
  const stats = data?.stats;
  const onlineAvatars = stats?.onlineAvatars ?? [];

  return (
    <div className="space-y-3">
      <Card className="border-border/60 bg-gradient-to-br from-rose-500/5 via-card to-card">
        <CardContent className="p-3">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-rose-500" />
            <h3 className="text-xs font-bold">Trending Picks</h3>
            <span className="ml-auto rounded-full bg-rose-500/15 px-1.5 py-0 text-[9px] font-semibold text-rose-500">24h</span>
          </div>
          <div className="space-y-2.5">
            {trending.length === 0 ? (
              <p className="text-center text-[10px] text-muted-foreground py-2">No trending picks yet.</p>
            ) : trending.map((p, i) => (
              <div key={p.id} className="flex items-start gap-2">
                <span className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold',
                  i === 0 && 'bg-amber-500/20 text-amber-500',
                  i === 1 && 'bg-zinc-400/20 text-zinc-400',
                  i === 2 && 'bg-orange-700/20 text-orange-600',
                  i > 2 && 'bg-muted text-muted-foreground',
                )}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[9px] py-0 px-1">{p.pick}</Badge>
                    {p.odds && <span className="text-[10px] font-bold text-primary">@ {Number(p.odds).toFixed(2)}</span>}
                  </div>
                  {p.matchTitle && <p className="mt-0 truncate text-[10px] text-muted-foreground">{p.matchTitle}</p>}
                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    <span>by <span className="font-semibold text-foreground">{p.authorName}</span></span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5"><Heart className="h-2 w-2" />{p.likes}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="h-2 w-2" />{p.commentCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <h3 className="text-xs font-bold">Community Pulse</h3>
            {(stats?.onlineTipsters ?? 0) > 0 && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0 text-[9px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {stats!.onlineTipsters} online
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-1.5">
              <div className="text-sm font-bold text-emerald-500">{stats?.postsToday ?? '–'}</div>
              <div className="text-[9px] uppercase text-muted-foreground">Today</div>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-1.5">
              <div className="text-sm font-bold text-rose-500">{stats?.totalLikes ?? '–'}</div>
              <div className="text-[9px] uppercase text-muted-foreground">Likes</div>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-1.5">
              <div className="text-sm font-bold text-blue-500">{stats?.totalComments ?? '–'}</div>
              <div className="text-[9px] uppercase text-muted-foreground">Comments</div>
            </div>
            <div className="rounded-lg bg-purple-500/10 p-1.5">
              <div className="text-sm font-bold text-purple-500">{stats?.activeUsers ?? '–'}</div>
              <div className="text-[9px] uppercase text-muted-foreground">Active</div>
            </div>
          </div>
          {(stats?.onlineTipsters ?? 0) > 0 && (
            <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {onlineAvatars.slice(0, 5).map((t, i) => (
                  <div key={t.id} className="relative" style={{ zIndex: 5 - i }}>
                    <Avatar src={t.avatar} name={t.name} size={5} className="ring-1 ring-background" />
                  </div>
                ))}
                {(stats?.onlineTipsters ?? 0) > 5 && (
                  <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center text-[7px] font-bold text-muted-foreground" style={{ zIndex: 0 }}>
                    +{(stats?.onlineTipsters ?? 0) - 5}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                {stats!.onlineTipsters} tipster{stats!.onlineTipsters !== 1 ? 's' : ''} online now
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <TrendingHashtags onHashtagClick={onHashtagClick} />

      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-purple-500/5 to-card">
        <CardContent className="p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-bold">Get Notified</h3>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Follow tipsters and teams for push alerts when they post a pick or match.
          </p>
          <Link href="/notifications" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">
            Manage alerts →
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
            <h3 className="text-xs font-bold">Quick Links</h3>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <Link href="/leaderboard" className="rounded-lg border border-border p-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <Trophy className="h-3 w-3 text-amber-500" />
              <p className="mt-0.5 font-semibold">Rankings</p>
            </Link>
            <Link href="/competitions" className="rounded-lg border border-border p-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <Star className="h-3 w-3 text-purple-500" />
              <p className="mt-0.5 font-semibold">Cups</p>
            </Link>
            <Link href="/stats" className="rounded-lg border border-border p-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <BarChart3 className="h-3 w-3 text-blue-500" />
              <p className="mt-0.5 font-semibold">Stats</p>
            </Link>
            <Link href="/live" className="rounded-lg border border-border p-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <Activity className="h-3 w-3 text-rose-500" />
              <p className="mt-0.5 font-semibold">Live</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FeedPage() {
  const { data: meRes } = useSWR<Me>('/api/auth/me', fetcher);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [fetchLimit, setFetchLimit] = useState(25);

  const postsKey = activeHashtag
    ? `${POSTS_KEY}?hashtag=${encodeURIComponent(activeHashtag)}&limit=${fetchLimit}`
    : activeRoom
      ? `${POSTS_KEY}?room=${encodeURIComponent(activeRoom)}&limit=${fetchLimit}`
      : `${POSTS_KEY}?limit=${fetchLimit}`;
  const { data: postsRes, isLoading, error: postsError } = useSWR<{ posts: Post[]; hasMore?: boolean }>(postsKey, fetcher, { refreshInterval: 60000, revalidateOnFocus: false, dedupingInterval: 60000 });
  const posts = postsRes?.posts ?? [];
  const hasMore = postsRes?.hasMore ?? false;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) setFetchLimit(l => l + 25);
  }, [isLoading, hasMore]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const handleHashtagClick = (tag: string) => {
    setActiveHashtag(prev => prev === tag ? null : tag);
    setActiveRoom(null);
    setFetchLimit(25);
    scrolledRef.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoomClick = (slug: string | null) => {
    setActiveRoom(slug);
    setActiveHashtag(null);
    setFetchLimit(25);
    scrolledRef.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to and highlight a specific post when opened from a notification link (/feed#<postId>).
  // Only fires once when posts first arrive so it doesn't repeat on every SWR refresh.
  useEffect(() => {
    if (!posts.length || scrolledRef.current) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    scrolledRef.current = true;
    const timer = setTimeout(() => {
      const el = document.getElementById(`post-${hash}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 0.4s ease';
      el.style.boxShadow = '0 0 0 3px hsl(var(--primary) / 0.6), 0 0 0 6px hsl(var(--primary) / 0.15)';
      const clear = setTimeout(() => { el.style.boxShadow = ''; }, 3500);
      return () => clearTimeout(clear);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);

  const isLoggedIn = !!meRes?.user;
  const tipsterIds = useMemo(() => [...new Set(posts.map(p => p.userId))], [posts]);
  const batchKey = isLoggedIn && tipsterIds.length > 0 ? ['batch-follow', tipsterIds.join(',')] : null;
  const { data: batchRes } = useSWR<{ statuses: Record<number, boolean> }>(
    batchKey,
    () => fetch('/api/tipsters/batch-follow-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: tipsterIds }),
    }).then(r => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );
  const followStatuses = batchRes?.statuses ?? {};

  const refresh = () => mutate(postsKey);

  return (
    <div className="overflow-x-hidden">
      <div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px] xl:grid-cols-[240px_minmax(0,1fr)_300px] p-3 md:p-4">
            {/* LEFT RAIL */}
            <aside className="hidden lg:block space-y-3">
              <RoomsPanel activeRoom={activeRoom} onRoomClick={handleRoomClick} />
              <RecommendedTipstersRail />
            </aside>

            {/* CENTER FEED */}
            <main className="space-y-3 min-w-0">
              {/* Hero */}
              <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/10 p-4">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/30 blur-2xl" />
                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-pink-500/20 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold tracking-tight">The Feed</h1>
                      <p className="text-[10px] text-muted-foreground">Live community of tipsters & fans.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-rose-500"><Flame className="h-2.5 w-2.5" /> Hot picks</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-emerald-500"><TrendingUp className="h-2.5 w-2.5" /> Live odds</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-primary"><Users className="h-2.5 w-2.5" /> {posts.length} posts</span>
                  </div>
                </div>
              </div>

              {/* Mobile rooms selector (hidden on desktop where left rail shows) */}
              <MobileRoomsBar activeRoom={activeRoom} onRoomClick={handleRoomClick} />

              {/* Tip of the Day */}
              <TipOfDay />

              {/* Composer */}
              <Composer me={meRes?.user ?? null} onPosted={refresh} activeRoom={activeRoom} />

              {/* Room filter banner */}
              {activeRoom && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2">
                  <DoorOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary flex-1 capitalize">{activeRoom.replace(/-/g, ' ')}</span>
                  <button
                    onClick={() => handleRoomClick(null)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" /> All rooms
                  </button>
                </div>
              )}

              {/* Hashtag filter banner */}
              {activeHashtag && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2">
                  <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary flex-1">#{activeHashtag}</span>
                  <button
                    onClick={() => setActiveHashtag(null)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" /> Clear filter
                  </button>
                </div>
              )}

              {/* Feed */}
              {postsError ? (
                <Card className="border-border/60">
                  <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                    <WifiOff className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Something went wrong</p>
                      <p className="text-xs text-muted-foreground mt-0.5">The feed failed to load. Check your connection and try again.</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => mutate(POSTS_KEY)}>
                      <RefreshCcw className="h-3.5 w-3.5" />Try again
                    </Button>
                  </CardContent>
                </Card>
              ) : isLoading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : posts.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="text-3xl">📭</div>
                  <div>
                    <p className="text-sm font-semibold">No posts yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Be the first to share a tip with the community!</p>
                  </div>
                </CardContent></Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {posts.map(p => <PostCard key={p.id} post={p} initialFollowing={!!followStatuses[p.userId]} currentUserId={meRes?.user?.id ?? null} isCurrentUserAdmin={meRes?.user?.role === 'admin' || meRes?.user?.role === 'super_admin'} onHashtagClick={handleHashtagClick} />)}
                  </div>
                  {/* Infinite scroll sentinel */}
                  <div ref={loadMoreRef} className="py-2 flex items-center justify-center">
                    {isLoading && posts.length > 0 && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!hasMore && posts.length > 0 && (
                      <p className="text-xs text-muted-foreground">You&apos;ve seen all posts</p>
                    )}
                  </div>
                </>
              )}
            </main>

            {/* RIGHT RAIL */}
            <aside className="hidden lg:block">
              <div className="sticky top-4 space-y-3">
                <MyTipsPanel userId={meRes?.user?.id ?? null} />
                <TrendingRail onHashtagClick={handleHashtagClick} />
              </div>
            </aside>
        </div>
      </div>
    </div>
  );
}
