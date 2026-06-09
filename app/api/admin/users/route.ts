import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { hasPermission, type Role, ROLE_LABELS } from '@/lib/permissions';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { getUserRoleOverride, setUserRoleOverride } from '@/lib/user-role-overrides';
import { query, execute, directExecute, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AdminUserRow {
  id: number;
  username: string;
  displayName: string;
  email: string;
  avatar: string;
  role: Role;
  status: 'active' | 'banned' | 'pending';
  isFake: boolean;
  joined: string;
  predictions: number;
  winRate: number;
  followers: number;
  lastActive: string;
  dbError?: string;
}

type RawUserFull = {
  id: number; username: string; display_name: string; email: string;
  avatar_url: string | null; role: string; is_verified: number; is_banned: number;
  created_at: string; total_tips: number | null; win_rate: number | null; followers_count: number | null;
};
type RawUserBasic = {
  id: number; username: string; display_name: string; email: string;
  avatar_url: string | null; role: string; is_verified: number; is_banned: number; created_at: string;
};
type RawUserMinimal = {
  id: number; username: string; display_name: string | null; email: string;
  avatar_url: string | null; role: string | null; is_verified: number | null; created_at: string;
};

function mapRow(u: RawUserFull | RawUserBasic | RawUserMinimal, extra?: { total_tips?: number | null; win_rate?: number | null; followers_count?: number | null }): AdminUserRow {
  return {
    id: u.id,
    username: u.username,
    displayName: (u as RawUserFull).display_name || u.username,
    email: u.email || '',
    avatar: (u as RawUserFull).avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
    role: (getUserRoleOverride(u.id) || (u as RawUserFull).role || 'user') as Role,
    status: ((u as RawUserBasic).is_banned ? 'banned' : (u as RawUserMinimal).is_verified ? 'active' : 'pending') as 'active' | 'banned' | 'pending',
    isFake: false,
    joined: new Date((u as RawUserFull).created_at).toLocaleDateString(),
    predictions: (u as RawUserFull).total_tips ?? extra?.total_tips ?? 0,
    winRate: (u as RawUserFull).win_rate ?? extra?.win_rate ?? 0,
    followers: (u as RawUserFull).followers_count ?? extra?.followers_count ?? 0,
    lastActive: 'Online',
  };
}

async function buildRealUsers(): Promise<{ rows: AdminUserRow[]; error?: string }> {
  // No pool → skip silently
  if (!getPool()) return { rows: [], error: 'no_db_config' };

  // ── Attempt 1: Full query with tipster_profiles join + is_banned ──────────
  try {
    const r = await query<RawUserFull>(
      `SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.role,
              u.is_verified, COALESCE(u.is_banned, 0) AS is_banned, u.created_at,
              tp.total_tips, tp.win_rate, tp.followers_count
       FROM users u
       LEFT JOIN tipster_profiles tp ON tp.user_id = u.id
       ORDER BY u.created_at DESC LIMIT 500`
    );
    return { rows: r.rows.map(u => mapRow(u)) };
  } catch (e1) {
    console.warn('[admin/users] Full query failed, trying without tipster_profiles:', (e1 as Error).message);
  }

  // ── Attempt 2: Without tipster_profiles (table might not exist) ───────────
  try {
    const r = await query<RawUserBasic>(
      `SELECT id, username, display_name, email, avatar_url, role,
              is_verified, COALESCE(is_banned, 0) AS is_banned, created_at
       FROM users
       ORDER BY created_at DESC LIMIT 500`
    );
    return { rows: r.rows.map(u => mapRow(u)) };
  } catch (e2) {
    console.warn('[admin/users] Basic query failed, trying minimal:', (e2 as Error).message);
  }

  // ── Attempt 3: Minimal — no is_banned (column might not exist) ────────────
  try {
    const r = await query<RawUserMinimal>(
      `SELECT id, username, display_name, email, avatar_url, role, is_verified, created_at
       FROM users
       ORDER BY created_at DESC LIMIT 500`
    );
    return { rows: r.rows.map(u => mapRow(u)) };
  } catch (e3) {
    const msg = (e3 as Error).message;
    console.error('[admin/users] All DB queries failed:', msg);
    return { rows: [], error: msg };
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, 'admin.users.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').toLowerCase();
  const roleFilter = searchParams.get('role');
  const sourceFilter = searchParams.get('source');

  const { rows: realRows, error: dbError } = await buildRealUsers();

  const fakes: AdminUserRow[] = getFakeTipsters().map(t => ({
    id: t.id,
    username: t.username,
    displayName: t.displayName,
    email: `${t.username}@seed.local`,
    avatar: t.avatar,
    role: (getUserRoleOverride(t.id) || 'tipster') as Role,
    status: 'active' as const,
    isFake: true,
    joined: new Date(t.joinedAt).toLocaleDateString(),
    predictions: t.totalTips,
    winRate: t.winRate,
    followers: t.followersCount,
    lastActive: 'Auto',
  }));

  const allUsers = [...realRows, ...fakes];

  // Counts always from ALL users regardless of source/role filter
  const allCounts = {
    total: allUsers.length,
    real: realRows.length,
    fake: fakes.length,
    byRole: {
      admin: allUsers.filter(u => u.role === 'admin').length,
      moderator: allUsers.filter(u => u.role === 'moderator').length,
      editor: allUsers.filter(u => u.role === 'editor').length,
      tipster: allUsers.filter(u => u.role === 'tipster').length,
      user: allUsers.filter(u => u.role === 'user').length,
    },
    realByRole: {
      admin: realRows.filter(u => u.role === 'admin').length,
      moderator: realRows.filter(u => u.role === 'moderator').length,
      editor: realRows.filter(u => u.role === 'editor').length,
      tipster: realRows.filter(u => u.role === 'tipster').length,
      user: realRows.filter(u => u.role === 'user').length,
    },
  };

  // Apply filters to displayed users
  let users = allUsers;
  if (search) {
    users = users.filter(u =>
      u.username.toLowerCase().includes(search) ||
      u.displayName.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search),
    );
  }
  if (roleFilter && roleFilter !== 'all') users = users.filter(u => u.role === roleFilter);
  if (sourceFilter === 'real') users = users.filter(u => !u.isFake);
  if (sourceFilter === 'fake') users = users.filter(u => u.isFake);

  return NextResponse.json({
    success: true,
    users,
    counts: allCounts,
    roleLabels: ROLE_LABELS,
    dbError: dbError || null,
  });
}

// In-memory banned-user set (survives hot-reloads via globalThis)
const g2 = globalThis as { __bannedUsers?: Set<number> };
if (!g2.__bannedUsers) g2.__bannedUsers = new Set<number>();
const bannedUsers = g2.__bannedUsers;

// Ensure is_banned column exists (idempotent)
async function ensureBannedColumn() {
  try {
    await query(`ALTER TABLE users ADD COLUMN is_banned TINYINT(1) NOT NULL DEFAULT 0`);
  } catch {
    // column already exists — ignore
  }
}

export async function PATCH(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.role')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const action = body.action as string | undefined;

  if (action === 'bulk_ban' || action === 'bulk_unban' || action === 'bulk_verify') {
    const ids = (body.ids as number[] | undefined) ?? [];
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ success: false, error: 'No user IDs provided' }, { status: 400 });
    await ensureBannedColumn();
    const placeholders = ids.map(() => '?').join(',');
    try {
      if (action === 'bulk_ban') {
        await query(`UPDATE users SET is_banned = 1, is_verified = 0 WHERE id IN (${placeholders})`, ids);
        ids.forEach(id => bannedUsers.add(id));
      } else if (action === 'bulk_unban') {
        await query(`UPDATE users SET is_banned = 0, is_verified = 1 WHERE id IN (${placeholders})`, ids);
        ids.forEach(id => bannedUsers.delete(id));
      } else if (action === 'bulk_verify') {
        await query(`UPDATE users SET is_verified = 1, is_banned = 0 WHERE id IN (${placeholders})`, ids);
        ids.forEach(id => bannedUsers.delete(id));
      }
    } catch (e) {
      console.warn('[admin/users] bulk action DB failed:', e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ success: true, action, count: ids.length });
  }

  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'invalid payload' }, { status: 400 });

  if (action === 'ban') {
    await ensureBannedColumn();
    bannedUsers.add(id);
    try { await query(`UPDATE users SET is_banned = 1, is_verified = 0 WHERE id = ?`, [id]); } catch {}
    return NextResponse.json({ success: true, id, action: 'ban' });
  }
  if (action === 'unban') {
    await ensureBannedColumn();
    bannedUsers.delete(id);
    try { await query(`UPDATE users SET is_banned = 0, is_verified = 1 WHERE id = ?`, [id]); } catch {}
    return NextResponse.json({ success: true, id, action: 'unban' });
  }
  if (action === 'verify') {
    try { await query(`UPDATE users SET is_verified = 1 WHERE id = ?`, [id]); } catch {}
    return NextResponse.json({ success: true, id, action: 'verify' });
  }

  const role = body.role as Role;
  const validRoles: Role[] = ['admin', 'moderator', 'editor', 'tipster', 'user'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ success: false, error: 'invalid payload' }, { status: 400 });
  }
  setUserRoleOverride(id, role);
  let dbAffected = 0;
  let dbError: string | undefined;
  try {
    // Use directExecute to bypass circuit breaker — pool may be silently open/tripped
    const r = await directExecute(`UPDATE users SET role = ? WHERE id = ?`, [role, id]);
    dbAffected = r.affectedRows;
    if (r.affectedRows === 0) {
      console.warn(`[admin/users] role update: id=${id} matched 0 rows in DB (in-memory override applied)`);
    }
    // If promoted to tipster, ensure tipster_profiles row exists
    if (role === 'tipster' && r.affectedRows > 0) {
      await directExecute(
        `INSERT INTO tipster_profiles (user_id, updated_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [id]
      );
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
    console.warn('[admin/users] DB role update failed (in-memory override still applied):', dbError);
  }
  return NextResponse.json({ success: true, id, role, dbAffected, dbError: dbError || null });
}

export async function DELETE(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.role')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  if (ids.length === 0) return NextResponse.json({ success: false, error: 'No IDs provided' }, { status: 400 });
  if (ids.includes(me.id)) return NextResponse.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
  try {
    const placeholders = ids.map(() => '?').join(',');
    await query(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
  } catch (e) {
    console.warn('[admin/users] delete failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: 'Delete failed — check DB connection' }, { status: 500 });
  }
  return NextResponse.json({ success: true, deleted: ids.length });
}

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const username = String(body.username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const displayName = String(body.displayName || body.username || '').trim();
  const password = String(body.password || '');
  const role = (body.role as Role) || 'user';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
  if (!username || username.length < 3)
    return NextResponse.json({ success: false, error: 'Username must be at least 3 characters' }, { status: 400 });
  if (!password || password.length < 8)
    return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });

  try {
    const existing = await query<{ id: number }>(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [email, username]
    );
    if (existing.rows.length > 0)
      return NextResponse.json({ success: false, error: 'Email or username already exists' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
    const result = await execute(
      `INSERT INTO users (email, username, display_name, password_hash, avatar_url, role, balance, timezone, odds_format, is_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'Africa/Nairobi', 'decimal', 1, NOW(), NOW())`,
      [email, username, displayName || username, passwordHash, avatar, role]
    );
    return NextResponse.json({ success: true, id: result.insertId, email, username, role });
  } catch (e) {
    console.error('[admin/users] create user failed:', e);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}
