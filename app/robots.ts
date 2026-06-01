import type { MetadataRoute } from 'next';

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.SITE_URL
    || 'https://betcheza.co.ke'
  ).replace(/\/$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      // Googlebot: no crawl delay, full snippet + image preview allowed
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/login',
          '/register',
          '/_next/',
        ],
      },
      // Bingbot
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/login',
          '/register',
          '/_next/',
        ],
      },
      // All other crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/login',
          '/register',
          '/_next/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
