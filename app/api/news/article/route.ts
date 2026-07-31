import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Pulls the article body out of an ESPN (or generic news) page so we can
// render it inline at /news/article without bouncing the user offsite.
//
// Strategy:
// 1. Try ESPN's JSON-LD `articleBody` block.
// 2. Fall back to scraping <p> tags inside the main article container.
// 3. Cache for 5 minutes.

interface ArticleResult {
  ok: boolean;
  body?: string;          // plain-text paragraphs joined by \n\n
  paragraphs?: string[];
  image?: string;
  source?: string;
  error?: string;
}

const ALLOWED_HOSTS = new Set([
  'www.espn.com', 'espn.com', 'www.espn.co.uk',
  'www.espn.in', 'www.espnfc.com',
]);

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractParagraphs(html: string): string[] {
  // Try every <p> tag first; we'll filter trailing footer noise after.
  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = stripTags(match[1]);
    if (text.length >= 30) paragraphs.push(text);
  }
  // Drop boilerplate
  return paragraphs.filter(p =>
    !/copyright|all rights reserved|terms of (?:use|service)/i.test(p) &&
    !/^download the espn app/i.test(p)
  );
}

function extractFromJsonLd(html: string): { body?: string; image?: string } {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  if (!blocks) return {};
  for (const b of blocks) {
    const inner = b.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    try {
      const data = JSON.parse(inner) as Record<string, unknown> | Record<string, unknown>[];
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const body = (item as { articleBody?: unknown }).articleBody;
        if (typeof body === 'string' && body.length > 80) {
          const imgRaw = (item as { image?: unknown }).image;
          let image: string | undefined;
          if (typeof imgRaw === 'string') image = imgRaw;
          else if (Array.isArray(imgRaw) && typeof imgRaw[0] === 'string') image = imgRaw[0];
          else if (imgRaw && typeof imgRaw === 'object' && 'url' in (imgRaw as Record<string, unknown>)) {
            const u = (imgRaw as { url?: unknown }).url;
            if (typeof u === 'string') image = u;
          }
          return { body, image };
        }
      }
    } catch { /* ignore broken JSON-LD */ }
  }
  return {};
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  if (!target) {
    return NextResponse.json<ArticleResult>({ ok: false, error: 'Missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json<ArticleResult>({ ok: false, error: 'Invalid url' }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return NextResponse.json<ArticleResult>(
      { ok: false, error: `Host ${parsed.host} not allowed` },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BetchezaBot/1.0; +https://betcheza.co.ke)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      // Cache lightly — most articles don't change after publish
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json<ArticleResult>(
        { ok: false, error: `Upstream ${res.status}` },
        { status: 502 },
      );
    }
    const html = await res.text();

    // Prefer the structured JSON-LD body when present.
    const ld = extractFromJsonLd(html);
    let paragraphs: string[];
    if (ld.body) {
      paragraphs = ld.body
        .split(/\n+/)
        .map(s => s.trim())
        .filter(s => s.length >= 30);
    } else {
      paragraphs = extractParagraphs(html);
    }

    if (paragraphs.length === 0) {
      return NextResponse.json<ArticleResult>(
        { ok: false, error: 'Could not extract article body' },
        { status: 422 },
      );
    }

    return NextResponse.json<ArticleResult>(
      {
        ok: true,
        paragraphs,
        body: paragraphs.join('\n\n'),
        image: ld.image,
        source: parsed.host,
      },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (e) {
    console.error('[news/article] fetch failed', e);
    return NextResponse.json<ArticleResult>(
      { ok: false, error: 'Fetch failed' },
      { status: 502 },
    );
  }
}
