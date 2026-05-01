import nodemailer, { type Transporter } from 'nodemailer';
import { getEmailConfig, type EmailConfig } from './email-config-store';

let cached: { cfg: EmailConfig; transporter: Transporter } | null = null;

async function getTransporter(): Promise<{ cfg: EmailConfig; transporter: Transporter } | null> {
  const cfg = await getEmailConfig();
  if (!cfg.enabled || !cfg.host || !cfg.username || !cfg.password) {
    return null;
  }
  if (
    cached &&
    cached.cfg.host === cfg.host &&
    cached.cfg.port === cfg.port &&
    cached.cfg.secure === cfg.secure &&
    cached.cfg.username === cfg.username &&
    cached.cfg.password === cfg.password
  ) {
    return cached;
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,           // true = SMTPS (port 465), false = STARTTLS (port 587)
    requireTLS: !cfg.secure,      // force STARTTLS upgrade when not using SSL
    auth: { user: cfg.username, pass: cfg.password },
    tls: { rejectUnauthorized: false }, // accept self-signed certs on VPS servers
  });
  cached = { cfg, transporter };
  return cached;
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const ctx = await getTransporter();
  if (!ctx) {
    console.warn('[mailer] SMTP not configured — skipping send to', input.to);
    return { ok: false, skipped: true, error: 'SMTP not configured' };
  }
  try {
    const info = await ctx.transporter.sendMail({
      from: ctx.cfg.fromName ? `${ctx.cfg.fromName} <${ctx.cfg.fromEmail}>` : ctx.cfg.fromEmail,
      to: Array.isArray(input.to) ? input.to.join(',') : input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo || ctx.cfg.replyTo || undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[mailer] send failed:', msg);
    return { ok: false, error: msg };
  }
}

export async function verifyMailer(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTransporter();
  if (!ctx) return { ok: false, error: 'SMTP not configured' };
  try {
    await ctx.transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendBulkMail(
  recipients: string[],
  subject: string,
  html: string,
  text?: string
): Promise<{ sent: number; failed: number; skipped?: boolean }> {
  return sendBulkMailBatched(recipients, subject, html, text, {
    batchSize: 25,
    perEmailDelayMs: 80,
    perBatchDelayMs: 1000,
  });
}

export interface BatchOptions {
  /** How many emails to send before pausing (default 25). */
  batchSize?: number;
  /** Delay between individual emails inside a batch, ms (default 80). */
  perEmailDelayMs?: number;
  /** Delay between batches, ms (default 1000). */
  perBatchDelayMs?: number;
  /** Optional callback for progress (sent + failed counts). */
  onProgress?: (progress: { sent: number; failed: number; total: number }) => void;
}

/**
 * Batched bulk send. Sends in chunks with two delays:
 *  - perEmailDelayMs spaces individual emails inside a batch
 *  - perBatchDelayMs pauses between batches
 * Useful for staying under SMTP rate limits (e.g. SES "1/sec", Gmail 100/day, etc).
 */
export async function sendBulkMailBatched(
  recipients: string[],
  subject: string,
  html: string,
  text?: string,
  opts: BatchOptions = {},
): Promise<{ sent: number; failed: number; skipped?: boolean; total: number }> {
  const ctx = await getTransporter();
  const total = recipients.length;
  if (!ctx) return { sent: 0, failed: 0, skipped: true, total };

  const batchSize = Math.max(1, opts.batchSize ?? 25);
  const perEmailDelayMs = Math.max(0, opts.perEmailDelayMs ?? 80);
  const perBatchDelayMs = Math.max(0, opts.perBatchDelayMs ?? 1000);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    for (const to of batch) {
      const res = await sendMail({ to, subject, html, text });
      if (res.ok) sent++;
      else failed++;
      if (perEmailDelayMs > 0) await new Promise((r) => setTimeout(r, perEmailDelayMs));
    }
    opts.onProgress?.({ sent, failed, total });
    if (i + batchSize < recipients.length && perBatchDelayMs > 0) {
      await new Promise((r) => setTimeout(r, perBatchDelayMs));
    }
  }

  return { sent, failed, total };
}

/** Replace {{var}} placeholders in a string. Unknown vars are left blank. */
export function renderTemplate(tpl: string, vars: Record<string, string | number | undefined | null>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}
