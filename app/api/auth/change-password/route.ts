import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hashPassword, verifyPassword } from '@/lib/auth';
import { query, execute, getPool } from '@/lib/db';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('betcheza_auth')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Session expired — please log in again' }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string } = {};
  try { body = await req.json(); } catch {}
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'New password must be different from your current password' }, { status: 400 });
  }

  // ── MySQL path ────────────────────────────────────────────────────────────
  if (getPool()) {
    try {
      const r = await query<{ id: number; password_hash: string }>(
        'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
        [payload.userId]
      );
      if (!r.rows[0]) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const valid = await verifyPassword(currentPassword, r.rows[0].password_hash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      const newHash = await hashPassword(newPassword);
      await execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, payload.userId]);
      return NextResponse.json({ ok: true, message: 'Password updated successfully' });
    } catch (e) {
      console.error('[change-password] DB error:', e);
      return NextResponse.json({ error: 'Failed to update password — please try again' }, { status: 500 });
    }
  }

  // ── File-store fallback (no DB) ───────────────────────────────────────────
  try {
    const users = fileStoreGet<Array<{ id: number; passwordHash: string }>>('users', []);
    const user = users.find(u => u.id === payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Unable to change password: database connection required. Please contact support.' },
        { status: 503 }
      );
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    user.passwordHash = await hashPassword(newPassword);
    fileStoreSet('users', users);
    return NextResponse.json({ ok: true, message: 'Password updated successfully' });
  } catch (e) {
    console.error('[change-password] file-store error:', e);
    return NextResponse.json({ error: 'Failed to update password — please try again' }, { status: 500 });
  }
}
