import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/geo
 *
 * Returns the ISO-3166-1 alpha-2 country code for the requesting IP.
 * Priority order:
 *   1. Cloudflare header (CF-IPCountry)
 *   2. Vercel edge header (x-vercel-ip-country)
 *   3. Any other known proxy header
 *   4. Free ip-api.com lookup (no key required, 45 req/min limit)
 *
 * Always responds with { country: "XX" }. Falls back to "" on failure
 * so the client can fall back to timezone detection.
 */
export async function GET(req: NextRequest) {
  // 1. Check common CDN / proxy headers set on the edge
  const cfCountry = req.headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX' && cfCountry.length === 2) {
    return NextResponse.json({ country: cfCountry.toUpperCase() }, { headers: cacheHeaders() });
  }

  const vercelCountry = req.headers.get('x-vercel-ip-country');
  if (vercelCountry && vercelCountry.length === 2) {
    return NextResponse.json({ country: vercelCountry.toUpperCase() }, { headers: cacheHeaders() });
  }

  // 2. Extract client IP from forwarding headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : req.headers.get('x-real-ip') ?? '';

  // Skip loopback / private IPs — can't geo them
  if (!ip || isPrivateIp(ip)) {
    return NextResponse.json({ country: '' }, { headers: cacheHeaders() });
  }

  // 3. Free ip-api.com lookup (no API key, 45 req/min from same IP)
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({})) as { countryCode?: string };
      const code = data.countryCode?.toUpperCase() ?? '';
      if (code.length === 2) {
        return NextResponse.json({ country: code }, { headers: cacheHeaders() });
      }
    }
  } catch {
    // timeout or network error — fall through
  }

  return NextResponse.json({ country: '' }, { headers: cacheHeaders() });
}

function cacheHeaders() {
  // Cache for 10 minutes so repeat page-loads don't re-call ip-api
  return { 'Cache-Control': 'private, max-age=600' };
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  );
}
