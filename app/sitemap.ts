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

const JACKPOT_BOOKMAKERS = [
  'sportpesa',
  'betika',
  'odibets',
  'betway',
  'mozzartbet',
  '1xbet',
  'premiertabet',
  'shabiki',
  'elitebet',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`,                     lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${base}/matches`,              lastModified: now, changeFrequency: 'hourly',  priority: 0.95 },
    { url: `${base}/live`,                 lastModified: now, changeFrequency: 'always',  priority: 0.92 },
    { url: `${base}/jackpots`,             lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/jackpots/results`,     lastModified: now, changeFrequency: 'daily',   priority: 0.85 },
    { url: `${base}/tipsters`,             lastModified: now, changeFrequency: 'daily',   priority: 0.85 },
    { url: `${base}/leaderboard`,          lastModified: now, changeFrequency: 'daily',   priority: 0.82 },
    { url: `${base}/predictor`,            lastModified: now, changeFrequency: 'daily',   priority: 0.80 },
    { url: `${base}/strategy`,             lastModified: now, changeFrequency: 'daily',   priority: 0.78 },
    { url: `${base}/feed`,                 lastModified: now, changeFrequency: 'hourly',  priority: 0.75 },
    { url: `${base}/results`,              lastModified: now, changeFrequency: 'daily',   priority: 0.72 },
    { url: `${base}/leagues`,              lastModified: now, changeFrequency: 'daily',   priority: 0.70 },
    { url: `${base}/bookmakers`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.68 },
    { url: `${base}/competitions`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.65 },
    { url: `${base}/sports`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.60 },
    { url: `${base}/news`,                 lastModified: now, changeFrequency: 'hourly',  priority: 0.60 },
    { url: `${base}/predictor/h2h`,        lastModified: now, changeFrequency: 'daily',   priority: 0.58 },
    { url: `${base}/players/compare`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.52 },
    { url: `${base}/challenges`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.50 },
    { url: `${base}/help`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.42 },
    { url: `${base}/faq`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.40 },
    { url: `${base}/become-tipster`,       lastModified: now, changeFrequency: 'monthly', priority: 0.40 },
    { url: `${base}/responsible-gambling`, lastModified: now, changeFrequency: 'monthly', priority: 0.35 },
    { url: `${base}/about`,                lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${base}/contact`,              lastModified: now, changeFrequency: 'monthly', priority: 0.30 },
    { url: `${base}/privacy`,              lastModified: now, changeFrequency: 'yearly',  priority: 0.20 },
    { url: `${base}/terms`,                lastModified: now, changeFrequency: 'yearly',  priority: 0.20 },
    { url: `${base}/cookies`,              lastModified: now, changeFrequency: 'yearly',  priority: 0.15 },
  ];

  const jackpotEntries: MetadataRoute.Sitemap = JACKPOT_BOOKMAKERS.map(slug => ({
    url: `${base}/jackpots/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: ['sportpesa', 'betika', 'odibets'].includes(slug) ? 0.88 : 0.75,
  }));

  const sportEntries: MetadataRoute.Sitemap = ALL_SPORTS.map(s => ({
    url: `${base}/sports/${s.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: ['football', 'basketball', 'tennis', 'cricket'].includes(s.slug) ? 0.70 : 0.52,
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
      priority: 0.60,
    })),
    ...otherLeagues.map(l => ({
      url: `${base}/leagues/${l.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.45,
    })),
  ];

  return [...staticEntries, ...jackpotEntries, ...sportEntries, ...leagueEntries];
}
