import { query, execute } from './db';
import { fileStoreGet, fileStoreSet } from './file-store';

export type NotificationChannel = 'inapp' | 'email' | 'push';
export type NotificationType =
  | 'team_match_starting'
  | 'team_result'
  | 'team_news'
  | 'tipster_new_tip'
  | 'tipster_tip_won'
  | 'tipster_post'
  | 'match_lineup'
  | 'odds_drop'
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'follow_new'
  | 'feed_mention'
  | 'admin_broadcast'
  | 'system';

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
  emailTeamUpdates: true,
  emailTipsterUpdates: false,
  emailDailyDigest: false,
  pushTeamUpdates: false,
  pushTipsterUpdates: false,
  pushOddsAlerts: false,
};

export interface NotificationRow {
  id: number;
  userId: number;
  type: NotificationType | string;
  title: string;
  content: string;
  link?: string | null;
  channel: NotificationChannel;
  isRead: boolean;
  createdAt: string;
}

export interface PushSubscriptionRow {
  id: string;
  userId: number | null; // null means anonymous device
  endpoint: string;
  p256dh: string;
  auth: string;
  topics: string[];
  countryCode?: string | null;
  createdAt: string;
}

export interface EmailSubscriberRow {
  id: string;
  email: string;
  topics: string[];
  countryCode?: string | null;
  unsubscribeToken: string;
  createdAt: string;
  active: boolean;
}

interface MemoryStores {
  notifications: NotificationRow[];
  preferences: Map<number, NotificationPreferences>;
  pushSubs: Map<string, PushSubscriptionRow>;
  emailSubs: Map<string, EmailSubscriberRow>;
  nextNotifId: number;
}

const g = globalThis as { __notifStore?: MemoryStores };
g.__notifStore = g.__notifStore || {
  notifications: [],
  preferences: new Map(),
  pushSubs: new Map(),
  emailSubs: new Map(),
  nextNotifId: 1,
};
const stores = g.__notifStore;

const hasDb = () => !!process.env.DATABASE_URL;

// ─── PREFERENCES ─────────────────────────────────

const PREFS_FILE_KEY = 'notification-preferences';

function loadPrefsFromFile(): Map<number, NotificationPreferences> {
  const raw = fileStoreGet<Record<string, NotificationPreferences>>(PREFS_FILE_KEY, {});
  const map = new Map<number, NotificationPreferences>();
  for (const [k, v] of Object.entries(raw)) {
    map.set(Number(k), v);
  }
  return map;
}

function savePrefsToFile(map: Map<number, NotificationPreferences>) {
  const obj: Record<string, NotificationPreferences> = {};
  for (const [k, v] of map.entries()) {
    obj[String(k)] = v;
  }
  fileStoreSet(PREFS_FILE_KEY, obj);
}

// Bootstrap in-memory store from file on first use (survives HMR).
let _prefsLoaded = false;
function ensurePrefsLoaded() {
  if (_prefsLoaded) return;
  _prefsLoaded = true;
  try {
    const fileMap = loadPrefsFromFile();
    for (const [k, v] of fileMap.entries()) {
      if (!stores.preferences.has(k)) {
        stores.preferences.set(k, v);
      }
    }
  } catch {}
}

export async function getPreferences(userId: number): Promise<NotificationPreferences> {
  if (hasDb()) {
    try {
      const r = await query<Record<string, number | boolean>>(
        `SELECT * FROM notification_preferences WHERE user_id = ? LIMIT 1`,
        [userId]
      );
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
  ensurePrefsLoaded();
  return stores.preferences.get(userId) || { ...DEFAULT_PREFS };
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
         ON DUPLICATE KEY UPDATE
           inapp_team_updates = VALUES(inapp_team_updates),
           inapp_tipster_updates = VALUES(inapp_tipster_updates),
           email_team_updates = VALUES(email_team_updates),
           email_tipster_updates = VALUES(email_tipster_updates),
           email_daily_digest = VALUES(email_daily_digest),
           push_team_updates = VALUES(push_team_updates),
           push_tipster_updates = VALUES(push_tipster_updates),
           push_odds_alerts = VALUES(push_odds_alerts),
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
  // Persist to file so prefs survive server restarts
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
          channel: (x.channel as NotificationChannel) || 'inapp',
          isRead: !!x.is_read,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch {}
  }
  let result = stores.notifications.filter(n => n.userId === userId);
  if (unreadOnly) result = result.filter(n => !n.isRead);
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function createNotification(input: Omit<NotificationRow, 'id' | 'createdAt' | 'isRead'>): Promise<NotificationRow> {
  const row: NotificationRow = {
    id: stores.nextNotifId++,
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
  stores.notifications.push(row);
  if (stores.notifications.length > 5000) stores.notifications.splice(0, stores.notifications.length - 5000);
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
    if (!n.isRead) {
      n.isRead = true;
      count++;
    }
  }
  return count;
}

// ─── PUSH SUBSCRIPTIONS ─────────────────────────
export async function savePushSubscription(input: Omit<PushSubscriptionRow, 'id' | 'createdAt'>): Promise<PushSubscriptionRow> {
  const id = `psub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row: PushSubscriptionRow = {
    id,
    createdAt: new Date().toISOString(),
    ...input,
  };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO push_subscriptions
          (id, user_id, endpoint, p256dh, auth, topics, country_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE topics = VALUES(topics)`,
        [id, row.userId, row.endpoint, row.p256dh, row.auth, JSON.stringify(row.topics), row.countryCode || null]
      );
    } catch {}
  }
  // Replace any existing subscription with same endpoint
  for (const [k, v] of stores.pushSubs) {
    if (v.endpoint === row.endpoint) stores.pushSubs.delete(k);
  }
  stores.pushSubs.set(id, row);
  return row;
}

export async function listPushSubscriptions(userId?: number): Promise<PushSubscriptionRow[]> {
  // Simple memory implementation; in production this would page from DB.
  const all = Array.from(stores.pushSubs.values());
  if (typeof userId === 'number') return all.filter(s => s.userId === userId);
  return all;
}

// ─── EMAIL SUBSCRIBERS ──────────────────────────
function makeToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function subscribeEmail(input: { email: string; topics: string[]; countryCode?: string | null }): Promise<EmailSubscriberRow> {
  const id = `esub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row: EmailSubscriberRow = {
    id,
    email: input.email.trim().toLowerCase(),
    topics: input.topics,
    countryCode: input.countryCode || null,
    unsubscribeToken: makeToken(),
    createdAt: new Date().toISOString(),
    active: true,
  };
  if (hasDb()) {
    try {
      await query(
        `INSERT INTO email_subscribers
          (id, email, topics, country_code, unsubscribe_token, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE topics = VALUES(topics), active = 1, country_code = VALUES(country_code)`,
        [id, row.email, JSON.stringify(row.topics), row.countryCode || null, row.unsubscribeToken]
      );
    } catch {}
  }
  for (const [k, v] of stores.emailSubs) {
    if (v.email === row.email) {
      // merge topics
      row.topics = Array.from(new Set([...v.topics, ...row.topics]));
      row.unsubscribeToken = v.unsubscribeToken;
      stores.emailSubs.delete(k);
    }
  }
  stores.emailSubs.set(id, row);
  return row;
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
  for (const [k, v] of stores.emailSubs) {
    if (v.unsubscribeToken === token) {
      v.active = false;
      stores.emailSubs.set(k, v);
      ok = true;
    }
  }
  return ok;
}

export async function listEmailSubscribers(): Promise<EmailSubscriberRow[]> {
  if (hasDb()) {
    try {
      const r = await query<{
        id: string; email: string; topics: string; country_code: string | null;
        unsubscribe_token: string; active: number; created_at: string;
      }>(`SELECT id, email, topics, country_code, unsubscribe_token, active, created_at FROM email_subscribers ORDER BY created_at DESC LIMIT 500`);
      if (r.rows.length > 0) {
        return r.rows.map(x => ({
          id: x.id,
          email: x.email,
          topics: safeJson(x.topics, []),
          countryCode: x.country_code,
          unsubscribeToken: x.unsubscribe_token,
          active: !!x.active,
          createdAt: typeof x.created_at === 'string' ? x.created_at : new Date(x.created_at).toISOString(),
        }));
      }
    } catch {}
  }
  return Array.from(stores.emailSubs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns IDs of ALL registered users — used by admin broadcast to notify everyone. */
export async function listAllUserIds(): Promise<number[]> {
  if (hasDb()) {
    try {
      const r = await query<{ id: number }>(
        `SELECT id FROM users ORDER BY id ASC LIMIT 10000`
      );
      if (r.rows.length > 0) return r.rows.map(x => x.id);
    } catch {}
  }
  // Fallback: derive from in-memory notifications
  const ids = new Set<number>();
  stores.notifications.forEach(n => ids.add(n.userId));
  return Array.from(ids);
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
