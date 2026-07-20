'use client';

import Image from 'next/image';
import Link from 'next/link';

const AFFILIATE_URL = 'https://affiliate.betwinners365.com/redirect?referralCode=5241DF';

export const BETWINNERS_BANNERS = [
  { id: 'leaderboard-970', label: 'Leaderboard 970×250', src: '/banners/betwinners/BET970X250.png', width: 970, height: 250, placement: 'Desktop header / above sections' },
  { id: 'leaderboard-970-alt', label: 'Leaderboard 970×250 (alt)', src: '/banners/betwinners/BET970C250.png', width: 970, height: 250, placement: 'Desktop header / above sections (variant)' },
  { id: 'banner-728', label: 'Banner 728×90', src: '/banners/betwinners/BET728X90.png', width: 728, height: 90, placement: 'Tablet in-feed' },
  { id: 'banner-728-alt', label: 'Banner 728×90 (alt)', src: '/banners/betwinners/BET728C90.png', width: 728, height: 90, placement: 'Tablet in-feed (variant)' },
  { id: 'rectangle-300', label: 'Rectangle 300×250', src: '/banners/betwinners/BET300X250.png', width: 300, height: 250, placement: 'Mobile full-width & sidebar' },
  { id: 'rectangle-300-alt', label: 'Rectangle 300×250 (alt)', src: '/banners/betwinners/BET300C250.png', width: 300, height: 250, placement: 'Mobile full-width & sidebar (variant)' },
  { id: 'mobile-320', label: 'Mobile 320×100', src: '/banners/betwinners/BET320X100.png', width: 320, height: 100, placement: 'Small mobile strip' },
  { id: 'mobile-320-alt', label: 'Mobile 320×100 (alt)', src: '/banners/betwinners/BET320C100.png', width: 320, height: 100, placement: 'Small mobile strip (variant)' },
];

export const AFFILIATE_LINK = AFFILIATE_URL;

interface AffiliateBannerProps {
  variant?: 'leaderboard' | 'in-feed' | 'mobile';
  className?: string;
}

/**
 * Responsive BetWinners affiliate banner.
 *
 * Mobile  (< 640px)  → 300×250 rectangle — large, readable, fills the width.
 * Tablet  (640–1024) → 728×90 banner — standard leaderboard, full width.
 * Desktop (> 1024px) → 970×250 large leaderboard — full width.
 *
 * All banners are rendered at `width: 100%` within their slot so they scale
 * naturally with the container width rather than being tiny fixed-pixel images.
 */
function ResponsiveBanner({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      {/* Mobile: 300×250 rectangle — much more readable than 320×100 */}
      <div className="block sm:hidden">
        <Link
          href={AFFILIATE_URL}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block overflow-hidden rounded-xl transition-opacity hover:opacity-90 shadow-sm"
          aria-label="BetWinners 100% Welcome Bonus"
        >
          <Image
            src="/banners/betwinners/BET300X250.png"
            alt="BetWinners 100% Welcome Bonus — Fast Withdrawals"
            width={300}
            height={250}
            sizes="(max-width: 640px) calc(100vw - 32px)"
            className="w-full h-auto rounded-xl"
            loading="eager"
          />
        </Link>
      </div>

      {/* Tablet: 728×90 standard banner */}
      <div className="hidden sm:block lg:hidden">
        <Link
          href={AFFILIATE_URL}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block overflow-hidden rounded-lg transition-opacity hover:opacity-90"
          aria-label="BetWinners 100% Welcome Bonus"
        >
          <Image
            src="/banners/betwinners/BET728X90.png"
            alt="BetWinners 100% Welcome Bonus — Fast Withdrawals"
            width={728}
            height={90}
            sizes="(max-width: 1024px) calc(100vw - 48px)"
            className="w-full h-auto rounded-lg"
            loading="lazy"
          />
        </Link>
      </div>

      {/* Desktop: 970×250 leaderboard */}
      <div className="hidden lg:block">
        <Link
          href={AFFILIATE_URL}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block overflow-hidden rounded-xl transition-opacity hover:opacity-90"
          aria-label="BetWinners 100% Welcome Bonus"
        >
          <Image
            src="/banners/betwinners/BET970X250.png"
            alt="BetWinners 100% Welcome Bonus — Fast Withdrawals"
            width={970}
            height={250}
            sizes="(min-width: 1024px) calc(100vw - 600px)"
            className="w-full h-auto rounded-xl"
            loading="eager"
            priority
          />
        </Link>
      </div>
    </div>
  );
}

/** Sidebar 300×250 — shown in right/left sidebars on desktop */
function SidebarBanner({ className = '' }: { className?: string }) {
  return (
    <Link
      href={AFFILIATE_URL}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`block overflow-hidden rounded-xl transition-opacity hover:opacity-90 shadow-sm ${className}`}
      aria-label="BetWinners 100% Welcome Bonus"
    >
      <Image
        src="/banners/betwinners/BET300X250.png"
        alt="BetWinners 100% Welcome Bonus — Fast Withdrawals"
        width={300}
        height={250}
        sizes="300px"
        className="w-full h-auto rounded-xl"
        loading="lazy"
      />
    </Link>
  );
}

function Sponsored({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <p className="self-end text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40 pr-0.5">
        Sponsored
      </p>
      {children}
    </div>
  );
}

/** Full-width responsive banner for main content feed (home, matches, leaderboard) */
export function BetWinnersInFeed({ className = '' }: { className?: string }) {
  return (
    <Sponsored>
      <ResponsiveBanner className={className} />
    </Sponsored>
  );
}

/** Same as BetWinnersInFeed — leaderboard-style between-sections placement */
export function BetWinnersLeaderboard({ className = '' }: { className?: string }) {
  return (
    <Sponsored>
      <ResponsiveBanner className={className} />
    </Sponsored>
  );
}

/** 300×250 for sidebars */
export function BetWinnersSidebar({ className = '' }: { className?: string }) {
  return (
    <Sponsored>
      <SidebarBanner className={className} />
    </Sponsored>
  );
}

/** Generic export for any custom placement */
export function AffiliateBanner({ variant = 'in-feed', className = '' }: AffiliateBannerProps) {
  if (variant === 'mobile') {
    return (
      <Sponsored>
        <SidebarBanner className={className} />
      </Sponsored>
    );
  }
  return (
    <Sponsored>
      <ResponsiveBanner className={className} />
    </Sponsored>
  );
}
