import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink, type Save } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  await ensureSchema();
  const linkId = parseInt(req.query['linkId'] as string, 10);

  const linkResult = await sql`
    SELECT il.*, c.title AS challenge_title, c.language, c.questions
    FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
    WHERE il.id = ${linkId}
  `;
  const linkRows = linkResult.rows as (InterviewLink & { language: string; questions: string })[];
  if (!linkRows.length) return res.status(404).json({ error: 'Not found' });

  const savesResult = await sql`
    SELECT id, saved_at, is_final, code, answers
    FROM saves
    WHERE link_id = ${linkId}
    ORDER BY saved_at DESC
  `;

  return res.json({
    link: linkRows[0],
    saves: savesResult.rows as Save[],
  });
}
