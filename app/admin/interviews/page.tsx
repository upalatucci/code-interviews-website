import { getChallenges } from '@/lib/db';
import InterviewsClient from './InterviewsClient';

export const dynamic = 'force-dynamic';

export default async function InterviewsPage() {
  const challenges = await getChallenges();
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Interviews</h1>
      <InterviewsClient initialChallenges={challenges} />
    </div>
  );
}
