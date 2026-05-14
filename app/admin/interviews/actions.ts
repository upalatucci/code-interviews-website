'use server';

import { revalidatePath } from 'next/cache';
import { sql, ensureSchema } from '@/lib/db';

interface CCInput { id?: number; title: string; description: string; starter_code: string; language: string; position: number }
interface QInput  { id?: number; text: string; position: number }

export async function createInterview(title: string, timeLimitMinutes: number | null): Promise<number> {
  await ensureSchema();
  const { rows } = await sql`INSERT INTO challenges (title, time_limit_minutes) VALUES (${title}, ${timeLimitMinutes}) RETURNING id`;
  return (rows[0] as { id: number }).id;
}

export async function updateInterview(
  id: number,
  title: string,
  timeLimitMinutes: number | null,
  codingChallenges: CCInput[],
  interviewQuestions: QInput[],
) {
  await ensureSchema();
  await sql`UPDATE challenges SET title = ${title}, time_limit_minutes = ${timeLimitMinutes} WHERE id = ${id}`;

  const keptCcIds: number[] = [];
  for (const cc of codingChallenges) {
    if (cc.id) {
      await sql`UPDATE coding_challenges SET title=${cc.title}, description=${cc.description}, starter_code=${cc.starter_code}, language=${cc.language}, position=${cc.position} WHERE id=${cc.id} AND challenge_id=${id}`;
      keptCcIds.push(cc.id);
    } else {
      const { rows } = await sql`INSERT INTO coding_challenges (challenge_id, title, description, starter_code, language, position) VALUES (${id},${cc.title},${cc.description},${cc.starter_code},${cc.language},${cc.position}) RETURNING id`;
      keptCcIds.push((rows[0] as { id: number }).id);
    }
  }
  if (keptCcIds.length > 0) {
    await sql`DELETE FROM coding_challenges WHERE challenge_id=${id} AND NOT (id = ANY(${keptCcIds}))`;
  } else {
    await sql`DELETE FROM coding_challenges WHERE challenge_id=${id}`;
  }

  const keptQIds: number[] = [];
  for (const q of interviewQuestions) {
    if (q.id) {
      await sql`UPDATE interview_questions SET text=${q.text}, position=${q.position} WHERE id=${q.id} AND challenge_id=${id}`;
      keptQIds.push(q.id);
    } else {
      const { rows } = await sql`INSERT INTO interview_questions (challenge_id, text, position) VALUES (${id},${q.text},${q.position}) RETURNING id`;
      keptQIds.push((rows[0] as { id: number }).id);
    }
  }
  if (keptQIds.length > 0) {
    await sql`DELETE FROM interview_questions WHERE challenge_id=${id} AND NOT (id = ANY(${keptQIds}))`;
  } else {
    await sql`DELETE FROM interview_questions WHERE challenge_id=${id}`;
  }

  revalidatePath('/admin/interviews');
}

export async function deleteInterview(id: number) {
  await ensureSchema();
  await sql`DELETE FROM challenges WHERE id = ${id}`;
  revalidatePath('/admin/interviews');
}
