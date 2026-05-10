/**
 * Simple file-based key-value store used as a fallback when MySQL is not connected.
 * Persists JSON data to .local/state/admin/ so admin configs survive restarts.
 */
import fs from 'fs';
import path from 'path';

function getStateDir(): string {
  if (process.env.APP_DIR) return path.join(process.env.APP_DIR, '.local', 'state', 'admin');
  if (fs.existsSync('/home/admin/apps/betcheza')) return '/home/admin/apps/betcheza/.local/state/admin';
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return path.join(dir, '.local', 'state', 'admin');
    const p = path.dirname(dir);
    if (p === dir) break;
    dir = p;
  }
  return path.join(process.cwd(), '.local', 'state', 'admin');
}

function ensureDir(d: string): void {
  try { fs.mkdirSync(d, { recursive: true }); } catch { /* ignore */ }
}

export function fileStoreGet<T>(key: string, fallback: T): T {
  try {
    const d = getStateDir();
    ensureDir(d);
    const file = path.join(d, `${key}.json`);
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function fileStoreSet<T>(key: string, value: T): void {
  try {
    const d = getStateDir();
    ensureDir(d);
    fs.writeFileSync(path.join(d, `${key}.json`), JSON.stringify(value, null, 2), 'utf8');
  } catch (e) {
    console.warn('[file-store] write failed:', e);
  }
}
