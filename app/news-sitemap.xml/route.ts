import { NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { matchToSlug } from '@/lib/utils/match-url';

export const revalidate = 60; // Regenerate every 60 seconds

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
const SITE_NAME = 'Betcheza';

// Google News requires articles published within the last 2 days
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildHeadline(match: {
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string;
  league?: { name?: string };
}): string {
  const home = match.homeTeam?.name ?? '';
  const away = match.awayTeam?.name ?? '';
  const league = match.league?.name ?? '';
  const isFinished = match.status === 'finished';
  const isLive = ['live', 'halftime', 'in_progress', 'inprogress'].includes(match.status ?? '');

  if (isFinished) {
    return `${home} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${away} Full Time Result${league ? ` | ${league}` : ''}`;
  }
  if (isLive) {
    return `LIVE: ${home} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${away}${league ? ` | ${league}` : ''}`;
  }
  return `${home} vs ${away} Predictions & Tips${league ? ` | ${league}` : ''}`;
}

export async function GET() {
  try {
    const now = Date.now();
    const cutoff = now - TWO_DAYS_MS;

    const allMatches = await getAllMatches();

    // Include: live matches + matches that finished/started within last 48h
    const newsMatches = allMatches.filter(m => {
      if (!m.homeTeam?.name || !m.awayTeam?.name) return false;
      const kickoff = m.kickoffTime ? new Date(m.kickoffTime).getTime() : 0;
      const isLive = ['live', 'halftime', 'in_progress', 'inprogress'].includes(m.status ?? '');
      const isFinished = m.status === 'finished';
      const isRecent = kickoff >= cutoff && kickoff <= now + 2 * 60 * 60 * 1000; // up to 2h in future
      return (isLive || isFinished) && isRecent;
    });

    // Also include any scheduled matches with kickoff in last 2 days (for pre-match tips pages)
    const scheduledRecent = allMatches.filter(m => {
      if (!m.homeTeam?.name || !m.awayTeam?.name) return false;
      if (m.status !== 'scheduled') return false;
      const kickoff = m.kickoffTime ? new Date(m.kickoffTime).getTime() : 0;
      return kickoff >= cutoff && kickoff <= now + 6 * 60 * 60 * 1000; // kickoff within next 6h
    });

    const combined = [...newsMatches, ...scheduledRecent];

    // De-duplicate by match ID
    const seen = new Set<string>();
    const unique = combined.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    const urlEntries = unique
      .slice(0, 1000) // Google News limit
      .map(m => {
        const slug = matchToSlug(m.id, m.homeTeam?.name ?? '', m.awayTeam?.name ?? '');
        const url = `${SITE_URL}/matches/${slug}`;
        const pubDate = m.kickoffTime
          ? new Date(m.kickoffTime).toISOString()
          : new Date().toISOString();
        const headline = buildHeadline(m);

        return `  <url>
    <loc>${escapeXml(url)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(headline)}</news:title>
    </news:news>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlEntries}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    console.error('[news-sitemap] Error generating news sitemap:', err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
    );
  }
}
