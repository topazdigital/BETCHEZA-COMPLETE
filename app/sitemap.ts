import type { MetadataRoute } from 'next';
import { ALL_LEAGUES, ALL_SPORTS } from '@/lib/sports-data';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { getPool } from '@/lib/db';
import { matchToSlug } from '@/lib/utils/match-url';

export const revalidate = 1800;

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

const TIPS_BOOKMAKERS = [
  'sportpesa', 'betika', 'odibets', 'betway', 'mozzartbet', '1xbet',
  'premiertabet', 'shabiki', 'elitebet', 'helabet', 'bangbet', '22bet',
  'msport', 'betin',
];

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

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
    { url: `${base}/competitions`,         lastModified: now, changeFrequency: 'daily',   priority: 0.88 },
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

  // Tipster profile pages — DB users + fake tipsters
  const tipsterSlugs = new Set<string>();
  let matchEntries: MetadataRoute.Sitemap = [];
  let competitionEntries: MetadataRoute.Sitemap = [];

  try {
    const pool = await getPool();
    if (pool) {
      // Tipster usernames
      const [userRows] = await pool.query<any[]>(
        'SELECT username FROM users WHERE role != "admin" ORDER BY id LIMIT 500'
      );
      for (const r of userRows) if (r.username) tipsterSlugs.add(r.username.toLowerCase());

      // Competition pages — active and upcoming
      try {
        const [compRows] = await pool.query<any[]>(`
          SELECT slug, status, updated_at, end_date
          FROM competitions
          WHERE status IN ('active', 'upcoming', 'completed')
          ORDER BY start_date DESC
          LIMIT 100
        `);
        for (const c of compRows) {
          if (!c.slug) continue;
          const isCompleted = c.status === 'completed';
          competitionEntries.push({
            url: `${base}/competitions/${c.slug}`,
            lastModified: c.updated_at ? new Date(c.updated_at) : now,
            changeFrequency: isCompleted ? 'monthly' : 'hourly',
            priority: isCompleted ? 0.55 : 0.80,
          });
        }
      } catch { /* competitions table may not exist — skip */ }

      // Match pages — upcoming (next 14 days) + recently finished (last 3 days)
      // These are the most valuable for SEO: predictions before, scores after.
      const sevenDaysAhead = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      try {
        const [matchRows] = await pool.query<any[]>(`
          SELECT
            match_id,
            home_team,
            away_team,
            kickoff_time,
            status,
            home_score,
            away_score
          FROM matches
          WHERE kickoff_time BETWEEN ? AND ?
          ORDER BY kickoff_time ASC
          LIMIT 500
        `, [threeDaysAgo.toISOString(), sevenDaysAhead.toISOString()]);

        for (const m of matchRows) {
          if (!m.match_id) continue;
          const isFinished = ['finished', 'ft', 'full-time', 'aet', 'pen'].includes(
            (m.status || '').toLowerCase()
          );
          matchEntries.push({
            url: `${base}/matches/${matchToSlug(m.match_id, m.home_team || '', m.away_team || '')}`,
            lastModified: isFinished ? new Date(m.kickoff_time) : now,
            changeFrequency: isFinished ? 'weekly' : 'hourly',
            priority: isFinished ? 0.70 : 0.82,
          });
        }
      } catch { /* matches table may not exist — skip */ }
    }
  } catch { /* no DB — skip */ }

  // Fake tipsters (community seed data)
  const fakeTipsters = getFakeTipsters();
  for (const t of fakeTipsters) {
    const slug = slugify(t.displayName) || t.username.toLowerCase();
    tipsterSlugs.add(slug);
  }
  const tipsterEntries: MetadataRoute.Sitemap = [...tipsterSlugs].map(slug => ({
    url: `${base}/tipsters/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.65,
  }));

  // Bookmaker-specific SEO tip pages (/tips/sportpesa, /tips/betika, etc.)
  const bookmakerTipEntries: MetadataRoute.Sitemap = TIPS_BOOKMAKERS.map(slug => ({
    url: `${base}/tips/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: ['sportpesa', 'betika', 'odibets'].includes(slug) ? 0.92 : 0.82,
  }));

  return [
    ...staticEntries,
    ...jackpotEntries,
    ...bookmakerTipEntries,
    ...sportEntries,
    ...leagueEntries,
    ...competitionEntries,
    ...tipsterEntries,
    ...matchEntries,
  ];
}
