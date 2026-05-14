'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button, Label, Tabs, Tab, TabTitleText } from '@patternfly/react-core';
import { type Save, type CodingChallenge, type InterviewQuestion, type InterviewLink } from '@/lib/db';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface SubmissionData {
  link: InterviewLink & { time_limit_minutes: number | null };
  saves: Save[];
  codingChallenges: CodingChallenge[];
  questions: InterviewQuestion[];
}

export default function SubmissionDetail({ data }: { data: SubmissionData }) {
  const { link, saves, codingChallenges, questions } = data;
  const [selectedSaveIdx, setSelectedSaveIdx] = useState(0);
  const [activeCcTab, setActiveCcTab] = useState<string | number>(0);

  const save = saves[selectedSaveIdx];
  let codesMap: Record<number, string> = {};
  let answersMap: Record<number, string> = {};
  if (save) {
    try { codesMap  = JSON.parse(save.codes   || '{}') as Record<number, string>; } catch { /* noop */ }
    try { answersMap = JSON.parse(save.answers || '{}') as Record<number, string>; } catch { /* noop */ }
  }
  const currentCc = codingChallenges[Number(activeCcTab)];
  const code = currentCc ? (codesMap[currentCc.id] ?? '') : '';

  const meta = [
    ['Candidate', link.candidate_name || '—'],
    ['Email', link.candidate_email || '—'],
    ['Interview', link.challenge_title ?? '—'],
    ['Time limit', link.time_limit_minutes ? `${link.time_limit_minutes} min` : 'None'],
    ['Opened', link.first_opened_at ? new Date(link.first_opened_at).toLocaleString() : '—'],
    ['Submitted', link.submitted_at ? new Date(link.submitted_at).toLocaleString() : 'Not yet'],
    ['Total saves', String(saves.length)],
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/submissions"><Button variant="secondary" size="sm">← Back</Button></Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{link.candidate_name || 'Candidate'}</h1>
        <Link href={`/admin/links?create=${link.challenge_id}`}>
          <Button variant="primary" size="sm" style={{ background: '#ee0000', borderColor: '#ee0000' }}>Clone for another candidate</Button>
        </Link>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, marginBottom: 24 }}>
        {meta.map(([label, value]) => (
          <div key={label} style={{ background: 'var(--pf-t--global--background--color--secondary--default)', border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--pf-t--global--text--color--subtle)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Answers */}
      {questions.length > 0 && save && (
        <div style={{ border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 8, marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--pf-t--global--border--color--default)', fontWeight: 600 }}>Candidate Answers</div>
          <div style={{ padding: 16 }}>
            {questions.map((q, i) => {
              const answer = answersMap[q.id]?.trim();
              return (
                <div key={q.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < questions.length - 1 ? '1px solid var(--pf-t--global--border--color--default)' : 'none' }}>
                  <p style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Label isCompact>{i + 1}</Label>{q.text}
                  </p>
                  <pre style={{ background: 'var(--pf-t--global--background--color--secondary--default)', borderRadius: 4, padding: '8px 12px', fontSize: 13, whiteSpace: 'pre-wrap', color: answer ? 'inherit' : 'var(--pf-t--global--text--color--subtle)', fontStyle: answer ? 'normal' : 'italic' }}>
                    {answer || 'No answer provided'}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Code viewer */}
      {saves.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Save history */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--pf-t--global--text--color--subtle)', marginBottom: 8 }}>Save History</p>
            {saves.map((s, i) => (
              <div key={s.id} onClick={() => setSelectedSaveIdx(i)} style={{ padding: '10px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 6, border: `1px solid ${i === selectedSaveIdx ? 'var(--pf-t--global--color--brand--default)' : 'var(--pf-t--global--border--color--default)'}`, background: i === selectedSaveIdx ? 'rgba(0,102,204,.08)' : 'transparent' }}>
                <div style={{ fontWeight: s.is_final ? 700 : 400, fontSize: 13 }}>{s.is_final ? '✅ Final submission' : `Auto-save #${saves.length - i}`}</div>
                <div style={{ fontSize: 11, color: 'var(--pf-t--global--text--color--subtle)', fontFamily: 'monospace', marginTop: 2 }}>{new Date(s.saved_at).toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Monaco code viewer */}
          <div style={{ border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--pf-t--global--background--color--secondary--default)', borderBottom: '1px solid var(--pf-t--global--border--color--default)' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {save?.is_final ? '✅ Final · ' : ''}{save ? new Date(save.saved_at).toLocaleString() : ''}
              </span>
              <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(code)}>Copy</Button>
            </div>
            {codingChallenges.length > 1 && (
              <div style={{ borderBottom: '1px solid var(--pf-t--global--border--color--default)', padding: '0 16px' }}>
                <Tabs activeKey={activeCcTab} onSelect={(_, k) => setActiveCcTab(k)}>
                  {codingChallenges.map((cc, i) => (
                    <Tab key={cc.id} eventKey={i} title={<TabTitleText>{cc.title || `Challenge ${i + 1}`}</TabTitleText>} />
                  ))}
                </Tabs>
              </div>
            )}
            <div style={{ height: 480 }}>
              <MonacoEditor height="100%" language={currentCc?.language ?? 'javascript'} value={code}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, theme: 'vs-dark' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
