import HomePageContent from './HomePageContent';
import { GET } from '@/app/api/home/route';

export default async function HomePage() {
  let initialHomeData: Record<string, unknown> | null = null;
  try {
    // Short 800 ms SSR prefetch — only serves warm-cache hits (< 200 ms).
    // Any cache miss or DB contention (e.g. startup settle-tips running) will
    // exceed 800 ms, at which point we return immediately and let client-side
    // SWR hydrate the page. This prevents the server from hanging on slow
    // startup DB queries, which previously caused 17-23 s page loads that
    // starved PM2 workers and made the site appear completely blank.
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
