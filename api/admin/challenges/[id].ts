import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

interface CCInput {
  id?: number;
  title: string;
  description: string;
  starter_code: string;
  language: string;
  position: number;
}

interface QInput {
  id?: number;
  text: string;
  position: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  await ensureSchema();
  const id = parseInt(req.query['id'] as string, 10);

  if (req.method === 'PUT') {
    const {
      title,
      time_limit_minutes = null,
      coding_challenges = [],
      interview_questions = [],
    } = (req.body ?? {}) as {
      title?: string;
      time_limit_minutes?: number | null;
      coding_challenges?: CCInput[];
      interview_questions?: QInput[];
    };

    if (!title) return res.status(400).json({ error: 'title is required' });

    // Update challenge metadata
    await sql`
      UPDATE challenges SET title = ${title}, time_limit_minutes = ${time_limit_minutes} WHERE id = ${id}
    `;

    // Upsert coding challenges: keep existing IDs, insert new ones, delete removed ones
    const keptCcIds: number[] = [];
    for (const cc of coding_challenges) {
      if (cc.id) {
        await sql`
          UPDATE coding_challenges
          SET title = ${cc.title}, description = ${cc.description},
              starter_code = ${cc.starter_code}, language = ${cc.language}, position = ${cc.position}
          WHERE id = ${cc.id} AND challenge_id = ${id}
        `;
        keptCcIds.push(cc.id);
      } else {
        const { rows } = await sql`
          INSERT INTO coding_challenges (challenge_id, title, description, starter_code, language, position)
          VALUES (${id}, ${cc.title}, ${cc.description}, ${cc.starter_code}, ${cc.language}, ${cc.position})
          RETURNING id
        `;
        keptCcIds.push((rows[0] as { id: number }).id);
      }
    }
    // Delete coding challenges not in the kept list
    if (keptCcIds.length > 0) {
      const placeholders = keptCcIds.map((_, i) => `$${i + 2}`).join(', ');
      await sql`
        DELETE FROM coding_challenges
        WHERE challenge_id = ${id} AND id NOT IN (${keptCcIds as unknown as number})
      `;
    } else {
      await sql`DELETE FROM coding_challenges WHERE challenge_id = ${id}`;
    }

    // Upsert interview questions similarly
    const keptQIds: number[] = [];
    for (const q of interview_questions) {
      if (q.id) {
        await sql`
          UPDATE interview_questions SET text = ${q.text}, position = ${q.position}
          WHERE id = ${q.id} AND challenge_id = ${id}
        `;
        keptQIds.push(q.id);
      } else {
        const { rows } = await sql`
          INSERT INTO interview_questions (challenge_id, text, position)
          VALUES (${id}, ${q.text}, ${q.position}) RETURNING id
        `;
        keptQIds.push((rows[0] as { id: number }).id);
      }
    }
    if (keptQIds.length > 0) {
      await sql`
        DELETE FROM interview_questions
        WHERE challenge_id = ${id} AND id NOT IN (${keptQIds as unknown as number})
      `;
    } else {
      await sql`DELETE FROM interview_questions WHERE challenge_id = ${id}`;
    }

    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM challenges WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
