import type { CSSProperties } from 'react';
import Link from 'next/link';
import { 
  RiVideoOnFill, 
  RiMeteorFill, 
  RiPieChart2Fill,
  RiYoutubeFill,
  RiPlayCircleFill,
  RiTimeFill,
  RiArrowRightSLine,
  RiArrowDownSLine
} from '@remixicon/react';
import { DynamicMatchGraphic } from '@/app/components/dynamic-match-graphic';
import { StandingsLeaderboard } from '@/app/components/standings-leaderboard';
import { getBroadcastScheduleEntries, getSeason1Standings } from '@/lib/data';

export const dynamic = 'force-dynamic';



const heroFeatures = [
  {
    icon: <RiVideoOnFill className="home-feature-icon text-nexus-emerald" />,
    title: 'Premium Broadcasts',
    description: 'We showcase collegiate talent. Broadcast standards engineered for the highest level of competition.'
  },
  {
    icon: <RiMeteorFill className="home-feature-icon text-nexus-magenta" />,
    title: 'Built for Smash',
    description: 'A grassroots league that understands the scene. Compete with rulesets you know. The Nexus is built for competitive players.'
  },
  {
    icon: <RiPieChart2Fill className="home-feature-icon text-nexus-emerald" />,
    title: 'In-Depth Analytics',
    description: 'Track leaderboards, detailed player profiles, team stats, and more. Find how your roster stacks up on the national stage.'
  }
];

const formatBroadcastTime = (iso: string, status: 'live' | 'upcoming' | 'completed') => {
  if (status === 'live') {
    return 'Now';
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short'
  }).format(new Date(iso));
};

const getBroadcastLink = (streamUrl: string | null, slug: string) => streamUrl?.trim() || `/matches/${slug}`;
const isExternalHref = (href: string) => /^https?:\/\//i.test(href);

const youtubeUrl = 'https://www.youtube.com/@TheNexus-gg';

export default async function HomePage() {
  const [standings, broadcastEntries] = await Promise.all([getSeason1Standings(), getBroadcastScheduleEntries()]);

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-container home-hero-inner">
          <div className="home-logo-wrap">
            <img src="/logos/Primary/SVG/Nexus Emerald.svg" alt="The Nexus logo" className="home-logo" />
          </div>
          <h1 id="home-title">
            The Premier league for <span>collegiate smash</span>
          </h1>
          <p className="home-hero-copy">Join the fastest growing collegiate Super Smash Bros. league.</p>
          <div className="home-actions">
            <Link href="/signup" className="btn btn-primary">
              Enter The Nexus <RiArrowRightSLine className="home-arrow" />
            </Link>
            <a href="#broadcasts" className="btn btn-secondary">
              <RiYoutubeFill size={20} className="home-btn-icon" /> Watch Games Live
            </a>
          </div>

          <div className="home-feature-band" aria-label="League highlights">
            {heroFeatures.map((feature, index) => (
              <article className="home-feature-card" key={feature.title} style={{ '--delay': `${index * 100}ms` } as CSSProperties}>
                <div className="home-feature-content">
                  <span className="home-feature-icon-box">{feature.icon}</span>
                  <div>
                    <h2>{feature.title}</h2>
                    <p>{feature.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <a href="#broadcasts" className="home-scroll-down-btn">
          Watch Games Live <RiArrowDownSLine className="home-arrow home-arrow-down" />
        </a>
      </section>

      <section id="broadcasts" className="home-broadcasts" aria-labelledby="home-broadcasts-title">
        <div className="home-container home-broadcast-inner">
          <div className="home-section-header">
            <div>
              <div className="kicker is-broadcasts">
                <span />
                Upcoming Broadcasts
              </div>
              <h2>Watch Games Live</h2>
            </div>
            <a href={youtubeUrl} target="_blank" rel="noreferrer" className="home-subscribe">
              <RiYoutubeFill className="home-subscribe-icon" />
              Subscribe
            </a>
          </div>

          {broadcastEntries.length > 0 ? (
            <div className="home-match-row" aria-label="Broadcast schedule">
              {broadcastEntries.map((match, index) => {
                const href = getBroadcastLink(match.streamUrl, match.slug);
                const isExternal = isExternalHref(href);

                return (
                  <article className="home-match-card" key={match.id} style={{ '--delay': `${index * 100}ms` } as CSSProperties}>
                    <div className="home-match-shell">
                      <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined} className="home-match-image-wrap">
                        <DynamicMatchGraphic
                          homeTeamName={match.homeTeam.short_name}
                          awayTeamName={match.awayTeam.short_name}
                          homeAvatar={match.homeTeam.avatar ?? '/logos/B&W/SVG/Solid Currant.svg'}
                          awayAvatar={match.awayTeam.avatar ?? '/logos/B&W/SVG/Solid White.svg'}
                          className="home-match-image home-match-dynamic-graphic"
                        />
                        <span className="home-match-image-gradient" aria-hidden="true" />
                        {match.streamUrl?.trim() ? (
                          <span className="home-viewers">
                            <RiYoutubeFill className="home-viewers-icon" /> {match.status === 'completed' ? 'VOD' : 'Stream'}
                          </span>
                        ) : null}
                        <span className="home-play" aria-hidden="true">
                          <RiPlayCircleFill className="home-play-icon" />
                        </span>
                      </a>
                      <div className="home-match-content">
                        <p>
                          <RiTimeFill className="home-time-icon" />
                          {formatBroadcastTime(match.startsAt, match.status)}
                        </p>
                        <h3>
                          <span>{match.homeTeam.short_name}</span>
                          <em>VS.</em>
                          <span>{match.awayTeam.short_name}</span>
                        </h3>
                      </div>
                    </div>
                    <span className="home-match-corner" aria-hidden="true" />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="home-broadcast-empty" role="status">
              <p>No broadcasts are scheduled yet. Check back soon for the next Nexus stream.</p>
            </div>
          )}
        </div>
      </section>

      <section className="home-standings" aria-labelledby="home-standings-title">
        <div className="home-container">
          <div className="home-section-header">
            <div>
              <div className="kicker is-standings">
                <span />
                Fall 2026 Leaders
              </div>
              <h2 id="home-standings-title">Current Standings</h2>
            </div>
            <Link href="/standings" className="home-leaderboard-link">
              View Full Leaderboard <RiArrowRightSLine className="home-link-arrow" />
            </Link>
          </div>

          <StandingsLeaderboard standings={standings} />
        </div>
      </section>
    </div>
  );
}
