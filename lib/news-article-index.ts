import fs from 'fs';
import path from 'path';

export interface IndexedNewsArticle {
  id: string;
  headline: string;
  description?: string;
  image?: string;
  published?: string;
  sourceUrl?: string;
  source?: string;
  indexedAt: string;
}

const STORE_PATH = path.join(process.cwd(), '.local', 'data', 'news-article-index.json');
const MAX_ARTICLES = 5000;
const INDEX_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;

type StoredIndex = { articles: IndexedNewsArticle[] };

function readIndex(): IndexedNewsArticle[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as StoredIndex;
    return Array.isArray(parsed.articles) ? parsed.articles : [];
  } catch {
    return [];
  }
}

function writeIndex(articles: IndexedNewsArticle[]): void {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    const temporaryPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({ articles }, null, 2), 'utf8');
    fs.renameSync(temporaryPath, STORE_PATH);
  } catch (error) {
    console.warn('[news-index] Could not persist article index:', error);
  }
}

function articleKey(article: Pick<IndexedNewsArticle, 'id' | 'sourceUrl' | 'headline'>): string {
  return article.sourceUrl || `${article.id}:${article.headline}`;
}

function isUsableArticle(article: Partial<IndexedNewsArticle>): article is Omit<IndexedNewsArticle, 'indexedAt'> & { indexedAt?: string } {
  return typeof article.headline === 'string' && article.headline.trim().length > 0;
}

export function articleToUrl(
  article: Pick<IndexedNewsArticle, 'headline' | 'description' | 'image' | 'published' | 'sourceUrl' | 'source'>,
  baseUrl: string,
): string {
  const query = new URLSearchParams();
  const fields: Array<[string, string | undefined]> = [
    ['headline', article.headline],
    ['description', article.description],
    ['image', article.image],
    ['published', article.published],
    ['source_url', article.sourceUrl],
    ['source', article.source],
  ];
  for (const [key, value] of fields) {
    if (value) query.set(key, value);
  }
  return `${baseUrl.replace(/\/$/, '')}/news/article?${query.toString()}`;
}

export async function upsertNewsArticles(
  incoming: Array<Omit<IndexedNewsArticle, 'indexedAt'>>,
): Promise<void> {
  const now = new Date().toISOString();
  const byKey = new Map<string, IndexedNewsArticle>();

  for (const article of readIndex()) {
    if (isUsableArticle(article)) byKey.set(articleKey(article), article);
  }
  for (const article of incoming) {
    if (!isUsableArticle(article)) continue;
    const key = articleKey(article);
    const existing = byKey.get(key);
    byKey.set(key, {
      ...existing,
      ...article,
      id: String(article.id || existing?.id || key).slice(0, 160),
      headline: article.headline.trim(),
      indexedAt: existing?.indexedAt || now,
    });
  }

  const cutoff = Date.now() - INDEX_RETENTION_MS;
  const articles = [...byKey.values()]
    .filter(article => {
      const timestamp = Date.parse(article.published || article.indexedAt);
      return !Number.isFinite(timestamp) || timestamp >= cutoff;
    })
    .sort((a, b) => Date.parse(b.published || b.indexedAt) - Date.parse(a.published || a.indexedAt))
    .slice(0, MAX_ARTICLES);

  writeIndex(articles);
}

export function getIndexedNewsArticles(): IndexedNewsArticle[] {
  return readIndex().sort(
    (a, b) => Date.parse(b.published || b.indexedAt) - Date.parse(a.published || a.indexedAt),
  );
}

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
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/news?limit=100', category: 'Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50', category: 'Basketball' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/news?limit=50', category: 'Tennis' },
];

/**
 * Refresh the index from public ESPN feeds. This is called by the sitemap
 * itself, so Google's normal sitemap fetch also discovers newly published
 * stories without an operator requesting each URL in Search Console.
 */
export async function seedNewsArticleIndexFromFeeds(): Promise<void> {
  const results = await Promise.all(ESPN_FEEDS.map(async feed => {
    try {
      const response = await fetch(feed.url, {
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store',
      });
      if (!response.ok) return [];
      const data = await response.json() as { articles?: ESPNArticle[] };
      return (data.articles || []).flatMap((article, index) => {
        if (!article.headline) return [];
        return [{
          id: String(article.id || `${feed.category}-${index}-${article.headline}`).slice(0, 160),
          headline: article.headline,
          description: article.description || '',
          image: article.images?.[0]?.url || '',
          published: article.published || new Date().toISOString(),
          sourceUrl: article.links?.web?.href || '',
          source: 'ESPN',
        }];
      });
    } catch (error) {
      console.warn('[news-index] ESPN feed failed:', feed.url, error);
      return [];
    }
  }));

  await upsertNewsArticles(results.flat());
}