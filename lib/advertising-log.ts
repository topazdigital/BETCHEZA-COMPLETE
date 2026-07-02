import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'data', 'advertising-history.json');

export interface AdSentEntry {
  id: string;
  sentAt: string;
  company: string;
  contactName?: string;
  email: string;
  subject: string;
  tier?: string;
  mode: 'template' | 'custom';
}

function readLog(): AdSentEntry[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    return JSON.parse(raw) as AdSentEntry[];
  } catch {
    return [];
  }
}

function writeLog(entries: AdSentEntry[]): void {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    // silently fail — history is best-effort
  }
}

export function appendEntry(entry: Omit<AdSentEntry, 'id' | 'sentAt'>): AdSentEntry {
  const entries = readLog();
  const newEntry: AdSentEntry = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    sentAt: new Date().toISOString(),
  };
  entries.unshift(newEntry); // newest first
  if (entries.length > 500) entries.splice(500); // cap at 500
  writeLog(entries);
  return newEntry;
}

export function getHistory(limit = 100): AdSentEntry[] {
  return readLog().slice(0, limit);
}

export function deleteEntry(id: string): boolean {
  const entries = readLog();
  const next = entries.filter(e => e.id !== id);
  if (next.length === entries.length) return false;
  writeLog(next);
  return true;
}
