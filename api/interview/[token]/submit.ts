import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink } from '../../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawToken = req.query['token'];
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const { codes = {}, answers = {} } = (req.body ?? {}) as {
    codes?: Record<number, string>;
    answers?: Record<number, string>;
  };

  try {
    await ensureSchema();

    const result = await sql`SELECT id, submitted_at FROM interview_links WHERE token = ${token}`;
    const rows = result.rows as Pick<InterviewLink, 'id' | 'submitted_at'>[];
    if (!rows.length) return res.status(404).json({ error: 'Link not found' });
    const link = rows[0];
    if (link.submitted_at) return res.status(403).json({ error: 'Already submitted' });

    await sql`
      INSERT INTO saves (link_id, codes, answers, is_final)
      VALUES (${link.id}, ${JSON.stringify(codes)}, ${JSON.stringify(answers)}, TRUE)
    `;
    await sql`UPDATE interview_links SET submitted_at = NOW() WHERE id = ${link.id}`;
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
