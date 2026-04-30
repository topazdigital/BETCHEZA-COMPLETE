// Multi-channel notification dispatcher.
// Fans-out to in-app + push + email respecting user prefs.

import { createNotification, getPreferences, listPushSubscriptions, NotificationType } from './notification-store';
import { sendMail } from './mailer';

export interface DispatchInput {
  userId: number;
  email?: string | null;
  type: NotificationType | string;
  title: string;
  content: string;
  link?: string | null;
}

// Map notification type → which preference family controls it.
function familyOf(type: string): 'team' | 'tipster' | 'odds' | 'system' {
  if (type.startsWith('team_') || type === 'match_lineup') return 'team';
  if (type.startsWith('tipster_') || type.startsWith('feed_') || type === 'comment_reply' || type === 'post_like' || type === 'post_comment' || type === 'follow_new') return 'tipster';
  if (type === 'odds_drop') return 'odds';
  return 'system';
}

export async function dispatchNotification(input: DispatchInput): Promise<void> {
  const prefs = await getPreferences(input.userId);
  const family = familyOf(input.type);

  // 1. In-app
  const inappOk =
    family === 'team' ? prefs.inappTeamUpdates :
    family === 'tipster' ? prefs.inappTipsterUpdates :
    true;
  if (inappOk) {
    try {
      await createNotification({
        userId: input.userId,
        type: input.type,
        title: input.title,
        content: input.content,
        link: input.link || null,
        channel: 'inapp',
      });
    } catch (e) {
      console.warn('[notify] inapp create failed', e);
    }
  }

  // 2. Push
  const pushOk =
    family === 'team' ? prefs.pushTeamUpdates :
    family === 'tipster' ? prefs.pushTipsterUpdates :
    family === 'odds' ? prefs.pushOddsAlerts :
    false;
  if (pushOk) {
    try {
      const subs = await listPushSubscriptions(input.userId);
      for (const sub of subs) {
        await sendBrowserPush(sub.endpoint, input.title, input.content, input.link || '/');
      }
    } catch (e) {
      console.warn('[notify] push dispatch failed', e);
    }
  }

  // 3. Email
  const emailOk =
    family === 'team' ? prefs.emailTeamUpdates :
    family === 'tipster' ? prefs.emailTipsterUpdates :
    false;
  if (emailOk && input.email) {
    try {
      await sendMail({
        to: input.email,
        subject: input.title,
        text: `${input.content}${input.link ? `\n\nView: ${input.link}` : ''}`,
        html: emailHtml(input),
      });
    } catch (e) {
      console.warn('[notify] email send failed', e);
    }
  }
}

// Fan-out helper: dispatch the same notification to many users.
export async function dispatchToMany(userIds: number[], input: Omit<DispatchInput, 'userId' | 'email'>): Promise<void> {
  await Promise.all(
    Array.from(new Set(userIds)).map(uid =>
      dispatchNotification({ ...input, userId: uid }).catch(e =>
        console.warn('[notify] fan-out failed for', uid, e),
      ),
    ),
  );
}

function emailHtml(input: DispatchInput): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;padding:16px">
    <h2 style="margin:0 0 8px 0;color:#0ea5e9">${escapeHtml(input.title)}</h2>
    <p style="color:#334155;line-height:1.5">${escapeHtml(input.content)}</p>
    ${input.link ? `<p><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Betcheza</a></p>` : ''}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Manage notifications in your Betcheza settings.</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

async function sendBrowserPush(endpoint: string, _title: string, _body: string, _link: string): Promise<void> {
  // Web-push is opt-in via VAPID; without keys we just log the intent.
  if (process.env.DEBUG_NOTIFY) {
    console.log('[notify] would push to', endpoint.slice(0, 64) + '…');
  }
}
