import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { mockUsers } from '@/lib/mock-data';
import { getUserRoleOverride } from '@/lib/user-role-overrides';
import {
  createApplication,
  listApplicationsForUser,
} from '@/lib/tipster-applications-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET — return the current user's own applications so the apply page can show
 * "pending review" / "approved on …" status next to the form.
 */
export async function GET() {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const apps = await listApplicationsForUser(auth.userId);
  const role = getUserRoleOverride(auth.userId)
    || mockUsers.find(u => u.id === auth.userId)?.role
    || 'user';
  return NextResponse.json({ applications: apps, currentRole: role });
}

/**
 * POST — submit a new tipster application. Anyone signed-in can apply.
 * Already-tipsters and admins are blocked (no need to apply).
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: 'You must be signed in to apply.' }, { status: 401 });
  }

  const role = getUserRoleOverride(auth.userId)
    || mockUsers.find(u => u.id === auth.userId)?.role
    || 'user';
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

  // Block duplicate pending applications from the same user.
  const existing = await listApplicationsForUser(auth.userId);
  if (existing.some(a => a.status === 'pending')) {
    return NextResponse.json(
      { error: 'You already have an application pending review.' },
      { status: 400 },
    );
  }

  const profile = mockUsers.find(u => u.id === auth.userId);
  const row = await createApplication({
    userId: auth.userId,
    username: auth.username || profile?.username || `user-${auth.userId}`,
    displayName: auth.displayName || profile?.display_name || 'User',
    email: profile?.email,
    pitch,
    specialties,
    experience: experience || undefined,
    socialProof: socialProof || undefined,
    requestVerified,
  });

  return NextResponse.json({ application: row });
}
