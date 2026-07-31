'use client';

import useSWR from 'swr';

export interface SiteSettingsData {
  siteName?: string;
  siteDescription?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  footerLogoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  socialLinks?: Array<{ platform: string; url: string; handle?: string; enabled?: boolean }>;
  cookieBannerEnabled?: boolean;
  cookieBannerMessage?: string;
  announcementEnabled?: boolean;
  announcementLabel?: string;
  announcementHeadline?: string;
  announcementSubtext?: string;
  announcementLink?: string;
  twoFactorEnabled?: boolean;
  twoFactorMethod?: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Shared hook for public site settings.
 * All components that call this share a single SWR cache entry → only 1 HTTP request
 * fires per page load, regardless of how many components consume it.
 */
export function useSiteSettings() {
  return useSWR<SiteSettingsData>('/api/site-settings', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
    refreshInterval: 0,
    revalidateOnReconnect: false,
  });
}
