import type { Metadata } from 'next';
import { getLeagueStats, getTournamentSeasons } from '@/lib/data';
import StatsTables from './stats-tables';
import StatsSeasonFilter from './stats-season-filter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'League Stats & Analytics',
  description:
    'Browse completed crew-battle results, player stats, character usage, and team analytics in The Nexus League.',
  openGraph: {
    title: 'League Stats & Analytics | The Nexus',
    description:
      'Browse completed crew-battle results, player stats, character usage, and team analytics in The Nexus League.',
    url: '/stats'
  },
  twitter: {
    title: 'League Stats & Analytics | The Nexus',
    description:
      'Browse completed crew-battle results, player stats, character usage, and team analytics in The Nexus League.'
  }
};

type StatsPageProps = { searchParams: Promise<{ season?: string | string[] }> };

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const [seasons, params] = await Promise.all([getTournamentSeasons(), searchParams]);
  const requestedSeasonId = typeof params.season === 'string' ? params.season : null;
  const selectedSeasonId = seasons.some((season) => season.id === requestedSeasonId) ? requestedSeasonId : null;
  const stats = await getLeagueStats(selectedSeasonId ?? undefined);

  return (
    <div className="stats-page" id="stats-top">
      <section className="stats-hero">
        <div className="stats-hero-copy">
          <h1>
            League
            <span>Stats</span>
          </h1>
          <StatsSeasonFilter seasons={seasons} selectedSeasonId={selectedSeasonId} />

          <div className="stats-summary-bar" aria-label="Stats coverage summary">
            <div className="stats-summary-item">
              <strong className="stats-summary-value">{stats.totals.matchesPlayed}</strong>
              <span className="stats-summary-label">Matches</span>
            </div>
            <span className="stats-summary-dot" aria-hidden="true">•</span>
            <div className="stats-summary-item">
              <strong className="stats-summary-value">{stats.totals.gamesPlayed}</strong>
              <span className="stats-summary-label">Games</span>
            </div>
            <span className="stats-summary-dot" aria-hidden="true">•</span>
            <div className="stats-summary-item">
              <strong className="stats-summary-value">{stats.totals.playersRanked}</strong>
              <span className="stats-summary-label">Players</span>
            </div>
            <span className="stats-summary-dot" aria-hidden="true">•</span>
            <div className="stats-summary-item">
              <strong className="stats-summary-value">{stats.totals.teamsRanked}</strong>
              <span className="stats-summary-label">Teams</span>
            </div>
          </div>
        </div>
      </section>

      <main className="stats-document">
        <StatsTables players={stats.players} teams={stats.teams} selectedSeasonId={selectedSeasonId} />
      </main>
    </div>
  );
}
