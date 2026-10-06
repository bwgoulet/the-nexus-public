import { LiveMatchRoom } from './live-match-room';

export default async function LiveMatchPage({ params }: { params: Promise<{ match: string }> }) {
  const { match } = await params;
  return <LiveMatchRoom slug={match} />;
}
