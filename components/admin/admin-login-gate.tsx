'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, ShieldAlert, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';

interface AdminLoginGateProps {
  reason: 'signin' | 'forbidden';
}

/**
 * Standalone admin login screen. Shown by `app/admin/layout.tsx` whenever the
 * incoming request doesn't carry a valid admin cookie. Replaces the previous
 * behaviour where /admin rendered the dashboard for everyone.
 */
export function AdminLoginGate({ reason }: AdminLoginGateProps) {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Invalid credentials');
      return;
    }
    if (result.requiresTwoFactor) {
      setError('This admin account has 2FA enabled — sign in via the main site, then return to /admin.');
      return;
    }
    // Re-render the layout so the server picks up the new cookie.
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            {reason === 'forbidden' ? <ShieldAlert className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {reason === 'forbidden' ? 'Admin access required' : 'Admin sign in'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {reason === 'forbidden'
              ? 'Your account is signed in but does not have admin privileges.'
              : 'Enter your administrator credentials to continue.'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          {reason === 'forbidden' ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                You are signed in as a regular user. Sign out and log in with an admin account.
              </div>
              <Button onClick={() => logout().then(() => router.refresh())} className="w-full" variant="destructive">
                Sign out and try a different account
              </Button>
              <Link href="/" className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
                Back to site
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@your-domain"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Your admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Toggle password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Sign in to admin'
                )}
              </Button>

              <Link
                href="/"
                className="block text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                ← Back to public site
              </Link>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Tip: change the public admin URL by adding a rewrite in
          <span className="px-1 font-mono">Admin → Settings → URL Rewrites</span>
          (e.g.&nbsp;
          <span className="font-mono">/control-panel → /admin</span>).
        </p>
      </div>
    </div>
  );
}
