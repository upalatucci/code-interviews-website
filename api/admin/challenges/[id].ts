import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type Challenge } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  await ensureSchema();
  const id = parseInt(req.query['id'] as string, 10);

  if (req.method === 'PUT') {
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
    await sql`
      UPDATE challenges
      SET title              = ${title},
          description        = ${description},
          starter_code       = ${starter_code},
          language           = ${language},
          questions          = ${questionsJson},
          time_limit_minutes = ${time_limit_minutes}
      WHERE id = ${id}
    `;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM challenges WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
