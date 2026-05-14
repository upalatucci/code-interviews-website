import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink, type CodingChallenge, type InterviewQuestion } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  await ensureSchema();
  const { token } = req.query as { token: string };

  const linkResult = await sql`
    SELECT il.*, c.title AS challenge_title, c.time_limit_minutes
    FROM interview_links il
    JOIN challenges c ON c.id = il.challenge_id
    WHERE il.token = ${token}
  `;
  const linkRows = linkResult.rows as (InterviewLink & { time_limit_minutes: number | null })[];
  if (!linkRows.length) return res.status(404).json({ error: 'Link not found' });
  const link = linkRows[0];

  if (!link.first_opened_at) {
    await sql`UPDATE interview_links SET first_opened_at = NOW() WHERE token = ${token}`;
  }

  const [codingResult, questionsResult, savesResult] = await Promise.all([
    sql`SELECT * FROM coding_challenges WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
    sql`SELECT * FROM interview_questions WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
    sql`SELECT codes, answers FROM saves WHERE link_id = ${link.id} ORDER BY saved_at DESC LIMIT 1`,
  ]);

  const codingChallenges = codingResult.rows as CodingChallenge[];
  const questions = questionsResult.rows as InterviewQuestion[];

  let savedCodes: Record<number, string> = {};
  let savedAnswers: Record<number, string> = {};
  if (savesResult.rows.length) {
    const latest = savesResult.rows[0] as { codes: string; answers: string };
    try { savedCodes = JSON.parse(latest.codes || '{}') as Record<number, string>; } catch { /* noop */ }
    try { savedAnswers = JSON.parse(latest.answers || '{}') as Record<number, string>; } catch { /* noop */ }
  }

  // Timer: based on started_at, not first_opened_at
  let remainingSeconds: number | null = null;
  const needsStart = !!link.time_limit_minutes && !link.started_at && !link.submitted_at;

  if (link.time_limit_minutes && link.started_at) {
    const elapsed = Date.now() - new Date(link.started_at).getTime();
    remainingSeconds = Math.floor(link.time_limit_minutes * 60 - elapsed / 1000);
  }

  return res.json({
    title: link.challenge_title,
    submitted: !!link.submitted_at,
    timeLimitMinutes: link.time_limit_minutes,
    remainingSeconds,
    needsStart,
    codingChallenges: codingChallenges.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      starterCode: savedCodes[c.id] ?? c.starter_code,
      language: c.language,
      position: c.position,
    })),
    questions: questions.map(q => ({ id: q.id, text: q.text, position: q.position })),
    savedAnswers,
  });
}
