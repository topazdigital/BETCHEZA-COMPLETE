/**
 * imap-client.ts
 * Fetches emails from all betcheza.co.ke inboxes via IMAP.
 * Password is read from:
 *   1. IMAP_PASSWORD env var (Replit dev)
 *   2. SMTP password stored in admin Email Config (production)
 * IMAP host is derived from the SMTP host set in Email Config.
 */
import { ImapFlow } from 'imapflow';
import { getEmailConfig } from './email-config-store';

export interface InboxEmail {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  date: string; // ISO
  bodyText: string;
  bodyHtml: string;
  seen: boolean;
  source: 'imap';
  account: string;      // e.g. "partnerships"
  accountEmail: string; // full address
}

// ---------------------------------------------------------------------------
// Account registry
// ---------------------------------------------------------------------------
const FALLBACK_IMAP_HOST = 'mail.betcheza.co.ke';
const IMAP_PORT = 993;

const ACCOUNTS = [
  { name: 'support',      email: 'support@betcheza.co.ke' },
  { name: 'partnerships', email: 'partnerships@betcheza.co.ke' },
  { name: 'info',         email: 'info@betcheza.co.ke' },
];

/** Resolve IMAP credentials — env var first, then saved Email Config. */
async function getImapConfig(): Promise<{ host: string; pass: string }> {
  const envPass = process.env.IMAP_PASSWORD || '';
  if (envPass) return { host: FALLBACK_IMAP_HOST, pass: envPass };

  const cfg = await getEmailConfig();
  const pass = cfg.password || '';
  // Derive IMAP host from SMTP host (same mail server, different port)
  const host = cfg.host || FALLBACK_IMAP_HOST;
  return { host, pass };
}

// ---------------------------------------------------------------------------
// Per-account in-memory cache
// ---------------------------------------------------------------------------
interface CacheEntry { ts: number; emails: InboxEmail[] }
const g = globalThis as { __imapAccountCache?: Record<string, CacheEntry> };
const CACHE_TTL_MS = 2 * 60 * 1000;

function getCache(): Record<string, CacheEntry> {
  if (!g.__imapAccountCache) g.__imapAccountCache = {};
  return g.__imapAccountCache;
}

export function invalidateImapCache(account?: string) {
  const cache = getCache();
  if (account) delete cache[account];
  else g.__imapAccountCache = {};
}

// ---------------------------------------------------------------------------
// Fetch emails for one account
// ---------------------------------------------------------------------------
async function fetchAccountEmails(
  acct: typeof ACCOUNTS[number],
  host: string,
  pass: string,
  limit: number
): Promise<InboxEmail[]> {
  const now = Date.now();
  const cache = getCache();
  if (cache[acct.name] && now - cache[acct.name].ts < CACHE_TTL_MS) {
    return cache[acct.name].emails;
  }

  const client = new ImapFlow({
    host,
    port: IMAP_PORT,
    secure: true,
    auth: { user: acct.email, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  const emails: InboxEmail[] = [];
  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');
    const total = mailbox.exists;
    if (total > 0) {
      const start = Math.max(1, total - limit + 1);
      for await (const msg of client.fetch(`${start}:${total}`, {
        uid: true, flags: true, envelope: true, source: true,
      })) {
        try {
          const env = msg.envelope;
          const fromAddr = env?.from?.[0];
          const fromEmail = fromAddr?.address || '';
          const fromName  = fromAddr?.name || fromEmail;
          const toStr     = env?.to?.[0]?.address || acct.email;
          const subject   = env?.subject || '(no subject)';
          const date      = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();
          const seen      = msg.flags?.has('\\Seen') ?? false;

          let bodyText = '', bodyHtml = '';
          if (msg.source) {
            // Use binary (Latin-1) to preserve raw bytes — do NOT assume UTF-8
            const raw = msg.source.toString('binary');
            bodyText = extractMimePart(raw, 'text/plain');
            bodyHtml = extractMimePart(raw, 'text/html');
            if (!bodyText && !bodyHtml) {
              const bodyStart = raw.indexOf('\r\n\r\n');
              if (bodyStart !== -1) bodyText = decodePart(raw.slice(bodyStart + 4), '7bit', 'utf-8');
            }
          }

          emails.push({
            uid: msg.uid,
            messageId: env?.messageId || `${msg.uid}@${acct.name}`,
            from: fromName, fromEmail, to: toStr, subject, date,
            bodyText: bodyText.trim(), bodyHtml: bodyHtml.trim(),
            seen, source: 'imap', account: acct.name, accountEmail: acct.email,
          });
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  cache[acct.name] = { ts: now, emails };
  return emails;
}

// ---------------------------------------------------------------------------
// Public: fetch all accounts in parallel, merge & sort newest-first
// ---------------------------------------------------------------------------
export async function fetchInboxEmails(limit = 60): Promise<{
  emails: InboxEmail[];
  accounts: { name: string; email: string }[];
  errors: { account: string; message: string }[];
}> {
  const { host, pass } = await getImapConfig();
  if (!pass) throw new Error('No IMAP password configured. Set it in Admin → Config → Email Setup.');

  const settled = await Promise.allSettled(
    ACCOUNTS.map(acct => fetchAccountEmails(acct, host, pass, limit))
  );

  const allEmails: InboxEmail[] = [];
  const errors: { account: string; message: string }[] = [];

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') allEmails.push(...r.value);
    else errors.push({ account: ACCOUNTS[i].name, message: String(r.reason) });
  });

  allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Only surface accounts that succeeded
  const successNames = new Set(
    settled.flatMap((r, i) => r.status === 'fulfilled' ? [ACCOUNTS[i].name] : [])
  );
  const accounts = ACCOUNTS.filter(a => successNames.has(a.name));

  return { emails: allEmails, accounts, errors };
}

// ---------------------------------------------------------------------------
// Mark a message seen on a specific account
// ---------------------------------------------------------------------------
export async function markEmailSeen(uid: number, account: string): Promise<void> {
  const acct = ACCOUNTS.find(a => a.name === account);
  if (!acct) return;
  const { host, pass } = await getImapConfig();
  if (!pass) return;
  const client = new ImapFlow({
    host, port: IMAP_PORT, secure: true,
    auth: { user: acct.email, pass }, logger: false,
    tls: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    await client.messageFlagsAdd({ uid: true }, [uid], ['\\Seen']);
  } finally {
    await client.logout().catch(() => {});
  }
  invalidateImapCache(account);
}

/**
 * Extract a text/plain or text/html part from a raw binary RFC2822 message,
 * respecting its Content-Transfer-Encoding and charset.
 */
function extractMimePart(raw: string, mimeType: string): string {
  // Match the part header + body. We look for the Content-Type line followed
  // by optional folded header lines, then a blank line, then the body.
  const partRe = new RegExp(
    `Content-Type:\\s*${mimeType.replace('/', '\\/')}[^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*\\r?\\n` +
    `([\\s\\S]*?\\r?\\n)?\\r?\\n` +   // remaining part headers (e.g. CTE)
    `([\\s\\S]*?)(?=\\r?\\n--|$)`,
    'i'
  );
  const m = raw.match(partRe);
  if (!m) return '';

  // Re-capture the full block so we can find headers before the body
  const blockStart = m.index!;
  const blankLine = raw.indexOf('\r\n\r\n', blockStart);
  if (blankLine === -1) return '';

  const headerBlock = raw.slice(blockStart, blankLine);
  const body = raw.slice(blankLine + 4);
  // Trim at the next MIME boundary
  const bodyContent = body.split(/\r?\n--/)[0];

  // Extract Content-Transfer-Encoding
  const cteMatch = headerBlock.match(/Content-Transfer-Encoding:\s*(\S+)/i);
  const encoding = cteMatch ? cteMatch[1].replace(/[";]/g, '').trim() : '7bit';

  // Extract charset (may span a folded line)
  const charsetMatch = headerBlock.replace(/\r?\n[ \t]/g, ' ').match(/charset=["']?([^"'\s;]+)/i);
  const charset = charsetMatch ? charsetMatch[1] : 'utf-8';

  return decodePart(bodyContent, encoding, charset);
}

/**
 * Decode a MIME body part given its transfer encoding and charset.
 * `raw` must be a binary (Latin-1) string — one char per byte.
 */
function decodePart(raw: string, encoding: string, charset: string): string {
  let bytes: Buffer;
  const enc = (encoding || '7bit').toLowerCase().trim();

  if (enc === 'base64') {
    bytes = Buffer.from(raw.replace(/\s/g, ''), 'base64');
  } else if (enc === 'quoted-printable') {
    const qp = raw
      .replace(/=\r?\n/g, '')                                          // soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    bytes = Buffer.from(qp, 'binary');
  } else {
    // 7bit / 8bit / binary
    bytes = Buffer.from(raw, 'binary');
  }

  // Normalise charset name for TextDecoder
  const cs = (charset || 'utf-8').toLowerCase()
    .replace(/^utf8$/, 'utf-8')
    .replace(/^latin[-_]?1$/i, 'iso-8859-1');
  try {
    return new TextDecoder(cs, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}
