import { query } from './db';

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

function fromEnv(): EmailConfig {
  return {
    enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USERNAME),
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME || '',
    fromName: process.env.SMTP_FROM_NAME || 'Betcheza',
    replyTo: process.env.SMTP_REPLY_TO || '',
  };
}

export async function getEmailConfig(): Promise<EmailConfig> {
  // Prefer stored DB config when DATABASE_URL is set, otherwise in-memory or env.
  try {
    const rows = await query<{ name: string; value: string }>(
      "SELECT name, value FROM admin_settings WHERE name LIKE 'smtp_%'"
    );
    if (rows && rows.length > 0) {
      const m = new Map(rows.map((r) => [r.name, r.value]));
      return {
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
    }
  } catch {
    // table not present / no DB — fall through
  }
  if (g.__emailCfg) return g.__emailCfg;
  const env = fromEnv();
  g.__emailCfg = env;
  return env;
}

export async function saveEmailConfig(cfg: Partial<EmailConfig>): Promise<EmailConfig> {
  const current = await getEmailConfig();
  const merged: EmailConfig = { ...current, ...cfg };
  g.__emailCfg = merged;
  // Persist into admin_settings table when possible
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
    // ignore — in-memory fallback already saved
  }
  return merged;
}

export function maskedConfig(cfg: EmailConfig): Omit<EmailConfig, 'password'> & { passwordSet: boolean } {
  const { password, ...rest } = cfg;
  return { ...rest, passwordSet: !!password };
}
