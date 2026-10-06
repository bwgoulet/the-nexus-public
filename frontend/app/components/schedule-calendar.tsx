'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  RiArrowRightFill,
  RiCalendarFill,
  RiArrowLeftSFill,
  RiArrowRightSFill,
  RiTimeFill,
  RiBroadcastFill
} from '@remixicon/react';
import type { ScheduleMatchEntry } from '@/lib/data';
import { formatMatchScoreValue } from '@/lib/scores';

const EASTERN_TIME_ZONE = 'America/New_York';
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dateKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

const monthKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit'
  }).format(date);

const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(
    new Date(Date.UTC(year, month, 1))
  );

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(iso));

const longDateLabel = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

const statusLabel = {
  upcoming: 'Upcoming',
  live: 'Live now',
  completed: 'Final'
} as const;

export function ScheduleCalendar({ matches }: { matches: ScheduleMatchEntry[] }) {
  const todayKey = dateKey(new Date());
  const initialMatch =
    matches.find(({ match }) => match.status === 'live') ??
    matches.find(({ match }) => match.status === 'upcoming' && dateKey(new Date(match.date)) >= todayKey) ??
    matches.at(-1);
  const initialDate = initialMatch ? new Date(initialMatch.match.date) : new Date();
  const initialParts = monthKey(initialDate).split('-').map(Number);
  const [visibleMonth, setVisibleMonth] = useState({ year: initialParts[0], month: initialParts[1] - 1 });
  const [selectedDate, setSelectedDate] = useState(initialMatch ? dateKey(initialDate) : todayKey);

  const matchesByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleMatchEntry[]>();
    matches.forEach((entry) => {
      const key = dateKey(new Date(entry.match.date));
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    });
    grouped.forEach((entries) =>
      entries.sort((a, b) => new Date(a.match.date).getTime() - new Date(b.match.date).getTime())
    );
    return grouped;
  }, [matches]);

  const days = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + 1, 0)).getUTCDate();
    const previousMonthDays = new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 0)).getUTCDate();

    return Array.from({ length: 42 }, (_, index) => {
      const relativeDay = index - firstWeekday + 1;
      let day = relativeDay;
      let monthOffset = 0;
      if (relativeDay <= 0) {
        day = previousMonthDays + relativeDay;
        monthOffset = -1;
      } else if (relativeDay > daysInMonth) {
        day = relativeDay - daysInMonth;
        monthOffset = 1;
      }
      const calendarDate = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + monthOffset, day));
      return {
        day,
        key: calendarDate.toISOString().slice(0, 10),
        isCurrentMonth: monthOffset === 0
      };
    });
  }, [visibleMonth]);

  const selectedMatches = matchesByDate.get(selectedDate) ?? [];

  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + offset, 1));
    setVisibleMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  const returnToToday = () => {
    const [year, month] = todayKey.split('-').map(Number);
    setVisibleMonth({ year, month: month - 1 });
    setSelectedDate(todayKey);
  };

  return (
    <div className="schedule-calendar-shell">
      <div className="schedule-calendar-panel">
        <div className="schedule-calendar-toolbar">
          <div>
            <span className="schedule-calendar-overline">Viewing</span>
            <h3>{monthLabel(visibleMonth.year, visibleMonth.month)}</h3>
          </div>
          <div className="schedule-calendar-actions">
            <button type="button" onClick={returnToToday}>Today</button>
            <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>
              <RiArrowLeftSFill aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>
              <RiArrowRightSFill aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="schedule-calendar-legend" aria-label="Match status legend">
          <span><i className="is-live" /> Live</span>
          <span><i className="is-upcoming" /> Upcoming</span>
          <span><i className="is-completed" /> Completed</span>
        </div>
        <div className="schedule-weekdays" aria-hidden="true">
          {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="schedule-calendar-grid">
          {days.map((day) => {
            const dayMatches = matchesByDate.get(day.key) ?? [];
            const statuses = Array.from(new Set(dayMatches.map(({ match }) => match.status)));
            return (
              <button
                className={[
                  'schedule-calendar-day',
                  day.isCurrentMonth ? '' : 'is-outside',
                  day.key === todayKey ? 'is-today' : '',
                  day.key === selectedDate ? 'is-selected' : '',
                  dayMatches.length ? 'has-matches' : ''
                ].filter(Boolean).join(' ')}
                type="button"
                key={day.key}
                onClick={() => {
                  setSelectedDate(day.key);
                  if (!day.isCurrentMonth) {
                    const [year, month] = day.key.split('-').map(Number);
                    setVisibleMonth({ year, month: month - 1 });
                  }
                }}
                aria-label={`${longDateLabel(day.key)}${dayMatches.length ? `, ${dayMatches.length} match${dayMatches.length === 1 ? '' : 'es'}` : ''}`}
              >
                <span className="schedule-day-number">{day.day}</span>
                {dayMatches.length ? (
                  <>
                    <span className="schedule-day-match-count">
                      {dayMatches.length} {dayMatches.length === 1 ? 'match' : 'matches'}
                    </span>
                    <span className="schedule-day-dots" aria-hidden="true">
                      {statuses.map((status) => <i className={`is-${status}`} key={status} />)}
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="schedule-agenda" aria-live="polite">
        <div className="schedule-agenda-heading">
          <span>Selected date</span>
          <h3>{longDateLabel(selectedDate)}</h3>
          <p>{selectedMatches.length} scheduled {selectedMatches.length === 1 ? 'match' : 'matches'}</p>
        </div>
        <div className="schedule-agenda-list">
          {selectedMatches.length ? selectedMatches.map(({ match, homeTeam, awayTeam, tournamentSeason }) => (
            <Link className={`schedule-match-card is-${match.status}`} href={`/matches/${match.slug}`} key={match.id}>
              <div className="schedule-match-card-topline">
                <span className="schedule-match-status">
                  {match.status === 'live' ? <RiBroadcastFill aria-hidden="true" /> : <i />}
                  {statusLabel[match.status]}
                </span>
                <span className="schedule-match-time"><RiTimeFill aria-hidden="true" />{timeLabel(match.date)}</span>
              </div>
              <p className="schedule-match-season">{tournamentSeason?.name ?? 'The Nexus'}</p>
              <div className="schedule-match-teams">
                <div>
                  {homeTeam?.avatar ? <Image src={homeTeam.avatar} width={36} height={36} alt="" /> : <span>{homeTeam?.short_name?.slice(0, 2) ?? 'H'}</span>}
                  <strong>{homeTeam?.name ?? 'Home team'}</strong>
                </div>
                <b>
                  {match.status === 'completed' ? (
                    <><em>{formatMatchScoreValue(match.home_score)}</em><small>—</small><em>{formatMatchScoreValue(match.away_score)}</em></>
                  ) : 'VS'}
                </b>
                <div>
                  {awayTeam?.avatar ? <Image src={awayTeam.avatar} width={36} height={36} alt="" /> : <span>{awayTeam?.short_name?.slice(0, 2) ?? 'A'}</span>}
                  <strong>{awayTeam?.name ?? 'Away team'}</strong>
                </div>
              </div>
              <div className="schedule-match-link">
                {match.status === 'completed' ? 'View result' : match.status === 'live' ? 'Enter live match' : 'Match details'}
                <RiArrowRightFill aria-hidden="true" />
              </div>
            </Link>
          )) : (
            <div className="schedule-agenda-empty">
              <RiCalendarFill aria-hidden="true" />
              <strong>No matches this day</strong>
              <p>Choose a highlighted date or use the arrows to explore another month.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
