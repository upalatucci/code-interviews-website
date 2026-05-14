'use client';

import { useState, useTransition } from 'react';
import {
  Button, Card, CardHeader, CardBody, CardTitle, CardFooter,
  Label, Badge, EmptyState, EmptyStateBody,
  Alert, Spinner, Gallery, GalleryItem,
} from '@patternfly/react-core';
import InterviewModal from '@/components/admin/InterviewModal';
import { type Challenge } from '@/lib/db';
import { deleteInterview } from './actions';
import { useRouter } from 'next/navigation';

export default function InterviewsClient({ initialChallenges }: { initialChallenges: Challenge[] }) {
  const [challenges, setChallenges] = useState(initialChallenges);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Challenge | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();

  function openCreate() { setEditTarget(null); setModalOpen(true); }
  function openEdit(c: Challenge) { setEditTarget(c); setModalOpen(true); }

  function handleDelete(id: number) {
    if (!confirm('Delete this interview? All associated links and submissions will be deleted.')) return;
    startTransition(async () => {
      try {
        await deleteInterview(id);
        router.refresh();
      } catch { setError('Delete failed'); }
    });
  }

  function handleQuickLink(id: number) {
    router.push(`/admin/links?create=${id}`);
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button variant="primary" style={{ background: '#ee0000', borderColor: '#ee0000' }} onClick={openCreate}>
          + New Interview
        </Button>
      </div>

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}

      {challenges.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No interviews yet. Create your first one!</EmptyStateBody>
        </EmptyState>
      ) : (
        <Gallery hasGutter minWidths={{ default: '300px' }}>
          {challenges.map(c => (
            <GalleryItem key={c.id}>
              <Card isFullHeight>
                <CardHeader>
                  <CardTitle>{c.title}</CardTitle>
                </CardHeader>
                <CardBody>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Badge isRead>{c.coding_challenges?.length ?? 0} challenges</Badge>
                    <Badge isRead>{c.interview_questions?.length ?? 0} questions</Badge>
                    {c.time_limit_minutes && (
                      <Label color="orange" isCompact>⏱ {c.time_limit_minutes} min</Label>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--pf-t--global--text--color--subtle)' }}>
                    {c.coding_challenges?.map(cc => cc.language).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                  </p>
                </CardBody>
                <CardFooter>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                    <Button variant="primary" size="sm" style={{ background: '#ee0000', borderColor: '#ee0000' }} onClick={() => handleQuickLink(c.id)}>+ Link</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(c.id)} isDisabled={isPending}>Delete</Button>
                  </div>
                </CardFooter>
              </Card>
            </GalleryItem>
          ))}
        </Gallery>
      )}

      <InterviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editTarget={editTarget}
        onSaved={() => { setModalOpen(false); router.refresh(); }}
      />
    </>
  );
}
