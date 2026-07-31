import { NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { matchToSlug } from '@/lib/utils/match-url';

export const revalidate = 60;

// Ensure www prefix so sitemap URLs match the canonical domain Apache redirects to.
const _rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.betcheza.co.ke').replace(/\/$/, '');
const SITE_URL = _rawSiteUrl.replace(/^https?:\/\/(?!www\.)/, m => m + 'www.');
const SITE_NAME = 'Betcheza';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

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
  const s = (match.status ?? '').toLowerCase();
  const isFinished = ['finished', 'ft', 'full-time', 'aet', 'pen'].includes(s);
  const isLive = ['live', 'halftime', 'in_progress', 'inprogress', 'ht'].includes(s);

  if (isFinished) {
    return `${home} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${away} Full Time Result${league ? ` | ${league}` : ''}`;
  }
  if (isLive) {
    return `LIVE: ${home} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${away}${league ? ` | ${league}` : ''}`;
  }
  return `${home} vs ${away} Predictions & Tips${league ? ` | ${league}` : ''}`;
}

const EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>`;

export async function GET() {
  try {
    const now = Date.now();
    const cutoff = now - TWO_DAYS_MS;

    // Race against a hard timeout so Google never gets a hanging response
    const allMatches = await Promise.race([
      getAllMatches(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS)
      ),
    ]);

    const statusPriority = (status?: string): number => {
      const s = (status ?? '').toLowerCase();
      if (['live', 'halftime', 'in_progress', 'inprogress', 'ht'].includes(s)) return 0;
      if (['finished', 'ft', 'full-time', 'aet', 'pen'].includes(s)) return 1;
      return 2;
    };

    // Live + finished within 48h
    const newsMatches = allMatches.filter(m => {
      if (!m.homeTeam?.name || !m.awayTeam?.name) return false;
      const kickoff = m.kickoffTime ? new Date(m.kickoffTime).getTime() : 0;
      const s = (m.status ?? '').toLowerCase();
      const isLive = ['live', 'halftime', 'in_progress', 'inprogress', 'ht'].includes(s);
      const isFinished = ['finished', 'ft', 'full-time', 'aet', 'pen'].includes(s);
      const isRecent = kickoff >= cutoff && kickoff <= now + 2 * 60 * 60 * 1000;
      return (isLive || isFinished) && isRecent;
    });

    // Scheduled with kickoff in next 6h (pre-match tips pages)
    const scheduledSoon = allMatches.filter(m => {
      if (!m.homeTeam?.name || !m.awayTeam?.name) return false;
      if ((m.status ?? '').toLowerCase() !== 'scheduled') return false;
      const kickoff = m.kickoffTime ? new Date(m.kickoffTime).getTime() : 0;
      return kickoff >= cutoff && kickoff <= now + 6 * 60 * 60 * 1000;
    });

    const combined = [...newsMatches, ...scheduledSoon];

    // De-duplicate by match ID
    const seen = new Set<string>();
    const unique = combined.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    // Sort: live first, then finished, then scheduled — within each group newest kickoff first
    unique.sort((a, b) => {
      const pa = statusPriority(a.status);
      const pb = statusPriority(b.status);
      if (pa !== pb) return pa - pb;
      const ka = a.kickoffTime ? new Date(a.kickoffTime).getTime() : 0;
      const kb = b.kickoffTime ? new Date(b.kickoffTime).getTime() : 0;
      return kb - ka;
    });

    const urlEntries = unique
      .slice(0, 1000)
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
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (err) {
    console.error('[news-sitemap] Error generating news sitemap:', err);
    return new NextResponse(EMPTY_XML, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'X-Robots-Tag': 'noindex',
      },
    });
  }
}
