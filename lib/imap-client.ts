/**
 * imap-client.ts
 * Fetches emails from the partnerships@betcheza.co.ke inbox via IMAP.
 * Results are cached in memory for 2 minutes to avoid hammering the server.
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
}

const IMAP_HOST = 'server.richdatingnetwork.com';
const IMAP_PORT = 993;
const IMAP_USER = 'partnerships@betcheza.co.ke';

interface CacheEntry { ts: number; emails: InboxEmail[] }
const g = globalThis as { __imapCache?: CacheEntry };
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

function getPassword(): string {
  return process.env.IMAP_PASSWORD || '';
}

export async function fetchInboxEmails(limit = 60): Promise<InboxEmail[]> {
  const pass = getPassword();
  if (!pass) throw new Error('IMAP_PASSWORD secret not set');

  // Return cached result if fresh
  const now = Date.now();
  if (g.__imapCache && now - g.__imapCache.ts < CACHE_TTL_MS) {
    return g.__imapCache.emails;
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  const emails: InboxEmail[] = [];

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');
    const total = mailbox.exists;
    if (total === 0) return [];

    // Fetch the newest `limit` messages
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
        const toStr = toAddr?.address || IMAP_USER;
        const subject = env?.subject || '(no subject)';
        const date = env?.date ? new Date(env.date).toISOString() : new Date().toISOString();
        const seen = msg.flags?.has('\\Seen') ?? false;

        // Parse body from raw source
        let bodyText = '';
        let bodyHtml = '';
        if (msg.source) {
          const raw = msg.source.toString('utf-8');
          // Simple extraction: look for text/plain and text/html parts
          const textMatch = raw.match(/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\z)/i);
          const htmlMatch = raw.match(/Content-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\z)/i);
          if (textMatch) bodyText = decodeBody(textMatch[1]);
          if (htmlMatch) bodyHtml = decodeBody(htmlMatch[1]);
          if (!bodyText && !bodyHtml) {
            // Simple single-part message
            const bodyStart = raw.indexOf('\r\n\r\n');
            if (bodyStart !== -1) bodyText = decodeBody(raw.slice(bodyStart + 4));
          }
        }

        emails.push({
          uid: msg.uid,
          messageId: env?.messageId || `${msg.uid}@imap`,
          from: fromName,
          fromEmail,
          to: toStr,
          subject,
          date,
          bodyText: bodyText.trim(),
          bodyHtml: bodyHtml.trim(),
          seen,
          source: 'imap',
        });
      } catch { /* skip malformed messages */ }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  // Newest first
  emails.reverse();

  g.__imapCache = { ts: now, emails };
  return emails;
}

export function invalidateImapCache() {
  delete g.__imapCache;
}

/** Mark a message as seen on the IMAP server */
export async function markEmailSeen(uid: number): Promise<void> {
  const pass = getPassword();
  if (!pass) return;
  const client = new ImapFlow({
    host: IMAP_HOST, port: IMAP_PORT, secure: true,
    auth: { user: IMAP_USER, pass }, logger: false,
    tls: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    await client.messageFlagsAdd({ uid: true }, [uid], ['\\Seen']);
  } finally {
    await client.logout().catch(() => {});
  }
  invalidateImapCache();
}

function decodeBody(raw: string): string {
  // Decode quoted-printable
  return raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
