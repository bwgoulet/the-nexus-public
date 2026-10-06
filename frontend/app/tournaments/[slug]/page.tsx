import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  RiArrowLeftLine,
  RiArrowRightFill,
  RiCalendarFill,
  RiGroupFill,
  RiSwordFill,
  RiTrophyFill
} from '@remixicon/react';
import { DoubleEliminationBracket, RoundRobinBracket } from '@/app/components/competition-brackets';
import { getCompetitionBySlug } from '@/lib/data';

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    return {
      title: 'Tournament & Bracket',
      description: 'Collegiate tournament bracket on The Nexus.'
    };
  }

  const bracketLabel = competition.bracket_type === 'round_robin' ? 'Round Robin' : 'Double Elimination';
  const description = `${competition.name} • ${bracketLabel} • ${competition.teams.length} teams registered • Registration ${competition.registration_status}.`;

  return {
    title: `${competition.name} — Brackets`,
    description,
    openGraph: {
      title: `${competition.name} — Brackets | The Nexus`,
      description,
      url: `/tournaments/${slug}`
    },
    twitter: {
      title: `${competition.name} — Brackets | The Nexus`,
      description
    }
  };
}

export default async function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const isRoundRobin = competition.bracket_type === 'round_robin';

  return (
    <main className="competition-detail-page">
      <header className="competition-detail-hero">
        <Link href="/tournaments" className="competition-back-link">
          <RiArrowLeftLine size={16} aria-hidden="true" />
          <span>All Competitions</span>
        </Link>

        <div className="kicker competition-hero-kicker">
          <span />
          {competition.competition_type} · Registration {competition.registration_status}
        </div>

        <h1 className="competition-hero-title">{competition.name}</h1>

        <div className="competition-hero-meta">
          <span className="competition-meta-chip">
            <RiGroupFill size={16} aria-hidden="true" />
            <strong>{competition.teams.length}</strong> Registered Teams
          </span>
          <span className="competition-meta-chip">
            {isRoundRobin ? (
              <RiSwordFill size={16} aria-hidden="true" />
            ) : (
              <RiTrophyFill size={16} aria-hidden="true" />
            )}
            {isRoundRobin ? 'Round Robin' : 'Double Elimination'}
          </span>
          {competition.weeks ? (
            <span className="competition-meta-chip">
              <RiCalendarFill size={16} aria-hidden="true" />
              <strong>{competition.weeks}</strong> Weeks
            </span>
          ) : null}
          <span className={`competition-status-badge is-${competition.registration_status}`}>
            Registration {competition.registration_status}
          </span>
        </div>
      </header>

      <div className="competition-detail-content">
        <section className="competition-seeds-section" aria-labelledby="competition-field-heading">
          <div className="matches-section-heading">
            <h2 id="competition-field-heading">Registered Teams</h2>
          </div>

          {competition.teams.length > 0 ? (
            <div className="competition-seeds-grid">
              {competition.teams.map((team, index) => {
                const seedNumber = team.seed ?? index + 1;
                return (
                  <Link
                    key={team.id}
                    href={`/stats/teams/${team.short_name.toLowerCase()}`}
                    className="competition-team-card"
                    title={`View ${team.name} profile & stats`}
                  >
                    <div className="competition-team-seed">#{seedNumber}</div>
                    <div className="competition-team-avatar">
                      {team.avatar ? (
                        <Image
                          src={team.avatar}
                          alt=""
                          width={38}
                          height={38}
                          className="competition-avatar-img"
                        />
                      ) : (
                        <span className="competition-avatar-placeholder">
                          {team.short_name.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="competition-team-info">
                      <strong>{team.short_name}</strong>
                      <small>{team.name}</small>
                    </div>
                    <RiArrowRightFill className="competition-team-arrow" size={16} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="competition-empty-state">
              <RiGroupFill size={28} aria-hidden="true" />
              <div>
                <strong>No Teams Seeded Yet</strong>
                <p>Seeds will be established once team registration concludes.</p>
              </div>
            </div>
          )}
        </section>

        <section className="competition-bracket-section" aria-labelledby="competition-bracket-heading">
          <div className="matches-section-heading">
            <h2 id="competition-bracket-heading">Competition Overview</h2>
          </div>

          {isRoundRobin ? (
            competition.matches.length || competition.matchups.length ? (
              <RoundRobinBracket
                matches={competition.matches}
                matchups={competition.matchups}
                weeks={competition.weeks}
              />
            ) : (
              <div className="competition-empty-state">
                <RiTrophyFill size={28} aria-hidden="true" />
                <div>
                  <strong>No Matchups Scheduled Yet</strong>
                  <p>Matchups will appear here as the weekly schedule is generated.</p>
                </div>
              </div>
            )
          ) : (
            <DoubleEliminationBracket matches={competition.matches} teams={competition.teams} />
          )}
        </section>
      </div>
    </main>
  );
}
