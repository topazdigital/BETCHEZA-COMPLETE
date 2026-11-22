import nodemailer, { type Transporter } from 'nodemailer';
import { getEmailConfig, type EmailConfig } from './email-config-store';
import { brandEmailHtml } from './email-branding';

let cached: { cfg: EmailConfig; transporter: Transporter } | null = null;

function sameConfig(a: EmailConfig, b: EmailConfig) {
  return a.enabled === b.enabled &&
    a.host === b.host &&
    a.port === b.port &&
    a.secure === b.secure &&
    a.username === b.username &&
    a.password === b.password &&
    a.fromEmail === b.fromEmail &&
    a.fromName === b.fromName &&
    a.replyTo === b.replyTo;
}

async function getTransporter(): Promise<{ cfg: EmailConfig; transporter: Transporter } | null> {
  const cfg = await getEmailConfig();
  if (!cfg.enabled || !cfg.host || !cfg.username || !cfg.password) {
    return null;
  }
  if (cached && sameConfig(cached.cfg, cfg)) {
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
  /** Optional sender override for verified Betcheza mailboxes. */
  from?: string;
  headers?: Record<string, string>;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  accepted?: string[];
  rejected?: string[];
  response?: string;
  partial?: boolean;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const ctx = await getTransporter();
  if (!ctx) {
    console.warn('[mailer] SMTP is not configured — email was not sent');
    return { ok: false, skipped: true, error: 'SMTP not configured' };
  }
  try {
    const info = await ctx.transporter.sendMail({
      from: input.from
        ? `${ctx.cfg.fromName || 'Betcheza'} <${input.from}>`
        : (ctx.cfg.fromName ? `${ctx.cfg.fromName} <${ctx.cfg.fromEmail}>` : ctx.cfg.fromEmail),
      to: Array.isArray(input.to) ? input.to.join(',') : input.to,
      subject: input.subject,
      text: input.text,
      html: brandEmailHtml(input.subject, input.html, input.text),
      replyTo: input.replyTo || ctx.cfg.replyTo || undefined,
      headers: input.headers,
    });
    const accepted: string[] = (info.accepted || []).map((value: unknown) => String(value));
    const rejected: string[] = (info.rejected || []).map((value: unknown) => String(value));
    const expected = (Array.isArray(input.to) ? input.to : [input.to])
      .flatMap((value) => value.split(','))
      .map((value) => value.trim().replace(/^<|>$/g, '').toLowerCase())
      .filter(Boolean);
    const acceptedSet = new Set(accepted.map((value) => value.trim().replace(/^<|>$/g, '').toLowerCase()));
    const rejectedSet = new Set(rejected.map((value) => value.trim().replace(/^<|>$/g, '').toLowerCase()));
    const allAccepted = expected.length > 0 &&
      expected.every((recipient) => acceptedSet.has(recipient) && !rejectedSet.has(recipient));
    const partial = accepted.length > 0 && !allAccepted;
    const error = allAccepted
      ? undefined
      : rejected.length
        ? `SMTP rejected ${rejected.join(', ')}`
        : accepted.length
          ? 'SMTP accepted only some requested recipients'
          : 'SMTP accepted no recipients';
    if (!allAccepted) {
      console.warn('[mailer] SMTP did not accept every requested recipient', {
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
      });
    }
    return {
      ok: allAccepted,
      messageId: info.messageId,
      accepted,
      rejected,
      response: info.response,
      ...(error ? { error } : {}),
      ...(partial ? { partial: true } : {}),
    };
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
