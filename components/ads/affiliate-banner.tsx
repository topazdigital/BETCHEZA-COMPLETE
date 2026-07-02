'use client';

import Image from 'next/image';
import Link from 'next/link';

const AFFILIATE_URL = 'https://affiliate.betwinners365.com/redirect?referralCode=5241DF';

interface AffiliateBannerProps {
  variant?: 'leaderboard' | 'in-feed' | 'mobile';
  className?: string;
}

const BANNER_VARIANTS = {
  leaderboard: {
    src: '/banners/betwinners/BET970X250.png',
    srcAlt: '/banners/betwinners/BET970C250.png',
    width: 970,
    height: 250,
    label: 'BetWinners 100% Welcome Bonus',
    sizes: '(max-width: 768px) 728px, 970px',
  },
  'in-feed': {
    src: '/banners/betwinners/BET728X90.png',
    srcAlt: '/banners/betwinners/BET728C90.png',
    width: 728,
    height: 90,
    label: 'BetWinners 100% Welcome Bonus',
    sizes: '728px',
  },
  mobile: {
    src: '/banners/betwinners/BET320X100.png',
    srcAlt: '/banners/betwinners/BET320C100.png',
    width: 320,
    height: 100,
    label: 'BetWinners 100% Welcome Bonus',
    sizes: '320px',
  },
};

export function AffiliateBanner({ variant = 'in-feed', className = '' }: AffiliateBannerProps) {
  const meta = BANNER_VARIANTS[variant];

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      <p className="self-end text-[9px] font-medium uppercase tracking-widest text-muted-foreground/50 pr-0.5">
        Sponsored
      </p>
      <Link
        href={AFFILIATE_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block overflow-hidden rounded-lg transition-opacity hover:opacity-90"
        aria-label={meta.label}
      >
        <Image
          src={meta.src}
          alt={meta.label}
          width={meta.width}
          height={meta.height}
          sizes={meta.sizes}
          className="w-full h-auto"
          loading="lazy"
        />
      </Link>
    </div>
  );
}

export function BetWinnersLeaderboard({ className = '' }: { className?: string }) {
  return (
    <>
      <div className={`hidden lg:block ${className}`}>
        <AffiliateBanner variant="leaderboard" />
      </div>
      <div className={`hidden sm:block lg:hidden ${className}`}>
        <AffiliateBanner variant="in-feed" />
      </div>
      <div className={`block sm:hidden ${className}`}>
        <AffiliateBanner variant="mobile" />
      </div>
    </>
  );
}

export function BetWinnersInFeed({ className = '' }: { className?: string }) {
  return (
    <>
      <div className={`hidden sm:block ${className}`}>
        <AffiliateBanner variant="in-feed" />
      </div>
      <div className={`block sm:hidden ${className}`}>
        <AffiliateBanner variant="mobile" />
      </div>
    </>
  );
}
