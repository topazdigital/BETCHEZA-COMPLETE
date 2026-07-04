import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{
    headline?: string;
    description?: string;
    source?: string;
    published?: string;
    image?: string;
    source_url?: string;
  }>;
}): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = s.site_name || 'Betcheza';

  const params = searchParams ? await searchParams : {};
  const { headline, description, source, published, image, source_url } = params;

  const title = headline
    ? `${headline.slice(0, 90)} | ${siteName}`
    : `Sports News Article | ${siteName}`;

  const desc = description
    ? description.slice(0, 160)
    : `Full sports article on ${siteName} — original reporting and curated headlines covering football, tennis, basketball, cricket and all major sports in Kenya.`;

  // Each article gets its own canonical URL. Prefer the original source URL so
  // Google understands this is a reader view of an external article. If no
  // source URL is available, use the internal article page with its query
  // params so that at minimum every article has a unique canonical.
  const articleSlug = headline
    ? headline
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80)
    : '';
  const internalUrl = articleSlug
    ? `${BASE_URL}/news/article/${articleSlug}`
    : `${BASE_URL}/news`;
  const canonical = source_url || internalUrl;

  // Derive article keywords from headline + source
  const headlineWords = (headline || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 6);

  const keywords = [
    'sports news Kenya',
    'football news Kenya',
    'betting analysis Kenya',
    'match preview Kenya',
    ...(source ? [`${source} news`] : []),
    ...headlineWords,
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  return {
    title,
    description: desc,
    keywords,
    alternates: { canonical },
    robots: {
      index: !!headline,
      follow: true,
      googleBot: {
        index: !!headline,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title,
      description: desc,
      type: 'article',
      url: canonical,
      siteName,
      ...(published
        ? { publishedTime: new Date(published).toISOString() }
        : {}),
      ...(image
        ? {
            images: [
              {
                url: image,
                width: 1200,
                height: 630,
                alt: headline ?? 'Sports News',
              },
            ],
          }
        : {}),
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

// Article structured data injected server-side so crawlers see it immediately.
async function ArticleSchema({
  searchParams,
}: {
  searchParams?: Promise<{
    headline?: string;
    description?: string;
    source?: string;
    published?: string;
    image?: string;
    source_url?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { headline, description, source, published, image, source_url } = params;

  if (!headline) return null;

  const s = await getSiteSettings();
  const siteName = s.site_name || 'Betcheza';
  const articleSlug = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  const canonical = source_url || `${BASE_URL}/news/article/${articleSlug}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: headline.slice(0, 110),
    description: (description || '').slice(0, 160),
    url: canonical,
    ...(published
      ? {
          datePublished: new Date(published).toISOString(),
          dateModified: new Date(published).toISOString(),
        }
      : {}),
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
        width: 200,
        height: 60,
      },
    },
    ...(image
      ? {
          image: {
            '@type': 'ImageObject',
            url: image,
            width: 1200,
            height: 630,
          },
        }
      : {}),
    author: {
      '@type': 'Organization',
      name: source || siteName,
    },
    isPartOf: { '@id': `${BASE_URL}/#website` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: siteName, item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'News', item: `${BASE_URL}/news` },
      { '@type': 'ListItem', position: 3, name: headline.slice(0, 60), item: canonical },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}

export default async function Layout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: Promise<{
    headline?: string;
    description?: string;
    source?: string;
    published?: string;
    image?: string;
    source_url?: string;
  }>;
}) {
  return (
    <>
      <ArticleSchema searchParams={searchParams} />
      {children}
    </>
  );
}
