import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

interface ESPNArticle {
  id?: string | number;
  headline?: string;
  description?: string;
  published?: string;
  images?: Array<{ url?: string }>;
  links?: { web?: { href?: string } };
  categories?: Array<{ description?: string }>;
}

const ESPN_FEEDS = [
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/news?limit=20', cat: 'Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=10', cat: 'Basketball' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/news?limit=10', cat: 'Tennis' },
];

export async function GET() {
  const out: Array<{
    id: string; headline: string; description: string; image: string | null;
    published: string; source: string; source_url: string; category: string;
  }> = [];

  await Promise.all(ESPN_FEEDS.map(async (feed) => {
    try {
      const r = await fetch(feed.url, { next: { revalidate: 600 } });
      if (!r.ok) return;
      const data = (await r.json()) as { articles?: ESPNArticle[] };
      for (const a of data.articles || []) {
        if (!a.headline) continue;
        out.push({
          id: String(a.id || `${feed.cat}-${a.headline}`).slice(0, 64),
          headline: a.headline,
          description: a.description || '',
          image: a.images?.[0]?.url || null,
          published: a.published || new Date().toISOString(),
          source: 'ESPN',
          source_url: a.links?.web?.href || '',
          category: a.categories?.[0]?.description || feed.cat,
        });
      }
    } catch (e) {
      console.warn('[admin/news] feed failed', feed.url, e);
    }
  }));

  out.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
  return NextResponse.json({ articles: out.slice(0, 50) });
}
