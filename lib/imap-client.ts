/**
 * imap-client.ts
 * Fetches emails from all betcheza.co.ke inboxes via IMAP.
 * Per-mailbox passwords are stored in Admin → Email Configuration. They can
 * also be provided through IMAP_PASSWORD_<ACCOUNT> environment variables;
 * IMAP_PASSWORD and the SMTP password remain shared-account fallbacks.
 * The IMAP host can be configured separately from SMTP, with common provider
 * defaults derived from the outgoing host when no IMAP host is specified.
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import {
  EMAIL_INBOXES,
  getEmailConfig,
  type EmailConfig,
  type EmailInboxName,
} from './email-config-store';

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
const ACCOUNTS = EMAIL_INBOXES;

function deriveImapHost(smtpHost: string) {
  const host = smtpHost.trim().toLowerCase();
  if (host === 'smtp.gmail.com') return 'imap.gmail.com';
  if (host === 'smtp.office365.com' || host === 'smtp-mail.outlook.com') return 'outlook.office365.com';
  if (host === 'smtp.zoho.com') return 'imap.zoho.com';
  if (host === 'smtp.betcheza.co.ke') return FALLBACK_IMAP_HOST;
  if (host.startsWith('imap.')) return host;
  if (host.startsWith('mail.')) return host;
  return FALLBACK_IMAP_HOST;
}

function getImapConfig(cfg: EmailConfig) {
  const host = cfg.imapHost || process.env.IMAP_HOST || deriveImapHost(cfg.host);
  const port = cfg.imapPort || Number(process.env.IMAP_PORT) || 993;
  return { host, port, secure: cfg.imapSecure };
}

function getImapPassword(account: EmailInboxName, cfg: EmailConfig) {
  return cfg.imapPasswords?.[account] ||
    process.env[`IMAP_PASSWORD_${account.toUpperCase()}`] ||
    process.env.IMAP_PASSWORD ||
    cfg.password ||
    '';
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
  acct: (typeof ACCOUNTS)[number],
  host: string,
  port: number,
  secure: boolean,
  pass: string,
  limit: number
): Promise<InboxEmail[]> {
  if (!pass) throw new Error(`No IMAP password configured for ${acct.email}.`);
  const now = Date.now();
  const cache = getCache();
  if (cache[acct.name] && now - cache[acct.name].ts < CACHE_TTL_MS) {
    return cache[acct.name].emails;
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
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
          let messageId = env?.messageId || '';
          if (msg.source) {
            try {
              const parsed = await simpleParser(msg.source);
              bodyText = parsed.text || '';
              bodyHtml = typeof parsed.html === 'string' ? parsed.html : '';
              messageId ||= parsed.messageId || '';
            } catch (error) {
              console.warn('[imap] Could not parse message body:', error instanceof Error ? error.message : 'unknown parser error');
              bodyText = '(Message body could not be decoded.)';
            }
          }

          emails.push({
            uid: msg.uid,
            messageId,
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
  const cfg = await getEmailConfig();
  const { host, port } = getImapConfig(cfg);

  const settled = await Promise.allSettled(
    ACCOUNTS.map(async (acct) => {
      const pass = getImapPassword(acct.name, cfg);
      return fetchAccountEmails(acct, host, port, cfg.imapSecure, pass, limit);
    })
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
  const cfg = await getEmailConfig();
  const { host, port } = getImapConfig(cfg);
  const pass = getImapPassword(acct.name, cfg);
  if (!pass) throw new Error(`No IMAP password configured for ${acct.email}.`);
  const client = new ImapFlow({
    host, port, secure: cfg.imapSecure,
    auth: { user: acct.email, pass }, logger: false,
    tls: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    await client.messageFlagsAdd([uid], ['\\Seen'], { uid: true });
  } finally {
    await client.logout().catch(() => {});
  }
  invalidateImapCache(account);
}
