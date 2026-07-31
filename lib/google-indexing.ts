/**
 * Google Search Console Indexing API
 *
 * Sends URL_UPDATED notifications directly to Google's crawl queue.
 * Requires a service account JSON key with the Indexing API scope granted
 * in Google Search Console as an owner.
 *
 * Set GOOGLE_INDEXING_SA_KEY to the full service account JSON (base64 or raw).
 */

const INDEXING_API = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const SCOPE = 'https://www.googleapis.com/auth/indexing';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let _saCache: ServiceAccount | null | 'invalid' = null;

function getServiceAccount(): ServiceAccount | null {
  if (_saCache !== null) return _saCache === 'invalid' ? null : _saCache;

  const raw = process.env.GOOGLE_INDEXING_SA_KEY;
  if (!raw) { _saCache = 'invalid'; return null; }

  try {
    const decoded = raw.startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    const sa = JSON.parse(decoded) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) { _saCache = 'invalid'; return null; }
    _saCache = sa;
    return sa;
  } catch {
    _saCache = 'invalid';
    return null;
  }
}

/** Sign a JWT using the RSA private key from the service account. */
async function signJwt(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: SCOPE,
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import the PEM key
  const pem = sa.private_key.replace(/\\n/g, '\n');
  const keyData = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBuffer = Buffer.from(keyData, 'base64');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signingInput),
  );

  const sig = Buffer.from(signature).toString('base64url');
  return `${signingInput}.${sig}`;
}

interface TokenCache { token: string; exp: number }
let _tokenCache: TokenCache | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (_tokenCache && Date.now() / 1000 < _tokenCache.exp - 60) {
    return _tokenCache.token;
  }

  const jwt = await signJwt(sa);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google OAuth failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _tokenCache = { token: data.access_token, exp: Math.floor(Date.now() / 1000) + data.expires_in };
  return data.access_token;
}

export type IndexingType = 'URL_UPDATED' | 'URL_DELETED';

/**
 * Notify Google to crawl/index a URL immediately.
 * Returns true on success, false if the service account is not configured
 * or the request fails. Never throws.
 */
export async function pingGoogleIndexing(url: string, type: IndexingType = 'URL_UPDATED'): Promise<boolean> {
  const sa = getServiceAccount();
  if (!sa) return false;

  try {
    const token = await getAccessToken(sa);
    const res = await fetch(INDEXING_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, type }),
      cache: 'no-store',
    });

    if (res.ok) {
      console.info(`[GoogleIndexing] Queued ${type}: ${url}`);
      return true;
    }
    const body = await res.text();
    console.warn(`[GoogleIndexing] Failed ${res.status}: ${body}`);
    return false;
  } catch (err) {
    console.warn('[GoogleIndexing] Error:', err);
    return false;
  }
}

/**
 * Batch-ping multiple URLs. Runs sequentially to avoid rate limits.
 * Google allows up to 200 requests/day per property.
 */
export async function pingGoogleIndexingBatch(urls: string[], type: IndexingType = 'URL_UPDATED'): Promise<number> {
  let success = 0;
  for (const url of urls) {
    const ok = await pingGoogleIndexing(url, type);
    if (ok) success++;
    // 50 ms gap to stay well under rate limits
    await new Promise(r => setTimeout(r, 50));
  }
  return success;
}
