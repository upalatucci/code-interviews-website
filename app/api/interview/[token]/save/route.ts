import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const { codes = {}, answers = {} } = await req.json() as { codes?: Record<number,string>; answers?: Record<number,string> };
    await ensureSchema();
    const { rows } = await sql`SELECT id, submitted_at FROM interview_links WHERE token = ${token}`;
    if (!rows.length) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    const link = rows[0] as { id: number; submitted_at: string | null };
    if (link.submitted_at) return NextResponse.json({ error: 'Already submitted' }, { status: 403 });
    await sql`INSERT INTO saves (link_id, codes, answers, is_final) VALUES (${link.id}, ${JSON.stringify(codes)}, ${JSON.stringify(answers)}, FALSE)`;
    return NextResponse.json({ ok: true });
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
