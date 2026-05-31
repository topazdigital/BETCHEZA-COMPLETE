/**
 * IndexNow — real-time indexing freshness signal for Bing, Yandex,
 * and (via Bing's relay) Google. When a match result lands, call
 * pingIndexNow([url]) so search engines recrawl within minutes rather
 * than waiting for their regular crawl schedule.
 *
 * Spec: https://www.indexnow.org/documentation
 * Key file must be publicly accessible at: /INDEXNOW_KEY.txt
 */

const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY || 'betcheza2026ke';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke'
).replace(/\/$/, '');

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

const g = globalThis as {
  __indexNowQueue?: string[];
  __indexNowFlushTimer?: ReturnType<typeof setTimeout>;
};
if (!g.__indexNowQueue) g.__indexNowQueue = [];

/**
 * Queue URLs and flush to IndexNow after a 5-second debounce.
 * Multiple goal/result events within the same cron tick are batched
 * into a single API call (IndexNow max is 10,000 URLs per request).
 */
export function pingIndexNow(urls: string[]): void {
  if (!urls.length) return;

  const queue = g.__indexNowQueue!;
  for (const u of urls) {
    const abs = u.startsWith('http') ? u : `${SITE_URL}${u}`;
    if (!queue.includes(abs)) queue.push(abs);
  }

  if (g.__indexNowFlushTimer) clearTimeout(g.__indexNowFlushTimer);
  g.__indexNowFlushTimer = setTimeout(() => flushQueue(), 5_000);
}

async function flushQueue(): Promise<void> {
  const queue = g.__indexNowQueue!;
  if (!queue.length) return;
  const batch = queue.splice(0, 10_000);

  try {
    const host = new URL(SITE_URL).hostname;
    const payload = {
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: batch,
    };

    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`[indexnow] ✓ Pinged ${batch.length} URL(s) → ${res.status}`);
    } else if (res.status === 422) {
      console.warn(`[indexnow] 422 — URL(s) not on this host or key mismatch`);
    } else {
      const text = await res.text().catch(() => '');
      console.warn(`[indexnow] Unexpected ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn('[indexnow] flush failed:', e instanceof Error ? e.message : e);
    // Re-queue for next cron tick
    g.__indexNowQueue!.unshift(...batch);
  }
}

/**
 * Convenience: build the canonical match URL and ping it.
 * Safe to call fire-and-forget — errors are swallowed internally.
 *
 * matchToSlug is imported lazily to avoid a circular-dependency issue
 * if indexnow.ts is ever imported from within match-url.ts.
 */
export async function pingMatchResult(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
): Promise<void> {
  try {
    const { matchToSlug } = await import('@/lib/utils/match-url');
    const slug = matchToSlug(matchId, homeTeam, awayTeam);
    pingIndexNow([`${SITE_URL}/matches/${slug}`]);
  } catch {
    pingIndexNow([`${SITE_URL}/matches/${encodeURIComponent(matchId)}`]);
  }
}
