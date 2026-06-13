import HomePageContent from './HomePageContent';
import { GET } from '@/app/api/home/route';

export default async function HomePage() {
  let initialHomeData: Record<string, unknown> | null = null;
  try {
    // Race against a 100ms timeout so the page never blocks rendering.
    // On a warm cache this returns in <5ms; cold cache falls back to client SWR.
    const homePromise = GET();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ssr-timeout')), 100),
    );
    const res = await Promise.race([homePromise, timeoutPromise]);
    initialHomeData = await res.json();
  } catch {
    // Cold cache or timeout — client-side SWR will hydrate the data
  }
  return <HomePageContent initialHomeData={initialHomeData} />;
}
