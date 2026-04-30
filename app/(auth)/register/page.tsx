'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthModal } from '@/contexts/auth-modal-context';

/**
 * Legacy /register route — opens the auth modal (Sign-up tab) in place,
 * sending the user back to whatever page they came from instead of always
 * dumping them on the home page.
 */
export default function RegisterRedirect() {
  const router = useRouter();
  const { open } = useAuthModal();

  useEffect(() => {
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
  }, [router, open]);

  return null;
}
