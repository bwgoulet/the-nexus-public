'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RiArrowUpSLine, RiArrowDownSLine, RiArrowUpDownLine, RiInformationFill } from '@remixicon/react';
import type { PlayerStatsRow, TeamStatsRow } from '@/lib/data';

type StatsView = 'players' | 'teams';
type SortDirection = 'asc' | 'desc';
type PlayerSortKey = 'playerTag' | 'team' | 'matchesPlayed' | 'gamesPlayed' | 'attendancePercentage' | 'stocksTaken' | 'record';
type TeamSortKey = 'team' | 'totalStocksTaken' | 'matchesPlayed' | 'gamesPlayed' | 'record';

type StatsColumn<TKey extends string> = {
  key: TKey;
  label: string;
  tooltip: string;
};

type Props = {
  players: PlayerStatsRow[];
  teams: TeamStatsRow[];
  selectedSeasonId: string | null;
};

const playerColumns: StatsColumn<PlayerSortKey>[] = [
  { key: 'playerTag', label: 'PLAYER', tooltip: 'The gamer tag a player uses for Nexus matches and stat tracking.' },
  { key: 'team', label: 'TEAM', tooltip: 'The player\'s current Nexus team or school. FA means Free Agent.' },
  { key: 'matchesPlayed', label: 'MATCHES', tooltip: 'Completed crew matches where this player appeared in at least one logged round.' },
  { key: 'gamesPlayed', label: 'GAMES', tooltip: 'Completed games where this player appeared in at least one logged crew round.' },
  { key: 'attendancePercentage', label: 'ATTENDANCE', tooltip: 'The percentage of completed games involving this player\'s team where the player appeared in at least one logged crew round.' },
  { key: 'stocksTaken', label: 'STOCKS', tooltip: 'Total opponent stocks this player removed across completed crew rounds.' },
  { key: 'record', label: 'RECORD', tooltip: 'The player\'s match win-loss record based on completed matches they appeared in.' }
];

const teamColumns: StatsColumn<TeamSortKey>[] = [
  { key: 'team', label: 'TEAM', tooltip: 'The team or school represented in Nexus league play.' },
  { key: 'totalStocksTaken', label: 'STOCKS', tooltip: 'Total opponent stocks this team removed across completed games.' },
  { key: 'matchesPlayed', label: 'MATCHES', tooltip: 'Completed matches played by this team.' },
  { key: 'gamesPlayed', label: 'GAMES', tooltip: 'Completed games logged for this team across its matches.' },
  { key: 'record', label: 'RECORD', tooltip: 'The team\'s completed match win-loss record.' }
];

const formatRecord = (wins: number, losses: number) => `${wins}-${losses}`;
const withSeason = (href: string, seasonId: string | null) => seasonId ? `${href}?season=${encodeURIComponent(seasonId)}` : href;
const getPlayerStatsHref = (tag: string, seasonId: string | null = null) => withSeason(`/stats/players/${encodeURIComponent(tag.toLowerCase())}`, seasonId);
const getTeamStatsHref = (shortName: string, seasonId: string | null = null) => withSeason(`/stats/teams/${encodeURIComponent(shortName.toLowerCase())}`, seasonId);
const normalize = (value: string | number | null | undefined) => String(value ?? '').toLowerCase();

const PlayerNameWithCharacter = ({ player, selectedSeasonId }: { player: PlayerStatsRow; selectedSeasonId: string | null }) => (
  <span className="stats-player-name">
    {player.mostPlayedCharacterIcon ? (
      <Image
        src={player.mostPlayedCharacterIcon}
        alt={`${player.mostPlayedCharacter ?? 'Most played character'} icon`}
        width={32}
        height={32}
        className="stats-character-icon"
        title={player.mostPlayedCharacter ?? undefined}
      />
    ) : null}
    <span className="stats-player-label">
      <Link href={getPlayerStatsHref(player.playerTag, selectedSeasonId)}>{player.playerTag}</Link>
      {player.playerRealName ? <small>{player.playerRealName}</small> : null}
    </span>
  </span>
);

const TeamBadge = ({ avatar, label, name, href }: { avatar: string | null; label: string; name: string; href?: string }) => (
  <span className="stats-team-badge">
    {avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">{label.slice(0, 2)}</span>}
    <span>
      {href ? <Link href={href}>{label}</Link> : <strong>{label}</strong>}
      <small>{name}</small>
    </span>
  </span>
);

const compareValues = (a: string | number | null, b: string | number | null, direction: SortDirection) => {
  const multiplier = direction === 'asc' ? 1 : -1;
  if (typeof a === 'number' || typeof b === 'number') {
    return (((a ?? -Infinity) as number) - ((b ?? -Infinity) as number)) * multiplier;
  }
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
};

const SortButton = <T extends string>({
  sortKey,
  activeKey,
  direction,
  onSort,
  children
}: {
  sortKey: T;
  activeKey: T;
  direction: SortDirection;
  onSort: (key: T) => void;
  children: ReactNode;
}) => {
  const isActive = activeKey === sortKey;
  return (
    <button
      type="button"
      className={`stats-sort-button ${isActive ? 'is-active' : ''}`}
      onClick={() => onSort(sortKey)}
      aria-pressed={isActive}
    >
      <span>{children}</span>
      {isActive ? (
        direction === 'asc' ? (
          <RiArrowUpSLine size={14} className="stats-sort-icon" />
        ) : (
          <RiArrowDownSLine size={14} className="stats-sort-icon" />
        )
      ) : (
        <RiArrowUpDownLine size={13} className="stats-sort-icon is-inactive" />
      )}
    </button>
  );
};

const ColumnTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => (
  <span className="stats-column-tooltip">
    <button type="button" className="stats-tooltip-trigger" aria-label={`What ${label} means`} aria-describedby={`stats-tooltip-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <RiInformationFill size={14} />
    </button>
    <span id={`stats-tooltip-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} role="tooltip" className="stats-tooltip-content">
      {tooltip}
    </span>
  </span>
);

export default function StatsTables({ players, teams, selectedSeasonId }: Props) {
  const [activeView, setActiveView] = useState<StatsView>('players');
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [playerSort, setPlayerSort] = useState<{ key: PlayerSortKey; direction: SortDirection }>({ key: 'playerTag', direction: 'asc' });
  const [teamSort, setTeamSort] = useState<{ key: TeamSortKey; direction: SortDirection }>({ key: 'team', direction: 'asc' });
  const [playerFilters, setPlayerFilters] = useState<Record<PlayerSortKey, string>>({ playerTag: '', team: '', matchesPlayed: '', gamesPlayed: '', attendancePercentage: '', stocksTaken: '', record: '' });
  const [teamFilters, setTeamFilters] = useState<Record<TeamSortKey, string>>({ team: '', totalStocksTaken: '', matchesPlayed: '', gamesPlayed: '', record: '' });

  const updatePlayerSort = (key: PlayerSortKey) => setPlayerSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const updateTeamSort = (key: TeamSortKey) => setTeamSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

  const playerValue = (player: PlayerStatsRow, key: PlayerSortKey): string | number | null => {
    switch (key) {
      case 'playerTag': return `${player.playerTag} ${player.playerRealName ?? ''}`;
      case 'team': return `${player.teamShortName ?? 'FA'} ${player.teamName ?? 'Free Agent'}`;
      case 'record': return formatRecord(player.matchWins, player.matchLosses);
      default: return player[key];
    }
  };
  const teamValue = (team: TeamStatsRow, key: TeamSortKey): string | number | null => {
    switch (key) {
      case 'team': return `${team.teamName} ${team.teamShortName}`;
      case 'record': return formatRecord(team.matchWins, team.matchLosses);
      default: return team[key];
    }
  };

  const visiblePlayers = useMemo(() => players
    .filter((player) => {
      if (searchQuery.trim()) {
        const q = normalize(searchQuery);
        const matchTag = normalize(player.playerTag).includes(q);
        const matchName = normalize(player.playerRealName).includes(q);
        const matchTeam = normalize(player.teamName).includes(q) || normalize(player.teamShortName).includes(q);
        if (!matchTag && !matchName && !matchTeam) return false;
      }
      return (Object.keys(playerFilters) as PlayerSortKey[]).every((key) =>
        normalize(playerValue(player, key)).includes(normalize(playerFilters[key]))
      );
    })
    .sort((a, b) => compareValues(playerValue(a, playerSort.key), playerValue(b, playerSort.key), playerSort.direction)), [players, playerFilters, playerSort, searchQuery]);

  const visibleTeams = useMemo(() => teams
    .filter((team) => {
      if (searchQuery.trim()) {
        const q = normalize(searchQuery);
        const matchName = normalize(team.teamName).includes(q) || normalize(team.teamShortName).includes(q);
        if (!matchName) return false;
      }
      return (Object.keys(teamFilters) as TeamSortKey[]).every((key) =>
        normalize(teamValue(team, key)).includes(normalize(teamFilters[key]))
      );
    })
    .sort((a, b) => compareValues(teamValue(a, teamSort.key), teamValue(b, teamSort.key), teamSort.direction)), [teams, teamFilters, teamSort, searchQuery]);

  const hasActiveFilters = searchQuery.trim().length > 0 ||
    (activeView === 'players'
      ? Object.values(playerFilters).some((f) => f.length > 0)
      : Object.values(teamFilters).some((f) => f.length > 0));

  const clearAllFilters = () => {
    setSearchQuery('');
    setPlayerFilters({ playerTag: '', team: '', matchesPlayed: '', gamesPlayed: '', attendancePercentage: '', stocksTaken: '', record: '' });
    setTeamFilters({ team: '', totalStocksTaken: '', matchesPlayed: '', gamesPlayed: '', record: '' });
  };

  return (
    <div className="stats-leaderboard-card">
      <div className="stats-card-header">
        <div>
          <p className="stats-page-kicker">Table view</p>
          <h2>{activeView === 'players' ? 'Players' : 'Teams'}</h2>
        </div>
        <div className="stats-tabs" role="tablist" aria-label="Stats table views">
          <button type="button" role="tab" aria-selected={activeView === 'players'} className={activeView === 'players' ? 'is-active' : ''} onClick={() => setActiveView('players')}>Players</button>
          <button type="button" role="tab" aria-selected={activeView === 'teams'} className={activeView === 'teams' ? 'is-active' : ''} onClick={() => setActiveView('teams')}>Teams</button>
        </div>
      </div>

      <div className="stats-controls-bar">
        <div className="stats-search-wrap">
          <input
            type="text"
            className="stats-search-input"
            placeholder={activeView === 'players' ? "Search player or team..." : "Search team or code..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search stats"
          />
          {searchQuery ? (
            <button type="button" className="stats-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
              ✕
            </button>
          ) : null}
        </div>
        <div className="stats-controls-actions">
          {hasActiveFilters ? (
            <button type="button" className="stats-reset-filters-btn" onClick={clearAllFilters}>
              Clear filters
            </button>
          ) : null}
          <div className="stats-display-toggle" role="group" aria-label="Display mode">
            <button type="button" className={displayMode === 'table' ? 'is-active' : ''} onClick={() => setDisplayMode('table')}>
              Table
            </button>
            <button type="button" className={displayMode === 'cards' ? 'is-active' : ''} onClick={() => setDisplayMode('cards')}>
              Cards
            </button>
          </div>
        </div>
      </div>

      {activeView === 'players' ? (
        displayMode === 'table' ? (
          <div className="stats-table-wrap">
            <table className="stats-table stats-table-players">
              <thead>
                <tr>
                  {playerColumns.map(({ key, label, tooltip }) => (
                    <th key={key} scope="col">
                      <div className="stats-column-heading">
                        <SortButton sortKey={key} activeKey={playerSort.key} direction={playerSort.direction} onSort={updatePlayerSort}>{label}</SortButton>
                        <ColumnTooltip label={label} tooltip={tooltip} />
                      </div>
                      <input aria-label={`Filter ${label}`} value={playerFilters[key]} onChange={(event) => setPlayerFilters((current) => ({ ...current, [key]: event.target.value }))} placeholder="Filter" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.length ? (
                  visiblePlayers.map((player) => (
                    <tr key={player.playerTag}>
                      <th scope="row" className="stats-primary-cell"><PlayerNameWithCharacter player={player} selectedSeasonId={selectedSeasonId} /></th>
                      <td><TeamBadge avatar={player.teamAvatar} label={player.teamShortName ?? 'FA'} name={player.teamName ?? 'Free Agent'} href={player.teamShortName ? getTeamStatsHref(player.teamShortName, selectedSeasonId) : undefined} /></td>
                      <td>{player.matchesPlayed}</td>
                      <td>{player.gamesPlayed}</td>
                      <td>{player.attendancePercentage.toFixed(1)}%</td>
                      <td className="stats-stocks">{player.stocksTaken}</td>
                      <td>{formatRecord(player.matchWins, player.matchLosses)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={playerColumns.length} className="stats-empty-cell">
                      <div className="stats-empty-content">
                        <p>No players match the current filters.</p>
                        {hasActiveFilters ? (
                          <button type="button" className="stats-clear-filters-btn" onClick={clearAllFilters}>
                            Clear all filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          visiblePlayers.length ? (
            <div className="stats-mobile-card-grid">
              {visiblePlayers.map((player) => (
                <article key={player.playerTag} className="stats-mobile-card">
                  <div className="stats-mobile-card-header">
                    <PlayerNameWithCharacter player={player} selectedSeasonId={selectedSeasonId} />
                    <span className="stats-record-badge">{formatRecord(player.matchWins, player.matchLosses)} W/L</span>
                  </div>
                  <div className="stats-mobile-card-sub">
                    <TeamBadge
                      avatar={player.teamAvatar}
                      label={player.teamShortName ?? 'FA'}
                      name={player.teamName ?? 'Free Agent'}
                      href={player.teamShortName ? getTeamStatsHref(player.teamShortName, selectedSeasonId) : undefined}
                    />
                  </div>
                  <div className="stats-mobile-card-stats">
                    <div><span>Matches</span><strong>{player.matchesPlayed}</strong></div>
                    <div><span>Games</span><strong>{player.gamesPlayed}</strong></div>
                    <div><span>Attendance</span><strong>{player.attendancePercentage.toFixed(1)}%</strong></div>
                    <div><span>Stocks</span><strong className="stats-stocks">{player.stocksTaken}</strong></div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="stats-empty-content stats-empty-card-wrap">
              <p>No players match the current filters.</p>
              {hasActiveFilters ? (
                <button type="button" className="stats-clear-filters-btn" onClick={clearAllFilters}>
                  Clear all filters
                </button>
              ) : null}
            </div>
          )
        )
      ) : (
        displayMode === 'table' ? (
          <div className="stats-table-wrap">
            <table className="stats-table stats-table-teams">
              <thead>
                <tr>
                  {teamColumns.map(({ key, label, tooltip }) => (
                    <th key={key} scope="col">
                      <div className="stats-column-heading">
                        <SortButton sortKey={key} activeKey={teamSort.key} direction={teamSort.direction} onSort={updateTeamSort}>{label}</SortButton>
                        <ColumnTooltip label={label} tooltip={tooltip} />
                      </div>
                      <input aria-label={`Filter ${label}`} value={teamFilters[key]} onChange={(event) => setTeamFilters((current) => ({ ...current, [key]: event.target.value }))} placeholder="Filter" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTeams.length ? (
                  visibleTeams.map((team) => (
                    <tr key={team.teamId}>
                      <th scope="row" className="stats-primary-cell"><TeamBadge avatar={team.teamAvatar} label={team.teamShortName} name={team.teamName} href={getTeamStatsHref(team.teamShortName, selectedSeasonId)} /></th>
                      <td className="stats-stocks">{team.totalStocksTaken}</td>
                      <td>{team.matchesPlayed}</td>
                      <td>{team.gamesPlayed}</td>
                      <td>{formatRecord(team.matchWins, team.matchLosses)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={teamColumns.length} className="stats-empty-cell">
                      <div className="stats-empty-content">
                        <p>No teams match the current filters.</p>
                        {hasActiveFilters ? (
                          <button type="button" className="stats-clear-filters-btn" onClick={clearAllFilters}>
                            Clear all filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          visibleTeams.length ? (
            <div className="stats-mobile-card-grid">
              {visibleTeams.map((team) => (
                <article key={team.teamId} className="stats-mobile-card">
                  <div className="stats-mobile-card-header">
                    <TeamBadge
                      avatar={team.teamAvatar}
                      label={team.teamShortName}
                      name={team.teamName}
                      href={getTeamStatsHref(team.teamShortName, selectedSeasonId)}
                    />
                    <span className="stats-record-badge">{formatRecord(team.matchWins, team.matchLosses)} W/L</span>
                  </div>
                  <div className="stats-mobile-card-stats">
                    <div><span>Stocks</span><strong className="stats-stocks">{team.totalStocksTaken}</strong></div>
                    <div><span>Matches</span><strong>{team.matchesPlayed}</strong></div>
                    <div><span>Games</span><strong>{team.gamesPlayed}</strong></div>
                    <div><span>W/L</span><strong>{formatRecord(team.matchWins, team.matchLosses)}</strong></div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="stats-empty-content stats-empty-card-wrap">
              <p>No teams match the current filters.</p>
              {hasActiveFilters ? (
                <button type="button" className="stats-clear-filters-btn" onClick={clearAllFilters}>
                  Clear all filters
                </button>
              ) : null}
            </div>
          )
        )
      )}
    </div>
  );
}
