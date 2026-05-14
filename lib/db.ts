import { neon, type FullQueryResults } from '@neondatabase/serverless';

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<FullQueryResults<false>>;

let _sql: SqlFn | null = null;

function getSql(): SqlFn {
  if (!_sql) {
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    _sql = neon(process.env.POSTGRES_URL, { fullResults: true }) as unknown as SqlFn;
  }
  return _sql;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<FullQueryResults<false>> {
  return getSql()(strings, ...values);
}

// ─── Row types ────────────────────────────────────────────────────────────────

export interface Challenge {
  id: number;
  title: string;
  description: string;
  starter_code: string;
  language: string;
  /** JSON string: string[] — list of open-ended questions for the candidate */
  questions: string;
  /** Optional time limit in minutes; NULL means no limit */
  time_limit_minutes: number | null;
  created_at: string;
}

export interface InterviewLink {
  id: number;
  challenge_id: number;
  token: string;
  candidate_name: string;
  candidate_email: string;
  created_at: string;
  first_opened_at: string | null;
  submitted_at: string | null;
  // joined fields
  challenge_title?: string;
  title?: string;
  description?: string;
  starter_code?: string;
  language?: string;
  questions?: string;
}

export interface Save {
  id: number;
  link_id: number;
  code: string;
  /** JSON string: Record<number, string> — candidate answers keyed by question index */
  answers: string;
  saved_at: string;
  is_final: boolean;
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS challenges (
      id                 SERIAL PRIMARY KEY,
      title              TEXT NOT NULL,
      description        TEXT NOT NULL,
      starter_code       TEXT DEFAULT '',
      language           TEXT DEFAULT 'javascript',
      questions          TEXT NOT NULL DEFAULT '[]',
      time_limit_minutes INTEGER DEFAULT NULL,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Migrate existing tables for any new columns
  await sql`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS questions          TEXT NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER DEFAULT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS interview_links (
      id              SERIAL PRIMARY KEY,
      challenge_id    INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      token           TEXT UNIQUE NOT NULL,
      candidate_name  TEXT DEFAULT '',
      candidate_email TEXT DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      first_opened_at TIMESTAMPTZ,
      submitted_at    TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS saves (
      id       SERIAL PRIMARY KEY,
      link_id  INTEGER NOT NULL REFERENCES interview_links(id) ON DELETE CASCADE,
      code     TEXT NOT NULL,
      answers  TEXT NOT NULL DEFAULT '{}',
      saved_at TIMESTAMPTZ DEFAULT NOW(),
      is_final BOOLEAN DEFAULT FALSE
    )
  `;

  // Migrate existing table if the answers column is missing
  await sql`
    ALTER TABLE saves ADD COLUMN IF NOT EXISTS answers TEXT NOT NULL DEFAULT '{}'
  `;

  schemaReady = true;
}
