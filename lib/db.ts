import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  return pool;
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

/**
 * Convert MySQL-style ? placeholders to PostgreSQL $1, $2, ... placeholders.
 */
function convertPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) {
    console.warn('[db] No PostgreSQL connection (DATABASE_URL not set), returning empty result');
    return { rows: [] };
  }
  const converted = convertPlaceholders(sql);
  const result = await p.query(converted, params as unknown[]);
  return { rows: result.rows as T[], affectedRows: result.rowCount ?? 0 };
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
    throw new Error('No PostgreSQL database connection available (DATABASE_URL not set)');
  }
  const converted = convertPlaceholders(sql);
  const result = await p.query(converted, params as unknown[]);
  const insertId = result.rows?.[0]?.id ?? 0;
  return { insertId, affectedRows: result.rowCount ?? 0 };
}

export async function withTransaction<T>(
  callback: (conn: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) {
    throw new Error('No PostgreSQL database connection available (DATABASE_URL not set)');
  }
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
