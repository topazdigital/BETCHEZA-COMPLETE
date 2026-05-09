import type { MetadataRoute } from 'next';
import { ALL_LEAGUES, ALL_SPORTS } from '@/lib/sports-data';

export const revalidate = 3600;

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.SITE_URL
    || 'https://betcheza.co.ke'
  ).replace(/\/$/, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`,                   lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${base}/matches`,            lastModified: now, changeFrequency: 'hourly',  priority: 0.95 },
    { url: `${base}/live`,               lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${base}/tipsters`,           lastModified: now, changeFrequency: 'daily',   priority: 0.85 },
    { url: `${base}/leaderboard`,        lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/strategy`,           lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/predictor`,          lastModified: now, changeFrequency: 'daily',   priority: 0.75 },
    { url: `${base}/leagues`,            lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${base}/feed`,               lastModified: now, changeFrequency: 'hourly',  priority: 0.7 },
    { url: `${base}/jackpots`,           lastModified: now, changeFrequency: 'daily',   priority: 0.65 },
    { url: `${base}/bookmakers`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.65 },
    { url: `${base}/sports`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/news`,               lastModified: now, changeFrequency: 'hourly',  priority: 0.6 },
    { url: `${base}/competitions`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.55 },
    { url: `${base}/players/compare`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${base}/results`,            lastModified: now, changeFrequency: 'daily',   priority: 0.5 },
    { url: `${base}/help`,               lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/become-tipster`,     lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/responsible-gambling`, lastModified: now, changeFrequency: 'monthly', priority: 0.35 },
    { url: `${base}/about`,              lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/contact`,            lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/faq`,                lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/privacy`,            lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${base}/terms`,              lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${base}/cookies`,            lastModified: now, changeFrequency: 'yearly',  priority: 0.15 },
  ];

  const sportEntries: MetadataRoute.Sitemap = ALL_SPORTS.map(s => ({
    url: `${base}/sports/${s.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: ['football', 'basketball', 'tennis', 'cricket'].includes(s.slug) ? 0.7 : 0.55,
  }));

  const tier1Leagues = ALL_LEAGUES.filter(l => l.tier === 1);
  const tier2Leagues = ALL_LEAGUES.filter(l => l.tier === 2);
  const otherLeagues = ALL_LEAGUES.filter(l => l.tier > 2);

  const leagueEntries: MetadataRoute.Sitemap = [
    ...tier1Leagues.map(l => ({
      url: `${base}/leagues/${l.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.75,
    })),
    ...tier2Leagues.map(l => ({
      url: `${base}/leagues/${l.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    ...otherLeagues.map(l => ({
      url: `${base}/leagues/${l.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.45,
    })),
  ];

  return [...staticEntries, ...sportEntries, ...leagueEntries];
}
