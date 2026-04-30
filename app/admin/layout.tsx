import { getCurrentUser } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminLoginGate } from '@/components/admin/admin-login-gate';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * Server-side admin layout. The /admin URL is no longer a free pass to the
 * dashboard — every render verifies the auth cookie and only lets in users
 * whose role grants `admin.access` (admin, moderator, editor).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return <AdminLoginGate reason="signin" />;
  }
  if (!canAccessAdmin(user.role)) {
    return <AdminLoginGate reason="forbidden" />;
  }

  return (
    <AdminShell user={{ displayName: user.displayName || user.username || 'Admin', username: user.username || 'admin', role: user.role }}>
      {children}
    </AdminShell>
  );
}
