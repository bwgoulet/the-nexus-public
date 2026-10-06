'use client';

import { CSSProperties, ReactNode } from 'react';
import { useTeamColors } from '@/lib/colors';

interface MatchDetailSpotlightProps {
  homeAvatar?: string | null;
  awayAvatar?: string | null;
  children: ReactNode;
  className?: string;
}

export function MatchDetailSpotlight({
  homeAvatar,
  awayAvatar,
  children,
  className,
}: MatchDetailSpotlightProps) {
  const { homeRgb, awayRgb } = useTeamColors(homeAvatar, awayAvatar);

  const styleVariables: CSSProperties = {
    '--spotlight-home-color': `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.2)`,
    '--spotlight-away-color': `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.2)`,
    '--spotlight-home-subtle': `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.03)`,
    '--spotlight-away-subtle': `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.03)`,
    '--spotlight-home-glow': `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.4)`,
    '--spotlight-away-glow': `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.4)`,
    '--spotlight-border-home': `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.35)`,
    '--spotlight-border-away': `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.35)`,
  } as CSSProperties;

  return (
    <div
      className={`match-detail-spotlight${className ? ` ${className}` : ''}`}
      style={styleVariables}
    >
      {children}
    </div>
  );
}
