'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardBody, CardTitle, Label, Button, Tabs, Tab, TabTitleText } from '@patternfly/react-core';
import { type Save, type CodingChallenge } from '@/lib/db';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function SubmissionViewer({ saves, codingChallenges }: { saves: Save[]; codingChallenges: CodingChallenge[] }) {
  const [selectedSaveIdx, setSelectedSaveIdx] = useState(0);
  const [activeCcTab, setActiveCcTab] = useState<string | number>(0);

  const save = saves[selectedSaveIdx];
  if (!save) return null;

  let codesMap: Record<number, string> = {};
  try { codesMap = JSON.parse(save.codes || '{}') as Record<number, string>; } catch { /* noop */ }

  const currentCc = codingChallenges[Number(activeCcTab)];
  const code = currentCc ? (codesMap[currentCc.id] ?? '') : '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Save history */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--pf-t--global--text--color--subtle)', marginBottom: 8 }}>Save History</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {saves.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setSelectedSaveIdx(i)}
              style={{
                padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${i === selectedSaveIdx ? 'var(--pf-t--global--color--brand--default)' : 'var(--pf-t--global--border--color--default)'}`,
                background: i === selectedSaveIdx ? 'var(--pf-t--global--background--color--brand--default, rgba(0,102,204,.08))' : 'transparent',
              }}
            >
              <div style={{ fontWeight: s.is_final ? 700 : 400, fontSize: 13 }}>
                {s.is_final ? '✅ Final submission' : `Auto-save #${saves.length - i}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--pf-t--global--text--color--subtle)', fontFamily: 'monospace', marginTop: 2 }}>
                {new Date(s.saved_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code viewer */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <CardTitle>
              {save.is_final ? '✅ Final · ' : ''}{new Date(save.saved_at).toLocaleString()}
            </CardTitle>
            <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(code)}>Copy</Button>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
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
            <MonacoEditor
              height="100%"
              language={currentCc?.language ?? 'javascript'}
              value={code}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                theme: 'vs-dark',
              }}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
