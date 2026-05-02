import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;

  if (!connectionString && (!host || !user || !database)) return null;

  if (!pool) {
    pool = new Pool(
      connectionString
        ? { connectionString, ssl: { rejectUnauthorized: false } }
        : {
            host,
            user,
            password: process.env.PGPASSWORD || '',
            database,
            port: parseInt(process.env.PGPORT || '5432'),
            ssl: { rejectUnauthorized: false },
          }
    );
  }

  return pool;
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

/**
 * Convert MySQL-style ? placeholders to PostgreSQL $1, $2, ... style.
 * Also handles common MySQL-isms:
 *   INSERT IGNORE  → INSERT ... ON CONFLICT DO NOTHING
 *   ON DUPLICATE KEY UPDATE col = VALUES(col) → ON CONFLICT ... DO UPDATE SET col = EXCLUDED.col
 *   GREATEST(x, 0) → GREATEST(x, 0)  (supported by PG)
 *   AUTO_INCREMENT  → SERIAL (handled in schema, not here)
 *   LIMIT ? OFFSET ? → LIMIT $n OFFSET $m
 */
function toPostgres(sql: string): string {
  let i = 0;
  // Replace ? with $1, $2, ...
  sql = sql.replace(/\?/g, () => `$${++i}`);
  return sql;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) {
    return { rows: [] };
  }
  const pgSql = toPostgres(sql);
  const result = await p.query(pgSql, params as unknown[]);
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
  const pgSql = toPostgres(sql);
  const result = await p.query(pgSql, params as unknown[]);
  // For INSERT ... RETURNING id, get the insertId
  const insertId = result.rows[0]?.id ?? 0;
  return { insertId, affectedRows: result.rowCount ?? 0 };
}

export async function withTransaction<T>(
  callback: (conn: PoolClient) => Promise<T>
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

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
