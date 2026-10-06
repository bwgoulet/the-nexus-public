import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RiShieldCheckFill, RiArrowDropDownLine, RiArrowRightLongLine, RiArrowLeftLongFill } from '@remixicon/react';
import { getLeagueStats, getTournamentSeasons } from '@/lib/data';
import { getCharacterRenderPath } from '@/lib/characters';
import { resolveRoundStageBackground, resolveRoundStageIcon } from '@/lib/stages';
import StatsSeasonFilter from '../../stats-season-filter';
import StatsSummaryGrid from './stats-summary-grid';

const formatRecord = (wins: number, losses: number) => `${wins}-${losses}`;
const formatRatio = (ratio: number | null) => (ratio === null ? '—' : ratio.toFixed(2));
const decodeSlug = (slug: string) => decodeURIComponent(slug).toLowerCase();

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const stats = await getLeagueStats();
  const normalizedSlug = decodeSlug(slug);
  const player = stats.players.find((entry) => entry.playerTag.toLowerCase() === normalizedSlug);

  if (!player) {
    return {
      title: 'Player Profile',
      description: 'Player profile and crew battle statistics in The Nexus.'
    };
  }

  const teamName = player.teamName || player.teamShortName || 'Independent';
  const mainChar = player.characterUsage[0]?.character;
  const mainText = mainChar ? ` • Main: ${mainChar}` : '';
  const description = `${player.playerTag} (${teamName}) • Stocks Taken: ${player.stocksTaken}${mainText}`;

  const avatarUrl = player.teamAvatar || player.mostPlayedCharacterIcon;
  const ogImages = avatarUrl
    ? [{ url: avatarUrl, alt: `${player.playerTag}` }]
    : undefined;

  return {
    title: `${player.playerTag} (${teamName}) — Player Stats`,
    description,
    openGraph: {
      title: `${player.playerTag} (${teamName}) — Player Stats | The Nexus`,
      description,
      url: `/stats/players/${slug}`,
      images: ogImages
    },
    twitter: {
      title: `${player.playerTag} (${teamName}) — Player Stats | The Nexus`,
      description,
      images: ogImages ? [avatarUrl!] : undefined
    }
  };
}

export default async function PlayerStatsProfilePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ season?: string | string[] }> }) {
  const [{ slug }, query, seasons] = await Promise.all([params, searchParams, getTournamentSeasons()]);
  const requestedSeasonId = typeof query.season === 'string' ? query.season : null;
  const selectedSeasonId = seasons.some((season) => season.id === requestedSeasonId) ? requestedSeasonId : null;
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);
  const stats = await getLeagueStats(selectedSeasonId ?? undefined);
  const normalizedSlug = decodeSlug(slug);
  const profilePath = `/stats/players/${encodeURIComponent(slug)}`;
  const player = stats.players.find((entry) => entry.playerTag.toLowerCase() === normalizedSlug);

  if (!player) {
    notFound();
  }

  const tagLength = player.playerTag.length;
  const tagLengthClass = tagLength >= 16 ? 'is-extra-long-tag' : tagLength >= 11 ? 'is-long-tag' : '';

  const mainCharacter = player.characterUsage[0] ?? null;
  const otherCharacters = player.characterUsage.slice(1);
  const mainRenderPath = mainCharacter ? getCharacterRenderPath(mainCharacter.character) : null;

  const teamHref = player.teamShortName
    ? selectedSeasonId
      ? `/stats/teams/${encodeURIComponent(player.teamShortName.toLowerCase())}?season=${encodeURIComponent(selectedSeasonId)}`
      : `/stats/teams/${encodeURIComponent(player.teamShortName.toLowerCase())}`
    : null;

  const statCards = [
    { label: 'Rank', value: `#${player.rank}` },
    { label: 'Stocks taken', value: player.stocksTaken.toString() },
    { label: 'Matches', value: player.matchesPlayed.toString() },
    { label: 'Games', value: player.gamesPlayed.toString() },
    { label: 'Attendance', value: `${player.attendancePercentage.toFixed(1)}%` },
    { label: 'W/L', value: formatRecord(player.matchWins, player.matchLosses) },
    { label: 'W/L ratio', value: formatRatio(player.matchWinLossRatio) }
  ];

  return (
    <section className="stats-page stats-profile-page" aria-labelledby="stats-profile-title">
      <div className="stats-profile-toolbar">
        <Link className="stats-profile-back" href={selectedSeasonId ? `/stats?season=${encodeURIComponent(selectedSeasonId)}` : '/stats'}>
          <RiArrowLeftLongFill aria-hidden="true" size={18} /> Stats leaderboard
        </Link>
        <StatsSeasonFilter seasons={seasons} selectedSeasonId={selectedSeasonId} basePath={profilePath} compact />
      </div>

      <div className="stats-player-header-row">
        <p className="stats-page-kicker">Player profile <span aria-hidden="true">/</span> {selectedSeason?.name ?? 'All competitions'}</p>
        {player.isCaptain ? (
          <span className="stats-profile-captain-badge">
            <RiShieldCheckFill aria-hidden="true" size={15} />
            Roster Captain
          </span>
        ) : null}
      </div>

      <p className="stats-profile-intro">
        Player performance, attendance, and match tendencies across {selectedSeason?.name ?? 'every recorded Nexus competition'}.
      </p>

      <div className="stats-hero-panel stats-profile-hero stats-player-banner">
        <div className="stats-player-banner-grid" aria-hidden="true" />
        <div className="stats-profile-identity">
          {teamHref ? (
            <Link className="stats-profile-teamline" href={teamHref} title={`View ${player.teamName ?? player.teamShortName} stats`}>
              {player.teamAvatar ? <Image src={player.teamAvatar} alt="" width={44} height={44} unoptimized /> : <span aria-hidden="true">{(player.teamShortName ?? 'FA').slice(0, 2)}</span>}
              <span>
                <strong>{player.teamShortName ?? 'Free Agent'}</strong>
                <small>{player.teamName ?? 'No school linked'}</small>
              </span>
            </Link>
          ) : (
            <div className="stats-profile-teamline">
              {player.teamAvatar ? <Image src={player.teamAvatar} alt="" width={44} height={44} unoptimized /> : <span aria-hidden="true">{(player.teamShortName ?? 'FA').slice(0, 2)}</span>}
              <span>
                <strong>{player.teamShortName ?? 'Free Agent'}</strong>
                <small>{player.teamName ?? 'No school linked'}</small>
              </span>
            </div>
          )}
          <h1 id="stats-profile-title" className={`stats-profile-title ${tagLengthClass}`.trim()}>{player.playerTag}</h1>
          {player.playerRealName ? (
            <p className="stats-player-real-name">{player.playerRealName}</p>
          ) : null}

          {otherCharacters.length > 0 ? (
            <div className="stats-secondaries-shelf" aria-label="Secondary character choices">
              <span className="stats-secondaries-label">Secondaries & Counterpicks</span>
              <div className="stats-secondaries-list">
                {otherCharacters.map((character) => (
                  <article className="stats-secondary-chip" key={`${character.character}-${character.icon}`}>
                    <div className="stats-secondary-avatar">
                      <Image src={character.icon} alt="" width={32} height={32} />
                    </div>
                    <div className="stats-secondary-meta">
                      <strong>{character.character}</strong>
                      <span>{character.percentage.toFixed(1)}%</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="stats-player-showcase">
          {mainCharacter && mainRenderPath ? (
            <div className="stats-main-render-wrap">
              <div className="stats-main-render-stage">
                <Image
                  src={mainRenderPath}
                  alt={`${mainCharacter.character} full render`}
                  width={550}
                  height={550}
                  className="stats-main-render-img"
                  priority
                />
              </div>
              <div className="stats-main-character-badge">
                <div className="stats-main-badge-text">
                  <small>Most played</small>
                  <strong>{mainCharacter.character}</strong>
                </div>
                <span className="stats-main-badge-pct">{mainCharacter.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ) : (
            <div className="stats-player-no-char">
              <div className="stats-profile-placeholder">?</div>
              <strong>No characters logged</strong>
            </div>
          )}
        </div>
      </div>

      <StatsSummaryGrid cards={statCards} playerTag={player.playerTag} />

      <section className="stats-stage-preferences" aria-labelledby="stage-preferences-title">
        <div className="stats-stage-preferences-heading">
          <div>
            <p className="stats-page-kicker">Counterpick tendencies</p>
            <h2 id="stage-preferences-title">Stage preferences</h2>
          </div>
          <p>Stages selected by {player.playerTag} when entering after their team lost the previous round.</p>
        </div>

        {player.stagePreferences.length ? (
          <div className="stats-stage-preference-list">
            {player.stagePreferences.map((preference) => {
              const stageBackground = resolveRoundStageBackground(preference.stage);
              const stageIcon = resolveRoundStageIcon(preference.stage);

              return (
                <details className="stats-stage-preference" key={preference.stage}>
                  <summary>
                    {stageBackground ? (
                      <div className="stats-stage-preference-bg" aria-hidden="true">
                        <Image
                          src={stageBackground}
                          alt=""
                          width={480}
                          height={180}
                          unoptimized
                        />
                      </div>
                    ) : null}
                    {stageIcon ? (
                      <div className="stats-stage-preference-icon" aria-hidden="true">
                        <Image
                          src={stageIcon}
                          alt=""
                          width={64}
                          height={48}
                          unoptimized
                        />
                      </div>
                    ) : null}
                    <div className="stats-stage-preference-label">
                      <strong>{preference.stage}</strong>
                      <span>{preference.picks} {preference.picks === 1 ? 'pick' : 'picks'} · View details</span>
                    </div>
                    <div className="stats-stage-preference-meter" aria-hidden="true">
                      <span style={{ width: `${preference.percentage}%` }} />
                    </div>
                    <strong className="stats-stage-preference-percent">{preference.percentage.toFixed(1)}%</strong>
                    <RiArrowDropDownLine className="stats-stage-preference-toggle" aria-hidden="true" size={24} />
                  </summary>
                <div className="stats-stage-selection-list">
                  {preference.selections.map((selection, index) => (
                    <Link className="stats-stage-selection" href={selection.gameHref} key={`${selection.gameId}-${index}`}>
                      <Image src={selection.opponentCharacterIcon} alt="" width={48} height={48} />
                      <span>
                        <small>Selected against</small>
                        <strong>{selection.opponentTag}</strong>
                        <span>{selection.opponentCharacter}</span>
                      </span>
                      <span className="stats-stage-selection-game">
                        <small>View game</small>
                        <strong>{selection.gameLabel}</strong>
                      </span>
                      <RiArrowRightLongLine className="stats-stage-selection-arrow" aria-hidden="true" size={20} />
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        ) : (
          <p className="stats-stage-preferences-empty">No counterpick stage choices have been recorded for this player yet.</p>
        )}
      </section>
    </section>
  );
}
