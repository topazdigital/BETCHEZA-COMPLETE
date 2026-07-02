import fs from 'fs';
import path from 'path';

const ANALYTICS_FILE = path.join(process.cwd(), '.local', 'data', 'ad-analytics.json');

export interface AdEventRecord {
  opens: number;
  clicks: number;
  firstOpenAt?: string;
  lastOpenAt?: string;
  firstClickAt?: string;
  lastClickAt?: string;
}

export type AdAnalyticsStore = Record<string, AdEventRecord>;

function read(): AdAnalyticsStore {
  try {
    if (!fs.existsSync(ANALYTICS_FILE)) return {};
    return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8')) as AdAnalyticsStore;
  } catch {
    return {};
  }
}

function write(data: AdAnalyticsStore): void {
  try {
    fs.mkdirSync(path.dirname(ANALYTICS_FILE), { recursive: true });
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export function recordOpen(entryId: string): void {
  const data = read();
  const rec = data[entryId] ?? { opens: 0, clicks: 0 };
  const now = new Date().toISOString();
  rec.opens += 1;
  if (!rec.firstOpenAt) rec.firstOpenAt = now;
  rec.lastOpenAt = now;
  data[entryId] = rec;
  write(data);
}

export function recordClick(entryId: string): void {
  const data = read();
  const rec = data[entryId] ?? { opens: 0, clicks: 0 };
  const now = new Date().toISOString();
  rec.clicks += 1;
  if (!rec.firstClickAt) rec.firstClickAt = now;
  rec.lastClickAt = now;
  data[entryId] = rec;
  write(data);
}

export function getAnalytics(): AdAnalyticsStore {
  return read();
}

export function getRecord(entryId: string): AdEventRecord {
  return read()[entryId] ?? { opens: 0, clicks: 0 };
}
