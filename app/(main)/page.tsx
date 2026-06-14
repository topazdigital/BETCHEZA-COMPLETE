import HomePageContent from './HomePageContent';
import { GET } from '@/app/api/home/route';

export default async function HomePage() {
  let initialHomeData: Record<string, unknown> | null = null;
  try {
    // Wait up to 3.5 s for the server-side data. When the match cache is warm
    // (which it always is after our deploy warmup), /api/home responds in
    // 200-600 ms so the page arrives fully populated — zero skeleton flash.
    // Previously this was 100 ms which always timed out (even warm cache takes
    // 600 ms) causing every user to see skeleton loaders on every page load.
    // Fall back to client-side SWR only on true cold start (> 3.5 s).
    const homePromise = GET();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ssr-timeout')), 3500),
    );
    const res = await Promise.race([homePromise, timeoutPromise]);
    initialHomeData = await res.json();
  } catch {
    // True cold start (all caches empty) — client-side SWR will hydrate
  }
  return <HomePageContent initialHomeData={initialHomeData} />;
}
