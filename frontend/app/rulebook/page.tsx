import type { Metadata } from 'next';
import Image from 'next/image';
import FloatingTOC from '@/app/components/floating-toc';
import {
  RiDownloadFill,
  RiArrowUpFill,
  RiCheckFill,
  RiTimeFill,
  RiErrorWarningFill,
  RiShieldCheckFill,
  RiTrophyFill,
  RiTeamFill,
  RiContactsFill,
  RiForbidFill,
  RiListCheck
} from '@remixicon/react';

export const metadata: Metadata = {
  title: 'Official Rulebook',
  description:
    'The official Nexus Teams rules for collegiate crew competition.',
  openGraph: {
    title: 'Official Rulebook | The Nexus',
    description:
      'The official Nexus Teams rules for collegiate crew competition.',
    url: '/rulebook'
  },
  twitter: {
    title: 'Official Rulebook | The Nexus',
    description:
      'The official Nexus Teams rules for collegiate crew competition.'
  }
};

const contents = [
  ['eligibility', '01', 'Eligibility & teams'],
  ['match-rules', '02', 'Match rules'],
  ['spectators', '03', 'Spectator rules'],
  ['sportsmanship', '04', 'Sportsmanship'],
  ['live-events', '05', 'Live event rules'],
  ['prizes', '06', 'Prizes'],
  ['enforcement', '07', 'Enforcement']
] as const;

const lobbySettings = [
  ['Stock', '3'],
  ['Time', '10 minutes'],
  ['Final Smash Meter', 'Off'],
  ['Spirits', 'Off'],
  ['Damage Handicap', 'Off'],
  ['Items', 'Off'],
  ['Stage Selection', 'Anyone'],
  ['Stage Morph', 'Off'],
  ['Stage Hazards', 'Off'],
  ['Team Attack', 'On'],
  ['Launch Rate', '1.0×'],
  ['Underdog Boost', 'Off'],
  ['Show Damage', 'Yes']
] as const;

function RuleNumber({ children }: { children: React.ReactNode }) {
  return <span className="rulebook-rule-number">{children}</span>;
}

function SectionHeading({
  number,
  eyebrow,
  title,
  description
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="rulebook-section-heading">
      <div className="rulebook-section-number" aria-hidden="true">
        {number}
      </div>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

function RuleList({ children }: { children: React.ReactNode }) {
  return <ul className="rulebook-rule-list">{children}</ul>;
}

export default function RulebookPage() {
  const tocItems = [
    {
      id: 'eligibility',
      label: 'Eligibility & teams',
      number: '01',
      children: [
        { id: 'eligibility-institutions', label: 'Institution eligibility', number: '1.1' },
        { id: 'eligibility-players', label: 'Player eligibility', number: '1.2' },
        { id: 'eligibility-teams', label: 'Team rules', number: '1.3' },
        { id: 'eligibility-deadlines', label: 'Deadlines', number: '1.4' }
      ]
    },
    {
      id: 'match-rules',
      label: 'Match rules',
      number: '02',
      children: [
        { id: 'match-settings', label: 'Lobby settings', number: '2.1' },
        { id: 'match-procedure', label: 'Match procedure', number: '2.2' },
        { id: 'match-stage-selection', label: 'Stage selection', number: '2.3' },
        { id: 'match-draws', label: 'Draws', number: '2.4' },
        { id: 'match-bugs', label: 'Bugs & remakes', number: '2.5' },
        { id: 'match-noshows', label: 'No-shows', number: '2.6' },
        { id: 'match-submission', label: 'Submitting results', number: '2.7' }
      ]
    },
    {
      id: 'spectators',
      label: 'Spectator rules',
      number: '03',
      children: [
        { id: 'spectators-featured', label: 'Featured matches', number: '3.1' },
        { id: 'spectators-non-featured', label: 'Non-featured matches', number: '3.2' }
      ]
    },
    {
      id: 'sportsmanship',
      label: 'Sportsmanship',
      number: '04',
      children: [
        { id: 'sportsmanship-integrity', label: 'Play the right way', number: '4.1' }
      ]
    },
    {
      id: 'live-events',
      label: 'Live event rules',
      number: '05',
      children: [
        { id: 'live-events-provisions', label: 'Live event rules', number: '5.1' }
      ]
    },
    {
      id: 'prizes',
      label: 'Prizes',
      number: '06',
      children: [
        { id: 'prizes-distribution', label: 'Distribution path', number: '6.1' }
      ]
    },
    {
      id: 'enforcement',
      label: 'Enforcement',
      number: '07',
      children: [
        { id: 'enforcement-escalate', label: 'Escalate', number: '7.1' },
        { id: 'enforcement-respect', label: 'Respect the ruling', number: '7.2' },
        { id: 'enforcement-protect', label: 'Protect competition', number: '7.3' }
      ]
    }
  ];

  return (
    <div className="rulebook-page" id="rulebook-top">
      <section className="rulebook-hero">
        <div className="rulebook-hero-grid" aria-hidden="true" />

        <div className="rulebook-hero-copy">
          <h1>
            Official
            <span>Rulebook</span>
          </h1>
          <p>
            The definitive competition guide for Super Smash Bros. Ultimate crew battles in The
            Nexus League.
          </p>
          <div className="rulebook-hero-actions">
            <a className="btn btn-primary" href="/docs/The_Nexus_Rulebook.pdf">
              Download .pdf
              <RiDownloadFill aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <nav className="rulebook-contents" id="contents" aria-label="Rulebook contents">
        <div className="rulebook-contents-heading">
          <span>Quick navigation</span>
          <h2>Contents</h2>
        </div>
        <ol>
          {contents.map(([id, number, label]) => (
            <li key={id}>
              <a href={`#${id}`}>
                <span>{number}</span>
                <strong>{label}</strong>
                <i aria-hidden="true">↘</i>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <main className="rulebook-document">
        <section className="rulebook-section" id="eligibility">
          <SectionHeading
            number="01"
            eyebrow="League entry"
            title="Individual Eligibility & Team Rules"
            description="Who may represent an institution, how teams are built, and what must happen before match day."
          />

          <div className="rulebook-subsection" id="eligibility-institutions">
            <div className="rulebook-subsection-title">
              <span>1.1</span>
              <h3>Institution eligibility</h3>
            </div>
            <p>
              To be eligible to compete in The Nexus League, an institution must be a recognised
              provider of Higher Education (HE). Eligible institutions may compete as a single
              institution or as separate Playing Entities. Each playing entity must fit one of the
              following models:
            </p>
            <RuleList>
              <li>
                <RuleNumber>1.1.1</RuleNumber>Main campus competing as one entity.
              </li>
              <li>
                <RuleNumber>1.1.2</RuleNumber>Satellite campus competing separately from the main
                campus or other campuses.
              </li>
              <li>
                <RuleNumber>1.1.3</RuleNumber>All eligible students competing as one entity
                regardless of geographic spread.
              </li>
              <li>
                <RuleNumber>1.1.4</RuleNumber>Further Education (FE) college offering HE
                qualifications through an external awarding body.
              </li>
              <li>
                <RuleNumber>1.1.5</RuleNumber>Umbrella campus or organisation comprised of students
                from multiple HE awarding bodies.
              </li>
            </RuleList>
            <p className="rulebook-note">A full list of recognised playing entities may be found in Appendix B.</p>
          </div>

          <div className="rulebook-subsection" id="eligibility-players">
            <div className="rulebook-subsection-title">
              <span>1.2</span>
              <h3>Player eligibility</h3>
            </div>
            <h4>1.2.1 · Eligible participants</h4>
            <p>To be eligible to compete, a student must:</p>
            <RuleList>
              <li><RuleNumber>1.2.1.1</RuleNumber>Be a registered student at an eligible HE institution.</li>
              <li><RuleNumber>1.2.1.2</RuleNumber>Be registered on a credit-rated course (for example MSc, Degree, or HND) under CATS.</li>
              <li>
                <RuleNumber>1.2.1.3</RuleNumber>Be studying at least 50% of a full-time course load
                (60 credits per year).
                <small><b>1.2.1.3.1</b> A year is defined as 12 months from the course start date.</small>
              </li>
              <li>
                <RuleNumber>1.2.1.4</RuleNumber>Be aged 18 or older.
                <small><b>1.2.1.4.1</b> Students at HE institutions in Scotland or Newfoundland and Labrador may compete from age 17.</small>
              </li>
              <li><RuleNumber>1.2.1.5</RuleNumber>Have a contactable Discord account.</li>
              <li><RuleNumber>1.2.1.6</RuleNumber>Use a non-offensive Discord display name, as determined by Nexus Admins.</li>
              <li><RuleNumber>1.2.1.7</RuleNumber>Use a non-offensive Nintendo online display name, as determined by Nexus Admins.</li>
              <li>
                <RuleNumber>1.2.1.8</RuleNumber>Not use display names promoting inappropriate
                sponsors or content, including:
                <div className="rulebook-tag-list" aria-label="Prohibited display name content">
                  <span>Gambling</span><span>Pornography</span><span>Alcohol</span>
                  <span>Tobacco or cigarettes</span><span>Firearms</span>
                </div>
              </li>
            </RuleList>

            <div className="rulebook-split">
              <div>
                <h4>1.2.2 · Ineligible participants</h4>
                <p>The following students are not eligible:</p>
                <RuleList>
                  <li><RuleNumber>1.2.2.1</RuleNumber>Externally registered students, unless permitted by institutional playing entity rules.</li>
                </RuleList>
              </div>
              <div>
                <h4>1.2.3 · Special cases</h4>
                <RuleList>
                  <li><RuleNumber>1.2.3.1</RuleNumber>Students completing their course after May remain eligible until the academic year ends.</li>
                  <li><RuleNumber>1.2.3.2</RuleNumber>Students on sandwich courses or year abroad programmes of less than one year.</li>
                  <li><RuleNumber>1.2.3.3</RuleNumber>Full-time PhD students classified as registered students.</li>
                </RuleList>
              </div>
            </div>

            <h4>1.2.4 · Institutional limitation</h4>
            <p>Students may not compete for more than one academic institution in the same academic year.</p>
          </div>

          <div className="rulebook-subsection" id="eligibility-teams">
            <div className="rulebook-subsection-title">
              <span>1.3</span>
              <h3>Team rules</h3>
            </div>
            <div className="rulebook-three-column">
              <div>
                <RiTeamFill aria-hidden="true" />
                <h4>Eligibility</h4>
                <RuleList>
                  <li><RuleNumber>1.3.1.1</RuleNumber>Each team must appoint a captain as the main contact point.</li>
                  <li><RuleNumber>1.3.1.2</RuleNumber>Teams must consist of at least four students.</li>
                  <li><RuleNumber>1.3.1.3</RuleNumber>All players must attend the same academic institution.</li>
                </RuleList>
              </div>
              <div>
                <RiContactsFill aria-hidden="true" />
                <h4>Substitutions</h4>
                <p>
                  <RuleNumber>1.3.2.1</RuleNumber> Teams may play any rostered players. If a school
                  wishes, it may request—before any game is played—to limit each team to only four
                  players per game. Teams may not deny this request, but it must be requested to be
                  enforced. Both teams must blindly announce their selected four players before the
                  game begins.
                </p>
              </div>
              <div>
                <RiForbidFill aria-hidden="true" />
                <h4>Team names</h4>
                <p>Offensive or inappropriate team names are prohibited and judged at Nexus Admin discretion.</p>
              </div>
            </div>
          </div>

          <div className="rulebook-checkin" id="eligibility-deadlines">
            <RiTimeFill aria-hidden="true" />
            <div>
              <span>1.4 · Match-day check-in</span>
              <h3>Deadlines</h3>
              <p>Be ready 10 minutes within scheduled match start time.</p>
            </div>
            <p>Teams that fail to check in will not be entered into matches or earn points.</p>
          </div>
        </section>

        <section className="rulebook-section" id="match-rules">
          <SectionHeading
            number="02"
            eyebrow="Competition format"
            title="Match Rules"
            description="The required arena configuration, crew battle flow, legal stages, and result procedures."
          />

          <div className="rulebook-subsection" id="match-settings">
            <div className="rulebook-subsection-title">
              <span>2.1</span>
              <h3>Lobby settings</h3>
            </div>
            <p>Games must use the following ruleset:</p>
            <dl className="rulebook-settings">
              {lobbySettings.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value === 'On' || value === 'Yes' ? <RiCheckFill aria-hidden="true" /> : null}{value}</dd>
                </div>
              ))}
            </dl>
            <div className="rulebook-warning">
              <RiErrorWarningFill aria-hidden="true" />
              <p>
                Both teams must verify settings before play. Incorrect settings require a reset and
                admin contact.
              </p>
            </div>
          </div>

          <div className="rulebook-subsection" id="match-procedure">
            <div className="rulebook-subsection-title">
              <span>2.2</span>
              <h3>Match procedure</h3>
            </div>
            <p>Matches follow the Nexus Crew Battle format:</p>
            <ol className="rulebook-procedure">
              <li><span>01</span><p>Players compete in <strong>1v1 battles.</strong></p></li>
              <li><span>02</span><p>Winning players carry their <strong>remaining stocks forward.</strong></p></li>
              <li><span>03</span><p>Losing players are <strong>eliminated.</strong></p></li>
              <li><span>04</span><p>Remaining stocks are adjusted by <strong>self-destructing</strong> before the next game.</p></li>
              <li><span>05</span><p>The match continues until one team has <strong>no players remaining.</strong></p></li>
            </ol>
            <p>
              While an opponent is self-destructing for stock-count purposes, neither player may
              take any consequential actions. If a character being used has automatic consequential
              effects while waiting, you must reset it (if possible).
            </p>
          </div>

          <div className="rulebook-subsection" id="match-stage-selection">
            <div className="rulebook-subsection-title">
              <span>2.3</span>
              <h3>Stage selection</h3>
            </div>
            <div className="rulebook-stage-graphic">
              <Image
                src="/Nexus_Stagelist_Graphic.png"
                alt="The Nexus starter and counterpick stage list"
                width={1065}
                height={283}
                sizes="(max-width: 1180px) calc(100vw - 5.4rem), 1065px"
              />
            </div>
            <div className="rulebook-selection-grid">
              <article>
                <span>Opening game</span>
                <h4>Strike 1 · Strike 2 · Select</h4>
                <p>
                  The team banning first strikes one starter stage—the first five stages above.
                  The second team then strikes two of the remaining legal starter stages, and the
                  first team selects from what remains.
                </p>
              </article>
              <article>
                <span>Following games</span>
                <h4>Declare · Strike 3 · Select</h4>
                <p>
                  The team that most recently had a player eliminated must declare its next player,
                  character, and Mii moveset if applicable. The player who was not eliminated can
                  strike up to three stages, and the incoming player selects any remaining legal
                  stage.
                </p>
              </article>
            </div>
          </div>

          <div className="rulebook-compact-grid">
            <article id="match-draws">
              <span>2.4</span>
              <h3>Draws</h3>
              <p>When a game ends in a draw, both players are eliminated and both teams blindly send their next player.</p>
              <p>If both teams have only one player remaining, replay final stocks on the same stage with one stock each.</p>
            </article>
            <article id="match-bugs">
              <span>2.5</span>
              <h3>Bugs & remakes</h3>
              <p>Competitive-impacting bugs are ruled on by Nexus Admins. Known game mechanics will not be counted as bugs.</p>
              <p>If a team disconnects from an active match because of connection issues, contact an admin if the teams cannot agree on a penalty.</p>
            </article>
            <article id="match-noshows">
              <span>2.6</span>
              <h3>No-shows</h3>
              <p>Teams must arrive promptly. Matches must begin within 10 minutes of the scheduled start or previous round end.</p>
              <p>A team unable to begin on time will be forced to forfeit the match.</p>
            </article>
            <article id="match-submission">
              <span>2.7</span>
              <h3>Submitting results</h3>
              <p>Both teams must submit results.</p>
            </article>
          </div>
        </section>

        <section className="rulebook-section" id="spectators">
          <SectionHeading
            number="03"
            eyebrow="Broadcast conduct"
            title="Spectator Rules"
            description="Streaming permissions and the additional requirements that apply to featured matches."
          />
          <div className="rulebook-versus-cards">
            <article id="spectators-featured">
              <span>On broadcast</span>
              <h3>Featured matches</h3>
              <RuleList>
                <li>Admins must be able to access pre-game lobbies.</li>
                <li>Games start only when admins approve.</li>
                <li>Third-party streaming may be restricted.</li>
              </RuleList>
            </article>
            <div aria-hidden="true">VS</div>
            <article id="spectators-non-featured">
              <span>Player perspective</span>
              <h3>Non-featured matches</h3>
              <RuleList>
                <li>Players may stream from their own perspective.</li>
                <li>Third-party streams are allowed by mutual agreement.</li>
              </RuleList>
            </article>
          </div>
        </section>

        <section className="rulebook-section" id="sportsmanship">
          <SectionHeading
            number="04"
            eyebrow="Competitive integrity"
            title="Sportsmanship"
            description="Every participant is responsible for preserving fair play and a welcoming league."
          />
          <div className="rulebook-conduct" id="sportsmanship-integrity">
            <div>
              <RiShieldCheckFill aria-hidden="true" />
              <h3>Play the right way</h3>
              <p>Players must uphold fair play and the Code of Conduct. Unfair play includes:</p>
            </div>
            <RuleList>
              <li>Hacking or modifying the game.</li>
              <li>Exploiting bugs.</li>
              <li>Account sharing or use of ineligible players.</li>
              <li>Collusion or intentional losing.</li>
            </RuleList>
          </div>
          <div className="rulebook-zero-tolerance">
            <strong>Zero tolerance</strong>
            <p>Harassment, discriminatory language, threats, or trolling are prohibited. Penalties may include <b>warnings</b>, <b>forfeits</b>, <b>suspensions</b>, <b>bans</b>, or <b>disqualification</b>.</p>
          </div>
        </section>

        <section className="rulebook-section" id="live-events">
          <SectionHeading
            number="05"
            eyebrow="In-person competition"
            title="Live Event Rules"
            description="Live-event provisions for The Nexus."
          />
          <div className="rulebook-empty-provision" id="live-events-provisions">
            <RiListCheck aria-hidden="true" />
            <div>
              <h3>No additional provisions listed</h3>
              <p>
                The supplied rulebook includes Live Event Rules in its contents but
                provides no separate live-event clauses. All other eligibility, match, spectator,
                and sportsmanship rules remain in effect.
              </p>
            </div>
          </div>
        </section>

        <section className="rulebook-section" id="prizes">
          <SectionHeading
            number="06"
            eyebrow="Awards"
            title="Prizes"
            description="How awards are delivered and shared by participating rosters."
          />
          <div className="rulebook-prize-card" id="prizes-distribution">
            <RiTrophyFill aria-hidden="true" />
            <div>
              <span>Distribution path</span>
              <h3>Captain → Roster</h3>
            </div>
            <RuleList>
              <li>Prizes are sent to team captains.</li>
              <li>Captains distribute prizes among roster.</li>
            </RuleList>
          </div>
        </section>

        <section className="rulebook-section" id="enforcement">
          <SectionHeading
            number="07"
            eyebrow="Final rulings"
            title="Enforcement of the Rules"
            description="When teams cannot resolve an issue together, Nexus Admins can protect the integrity of play."
          />
          <div className="rulebook-enforcement">
            <article id="enforcement-escalate">
              <span>01</span>
              <h3>Escalate</h3>
              <p>Disputes unresolved between teams must be escalated to Nexus Admins.</p>
            </article>
            <article id="enforcement-respect">
              <span>02</span>
              <h3>Respect the ruling</h3>
              <p>Admin decisions are final.</p>
            </article>
            <article id="enforcement-protect">
              <span>03</span>
              <h3>Protect competition</h3>
              <p>Rules may be amended to preserve competitive integrity.</p>
            </article>
          </div>
        </section>

        <section className="rulebook-appendix" id="appendix-b">
          <span>Appendix B</span>
          <div>
            <h2>Playing Entities</h2>
            <p>
              A full list of recognised playing entities is included as provided by The Nexus.
              See the full institution list as supplied.
            </p>
          </div>
        </section>
      </main>

      <footer className="rulebook-page-footer">
        <p>Official SSBU rules · Nexus Teams</p>
        <a href="#rulebook-top">Back to top <RiArrowUpFill aria-hidden="true" /></a>
      </footer>

      <FloatingTOC items={tocItems} />
    </div>
  );
}
