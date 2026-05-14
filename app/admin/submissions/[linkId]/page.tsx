import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSubmission } from '@/lib/db';
import SubmissionDetail from '@/components/admin/SubmissionDetail';

export const dynamic = 'force-dynamic';

export default async function SubmissionDetailPage({ params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params;
  const data = await getSubmission(Number(linkId));
  if (!data) notFound();
  // Pass serialisable props to a single client component that owns all PatternFly + Monaco
  return <SubmissionDetail data={data} />;
}
