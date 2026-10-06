import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { StandingRow } from '@/lib/data';

type StandingsLeaderboardProps = {
  standings: StandingRow[];
};

export function StandingsLeaderboard({ standings }: StandingsLeaderboardProps) {
  return (
    <div className="home-table-card standings-table-card">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>School</th>
            <th>W</th>
            <th>L</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, index) => (
            <tr key={`${team.rank}-${team.team}`} style={{ '--delay': `${index * 100}ms` } as CSSProperties}>
              <td>{team.rank === 1 ? <span>{team.rank}</span> : team.rank}</td>
              <td>
                <Link
                  className="standings-team-link"
                  href={`/stats/teams/${encodeURIComponent(team.teamShortName.toLowerCase())}`}
                >
                  <span className="standings-team-logo-slot">
                    {team.teamAvatar ? (
                      <Image
                        src={team.teamAvatar}
                        alt={`${team.team} logo`}
                        width={28}
                        height={28}
                        className="standings-team-logo-img"
                        unoptimized
                      />
                    ) : (
                      <span className="standings-team-logo-fallback" aria-hidden="true">
                        {team.teamShortName.slice(0, 2)}
                      </span>
                    )}
                  </span>
                  <span className="standings-team-name-text">{team.team}</span>
                </Link>
              </td>
              <td>{team.w}</td>
              <td>{team.l}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
