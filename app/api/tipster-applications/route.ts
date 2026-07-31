import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserRoleOverride } from '@/lib/user-role-overrides';
import {
  createApplication,
  listApplicationsForUser,
} from '@/lib/tipster-applications-store';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getUserRole(userId: number): Promise<string> {
  const override = getUserRoleOverride(userId);
  if (override) return override;
  try {
    const dbUser = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = ? LIMIT 1', [userId]);
    return dbUser?.role || 'user';
  } catch {
    return 'user';
  }
}

export async function GET() {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const apps = await listApplicationsForUser(auth.userId);
  const role = await getUserRole(auth.userId);
  return NextResponse.json({ applications: apps, currentRole: role });
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: 'You must be signed in to apply.' }, { status: 401 });
  }

  const role = await getUserRole(auth.userId);
  if (role === 'tipster' || role === 'admin' || role === 'moderator' || role === 'editor') {
    return NextResponse.json(
      { error: 'You already have a tipster (or higher) role on this account.' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const pitch = String(body.pitch || '').trim();
  const specialties = String(body.specialties || '').trim();
  const experience = String(body.experience || '').trim();
  const socialProof = String(body.socialProof || '').trim();
  const requestVerified = !!body.requestVerified;

  if (pitch.length < 40) {
    return NextResponse.json(
      { error: 'Tell us a bit more about why you should be approved (at least 40 characters).' },
      { status: 400 },
    );
  }
  if (specialties.length < 3) {
    return NextResponse.json(
      { error: 'List at least one sport or league you focus on.' },
      { status: 400 },
    );
  }

  const existing = await listApplicationsForUser(auth.userId);
  if (existing.some(a => a.status === 'pending')) {
    return NextResponse.json(
      { error: 'You already have an application pending review.' },
      { status: 400 },
    );
  }

  // Get user info from DB for the application
  let username = auth.username || `user-${auth.userId}`;
  let displayName = auth.displayName || 'User';
  let email: string | undefined;
  try {
    const dbUser = await queryOne<{ username: string; display_name: string; email: string }>(
      'SELECT username, display_name, email FROM users WHERE id = ? LIMIT 1',
      [auth.userId]
    );
    if (dbUser) {
      username = dbUser.username || username;
      displayName = dbUser.display_name || displayName;
      email = dbUser.email;
    }
  } catch { /* use auth fallbacks */ }

  const row = await createApplication({
    userId: auth.userId,
    username,
    displayName,
    email,
    pitch,
    specialties,
    experience: experience || undefined,
    socialProof: socialProof || undefined,
    requestVerified,
  });

  return NextResponse.json({ application: row });
}
