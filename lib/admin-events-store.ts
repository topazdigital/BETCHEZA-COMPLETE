import fs from 'node:fs';
import path from 'node:path';

export type AdminEventType =
  | 'user_register'
  | 'user_login'
  | 'payment_received'
  | 'email_sent'
  | 'newsletter_subscribe'
  | 'affiliate_click'
  | 'tipster_application'
  | 'subscription_purchase'
  | 'tip_posted'
  | 'user_banned';

export interface AdminEvent {
  id: string;
  type: AdminEventType;
  title: string;
  detail: string;
  meta?: Record<string, string | number | boolean | null>;
  ts: number;
  read: boolean;
}

const STORE_DIR = path.join(process.cwd(), '.local', 'state');
const STORE_FILE = path.join(STORE_DIR, 'admin-events.json');
const MAX_EVENTS = 500;

const g = globalThis as { __adminEvents?: AdminEvent[] };

function loadFromDisk(): AdminEvent[] {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as AdminEvent[];
    }
  } catch { /* ignore */ }
  return [];
}

function saveToDisk(events: AdminEvent[]) {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch { /* ignore */ }
}

function getEvents(): AdminEvent[] {
  if (!g.__adminEvents) {
    g.__adminEvents = loadFromDisk();
  }
  return g.__adminEvents;
}

export function logAdminEvent(
  type: AdminEventType,
  title: string,
  detail: string,
  meta?: AdminEvent['meta'],
) {
  const events = getEvents();
  const ev: AdminEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    detail,
    meta,
    ts: Date.now(),
    read: false,
  };
  events.unshift(ev);
  if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS);
  g.__adminEvents = events;
  saveToDisk(events);
}

export function getAdminEvents(opts?: { limit?: number; type?: AdminEventType }): AdminEvent[] {
  let events = getEvents();
  if (opts?.type) events = events.filter(e => e.type === opts.type);
  return events.slice(0, opts?.limit ?? 200);
}

export function markAllRead() {
  const events = getEvents();
  events.forEach(e => { e.read = true; });
  saveToDisk(events);
}

export function getUnreadCount(): number {
  return getEvents().filter(e => !e.read).length;
}

export function clearAdminEvents() {
  g.__adminEvents = [];
  saveToDisk([]);
}
