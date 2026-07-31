import { NextResponse } from 'next/server';
import { getOAuthConfig } from '@/lib/oauth-config-store';

/**
 * Publicly exposes the Google OAuth client ID (not secret) so the client-side
 * Google Identity Services script can initialise One Tap without having the
 * secret in the bundle.
 */
export async function GET() {
  const cfg = await getOAuthConfig();
  const clientId =
    (cfg.google.enabled && cfg.google.clientId) ||
    process.env.GOOGLE_CLIENT_ID ||
    '';

  if (!clientId) {
    const res = NextResponse.json({ clientId: null });
    res.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res;
  }

  const res = NextResponse.json({ clientId });
  res.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return res;
}
