/**
 * proxy-fetch — routes sports API requests through a Cloudflare Worker proxy
 * when CF_WORKER_URL is configured, bypassing IP-level blocks on SofaScore,
 * ESPN, FotMob, and other providers that block shared cloud IPs.
 *
 * Falls back to a direct fetch automatically when CF_WORKER_URL is not set,
 * so the app still works in environments where direct access is available.
 *
 * Set these in Replit Secrets:
 *   CF_WORKER_URL    = https://<your-worker>.workers.dev
 *   CF_WORKER_SECRET = <same secret set in Cloudflare Worker env>  (optional)
 */

export interface ProxyFetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Fetch a URL, routing through the Cloudflare Worker proxy if configured.
 * Drop-in replacement for `fetch()` for server-side sports API calls.
 */
export async function proxyFetch(
  url: string,
  options: ProxyFetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 10_000, ...fetchOptions } = options;
  const workerUrl = process.env.CF_WORKER_URL;
  const workerSecret = process.env.CF_WORKER_SECRET;

  if (workerUrl) {
    const proxyTarget = `${workerUrl.replace(/\/$/, '')}/proxy?url=${encodeURIComponent(url)}`;
    const headers: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string> | undefined),
    };
    if (workerSecret) {
      headers['X-Proxy-Secret'] = workerSecret;
    }
    // Forward any API keys from the original headers through to the worker
    const origHeaders = (fetchOptions.headers || {}) as Record<string, string>;
    for (const [k, v] of Object.entries(origHeaders)) {
      const lk = k.toLowerCase();
      if (lk === 'x-auth-token' || lk === 'authorization' || lk === 'x-rapidapi-key') {
        headers[k] = v;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(proxyTarget, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  // Direct fetch fallback
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Returns true when the Cloudflare proxy is configured. */
export function isProxyConfigured(): boolean {
  return Boolean(process.env.CF_WORKER_URL);
}

/**
 * Direct fetch — bypasses the CF Worker proxy entirely.
 * Use this for APIs that don't block Replit IPs (ESPN, api-sports, etc.)
 * so CF Worker quota is reserved for SofaScore and FotMob only.
 */
export async function directFetch(
  url: string,
  options: ProxyFetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 10_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
