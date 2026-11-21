import { query } from './db';
import { fileStoreGet, fileStoreSet } from './file-store';

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapPasswords: Partial<Record<EmailInboxName, string>>;
}

export const EMAIL_INBOXES = [
  { name: 'support', email: 'support@betcheza.co.ke' },
  { name: 'partnerships', email: 'partnerships@betcheza.co.ke' },
  { name: 'info', email: 'info@betcheza.co.ke' },
  { name: 'careers', email: 'careers@betcheza.co.ke' },
] as const;

export type EmailInboxName = (typeof EMAIL_INBOXES)[number]['name'];

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromEmail: '',
  fromName: 'Betcheza',
  replyTo: '',
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapPasswords: {},
};

const g = globalThis as { __emailCfg?: EmailConfig };

function fromEnv(): Partial<EmailConfig> {
  const host = process.env.SMTP_HOST || '';
  const username = process.env.SMTP_USERNAME || process.env.SMTP_USER || '';
  const imapHost = process.env.IMAP_HOST || '';
  const imapPasswords = Object.fromEntries(
    EMAIL_INBOXES
      .map(({ name }) => [name, process.env[`IMAP_PASSWORD_${name.toUpperCase()}`] || ''])
      .filter(([, password]) => !!password)
  );
  if (
    !host &&
    !username &&
    !imapHost &&
    !process.env.IMAP_PORT &&
    !process.env.IMAP_SECURE &&
    !process.env.IMAP_PASSWORD &&
    !Object.keys(imapPasswords).length
  ) return {};
  return {
    ...(host || username ? {
      enabled: !!(host && username),
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
              parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      username,
      password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.FROM_EMAIL || username,
      fromName: process.env.SMTP_FROM_NAME || 'Betcheza',
      replyTo: process.env.SMTP_REPLY_TO || '',
    } : {}),
    imapHost,
    imapPort: parseInt(process.env.IMAP_PORT || '993', 10),
    imapSecure: (process.env.IMAP_SECURE || '').toLowerCase() === 'false'
      ? false
      : parseInt(process.env.IMAP_PORT || '993', 10) === 993,
    imapPasswords,
  };
}

/** Merge file/DB config with env vars — env fills any blank fields. */
function mergeWithEnv(base: EmailConfig): EmailConfig {
  const env = fromEnv();
  return {
    ...base,
    host: base.host || env.host || '',
    port: base.port || env.port || 587,
    secure: base.host ? base.secure : (env.secure ?? false),
    username: base.username || env.username || '',
    password: base.password || env.password || '',
    fromEmail: base.fromEmail || env.fromEmail || base.username || env.username || '',
    fromName: base.fromName || env.fromName || 'Betcheza',
    replyTo: base.replyTo || env.replyTo || '',
    imapHost: base.imapHost || env.imapHost || '',
    imapPort: base.imapHost ? base.imapPort : env.imapPort || base.imapPort || 993,
    imapSecure: base.imapHost ? base.imapSecure : env.imapSecure ?? base.imapSecure ?? true,
    imapPasswords: Object.fromEntries(
      EMAIL_INBOXES.map(({ name }) => [
        name,
        base.imapPasswords?.[name] || env.imapPasswords?.[name] || '',
      ])
    ),
    // Enable automatically if host+username are set
    enabled: base.host
      ? base.enabled
      : !!(env.host && env.username),
  };
}

export async function getEmailConfig(): Promise<EmailConfig> {
  // 1. Try MySQL DB
  try {
    const result = await query<{ name: string; value: string }>(
      "SELECT name, value FROM admin_settings WHERE name LIKE 'smtp_%' OR name LIKE 'imap_%'"
    );
    const rows = result.rows;
    if (rows && rows.length > 0) {
      const m = new Map(rows.map((r) => [r.name, r.value]));
      const cfg: EmailConfig = {
        enabled: m.get('smtp_enabled') === 'true',
        host: m.get('smtp_host') || '',
        port: parseInt(m.get('smtp_port') || '587', 10),
        secure: m.get('smtp_secure') === 'true',
        username: m.get('smtp_username') || '',
        password: m.get('smtp_password') || '',
        fromEmail: m.get('smtp_from_email') || '',
        fromName: m.get('smtp_from_name') || 'Betcheza',
        replyTo: m.get('smtp_reply_to') || '',
        imapHost: m.get('imap_host') || '',
        imapPort: parseInt(m.get('imap_port') || '993', 10),
        imapSecure: m.get('imap_secure') === undefined ? true : m.get('imap_secure') === 'true',
        imapPasswords: Object.fromEntries(
          EMAIL_INBOXES.map(({ name }) => [name, m.get(`imap_password_${name}`) || ''])
        ),
      };
      const merged = mergeWithEnv(cfg);
      g.__emailCfg = merged;
      return merged;
    }
  } catch {
    // table not present / no DB — fall through
  }

  // 2. In-memory cache (set after a save)
  if (g.__emailCfg) return g.__emailCfg;

  // 3. File-based persistence (survives restarts without DB)
  const stored = fileStoreGet<EmailConfig | null>('email-config', null);
  if (stored && (stored.host || stored.username)) {
    const merged = mergeWithEnv(stored);
    g.__emailCfg = merged;
    return merged;
  }

  // 4. Environment variables only
  const env = fromEnv();
  const cfg: EmailConfig = { ...DEFAULT_EMAIL_CONFIG, ...env };
  g.__emailCfg = cfg;
  return cfg;
}

export async function saveEmailConfig(cfg: Partial<EmailConfig>): Promise<EmailConfig> {
  const current = await getEmailConfig();
  const merged: EmailConfig = { ...current, ...cfg };
  // Always update in-memory cache
  g.__emailCfg = merged;
  // Always persist to file (works without DB)
  fileStoreSet('email-config', merged);

  // Also persist into admin_settings table when MySQL is available
  try {
    const entries: Array<[string, string]> = [
      ['smtp_enabled', String(merged.enabled)],
      ['smtp_host', merged.host],
      ['smtp_port', String(merged.port)],
      ['smtp_secure', String(merged.secure)],
      ['smtp_username', merged.username],
      ['smtp_password', merged.password],
      ['smtp_from_email', merged.fromEmail],
      ['smtp_from_name', merged.fromName],
      ['smtp_reply_to', merged.replyTo || ''],
      ['imap_host', merged.imapHost || ''],
      ['imap_port', String(merged.imapPort || 993)],
      ['imap_secure', String(merged.imapSecure)],
      ...EMAIL_INBOXES.map(({ name }) => [
        `imap_password_${name}`,
        merged.imapPasswords?.[name] || '',
      ] as [string, string]),
    ];
    for (const [name, value] of entries) {
      await query(
        `INSERT INTO admin_settings (name, value, type, description)
         VALUES (?, ?, 'string', 'SMTP configuration')
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [name, value]
      );
    }
  } catch {
    // ignore — file-based fallback already saved
  }
  return merged;
}

export function maskedConfig(cfg: EmailConfig) {
  const { password, imapPasswords, ...rest } = cfg;
  return {
    ...rest,
    passwordSet: !!password,
    imapPasswords: Object.fromEntries(EMAIL_INBOXES.map(({ name }) => [name, ''])),
    imapPasswordSet: Object.fromEntries(
      EMAIL_INBOXES.map(({ name }) => [name, !!imapPasswords?.[name]])
    ),
  };
}
