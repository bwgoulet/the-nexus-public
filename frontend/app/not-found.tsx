import Link from 'next/link';
import {
  RiHome4Fill,
  RiDashboardFill,
  RiSwordFill,
  RiCalendarFill,
  RiBarChart2Fill,
  RiFileList3Fill,
  RiArrowRightLine
} from '@remixicon/react';

export default function NotFound() {
  const quickLinks = [
    {
      title: 'Matches',
      description: 'Stream schedule, live matches, and crew battle results.',
      href: '/matches',
      icon: RiSwordFill
    },
    {
      title: 'Schedule',
      description: 'Official season calendar and upcoming match night dates.',
      href: '/schedule',
      icon: RiCalendarFill
    },
    {
      title: 'League Stats',
      description: 'Player rankings, team records, and analytics.',
      href: '/stats',
      icon: RiBarChart2Fill
    },
    {
      title: 'Rulebook',
      description: 'Crew rules, lobby settings, and stage lists.',
      href: '/rulebook',
      icon: RiFileList3Fill
    }
  ];

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>

        <p className="not-found-desc">
          The page you are looking for doesn&apos;t exist.
        </p>

        <div className="not-found-actions">
          <Link href="/" className="btn btn-primary">
            <RiHome4Fill size={18} aria-hidden="true" />
            Return Home
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            <RiDashboardFill size={18} aria-hidden="true" />
            View Dashboard
          </Link>
        </div>

        <div className="not-found-grid" aria-label="Suggested pages">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="not-found-card">
                <div className="not-found-card-icon">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3>
                  <span>{item.title}</span>
                  <RiArrowRightLine size={16} aria-hidden="true" />
                </h3>
                <p>{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
