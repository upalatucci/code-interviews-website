import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink, type Save } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  await ensureSchema();
  const { token } = req.query as { token: string };

  const result = await sql`
    SELECT il.*, c.title, c.description, c.starter_code, c.language, c.questions, c.time_limit_minutes
    FROM interview_links il
    JOIN challenges c ON c.id = il.challenge_id
    WHERE il.token = ${token}
  `;
  const rows = result.rows as (InterviewLink & { time_limit_minutes: number | null })[];

  if (!rows.length) return res.status(404).json({ error: 'Link not found' });
  const link = rows[0];

  // Record first open (for tracking purposes only — not used for timer)
  if (!link.first_opened_at) {
    await sql`UPDATE interview_links SET first_opened_at = NOW() WHERE token = ${token}`;
  }

  const latest = await sql`
    SELECT code, answers FROM saves WHERE link_id = ${link.id} ORDER BY saved_at DESC LIMIT 1
  `;
  const saves = latest.rows as Pick<Save, 'code' | 'answers'>[];

  let questions: string[] = [];
  try { questions = JSON.parse(link.questions ?? '[]') as string[]; } catch { /* noop */ }

  let savedAnswers: Record<number, string> = {};
  if (saves.length) {
    try { savedAnswers = JSON.parse((saves[0] as { answers?: string }).answers ?? '{}') as Record<number, string>; } catch { /* noop */ }
  }

  // Timer logic: use started_at as origin (set when candidate confirms start)
  let remainingSeconds: number | null = null;
  const needsStart = !!link.time_limit_minutes && !link.started_at && !link.submitted_at;

  if (link.time_limit_minutes && link.started_at) {
    const elapsedMs = Date.now() - new Date(link.started_at).getTime();
    remainingSeconds = Math.floor(link.time_limit_minutes * 60 - elapsedMs / 1000);
  }

  return res.json({
    title: link.title,
    description: link.description,
    starterCode: saves.length ? saves[0].code : link.starter_code,
    language: link.language,
    submitted: !!link.submitted_at,
    candidateName: link.candidate_name,
    questions,
    savedAnswers,
    timeLimitMinutes: link.time_limit_minutes,
    remainingSeconds,
    /** true when a timed challenge hasn't been started yet — show confirmation dialog */
    needsStart,
  });
}
