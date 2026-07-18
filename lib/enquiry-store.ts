/**
 * enquiry-store.ts
 * File-based store for partnership/advertise enquiries.
 * Messages are always saved here AND emailed, so the admin
 * can read them without opening Roundcube.
 */
import fs from 'fs';
import path from 'path';

export interface Enquiry {
  id: string;
  createdAt: string; // ISO
  company: string;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  budget?: string;
  model?: string;
  message?: string;
  read: boolean;
}

const DATA_DIR = path.join(process.cwd(), '.local', 'data');
const FILE = path.join(DATA_DIR, 'enquiries.json');

function load(): Enquiry[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Enquiry[];
  } catch {
    return [];
  }
}

function save(data: Enquiry[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function saveEnquiry(fields: Omit<Enquiry, 'id' | 'createdAt' | 'read'>): Enquiry {
  const all = load();
  const entry: Enquiry = {
    id: `enq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    read: false,
    ...fields,
  };
  all.unshift(entry); // newest first
  save(all);
  return entry;
}

export function listEnquiries(): Enquiry[] {
  return load();
}

export function markEnquiryRead(id: string): boolean {
  const all = load();
  const item = all.find(e => e.id === id);
  if (!item) return false;
  item.read = true;
  save(all);
  return true;
}

export function deleteEnquiry(id: string): boolean {
  const all = load();
  const next = all.filter(e => e.id !== id);
  if (next.length === all.length) return false;
  save(next);
  return true;
}

export function unreadCount(): number {
  return load().filter(e => !e.read).length;
}
