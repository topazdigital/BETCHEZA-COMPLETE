import type { MetadataRoute } from 'next';
import { ALL_LEAGUES, ALL_SPORTS } from '@/lib/sports-data';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { getPool } from '@/lib/db';
import { matchToSlug } from '@/lib/utils/match-url';
import { getAllOutrightSlugs } from '@/lib/api/outright-discovery';
import { SPECIALS } from '@/lib/api/specials';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  'betin',
  'mozzartbet',
  'betway',
  '1xbet',
  'premiertabet',
  'shabiki',
  'elitebet',
  'bangbet',
  'msport',
  'bahatibet',
  'betlion',
  'sportybet',
];

const JACKPOT_TYPES_BY_BOOKMAKER: Record<string, string[]> = {
  sportpesa: ['mega-jackpot', 'midweek-jackpot'],
  betika: ['grand-jackpot', 'midweek-jackpot', 'daily-jackpot', 'laki-tatu'],
  odibets: ['jackpot-bonanza'],
  betin: ['grand-jackpot', 'midweek-jackpot'],
  mozzartbet: ['mega-jackpot', 'midweek-jackpot'],
  bahatibet: ['daily-jackpot'],
  betlion: ['super-jackpot'],
  sportybet: ['daily-jackpot'],
  msport: ['jackpot'],
  bangbet: ['jackpot'],
  shabiki: ['pool-jackpot'],
};

const TIPS_BOOKMAKERS = [
  'sportpesa', 'betika', 'odibets', 'betway', 'mozzartbet', '1xbet',
  'premiertabet', 'shabiki', 'elitebet', 'helabet', 'bangbet', '22bet',
  'msport', 'betin', 'bahatibet', 'betlion', 'wazabet', 'sportybet',
  'betika24', 'dafabet',
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
    { url: `${base}/specials`,             lastModified: now, changeFrequency: 'daily',   priority: 0.72 },
    { url: `${base}/betting-academy`,     lastModified: now, changeFrequency: 'monthly', priority: 0.78 },
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
    priority: ['sportpesa', 'betika', 'odibets'].includes(slug) ? 0.92 : 0.78,
  }));

  // Individual jackpot-type pages — highest priority for target keywords
  // e.g. /jackpots/sportpesa/mega-jackpot → "SportPesa Mega Jackpot Prediction Today 17 Games"
  const jackpotTypeEntries: MetadataRoute.Sitemap = Object.entries(JACKPOT_TYPES_BY_BOOKMAKER).flatMap(
    ([bkSlug, types]) => types.map(typeSlug => ({
      url: `${base}/jackpots/${bkSlug}/${typeSlug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: bkSlug === 'sportpesa' ? 0.97 : bkSlug === 'betika' || bkSlug === 'odibets' ? 0.93 : 0.88,
    }))
  );

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

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        for (const m of matchRows) {
          if (!m.match_id) continue;
          const isFinished = ['finished', 'ft', 'full-time', 'aet', 'pen', 'walkover', 'awarded'].includes(
            (m.status || '').toLowerCase()
          );
          // Recently-finished matches (last 24h) signal maximum freshness.
          // Use now as lastModified so Googlebot sees them as just-updated.
          const kickoff = m.kickoff_time ? new Date(m.kickoff_time) : null;
          const isRecentResult = isFinished && kickoff && kickoff > oneDayAgo;
          matchEntries.push({
            url: `${base}/matches/${matchToSlug(m.match_id, m.home_team || '', m.away_team || '')}`,
            lastModified: isRecentResult ? now : isFinished && kickoff
              ? new Date(kickoff.getTime() + 110 * 60 * 1000)  // kickoff + 110min
              : now,
            changeFrequency: isRecentResult
              ? ('hourly' as const)
              : isFinished
              ? ('weekly' as const)
              : ('hourly' as const),
            priority: isRecentResult ? 0.92 : isFinished ? 0.72 : 0.84,
          });
        }
      } catch { /* matches table may not exist — skip */ }
    }
  } catch { /* no DB — skip */ }

  // Supplement with live API matches (ESPN tennis, cricket, etc.) that may not
  // yet be persisted to the DB. This ensures every match page is discoverable
  // by crawlers as soon as it appears on the site — regardless of sport.
  try {
    const { getAllMatches } = await import('@/lib/api/unified-sports-api');
    const apiMatches = await getAllMatches();
    const seenUrls = new Set(matchEntries.map(e => e.url));
    for (const m of apiMatches) {
      const url = `${base}/matches/${matchToSlug(m.id, m.homeTeam?.name ?? '', m.awayTeam?.name ?? '')}`;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const status = (m.status || '').toLowerCase();
      const isLive = ['live', 'inprogress', 'in_progress', 'halftime', 'ht', 'extra_time', 'penalties', 'break'].includes(status);
      const isFinished = ['finished', 'ft', 'full-time', 'aet', 'pen', 'walkover', 'awarded'].includes(status);
      const kickoff = m.kickoffTime ? new Date(m.kickoffTime) : now;
      matchEntries.push({
        url,
        lastModified: isLive ? now : isFinished ? new Date(kickoff.getTime() + 110 * 60 * 1000) : now,
        changeFrequency: isLive ? ('always' as const) : isFinished ? ('weekly' as const) : ('hourly' as const),
        priority: isLive ? 0.95 : isFinished ? 0.72 : 0.84,
      });
    }
  } catch { /* API unavailable — skip */ }

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

  // Outright market SEO pages — one URL per live market (e.g. /specials/soccer-epl-winner)
  // Uses the hardcoded slug list so these pages are indexed even before first API fetch.
  const outrightSlugs = getAllOutrightSlugs();
  const staticSpecialSlugs = SPECIALS.map(s => s.slug);
  const allSpecialSlugs = Array.from(new Set([...outrightSlugs, ...staticSpecialSlugs]));
  const outrightEntries: MetadataRoute.Sitemap = allSpecialSlugs.map(slug => ({
    url: `${base}/specials/${slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.78,
  }));

  return [
    ...staticEntries,
    ...jackpotTypeEntries,
    ...jackpotEntries,
    ...bookmakerTipEntries,
    ...sportEntries,
    ...leagueEntries,
    ...outrightEntries,
    ...competitionEntries,
    ...tipsterEntries,
    ...matchEntries,
  ];
}
