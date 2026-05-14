import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema, type InterviewLink, type CodingChallenge, type InterviewQuestion } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await ensureSchema();
    const { rows: lr } = await sql`
      SELECT il.*, c.title AS challenge_title, c.time_limit_minutes
      FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
      WHERE il.token = ${token}
    `;
    if (!lr.length) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    const link = lr[0] as InterviewLink & { time_limit_minutes: number | null };

    if (!link.first_opened_at) {
      await sql`UPDATE interview_links SET first_opened_at = NOW() WHERE token = ${token}`;
    }

    const [{ rows: ccRows }, { rows: iqRows }, { rows: saveRows }] = await Promise.all([
      sql`SELECT * FROM coding_challenges WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
      sql`SELECT * FROM interview_questions WHERE challenge_id = ${link.challenge_id} ORDER BY position`,
      sql`SELECT codes, answers FROM saves WHERE link_id = ${link.id} ORDER BY saved_at DESC LIMIT 1`,
    ]);

    let savedCodes: Record<number, string> = {};
    let savedAnswers: Record<number, string> = {};
    if (saveRows.length) {
      const s = saveRows[0] as { codes: string; answers: string };
      try { savedCodes  = JSON.parse(s.codes   || '{}'); } catch { /* noop */ }
      try { savedAnswers = JSON.parse(s.answers || '{}'); } catch { /* noop */ }
    }

    const needsStart = !!link.time_limit_minutes && !link.started_at && !link.submitted_at;
    let remainingSeconds: number | null = null;
    if (link.time_limit_minutes && link.started_at) {
      remainingSeconds = Math.floor(link.time_limit_minutes * 60 - (Date.now() - new Date(link.started_at).getTime()) / 1000);
    }

    return NextResponse.json({
      title: link.challenge_title,
      submitted: !!link.submitted_at,
      timeLimitMinutes: link.time_limit_minutes,
      remainingSeconds, needsStart,
      codingChallenges: (ccRows as CodingChallenge[]).map(c => ({
        id: c.id, title: c.title, description: c.description,
        starterCode: savedCodes[c.id] ?? c.starter_code,
        language: c.language, position: c.position,
      })),
      questions: (iqRows as InterviewQuestion[]).map(q => ({ id: q.id, text: q.text, position: q.position })),
      savedAnswers,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
