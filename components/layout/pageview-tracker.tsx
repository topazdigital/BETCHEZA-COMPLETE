'use client';

import { useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';

function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}

export function PageviewTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
