'use client';

import { useState, useEffect } from 'react';
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, TextInput, TextArea, ActionGroup,
  Button, Tabs, Tab, TabTitleText, Select, SelectOption,
  Alert, Spinner, Divider, Title,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { type Challenge, type CodingChallenge, type InterviewQuestion } from '@/lib/db';
import { createInterview, updateInterview } from '@/app/admin/interviews/actions';

const LANGS = ['javascript','typescript','python','java','cpp','go','rust'];

interface CCDraft { id?: number; title: string; description: string; starter_code: string; language: string }
interface QDraft  { id?: number; text: string }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editTarget: Challenge | null;
  onSaved: () => void;
}

export default function InterviewModal({ isOpen, onClose, editTarget, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [ccs, setCcs] = useState<CCDraft[]>([]);
  const [qs, setQs] = useState<QDraft[]>([]);
  const [activeTab, setActiveTab] = useState<string | number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [descPreviews, setDescPreviews] = useState<Record<number, string>>({});
  const [previewMode, setPreviewMode] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setTitle(editTarget?.title ?? '');
      setTimeLimit(editTarget?.time_limit_minutes ? String(editTarget.time_limit_minutes) : '');
      setCcs(editTarget?.coding_challenges?.map(cc => ({ id: cc.id, title: cc.title, description: cc.description, starter_code: cc.starter_code, language: cc.language })) ?? []);
      setQs(editTarget?.interview_questions?.map(q => ({ id: q.id, text: q.text })) ?? []);
      setActiveTab(0);
      setError('');
      setDescPreviews({});
      setPreviewMode({});
    }
  }, [isOpen, editTarget]);

  async function togglePreview(index: number) {
    if (previewMode[index]) {
      setPreviewMode(p => ({ ...p, [index]: false }));
    } else {
      const { marked } = await import('marked');
      const html = await Promise.resolve(marked.parse(ccs[index].description || '*Nothing yet.*'));
      setDescPreviews(p => ({ ...p, [index]: html }));
      setPreviewMode(p => ({ ...p, [index]: true }));
    }
  }

  async function handleSave() {
    if (!title.trim()) { setError('Interview title is required'); return; }
    setSaving(true); setError('');
    try {
      const tl = timeLimit ? parseInt(timeLimit, 10) || null : null;
      const ccPayload = ccs.map((cc, i) => ({ ...cc, position: i }));
      const qPayload  = qs.map((q, i) => ({ ...q, text: q.text, position: i }));

      if (editTarget) {
        await updateInterview(editTarget.id, title.trim(), tl, ccPayload, qPayload);
      } else {
        const newId = await createInterview(title.trim(), tl);
        await updateInterview(newId, title.trim(), tl, ccPayload, qPayload);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateCc(i: number, patch: Partial<CCDraft>) {
    setCcs(prev => prev.map((cc, idx) => idx === i ? { ...cc, ...patch } : cc));
    if (patch.description !== undefined) setPreviewMode(p => ({ ...p, [i]: false }));
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="large" aria-labelledby="interview-modal-title">
      <ModalHeader title={editTarget ? 'Edit Interview' : 'New Interview'} labelId="interview-modal-title" />
      <ModalBody>
        {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}

        {/* ── Basic info ── */}
        <Form style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormGroup label="Interview title" fieldId="c-title" isRequired>
              <TextInput id="c-title" value={title} onChange={(_, v) => setTitle(v)} placeholder="e.g. Senior Backend Engineer" />
            </FormGroup>
            <FormGroup label="Time limit (minutes, optional)" fieldId="c-time">
              <TextInput id="c-time" type="number" value={timeLimit} onChange={(_, v) => setTimeLimit(v)} placeholder="Leave blank for no limit" />
            </FormGroup>
          </div>
        </Form>

        <Divider />

        {/* ── Tabs: coding challenges + questions ── */}
        <Tabs activeKey={activeTab} onSelect={(_, k) => setActiveTab(k)} style={{ marginTop: 16 }}>
          <Tab eventKey={0} title={<TabTitleText>Coding Challenges ({ccs.length})</TabTitleText>}>
            <div style={{ paddingTop: 16 }}>
              {ccs.map((cc, i) => (
                <div key={i} style={{ border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
                  {/* Challenge header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--pf-t--global--background--color--secondary--default)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--pf-t--global--text--color--subtle)' }}>
                      Challenge {i + 1}
                    </span>
                    <TextInput value={cc.title} onChange={(_, v) => updateCc(i, { title: v })} placeholder="Challenge title" style={{ flex: 1, minWidth: 120 }} aria-label="Challenge title" />
                    <Select
                      selected={cc.language}
                      onSelect={(_, v) => updateCc(i, { language: String(v) })}
                      toggle={(toggleRef) => (
                        <button ref={toggleRef as React.Ref<HTMLButtonElement>} style={{ minWidth: 120, padding: '6px 10px', border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 4, background: 'var(--pf-t--global--background--color--primary--default)', cursor: 'pointer' }}>
                          {cc.language}
                        </button>
                      )}
                    >
                      {LANGS.map(l => <SelectOption key={l} value={l}>{l}</SelectOption>)}
                    </Select>
                    <Button variant="plain" aria-label="Remove challenge" onClick={() => setCcs(prev => prev.filter((_, idx) => idx !== i))}>
                      <TrashIcon />
                    </Button>
                  </div>
                  {/* Challenge body */}
                  <div style={{ padding: 12 }}>
                    <FormGroup label={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Description <span style={{ color: '#06c', fontSize: 11, fontWeight: 600 }}>Markdown</span></span>
                        <Button variant="plain" size="sm" onClick={() => togglePreview(i)}>
                          {previewMode[i] ? 'Write' : 'Preview'}
                        </Button>
                      </div>
                    } fieldId={`cc-desc-${i}`}>
                      {previewMode[i] ? (
                        <div
                          style={{ minHeight: 120, border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 4, padding: '10px 12px', background: 'var(--pf-t--global--background--color--secondary--default)', fontSize: 14, lineHeight: 1.7 }}
                          dangerouslySetInnerHTML={{ __html: descPreviews[i] ?? '' }}
                        />
                      ) : (
                        <TextArea id={`cc-desc-${i}`} value={cc.description} onChange={(_, v) => updateCc(i, { description: v })} rows={5} placeholder="Describe the problem using **Markdown**." aria-label="Description" />
                      )}
                    </FormGroup>
                    <FormGroup label="Starter code (optional)" fieldId={`cc-starter-${i}`} style={{ marginTop: 12 }}>
                      <TextArea id={`cc-starter-${i}`} value={cc.starter_code} onChange={(_, v) => updateCc(i, { starter_code: v })} rows={4} placeholder="// starter code…" aria-label="Starter code" style={{ fontFamily: 'var(--pf-t--global--font--family--mono)' }} />
                    </FormGroup>
                  </div>
                </div>
              ))}
              <Button variant="secondary" icon={<PlusCircleIcon />} onClick={() => setCcs(prev => [...prev, { title: '', description: '', starter_code: '', language: 'javascript' }])}>
                Add Coding Challenge
              </Button>
            </div>
          </Tab>

          <Tab eventKey={1} title={<TabTitleText>Questions ({qs.length})</TabTitleText>}>
            <div style={{ paddingTop: 16 }}>
              {qs.map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <TextArea value={q.text} onChange={(_, v) => setQs(prev => prev.map((x, idx) => idx === i ? { ...x, text: v } : x))} rows={2} placeholder="e.g. What is the time complexity of your solution?" aria-label={`Question ${i + 1}`} style={{ flex: 1 }} />
                  <Button variant="plain" aria-label="Remove question" onClick={() => setQs(prev => prev.filter((_, idx) => idx !== i))}>
                    <TrashIcon />
                  </Button>
                </div>
              ))}
              <Button variant="secondary" icon={<PlusCircleIcon />} onClick={() => setQs(prev => [...prev, { text: '' }])}>
                Add Question
              </Button>
            </div>
          </Tab>
        </Tabs>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={handleSave} isDisabled={saving} isLoading={saving} style={{ background: '#ee0000', borderColor: '#ee0000' }}>
          {saving ? 'Saving…' : 'Save Interview'}
        </Button>
        <Button variant="link" onClick={onClose} isDisabled={saving}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
}
