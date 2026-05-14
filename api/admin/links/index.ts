import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema, type InterviewLink } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { challengeId } = req.query as { challengeId?: string };
      let result;
      if (challengeId) {
        result = await sql`
          SELECT il.*, c.title AS challenge_title
          FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
          WHERE il.challenge_id = ${parseInt(challengeId, 10)}
          ORDER BY il.created_at DESC
        `;
      } else {
        result = await sql`
          SELECT il.*, c.title AS challenge_title
          FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
          ORDER BY il.created_at DESC
        `;
      }
      return res.json(result.rows as InterviewLink[]);
    }

    if (req.method === 'POST') {
      const {
        challenge_id,
        candidate_name = '',
        candidate_email = '',
      } = (req.body ?? {}) as {
        challenge_id?: number;
        candidate_name?: string;
        candidate_email?: string;
      };

      if (!challenge_id) return res.status(400).json({ error: 'challenge_id is required' });

      const token = crypto.randomBytes(16).toString('hex');
      const result = await sql`
        INSERT INTO interview_links (challenge_id, token, candidate_name, candidate_email)
        VALUES (${challenge_id}, ${token}, ${candidate_name}, ${candidate_email})
        RETURNING id
      `;
      return res.json({ id: (result.rows[0] as { id: number }).id, token });
    }

    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
