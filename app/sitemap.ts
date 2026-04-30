import type { MetadataRoute } from 'next';
import { ALL_LEAGUES, ALL_SPORTS } from '@/lib/sports-data';

export const revalidate = 3600;

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.SITE_URL
    || 'https://bettipspro.com'
  ).replace(/\/$/, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  // Static high-value pages — homepage, the main hubs and the legal pages.
  // We deliberately keep this list short and curated rather than reflecting
  // every internal route, because long-tail match / team URLs change daily
  // and shouldn't bloat the sitemap.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/matches`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/tipsters`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/leagues`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/sports`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/players/compare`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const sportEntries: MetadataRoute.Sitemap = ALL_SPORTS.map(s => ({
    url: `${base}/sports/${s.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  const leagueEntries: MetadataRoute.Sitemap = ALL_LEAGUES.map(l => ({
    url: `${base}/leagues/${l.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: l.tier === 1 ? 0.7 : 0.5,
  }));

  return [...staticEntries, ...sportEntries, ...leagueEntries];
}
