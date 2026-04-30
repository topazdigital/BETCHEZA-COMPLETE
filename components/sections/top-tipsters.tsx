'use client';

import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import { TipsterCard } from '@/components/tipsters/tipster-card';
import { mockUsers } from '@/lib/mock-data';

export function TopTipstersSection() {
  const tipsters = mockUsers.filter((u) => u.role === 'tipster' && u.tipster_profile);

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
        {tipsters.slice(0, 4).map((user) => (
          <TipsterCard
            key={user.id}
            user={{
              id: user.id,
              username: user.username,
              display_name: user.display_name,
              avatar_url: user.avatar_url,
            }}
            profile={user.tipster_profile!}
            compact
          />
        ))}
      </div>
    </section>
  );
}
