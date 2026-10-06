'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  RiArrowRightSFill,
  RiSearchLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiYoutubeFill,
  RiTimeFill
} from '@remixicon/react';
import { DynamicMatchGraphic } from '@/app/components/dynamic-match-graphic';
import FloatingTOC from '@/app/components/floating-toc';
import {
  formatMatchDate,
  type UpcomingMatchEntry,
  type CompletedMatchHistoryEntry,
  type TournamentSeason
} from '@/lib/data';
import { calculateCrewBattleStockProgress } from '@/lib/crew-battle';
import { resolveRoundStageBackground } from '@/lib/stages';
import { resolveCharacterImagePath } from '@/lib/characters';
import { formatMatchScoreValue } from '@/lib/scores';

const PAGE_SIZE = 8;

const renderTeamNameWithAvatar = (
  teamName: string,
  avatar: string | null | undefined,
  side: 'home' | 'away',
  context: 'default' | 'detail' = 'default',
  teamSlugOrCode?: string | null
) => {
  const targetCode = (teamSlugOrCode || teamName).trim().toLowerCase();
  const href =
    targetCode && targetCode !== 'home' && targetCode !== 'away'
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
        className={`match-team-name match-team-name-${side} ${
          context === 'detail' ? 'match-team-name-detail' : ''
        }`}
      >
        {content}
      </Link>
    );
  }

  return (
    <span
      className={`match-team-name match-team-name-${side} ${
        context === 'detail' ? 'match-team-name-detail' : ''
      }`}
    >
      {content}
    </span>
  );
};

const renderStockIcons = (
  characterImage: string,
  characterName: string,
  stocksRemaining: number,
  stockSlots: number
) =>
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

interface MatchesViewProps {
  upcoming: UpcomingMatchEntry[];
  completed: CompletedMatchHistoryEntry[];
  tournamentSeasons: TournamentSeason[];
  initialPage?: number;
  initialQuery?: string;
}

export default function MatchesView({
  upcoming,
  completed,
  tournamentSeasons,
  initialPage = 1,
  initialQuery = ''
}: MatchesViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const tournamentSeasonLookup = useMemo(
    () => new Map(tournamentSeasons.map((season) => [season.id, season])),
    [tournamentSeasons]
  );

  const filteredCompleted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return completed;

    return completed.filter(({ match, tournamentSeason, homeTeam, awayTeam, rounds }) => {
      const home = (homeTeam?.name ?? '').toLowerCase();
      const homeShort = (homeTeam?.short_name ?? '').toLowerCase();
      const away = (awayTeam?.name ?? '').toLowerCase();
      const awayShort = (awayTeam?.short_name ?? '').toLowerCase();
      const season = (tournamentSeason?.name ?? '').toLowerCase();
      const matchSlug = (match.slug ?? '').toLowerCase();
      const playerMatch = rounds.some(
        (r) =>
          (r.home_player_tag ?? '').toLowerCase().includes(q) ||
          (r.away_player_tag ?? '').toLowerCase().includes(q) ||
          (r.home_character ?? '').toLowerCase().includes(q) ||
          (r.away_character ?? '').toLowerCase().includes(q)
      );

      return (
        home.includes(q) ||
        homeShort.includes(q) ||
        away.includes(q) ||
        awayShort.includes(q) ||
        season.includes(q) ||
        matchSlug.includes(q) ||
        playerMatch
      );
    });
  }, [completed, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCompleted.length / PAGE_SIZE));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const pageMatches = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return filteredCompleted.slice(start, start + PAGE_SIZE);
  }, [filteredCompleted, activePage]);

  const updateUrl = useCallback((page: number, query: string) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (query.trim()) params.set('q', query.trim());
    const newUrl = params.toString() ? `/matches?${params.toString()}` : '/matches';
    window.history.replaceState(null, '', newUrl);
  }, []);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    updateUrl(newPage, searchQuery);
    const section = document.getElementById('past-matches');
    if (section) {
      const headerOffset = 90;
      const top = section.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
    updateUrl(1, val);
  };

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages];
    }
    if (activePage >= totalPages - 3) {
      return [1, 'ellipsis-start', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'ellipsis-start', activePage - 1, activePage, activePage + 1, 'ellipsis-end', totalPages];
  }, [activePage, totalPages]);

  const upcomingChildren = useMemo(() => {
    return upcoming.map(({ match, homeTeam, awayTeam }, index) => {
      const home = homeTeam?.short_name || homeTeam?.name || 'Home';
      const away = awayTeam?.short_name || awayTeam?.name || 'Away';
      return {
        id: `match-${match.id}`,
        label: `${home} vs. ${away}`,
        number: `1.${index + 1}`
      };
    });
  }, [upcoming]);

  const pastChildren = useMemo(() => {
    return pageMatches.map(({ match, homeTeam, awayTeam }, index) => {
      const home = homeTeam?.short_name || homeTeam?.name || 'Home';
      const away = awayTeam?.short_name || awayTeam?.name || 'Away';
      return {
        id: `match-${match.id}`,
        label: `${home} vs. ${away}`,
        number: `2.${index + 1}`
      };
    });
  }, [pageMatches]);

  const tocItems = useMemo(
    () => [
      {
        id: 'upcoming-matches',
        label: 'Live & Upcoming',
        number: '01',
        ...(upcomingChildren.length > 0 ? { children: upcomingChildren } : {})
      },
      {
        id: 'past-matches',
        label: 'Past Matches',
        number: '02',
        ...(pastChildren.length > 0 ? { children: pastChildren } : {})
      }
    ],
    [upcomingChildren, pastChildren]
  );

  return (
    <div className="past-matches-page" id="matches-top">
      <section className="matches-hero">
        <div className="matches-hero-copy">
          <div className="kicker">
            <span />
            Fall 2026
          </div>
          <h1>
            Nexus
            <span>Crew Battles</span>
          </h1>
        </div>
      </section>

      <section className="upcoming-matches-section" id="upcoming-matches" aria-labelledby="upcoming-matches-title">
        <header className="matches-section-heading">
          <div>
            <span className="kicker">Live & Upcoming</span>
            <h2 id="upcoming-matches-title">Next on Stream</h2>
          </div>
        </header>
        {upcoming.length > 0 ? (
          <div className="upcoming-matches-grid">
            {upcoming.map(({ match, homeTeam, awayTeam }) => {
              const homeName = homeTeam?.short_name ?? homeTeam?.name ?? 'Home';
              const awayName = awayTeam?.short_name ?? awayTeam?.name ?? 'Away';
              const tournamentSeason = tournamentSeasonLookup.get(match.tournament_season_id);

              return (
                <article className="match-history-card upcoming-match-card" key={match.id} id={`match-${match.id}`}>
                  <div className="match-history-art">
                    {match.graphic ? (
                      <img src={match.graphic} alt="Match graphic" />
                    ) : (
                      <DynamicMatchGraphic
                        homeTeamName={homeName}
                        awayTeamName={awayName}
                        homeAvatar={homeTeam?.avatar}
                        awayAvatar={awayTeam?.avatar}
                      />
                    )}
                  </div>
                  <div className="match-history-details upcoming-match-history-details">
                    <header className="match-history-header">
                      <div className="match-history-meta">
                        <div className="kicker">
                          <span />
                          {tournamentSeason?.name ?? 'The Nexus'}
                        </div>
                        <p className="match-history-date">{formatMatchDate(match.date)}</p>
                      </div>
                      <h3 className="match-detail-scoreline match-history-scoreline">
                        {renderTeamNameWithAvatar(homeName, homeTeam?.avatar, 'home', 'detail', homeTeam?.short_name ?? homeTeam?.name)}
                        <span className="match-detail-score-group" aria-label="Match not yet played">
                          <span className="match-detail-score score-home match-detail-score-home-glow">-</span>
                          <span className="match-detail-score-separator score-divider">-</span>
                          <span className="match-detail-score score-away match-detail-score-away-glow">-</span>
                        </span>
                        {renderTeamNameWithAvatar(awayName, awayTeam?.avatar, 'away', 'detail', awayTeam?.short_name ?? awayTeam?.name)}
                      </h3>
                    </header>
                    <div className="upcoming-match-placeholder">
                      <RiTimeFill size={22} aria-hidden="true" />
                      <p>Match progression will appear once the set begins.</p>
                    </div>
                    <div className="upcoming-match-stream">
                      {match.stream_url?.trim() ? (
                        <>
                          <a
                            href={match.stream_url.trim()}
                            target="_blank"
                            rel="noreferrer"
                            className="btn upcoming-stream-btn match-history-cta"
                          >
                            <RiYoutubeFill size={18} aria-hidden="true" />
                            <span>Watch on YouTube</span>
                          </a>
                          <Link href={`/matches/${match.slug}`} className="btn btn-secondary match-history-cta">
                            <span>View Match Details</span>
                            <RiArrowRightSFill size={18} aria-hidden="true" />
                          </Link>
                        </>
                      ) : (
                        <Link href={`/matches/${match.slug}`} className="btn btn-secondary match-history-cta">
                          <span>View Match Details</span>
                          <RiArrowRightSFill size={18} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="matches-empty-state">No upcoming matches are scheduled yet.</p>
        )}
      </section>

      <section className="past-matches-section" id="past-matches" aria-labelledby="past-matches-title">
        <header className="matches-section-heading">
          <div>
            <span className="kicker">History</span>
            <h2 id="past-matches-title">Past Matches</h2>
          </div>
          <div className="matches-search-wrap">
            <RiSearchLine className="matches-search-icon" size={18} aria-hidden="true" />
            <input
              type="text"
              className="matches-search-input"
              placeholder="Search a team or player"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Search past matches"
            />
            {searchQuery ? (
              <button
                type="button"
                className="matches-search-clear"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>
        </header>

        {searchQuery ? (
          <div className="matches-search-status" role="status">
            <span>
              Showing {filteredCompleted.length} {filteredCompleted.length === 1 ? 'match' : 'matches'} for &ldquo;{searchQuery}&rdquo;
            </span>
            <button
              type="button"
              className="matches-clear-filter-btn"
              onClick={() => handleSearchChange('')}
            >
              Reset filter
            </button>
          </div>
        ) : null}

        {pageMatches.length > 0 ? (
          <>
            <div className="past-matches-list">
              {pageMatches.map(({ match, tournamentSeason, homeTeam, awayTeam, primaryGame, rounds, scoreline }) => {
                const stockProgress = primaryGame ? calculateCrewBattleStockProgress(primaryGame, rounds) : [];
                const latestStockScore = stockProgress.at(-1);
                const snapshotRounds = stockProgress.slice(0, 5);
                const resolvedHomeScore = match.status === 'completed' ? scoreline.home : null;
                const resolvedAwayScore = match.status === 'completed' ? scoreline.away : null;

                return (
                  <article className="match-history-card" key={match.id} id={`match-${match.id}`}>
                    <div className="match-history-art">
                      {match.graphic ? (
                        <img src={match.graphic} alt="Match graphic" />
                      ) : (
                        <DynamicMatchGraphic
                          homeTeamName={homeTeam?.short_name ?? homeTeam?.name ?? 'Home'}
                          awayTeamName={awayTeam?.short_name ?? awayTeam?.name ?? 'Away'}
                          homeAvatar={homeTeam?.avatar}
                          awayAvatar={awayTeam?.avatar}
                        />
                      )}
                    </div>
                    <div className="match-history-details">
                      <header className="match-history-header">
                        <div className="match-history-meta">
                          <div className="kicker">
                            <span />
                            {tournamentSeason?.name ?? 'The Nexus'}
                          </div>
                          <p className="match-history-date">{formatMatchDate(match.date)}</p>
                        </div>
                        <h3 className="match-detail-scoreline match-history-scoreline">
                          {renderTeamNameWithAvatar(
                            homeTeam?.short_name ?? homeTeam?.name ?? 'Home',
                            homeTeam?.avatar,
                            'home',
                            'detail',
                            homeTeam?.short_name ?? homeTeam?.name
                          )}
                          <span className="match-detail-score-group">
                            <span className="match-detail-score score-home match-detail-score-home-glow">
                              {formatMatchScoreValue(resolvedHomeScore)}
                            </span>
                            <span className="match-detail-score-separator score-divider">-</span>
                            <span className="match-detail-score score-away match-detail-score-away-glow">
                              {formatMatchScoreValue(resolvedAwayScore)}
                            </span>
                          </span>
                          {renderTeamNameWithAvatar(
                            awayTeam?.short_name ?? awayTeam?.name ?? 'Away',
                            awayTeam?.avatar,
                            'away',
                            'detail',
                            awayTeam?.short_name ?? awayTeam?.name
                          )}
                        </h3>
                      </header>
                {rounds.length > 0 ? (
                  <div className="match-history-summary">
                    <p className="game-header-scoreline">
                      <span className="game-header-label">Game 1</span>
                      <span className="game-header-divider">•</span>
                      <span className="game-header-score">
                        <span className="score-home">{latestStockScore?.home_team_stocks_remaining ?? 0}</span>{' '}
                        <span className="score-divider">-</span>{' '}
                        <span className="score-away">{latestStockScore?.away_team_stocks_remaining ?? 0}</span>
                      </span>
                    </p>
                    <div className="round-list">
                      {snapshotRounds.map((round) => {
                        const roundStageBackground = resolveRoundStageBackground(round.stage);

                        return (
                          <div
                            className="round-row"
                            key={round.id}
                            style={
                              roundStageBackground
                                ? ({
                                    '--stage-bg': `url(${roundStageBackground})`
                                  } as React.CSSProperties)
                                : undefined
                            }
                          >
                            <div className="round-player">
                              <Link
                                href={`/stats/players/${encodeURIComponent(round.home_player_tag.trim().toLowerCase())}`}
                                className="round-player-link"
                              >
                                <strong>{round.home_player_tag}</strong>
                              </Link>
                              <div className="stock-strip">
                                {renderStockIcons(
                                  resolveCharacterImagePath(primaryGame?.game ?? 'ultimate', round.home_character, round.home_character_image),
                                  `${round.home_character} stock icon`,
                                  round.home_stocks_remaining,
                                  primaryGame?.game === 'ultimate' ? 3 : 4
                                )}
                              </div>
                            </div>
                            <span className="round-versus">vs</span>
                            <div className="round-player away">
                              <Link
                                href={`/stats/players/${encodeURIComponent(round.away_player_tag.trim().toLowerCase())}`}
                                className="round-player-link"
                              >
                                <strong>{round.away_player_tag}</strong>
                              </Link>
                              <div className="stock-strip">
                                {renderStockIcons(
                                  resolveCharacterImagePath(primaryGame?.game ?? 'ultimate', round.away_character, round.away_character_image),
                                  `${round.away_character} stock icon`,
                                  round.away_stocks_remaining,
                                  primaryGame?.game === 'ultimate' ? 3 : 4
                                )}
                              </div>
                            </div>
                            <div className="round-team-score">
                              <span className="score-home">{round.home_team_stocks_remaining}</span>
                              <span className="score-divider">-</span>
                              <span className="score-away">{round.away_team_stocks_remaining}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="match-history-summary match-history-summary-empty" aria-hidden="true">
                    <p className="game-header-scoreline">
                      <span className="game-header-label">Game 1</span>
                      <span className="game-header-divider">•</span>
                      <span className="game-header-score">
                        <span className="score-home">0</span>{' '}
                        <span className="score-divider">-</span>{' '}
                        <span className="score-away">0</span>
                      </span>
                    </p>
                    <div className="round-list">
                      {Array.from({ length: 5 }, (_, index) => (
                        <div className="round-row" key={`empty-round-${match.id}-${index}`}>
                          <div className="round-player">
                            <strong>Home</strong>
                            <div className="stock-strip">
                              <span className="stock-icon" />
                              <span className="stock-icon" />
                              <span className="stock-icon" />
                            </div>
                          </div>
                          <span className="round-versus">vs</span>
                          <div className="round-player away">
                            <strong>Away</strong>
                            <div className="stock-strip">
                              <span className="stock-icon" />
                              <span className="stock-icon" />
                              <span className="stock-icon" />
                            </div>
                          </div>
                          <div className="round-team-score">
                            <span className="score-home">0</span>
                            <span className="score-divider">-</span>
                            <span className="score-away">0</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="match-history-footer">
                  <Link href={`/matches/${match.slug}`} className="btn btn-secondary match-history-cta">
                    View Match Details <RiArrowRightSFill size={18} />
                  </Link>
                </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <nav className="matches-numbered-pagination" aria-label="Past matches pagination">
                <button
                  type="button"
                  className="pagination-btn pagination-prev"
                  disabled={activePage <= 1}
                  onClick={() => handlePageChange(activePage - 1)}
                  aria-label="Previous page"
                >
                  <RiArrowLeftSLine size={18} aria-hidden="true" />
                  <span>Prev</span>
                </button>

                <div className="pagination-pages" role="group" aria-label="Page selection">
                  {pageNumbers.map((p, idx) => {
                    if (typeof p === 'number') {
                      const isActive = p === activePage;
                      return (
                        <button
                          key={p}
                          type="button"
                          className={`pagination-page ${isActive ? 'is-active' : ''}`}
                          onClick={() => handlePageChange(p)}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={`Page ${p}`}
                        >
                          <span>{p}</span>
                        </button>
                      );
                    }
                    return (
                      <span key={`ellipsis-${idx}`} className="pagination-ellipsis" aria-hidden="true">
                        …
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="pagination-btn pagination-next"
                  disabled={activePage >= totalPages}
                  onClick={() => handlePageChange(activePage + 1)}
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <RiArrowRightSLine size={18} aria-hidden="true" />
                </button>
              </nav>
            ) : null}
          </>
        ) : (
          <div className="matches-empty-state-wrap">
            <p className="matches-empty-state">
              {searchQuery
                ? `No matches found matching "${searchQuery}".`
                : 'No completed matches are available.'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSearchChange('')}
              >
                Clear search
              </button>
            ) : null}
          </div>
        )}
      </section>

      <FloatingTOC items={tocItems} />
    </div>
  );
}
