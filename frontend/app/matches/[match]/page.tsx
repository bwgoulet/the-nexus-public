export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { formatMatchDate, getMatchDetailEntry } from '@/lib/data';
import { calculateCrewBattleStockProgress } from '@/lib/crew-battle';
import { resolveCharacterImagePath } from '@/lib/characters';
import { resolveRoundStageBackground, resolveRoundStageIcon } from '@/lib/stages';
import { formatMatchScoreValue } from '@/lib/scores';
import { RiYoutubeFill, RiTimeFill } from '@remixicon/react';
import { MatchDetailSpotlight } from '@/app/components/match-detail-spotlight';

export async function generateMetadata({
  params
}: {
  params: Promise<{ match: string }>;
}): Promise<Metadata> {
  const { match: matchSlug } = await params;
  const matchEntry = await getMatchDetailEntry(matchSlug);

  if (!matchEntry) {
    return {
      title: 'Match Details',
      description: 'Crew battle match details on The Nexus.'
    };
  }

  const { match, homeTeam, awayTeam, scoreline } = matchEntry;
  const homeName = homeTeam?.name || homeTeam?.short_name || 'Home';
  const awayName = awayTeam?.name || awayTeam?.short_name || 'Away';
  const formattedDate = formatMatchDate(match.date);
  const statusUpper = match.status.toUpperCase();

  let description = `${homeName} vs ${awayName} • ${formattedDate} • Status: ${statusUpper}`;
  if (match.status === 'completed' && scoreline && scoreline.home !== null && scoreline.away !== null) {
    description = `${homeName} (${scoreline.home}) vs ${awayName} (${scoreline.away}) • Final Result • ${formattedDate}`;
  } else if (match.status === 'live') {
    description = `🔴 LIVE NOW: ${homeName} vs ${awayName} Crew Battle on The Nexus!`;
  }

  // Use match graphic if available, or fallback to default og-image
  const matchGraphic = match.graphic;
  const ogImages = matchGraphic
    ? [{ url: matchGraphic, alt: `${homeName} vs ${awayName}` }]
    : undefined;

  return {
    title: `${homeName} vs ${awayName} — Match Details`,
    description,
    openGraph: {
      title: `${homeName} vs ${awayName} — Match Details | The Nexus`,
      description,
      url: `/matches/${matchSlug}`,
      images: ogImages
    },
    twitter: {
      title: `${homeName} vs ${awayName} — Match Details | The Nexus`,
      description,
      images: ogImages ? [matchGraphic!] : undefined
    }
  };
}

const renderTeamNameWithAvatar = (
  teamName: string,
  avatar: string | null | undefined,
  side: 'home' | 'away',
  context: 'default' | 'detail' = 'default',
  teamSlugOrCode?: string | null
) => {
  const targetCode = (teamSlugOrCode || teamName).trim().toLowerCase();
  const href = targetCode && targetCode !== 'home' && targetCode !== 'away'
    ? `/stats/teams/${encodeURIComponent(targetCode)}`
    : null;

  const content = (
    <>
      {side === 'home' && avatar ? (
        <img className="team-avatar" src={avatar} alt={`${teamName} logo`} />
      ) : null}
      <span className="match-team-name-text">{teamName}</span>
      {side === 'away' && avatar ? (
        <img className="team-avatar" src={avatar} alt={`${teamName} logo`} />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`match-team-name match-team-name-${side} ${context === 'detail' ? 'match-team-name-detail' : ''}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className={`match-team-name match-team-name-${side} ${context === 'detail' ? 'match-team-name-detail' : ''}`}>
      {content}
    </span>
  );
};

const renderStockIcons = (characterImage: string, characterName: string, stocksRemaining: number, stockSlots: number) =>
  Array.from({ length: stockSlots }, (_, index) => {
    const isActive = index < stocksRemaining;

    return (
      <img
        className={`stock-icon ${isActive ? 'is-active' : 'is-empty'}`}
        src={characterImage}
        alt={characterName}
        width={20}
        height={20}
        key={`${characterName}-${index}`}
      />
    );
  });


export default async function MatchDetailPage({ params }: { params: Promise<{ match: string }> }) {
  const { match: matchSlug } = await params;
  const matchEntry = await getMatchDetailEntry(matchSlug);

  if (!matchEntry) {
    return (
      <section className="card">
        <h1>Match not found</h1>
        <Link href="/matches">Back to all matches</Link>
      </section>
    );
  }

  const { match, homeTeam, awayTeam, games, scoreline } = matchEntry;
  const homeTeamName = homeTeam?.short_name ?? homeTeam?.name ?? 'Home';
  const awayTeamName = awayTeam?.short_name ?? awayTeam?.name ?? 'Away';

  return (
    <section className="card">
      <MatchDetailSpotlight homeAvatar={homeTeam?.avatar} awayAvatar={awayTeam?.avatar}>
        <p className="match-detail-date">
          <span className={`badge match-status-badge match-status-${match.status}`}>{match.status}</span>
          {formatMatchDate(match.date)}
        </p>
        <p className="match-detail-scoreline">
          {renderTeamNameWithAvatar(homeTeamName, homeTeam?.avatar, 'home', 'detail', homeTeam?.short_name ?? homeTeam?.name)}
          <span className="match-detail-score-group" aria-label="Match scoreline">
            <span className="match-detail-score score-home match-detail-score-home-glow">{match.status === 'completed' ? formatMatchScoreValue(scoreline.home) : '-'}</span>
            <span className="match-detail-score-separator score-divider">-</span>
            <span className="match-detail-score score-away match-detail-score-away-glow">{match.status === 'completed' ? formatMatchScoreValue(scoreline.away) : '-'}</span>
          </span>
          {renderTeamNameWithAvatar(awayTeamName, awayTeam?.avatar, 'away', 'detail', awayTeam?.short_name ?? awayTeam?.name)}
        </p>
      </MatchDetailSpotlight>
      {match.status === 'upcoming' ? (
        <div className="match-detail-upcoming">
          <div className="upcoming-match-placeholder">
            <RiTimeFill size={22} aria-hidden="true" />
            <p>Match progression will appear once the set begins.</p>
          </div>
          {match.stream_url?.trim() ? (
            <div className="upcoming-match-stream">
              <a
                href={match.stream_url.trim()}
                target="_blank"
                rel="noreferrer"
                className="btn upcoming-stream-btn match-history-cta"
              >
                <RiYoutubeFill size={18} aria-hidden="true" />
                <span>Watch on YouTube</span>
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
      {match.status === 'live' ? (
        <p className="muted">
          This match is live. Crew rounds and stock progression will update as match operations report results.
        </p>
      ) : null}
      {games.length > 0 ? (
        <div className="space-y-5">
          {games.map(({ game, rounds }, gameIndex) => {
            const stockProgress = calculateCrewBattleStockProgress(game, rounds);
            const finalStockScore = stockProgress.at(-1);

            return (
              <div id={`game-${game.game_slug || game.id}`} className="match-detail-game" key={game.id}>
                {stockProgress.length > 0 ? (
                  <p className="game-header-scoreline">
                    <span className="game-header-label">Game {gameIndex + 1}</span>
                    <span className="game-header-divider">•</span>
                    <span className="game-header-score">
                      <span className="score-home">{finalStockScore?.home_team_stocks_remaining ?? 0}</span>
                      <span className="score-divider">-</span>
                      <span className="score-away">{finalStockScore?.away_team_stocks_remaining ?? 0}</span>
                    </span>
                  </p>
                ) : null}
                {rounds.length > 0 ? (
                  <div className="round-list">
                    {stockProgress.map((round) => {
                      const roundStageBackground = resolveRoundStageBackground(round.stage);
                      const roundStageIcon = resolveRoundStageIcon(round.stage);

                      return (
                        <article
                          className={`round-row ${roundStageIcon ? 'has-stage-icon' : ''}`}
                          key={round.id}
                          style={
                            roundStageBackground
                              ? ({
                                  '--stage-bg': `url(${roundStageBackground})`
                                } as React.CSSProperties)
                              : undefined
                          }
                        >
                          {roundStageIcon ? (
                            <div className="round-stage-slot" title={round.stage} aria-label={round.stage}>
                              <Image
                                src={roundStageIcon}
                                alt=""
                                width={38}
                                height={28}
                                unoptimized
                              />
                            </div>
                          ) : null}
                          <div className="round-player">
                            <Link
                              href={`/stats/players/${encodeURIComponent(round.home_player_tag.toLowerCase())}`}
                              className="round-player-link"
                            >
                              <strong>{round.home_player_tag}</strong>
                            </Link>
                            <div className="stock-strip">
                              {renderStockIcons(
                                resolveCharacterImagePath(game.game ?? 'ultimate', round.home_character, round.home_character_image),
                                `${round.home_character} stock icon`,
                                round.home_stocks_remaining,
                                game.game === 'ultimate' ? 3 : 4
                              )}
                            </div>
                          </div>
                          <span className="round-versus">vs</span>
                          <div className="round-player away">
                            <Link
                              href={`/stats/players/${encodeURIComponent(round.away_player_tag.toLowerCase())}`}
                              className="round-player-link"
                            >
                              <strong>{round.away_player_tag}</strong>
                            </Link>
                            <div className="stock-strip">
                              {renderStockIcons(
                                resolveCharacterImagePath(game.game ?? 'ultimate', round.away_character, round.away_character_image),
                                `${round.away_character} stock icon`,
                                round.away_stocks_remaining,
                                game.game === 'ultimate' ? 3 : 4
                              )}
                            </div>
                          </div>
                          <div className="round-team-score">
                            <span className="score-home">{round.home_team_stocks_remaining}</span>
                            <span className="score-divider">-</span>
                            <span className="score-away">{round.away_team_stocks_remaining}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">Game {gameIndex + 1} has no round data yet.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted"></p>
      )}
    </section>
  );
}
