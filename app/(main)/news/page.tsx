import Link from 'next/link';
import {
  articleToUrl,
  getIndexedNewsArticles,
  seedNewsArticleIndexFromFeeds,
  type IndexedNewsArticle,
} from '@/lib/news-article-index';

export const dynamic = 'force-dynamic';

const NEWS_LIMIT = 24;

async function loadNewsArticles(): Promise<IndexedNewsArticle[]> {
  const cachedArticles = getIndexedNewsArticles();
  if (cachedArticles.length > 0) {
    void seedNewsArticleIndexFromFeeds().catch(error => {
      console.error('[news] Could not refresh sports news:', error);
    });
    return cachedArticles.slice(0, NEWS_LIMIT);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      seedNewsArticleIndexFromFeeds(),
      new Promise<void>(resolve => {
        timeout = setTimeout(resolve, 2500);
      }),
    ]);
  } catch (error) {
    console.error('[news] Could not refresh sports news:', error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  return getIndexedNewsArticles().slice(0, NEWS_LIMIT);
}

function formatPublishedDate(value?: string): string {
  if (!value) return 'Recently published';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recently published';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeZone: 'Africa/Nairobi',
  }).format(date);
}

export default async function NewsPage() {
  const articles = await loadNewsArticles();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
          Sports news and analysis
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Latest Sports News in Kenya
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Follow football headlines, match previews, transfers and updates from
          Kenyan and international sports. Browse the latest stories, then
          explore today’s fixtures and predictions.
        </p>
        <nav aria-label="Related sports pages" className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/sports/football" className="font-medium text-primary hover:underline">
            Football predictions
          </Link>
          <Link href="/matches" className="font-medium text-primary hover:underline">
            Today’s matches
          </Link>
          <Link href="/results" className="font-medium text-primary hover:underline">
            Match results
          </Link>
        </nav>
      </header>

      <section aria-labelledby="latest-stories-heading">
        <h2 id="latest-stories-heading" className="mb-4 text-xl font-semibold text-foreground">
          Latest stories
        </h2>

        {articles.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="font-medium text-foreground">No news stories are available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You can still browse current fixtures, scores and sports coverage.
            </p>
            <Link href="/sports" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              Browse all sports
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map(article => (
              <article
                key={article.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <Link
                  href={articleToUrl(article, '')}
                  className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {article.image ? (
                    <img
                      src={article.image}
                      alt={article.headline}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground">
                      {article.source || 'Sports news'} · {formatPublishedDate(article.published)}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
                      {article.headline}
                    </h3>
                    {article.description ? (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {article.description}
                      </p>
                    ) : null}
                    <span className="mt-4 inline-block text-sm font-medium text-primary">
                      Read story
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
