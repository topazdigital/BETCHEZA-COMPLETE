import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
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

  const { headline, description, source, image, source_url } = await searchParams;

  const title = headline
    ? `${headline.slice(0, 90)} | ${siteName}`
    : `Sports News Article | ${siteName}`;

  const desc = description ||
    `Full sports article on ${siteName} — original reporting and curated headlines covering football, tennis, basketball, cricket and all major sports in Kenya.`;

  const canonical = source_url ?? `${BASE_URL}/news`;

  const keywords = [
    'sports news Kenya', 'football news Kenya', 'betting analysis Kenya',
    'match preview Kenya', 'sports article Kenya', 'football tips Kenya',
    ...(source ? [`${source} news`] : []),
  ];

  return {
    title,
    description: desc,
    keywords,
    alternates: { canonical: `${BASE_URL}/news/article` },
    robots: {
      index: !!headline,
      follow: true,
      googleBot: { index: !!headline, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    },
    openGraph: {
      title,
      description: desc,
      type: 'article',
      url: `${BASE_URL}/news/article`,
      siteName,
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

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
