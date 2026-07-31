import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { AuthPayload, UserRole } from './types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'betcheza-dev-secret-key-change-in-production'
);

const COOKIE_NAME = 'betcheza_auth';
const COOKIE_MAX_AGE_DEFAULT = 60 * 60 * 24 * 7; // 7 days
const COOKIE_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30; // 30 days

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT token generation. Remember-me extends the JWT exp to match the cookie.
export async function generateToken(payload: AuthPayload, options?: { rememberMe?: boolean }): Promise<string> {
  const exp = options?.rememberMe ? '30d' : '7d';
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(JWT_SECRET);
}

// JWT token verification
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

// Set auth cookie. Pass { rememberMe: true } to extend the session to 30
// days; otherwise it's a 7-day session (the default for register and other
// flows where we haven't asked the user about persistence).
export async function setAuthCookie(payload: AuthPayload, options?: { rememberMe?: boolean }): Promise<void> {
  const rememberMe = !!options?.rememberMe;
  const token = await generateToken(payload, { rememberMe });
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: rememberMe ? COOKIE_MAX_AGE_REMEMBER : COOKIE_MAX_AGE_DEFAULT,
    path: '/',
  });
}

// Get current user from cookie
export async function getCurrentUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) {
    return null;
  }
  
  return verifyToken(token);
}

// Clear auth cookie
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Check if user has required role
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

// Admin check
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

// Tipster or admin check
export function isTipsterOrAdmin(role: UserRole): boolean {
  return role === 'tipster' || role === 'admin';
}
