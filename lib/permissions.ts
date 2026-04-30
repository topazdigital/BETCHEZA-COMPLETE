// ─────────────────────────────────────────────────────────────────────
// Role + permission map.
//
// `admin`     — full access to everything
// `moderator` — content moderation: tips, comments, news, featured matches
// `editor`    — news, static pages and feed posts only
// `tipster`   — verified tipster (frontend perks)
// `user`      — regular signed-in user
// ─────────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'moderator' | 'editor' | 'tipster' | 'user';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  editor: 'Editor',
  tipster: 'Tipster',
  user: 'User',
};

export const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  moderator: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  editor: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
  tipster: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  user: 'bg-muted text-muted-foreground border-border',
};

export type Permission =
  | 'admin.access'           // can open the admin panel at all
  | 'admin.users.read'
  | 'admin.users.write'
  | 'admin.users.ban'
  | 'admin.users.role'       // can change another user's role
  | 'admin.tipsters.read'
  | 'admin.tipsters.write'
  | 'admin.tipsters.fake'    // can generate fake tipsters & auto-tips
  | 'admin.matches.read'
  | 'admin.matches.write'
  | 'admin.tips.moderate'
  | 'admin.comments.moderate'
  | 'admin.news.write'
  | 'admin.featured.write'
  | 'admin.feed.write'
  | 'admin.payments.read'
  | 'admin.settings.write'
  | 'admin.email.write'
  | 'admin.notifications.send';

const PERMS: Record<Role, Permission[]> = {
  admin: [
    'admin.access',
    'admin.users.read', 'admin.users.write', 'admin.users.ban', 'admin.users.role',
    'admin.tipsters.read', 'admin.tipsters.write', 'admin.tipsters.fake',
    'admin.matches.read', 'admin.matches.write',
    'admin.tips.moderate', 'admin.comments.moderate',
    'admin.news.write', 'admin.featured.write', 'admin.feed.write',
    'admin.payments.read', 'admin.settings.write', 'admin.email.write',
    'admin.notifications.send',
  ],
  moderator: [
    'admin.access',
    'admin.users.read', 'admin.users.ban',
    'admin.tipsters.read',
    'admin.matches.read',
    'admin.tips.moderate', 'admin.comments.moderate',
    'admin.featured.write',
    'admin.notifications.send',
  ],
  editor: [
    'admin.access',
    'admin.matches.read',
    'admin.news.write', 'admin.feed.write', 'admin.featured.write',
  ],
  tipster: [],
  user: [],
};

export function hasPermission(role: Role | string | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  const list = PERMS[role as Role];
  return Array.isArray(list) && list.includes(perm);
}

export function permissionsFor(role: Role | string | undefined | null): Permission[] {
  if (!role) return [];
  return PERMS[role as Role] ?? [];
}

export function canAccessAdmin(role: Role | string | undefined | null): boolean {
  return hasPermission(role, 'admin.access');
}
