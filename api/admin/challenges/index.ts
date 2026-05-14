import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type Challenge } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  await ensureSchema();

  if (req.method === 'GET') {
    const result = await sql`SELECT * FROM challenges ORDER BY created_at DESC`;
    return res.json(result.rows as Challenge[]);
  }

  if (req.method === 'POST') {
    const {
      title,
      description,
      starter_code = '',
      language = 'javascript',
      questions = [],
      time_limit_minutes = null,
    } = (req.body ?? {}) as Partial<Pick<Challenge, 'title' | 'description' | 'starter_code' | 'language' | 'time_limit_minutes'>> & {
      questions?: string[];
    };

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const questionsJson = JSON.stringify(questions);
    const result = await sql`
      INSERT INTO challenges (title, description, starter_code, language, questions, time_limit_minutes)
      VALUES (${title}, ${description}, ${starter_code}, ${language}, ${questionsJson}, ${time_limit_minutes})
      RETURNING id
    `;
    return res.json({ id: (result.rows[0] as { id: number }).id });
  }

  return res.status(405).end();
}
