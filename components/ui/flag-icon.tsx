'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { countryCodeToFlag } from '@/lib/country-flags';

// flagcdn.com only supports specific widths: 20, 40, 80, 160, 320, 640, 1280, 2560.
// `cdnW` MUST be one of those values, otherwise the request returns 404 and the
// flag silently fails to render.
const SIZE_MAP = {
  xs: { w: 14, h: 10, cdnW: 40, twW: 'w-3.5', twH: 'h-2.5' },
  sm: { w: 18, h: 13, cdnW: 40, twW: 'w-[18px]', twH: 'h-[13px]' },
  md: { w: 24, h: 18, cdnW: 80, twW: 'w-6', twH: 'h-[18px]' },
  lg: { w: 32, h: 24, cdnW: 80, twW: 'w-8', twH: 'h-6' },
  xl: { w: 48, h: 36, cdnW: 160, twW: 'w-12', twH: 'h-9' },
};

const SUBDIVISION_FLAGS: Record<string, string> = {
  'GB-ENG': 'https://flagcdn.com/w40/gb-eng.png',
  'GB-SCT': 'https://flagcdn.com/w40/gb-sct.png',
  'GB-WLS': 'https://flagcdn.com/w40/gb-wls.png',
  'GB-NIR': 'https://flagcdn.com/w40/gb-nir.png',
};

const SUBDIVISION_FLAGS_HD: Record<string, string> = {
  'GB-ENG': 'https://flagcdn.com/w80/gb-eng.png',
  'GB-SCT': 'https://flagcdn.com/w80/gb-sct.png',
  'GB-WLS': 'https://flagcdn.com/w80/gb-wls.png',
  'GB-NIR': 'https://flagcdn.com/w80/gb-nir.png',
};

const SPECIAL_EMOJI: Record<string, string> = {
  EU: '🇪🇺',
  WO: '🌍',
  AF: '🌍',
  SA: '🌎',
  NA: '🌎',
  AS: '🌏',
  SH: '🌏',
};

export interface FlagIconProps {
  countryCode?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  alt?: string;
  title?: string;
  rounded?: boolean;
}

export function FlagIcon({
  countryCode,
  size = 'md',
  className,
  alt,
  title,
  rounded = true,
}: FlagIconProps) {
  const code = (countryCode || '').toString().trim();
  const dim = SIZE_MAP[size];
  const upper = code.toUpperCase();

  // Handle special continent / EU codes via emoji span (no proper flag image exists)
  if (SPECIAL_EMOJI[upper]) {
    return (
      <span
        role="img"
        aria-label={alt || upper}
        title={title || alt || upper}
        className={cn(
          'inline-flex items-center justify-center leading-none',
          dim.twW,
          dim.twH,
          className
        )}
        style={{ fontSize: dim.h * 1.2 }}
      >
        {SPECIAL_EMOJI[upper]}
      </span>
    );
  }

  // Subdivision flags (England, Scotland, Wales, NI)
  const subdivision = dim.cdnW >= 80 ? SUBDIVISION_FLAGS_HD[upper] : SUBDIVISION_FLAGS[upper];
  if (subdivision) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={subdivision}
        alt={alt || upper}
        title={title || alt || upper}
        width={dim.w}
        height={dim.h}
        loading="lazy"
        className={cn(
          'inline-block object-cover shadow-sm',
          rounded && 'rounded-[2px]',
          dim.twW,
          dim.twH,
          className
        )}
      />
    );
  }

  // Standard ISO-2 country code
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    const lower = upper.toLowerCase();
    const src = `https://flagcdn.com/w${dim.cdnW}/${lower}.png`;
    // Use a plain <img> tag here instead of next/image to bypass the remote
    // image allow-list (Next.js still validates the hostname for some loader
    // setups even with unoptimized=true). flagcdn.com is a static CDN, so a
    // plain <img> renders reliably across all environments.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || upper}
        title={title || alt || upper}
        width={dim.w}
        height={dim.h}
        loading="lazy"
        className={cn(
          'inline-block object-cover shadow-sm',
          rounded && 'rounded-[2px]',
          dim.twW,
          dim.twH,
          className
        )}
      />
    );
  }

  // Final fallback: emoji from existing helper
  return (
    <span
      role="img"
      aria-label={alt || upper || 'flag'}
      title={title || alt || upper}
      className={cn(
        'inline-flex items-center justify-center leading-none',
        dim.twW,
        dim.twH,
        className
      )}
      style={{ fontSize: dim.h * 1.2 }}
    >
      {countryCodeToFlag(upper)}
    </span>
  );
}

export function flagSrcForCode(countryCode?: string | null, width = 40): string | null {
  if (!countryCode) return null;
  const upper = countryCode.toString().trim().toUpperCase();
  if (SUBDIVISION_FLAGS_HD[upper]) {
    return width >= 80 ? SUBDIVISION_FLAGS_HD[upper] : SUBDIVISION_FLAGS[upper];
  }
  if (upper.length !== 2 || !/^[A-Z]{2}$/.test(upper)) return null;
  return `https://flagcdn.com/w${width}/${upper.toLowerCase()}.png`;
}
