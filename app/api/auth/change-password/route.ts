import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  try {
    // Try database first
    const r = await query<{ id: number; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
      [payload.userId]
    );
    if (r.rows[0]) {
      const ok = await verifyPassword(currentPassword, r.rows[0].password_hash);
      if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      const newHash = await hashPassword(newPassword);
      await execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, payload.userId]);
      return NextResponse.json({ ok: true });
    }
  } catch {}

  // File-based fallback
  const users = fileStoreGet<Array<{ id: number; passwordHash: string }>>('users', []);
  const user = users.find(u => u.id === payload.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  user.passwordHash = await hashPassword(newPassword);
  fileStoreSet('users', users);
  return NextResponse.json({ ok: true });
}
