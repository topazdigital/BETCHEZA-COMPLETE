'use client';

import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import { TipsterCard } from '@/components/tipsters/tipster-card';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function TopTipstersSection() {
  const { data } = useSWR('/api/tipsters?limit=4&sortBy=winRate', fetcher);
  const tipsters = data?.tipsters ?? [];

  if (tipsters.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold text-foreground">Top Tipsters</h2>
        </div>
        <Link
          href="/tipsters"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tipsters.map((tipster: { id: number; username: string; display_name?: string; displayName?: string; avatar_url?: string; avatar?: string; win_rate?: number; winRate?: number; roi?: number; total_tips?: number; totalTips?: number; won_tips?: number; wonTips?: number; streak?: number; is_pro?: boolean; isPro?: boolean; is_verified?: boolean; verified?: boolean; followers_count?: number; followers?: number }) => (
          <TipsterCard
            key={tipster.id}
            user={{
              id: tipster.id,
              username: tipster.username,
              display_name: tipster.displayName || tipster.display_name || tipster.username,
              avatar_url: tipster.avatar || tipster.avatar_url || null,
            }}
            profile={{
              win_rate: tipster.winRate ?? tipster.win_rate ?? 0,
              roi: tipster.roi ?? 0,
              total_tips: tipster.totalTips ?? tipster.total_tips ?? 0,
              won_tips: tipster.wonTips ?? tipster.won_tips ?? 0,
              streak: tipster.streak ?? 0,
              is_pro: tipster.isPro ?? tipster.is_pro ?? false,
              is_verified: tipster.verified ?? tipster.is_verified ?? false,
              followers_count: tipster.followers ?? tipster.followers_count ?? 0,
            }}
            compact
          />
        ))}
      </div>
    </section>
  );
}
