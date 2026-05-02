import mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool | null {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (!url) return null;

  if (!pool) {
    pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return pool;
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) {
    console.warn('[db] No MySQL connection, returning empty result');
    return { rows: [] };
  }
  const [rows] = await p.execute(sql, params as mysql.QueryOptions['values']);
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
  const [result] = await p.execute(sql, params as mysql.QueryOptions['values']);
  const res = result as mysql.ResultSetHeader;
  return { insertId: res.insertId, affectedRows: res.affectedRows };
}

// Transaction helper
export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
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

// Close pool on app shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
