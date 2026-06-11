import HomePageContent from './HomePageContent';
import { GET } from '@/app/api/home/route';

export default async function HomePage() {
  let initialHomeData: Record<string, unknown> | null = null;
  try {
    // Race against a 2-second timeout so the page responds quickly even when
    // the home data cache is cold. On a warm cache this returns in <5ms.
    const homePromise = GET();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ssr-timeout')), 2000),
    );
    const res = await Promise.race([homePromise, timeoutPromise]);
    initialHomeData = await res.json();
  } catch {
    // Cold cache or timeout — client-side SWR will hydrate the data
  }
  return <HomePageContent initialHomeData={initialHomeData} />;
}
