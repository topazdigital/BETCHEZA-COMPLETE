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
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ken.1/news?limit=30', category: 'Kenya Premier League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=30', category: 'Premier League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.w.1/news?limit=20', category: 'Women’s Super League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/news?limit=20', category: 'La Liga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/news?limit=20', category: 'Champions League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50', category: 'Basketball' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/news?limit=20', category: 'ATP Tennis' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/news?limit=20', category: 'WTA Tennis' },
];

const NEWS_FEED_REFRESH_MS = 15 * 60 * 1000;
let newsFeedSeedInFlight: Promise<void> | null = null;
let lastNewsFeedSeedAt = 0;

/**
 * Refresh the index from public ESPN feeds. This is called by the sitemap
 * itself, so Google's normal sitemap fetch also discovers newly published
 * stories without an operator requesting each URL in Search Console.
 */
export async function seedNewsArticleIndexFromFeeds(): Promise<void> {
  if (newsFeedSeedInFlight) return newsFeedSeedInFlight;
  if (Date.now() - lastNewsFeedSeedAt < NEWS_FEED_REFRESH_MS) return;

  newsFeedSeedInFlight = (async () => {
    let queuedWrites: Promise<void> = Promise.resolve();
    await Promise.all(ESPN_FEEDS.map(async feed => {
      try {
        const response = await fetch(feed.url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'curl/8.0',
          },
          signal: AbortSignal.timeout(8_000),
          next: { revalidate: 900 },
        });
        if (!response.ok) return [];
        const data = await response.json() as { articles?: ESPNArticle[] };
        const articles = (data.articles || []).flatMap((article, index) => {
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
        if (articles.length > 0) {
          // Persist each feed as soon as it responds so the page can show
          // available stories without waiting for every slower league feed.
          queuedWrites = queuedWrites.then(() => upsertNewsArticles(articles));
          await queuedWrites;
        }
      } catch (error) {
        console.warn('[news-index] ESPN feed failed:', feed.url, error);
      }
    }));

    await queuedWrites;
  })();

  try {
    await newsFeedSeedInFlight;
    lastNewsFeedSeedAt = Date.now();
  } finally {
    newsFeedSeedInFlight = null;
  }
}