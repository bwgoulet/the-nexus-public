import type { Metadata } from 'next';
import Link from 'next/link';
import {
  RiArrowRightFill,
  RiTrophyFill,
  RiEmotionLaughFill,
  RiDiscussFill,
  RiCheckboxFill,
  RiUserStarFill,
  RiLiveFill,
  RiShieldCheckFill,
  RiGroup3Fill,
  RiTeamFill,
  RiSwordFill,
  RiP2pFill
} from '@remixicon/react';
import AboutHeroGallery from './gallery';
import FloatingTOC from '@/app/components/floating-toc';

export const metadata: Metadata = {
  title: 'About The Nexus',
  description:
    'Meet The Nexus: a collegiate crew battle league built to make team competition organized, memorable, and community-driven.',
  openGraph: {
    title: 'About The Nexus | Collegiate Crew Battle League',
    description:
      'Meet The Nexus: a collegiate crew battle league built to make team competition organized, memorable, and community-driven.',
    url: '/about'
  },
  twitter: {
    title: 'About The Nexus | Collegiate Crew Battle League',
    description:
      'Meet The Nexus: a collegiate crew battle league built to make team competition organized, memorable, and community-driven.'
  }
};

const pillars = [
  {
    number: '01',
    icon: RiShieldCheckFill,
    title: 'A league you can trust',
    copy: 'Clear rules, guided match operations, and consistent standards help teams focus on competing and not chasing down logistics.'
  },
  {
    number: '02',
    icon: RiP2pFill,
    title: 'Player-first competition',
    copy: 'Direct integrations with premier grassroots Smash majors, we celebrate your achievements and provide a direct bridge to the biggest stages in the community.'
  },
  {
    number: '03',
    icon: RiEmotionLaughFill,
    title: 'Moments worth sharing',
    copy: 'From a last-stock comeback to a breakout season, The Nexus gives players and programs a stage for the moments that define them.'
  }
] as const;

const matchFlow = [
  {
    label: 'Prepare',
    title: 'Build your crew',
    copy: 'Directors organize their school, shape the roster, and get everyone ready for the next match.',
    icon: RiTeamFill
  },
  {
    label: 'Compete',
    title: 'Enter match night',
    copy: 'Both teams check in, choose their players, strike stages, and play through a guided crew battle.',
    icon: RiSwordFill
  },
  {
    label: 'Follow',
    title: 'Watch every stock',
    copy: 'Players and supporters can follow the schedule, live action, results, and broadcasts across the season.',
    icon: RiLiveFill
  },
  {
    label: 'Grow',
    title: 'Leave a legacy',
    copy: 'Standings, match history, and in-depth stats turn each performance into part of a bigger competitive story.',
    icon: RiTrophyFill
  }
] as const;

const audiences = [
  {
    eyebrow: 'For competitors',
    title: 'Players',
    copy: 'Represent your school, find your role in the lineup, and compete in matches where every stock can change the night.',
    link: '/signup',
    linkLabel: 'Create your profile',
    icon: RiGroup3Fill  
  },
  {
    eyebrow: 'For team leaders',
    title: 'Directors',
    copy: 'Bring your program into the league, manage your roster, and lead your crew through every stage of the season.',
    link: '/join',
    linkLabel: 'Enter the league',
    icon: RiUserStarFill
  },
  {
    eyebrow: 'For the community',
    title: 'Supporters',
    copy: 'Keep up with matches, discover teams and players, watch broadcasts, and follow the race through the standings.',
    link: '/matches',
    linkLabel: 'Explore matches',
    icon: RiDiscussFill
  }
] as const;

const principles = [
  'Competition with integrity',
  'Belonging through team play',
  'Clear paths from signup to match night',
  'Recognition for players and programs',
  'A healthier, more connected community'
] as const;

export default function AboutPage() {
  const tocItems = [
    {
      id: 'mission',
      label: 'The Mission',
      number: '01',
    },
    {
      id: 'format',
      label: 'The Format',
      number: '02',
    },
    {
      id: 'values',
      label: 'Our Standard',
      number: '03',
    },
    {
      id: 'team',
      label: 'Leadership',
      number: '04'
    }
  ];

  return (
    <div className="about-page" id="about-top">
      <section className="about-hero">
        <div className="about-hero-grid" aria-hidden="true" />

        <div className="about-hero-copy">
          <div className="kicker">
            <span />
            Collegiate Super Smash Bros. Ultimate
          </div>
          <h1>
            Where crews
            <span>become legends.</span>
          </h1>
          <p>
            The Nexus is a team-based league built to give collegiate Smash communities a better
            way to organize, compete, and be seen.
          </p>
          <div className="about-hero-actions">
            <Link className="btn btn-primary" href="/signup">
              Join The Nexus
              <RiArrowRightFill aria-hidden="true" />
            </Link>
            <Link className="btn btn-secondary" href="/matches">
              Explore the league
            </Link>
          </div>
        </div>

        <AboutHeroGallery />

      </section>

      <section className="about-manifesto" id="mission" aria-labelledby="about-mission">
        <div className="about-section-index">01 / The mission</div>
        <div className="about-manifesto-copy">
          <span className="kicker">Built for the whole crew</span>
          <h2 id="about-mission">
            Competition is better when it feels like it <em><b>belongs to everyone.</b></em>
          </h2>
        </div>
        <div className="about-manifesto-body">
          <p>
            Collegiate Smash is full of talented players, passionate organizers, and communities
            that deserve a stage of their own.
          </p>
          <br  />
          <p>
            We make it easier for schools to form teams, run meaningful matches, celebrate their
            players, and build rivalries that last beyond a single bracket.
          </p>
        </div>
      </section>

      <section className="about-pillars" id="pillars" aria-labelledby="about-difference">
        <header className="about-section-heading">
          <div>
            <span className="kicker">Why The Nexus</span>
            <h2 id="about-difference">More than another league.</h2>
          </div>
          <p>
            A complete platform designed around the people who make collegiate esports
            matter.
          </p>
        </header>

        <div className="about-pillar-grid">
          {pillars.map(({ number, icon: Icon, title, copy }) => {
            const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return (
              <article className="about-pillar-card" id={`pillar-${slug}`} key={number}>
                <div className="about-pillar-top">
                  <span>{number}</span>
                  <Icon aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="about-format" id="format" aria-labelledby="about-format-title">
        <div className="about-format-visual">
          <div className="about-format-lines" aria-hidden="true" />
          <div className="about-stock-count">
            <span>12</span>
            <div>
              <strong>stocks</strong>
              <small>One shared total</small>
            </div>
          </div>
          <div className="about-format-versus">
            <div>
              <small>Home crew</small>
              <strong>04</strong>
              <span>players</span>
            </div>
            <b>VS</b>
            <div>
              <small>Away crew</small>
              <strong>04</strong>
              <span>players</span>
            </div>
          </div>
        </div>

        <div className="about-format-copy">
          <div className="about-section-index">02 / The format</div>
          <span className="kicker">Every stock tells a story</span>
          <h2 id="about-format-title">Crew battles make Smash a team sport.</h2>
          <p>
            Two teams enter with four players and twelve stocks each. Players compete one at
            a time, carrying the stocks they preserve into the next battle. When one crew runs
            out, the other takes the match.
          </p>
          <br  />
          <p>
            The format creates something special: individual performances with team-wide
            consequences. A steady opener, a momentum-shifting counterpick, or a fearless anchor
            can become the moment everyone remembers.
          </p>
          <Link href="/rulebook">
            See how competition works
            <RiArrowRightFill aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="about-journey" id="journey" aria-labelledby="about-journey-title">
        <header className="about-section-heading">
          <div>
            <span className="kicker">From roster to result</span>
            <h2 id="about-journey-title">One connected match night.</h2>
          </div>
          <p>
            The Nexus keeps competition simple, so teams spend less time coordinating and more time
            competing.
          </p>
        </header>

        <ol className="about-flow">
          {matchFlow.map(({ label, title, copy, icon: Icon }, index) => {
            const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return (
              <li key={label} id={`step-${slug}`}>
                <div className="about-flow-marker">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <Icon aria-hidden="true" />
                </div>
                <small>{label}</small>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="about-values" id="values" aria-labelledby="about-values-title">
        <div className="about-values-copy">
          <div className="about-section-index">03 / Our standard</div>
          <span className="kicker">Building a community</span>
          <h2 id="about-values-title">A league with purpose.</h2>
          <p>
            Great competition needs more than a scoreboard. We want every season to strengthen
            the communities around it by giving new players a way in, established competitors
            something to chase, and organizers the support to build with confidence.
          </p>
        </div>
        <ul className="about-values-list">
          {principles.map((principle, index) => (
            <li key={principle}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{principle}</strong>
              <RiCheckboxFill aria-hidden="true" />
            </li>
          ))}
        </ul>
      </section>

      <section className="about-community" id="community" aria-labelledby="about-community-title">
        <header className="about-section-heading">
          <div>
            <span className="kicker">There is a place for you</span>
            <h2 id="about-community-title">Find your way into The Nexus.</h2>
          </div>
        </header>

        <div className="about-audience-grid">
          {audiences.map(({ eyebrow, title, copy, link, linkLabel, icon: Icon }) => (
            <article className="about-audience-card" id={`audience-${title.toLowerCase()}`} key={title}>
              <Icon aria-hidden="true" />
              <span>{eyebrow}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <Link href={link}>
                {linkLabel}
                <RiArrowRightFill aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <hr className="about-divider" />

      <section className="about-team" id="team" aria-labelledby="about-team-title">
        <header className="about-section-heading">
          <div>
            <div className="about-section-index">04 / League Leadership</div>
            <span className="kicker">Meet the team</span>
            <h2 id="about-team-title">Behind The Nexus.</h2>
          </div>
          <p>
            Building the platform, tools, and community to elevate collegiate Smash.
          </p>
        </header>

        <div className="about-team-grid">
          <article className="about-team-card" id="team-mikey">
            <div className="about-team-bg-image" style={{ backgroundImage: 'url(/image/about_mikey.jpg)' }} />
            <div className="about-team-info">
              <h3>Mikey Costello</h3>
              <div className="about-team-meta">
                <span className="team-tag">Buddwaur</span>
                <span className="team-role">Co-Founder</span>
              </div>
              <p>
                Leading league operations, partnership strategy, and grassroots major integrations to give players the stage they deserve.
              </p>
            </div>
          </article>

          <article className="about-team-card" id="team-seven">
            <div className="about-team-bg-image" style={{ backgroundImage: 'url(/image/about_seven.jpg)' }} />
            <div className="about-team-info">
              <h3>Seven Thomsen</h3>
              <div className="about-team-meta">
                <span className="team-tag">SZN 7</span>
                <span className="team-role">Co-Founder</span>
              </div>
              <p>
                Directing branding, event production, and frontend design to support the ecosystem behind The Nexus.
              </p>
            </div>
          </article>

          <article className="about-team-card" id="team-ben">
            <div className="about-team-bg-image" style={{ backgroundImage: 'url(/image/about_ben.jpg)' }} />
            <div className="about-team-info">
              <h3>Ben Goulet</h3>
              <div className="about-team-meta">
                <span className="team-tag">meenis</span>
                <span className="team-role">Lead Developer</span>
              </div>
              <p>
                Architecting and developing the backend, product features, and technical systems that power The Nexus.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="about-cta">
        <div>
          <h2>Ready to enter The Nexus?</h2>
        </div>
        <div className="about-cta-actions">
          <Link className="btn btn-primary" href="/signup">
            Join the league
            <RiArrowRightFill aria-hidden="true" />
          </Link>
        </div>
      </section>

      <FloatingTOC items={tocItems} />
    </div>
  );
}