/**
 * Betcheza Sports Data Proxy — Cloudflare Worker
 *
 * Deploys to Cloudflare Workers (free tier: 100k req/day).
 * Proxies requests to IP-blocked sports data APIs (SofaScore, ESPN, FotMob,
 * football-data.org, The Odds API) from a clean Cloudflare edge IP.
 *
 * SETUP:
 *   1. Install Wrangler: npm install -g wrangler
 *   2. wrangler login
 *   3. cd cloudflare-worker && wrangler deploy
 *   4. Set CF_WORKER_URL=https://<your-worker>.workers.dev in Replit Secrets
 *   5. Optionally set CF_WORKER_SECRET=<random-string> in both:
 *      - Replit Secrets (as CF_WORKER_SECRET)
 *      - Cloudflare Worker env var (via wrangler.toml or dashboard)
 *
 * REQUEST FORMAT:
 *   GET https://<worker>.workers.dev/proxy?url=<encoded-target-url>
 *   Header: X-Proxy-Secret: <CF_WORKER_SECRET>   (optional but recommended)
 *
 * The worker adds appropriate browser-like headers per domain so anti-bot
 * protections don't trigger.
 */

const ALLOWED_HOSTS = [
  'api.sofascore.com',
  'api.sofascore.app',
  'mobile.api.sofascore.app',
  'site.api.espn.com',
  'site.web.api.espn.com',
  'www.fotmob.com',
  'api.football-data.org',
  'api.the-odds-api.com',
  'www.thesportsdb.com',
  'v3.football.api-sports.io',
  'v3.basketball.api-sports.io',
  'v3.tennis.api-sports.io',
];

function headersForHost(host) {
  const common = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };

  if (host.includes('sofascore.com')) {
    // SofaScore uses Cloudflare bot challenge — we need to look like a real
    // mobile app client rather than a browser scraper to bypass the challenge.
    return {
      'User-Agent': 'SofaScore/167 CFNetwork/1408.0.4 Darwin/22.5.0',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'x-locale': 'en_US',
    };
  }

  if (host.includes('fotmob.com')) {
    return {
      ...common,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer': 'https://www.fotmob.com/',
      'Origin': 'https://www.fotmob.com',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'Cache-Control': 'no-cache',
    };
  }

  if (host.includes('espn.com')) {
    return {
      ...common,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer': 'https://www.espn.com/',
      'Origin': 'https://www.espn.com',
    };
  }

  return {
    ...common,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, worker: 'betcheza-proxy', ts: Date.now() });
    }

    if (url.pathname !== '/proxy') {
      return json({ error: 'Use /proxy?url=<encoded-url>' }, 404);
    }

    // Optional secret check
    const workerSecret = env.CF_WORKER_SECRET;
    if (workerSecret) {
      const clientSecret = request.headers.get('X-Proxy-Secret');
      if (clientSecret !== workerSecret) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return json({ error: 'Missing ?url= parameter' }, 400);
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      return json({ error: 'Invalid target URL' }, 400);
    }

    const targetHost = parsedTarget.hostname;
    const isAllowed = ALLOWED_HOSTS.some(h => targetHost === h || targetHost.endsWith('.' + h));
    if (!isAllowed) {
      return json({ error: `Host not allowed: ${targetHost}` }, 403);
    }

    // Forward original Authorization / API key headers from the client request
    const forwardHeaders = headersForHost(targetHost);
    for (const [k, v] of request.headers.entries()) {
      const lk = k.toLowerCase();
      if (lk === 'x-auth-token' || lk === 'authorization' || lk === 'x-rapidapi-key') {
        forwardHeaders[k] = v;
      }
    }

    try {
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        cf: { cacheTtl: 30, cacheEverything: false },
      });

      const body = await upstream.arrayBuffer();
      const contentType = upstream.headers.get('content-type') || 'application/json';

      return new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType,
          'X-Proxy-Status': String(upstream.status),
          'X-Proxy-Host': targetHost,
          ...corsHeaders(),
        },
      });
    } catch (err) {
      return json({ error: 'Upstream fetch failed', detail: String(err) }, 502);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Secret, X-Auth-Token, Authorization',
  };
}
