'use client';

import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Banner } from '@/lib/banner-store';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const GRADIENT_MAP: Record<string, string> = {
  'from-amber-500 to-orange-600': 'from-amber-500 to-orange-600',
  'from-blue-600 to-indigo-700': 'from-blue-600 to-indigo-700',
  'from-emerald-500 to-teal-600': 'from-emerald-500 to-teal-600',
  'from-purple-600 to-pink-600': 'from-purple-600 to-pink-600',
  'from-red-500 to-rose-600': 'from-red-500 to-rose-600',
  'from-cyan-500 to-blue-600': 'from-cyan-500 to-blue-600',
  'from-lime-500 to-green-600': 'from-lime-500 to-green-600',
  'from-fuchsia-500 to-purple-700': 'from-fuchsia-500 to-purple-700',
};

function BannerCard({ banner, compact = false }: { banner: Banner; compact?: boolean }) {
  const hasImage = !!banner.imageUrl;
  const gradientClass = GRADIENT_MAP[banner.gradient] ?? 'from-blue-600 to-indigo-700';

  return (
    <Link
      href={banner.linkUrl}
      className={cn(
        'group relative block overflow-hidden rounded-xl border border-white/10 shadow-sm',
        'transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md',
        compact ? 'w-52 sm:w-56 shrink-0' : 'w-full',
      )}
      aria-label={banner.title}
    >
      {/* Background: image or gradient */}
      <div className={cn('relative', compact ? 'h-28' : 'h-32')}>
        {hasImage ? (
          <>
            <Image
              src={banner.imageUrl}
              alt={banner.title}
              fill
              className="object-cover"
              loading="lazy"
              sizes={compact ? '224px' : '288px'}
            />
            <div className="absolute inset-0 bg-black/45" />
          </>
        ) : (
          <div className={cn('absolute inset-0 bg-gradient-to-br', gradientClass)}>
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_white_0%,_transparent_60%)]" />
          </div>
        )}

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-0.5">
              {banner.section === 'competitions' ? '🏆 Competition'
                : banner.section === 'daily-tips' ? '📊 Daily Tips'
                : '⭐ Featured'}
            </p>
            <h3 className={cn(
              'font-bold text-white leading-tight',
              compact ? 'text-[13px]' : 'text-sm',
            )}>
              {banner.title}
            </h3>
            {!compact && (
              <p className="mt-0.5 text-[11px] text-white/80 line-clamp-2 leading-snug">
                {banner.description}
              </p>
            )}
          </div>
          <div>
            <span className={cn(
              'inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm',
              'border border-white/30 text-white font-semibold',
              'group-hover:bg-white/30 transition-colors duration-150',
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
            )}>
              {banner.ctaText} →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function BannerSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn(
      'animate-pulse rounded-xl bg-muted/60',
      compact ? 'h-28 w-52 sm:w-56 shrink-0' : 'h-32 w-full',
    )} />
  );
}

export function SidebarBanners() {
  const { data, isLoading } = useSWR<Banner[]>('/api/banners', fetcher, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const banners = (data ?? []).filter(
    (b) => b.position === 'sidebar' || b.position === 'both',
  );

  if (isLoading) {
    return (
      <div className="space-y-2 px-1">
        <BannerSkeleton />
        <BannerSkeleton />
      </div>
    );
  }

  if (!banners.length) return null;

  return (
    <div className="space-y-2 px-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-0.5">
        Promotions
      </p>
      {banners.map((b) => (
        <BannerCard key={b.id} banner={b} />
      ))}
    </div>
  );
}

export function MobileBannerStrip() {
  const { data, isLoading } = useSWR<Banner[]>('/api/banners', fetcher, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const banners = (data ?? []).filter(
    (b) => b.position === 'mobile' || b.position === 'both',
  );

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none">
        <BannerSkeleton compact />
        <BannerSkeleton compact />
      </div>
    );
  }

  if (!banners.length) return null;

  return (
    <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
      <div className="flex gap-3 pb-1" style={{ width: 'max-content' }}>
        {banners.map((b) => (
          <BannerCard key={b.id} banner={b} compact />
        ))}
      </div>
    </div>
  );
}
