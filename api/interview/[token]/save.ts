import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink } from '../../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  await ensureSchema();
  const { token } = req.query as { token: string };
  const { codes = {}, answers = {} } = (req.body ?? {}) as {
    codes?: Record<number, string>;
    answers?: Record<number, string>;
  };

  const result = await sql`SELECT id, submitted_at FROM interview_links WHERE token = ${token}`;
  const rows = result.rows as Pick<InterviewLink, 'id' | 'submitted_at'>[];
  if (!rows.length) return res.status(404).json({ error: 'Link not found' });
  const link = rows[0];
  if (link.submitted_at) return res.status(403).json({ error: 'Already submitted' });

  await sql`
    INSERT INTO saves (link_id, codes, answers, is_final)
    VALUES (${link.id}, ${JSON.stringify(codes)}, ${JSON.stringify(answers)}, FALSE)
  `;
  return res.json({ ok: true });
}
