// Notification store — MySQL-backed with in-memory + file fallback.
// All SQL uses ? placeholders (MySQL style).

import { query, execute } from './db';
import fs from 'fs';
import path from 'path';

export interface NotificationPreferences {
  inappTeamUpdates: boolean;
  inappTipsterUpdates: boolean;
  emailTeamUpdates: boolean;
  emailTipsterUpdates: boolean;
  emailDailyDigest: boolean;
  pushTeamUpdates: boolean;
  pushTipsterUpdates: boolean;
  pushOddsAlerts: boolean;
}

export const DEFAULT_PREFS: NotificationPreferences = {
  inappTeamUpdates: true,
  inappTipsterUpdates: true,
  emailTeamUpdates: false,
  emailTipsterUpdates: false,
  emailDailyDigest: false,
  pushTeamUpdates: true,
  pushTipsterUpdates: true,
  pushOddsAlerts: false,
};

export interface NotificationRow {
  id: number;
  userId: number;
  type: string;
  title: string;
  content: string;
  link: string | null;
  channel: string;
  isRead: boolean;
  createdAt: string;
}

export interface PushSubscriptionRow {
  id: string;
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  topics: string[];
  countryCode?: string | null;
}

export interface EmailSubscriberRow {
  id: string;
  email: string;
  topics: string[];
  countryCode?: string | null;
  unsubscribeToken: string;
  active: boolean;
}

interface Stores {
  preferences: Map<number, NotificationPreferences>;
  notifications: NotificationRow[];
  pushSubs: Map<string, PushSubscriptionRow>; // key = endpoint
  emailSubs: Map<string, EmailSubscriberRow>; // key = email
}

const PREFS_FILE = path.join(process.cwd(), '.local', 'state', 'notification-prefs.json');

function ensureDir(p: string) {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
}

function savePrefsToFile(m: Map<number, NotificationPreferences>) {
  try {
    ensureDir(PREFS_FILE);
    const obj: Record<string, NotificationPreferences> = {};
    for (const [k, v] of m) obj[String(k)] = v;
    fs.writeFileSync(PREFS_FILE, JSON.stringify(obj, null, 2));
  } catch {}
}

function loadPrefsFromFile(): Map<number, NotificationPreferences> {
  const m = new Map<number, NotificationPreferences>();
  try {
    if (!fs.existsSync(PREFS_FILE)) return m;
    const obj = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')) as Record<string, NotificationPreferences>;
    for (const [k, v] of Object.entries(obj)) m.set(Number(k), v);
  } catch {}
  return m;
}

const g = globalThis as { __notifStore?: Stores };
g.__notifStore = g.__notifStore || {
  preferences: loadPrefsFromFile(),
  notifications: [],
  pushSubs: new Map(),
  emailSubs: new Map(),
};
const stores = g.__notifStore;

function hasDb(): boolean {
  return !!(process.env.DATABASE_URL || process.env.MYSQL_URL);
}

// ─── PREFERENCES ─────────────────────────────────
export async function getPreferences(userId: number): Promise<NotificationPreferences> {
  if (hasDb()) {
    try {
      const r = await query<{
        inapp_team_updates: number; inapp_tipster_updates: number;
        email_team_updates: number; email_tipster_updates: number; email_daily_digest: number;
        push_team_updates: number; push_tipster_updates: number; push_odds_alerts: number;
      }>('SELECT * FROM notification_preferences WHERE user_id = ? LIMIT 1', [userId]);
      if (r.rows[0]) {
        const row = r.rows[0];
        return {
          inappTeamUpdates: !!row.inapp_team_updates,
          inappTipsterUpdates: !!row.inapp_tipster_updates,
          emailTeamUpdates: !!row.email_team_updates,
          emailTipsterUpdates: !!row.email_tipster_updates,
          emailDailyDigest: !!row.email_daily_digest,
          pushTeamUpdates: !!row.push_team_updates,
          pushTipsterUpdates: !!row.push_tipster_updates,
          pushOddsAlerts: !!row.push_odds_alerts,
        };
      }
    } catch {}
  }
  return stores.preferences.get(userId) ?? { ...DEFAULT_PREFS };
}

export async function setPreferences(userId: number, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const current = await getPreferences(userId);
  const merged = { ...current, ...prefs };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO notification_preferences
          (user_id, inapp_team_updates, inapp_tipster_updates,
           email_team_updates, email_tipster_updates, email_daily_digest,
           push_team_updates, push_tipster_updates, push_odds_alerts, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           inapp_team_updates = EXCLUDED.inapp_team_updates,
           inapp_tipster_updates = EXCLUDED.inapp_tipster_updates,
           email_team_updates = EXCLUDED.email_team_updates,
           email_tipster_updates = EXCLUDED.email_tipster_updates,
           email_daily_digest = EXCLUDED.email_daily_digest,
           push_team_updates = EXCLUDED.push_team_updates,
           push_tipster_updates = EXCLUDED.push_tipster_updates,
           push_odds_alerts = EXCLUDED.push_odds_alerts,
           updated_at = NOW()`,
        [
          userId,
          merged.inappTeamUpdates ? 1 : 0,
          merged.inappTipsterUpdates ? 1 : 0,
          merged.emailTeamUpdates ? 1 : 0,
          merged.emailTipsterUpdates ? 1 : 0,
          merged.emailDailyDigest ? 1 : 0,
          merged.pushTeamUpdates ? 1 : 0,
          merged.pushTipsterUpdates ? 1 : 0,
          merged.pushOddsAlerts ? 1 : 0,
        ]
      );
    } catch {}
  }
  stores.preferences.set(userId, merged);
  try { savePrefsToFile(stores.preferences); } catch {}
  return merged;
}

// ─── NOTIFICATIONS ───────────────────────────────
export async function listNotifications(userId: number, opts: { limit?: number; unreadOnly?: boolean } = {}): Promise<NotificationRow[]> {
  const { limit = 50, unreadOnly = false } = opts;
  if (hasDb()) {
    try {
      const where = unreadOnly ? 'AND is_read = 0' : '';
      const r = await query<{
        id: number; user_id: number; type: string; title: string; content: string;
        link: string | null; channel: string; is_read: number; created_at: string;
      }>(
        `SELECT id, user_id, type, title, content, link, channel, is_read, created_at
         FROM notifications WHERE user_id = ? ${where}
         ORDER BY created_at DESC LIMIT ?`,
        [userId, limit]
      );
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id,
          userId: x.user_id,
          type: x.type,
          title: x.title,
          content: x.content,
          link: x.link,
          channel: x.channel,
          isRead: !!x.is_read,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch {}
  }
  const mem = stores.notifications
    .filter(n => n.userId === userId && (!unreadOnly || !n.isRead))
    .slice(0, limit);
  return mem;
}

export async function createNotification(input: Omit<NotificationRow, 'id' | 'isRead' | 'createdAt'>): Promise<NotificationRow> {
  const row: NotificationRow = {
    id: Date.now(),
    isRead: false,
    createdAt: new Date().toISOString(),
    ...input,
  };
  if (hasDb()) {
    try {
      const res = await execute(
        `INSERT INTO notifications (user_id, type, title, content, link, channel, is_read)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [row.userId, row.type, row.title, row.content, row.link || null, row.channel || 'inapp']
      );
      if (res.insertId) row.id = res.insertId;
    } catch {}
  }
  stores.notifications.unshift(row);
  if (stores.notifications.length > 500) stores.notifications.length = 500;
  return row;
}

export async function markNotificationsRead(userId: number, ids?: number[]): Promise<number> {
  let count = 0;
  if (hasDb()) {
    try {
      if (ids && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const r = await query(
          `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
          [userId, ...ids]
        );
        count = r.affectedRows ?? 0;
      } else {
        const r = await query(
          `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
          [userId]
        );
        count = r.affectedRows ?? 0;
      }
    } catch {}
  }
  for (const n of stores.notifications) {
    if (n.userId !== userId) continue;
    if (ids && !ids.includes(n.id)) continue;
    if (!n.isRead) { n.isRead = true; count++; }
  }
  return count;
}

export async function getUnreadCount(userId: number): Promise<number> {
  if (hasDb()) {
    try {
      const r = await query<{ c: number }>(
        `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`,
        [userId]
      );
      return Number(r.rows[0]?.c ?? 0);
    } catch {}
  }
  return stores.notifications.filter(n => n.userId === userId && !n.isRead).length;
}

// ─── PUSH SUBSCRIPTIONS ──────────────────────────
export async function savePushSubscription(input: Omit<PushSubscriptionRow, 'id'>): Promise<PushSubscriptionRow> {
  const id = `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const row: PushSubscriptionRow = { id, ...input };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO push_subscriptions
          (id, user_id, endpoint, p256dh, auth, topics, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON CONFLICT (endpoint) DO UPDATE SET topics = EXCLUDED.topics`,
        [id, row.userId, row.endpoint, row.p256dh, row.auth, JSON.stringify(row.topics), row.countryCode || null]
      );
    } catch {}
  }
  for (const [k, v] of stores.pushSubs) {
    if (v.endpoint === row.endpoint) { stores.pushSubs.delete(k); break; }
  }
  stores.pushSubs.set(row.endpoint, row);
  return row;
}

export async function listPushSubscriptions(userId?: number): Promise<PushSubscriptionRow[]> {
  if (hasDb()) {
    try {
      const sql = userId
        ? 'SELECT * FROM push_subscriptions WHERE user_id = ?'
        : 'SELECT * FROM push_subscriptions';
      const r = await query<{ id: string; user_id: number; endpoint: string; p256dh: string; auth: string; topics: string; country_code: string | null }>(
        sql, userId ? [userId] : []
      );
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id,
          userId: x.user_id,
          endpoint: x.endpoint,
          p256dh: x.p256dh,
          auth: x.auth,
          topics: JSON.parse(x.topics || '[]'),
          countryCode: x.country_code,
        }));
      }
    } catch {}
  }
  const all = Array.from(stores.pushSubs.values());
  return userId ? all.filter(s => s.userId === userId) : all;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (hasDb()) {
    try {
      await query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    } catch {}
  }
  stores.pushSubs.delete(endpoint);
}

// ─── EMAIL SUBSCRIBERS ───────────────────────────
export async function saveEmailSubscriber(input: Omit<EmailSubscriberRow, 'id'>): Promise<EmailSubscriberRow> {
  const id = `es_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const row: EmailSubscriberRow = {
    id,
    active: true,
    ...input,
  };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO email_subscribers
          (id, email, topics, country_code, unsubscribe_token, active, created_at)
         VALUES (?, ?, ?, ?, ?, TRUE, NOW())
         ON CONFLICT (email) DO UPDATE SET topics = EXCLUDED.topics, active = TRUE, country_code = EXCLUDED.country_code`,
        [id, row.email, JSON.stringify(row.topics), row.countryCode || null, row.unsubscribeToken]
      );
    } catch {}
  }
  for (const [k, v] of stores.emailSubs) {
    if (v.email === row.email) {
      stores.emailSubs.delete(k);
      break;
    }
  }
  stores.emailSubs.set(row.email, row);
  return row;
}

export async function listEmailSubscribers(topic?: string): Promise<EmailSubscriberRow[]> {
  if (hasDb()) {
    try {
      const r = await query<{ id: string; email: string; topics: string; country_code: string | null; unsubscribe_token: string; active: number }>(
        'SELECT * FROM email_subscribers WHERE active = 1'
      );
      if (r.rows.length > 0) {
        const all = r.rows.map(x => ({
          id: x.id,
          email: x.email,
          topics: JSON.parse(x.topics || '[]') as string[],
          countryCode: x.country_code,
          unsubscribeToken: x.unsubscribe_token,
          active: !!x.active,
        }));
        return topic ? all.filter(s => s.topics.includes(topic)) : all;
      }
    } catch {}
  }
  const all = Array.from(stores.emailSubs.values()).filter(s => s.active);
  return topic ? all.filter(s => s.topics.includes(topic)) : all;
}

export async function unsubscribeEmail(token: string): Promise<boolean> {
  let ok = false;
  if (hasDb()) {
    try {
      const r = await query(
        `UPDATE email_subscribers SET active = 0 WHERE unsubscribe_token = ?`,
        [token]
      );
      ok = (r.affectedRows ?? 0) > 0;
    } catch {}
  }
  for (const [, v] of stores.emailSubs) {
    if (v.unsubscribeToken === token) {
      v.active = false;
      ok = true;
    }
  }
  return ok;
}
