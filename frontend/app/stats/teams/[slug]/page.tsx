import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RiArrowLeftLongFill, RiExternalLinkLine } from '@remixicon/react';
import { getLeagueStats, getTournamentSeasons } from '@/lib/data';
import { TeamGraphicsRepo } from '@/app/components/team-graphics-repo';
import StatsSeasonFilter from '../../stats-season-filter';
import StatsSummaryGrid from '../../players/[slug]/stats-summary-grid';

const formatRecord = (wins: number, losses: number) => `${wins}-${losses}`;
const formatRatio = (ratio: number | null) => (ratio === null ? '—' : ratio.toFixed(2));
const decodeSlug = (slug: string) => decodeURIComponent(slug).toLowerCase();
const getPublicSiteUrl = (value: string | null) => {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const stats = await getLeagueStats();
  const normalizedSlug = decodeSlug(slug);
  const team = stats.teams.find(
    (entry) => entry.teamShortName.toLowerCase() === normalizedSlug || entry.teamId.toLowerCase() === normalizedSlug
  );

  if (!team) {
    return {
      title: 'Team Profile',
      description: 'Collegiate team profile and crew stats in The Nexus.'
    };
  }

  const teamName = team.teamName || team.teamShortName.toUpperCase();
  const record = `${team.matchWins}W - ${team.matchLosses}L`;
  const description = `${teamName} Crew Profile • Record: ${record} • ${team.totalStocksTaken} stocks taken.`;

  const ogImages = team.teamAvatar
    ? [{ url: team.teamAvatar, alt: `${teamName} logo` }]
    : undefined;

  return {
    title: `${teamName} — Team Profile`,
    description,
    openGraph: {
      title: `${teamName} — Team Profile | The Nexus`,
      description,
      url: `/stats/teams/${slug}`,
      images: ogImages
    },
    twitter: {
      title: `${teamName} — Team Profile | The Nexus`,
      description,
      images: ogImages ? [team.teamAvatar!] : undefined
    }
  };
}

export default async function TeamStatsProfilePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string | string[] }>;
}) {
  const [{ slug }, query, seasons] = await Promise.all([params, searchParams, getTournamentSeasons()]);
  const requestedSeasonId = typeof query.season === 'string' ? query.season : null;
  const selectedSeasonId = seasons.some((season) => season.id === requestedSeasonId) ? requestedSeasonId : null;
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);
  const stats = await getLeagueStats(selectedSeasonId ?? undefined);
  const normalizedSlug = decodeSlug(slug);
  const profilePath = `/stats/teams/${encodeURIComponent(slug)}`;
  const team = stats.teams.find(
    (entry) => entry.teamShortName.toLowerCase() === normalizedSlug || entry.teamId.toLowerCase() === normalizedSlug
  );

  if (!team) {
    notFound();
  }

  const schoolSiteUrl = getPublicSiteUrl(team.teamSchoolSiteUrl);

  const statCards = [
    { label: 'Rank', value: `#${team.rank}` },
    { label: 'Stocks taken', value: team.totalStocksTaken.toString(), highlight: true },
    { label: 'Matches', value: team.matchesPlayed.toString() },
    { label: 'Games', value: team.gamesPlayed.toString() },
    { label: 'W/L', value: formatRecord(team.matchWins, team.matchLosses) },
    { label: 'W/L ratio', value: formatRatio(team.matchWinLossRatio) },
    {
      label: 'Most common lead',
      value: team.mostCommonLead?.playerTag ?? '—',
      detail: team.mostCommonLead
        ? `Sent out first in ${team.mostCommonLead.appearances} game${team.mostCommonLead.appearances === 1 ? '' : 's'} (${team.mostCommonLead.percentage.toFixed(1)}%)`
        : 'No completed crew data yet'
    },
    {
      label: 'Most common anchor',
      value: team.mostCommonAnchor?.playerTag ?? '—',
      detail: team.mostCommonAnchor
        ? `Sent out last in ${team.mostCommonAnchor.appearances} game${team.mostCommonAnchor.appearances === 1 ? '' : 's'} (${team.mostCommonAnchor.percentage.toFixed(1)}%)`
        : 'No completed crew data yet'
    }
  ];

  return (
    <section className="stats-page stats-profile-page" aria-labelledby="stats-profile-title">
      <div className="stats-profile-toolbar">
        <Link
          className="stats-profile-back"
          href={selectedSeasonId ? `/stats?season=${encodeURIComponent(selectedSeasonId)}` : '/stats'}
        >
          <RiArrowLeftLongFill aria-hidden="true" size={18} /> Stats leaderboard
        </Link>
        <StatsSeasonFilter seasons={seasons} selectedSeasonId={selectedSeasonId} basePath={profilePath} compact />
      </div>

      <div className="stats-player-header-row">
        <p className="stats-page-kicker">
          Team profile <span aria-hidden="true">/</span> {selectedSeason?.name ?? 'All competitions'}
        </p>
      </div>

      <p className="stats-profile-intro">
        Crew performance, match results, and lineup tendencies across {selectedSeason?.name ?? 'every recorded Nexus competition'}.
      </p>

      <div className="stats-hero-panel stats-profile-hero stats-player-banner stats-team-banner">
        <div className="stats-player-banner-grid" aria-hidden="true" />
        <div className="stats-profile-identity stats-team-identity">
          <div className="stats-team-profile-headline">
            <div className="stats-team-headline-logo">
              {team.teamAvatar ? (
                <Image
                  src={team.teamAvatar}
                  alt={`${team.teamName} logo`}
                  width={140}
                  height={140}
                  unoptimized
                />
              ) : (
                <span className="stats-team-headline-fallback" aria-hidden="true">
                  {team.teamShortName.slice(0, 2)}
                </span>
              )}
            </div>
            <div className="stats-team-headline-text">
              <h1 id="stats-profile-title" className="stats-team-title">
                {team.teamShortName}
              </h1>
              <p className="stats-team-school-name">{team.teamName}</p>
              {schoolSiteUrl ? (
                <a
                  className="stats-team-school-link"
                  href={schoolSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official School Site <RiExternalLinkLine size={13} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="stats-secondaries-shelf stats-team-roster-shelf" aria-label="Active roster">
            <span className="stats-secondaries-label">Active roster</span>
            <div className="stats-secondaries-list">
              {team.activeRoster.length > 0 ? (
                team.activeRoster.map((rosterPlayer) => {
                  const playerStats = stats.players.find(
                    (player) =>
                      player.teamId === team.teamId &&
                      player.playerTag.toLowerCase() === rosterPlayer.playerTag.toLowerCase()
                  );
                  const playerHref = playerStats
                    ? selectedSeasonId
                      ? `/stats/players/${encodeURIComponent(playerStats.playerTag.toLowerCase())}?season=${encodeURIComponent(selectedSeasonId)}`
                      : `/stats/players/${encodeURIComponent(playerStats.playerTag.toLowerCase())}`
                    : null;
                  const mainIcon = playerStats?.mostPlayedCharacterIcon ?? playerStats?.characterUsage[0]?.icon ?? null;
                  const content = (
                    <>
                      {mainIcon ? (
                        <div className="stats-secondary-avatar">
                          <Image src={mainIcon} alt="" width={24} height={24} />
                        </div>
                      ) : null}
                      <div className="stats-secondary-meta">
                        <strong>{rosterPlayer.playerTag}</strong>
                        {rosterPlayer.isCaptain ? <span className="stats-roster-captain">Captain</span> : null}
                      </div>
                    </>
                  );

                  return playerHref ? (
                    <Link
                      className="stats-secondary-chip stats-roster-player-chip"
                      href={playerHref}
                      key={rosterPlayer.playerTag}
                      title={`View ${rosterPlayer.playerTag} stats`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span className="stats-secondary-chip" key={rosterPlayer.playerTag}>
                      {content}
                    </span>
                  );
                })
              ) : (
                <span className="stats-roster-empty">No active players</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <StatsSummaryGrid cards={statCards} playerTag={team.teamName} />

      <TeamGraphicsRepo graphics={team.teamGraphics} teamName={team.teamName} className="stats-team-graphics-repo" />
    </section>
  );
}
