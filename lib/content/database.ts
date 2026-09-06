import { env } from 'cloudflare:workers';
export function getContentDatabase(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error('The curriculum database is not configured.');
  return db;
}
