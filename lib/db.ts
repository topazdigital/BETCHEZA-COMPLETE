import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool | null {
  const host = process.env.MYSQL_HOST || process.env.DB_HOST;
  const user = process.env.MYSQL_USER || process.env.DB_USER;
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || process.env.MYSQL_DATABASE;

  if (!host || !user || !database) return null;

  if (!pool) {
    pool = mysql.createPool({
      host,
      user,
      password: password || '',
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+00:00',
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
