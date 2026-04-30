import mysql from 'mysql2/promise';

// MySQL connection pool
// In production: set DATABASE_URL to a MySQL connection string
// In dev on Replit without MySQL: the pool stays null and stores fall back to in-memory.

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('mysql')) return null;

  if (!pool) {
    pool = mysql.createPool(url);
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
  const [rows] = await p.query<mysql.RowDataPacket[]>(sql, params);
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
  const [result] = await p.execute<mysql.ResultSetHeader>(sql, params);
  return { insertId: result.insertId, affectedRows: result.affectedRows };
}

// Transaction helper
export async function withTransaction<T>(
  callback: (connection: mysql.Connection) => Promise<T>
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
