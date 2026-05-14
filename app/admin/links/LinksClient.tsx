'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Button, Label, Alert, EmptyState, EmptyStateBody,
  Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, TextInput, Select, SelectOption,
} from '@patternfly/react-core';
import { type Challenge, type InterviewLink } from '@/lib/db';
import { generateLink, deleteLink } from './actions';
import { useRouter, useSearchParams } from 'next/navigation';

type Link = InterviewLink & { challenge_title: string };

export default function LinksClient({ challenges, initialLinks }: { challenges: Challenge[]; initialLinks: Link[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<string>('');
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-open modal if ?create=<id> is in URL
  useEffect(() => {
    const create = searchParams.get('create');
    if (create) {
      setSelectedChallenge(create);
      setModalOpen(true);
    }
  }, [searchParams]);

  function openModal() {
    setSelectedChallenge(challenges[0]?.id ? String(challenges[0].id) : '');
    setCandidateName(''); setCandidateEmail(''); setGeneratedUrl(''); setError('');
    setModalOpen(true);
  }

  async function handleGenerate() {
    if (!selectedChallenge) { setError('Select an interview'); return; }
    setSaving(true); setError('');
    try {
      const { token } = await generateLink(Number(selectedChallenge), candidateName.trim(), candidateEmail.trim());
      const url = `${window.location.origin}/interview/${token}`;
      setGeneratedUrl(url);
      router.refresh();
    } catch { setError('Failed to generate link'); }
    finally { setSaving(false); }
  }

  function handleDelete(id: number) {
    if (!confirm('Delete this link?')) return;
    startTransition(async () => { await deleteLink(id); router.refresh(); });
  }

  function statusLabel(link: Link) {
    if (link.submitted_at) return <Label color="green" isCompact>Submitted</Label>;
    if (link.first_opened_at) return <Label color="orange" isCompact>In progress</Label>;
    return <Label color="grey" isCompact>Pending</Label>;
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button variant="primary" style={{ background: '#ee0000', borderColor: '#ee0000' }} onClick={openModal}>+ Generate Link</Button>
      </div>

      {links.length === 0 ? (
        <EmptyState><EmptyStateBody>No links yet. Generate one from an interview.</EmptyStateBody></EmptyState>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead style={{ background: 'var(--pf-t--global--background--color--secondary--default)' }}>
              <tr>
                {['Candidate','Interview','Status','Created','Link',''].map(h => (
                  <th key={h} style={{ textAlign:'left',padding:'10px 14px',fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.4px',color:'var(--pf-t--global--text--color--subtle)',borderBottom:'1px solid var(--pf-t--global--border--color--default)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--pf-t--global--border--color--default)' }}>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontWeight: 500 }}>{l.candidate_name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--pf-t--global--text--color--subtle)' }}>{l.candidate_email}</div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>{l.challenge_title}</td>
                  <td style={{ padding:'12px 14px' }}>{statusLabel(l)}</td>
                  <td style={{ padding:'12px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {`${typeof window !== 'undefined' ? window.location.origin : ''}/interview/${l.token}`}
                      </span>
                      <Button variant="plain" size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/interview/${l.token}`)}>Copy</Button>
                    </div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(l.submitted_at || l.first_opened_at) && (
                        <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/submissions/${l.id}`)}>View</Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => { setSelectedChallenge(String(l.challenge_id)); setCandidateName(''); setCandidateEmail(''); setGeneratedUrl(''); setError(''); setModalOpen(true); }}>Clone</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(l.id)} isDisabled={isPending}>×</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} variant="medium" aria-labelledby="link-modal-title">
        <ModalHeader title="Generate Interview Link" labelId="link-modal-title" />
        <ModalBody>
          {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 12 }} />}
          <Form>
            <FormGroup label="Interview" fieldId="l-interview" isRequired>
              <Select
                selected={selectedChallenge}
                onSelect={(_, v) => setSelectedChallenge(String(v))}
                toggle={(ref) => (
                  <button ref={ref as React.Ref<HTMLButtonElement>} style={{ width: '100%', padding: '6px 12px', border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 4, background: 'var(--pf-t--global--background--color--primary--default)', cursor: 'pointer', textAlign: 'left' }}>
                    {challenges.find(c => String(c.id) === selectedChallenge)?.title ?? 'Select interview'}
                  </button>
                )}
              >
                {challenges.map(c => <SelectOption key={c.id} value={String(c.id)}>{c.title}</SelectOption>)}
              </Select>
            </FormGroup>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormGroup label="Candidate name" fieldId="l-name">
                <TextInput id="l-name" value={candidateName} onChange={(_, v) => setCandidateName(v)} placeholder="Jane Doe" />
              </FormGroup>
              <FormGroup label="Email (optional)" fieldId="l-email">
                <TextInput id="l-email" type="email" value={candidateEmail} onChange={(_, v) => setCandidateEmail(v)} placeholder="jane@example.com" />
              </FormGroup>
            </div>
            {generatedUrl && (
              <Alert variant="success" title="Link generated!" isInline>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <code style={{ flex: 1, fontSize: 12, wordBreak: 'break-all' }}>{generatedUrl}</code>
                  <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(generatedUrl)}>Copy</Button>
                </div>
              </Alert>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleGenerate} isDisabled={saving} isLoading={saving} style={{ background: '#ee0000', borderColor: '#ee0000' }}>
            {saving ? 'Generating…' : 'Generate Link'}
          </Button>
          <Button variant="link" onClick={() => setModalOpen(false)}>Close</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
