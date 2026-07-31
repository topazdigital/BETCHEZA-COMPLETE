'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthModal } from '@/contexts/auth-modal-context';

function RegisterRedirectInner() {
  const router = useRouter();
  const { open } = useAuthModal();
  const searchParams = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `bz_ref=${encodeURIComponent(refCode)}; expires=${expires}; path=/; SameSite=Lax`;
    }

    open('register');
    if (typeof window === 'undefined') {
      router.replace('/');
      return;
    }
    const ref = document.referrer;
    let target = '/';
    try {
      if (ref) {
        const r = new URL(ref);
        if (r.origin === window.location.origin && r.pathname !== '/register') {
          target = r.pathname + r.search + r.hash;
        }
      }
    } catch { /* fall through to '/' */ }
    router.replace(target);
  }, [router, open, searchParams]);

  return null;
}

export default function RegisterRedirect() {
  return (
    <Suspense>
      <RegisterRedirectInner />
    </Suspense>
  );
}
