import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink } from '../../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  await ensureSchema();
  const { token } = req.query as { token: string };

  const result = await sql`
    SELECT il.id, il.submitted_at, il.started_at, c.time_limit_minutes
    FROM interview_links il
    JOIN challenges c ON c.id = il.challenge_id
    WHERE il.token = ${token}
  `;
  const rows = result.rows as (Pick<InterviewLink, 'id' | 'submitted_at' | 'started_at'> & {
    time_limit_minutes: number | null;
  })[];

  if (!rows.length) return res.status(404).json({ error: 'Link not found' });
  const link = rows[0];
  if (link.submitted_at) return res.status(403).json({ error: 'Already submitted' });

  if (!link.started_at) {
    await sql`UPDATE interview_links SET started_at = NOW() WHERE id = ${link.id}`;
  }

  const startedAt = link.started_at ? new Date(link.started_at) : new Date();
  let remainingSeconds: number | null = null;
  if (link.time_limit_minutes) {
    remainingSeconds = Math.floor(link.time_limit_minutes * 60 - (Date.now() - startedAt.getTime()) / 1000);
  }

  return res.json({ ok: true, remainingSeconds });
}
