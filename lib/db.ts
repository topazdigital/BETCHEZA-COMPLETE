import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool: mysql.Pool | null = null;
let poolHost: string | null = null;
let poolUser: string | null = null;
let poolDatabase: string | null = null;

interface FileDbConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

const COOLDOWN_MS = 30_000;
const g = globalThis as {
  __dbCircuitOpen?: boolean;
  __dbCircuitOpenAt?: number;
  __dbPool?: mysql.Pool | null;
  __dbPoolHost?: string | null;
  __dbPoolUser?: string | null;
  __dbPoolDatabase?: string | null;
};

function isCircuitOpen(): boolean {
  if (!g.__dbCircuitOpen) return false;
  if (Date.now() - (g.__dbCircuitOpenAt ?? 0) > COOLDOWN_MS) {
    g.__dbCircuitOpen = false;
    return false;
  }
  return true;
}

function openCircuit(): void {
  g.__dbCircuitOpen = true;
  g.__dbCircuitOpenAt = Date.now();
  if (g.__dbPool) {
    g.__dbPool.end().catch(() => { });
    g.__dbPool = null;
    g.__dbPoolHost = null;
    g.__dbPoolUser = null;
    g.__dbPoolDatabase = null;
  }
  pool = null;
  poolHost = null;
  poolUser = null;
  poolDatabase = null;
}

function getFileConfig(): FileDbConfig | null {
  try {
    const configFile = path.join(process.cwd(), '.local', 'state', 'admin', 'db-config.json');
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf8')) as FileDbConfig;
    }
  } catch { }
  return null;
}

export function getPool(): mysql.Pool | null {
  if (isCircuitOpen()) return null;

  const envHost     = process.env.DB_HOST     || process.env.MYSQL_HOST;
  const envUser     = process.env.DB_USER     || process.env.MYSQL_USER;
  const envPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const envDatabase = process.env.DB_NAME     || process.env.MYSQL_DATABASE;

  const fileCfg = (!envHost || !envUser || !envDatabase) ? getFileConfig() : null;

  const host     = envHost     || fileCfg?.host;
  const user     = envUser     || fileCfg?.user;
  const password = envPassword || fileCfg?.password;
  const database = envDatabase || fileCfg?.database;

  if (!host || !user || !database) return null;

  // Use global to survive Next.js hot-reloads in dev
  const currentHost = g.__dbPoolHost;
  const currentUser = g.__dbPoolUser;
  const currentDb   = g.__dbPoolDatabase;

  // Recreate pool if credentials changed (e.g. env var update)
  if (g.__dbPool && (currentHost !== host || currentUser !== user || currentDb !== database)) {
    g.__dbPool.end().catch(() => { });
    g.__dbPool = null;
    g.__dbPoolHost = null;
    g.__dbPoolUser = null;
    g.__dbPoolDatabase = null;
  }

  if (!g.__dbPool) {
    g.__dbPool = mysql.createPool({
      host,
      port: fileCfg?.port || parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user,
      password: password || '',
      database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+00:00',
      connectTimeout: 3000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    g.__dbPoolHost     = host;
    g.__dbPoolUser     = user;
    g.__dbPoolDatabase = database;
  }

  pool = g.__dbPool;
  poolHost = host;
  poolUser = user;
  poolDatabase = database;

  return pool;
}

export function resetPool(): void {
  if (g.__dbPool) {
    g.__dbPool.end().catch(() => { });
    g.__dbPool = null;
    g.__dbPoolHost = null;
    g.__dbPoolUser = null;
    g.__dbPoolDatabase = null;
  }
  pool = null;
  poolHost = null;
  poolUser = null;
  poolDatabase = null;
  g.__dbCircuitOpen = false;
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

function isRecoverableDbError(err: unknown): boolean {
  const e = err as { code?: string; errno?: string; message?: string };
  if (e?.code === 'ETIMEDOUT' || e?.code === 'ECONNREFUSED' || e?.code === 'ENOTFOUND' || e?.errno === 'ETIMEDOUT') return true;
  // Auth / credential errors — trip the circuit so we stop hammering the DB until credentials change
  if (e?.code === 'ER_ACCESS_DENIED_ERROR' || e?.code === 'ER_NOT_ALLOWED_COMMAND' || e?.code === 'ER_HOST_NOT_PRIVILEGED') return true;
  if (typeof e?.message === 'string' && (
    e.message.toLowerCase().includes('pool is closed') ||
    e.message.toLowerCase().includes('connection lost') ||
    e.message.toLowerCase().includes('closed state') ||
    e.message.toLowerCase().includes('access denied')
  )) return true;
  return false;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) return { rows: [] };
  try {
    const [rows] = await p.execute(sql, params);
    return { rows: rows as T[], affectedRows: undefined };
  } catch (err: unknown) {
    if (isRecoverableDbError(err)) openCircuit();
    throw err;
  }
}

export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] || null;
}

export interface ExecuteResult {
  insertId: number;
  affectedRows: number;
}

export async function execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
  const p = getPool();
  if (!p) throw new Error('No MySQL database connection available');
  try {
    const [result] = await p.execute(sql, params);
    const r = result as mysql.ResultSetHeader;
    return { insertId: r.insertId, affectedRows: r.affectedRows };
  } catch (err: unknown) {
    if (isRecoverableDbError(err)) openCircuit();
    throw err;
  }
}

/**
 * Creates a FRESH one-off connection that bypasses the circuit breaker and pool entirely.
 * Use this for critical admin writes (role changes, approvals) where a silent no-op is
 * unacceptable — the pool circuit breaker can be open due to earlier transient errors,
 * causing query() / execute() to silently discard writes with no error thrown.
 *
 * On success, resets the circuit breaker so the shared pool recovers too.
 */
export async function directExecute(sql: string, params?: unknown[]): Promise<ExecuteResult & { warning?: string }> {
  const envHost     = process.env.DB_HOST     || process.env.MYSQL_HOST;
  const envUser     = process.env.DB_USER     || process.env.MYSQL_USER;
  const envPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const envDatabase = process.env.DB_NAME     || process.env.MYSQL_DATABASE;
  const fileCfg = (!envHost || !envUser || !envDatabase) ? getFileConfig() : null;

  const host     = envHost     || fileCfg?.host;
  const user     = envUser     || fileCfg?.user;
  const password = envPassword || fileCfg?.password;
  const database = envDatabase || fileCfg?.database;

  if (!host || !user || !database) {
    throw new Error('No database configuration available (check DB_HOST, DB_USER, DB_NAME env vars)');
  }

  const conn = await mysql.createConnection({
    host,
    port: fileCfg?.port || parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
    user,
    password: password || '',
    database,
    connectTimeout: 10_000,
    charset: 'utf8mb4',
    timezone: '+00:00',
  });

  try {
    const [result] = await conn.execute(sql, params);
    const r = result as mysql.ResultSetHeader;
    // A successful direct connection means the DB is reachable — reset any circuit breaker
    if (g.__dbCircuitOpen) {
      g.__dbCircuitOpen = false;
      console.log('[db] directExecute: circuit breaker reset after successful connection');
    }
    return { insertId: r.insertId, affectedRows: r.affectedRows };
  } finally {
    conn.destroy();
  }
}

/**
 * directQuery — like directExecute but for SELECT statements that return rows.
 * Bypasses the circuit breaker for reads when the pool is down.
 */
export async function directQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const envHost     = process.env.DB_HOST     || process.env.MYSQL_HOST;
  const envUser     = process.env.DB_USER     || process.env.MYSQL_USER;
  const envPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const envDatabase = process.env.DB_NAME     || process.env.MYSQL_DATABASE;
  const fileCfg = (!envHost || !envUser || !envDatabase) ? getFileConfig() : null;

  const host     = envHost     || fileCfg?.host;
  const user     = envUser     || fileCfg?.user;
  const password = envPassword || fileCfg?.password;
  const database = envDatabase || fileCfg?.database;

  if (!host || !user || !database) throw new Error('No database configuration available');

  const conn = await mysql.createConnection({
    host,
    port: fileCfg?.port || parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
    user,
    password: password || '',
    database,
    connectTimeout: 10_000,
    charset: 'utf8mb4',
    timezone: '+00:00',
  });

  try {
    const [rows] = await conn.execute(sql, params);
    if (g.__dbCircuitOpen) g.__dbCircuitOpen = false;
    return rows as T[];
  } finally {
    conn.destroy();
  }
}

export async function withTransaction<T>(
  callback: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) throw new Error('No MySQL database connection available');
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * MySQL 5.7-compatible alternative to `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
 * Adds `col` to `table` only when absent; silently ignores ER_DUP_FIELDNAME.
 */
export async function addColumnIfMissing(table: string, col: string, def: string): Promise<void> {
  try {
    await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== 'ER_DUP_FIELDNAME') {
      // ignore quietly — table might not exist, or no ALTER privilege
    }
  }
}

export async function closePool(): Promise<void> {
  if (g.__dbPool) {
    await g.__dbPool.end();
    g.__dbPool = null;
    g.__dbPoolHost = null;
    g.__dbPoolUser = null;
    g.__dbPoolDatabase = null;
  }
  pool = null;
}
