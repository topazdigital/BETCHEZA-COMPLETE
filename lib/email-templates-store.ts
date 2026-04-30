import fs from 'node:fs';
import path from 'node:path';

export type EmailTemplateKey =
  | 'subscriber_welcome'
  | 'broadcast'
  | 'password_reset'
  | 'competition_join'
  | 'prize_payout'
  | 'tipster_application'
  | 'tipster_approved'
  | 'tipster_rejected';

export interface EmailTemplate {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  /** Variable names available to {{this}} substitution. */
  variables: string[];
  /** Last update time. */
  updatedAt: string;
}

const STORE_DIR = path.join(process.cwd(), '.local', 'state');
const STORE_FILE = path.join(STORE_DIR, 'email-templates.json');

function ensureDir() {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

const DEFAULT_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  subscriber_welcome: {
    key: 'subscriber_welcome',
    name: 'Subscriber Welcome',
    description: 'Sent immediately after a user subscribes to the newsletter.',
    subject: 'Welcome to Betcheza, {{name}}!',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0f17;color:#e7eaf0;border-radius:12px">
  <h1 style="color:#22c55e;margin:0 0 12px">Welcome aboard, {{name}}!</h1>
  <p>Thanks for subscribing to <strong>Betcheza</strong>. You'll get our top tips, free predictions and competition alerts straight to your inbox.</p>
  <p style="margin:24px 0">
    <a href="{{siteUrl}}" style="background:#22c55e;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open Betcheza</a>
  </p>
  <p style="font-size:12px;color:#94a3b8">You can unsubscribe any time from your <a href="{{siteUrl}}/dashboard" style="color:#22c55e">dashboard</a>.</p>
</div>`,
    text: `Welcome to Betcheza, {{name}}!

Thanks for subscribing. You'll get our top tips, free predictions and competition alerts.

Open Betcheza: {{siteUrl}}

— Team Betcheza`,
    variables: ['name', 'email', 'siteUrl'],
    updatedAt: new Date().toISOString(),
  },
  broadcast: {
    key: 'broadcast',
    name: 'Broadcast / Newsletter',
    description: 'General-purpose template for admin broadcasts to all users or subscribers.',
    subject: '{{subject}}',
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0b0f17;color:#e7eaf0;border-radius:12px">
  <h2 style="color:#22c55e;margin:0 0 12px">{{heading}}</h2>
  <div style="line-height:1.6">{{body}}</div>
  <hr style="border:none;border-top:1px solid #1f2937;margin:24px 0" />
  <p style="font-size:12px;color:#94a3b8">Sent to {{name}} · <a href="{{siteUrl}}" style="color:#22c55e">betcheza.com</a></p>
</div>`,
    text: `{{heading}}

{{body}}

—
Betcheza · {{siteUrl}}`,
    variables: ['name', 'email', 'subject', 'heading', 'body', 'siteUrl'],
    updatedAt: new Date().toISOString(),
  },
  password_reset: {
    key: 'password_reset',
    name: 'Password Reset',
    description: 'Sent when a user requests a password reset.',
    subject: 'Reset your Betcheza password',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2>Reset your password</h2>
  <p>Hi {{name}}, click the link below to reset your password. The link expires in 1 hour.</p>
  <p><a href="{{resetUrl}}" style="background:#22c55e;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Reset password</a></p>
  <p style="font-size:12px;color:#64748b">If you didn't request this, ignore this email.</p>
</div>`,
    text: `Reset your password

Hi {{name}}, open this link to reset your password (expires in 1 hour):
{{resetUrl}}

If you didn't request this, ignore this email.`,
    variables: ['name', 'email', 'resetUrl'],
    updatedAt: new Date().toISOString(),
  },
  competition_join: {
    key: 'competition_join',
    name: 'Competition Joined',
    description: 'Sent after a user successfully joins a paid competition.',
    subject: 'You\'re in: {{competitionName}}',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#22c55e">You're in!</h2>
  <p>Hi {{name}}, you successfully joined <strong>{{competitionName}}</strong>.</p>
  <p>Entry fee: <strong>{{currency}} {{amount}}</strong><br/>Reference: <code>{{reference}}</code></p>
  <p><a href="{{siteUrl}}/competitions/{{slug}}" style="background:#22c55e;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View competition</a></p>
</div>`,
    text: `You're in!

Hi {{name}}, you joined {{competitionName}}.
Entry: {{currency}} {{amount}}
Ref: {{reference}}

View: {{siteUrl}}/competitions/{{slug}}`,
    variables: ['name', 'email', 'competitionName', 'slug', 'currency', 'amount', 'reference', 'siteUrl'],
    updatedAt: new Date().toISOString(),
  },
  prize_payout: {
    key: 'prize_payout',
    name: 'Prize Payout',
    description: 'Sent when a tipster\'s prize payout is processed.',
    subject: 'Your prize is on the way 🎉',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#22c55e">Congrats {{name}}!</h2>
  <p>Your prize of <strong>{{currency}} {{amount}}</strong> from <strong>{{competitionName}}</strong> has been credited to your wallet.</p>
  <p><a href="{{siteUrl}}/dashboard/wallet" style="background:#22c55e;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open wallet</a></p>
</div>`,
    text: `Congrats {{name}}!
Your prize of {{currency}} {{amount}} from {{competitionName}} has been credited.
Wallet: {{siteUrl}}/dashboard/wallet`,
    variables: ['name', 'email', 'competitionName', 'currency', 'amount', 'siteUrl'],
    updatedAt: new Date().toISOString(),
  },
  tipster_application: {
    key: 'tipster_application',
    name: 'Tipster Application Received',
    description: 'Sent when a user applies to become a tipster.',
    subject: 'We received your tipster application',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2>Application received</h2>
  <p>Hi {{name}}, thanks for applying to become a tipster on Betcheza. Our team will review your application and get back to you within 48 hours.</p>
</div>`,
    text: `Hi {{name}}, thanks for applying to become a tipster on Betcheza. Review takes up to 48h.`,
    variables: ['name', 'email'],
    updatedAt: new Date().toISOString(),
  },
  tipster_approved: {
    key: 'tipster_approved',
    name: 'Tipster Application Approved',
    description: 'Sent when an admin approves a tipster application.',
    subject: 'You\'re a Betcheza Tipster — welcome aboard!',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0f17;color:#e7eaf0;border-radius:12px">
  <h2 style="color:#10B981;margin:0 0 12px">Welcome to the Tipster team, {{name}}! 🎉</h2>
  <p>Great news — your application has been approved. Your account is now upgraded to the <strong>Tipster</strong> role{{verifiedLine}}.</p>
  <p>You can start posting tips immediately:</p>
  <p style="margin:24px 0">
    <a href="{{siteUrl}}/dashboard" style="background:#10B981;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open your dashboard</a>
  </p>
  {{noteBlock}}
  <p style="font-size:12px;color:#94a3b8;margin-top:24px">Tip: post consistently and your stats will start showing up on the public leaderboard.</p>
</div>`,
    text: `Welcome to the Tipster team, {{name}}!

Your application has been approved. Your account is now upgraded to Tipster{{verifiedLine}}.
Start posting at {{siteUrl}}/dashboard

{{noteBlock}}— Team Betcheza`,
    variables: ['name', 'email', 'siteUrl', 'verifiedLine', 'noteBlock'],
    updatedAt: new Date().toISOString(),
  },
  tipster_rejected: {
    key: 'tipster_rejected',
    name: 'Tipster Application Rejected',
    description: 'Sent when an admin rejects a tipster application.',
    subject: 'Update on your Betcheza tipster application',
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2>Application update</h2>
  <p>Hi {{name}}, thanks for applying to become a tipster on Betcheza. After review, we won't be approving your application this time.</p>
  {{noteBlock}}
  <p>You're welcome to keep using Betcheza, build a track record on the predictor, and re-apply in 30 days.</p>
  <p style="margin:24px 0">
    <a href="{{siteUrl}}/become-tipster" style="background:#10B981;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Re-apply later</a>
  </p>
</div>`,
    text: `Hi {{name}}, thanks for applying to become a tipster on Betcheza.

After review, we won't be approving your application this time.

{{noteBlock}}You're welcome to re-apply in 30 days: {{siteUrl}}/become-tipster

— Team Betcheza`,
    variables: ['name', 'email', 'siteUrl', 'noteBlock'],
    updatedAt: new Date().toISOString(),
  },
};

function load(): Record<EmailTemplateKey, EmailTemplate> {
  ensureDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<Record<EmailTemplateKey, EmailTemplate>>;
      // Merge with defaults so newly-added templates appear without losing user edits.
      const merged: Record<EmailTemplateKey, EmailTemplate> = { ...DEFAULT_TEMPLATES };
      for (const k of Object.keys(parsed) as EmailTemplateKey[]) {
        const t = parsed[k];
        if (t) merged[k] = { ...merged[k], ...t };
      }
      return merged;
    }
  } catch (e) {
    console.warn('[email-templates] failed to read store:', e);
  }
  return { ...DEFAULT_TEMPLATES };
}

function persist(templates: Record<EmailTemplateKey, EmailTemplate>) {
  ensureDir();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(templates, null, 2), 'utf-8');
  } catch (e) {
    console.error('[email-templates] failed to write store:', e);
  }
}

const g = globalThis as { __emailTemplates?: Record<EmailTemplateKey, EmailTemplate> };

function getStore(): Record<EmailTemplateKey, EmailTemplate> {
  if (!g.__emailTemplates) g.__emailTemplates = load();
  return g.__emailTemplates;
}

export function listTemplates(): EmailTemplate[] {
  return Object.values(getStore());
}

export function getTemplate(key: EmailTemplateKey): EmailTemplate {
  return getStore()[key] ?? DEFAULT_TEMPLATES[key];
}

export function updateTemplate(
  key: EmailTemplateKey,
  patch: Partial<Pick<EmailTemplate, 'subject' | 'html' | 'text' | 'name' | 'description'>>,
): EmailTemplate {
  const store = getStore();
  const current = store[key] ?? DEFAULT_TEMPLATES[key];
  const next: EmailTemplate = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store[key] = next;
  persist(store);
  return next;
}

export function resetTemplate(key: EmailTemplateKey): EmailTemplate {
  const store = getStore();
  store[key] = { ...DEFAULT_TEMPLATES[key], updatedAt: new Date().toISOString() };
  persist(store);
  return store[key];
}
