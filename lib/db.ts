import { neon, type FullQueryResults } from '@neondatabase/serverless';

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<FullQueryResults<false>>;

let _sql: SqlFn | null = null;

function getSql(): SqlFn {
  if (!_sql) {
    if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL environment variable is not set');
    _sql = neon(process.env.POSTGRES_URL, { fullResults: true }) as unknown as SqlFn;
  }
  return _sql;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<FullQueryResults<false>> {
  return getSql()(strings, ...values);
}

// ─── Row types ────────────────────────────────────────────────────────────────

/** An interview template containing multiple coding challenges + questions */
export interface Challenge {
  id: number;
  title: string;
  time_limit_minutes: number | null;
  created_at: string;
}

/** One coding problem within an interview — description is Markdown */
export interface CodingChallenge {
  id: number;
  challenge_id: number;
  title: string;
  description: string;
  starter_code: string;
  language: string;
  position: number;
}

/** One open-ended text question within an interview — plain text */
export interface InterviewQuestion {
  id: number;
  challenge_id: number;
  text: string;
  position: number;
}

export interface InterviewLink {
  id: number;
  challenge_id: number;
  token: string;
  candidate_name: string;
  candidate_email: string;
  created_at: string;
  first_opened_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  challenge_title?: string;
}

export interface Save {
  id: number;
  link_id: number;
  /** JSON: Record<codingChallengeId, code> */
  codes: string;
  /** JSON: Record<questionId, answer> */
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
      time_limit_minutes INTEGER DEFAULT NULL,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS coding_challenges (
      id           SERIAL PRIMARY KEY,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      title        TEXT NOT NULL DEFAULT '',
      description  TEXT NOT NULL DEFAULT '',
      starter_code TEXT DEFAULT '',
      language     TEXT DEFAULT 'javascript',
      position     INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interview_questions (
      id           SERIAL PRIMARY KEY,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      text         TEXT NOT NULL DEFAULT '',
      position     INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interview_links (
      id              SERIAL PRIMARY KEY,
      challenge_id    INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      token           TEXT UNIQUE NOT NULL,
      candidate_name  TEXT DEFAULT '',
      candidate_email TEXT DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      first_opened_at TIMESTAMPTZ,
      started_at      TIMESTAMPTZ,
      submitted_at    TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS saves (
      id       SERIAL PRIMARY KEY,
      link_id  INTEGER NOT NULL REFERENCES interview_links(id) ON DELETE CASCADE,
      codes    TEXT NOT NULL DEFAULT '{}',
      answers  TEXT NOT NULL DEFAULT '{}',
      saved_at TIMESTAMPTZ DEFAULT NOW(),
      is_final BOOLEAN DEFAULT FALSE
    )
  `;

  // Migrations for existing installs
  await sql`ALTER TABLE interview_links ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
  await sql`ALTER TABLE saves ADD COLUMN IF NOT EXISTS codes    TEXT    NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE saves ADD COLUMN IF NOT EXISTS answers  TEXT    NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE saves ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE`;

  schemaReady = true;
}
