import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tournaments & Seasons',
  description:
    'Explore upcoming and past tournaments, seasons, and competitive brackets in The Nexus collegiate crew battle league.',
  openGraph: {
    title: 'Tournaments & Seasons | The Nexus',
    description:
      'Explore upcoming and past tournaments, seasons, and competitive brackets in The Nexus collegiate crew battle league.',
    url: '/tournaments'
  },
  twitter: {
    title: 'Tournaments & Seasons | The Nexus',
    description:
      'Explore upcoming and past tournaments, seasons, and competitive brackets in The Nexus collegiate crew battle league.'
  }
};

export default function TournamentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
