import { getChallenges, getLinks } from '@/lib/db';
import LinksClient from './LinksClient';

export const dynamic = 'force-dynamic';

export default async function LinksPage() {
  const [challenges, links] = await Promise.all([getChallenges(), getLinks()]);
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Interview Links</h1>
      <LinksClient challenges={challenges} initialLinks={links} />
    </div>
  );
}
