import { NextResponse } from 'next/server';
import {
  articleToUrl,
  getIndexedNewsArticles,
  seedNewsArticleIndexFromFeeds,
} from '@/lib/news-article-index';

export const revalidate = 60;

// Production Apache redirects the bare domain to www. Keep sitemap URLs on
// the final host so Google does not have to reconcile two host variants.
const rawSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL
  || process.env.SITE_URL
  || 'https://www.betcheza.co.ke'
).replace(/\/$/, '');
const SITE_URL = rawSiteUrl.replace(/^https?:\/\/(?!www\.)/, match => `${match}www.`);
const SITE_NAME = 'Betcheza';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>`;

export async function GET() {
  try {
    // Refresh from the public feeds when Google fetches this endpoint. The
    // persisted index also retains stories discovered while serving match
    // pages, so a temporarily unavailable feed does not empty the sitemap.
    await Promise.race([
      seedNewsArticleIndexFromFeeds(),
      new Promise<void>(resolve => setTimeout(resolve, FETCH_TIMEOUT_MS)),
    ]);

    const cutoff = Date.now() - TWO_DAYS_MS;
    const articles = getIndexedNewsArticles()
      .filter(article => {
        const published = Date.parse(article.published || article.indexedAt);
        return Number.isFinite(published) && published >= cutoff && published <= Date.now() + 60 * 60 * 1000;
      })
      .slice(0, 1000);

    const urlEntries = articles.map(article => {
      const publicationDate = new Date(article.published || article.indexedAt).toISOString();
      return `  <url>
    <loc>${escapeXml(articleToUrl(article, SITE_URL))}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${publicationDate}</news:publication_date>
      <news:title>${escapeXml(article.headline)}</news:title>
    </news:news>
  </url>`;
    }).join('\n');

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
  } catch (error) {
    console.error('[news-sitemap] Error generating news sitemap:', error);
    return new NextResponse(emptyXml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'X-Robots-Tag': 'noindex',
      },
    });
  }
}