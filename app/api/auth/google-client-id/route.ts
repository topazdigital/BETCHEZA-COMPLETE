import { NextResponse } from 'next/server';
import { getOAuthConfig } from '@/lib/oauth-config-store';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ clientId: null });
  }

  return NextResponse.json({ clientId });
}
