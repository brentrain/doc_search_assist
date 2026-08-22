import { neon } from '@neondatabase/serverless';

let initialized = false;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  return neon(connectionString);
}

export async function ensureSchema() {
  if (initialized) return;
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      document_kind TEXT NOT NULL DEFAULT 'general',
      blob_url TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, filename)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id)`;
  initialized = true;
}
