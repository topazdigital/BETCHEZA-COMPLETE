/**
 * Simple file-based key-value store used as a fallback when MySQL is not connected.
 * Persists JSON data to .local/state/ so admin configs survive restarts.
 */
import fs from 'fs';
import path from 'path';

const STATE_DIR = path.join(process.cwd(), '.local', 'state', 'admin');

function ensureDir() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  } catch { /* ignore */ }
}

export function fileStoreGet<T>(key: string, fallback: T): T {
  try {
    ensureDir();
    const file = path.join(STATE_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function fileStoreSet<T>(key: string, value: T): void {
  try {
    ensureDir();
    const file = path.join(STATE_DIR, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  } catch (e) {
    console.warn('[file-store] write failed:', e);
  }
}
