import HomePageContent from './HomePageContent';

export default async function HomePage() {
  let initialHomeData: Record<string, unknown> | null = null;
  try {
    // Dynamic import so the massive unified-sports-api module is NOT pulled
    // into memory during `next build`'s "Collecting page data" phase.
    // A static top-level import was causing OOM kills on the VPS during build
    // because every page module loaded the full ESPN league data structures.
    const { GET } = await import('@/app/api/home/route');
    // Short 800 ms SSR prefetch — only serves warm-cache hits (< 200 ms).
    // Any cache miss or DB contention will exceed 800 ms, at which point we
    // return immediately and let client-side SWR hydrate the page.
    const homePromise = GET();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ssr-timeout')), 800),
    );
    const res = await Promise.race([homePromise, timeoutPromise]);
    initialHomeData = await res.json();
  } catch {
    // Cache miss or slow startup — client-side SWR handles data loading
  }
  return <HomePageContent initialHomeData={initialHomeData} />;
}
