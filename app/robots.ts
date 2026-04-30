import type { MetadataRoute } from 'next';

// Resolve the canonical site URL from env, falling back to the live domain.
// In dev / preview deployments NEXT_PUBLIC_SITE_URL points at the Replit URL
// so the sitemap link in robots.txt always points somewhere fetchable.
function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.SITE_URL
    || 'https://bettipspro.com'
  ).replace(/\/$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep auth, admin, and machine-only routes out of crawl indexes.
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
