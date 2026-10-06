import type { Metadata } from 'next';
import { StandingsLeaderboard } from '@/app/components/standings-leaderboard';
import { StandingsSeasonFilter } from '@/app/components/standings-season-filter';
import { getStandingsByTournamentSeason, getTournamentSeasons, tournamentSeasons } from '@/lib/data';

export const metadata: Metadata = {
  title: 'League Standings',
  description: 'Track collegiate crew battle standings, win-loss records, and division leaderboards in The Nexus.',
  openGraph: {
    title: 'League Standings | The Nexus',
    description: 'Track collegiate crew battle standings, win-loss records, and division leaderboards in The Nexus.',
    url: '/standings'
  },
  twitter: {
    title: 'League Standings | The Nexus',
    description: 'Track collegiate crew battle standings, win-loss records, and division leaderboards in The Nexus.'
  }
};

type StandingsPageProps = {
  searchParams: Promise<{ season?: string | string[] }>;
};

export default async function StandingsPage({ searchParams }: StandingsPageProps) {
  const [seasons, params] = await Promise.all([getTournamentSeasons(), searchParams]);
  const requestedSeasonId = typeof params.season === 'string' ? params.season : undefined;
  const defaultSeason =
    seasons.find((season) => /season[\s-]?1|fall[\s-]?2026/i.test(season.name)) ??
    seasons.find((season) => !/pre[\s-]?season/i.test(season.name)) ??
    seasons[0] ??
    tournamentSeasons[0];
  const selectedSeason = seasons.find((season) => season.id === requestedSeasonId) ?? defaultSeason;
  const standings = await getStandingsByTournamentSeason(selectedSeason.id);

  return (
    <section className="standings-page" aria-labelledby="standings-page-title">
      <div className="standings-page-intro">
        <div className="standings-page-header">
          <p className="standings-page-kicker">League Standings</p>
          <h1 id="standings-page-title">Current Standings</h1>
          <p className="muted">Track each school&apos;s crew battle record across completed Nexus matches.</p>
        </div>
        <StandingsSeasonFilter seasons={seasons} selectedSeasonId={selectedSeason.id} />
      </div>

      <StandingsLeaderboard standings={standings} />
    </section>
  );
}
