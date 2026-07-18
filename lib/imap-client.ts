/**
 * imap-client.ts
 * Fetches emails from one or more betcheza.co.ke inboxes via IMAP.
 * Accounts are auto-discovered from IMAP_PASSWORD_* env vars.
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
  account: string; // e.g. "partnerships" | "support"
  accountEmail: string; // full address
}

// ---------------------------------------------------------------------------
// Account registry — add new email accounts here.
// The password secret key format is IMAP_PASSWORD_<ACCOUNT> (uppercase).
// For the default "partnerships" account, IMAP_PASSWORD also works as fallback.
// ---------------------------------------------------------------------------
const IMAP_HOST = 'server.richdatingnetwork.com';
const IMAP_PORT = 993;

interface AccountDef {
  name: string;        // short label, e.g. "partnerships"
  email: string;       // full IMAP username
  secretKey: string;   // env var name for the password
  fallbackKey?: string; // alternate env var (legacy)
}

const ACCOUNTS: AccountDef[] = [
  {
    name: 'partnerships',
    email: 'partnerships@betcheza.co.ke',
    secretKey: 'IMAP_PASSWORD_PARTNERSHIPS',
    fallbackKey: 'IMAP_PASSWORD',           // backward-compat with existing secret
  },
  {
    name: 'support',
    email: 'support@betcheza.co.ke',
    secretKey: 'IMAP_PASSWORD_SUPPORT',
  },
  {
    name: 'info',
    email: 'info@betcheza.co.ke',
    secretKey: 'IMAP_PASSWORD_INFO',
  },
];

function getAccountPassword(acct: AccountDef): string {
  return (
    process.env[acct.secretKey] ||
    (acct.fallbackKey ? process.env[acct.fallbackKey] || '' : '')
  );
}

// ---------------------------------------------------------------------------
// Per-account in-memory cache
// ---------------------------------------------------------------------------
interface CacheEntry { ts: number; emails: InboxEmail[] }
const g = globalThis as { __imapAccountCache?: Record<string, CacheEntry> };
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

function getCache(): Record<string, CacheEntry> {
  if (!g.__imapAccountCache) g.__imapAccountCache = {};
  return g.__imapAccountCache;
}

export function invalidateImapCache(account?: string) {
  const cache = getCache();
  if (account) {
    delete cache[account];
  } else {
    g.__imapAccountCache = {};
  }
}

// ---------------------------------------------------------------------------
// Fetch emails for a single account
// ---------------------------------------------------------------------------
async function fetchAccountEmails(acct: AccountDef, limit: number): Promise<InboxEmail[]> {
  const pass = getAccountPassword(acct);
  if (!pass) return [];  // account not configured — skip silently

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
    if (total === 0) {
      cache[acct.name] = { ts: now, emails: [] };
      return [];
    }

    const start = Math.max(1, total - limit + 1);
    const range = `${start}:${total}`;

    for await (const msg of client.fetch(range, {
      uid: true,
      flags: true,
      envelope: true,
      bodyStructure: true,
      source: true,
    })) {
      try {
        const env = msg.envelope;
        const fromAddr = env?.from?.[0];
        const fromEmail = fromAddr?.address || '';
        const fromName = fromAddr?.name || fromEmail;
        const toAddr = env?.to?.[0];
        const toStr = toAddr?.address || acct.email;
        const subject = env?.subject || '(no subject)';
        const date = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();
        const seen = msg.flags?.has('\\Seen') ?? false;

        let bodyText = '';
        let bodyHtml = '';
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
          from: fromName,
          fromEmail,
          to: toStr,
          subject,
          date,
          bodyText: bodyText.trim(),
          bodyHtml: bodyHtml.trim(),
          seen,
          source: 'imap',
          account: acct.name,
          accountEmail: acct.email,
        });
      } catch { /* skip malformed */ }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  cache[acct.name] = { ts: now, emails };
  return emails;
}

// ---------------------------------------------------------------------------
// Public: fetch all configured accounts in parallel, merge & sort
// ---------------------------------------------------------------------------
export async function fetchInboxEmails(limit = 60): Promise<{
  emails: InboxEmail[];
  accounts: { name: string; email: string; active: boolean }[];
  errors: { account: string; message: string }[];
}> {
  const results = await Promise.allSettled(
    ACCOUNTS.map(acct => fetchAccountEmails(acct, limit).then(emails => ({ acct, emails })))
  );

  const allEmails: InboxEmail[] = [];
  const errors: { account: string; message: string }[] = [];
  const activeNames = new Set<string>();

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { acct, emails } = r.value;
      if (getAccountPassword(acct)) activeNames.add(acct.name);
      allEmails.push(...emails);
    } else {
      errors.push({ account: 'unknown', message: String(r.reason) });
    }
  }

  // Sort newest-first across all accounts
  allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const accounts = ACCOUNTS
    .filter(a => getAccountPassword(a))
    .map(a => ({ name: a.name, email: a.email, active: activeNames.has(a.name) }));

  return { emails: allEmails, accounts, errors };
}

// ---------------------------------------------------------------------------
// Mark a message seen on a specific account
// ---------------------------------------------------------------------------
export async function markEmailSeen(uid: number, account: string): Promise<void> {
  const acct = ACCOUNTS.find(a => a.name === account);
  if (!acct) return;
  const pass = getAccountPassword(acct);
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
