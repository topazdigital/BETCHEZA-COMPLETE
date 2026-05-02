import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
    });
  }

  return pool;
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

// Convert MySQL-style ? placeholders to PostgreSQL $1, $2, ... placeholders
function convertPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) {
    console.warn('[db] No PostgreSQL connection, returning empty result');
    return { rows: [] };
  }
  const converted = convertPlaceholders(sql);
  const result = await p.query(converted, params as unknown[]);
  return { rows: result.rows as T[], affectedRows: result.rowCount ?? undefined };
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
    throw new Error('No PostgreSQL database connection available');
  }
  const converted = convertPlaceholders(sql);
  const result = await p.query(converted, params as unknown[]);
  // For INSERT ... RETURNING id queries, extract insertId
  const insertId = result.rows[0]?.id ?? 0;
  return { insertId, affectedRows: result.rowCount ?? 0 };
}

// Transaction helper
export async function withTransaction<T>(
  callback: (connection: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) {
    throw new Error('No PostgreSQL database connection available');
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

// Close pool on app shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
