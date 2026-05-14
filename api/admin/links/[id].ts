import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).end();

  try {
    await ensureSchema();
    const id = parseInt(req.query['id'] as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await sql`DELETE FROM interview_links WHERE id = ${id}`;
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
