import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink, type CodingChallenge, type InterviewQuestion, type Save } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const linkId = parseInt(req.query['linkId'] as string, 10);
  if (isNaN(linkId)) return res.status(400).json({ error: 'Invalid linkId' });

  try {
    await ensureSchema();

    const linkResult = await sql`
      SELECT il.*, c.title AS challenge_title, c.time_limit_minutes
      FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
      WHERE il.id = ${linkId}
    `;
    const linkRows = linkResult.rows as (InterviewLink & { time_limit_minutes: number | null })[];
    if (!linkRows.length) return res.status(404).json({ error: 'Not found' });
    const link = linkRows[0];

    const [savesResult, codingResult, questionsResult] = await Promise.all([
      sql`SELECT id, saved_at, is_final, codes, answers FROM saves WHERE link_id = ${linkId} ORDER BY saved_at DESC`,
      sql`SELECT * FROM coding_challenges WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
      sql`SELECT * FROM interview_questions WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
    ]);

    return res.json({
      link,
      saves: savesResult.rows as Save[],
      codingChallenges: codingResult.rows as CodingChallenge[],
      questions: questionsResult.rows as InterviewQuestion[],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
