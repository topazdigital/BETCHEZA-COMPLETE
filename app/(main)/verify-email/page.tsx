'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

type Status = 'idle' | 'verifying' | 'ok' | 'error';

function VerifyEmailPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { refreshUser, isAuthenticated } = useAuth();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'idle');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success) {
          setStatus('ok');
          if (isAuthenticated) await refreshUser();
        } else {
          setStatus('error');
          setError(data.error || 'We could not verify this link.');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setError('Network error. Please try again.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, isAuthenticated, refreshUser]);

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        {status === 'idle' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the verification email we just sent and click the verify
              button — or paste the 6-digit code into your account.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link href="/">Back to homepage</Link>
            </Button>
          </div>
        )}

        {status === 'verifying' && (
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h1 className="text-xl font-bold">Verifying your email…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hang tight, this only takes a moment.
            </p>
          </div>
        )}

        {status === 'ok' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">You&apos;re all set!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your email is verified. You now have full access to tips, alerts
              and tipster follows.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="outline" asChild>
                <Link href="/">Home</Link>
              </Button>
              <Button onClick={() => router.push('/dashboard')}>Go to dashboard</Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <XCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Verification failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sign in and request a fresh code from your account.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="outline" asChild>
                <Link href="/">Home</Link>
              </Button>
              <Button asChild>
                <Link href="/?auth=login">Sign in</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}
