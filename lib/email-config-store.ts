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
}

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
};

const g = globalThis as { __emailCfg?: EmailConfig };

function fromEnv(): Partial<EmailConfig> {
  const host = process.env.SMTP_HOST || '';
  const username = process.env.SMTP_USERNAME || '';
  if (!host && !username) return {};
  return {
    enabled: !!(host && username),
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
            parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    username,
    password: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || username,
    fromName: process.env.SMTP_FROM_NAME || 'Betcheza',
    replyTo: process.env.SMTP_REPLY_TO || '',
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
    fromEmail: base.fromEmail || env.fromEmail || '',
    fromName: base.fromName || env.fromName || 'Betcheza',
    replyTo: base.replyTo || env.replyTo || '',
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
      "SELECT name, value FROM admin_settings WHERE name LIKE 'smtp_%'"
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

  // 3. File-based persistence (survives restarts without MySQL)
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
  // Always persist to file (works without MySQL)
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

export function maskedConfig(cfg: EmailConfig): Omit<EmailConfig, 'password'> & { passwordSet: boolean } {
  const { password, ...rest } = cfg;
  return { ...rest, passwordSet: !!password };
}
