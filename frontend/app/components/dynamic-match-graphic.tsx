'use client';

import { CSSProperties } from 'react';
import { useTeamColors } from '@/lib/colors';

type DynamicMatchGraphicProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeAvatar: string | null | undefined;
  awayAvatar: string | null | undefined;
  className?: string;
};

export function DynamicMatchGraphic({
  homeTeamName,
  awayTeamName,
  homeAvatar,
  awayAvatar,
  className,
}: DynamicMatchGraphicProps) {
  const { homeRgb, awayRgb } = useTeamColors(homeAvatar, awayAvatar);

  const styleVariables: CSSProperties = {
    '--home-team-color': `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.28)`,
    '--home-team-color-subtle': `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.08)`,
    '--home-team-color-solid': `rgb(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]})`,
    '--away-team-color': `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.28)`,
    '--away-team-color-subtle': `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.08)`,
    '--away-team-color-solid': `rgb(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]})`,
  } as CSSProperties;

  return (
    <div
      className={`dynamic-match-graphic${className ? ` ${className}` : ''}`}
      style={styleVariables}
      aria-label={`${homeTeamName} versus ${awayTeamName} graphic`}
    >
      <div className="dynamic-match-graphic-side home" aria-hidden="true" />
      <div className="dynamic-match-graphic-side away" aria-hidden="true" />
      <div className="dynamic-match-graphic-slot home">
        {homeAvatar ? (
          <img
            className="dynamic-match-graphic-logo home"
            src={homeAvatar}
            alt={`${homeTeamName} logo`}
          />
        ) : (
          <span className="dynamic-match-graphic-initials home" aria-hidden="true">
            {homeTeamName ? homeTeamName.slice(0, 3).toUpperCase() : 'HOM'}
          </span>
        )}
      </div>
      <div className="dynamic-match-graphic-slot away">
        {awayAvatar ? (
          <img
            className="dynamic-match-graphic-logo away"
            src={awayAvatar}
            alt={`${awayTeamName} logo`}
          />
        ) : (
          <span className="dynamic-match-graphic-initials away" aria-hidden="true">
            {awayTeamName ? awayTeamName.slice(0, 3).toUpperCase() : 'AWY'}
          </span>
        )}
      </div>
    </div>
  );
}
