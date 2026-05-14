'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { sql, ensureSchema } from '@/lib/db';

export async function generateLink(challengeId: number, candidateName: string, candidateEmail: string) {
  await ensureSchema();
  const token = crypto.randomBytes(16).toString('hex');
  const { rows } = await sql`
    INSERT INTO interview_links (challenge_id, token, candidate_name, candidate_email)
    VALUES (${challengeId}, ${token}, ${candidateName}, ${candidateEmail})
    RETURNING id
  `;
  revalidatePath('/admin/links');
  return { id: (rows[0] as { id: number }).id, token };
}

export async function deleteLink(id: number) {
  await ensureSchema();
  await sql`DELETE FROM interview_links WHERE id = ${id}`;
  revalidatePath('/admin/links');
}
