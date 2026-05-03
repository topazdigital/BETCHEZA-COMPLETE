'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Sparkles, TrendingUp, ArrowRight, Trophy, Target } from 'lucide-react';

interface BookmarkRow {
  entity_type: string;
  entity_id: string;
  created_at: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DashboardTipsPage() {
  const { user, isLoading: loading } = useAuth();
  const { open } = useAuthModal();

  const { data: bookmarksData, isLoading } = useSWR<{ bookmarks: BookmarkRow[] }>(
    user ? '/api/bookmarks' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const bookmarks = bookmarksData?.bookmarks ?? [];
  const matchBookmarks = bookmarks.filter(b => b.entity_type === 'match');
  const tipBookmarks = bookmarks.filter(b => b.entity_type === 'tip');

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" /> Your Tips
            </CardTitle>
            <CardDescription>Sign in to view the tips you have saved and the matches you are following.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => open('login')}>Sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-primary" />
          Your Tips
        </h1>
        <p className="text-sm text-muted-foreground">
          Saved picks, followed matches and the tipsters you are tracking.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Saved Tips</p>
                <p className="text-3xl font-bold">{tipBookmarks.length}</p>
              </div>
              <Target className="h-7 w-7 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Followed Matches</p>
                <p className="text-3xl font-bold">{matchBookmarks.length}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Tipster Status</p>
                <p className="text-lg font-semibold capitalize">{user.role}</p>
              </div>
              <Trophy className="h-7 w-7 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your saved tips</CardTitle>
          <CardDescription>
            Quick access to the picks you bookmarked from match pages and tipster profiles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          ) : tipBookmarks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No saved tips yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Browse today's matches and tap the bookmark icon on a tipster's pick to save it here.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/matches">Browse matches <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/tipsters">Top tipsters</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {tipBookmarks.map(b => (
                <Link
                  key={b.entity_id}
                  href={`/matches`}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="font-medium">Tip #{b.entity_id}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(b.created_at).toLocaleDateString()}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Become a tipster</CardTitle>
          <CardDescription>
            Want to publish your own picks and build a following? Apply for a tipster profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/become-tipster">
              Apply to become a tipster <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
