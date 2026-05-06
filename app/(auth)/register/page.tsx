'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthModal } from '@/contexts/auth-modal-context';

/**
 * Legacy /register route — opens the auth modal (Sign-up tab) in place,
 * sending the user back to whatever page they came from instead of always
 * dumping them on the home page.
 * If a ?ref=CODE query param is present, it's stored in a cookie so the
 * register API can attribute the signup to the referrer.
 */
export default function RegisterRedirect() {
  const router = useRouter();
  const { open } = useAuthModal();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Capture referral code from URL and persist it as a 30-day cookie
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
