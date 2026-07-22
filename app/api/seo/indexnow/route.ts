/**
 * IndexNow ping API — tells Bing, Yandex, and other IndexNow-compatible search
 * engines about new/updated URLs immediately so they're crawled within minutes
 * rather than waiting for the weekly sitemap crawl.
 *
 * Setup:
 *  1. Generate an IndexNow key at https://www.bing.com/indexnow
 *  2. Add it as a Replit secret:  INDEXNOW_API_KEY=<your-key>
 *  3. Create a verification file at /public/<your-key>.txt containing just the key
 *
 * Called automatically by the cron/live-scores job when new matches are discovered.
 * Also callable manually: POST /api/seo/indexnow  { urls: ["https://..."] }
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_BATCH = 10_000; // IndexNow limit

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://betcheza.co.ke'
  ).replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.INDEXNOW_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'INDEXNOW_API_KEY not configured. Set it as a Replit secret.' },
      { status: 503 }
    );
  }

  const host = siteUrl().replace(/^https?:\/\//, '');
  const keyLocation = `${siteUrl()}/${apiKey}.txt`;

  let urls: string[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body.urls)) {
      urls = body.urls
        .filter((u: unknown) => typeof u === 'string' && u.startsWith('http'))
        .slice(0, MAX_URLS_PER_BATCH);
    }
  } catch { /* ignore parse error */ }

  if (urls.length === 0) {
    // No specific URLs — ping the sitemap page itself so Bing re-crawls it
    urls = [`${siteUrl()}/sitemap.xml`];
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: apiKey,
        keyLocation,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    // 200 = submitted, 202 = accepted (both are success)
    if (res.ok || res.status === 202) {
      console.log(`[indexnow] submitted ${urls.length} URL(s) — HTTP ${res.status}`);
      return NextResponse.json({ ok: true, submitted: urls.length, status: res.status });
    }

    const text = await res.text().catch(() => '');
    console.warn(`[indexnow] submission failed HTTP ${res.status}: ${text.slice(0, 200)}`);
    return NextResponse.json(
      { ok: false, error: `IndexNow returned HTTP ${res.status}`, detail: text.slice(0, 200) },
      { status: 502 }
    );
  } catch (err) {
    console.error('[indexnow] fetch error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}

/** GET — health check / key verification */
export async function GET() {
  const apiKey = process.env.INDEXNOW_API_KEY;
  return NextResponse.json({
    configured: !!apiKey,
    host: siteUrl().replace(/^https?:\/\//, ''),
    keyLocation: apiKey ? `${siteUrl()}/${apiKey}.txt` : null,
    endpoint: INDEXNOW_ENDPOINT,
    instructions: !apiKey
      ? [
          '1. Go to https://www.bing.com/indexnow to generate a key',
          '2. Add INDEXNOW_API_KEY as a Replit secret',
          '3. Create /public/<key>.txt containing just the key string',
        ]
      : ['Configured ✓ — POST to this endpoint with { "urls": [...] } to submit URLs'],
  });
}
