import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink } from '../../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  await ensureSchema();
  const { token } = req.query as { token: string };
  const { code, answers = {} } = (req.body ?? {}) as { code?: unknown; answers?: unknown };
  if (typeof code !== 'string') return res.status(400).json({ error: 'Invalid payload' });

  const result = await sql`
    SELECT id, submitted_at FROM interview_links WHERE token = ${token}
  `;
  const rows = result.rows as Pick<InterviewLink, 'id' | 'submitted_at'>[];
  if (!rows.length) return res.status(404).json({ error: 'Link not found' });
  const link = rows[0];
  if (link.submitted_at) return res.status(403).json({ error: 'Already submitted' });

  const answersJson = JSON.stringify(answers);
  await sql`INSERT INTO saves (link_id, code, answers, is_final) VALUES (${link.id}, ${code}, ${answersJson}, TRUE)`;
  await sql`UPDATE interview_links SET submitted_at = NOW() WHERE id = ${link.id}`;
  return res.json({ ok: true });
}
