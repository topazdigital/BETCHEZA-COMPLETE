import { NextResponse } from 'next/server';
import { setAuthCookie } from '@/lib/auth';
import { queryOne, execute, getPool } from '@/lib/db';
import { mockUsers } from '@/lib/mock-data';
import { getOAuthConfig } from '@/lib/oauth-config-store';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GoogleTokenPayload {
  iss: string;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aud: string;
  exp: number;
  iat: number;
}

interface GoogleTokenInfoResponse {
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  aud?: string;
  exp?: string;
  error_description?: string;
}

async function verifyGoogleCredential(credential: string): Promise<GoogleTokenPayload | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as GoogleTokenInfoResponse;
    if (data.error_description) return null;
    if (!data.sub) return null;
    if (!data.exp || Date.now() / 1000 > parseInt(data.exp, 10)) return null;
    return {
      iss: data.iss || '',
      sub: data.sub,
      email: data.email,
      email_verified: data.email_verified === 'true',
      name: data.name,
      picture: data.picture,
      aud: data.aud || '',
      exp: parseInt(data.exp, 10),
      iat: 0,
    };
  } catch (err) {
    console.warn('[google-one-tap] tokeninfo failed:', err);
    return null;
  }
}

function makeUsername(email?: string): string {
  const base = (email?.split('@')[0] || `user_${Date.now()}`)
    .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || `user_${Date.now()}`;
  return `${base}_${Math.floor(Math.random() * 9000) + 1000}`;
}

interface DbUser {
  id: number; email: string; username: string; display_name: string;
  avatar_url: string | null; role: 'user' | 'tipster' | 'admin';
  balance: number; is_verified: boolean;
}

async function findOrCreateUser(payload: GoogleTokenPayload): Promise<DbUser | null> {
  const sel = 'SELECT id, email, username, display_name, avatar_url, role, balance, is_verified FROM users';

  if (getPool()) {
    try {
      // Look up by google_id first
      let user = await queryOne<DbUser>(`${sel} WHERE google_id = ? LIMIT 1`, [payload.sub]);
      if (user) return user;

      // Look up by email
      if (payload.email) {
        user = await queryOne<DbUser>(`${sel} WHERE email = ? LIMIT 1`, [payload.email]);
        if (user) {
          // Link google_id and update avatar if missing
          await execute('UPDATE users SET google_id = ? WHERE id = ?', [payload.sub, user.id]);
          if (!user.avatar_url && payload.picture) {
            await execute('UPDATE users SET avatar_url = ? WHERE id = ?', [payload.picture, user.id]);
          }
          return user;
        }
      }

      // Create new user
      const username = makeUsername(payload.email);
      const displayName = payload.name || username;
      const email = payload.email || `google_${payload.sub}@oauth.local`;
      const isVerified = payload.email_verified ? 1 : 0;

      const r = await execute(
        `INSERT INTO users (email, username, display_name, avatar_url, password_hash, google_id, role, balance, timezone, odds_format, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', ?, 'user', 0, 'Africa/Nairobi', 'decimal', ?, NOW(), NOW())`,
        [email, username, displayName, payload.picture ?? null, payload.sub, isVerified]
      );
      return await queryOne<DbUser>(`${sel} WHERE id = ? LIMIT 1`, [r.insertId]);
    } catch (err) {
      console.error('[google-one-tap] DB error:', err);
      return null;
    }
  }

  // Fallback: in-memory mock (no DB configured)
  const allMock = mockUsers as (User & { google_id?: string | null; oauth_provider?: string; oauth_provider_id?: string })[];
  let mock = allMock.find(u => u.google_id === payload.sub);
  if (!mock && payload.email) {
    mock = allMock.find(u => u.email.toLowerCase() === payload.email!.toLowerCase());
    if (mock) mock.google_id = payload.sub;
  }
  if (!mock) {
    const username = makeUsername(payload.email);
    const displayName = payload.name || username;
    const email = payload.email || `google_${payload.sub}@oauth.local`;
    const newUser = {
      id: mockUsers.length + 1000 + Math.floor(Math.random() * 1000),
      email, username, display_name: displayName, avatar_url: payload.picture || null,
      bio: null, phone: null, country_code: null, password_hash: '',
      google_id: payload.sub, role: 'user' as const, balance: 0,
      timezone: 'Africa/Nairobi', odds_format: 'decimal' as const,
      is_verified: payload.email_verified ? true : false, created_at: new Date(),
    };
    mockUsers.push(newUser);
    mock = newUser;
  }
  return {
    id: mock.id, email: mock.email, username: mock.username,
    display_name: mock.display_name, avatar_url: mock.avatar_url,
    role: mock.role, balance: mock.balance, is_verified: !!mock.is_verified,
  };
}

export async function POST(request: Request) {
  try {
    let body: { credential?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const { credential } = body;
    if (!credential) {
      return NextResponse.json({ success: false, error: 'No credential provided' }, { status: 400 });
    }

    // Verify the Google credential
    const payload = await verifyGoogleCredential(credential);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid or expired Google credential' }, { status: 401 });
    }

    // Optionally check audience against configured client ID
    const oauthConfig = await getOAuthConfig();
    const clientId = oauthConfig.google.clientId || process.env.GOOGLE_CLIENT_ID;
    if (clientId && payload.aud && payload.aud !== clientId) {
      return NextResponse.json({ success: false, error: 'Token audience mismatch' }, { status: 401 });
    }

    const user = await findOrCreateUser(payload);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Failed to create user account' }, { status: 500 });
    }

    await setAuthCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        balance: user.balance,
        isEmailVerified: !!user.is_verified,
      },
    });
  } catch (error) {
    console.error('[google-one-tap] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}
