import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.PGHOST || process.env.DB_HOST;
  const user = process.env.PGUSER || process.env.DB_USER;
  const database = process.env.PGDATABASE || process.env.DB_NAME;

  if (!connectionString && (!host || !user || !database)) return null;

  if (!pool) {
    pool = new Pool(
      connectionString
        ? { connectionString, ssl: { rejectUnauthorized: false } }
        : {
            host,
            user,
            password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
            database,
            port: parseInt(process.env.PGPORT || '5432'),
          }
    );
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
  const { sql: pgSql, params: pgParams } = convertToPostgres(sql, params);
  const result = await p.query(pgSql, pgParams);
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
  // Add RETURNING id for INSERT statements so we can get the insertId
  let sqlWithReturn = sql.trimEnd();
  const isInsert = /^\s*INSERT\s/i.test(sqlWithReturn);
  if (isInsert && !/RETURNING/i.test(sqlWithReturn)) {
    sqlWithReturn = sqlWithReturn + ' RETURNING id';
  }
  const { sql: pgSql, params: pgParams } = convertToPostgres(sqlWithReturn, params);
  const result = await p.query(pgSql, pgParams);
  const insertId = result.rows?.[0]?.id ?? 0;
  return { insertId, affectedRows: result.rowCount ?? 0 };
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) {
    throw new Error('No PostgreSQL database connection available');
  }
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Comprehensive MySQL → PostgreSQL SQL converter.
 * Handles: ? placeholders, INSERT IGNORE, ON DUPLICATE KEY UPDATE,
 * ENGINE=InnoDB, CHARSET, AUTO_INCREMENT, TINYINT, LONGTEXT, BIGINT UNSIGNED,
 * ENUM types, INDEX syntax in CREATE TABLE, ON UPDATE CURRENT_TIMESTAMP,
 * VALUES(col) references, backtick identifiers, GREATEST().
 */
function convertToPostgres(sql: string, params?: unknown[]): { sql: string; params: unknown[] } {
  let result = sql;

  // 1. Backtick identifiers → double quotes
  result = result.replace(/`([^`]+)`/g, '"$1"');

  // 2. MySQL table options → strip
  result = result.replace(/\s+ENGINE\s*=\s*\w+/gi, '');
  result = result.replace(/\s+DEFAULT\s+CHARSET\s*=\s*\w+/gi, '');
  result = result.replace(/\s+COLLATE\s*=?\s*[\w_]+/gi, '');
  result = result.replace(/\s+AUTO_INCREMENT/gi, '');
  result = result.replace(/\s+CHARACTER\s+SET\s+\w+/gi, '');

  // 3. ON UPDATE CURRENT_TIMESTAMP → strip (PostgreSQL needs triggers for this)
  result = result.replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');

  // 4. Data type conversions
  result = result.replace(/\bBIGINT\s+UNSIGNED\b/gi, 'BIGINT');
  result = result.replace(/\bINT\s+UNSIGNED\b/gi, 'INTEGER');
  result = result.replace(/\bTINYINT\s*\(\s*1\s*\)/gi, 'BOOLEAN');
  result = result.replace(/\bTINYINT\b/gi, 'SMALLINT');
  result = result.replace(/\bLONGTEXT\b/gi, 'TEXT');
  result = result.replace(/\bMEDIUMTEXT\b/gi, 'TEXT');
  result = result.replace(/\bDATETIME\b/gi, 'TIMESTAMP');
  result = result.replace(/\bINT\s*\(\s*\d+\s*\)/gi, 'INTEGER');
  result = result.replace(/\bBIGINT\s*\(\s*\d+\s*\)/gi, 'BIGINT');

  // 5. ENUM → VARCHAR with CHECK constraint
  result = result.replace(/\bENUM\s*\(([^)]+)\)/gi, (_, opts) => {
    const values = opts.split(',').map((s: string) => s.trim());
    return `VARCHAR(50) CHECK (??? IN (${values.join(', ')}))`;
  });
  // Remove the placeholder CHECK since we can't easily fix column name here
  result = result.replace(/VARCHAR\(50\) CHECK \(\?\?\? IN \([^)]+\)\)/g, 'VARCHAR(50)');

  // 6. Index definitions inside CREATE TABLE → strip (they're separate in PG)
  // Strip INDEX/KEY lines inside CREATE TABLE
  result = result.replace(/,\s*(?:UNIQUE\s+)?(?:INDEX|KEY)\s+\w+\s*\([^)]+\)/gi, '');
  // Strip inline PRIMARY KEY with UNIQUE KEY (already handled by PRIMARY KEY column def)
  result = result.replace(/,\s*UNIQUE\s+KEY\s+\w+\s*\([^)]+\)/gi, '');

  // 7. INSERT IGNORE → INSERT ... ON CONFLICT DO NOTHING
  result = result.replace(/\bINSERT\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  // We'll add ON CONFLICT DO NOTHING after the values if not already present
  // (handled in step 9 below)

  // 8. ON DUPLICATE KEY UPDATE col = VALUES(col), ... → ON CONFLICT (...) DO UPDATE SET col = EXCLUDED.col
  result = result.replace(
    /\bON\s+DUPLICATE\s+KEY\s+UPDATE\s+([\s\S]*?)(?=\s*(?:$|;|\)|RETURNING))/gi,
    (_, updateClause) => {
      // Convert col = VALUES(col) → col = EXCLUDED.col
      const pgUpdate = updateClause
        .trim()
        .replace(/(\w+)\s*=\s*VALUES\s*\(\s*(\w+)\s*\)/gi, '$1 = EXCLUDED.$2')
        .replace(/(\w+)\s*=\s*1\b/g, '$1 = TRUE') // active = 1
        .trimEnd()
        .replace(/,$/, ''); // trailing comma
      return `ON CONFLICT DO UPDATE SET ${pgUpdate}`;
    }
  );

  // 9. Handle remaining INSERT IGNORE (no ON DUPLICATE) → add ON CONFLICT DO NOTHING
  // After step 7, these become plain INSERT INTO. We detect them by checking if
  // the original had INSERT IGNORE and there's no ON CONFLICT yet.
  // We do this via a marker approach - recheck original sql
  if (/INSERT\s+IGNORE\s+INTO/i.test(sql) && !/ON\s+CONFLICT/i.test(result)) {
    // Append ON CONFLICT DO NOTHING before any RETURNING clause
    result = result.replace(/(VALUES\s*\([^)]*(?:\)[^)]*)*\))\s*(RETURNING)?/i, (_, vals, ret) => {
      return ret ? `${vals} ON CONFLICT DO NOTHING ${ret}` : `${vals} ON CONFLICT DO NOTHING`;
    });
  }

  // 10. NOW() is fine in PostgreSQL, CURRENT_TIMESTAMP too — keep as is

  // 11. GREATEST() is fine in PostgreSQL — keep as is

  // 12. COUNT(*) AS c — PostgreSQL returns BigInt from count, cast it
  result = result.replace(/COUNT\s*\(\s*\*\s*\)\s+AS\s+(\w+)/gi, 'COUNT(*)::int AS $1');

  // 13. Convert ? placeholders → $1, $2, ...
  let index = 0;
  result = result.replace(/\?/g, () => `$${++index}`);

  return { sql: result, params: params || [] };
}
