import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, ensureSchema } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).end();

  await ensureSchema();
  const id = parseInt(req.query['id'] as string, 10);
  await sql`DELETE FROM interview_links WHERE id = ${id}`;
  return res.json({ ok: true });
}
