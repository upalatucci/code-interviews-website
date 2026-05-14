import { neon, type FullQueryResults } from '@neondatabase/serverless';

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<FullQueryResults<false>>;

let _sql: SqlFn | null = null;

function getSql(): SqlFn {
  if (!_sql) {
    if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL env var is not set');
    _sql = neon(process.env.POSTGRES_URL, { fullResults: true }) as unknown as SqlFn;
  }
  return _sql;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<FullQueryResults<false>> {
  return getSql()(strings, ...values);
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Challenge {
  id: number;
  title: string;
  time_limit_minutes: number | null;
  created_at: string;
  // joined
  coding_challenges?: CodingChallenge[];
  interview_questions?: InterviewQuestion[];
}

export interface CodingChallenge {
  id: number;
  challenge_id: number;
  title: string;
  description: string; // Markdown
  starter_code: string;
  language: string;
  position: number;
}

export interface InterviewQuestion {
  id: number;
  challenge_id: number;
  text: string; // plain
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
  // joined
  challenge_title?: string;
  time_limit_minutes?: number | null;
}

export interface Save {
  id: number;
  link_id: number;
  codes: string;   // JSON: Record<number, string>
  answers: string; // JSON: Record<number, string>
  saved_at: string;
  is_final: boolean;
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  // Domain tables
  await sql`CREATE TABLE IF NOT EXISTS challenges (
    id                 SERIAL PRIMARY KEY,
    title              TEXT NOT NULL,
    time_limit_minutes INTEGER DEFAULT NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS coding_challenges (
    id           SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    title        TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    starter_code TEXT DEFAULT '',
    language     TEXT DEFAULT 'javascript',
    position     INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS interview_questions (
    id           SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    text         TEXT NOT NULL DEFAULT '',
    position     INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS interview_links (
    id              SERIAL PRIMARY KEY,
    challenge_id    INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    token           TEXT UNIQUE NOT NULL,
    candidate_name  TEXT DEFAULT '',
    candidate_email TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    first_opened_at TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ
  )`;

  await sql`CREATE TABLE IF NOT EXISTS saves (
    id       SERIAL PRIMARY KEY,
    link_id  INTEGER NOT NULL REFERENCES interview_links(id) ON DELETE CASCADE,
    codes    TEXT NOT NULL DEFAULT '{}',
    answers  TEXT NOT NULL DEFAULT '{}',
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    is_final BOOLEAN NOT NULL DEFAULT FALSE
  )`;

  // Auth tables (NextAuth v4)
  await sql`CREATE TABLE IF NOT EXISTS auth_users (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name           TEXT,
    email          TEXT UNIQUE,
    email_verified TIMESTAMPTZ,
    image          TEXT
  )`;

  await sql`CREATE TABLE IF NOT EXISTS auth_verification_tokens (
    identifier TEXT NOT NULL,
    token      TEXT UNIQUE NOT NULL,
    expires    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
  )`;

  // Migrations for existing installs
  await sql`ALTER TABLE interview_links ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
  await sql`ALTER TABLE saves ADD COLUMN IF NOT EXISTS codes    TEXT    NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE saves ADD COLUMN IF NOT EXISTS answers  TEXT    NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE saves ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE`;

  schemaReady = true;
}

// ─── Convenience query helpers ────────────────────────────────────────────────

export async function getChallenges(): Promise<Challenge[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM challenges ORDER BY created_at DESC`;
  for (const c of rows as Challenge[]) {
    const { rows: cc } = await sql`SELECT * FROM coding_challenges WHERE challenge_id = ${c.id} ORDER BY position`;
    const { rows: iq } = await sql`SELECT * FROM interview_questions WHERE challenge_id = ${c.id} ORDER BY position`;
    c.coding_challenges = cc as CodingChallenge[];
    c.interview_questions = iq as InterviewQuestion[];
  }
  return rows as Challenge[];
}

export async function getLinks(): Promise<(InterviewLink & { challenge_title: string })[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT il.*, c.title AS challenge_title
    FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
    ORDER BY il.created_at DESC
  `;
  return rows as (InterviewLink & { challenge_title: string })[];
}

export async function getSubmission(linkId: number) {
  await ensureSchema();
  const { rows: lr } = await sql`
    SELECT il.*, c.title AS challenge_title, c.time_limit_minutes
    FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
    WHERE il.id = ${linkId}
  `;
  if (!lr.length) return null;
  const link = lr[0] as InterviewLink & { time_limit_minutes: number | null };
  const [{ rows: saves }, { rows: ccs }, { rows: iqs }] = await Promise.all([
    sql`SELECT id, saved_at, is_final, codes, answers FROM saves WHERE link_id = ${linkId} ORDER BY saved_at DESC`,
    sql`SELECT * FROM coding_challenges WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
    sql`SELECT * FROM interview_questions WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
  ]);
  return { link, saves: saves as Save[], codingChallenges: ccs as CodingChallenge[], questions: iqs as InterviewQuestion[] };
}
