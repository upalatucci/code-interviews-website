import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT il.id, il.submitted_at, il.started_at, c.time_limit_minutes
      FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
      WHERE il.token = ${token}
    `;
    if (!rows.length) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    const link = rows[0] as { id: number; submitted_at: string|null; started_at: string|null; time_limit_minutes: number|null };
    if (link.submitted_at) return NextResponse.json({ error: 'Already submitted' }, { status: 403 });
    if (!link.started_at) await sql`UPDATE interview_links SET started_at = NOW() WHERE id = ${link.id}`;
    const startedAt = link.started_at ? new Date(link.started_at) : new Date();
    const remainingSeconds = link.time_limit_minutes
      ? Math.floor(link.time_limit_minutes * 60 - (Date.now() - startedAt.getTime()) / 1000)
      : null;
    return NextResponse.json({ ok: true, remainingSeconds });
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
