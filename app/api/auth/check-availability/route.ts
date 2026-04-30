import { NextResponse } from 'next/server';
import { mockUsers } from '@/lib/mock-data';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'support', 'help', 'api', 'system', 'betcheza', 'betchezatips',
  'tips', 'tipster', 'moderator', 'mod', 'official', 'team', 'staff', 'security',
  'login', 'logout', 'signup', 'register', 'me', 'you', 'user', 'users',
]);

async function isEmailTaken(email: string): Promise<boolean> {
  const lower = email.toLowerCase();
  // mockUsers (in-memory fallback) — covers Replit dev
  if (mockUsers.some((u) => u.email.toLowerCase() === lower)) return true;
  // MySQL — covers production
  try {
    const row = await queryOne<{ id: number }>(
      'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
      [lower],
    );
    if (row) return true;
  } catch {
    // DB unavailable — only mock-data check above applies
  }
  return false;
}

async function isUsernameTaken(username: string): Promise<boolean> {
  const lower = username.toLowerCase();
  if (mockUsers.some((u) => u.username.toLowerCase() === lower)) return true;
  try {
    const row = await queryOne<{ id: number }>(
      'SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1',
      [lower],
    );
    if (row) return true;
  } catch {
    // ignore
  }
  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim() || '';
  const username = searchParams.get('username')?.trim() || '';

  const out: {
    email?: { available: boolean; message?: string };
    username?: { available: boolean; message?: string };
  } = {};

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      out.email = { available: false, message: 'Invalid email format' };
    } else if (await isEmailTaken(email)) {
      out.email = { available: false, message: 'Email already registered' };
    } else {
      out.email = { available: true };
    }
  }

  if (username) {
    const u = username.toLowerCase();
    if (u.length < 3) {
      out.username = { available: false, message: 'Too short (min 3)' };
    } else if (!/^[a-z0-9_]+$/.test(u)) {
      out.username = { available: false, message: 'Only lowercase, numbers, _' };
    } else if (RESERVED_USERNAMES.has(u)) {
      out.username = { available: false, message: 'Reserved name' };
    } else if (await isUsernameTaken(u)) {
      out.username = { available: false, message: 'Username taken' };
    } else {
      out.username = { available: true };
    }
  }

  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
