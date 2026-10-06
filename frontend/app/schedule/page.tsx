export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { RiCalendarFill, RiBroadcastFill, RiTrophyFill } from '@remixicon/react';
import { ScheduleCalendar } from '@/app/components/schedule-calendar';
import { getScheduleMatchEntries } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Match Schedule',
  description: 'Explore past, live, and upcoming Nexus crew battles on the official league calendar.',
  openGraph: {
    title: 'Match Schedule | The Nexus',
    description: 'Explore past, live, and upcoming Nexus crew battles on the official league calendar.',
    url: '/schedule'
  },
  twitter: {
    title: 'Match Schedule | The Nexus',
    description: 'Explore past, live, and upcoming Nexus crew battles on the official league calendar.'
  }
};

export default async function SchedulePage() {
  const matches = await getScheduleMatchEntries();
  const upcomingCount = matches.filter(({ match }) => match.status === 'upcoming').length;
  const liveCount = matches.filter(({ match }) => match.status === 'live').length;
  const completedCount = matches.filter(({ match }) => match.status === 'completed').length;

  return (
    <div className="schedule-page">
      <section className="schedule-hero">
        <div className="schedule-hero-grid" aria-hidden="true" />
        <div className="schedule-hero-copy">
          <div className="kicker">
            <span />
            The season at a glance
          </div>
          <h1>
            Match
            <span>Schedule</span>
          </h1>
        </div>
        <div className="schedule-hero-stats" aria-label="Schedule summary">
          <div>
            <RiCalendarFill aria-hidden="true" />
            <span>Upcoming</span>
            <strong>{String(upcomingCount).padStart(2, '0')}</strong>
          </div>
          <div className="is-live">
            <RiBroadcastFill aria-hidden="true" />
            <span>Live now</span>
            <strong>{String(liveCount).padStart(2, '0')}</strong>
          </div>
          <div>
            <RiTrophyFill aria-hidden="true" />
            <span>Completed</span>
            <strong>{String(completedCount).padStart(2, '0')}</strong>
          </div>
        </div>
      </section>

      <section className="schedule-calendar-section" aria-labelledby="schedule-calendar-title">
        <header className="schedule-section-heading">
          <div>
            <span className="kicker">Season calendar</span>
            <h2 id="schedule-calendar-title">Find your next match night.</h2>
          </div>
          <p>
            Select any highlighted day to see its matches. Dates and times are shown in Eastern
            Time.
          </p>
        </header>
        <ScheduleCalendar matches={matches} />
      </section>
    </div>
  );
}
