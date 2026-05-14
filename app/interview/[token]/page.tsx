import { Metadata } from 'next';
import InterviewClient from '@/components/interview/InterviewClient';

export const metadata: Metadata = { title: 'Red Hat Interview' };

export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InterviewClient token={token} />;
}
