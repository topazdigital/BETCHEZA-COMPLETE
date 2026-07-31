import { sendMail } from './mailer';

/**
 * Email-to-SMS / OTT messaging fallback.
 *
 * Most carriers expose a free email-to-SMS gateway: every mobile number has
 * a corresponding email address (e.g. 5551234567@vtext.com for Verizon US)
 * and any email sent there is delivered to the phone as a text. There is no
 * cost, no API key and no Twilio dependency — but the user (or admin) must
 * know which carrier the recipient is on, because each carrier uses a
 * different domain.
 *
 * For numbers where the carrier is unknown we fall back to building a
 * `wa.me` (WhatsApp click-to-chat) link or an `sms:` URI the caller can
 * surface in the UI so the *user themselves* can deliver the message.
 *
 * This is intentionally honest: there is no reliable way to deliver an SMS
 * to an arbitrary mobile number worldwide without a paid SMS gateway.
 */

export type SmsCarrier =
  // United States
  | 'verizon'
  | 'att'
  | 'tmobile'
  | 'sprint'
  | 'boost'
  | 'cricket'
  | 'metropcs'
  | 'uscellular'
  | 'virgin_us'
  // United Kingdom
  | 'vodafone_uk'
  | 'o2_uk'
  | 'ee_uk'
  // Africa (most do NOT offer email-to-SMS — flagged as unsupported)
  | 'safaricom_ke_unsupported'
  | 'mtn_ng_unsupported';

export const CARRIER_GATEWAYS: Record<SmsCarrier, { sms: string | null; mms?: string }> = {
  verizon: { sms: 'vtext.com', mms: 'vzwpix.com' },
  att: { sms: 'txt.att.net', mms: 'mms.att.net' },
  tmobile: { sms: 'tmomail.net' },
  sprint: { sms: 'messaging.sprintpcs.com', mms: 'pm.sprint.com' },
  boost: { sms: 'sms.myboostmobile.com' },
  cricket: { sms: 'sms.cricketwireless.net', mms: 'mms.cricketwireless.net' },
  metropcs: { sms: 'mymetropcs.com' },
  uscellular: { sms: 'email.uscc.net', mms: 'mms.uscc.net' },
  virgin_us: { sms: 'vmobl.com', mms: 'vmpix.com' },
  vodafone_uk: { sms: 'vodafone.net' },
  o2_uk: { sms: 'mmail.co.uk' },
  ee_uk: { sms: 'mms.ee.co.uk' },
  // Honest "we cannot send" markers — UI can fall back to WhatsApp/SMS link.
  safaricom_ke_unsupported: { sms: null },
  mtn_ng_unsupported: { sms: null },
};

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

export interface SendSmsInput {
  /** E.164 (or local) phone number, digits only after normalization. */
  phone: string;
  /** Mobile carrier — required for email-to-SMS delivery. */
  carrier?: SmsCarrier;
  /** Message body (kept short, most gateways cap at 140-160 chars). */
  message: string;
  /** Optional subject — most carriers strip or render it small. */
  subject?: string;
}

export interface SendSmsResult {
  ok: boolean;
  /** "email-gateway" when delivered via SMTP, "fallback-link" when we built a wa.me link, "skipped" otherwise. */
  channel: 'email-gateway' | 'fallback-link' | 'skipped';
  fallbackUrl?: string;
  error?: string;
}

/**
 * Best-effort SMS delivery. Returns a fallback wa.me link when delivery
 * isn't possible so the calling UI can prompt the user to send it manually.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, channel: 'skipped', error: 'Invalid phone number' };

  // Build a WhatsApp + sms: fallback the UI can always surface.
  const waText = encodeURIComponent(input.message.slice(0, 1000));
  const waUrl = `https://wa.me/${phone}?text=${waText}`;

  const carrier = input.carrier;
  if (!carrier) {
    return {
      ok: false,
      channel: 'fallback-link',
      fallbackUrl: waUrl,
      error: 'No carrier specified — provide a carrier or use the WhatsApp link',
    };
  }
  const gw = CARRIER_GATEWAYS[carrier];
  if (!gw?.sms) {
    return {
      ok: false,
      channel: 'fallback-link',
      fallbackUrl: waUrl,
      error: `Carrier "${carrier}" does not offer a free email-to-SMS gateway`,
    };
  }

  const target = `${phone}@${gw.sms}`;
  const trimmed = input.message.length > 160 ? input.message.slice(0, 157) + '…' : input.message;
  const result = await sendMail({
    to: target,
    subject: input.subject || ' ',
    text: trimmed,
  });

  if (result.ok) return { ok: true, channel: 'email-gateway' };

  return {
    ok: false,
    channel: 'fallback-link',
    fallbackUrl: waUrl,
    error: result.error || 'Email delivery failed',
  };
}

/**
 * Helper for UI — given a phone + message, returns a wa.me link the user can
 * tap to deliver the message themselves via WhatsApp. Always works (no auth
 * needed). Useful when the recipient's carrier is unknown.
 */
export function whatsappLink(phone: string, message: string): string {
  const p = normalizePhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(message.slice(0, 1000))}`;
}

/** Native sms:// URI — opens the user's default messaging app. */
export function smsLink(phone: string, message: string): string {
  const p = normalizePhone(phone);
  return `sms:${p}?body=${encodeURIComponent(message.slice(0, 1000))}`;
}
