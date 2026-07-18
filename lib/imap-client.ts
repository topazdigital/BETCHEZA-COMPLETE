/**
 * imap-client.ts
 * Fetches emails from all betcheza.co.ke inboxes via IMAP.
 * All accounts share the same password (IMAP_PASSWORD).
 * Results are cached in memory for 2 minutes per account.
 */
import { ImapFlow } from 'imapflow';

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
// Account registry — all share one IMAP_PASSWORD secret
// ---------------------------------------------------------------------------
const IMAP_HOST = 'server.richdatingnetwork.com';
const IMAP_PORT = 993;

const ACCOUNTS = [
  { name: 'admin',        email: 'admin@betcheza.co.ke' },
  { name: 'support',      email: 'support@betcheza.co.ke' },
  { name: 'partnerships', email: 'partnerships@betcheza.co.ke' },
  { name: 'info',         email: 'info@betcheza.co.ke' },
];

function getPassword(): string {
  return process.env.IMAP_PASSWORD || '';
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
  pass: string,
  limit: number
): Promise<InboxEmail[]> {
  const now = Date.now();
  const cache = getCache();
  if (cache[acct.name] && now - cache[acct.name].ts < CACHE_TTL_MS) {
    return cache[acct.name].emails;
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
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
            const raw = msg.source.toString('utf-8');
            const textMatch = raw.match(/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\z)/i);
            const htmlMatch = raw.match(/Content-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\z)/i);
            if (textMatch) bodyText = decodeBody(textMatch[1]);
            if (htmlMatch) bodyHtml = decodeBody(htmlMatch[1]);
            if (!bodyText && !bodyHtml) {
              const bodyStart = raw.indexOf('\r\n\r\n');
              if (bodyStart !== -1) bodyText = decodeBody(raw.slice(bodyStart + 4));
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
  const pass = getPassword();
  if (!pass) throw new Error('IMAP_PASSWORD secret not set');

  const settled = await Promise.allSettled(
    ACCOUNTS.map(acct => fetchAccountEmails(acct, pass, limit))
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
  const pass = getPassword();
  if (!pass) return;
  const client = new ImapFlow({
    host: IMAP_HOST, port: IMAP_PORT, secure: true,
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

function decodeBody(raw: string): string {
  return raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
