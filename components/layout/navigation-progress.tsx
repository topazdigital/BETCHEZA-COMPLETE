'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';

function ProgressBar() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavigating = useRef(false);

  function startBar() {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setWidth(12);
    setVisible(true);
    let current = 12;
    intervalRef.current = setInterval(() => {
      current += (85 - current) * 0.12 + 1;
      if (current >= 84) { clearInterval(intervalRef.current!); current = 84; }
      setWidth(current);
    }, 140);
  }

  function completeBar() {
    if (!isNavigating.current) return;
    isNavigating.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setWidth(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 350);
  }

  useEffect(() => {
    completeBar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest('a');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('/') || href === pathname) return;
      startBar();
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible && width === 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[3px] bg-primary shadow-[0_0_8px_1px] shadow-primary/60"
      style={{
        width: `${width}%`,
        transition: width === 100 ? 'width 0.15s ease-out, opacity 0.35s 0.1s' : 'width 0.14s linear',
        opacity: visible ? 1 : 0,
      }}
    />
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
