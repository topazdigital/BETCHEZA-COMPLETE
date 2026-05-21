import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

const COOLDOWN_MS = 30_000;
const g = globalThis as {
  __dbCircuitOpen?: boolean;
  __dbCircuitOpenAt?: number;
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
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
}

export function getPool(): Pool | null {
  if (isCircuitOpen()) return null;

  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;

  if (!connectionString && (!host || !user || !database)) return null;

  if (!pool) {
    pool = new Pool(
      connectionString
        ? { connectionString, ssl: { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000 }
        : {
            host,
            port: parseInt(process.env.PGPORT || '5432'),
            user,
            password: process.env.PGPASSWORD || '',
            database,
            ssl: { rejectUnauthorized: false },
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 8000,
          }
    );
    pool.on('error', (err) => {
      console.warn('[db] pool error:', err.message);
    });
  }

  return pool;
}

export function resetPool(): void {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
  g.__dbCircuitOpen = false;
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

function isRecoverableDbError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code === 'ETIMEDOUT' || e?.code === 'ECONNREFUSED' || e?.code === 'ENOTFOUND') return true;
  if (typeof e?.message === 'string' && (
    e.message.toLowerCase().includes('pool is closed') ||
    e.message.toLowerCase().includes('connection lost') ||
    e.message.toLowerCase().includes('closed state')
  )) return true;
  return false;
}

export function toPositionalParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) return { rows: [] };
  try {
    const result = await p.query(toPositionalParams(sql), params);
    return { rows: result.rows as T[], affectedRows: result.rowCount ?? undefined };
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
  if (!p) throw new Error('No PostgreSQL database connection available');
  try {
    const result = await p.query(toPositionalParams(sql), params);
    const insertId = result.rows?.[0]?.id ?? 0;
    return { insertId, affectedRows: result.rowCount ?? 0 };
  } catch (err: unknown) {
    if (isRecoverableDbError(err)) openCircuit();
    throw err;
  }
}

export async function withTransaction<T>(
  callback: (conn: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) throw new Error('No PostgreSQL database connection available');
  const conn = await p.connect();
  try {
    await conn.query('BEGIN');
    const result = await callback(conn);
    await conn.query('COMMIT');
    return result;
  } catch (error) {
    await conn.query('ROLLBACK');
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
