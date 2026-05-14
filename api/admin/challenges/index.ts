import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type Challenge, type CodingChallenge, type InterviewQuestion } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  await ensureSchema();

  if (req.method === 'GET') {
    const { rows: challenges } = await sql`SELECT * FROM challenges ORDER BY created_at DESC`;
    // Fetch sub-data for each challenge
    for (const c of challenges as (Challenge & {
      coding_challenges: CodingChallenge[];
      interview_questions: InterviewQuestion[];
    })[]) {
      const { rows: cc } = await sql`
        SELECT * FROM coding_challenges WHERE challenge_id = ${c.id} ORDER BY position
      `;
      const { rows: iq } = await sql`
        SELECT * FROM interview_questions WHERE challenge_id = ${c.id} ORDER BY position
      `;
      c.coding_challenges = cc as CodingChallenge[];
      c.interview_questions = iq as InterviewQuestion[];
    }
    return res.json(challenges);
  }

  if (req.method === 'POST') {
    const { title, time_limit_minutes = null } =
      (req.body ?? {}) as Partial<Pick<Challenge, 'title' | 'time_limit_minutes'>>;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows } = await sql`
      INSERT INTO challenges (title, time_limit_minutes) VALUES (${title}, ${time_limit_minutes}) RETURNING id
    `;
    return res.json({ id: (rows[0] as { id: number }).id });
  }

  return res.status(405).end();
}
