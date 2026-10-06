import type { Metadata, Viewport } from 'next';
import BackgroundLayer from './background-layer';
import './globals.css';
import OAuthRedirectHandler from './oauth-redirect-handler';
import SiteFooter from './components/site-footer';
import { TopNav } from './components/top-nav';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thenexus.gg';

export const viewport: Viewport = {
  themeColor: '#50c878',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'The Nexus | Collegiate Crew Battle League',
    template: '%s | The Nexus'
  },
  description:
    'The premier collegiate crew battle circuit. Track live match rooms, schedules, standings, player stats, and brackets.',
  applicationName: 'The Nexus',
  icons: {
    icon: '/logos/Primary/SVG/Nexus Emerald Black.svg',
    apple: '/logos/Primary/PNG/Nexus Emerald Big.png'
  },
  openGraph: {
    type: 'website',
    siteName: 'The Nexus',
    title: 'The Nexus | Collegiate Crew Battle League',
    description:
      'The premier collegiate crew battle circuit. Track live match rooms, schedules, standings, player stats, and brackets.',
    url: siteUrl,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'The Nexus — Collegiate Crew Battle League'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    site: '@TheNexusLeague',
    creator: '@TheNexusLeague',
    title: 'The Nexus | Collegiate Crew Battle League',
    description:
      'The premier collegiate crew battle circuit. Track live match rooms, schedules, standings, player stats, and brackets.',
    images: ['/og-image.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <OAuthRedirectHandler />
        <BackgroundLayer />
        <div className="app-shell">
          <TopNav />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
