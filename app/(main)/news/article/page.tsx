import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getSiteSettings } from '@/lib/site-settings';
import ArticleReader from './_article-reader';

export const dynamic = 'force-dynamic';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

type SearchParams = Promise<{
  headline?: string;
  description?: string;
  source?: string;
  published?: string;
  image?: string;
  source_url?: string;
}>;

function makeSlug(headline: string) {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// generateMetadata MUST live in the page (not layout) to receive searchParams.
// Layouts in Next.js App Router do not receive searchParams.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const { headline, description, source, published, image, source_url } = params;

  const s = await getSiteSettings();
  const siteName = s.site_name || 'Betcheza';

  const title = headline
    ? `${headline.slice(0, 90)} | ${siteName}`
    : `Sports News Article | ${siteName}`;

  const desc = description
    ? description.slice(0, 160)
    : `Full sports news on ${siteName} — football, tennis, basketball, cricket and all major sports in Kenya.`;

  const slug = headline ? makeSlug(headline) : '';
  const canonical = source_url || (slug ? `${BASE_URL}/news/article/${slug}` : `${BASE_URL}/news`);

  const headlineKeywords = (headline || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 6);

  const keywords = [
    'sports news Kenya', 'football news Kenya', 'betting analysis Kenya', 'match preview Kenya',
    ...(source ? [`${source} news`] : []),
    ...headlineKeywords,
  ].filter((v, i, a) => a.indexOf(v) === i);

  return {
    title,
    description: desc,
    keywords,
    alternates: { canonical },
    robots: {
      index: !!headline,
      follow: true,
      googleBot: { index: !!headline, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    },
    openGraph: {
      title,
      description: desc,
      type: 'article',
      url: canonical,
      siteName,
      ...(published ? { publishedTime: new Date(published).toISOString() } : {}),
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: headline ?? 'Sports News' }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      site: '@betcheza',
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function NewsArticlePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { headline = '', description = '', image = '', published = '', source_url = '', source = 'ESPN' } = params;

  const s = await getSiteSettings();
  const siteName = s.site_name || 'Betcheza';
  const slug = headline ? makeSlug(headline) : '';
  const canonical = source_url || (slug ? `${BASE_URL}/news/article/${slug}` : `${BASE_URL}/news`);

  // Schema.org JSON-LD injected server-side so Google sees it on first crawl.
  const articleSchema = headline ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: headline.slice(0, 110),
    description: description.slice(0, 160),
    url: canonical,
    ...(published ? { datePublished: new Date(published).toISOString(), dateModified: new Date(published).toISOString() } : {}),
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png`, width: 200, height: 60 },
    },
    ...(image ? { image: { '@type': 'ImageObject', url: image, width: 1200, height: 630 } } : {}),
    author: { '@type': 'Organization', name: source || siteName },
    isPartOf: { '@id': `${BASE_URL}/#website` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  } : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: siteName, item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'News', item: `${BASE_URL}/news` },
      ...(headline ? [{ '@type': 'ListItem', position: 3, name: headline.slice(0, 60), item: canonical }] : []),
    ],
  };

  return (
    <>
      {articleSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">Loading article…</div>}>
        <ArticleReader
          headline={headline}
          description={description}
          image={image}
          published={published}
          sourceUrl={source_url}
          source={source}
        />
      </Suspense>
    </>
  );
}
