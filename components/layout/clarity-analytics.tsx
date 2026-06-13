'use client';

import { useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

function initClarity(projectId: string) {
  if (typeof window === 'undefined') return;
  if (window.clarity) return;
  (function (c: Window, l: Document, a: string, r: string, i: string) {
    (c as unknown as Record<string, unknown>)[a] =
      (c as unknown as Record<string, unknown>)[a] ||
      function (...args: unknown[]) {
        (((c as unknown as Record<string, unknown>)[a] as { q?: unknown[] }).q =
          ((c as unknown as Record<string, unknown>)[a] as { q?: unknown[] }).q || []).push(args);
      };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = 'https://www.clarity.ms/tag/' + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, 'clarity', 'script', projectId);
}

function ClarityPageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!CLARITY_PROJECT_ID || typeof window === 'undefined') return;
    window.clarity?.('set', 'pageview', pathname);
  }, [pathname]);

  return null;
}

export function ClarityAnalytics() {
  useEffect(() => {
    if (!CLARITY_PROJECT_ID) return;
    initClarity(CLARITY_PROJECT_ID);
  }, []);

  return (
    <Suspense fallback={null}>
      <ClarityPageTracker />
    </Suspense>
  );
}
