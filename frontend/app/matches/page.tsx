export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import MatchesView from './matches-view';
import {
  getAllCompletedMatchEntries,
  getTournamentSeasons,
  getUpcomingMatchEntries
} from '@/lib/data';

export const metadata: Metadata = {
  title: 'Matches & Crew Battles',
  description: 'Stream schedule, live matches, and completed crew battle match history in The Nexus.',
  openGraph: {
    title: 'Matches & Crew Battles | The Nexus',
    description: 'Stream schedule, live matches, and completed crew battle match history in The Nexus.',
    url: '/matches'
  },
  twitter: {
    title: 'Matches & Crew Battles | The Nexus',
    description: 'Stream schedule, live matches, and completed crew battle match history in The Nexus.'
  }
};

export default async function MatchesPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const initialPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const initialQuery = params.q || '';

  const [upcoming, completed, tournamentSeasons] = await Promise.all([
    getUpcomingMatchEntries(),
    getAllCompletedMatchEntries(),
    getTournamentSeasons()
  ]);

  return (
    <MatchesView
      upcoming={upcoming.slice(0, 4)}
      completed={completed}
      tournamentSeasons={tournamentSeasons}
      initialPage={initialPage}
      initialQuery={initialQuery}
    />
  );
}
