import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { hasPermission, type Role, ROLE_LABELS } from '@/lib/permissions';
import { mockUsers } from '@/lib/mock-data';
import { getFakeTipsters } from '@/lib/fake-tipsters';
import { getUserRoleOverride, setUserRoleOverride } from '@/lib/user-role-overrides';

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
}

function buildAllUsers(): AdminUserRow[] {
  const real: AdminUserRow[] = mockUsers.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    email: u.email || '',
    avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
    role: (getUserRoleOverride(u.id) || u.role || 'user') as Role,
    status: 'active' as const,
    isFake: false,
    joined: new Date(u.created_at).toLocaleDateString(),
    predictions: u.tipster_profile?.total_tips ?? 0,
    winRate: u.tipster_profile?.win_rate ?? 0,
    followers: u.tipster_profile?.followers_count ?? 0,
    lastActive: 'Online',
  }));

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

  return [...real, ...fakes];
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, 'admin.users.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').toLowerCase();
  const roleFilter = searchParams.get('role');
  const sourceFilter = searchParams.get('source'); // 'real' | 'fake'

  let users = buildAllUsers();
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
    counts: {
      total: users.length,
      byRole: {
        admin: users.filter(u => u.role === 'admin').length,
        moderator: users.filter(u => u.role === 'moderator').length,
        editor: users.filter(u => u.role === 'editor').length,
        tipster: users.filter(u => u.role === 'tipster').length,
        user: users.filter(u => u.role === 'user').length,
      },
    },
    roleLabels: ROLE_LABELS,
  });
}

/**
 * PATCH { id, role }  — change a user's role (admins only).
 */
export async function PATCH(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.role')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const id = Number(body.id);
  const role = body.role as Role;
  const validRoles: Role[] = ['admin', 'moderator', 'editor', 'tipster', 'user'];
  if (!id || !validRoles.includes(role)) {
    return NextResponse.json({ success: false, error: 'invalid payload' }, { status: 400 });
  }
  setUserRoleOverride(id, role);
  return NextResponse.json({ success: true, id, role });
}
