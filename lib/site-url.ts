const PRODUCTION_ORIGIN = 'https://www.betcheza.co.ke';

/**
 * Return the public origin used by canonical URLs, sitemaps, and SEO metadata.
 * The production server redirects the bare Betcheza domain to www, so all
 * generated SEO URLs must use the final https://www host.
 */
export function getCanonicalSiteUrl(candidate?: string): string {
  const configured =
    candidate?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    PRODUCTION_ORIGIN;

  try {
    const url = new URL(configured);
    const hostname = url.hostname.toLowerCase();

    if (
      hostname === 'betcheza.co.ke' ||
      hostname === 'www.betcheza.co.ke' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.replit.dev')
    ) {
      return PRODUCTION_ORIGIN;
    }

    return url.origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}
