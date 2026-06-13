import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * Server-side admin layout.
 * Unauthenticated users → redirected to homepage (no separate admin login).
 * Authenticated but insufficient role → also redirected to homepage.
 * Admin logs in from the main site login button; once logged in, the
 * user menu shows "Admin Panel" which links here.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/');
  }

  if (!user || !canAccessAdmin(user.role)) {
    redirect('/');
  }

  const emailPrefix = user.email?.split('@')[0] || 'admin';

  return (
    <AdminShell user={{ displayName: emailPrefix, username: emailPrefix, role: user.role }}>
      {children}
    </AdminShell>
  );
}
