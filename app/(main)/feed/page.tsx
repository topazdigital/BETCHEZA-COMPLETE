'use client';

import { useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FollowTipsterButton } from '@/components/tipsters/follow-tipster-button';
import {
  Heart, MessageCircle, Send, Sparkles, Loader2, Flame, TrendingUp, Users, Lock,
  Crown, Trophy, Star, BarChart3, Activity, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tipsterHref } from '@/lib/utils/slug';

const fetcher = (url: string) => fetch(url).then(r => r.json());
const POSTS_KEY = '/api/feed/posts';

interface Post {
  id: string;
  userId: number;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  matchTitle?: string | null;
  pick?: string | null;
  odds?: number | null;
  likes: number;
  liked?: boolean;
  commentCount: number;
  createdAt: string;
}

interface Comment {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface Me {
  user?: { id: number; username?: string; email?: string; displayName?: string } | null;
}

interface RecommendedTipster {
  id: number;
  username: string;
  displayName: string;
  winRate: number;
  roi: number;
  streak: number;
  followers: number;
  isPro: boolean;
  specialty: string;
  following?: boolean;
}

interface TrendingPick {
  id: string;
  authorName: string;
  pick?: string | null;
  odds?: number | null;
  matchTitle?: string | null;
  likes: number;
  commentCount: number;
  createdAt: string;
}

interface TrendingResponse {
  trending: TrendingPick[];
  stats: {
    postsToday: number;
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    activeUsers: number;
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
            <div className={cn('h-6 w-6 shrink-0 rounded-full bg-gradient-to-br text-[9px] font-bold text-white flex items-center justify-center', gradientFor(c.authorName))}>
              {avatarInitials(c.authorName)}
            </div>
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

function PostCard({ post }: { post: Post }) {
  const [openComments, setOpenComments] = useState(false);
  const [liked, setLiked] = useState(!!post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [busy, setBusy] = useState(false);

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

  return (
    <Card className="overflow-hidden border-border/60 bg-card/60 backdrop-blur transition-all hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2.5">
          <div className={cn('h-8 w-8 shrink-0 rounded-full bg-gradient-to-br text-[11px] font-bold text-white flex items-center justify-center', gradientFor(post.authorName))}>
            {avatarInitials(post.authorName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold">{post.authorName}</span>
              <span className="text-[10px] text-muted-foreground">· {timeAgo(post.createdAt)}</span>
            </div>
            {post.matchTitle && (
              <p className="text-[10px] text-muted-foreground mt-0">on {post.matchTitle}</p>
            )}
          </div>
          <FollowTipsterButton tipsterId={post.userId} tipsterName={post.authorName} variant="pill" className="h-6 px-2 text-[10px]" />
        </div>

        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-tight">{post.content}</p>

        {(post.pick || post.odds) && (
          <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-2 py-1">
            {post.pick && (
              <Badge className="h-4 bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5">
                <TrendingUp className="mr-1 h-2.5 w-2.5" />
                {post.pick}
              </Badge>
            )}
            {post.odds && (
              <span className="text-xs font-bold text-primary">@ {post.odds.toFixed(2)}</span>
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
        </div>

        <CommentList postId={post.id} open={openComments} />
      </CardContent>
    </Card>
  );
}

function Composer({ me, onPosted }: { me: Me['user'] | null | undefined; onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [pick, setPick] = useState('');
  const [odds, setOdds] = useState<string>('');
  const [matchTitle, setMatchTitle] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

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
      }),
    });
    setSubmitting(false);
    if (r.ok) {
      setContent(''); setPick(''); setOdds(''); setMatchTitle(''); setShowExtras(false);
      onPosted();
    }
  };

  const name = me.displayName || me.username || me.email || `user_${me.id}`;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-3 sm:p-4">
        <div className="flex gap-2.5">
          <div className={cn('h-8 w-8 shrink-0 rounded-full bg-gradient-to-br text-[11px] font-bold text-white flex items-center justify-center', gradientFor(name))}>
            {avatarInitials(name)}
          </div>
          <div className="flex-1">
            <Textarea
              ref={ref}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's your pick today?"
              rows={1}
              className="min-h-0 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            />
            {showExtras && (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                <input value={matchTitle} onChange={e => setMatchTitle(e.target.value)} placeholder="Match" className="h-7 rounded-md border border-border bg-background px-2 py-0 text-[11px]" />
                <input value={pick} onChange={e => setPick(e.target.value)} placeholder="Pick" className="h-7 rounded-md border border-border bg-background px-2 py-0 text-[11px]" />
                <input value={odds} onChange={e => setOdds(e.target.value)} type="number" step="0.01" placeholder="Odds" className="h-7 rounded-md border border-border bg-background px-2 py-0 text-[11px]" />
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <button onClick={() => setShowExtras(s => !s)} className="text-[10px] text-primary hover:underline">
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
  const { data } = useSWR<{ tipsters: RecommendedTipster[] }>('/api/feed/recommended-tipsters', fetcher, { refreshInterval: 60000 });
  const tipsters = data?.tipsters ?? [];

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card to-card/40">
      <CardContent className="p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Crown className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-xs font-bold">Recommended Tipsters</h3>
        </div>
        <div className="space-y-2">
          {tipsters.length === 0 ? (
            <div className="space-y-1.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : tipsters.map(t => (
            <div key={t.id} className="group flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted/50">
              <Link href={tipsterHref(t.username || t.displayName, t.username || t.id)} className="shrink-0">
                <div className={cn('relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white', gradientFor(t.displayName))}>
                  {avatarInitials(t.displayName)}
                  {t.isPro && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold text-amber-950">P</span>
                  )}
                </div>
              </Link>
              <Link href={tipsterHref(t.username || t.displayName, t.username || t.id)} className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-xs font-semibold group-hover:text-primary">{t.displayName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-emerald-500 font-semibold">{t.winRate}%</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-amber-500">{t.specialty}</span>
                </div>
              </Link>
              <FollowTipsterButton tipsterId={t.id} tipsterName={t.displayName} variant="pill" className="h-6 px-2 text-[10px]" />
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

function TrendingRail() {
  const { data } = useSWR<TrendingResponse>('/api/feed/trending', fetcher, { refreshInterval: 60000 });
  const trending = data?.trending ?? [];
  const stats = data?.stats;

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
                    {p.odds && <span className="text-[10px] font-bold text-primary">@ {p.odds.toFixed(2)}</span>}
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
              <div className="text-[9px] uppercase text-muted-foreground">Reply</div>
            </div>
            <div className="rounded-lg bg-purple-500/10 p-1.5">
              <div className="text-sm font-bold text-purple-500">{stats?.activeUsers ?? '–'}</div>
              <div className="text-[9px] uppercase text-muted-foreground">Active</div>
            </div>
          </div>
        </CardContent>
      </Card>

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
  const { data: postsRes, isLoading } = useSWR<{ posts: Post[] }>(POSTS_KEY, fetcher, { refreshInterval: 30000 });
  const posts = postsRes?.posts ?? [];

  const refresh = () => mutate(POSTS_KEY);

  return (
    <div className="overflow-x-hidden">
      <div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px] xl:grid-cols-[240px_minmax(0,1fr)_300px] p-3 md:p-4">
            {/* LEFT RAIL */}
            <aside className="hidden lg:block space-y-3">
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

              {/* Composer */}
              <Composer me={meRes?.user ?? null} onPosted={refresh} />

              {/* Feed */}
              {isLoading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : posts.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">No posts yet. Be the first to share!</CardContent></Card>
              ) : (
                <div className="space-y-2.5">
                  {posts.map(p => <PostCard key={p.id} post={p} />)}
                </div>
              )}
            </main>

            {/* RIGHT RAIL */}
            <aside className="hidden lg:block">
              <div className="sticky top-4">
                <TrendingRail />
              </div>
            </aside>
        </div>
      </div>
    </div>
  );
}
