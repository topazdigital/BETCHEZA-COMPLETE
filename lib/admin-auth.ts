import { getCurrentUser } from './auth';
import { canAccessAdmin } from './permissions';
import { NextResponse } from 'next/server';

/**
 * Shared admin guard for API routes.
 * Uses the same canAccessAdmin() check as the /admin layout so moderators
 * and editors are also accepted in addition to full admins.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) return null;
  return user;
}

/**
 * Convenience: returns a 403 response if the user isn't an admin.
 * Returns null when auth is OK so the caller can proceed.
 */
export async function adminGuard(): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>} | NextResponse> {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user };
}
