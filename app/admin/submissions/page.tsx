import { getLinks } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SubmissionsPage() {
  const links = await getLinks();
  const active = links.filter(l => l.first_opened_at);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Submissions</h1>
      {active.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--pf-t--global--text--color--subtle)' }}>No submissions yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead style={{ background: 'var(--pf-t--global--background--color--secondary--default)' }}>
              <tr>
                {['Candidate','Interview','Status','Opened','Submitted',''].map(h => (
                  <th key={h} style={{ textAlign:'left',padding:'10px 14px',fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.4px',color:'var(--pf-t--global--text--color--subtle)',borderBottom:'1px solid var(--pf-t--global--border--color--default)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--pf-t--global--border--color--default)' }}>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontWeight: 500 }}>{l.candidate_name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--pf-t--global--text--color--subtle)' }}>{l.candidate_email}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>{l.challenge_title}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: l.submitted_at ? 'rgba(34,197,94,.15)' : 'rgba(240,171,0,.15)', color: l.submitted_at ? '#22c55e' : '#f0ab00' }}>
                      {l.submitted_at ? 'Submitted' : 'In progress'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 14px', fontSize: 12 }}>{l.first_opened_at ? new Date(l.first_opened_at).toLocaleString() : '—'}</td>
                  <td style={{ padding:'12px 14px', fontSize: 12 }}>{l.submitted_at ? new Date(l.submitted_at).toLocaleString() : '—'}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <Link href={`/admin/submissions/${l.id}`} style={{ fontSize: 13, color: 'var(--pf-t--global--color--brand--default, #06c)', textDecoration: 'none' }}>View code →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
