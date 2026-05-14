import { NextRequest, NextResponse } from 'next/server';
import { mockUsers } from '@/lib/mock-data';
import { consumePasswordResetToken } from '@/lib/password-reset-store';
import { hashPassword } from '@/lib/auth';
import { queryOne, execute, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = body.token?.trim();
  const password = body.password || '';

  if (!token) return NextResponse.json({ error: 'Reset token is required' }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const entry = consumePasswordResetToken(token);
  if (!entry) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
  }

  const newHash = await hashPassword(password);

  // Update password in DB if connected
  if (getPool()) {
    try {
      const dbUser = await queryOne<{ id: number }>(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
        [entry.userId]
      );
      if (dbUser) {
        await execute(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [newHash, entry.userId]
        );
        return NextResponse.json({ ok: true });
      }
    } catch (err) {
      console.warn('[reset-password] DB update failed:', err);
    }
  }

  // Fallback: update mock user in memory
  const user = mockUsers.find((u) => u.id === entry.userId);
  if (!user) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }
  user.password_hash = newHash;
  return NextResponse.json({ ok: true });
}
