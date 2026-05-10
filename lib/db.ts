import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool: mysql.Pool | null = null;

interface FileDbConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

function getFileConfig(): FileDbConfig | null {
  try {
    const configFile = path.join(process.cwd(), '.local', 'state', 'admin', 'db-config.json');
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf8')) as FileDbConfig;
    }
  } catch { /* ignore */ }
  return null;
}

export function getPool(): mysql.Pool | null {
  const envHost     = process.env.DB_HOST     || process.env.MYSQL_HOST;
  const envUser     = process.env.DB_USER     || process.env.MYSQL_USER;
  const envPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const envDatabase = process.env.DB_NAME     || process.env.MYSQL_DATABASE;

  // Fall back to admin-panel saved config when env vars are not set
  const fileCfg = (!envHost || !envUser || !envDatabase) ? getFileConfig() : null;

  const host     = envHost     || fileCfg?.host;
  const user     = envUser     || fileCfg?.user;
  const password = envPassword || fileCfg?.password;
  const database = envDatabase || fileCfg?.database;

  if (!host || !user || !database) return null;

  if (!pool) {
    pool = mysql.createPool({
      host,
      port: fileCfg?.port || parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user,
      password: password || '',
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }

  return pool;
}

/** Reset the pool so the next call to getPool() picks up new config. */
export function resetPool(): void {
  if (pool) {
    pool.end().catch(() => { /* ignore */ });
    pool = null;
  }
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) {
    return { rows: [] };
  }
  const [rows] = await p.execute(sql, params);
  return { rows: rows as T[], affectedRows: undefined };
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
  if (!p) {
    throw new Error('No MySQL database connection available');
  }
  const [result] = await p.execute(sql, params);
  const r = result as mysql.ResultSetHeader;
  return { insertId: r.insertId, affectedRows: r.affectedRows };
}

export async function withTransaction<T>(
  callback: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) {
    throw new Error('No MySQL database connection available');
  }
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

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
