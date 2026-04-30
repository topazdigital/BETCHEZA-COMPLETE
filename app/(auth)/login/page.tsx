'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthModal } from '@/contexts/auth-modal-context';

/**
 * Legacy /login route — opens the auth modal in place. If the user landed
 * here from another page on the site we send them back there; otherwise we
 * fall back to the home page. Either way the modal opens so the user can
 * sign in without losing context.
 */
export default function LoginRedirect() {
  const router = useRouter();
  const { open } = useAuthModal();

  useEffect(() => {
    open('login');
    if (typeof window === 'undefined') {
      router.replace('/');
      return;
    }
    // Prefer an explicit ?next= query parameter (set by callers like the
    // follow-team button). If not provided, try the Referer header so users
    // land back on whichever page they came from instead of the homepage —
    // and never bounce them onto /players/compare or any other unrelated
    // page just because that happened to be the previous referer.
    let target = '/';
    try {
      const url = new URL(window.location.href);
      const next = url.searchParams.get('next');
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        target = next;
      } else {
        const ref = document.referrer;
        if (ref) {
          const r = new URL(ref);
          if (
            r.origin === window.location.origin
            && r.pathname !== '/login'
            && r.pathname !== '/register'
          ) {
            target = r.pathname + r.search + r.hash;
          }
        }
      }
    } catch { /* fall through to '/' */ }
    router.replace(target);
  }, [router, open]);

  return null;
}
