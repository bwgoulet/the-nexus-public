import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { formatMatchDate, type CompetitionMatch, type CompetitionMatchup, type CompetitionTeam } from '@/lib/data';

function TeamLine({
  team,
  score,
  isWinner
}: {
  team: CompetitionMatch['home_team'];
  score: number | null;
  isWinner?: boolean;
}) {
  return (
    <div className={`public-bracket-team ${isWinner ? 'is-winner' : ''}`}>
      <div className="public-bracket-team-logo">
        {team.avatar ? (
          <Image
            src={team.avatar}
            alt=""
            width={26}
            height={26}
            className="public-bracket-logo-img"
          />
        ) : (
          <i>{team.short_name.slice(0, 2)}</i>
        )}
      </div>
      <Link
        href={`/stats/teams/${team.short_name.toLowerCase()}`}
        className="public-bracket-team-text"
        title={`View ${team.name} profile & stats`}
      >
        <b>{team.short_name}</b>
        <small title={team.name}>{team.name}</small>
      </Link>
      {score !== null ? (
        <strong className={isWinner ? 'is-winner' : ''}>{score}</strong>
      ) : null}
    </div>
  );
}

export function BracketFixture({ match }: { match: CompetitionMatch }) {
  const isCompleted = match.status === 'completed';
  const homeScore = isCompleted ? match.home_score : null;
  const awayScore = isCompleted ? match.away_score : null;
  const homeWins = isCompleted && homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWins = isCompleted && homeScore !== null && awayScore !== null && awayScore > homeScore;

  return (
    <article className={`public-bracket-fixture is-${match.status}`}>
      <header>
        <time dateTime={match.date}>{formatMatchDate(match.date)}</time>
        <span className={`fixture-status-pill is-${match.status}`}>
          {match.status === 'live' ? <span className="live-dot" /> : null}
          {match.status === 'upcoming' ? 'Scheduled' : match.status}
        </span>
      </header>
      <div className="public-bracket-score">
        <TeamLine team={match.home_team} score={homeScore} isWinner={homeWins} />
        <TeamLine team={match.away_team} score={awayScore} isWinner={awayWins} />
      </div>
      <footer>
        <Link href={`/matches/${match.slug}`}>Match details</Link>
        {match.status === 'live' ? (
          <Link className="public-bracket-live-link" href={`/matches/${match.slug}/live`}>
            Enter live match
          </Link>
        ) : null}
      </footer>
    </article>
  );
}

export function MatchupFixture({ matchup }: { matchup: CompetitionMatchup }) {
  const formattedDate = matchup.scheduled_at
    ? formatMatchDate(matchup.scheduled_at)
    : 'Date pending';

  return (
    <article className="public-bracket-fixture is-upcoming is-matchup">
      <header>
        <time>{formattedDate}</time>
        <span className="fixture-status-pill is-upcoming">Scheduled</span>
      </header>
      <div className="public-bracket-score">
        <TeamLine team={matchup.home_team} score={null} />
        <TeamLine team={matchup.away_team} score={null} />
      </div>
      <footer>
        <span className="fixture-placeholder-label">Match Details Pending</span>
      </footer>
    </article>
  );
}

type BracketTeam = Omit<CompetitionTeam, 'seed'> & { seed?: number | null };

type ProjectedBracketMatch = {
  id: string;
  label: string;
  top: BracketTeam | string;
  bottom: BracketTeam | string;
  match?: CompetitionMatch;
};

function ProjectedTeamLine({ entry }: { entry: BracketTeam | string }) {
  if (typeof entry === 'string') return <span className="is-projected"><em>{entry}</em></span>;
  return (
    <div className="projected-team-row">
      <div className="projected-team-logo">
        {entry.avatar ? (
          <Image src={entry.avatar} alt="" width={22} height={22} className="projected-logo-img" />
        ) : null}
      </div>
      <i className="projected-team-seed">{entry.seed ?? '—'}</i>
      <div className="projected-team-text">
        <b>{entry.short_name}</b>
        <small title={entry.name}>{entry.name}</small>
      </div>
    </div>
  );
}

function ProjectedBracketCard({ node }: { node: ProjectedBracketMatch }) {
  if (node.match) {
    return (
      <article className={`projected-bracket-match is-${node.match.status}`}>
        <small>{node.label}</small>
        <Link
          href={`/matches/${node.match.slug}`}
          aria-label={`View ${node.match.home_team.name} versus ${node.match.away_team.name}`}
        >
          <ProjectedTeamLine entry={node.match.home_team} />
          <ProjectedTeamLine entry={node.match.away_team} />
        </Link>
      </article>
    );
  }
  return (
    <article className="projected-bracket-match">
      <small>{node.label}</small>
      <div>
        <ProjectedTeamLine entry={node.top} />
        <ProjectedTeamLine entry={node.bottom} />
      </div>
    </article>
  );
}

function winnerRoundName(index: number, total: number) {
  const remaining = total - index;
  if (remaining === 1) return 'Winners Final';
  if (remaining === 2) return 'Winners Semi-Final';
  return `Winners Round ${index + 1}`;
}

export function DoubleEliminationBracket({
  matches,
  teams
}: {
  matches: CompetitionMatch[];
  teams: CompetitionTeam[];
}) {
  const winnerRounds = Math.max(1, Math.ceil(Math.log2(Math.max(teams.length, 2))));
  let letterIndex = 0;
  let matchIndex = 0;
  const nextLabel = () => String.fromCharCode(65 + letterIndex++);
  const winners = Array.from({ length: winnerRounds }, (_, roundIndex) => {
    const count = 2 ** Math.max(0, winnerRounds - roundIndex - 1);
    return {
      title: winnerRoundName(roundIndex, winnerRounds),
      nodes: Array.from({ length: count }, (_, nodeIndex): ProjectedBracketMatch => {
        const label = nextLabel();
        const scheduled = matches[matchIndex++];
        const seedOffset = nodeIndex * 2;
        const previousRoundStart = letterIndex - 1 - count * 2;
        return {
          id: `winner-${roundIndex}-${nodeIndex}`,
          label,
          match: scheduled,
          top:
            roundIndex === 0
              ? teams[seedOffset] ?? 'Seed pending'
              : `winner of ${String.fromCharCode(65 + previousRoundStart + nodeIndex * 2)}`,
          bottom:
            roundIndex === 0
              ? teams[seedOffset + 1] ?? 'Opponent pending'
              : `winner of ${String.fromCharCode(66 + previousRoundStart + nodeIndex * 2)}`
        };
      })
    };
  });
  const winnersFinalLabel = winners.at(-1)?.nodes[0].label ?? 'A';
  const lowerRoundCount = teams.length > 2 ? Math.max(2, winnerRounds * 2 - 2) : 0;
  const lower = Array.from({ length: lowerRoundCount }, (_, roundIndex) => ({
    title:
      roundIndex === lowerRoundCount - 1
        ? 'Losers Final'
        : roundIndex === lowerRoundCount - 2
        ? 'Losers Semi-Final'
        : roundIndex === 1
        ? 'Losers Quarter-Final'
        : `Losers Round ${roundIndex + 1}`,
    nodes: Array.from(
      { length: Math.max(1, 2 ** Math.floor((lowerRoundCount - roundIndex - 1) / 2)) },
      (_, nodeIndex): ProjectedBracketMatch => {
        const label = nextLabel();
        const scheduled = matches[matchIndex++];
        return {
          id: `lower-${roundIndex}-${nodeIndex}`,
          label,
          match: scheduled,
          top: roundIndex
            ? 'winner advances'
            : `loser of ${winners[0].nodes[nodeIndex * 2]?.label ?? winnersFinalLabel}`,
          bottom: roundIndex
            ? 'bracket opponent'
            : `loser of ${winners[0].nodes[nodeIndex * 2 + 1]?.label ?? winnersFinalLabel}`
        };
      }
    )
  }));
  const grandFinal: ProjectedBracketMatch = {
    id: 'grand-final',
    label: nextLabel(),
    match: matches[matchIndex],
    top: `winner of ${winnersFinalLabel}`,
    bottom: lower.length ? `winner of ${lower.at(-1)!.nodes[0].label}` : 'finalist'
  };

  return (
    <div className="bracket-preview public-bracket">
      <div
        className="projected-bracket"
        style={{ '--bracket-columns': winners.length + 1 } as CSSProperties}
      >
        <div className="projected-bracket-upper">
          {winners.map((round) => (
            <div className="projected-bracket-round" key={round.title}>
              <h3>{round.title}</h3>
              <div>
                {round.nodes.map((node) => (
                  <ProjectedBracketCard node={node} key={node.id} />
                ))}
              </div>
            </div>
          ))}
          <div className="projected-bracket-round grand-final">
            <h3>Grand Final</h3>
            <div>
              <ProjectedBracketCard node={grandFinal} />
            </div>
          </div>
        </div>
        {lower.length ? (
          <div className="projected-bracket-lower">
            {lower.map((round) => (
              <div className="projected-bracket-round" key={round.title}>
                <h3>{round.title}</h3>
                <div>
                  {round.nodes.map((node) => (
                    <ProjectedBracketCard node={node} key={node.id} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RoundRobinBracket({
  matches,
  matchups = [],
  weeks
}: {
  matches: CompetitionMatch[];
  matchups?: CompetitionMatchup[];
  weeks?: number | null;
}) {
  type WeekItem =
    | { type: 'match'; match: CompetitionMatch }
    | { type: 'matchup'; matchup: CompetitionMatchup };

  const weeksMap = new Map<number, WeekItem[]>();

  if (matches.length > 0) {
    const sortedMatches = [...matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstDate = new Date(sortedMatches[0].date);
    const dayOfWeek = firstDate.getUTCDay(); // 0 = Sunday, 1 = Monday...
    const diffToMonday = (dayOfWeek + 6) % 7;
    const startMonday = new Date(firstDate);
    startMonday.setUTCDate(startMonday.getUTCDate() - diffToMonday);
    startMonday.setUTCHours(0, 0, 0, 0);

    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    for (const match of sortedMatches) {
      const matchTime = new Date(match.date).getTime();
      const week = Math.max(
        1,
        Math.floor((matchTime - startMonday.getTime()) / ONE_WEEK_MS) + 1
      );
      if (!weeksMap.has(week)) weeksMap.set(week, []);
      weeksMap.get(week)!.push({ type: 'match', match });
    }

    // Include any projected matchups for future weeks where matches have not been created yet
    if (matchups.length > 0) {
      for (const matchup of matchups) {
        const alreadyHasMatch = matches.some(
          (m) =>
            (m.home_team.id === matchup.home_team.id && m.away_team.id === matchup.away_team.id) ||
            (m.home_team.id === matchup.away_team.id && m.away_team.id === matchup.home_team.id)
        );
        if (!alreadyHasMatch) {
          const week = matchup.week;
          if (!weeksMap.has(week)) weeksMap.set(week, []);
          weeksMap.get(week)!.push({ type: 'matchup', matchup });
        }
      }
    }
  } else if (matchups.length > 0) {
    for (const matchup of matchups) {
      const week = matchup.week;
      if (!weeksMap.has(week)) weeksMap.set(week, []);
      weeksMap.get(week)!.push({ type: 'matchup', matchup });
    }
  }

  const sortedWeekNumbers = Array.from(weeksMap.keys()).sort((a, b) => a - b);

  if (sortedWeekNumbers.length === 0) {
    return (
      <div className="competition-empty-state">
        <strong>No Matchups Scheduled Yet</strong>
        <p>Matchups will appear here as the weekly schedule is generated.</p>
      </div>
    );
  }

  const getItemTime = (item: WeekItem) => {
    if (item.type === 'match') return new Date(item.match.date).getTime();
    if (item.matchup.scheduled_at) return new Date(item.matchup.scheduled_at).getTime();
    return Infinity;
  };

  return (
    <div className="competition-weeks-list">
      {sortedWeekNumbers.map((weekNum) => {
        const items = (weeksMap.get(weekNum) ?? []).slice().sort((a, b) => getItemTime(a) - getItemTime(b));
        return (
          <div key={weekNum} className="competition-week-block">
            <div className="competition-week-header">
              <span className="competition-week-badge">Week {weekNum}</span>
              <span className="competition-week-count">
                {items.length} {items.length === 1 ? 'Match' : 'Matches'}
              </span>
            </div>
            <div className="competition-week-grid">
              {items.map((item, idx) =>
                item.type === 'match' ? (
                  <BracketFixture key={item.match.id} match={item.match} />
                ) : (
                  <MatchupFixture key={item.matchup.id ?? idx} matchup={item.matchup} />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
