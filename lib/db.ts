/**
 * Database connection layer — AWS RDS PostgreSQL.
 *
 * Uses a shared connection pool. All modules query the SAME database
 * (one RDS instance, multiple table groups prefixed per module).
 *
 * Configuration comes from environment variables (see .env.example):
 *   DATABASE_URL   — full postgres connection string, OR
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (individual parts)
 *
 * When the AWS account + RDS is ready, plug the connection string into
 * .env.local and this layer works with zero code changes.
 */

import pg, { Pool, type PoolClient, type QueryResultRow } from "pg";

// ── Return dates/timestamps as STRINGS, not JS Date objects ──
// The original system (via Supabase/PostgREST) received dates as ISO
// strings. Raw `pg` converts `date`/`timestamptz` columns to Date
// objects by default, which breaks string logic in computeStatus.ts.
// These parsers keep the exact string behavior the pure logic expects.
pg.types.setTypeParser(1082, (v) => v); // date  -> "YYYY-MM-DD"
pg.types.setTypeParser(1114, (v) => v); // timestamp (no tz)
pg.types.setTypeParser(1184, (v) => v); // timestamptz
// numeric -> Number (mappers already call Number(), but be safe)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

let pool: Pool | null = null;

/** Lazily create the shared pool on first use. */
export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    pool = new Pool({
      connectionString,
      // RDS requires SSL in production
      ssl:
        process.env.DB_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX ?? 15),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
  } else {
    // Fallback to individual parts
    pool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl:
        process.env.DB_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX ?? 15),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return pool;
}

/**
 * Run a parameterized query. Always use $1, $2 placeholders.
 * Retries once on transient connection timeouts (RDS can be slow to
 * establish the first connection after idle).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const p = getPool();
      const res = await p.query<T>(text, params as never[]);
      return res.rows;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient =
        msg.includes("timeout") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("Connection terminated") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("ECONNREFUSED");
      if (!transient) throw err;
      // Transient connection issue — brief wait, retry on the SAME pool.
      // Short backoff keeps total latency low even with several retries.
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Run multiple statements in a single transaction. */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Quick health check — used by /api/health and setup verification. */
export async function pingDb(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
