import Image from 'next/image';
import Link from 'next/link';
import { RiTwitterXFill, RiYoutubeFill, RiDiscordFill, RiMailFill } from '@remixicon/react';

const leagueLinks = [
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Standings', href: '/standings' },
  { label: 'Matches', href: '/matches' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Stats', href: '/stats' },
  { label: 'Rulebook', href: '/rulebook' },
];

const connectLinks = [
  { label: 'Twitter / X', href: 'https://x.com/TheNexusLeague', external: true, Icon: RiTwitterXFill },
  { label: 'Youtube', href: 'https://www.youtube.com/@TheNexus-gg', external: true, Icon: RiYoutubeFill },
  { label: 'Discord', href: 'https://discord.thenexus.gg/', external: true, Icon: RiDiscordFill },
  { label: 'Contact Us', href: 'mailto:connect@thenexus.gg', external: true, Icon: RiMailFill },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-container">
        {/* Background Image */}
        <div className="site-footer-bg" aria-hidden="true">
          <Image 
            src="/logos/B&W/SVG/Solid Currant.svg" 
            alt="" 
            fill 
            style={{ objectFit: 'contain', objectPosition: 'right center', opacity: 0.05 }} 
          />
        </div>

        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <Image
              src="/logos/Primary/SVG/The Nexus Logotype Currant.svg"
              width={220}
              height={64}
              alt="The Nexus"
              loading="eager"
              style={{ width: '220px', height: 'auto' }}
            />
            <p>The premier collegiate Super Smash Bros. league built by the community.</p>
            <div className="site-footer-bottom">
              <p>© 2026 The Nexus League LLC. All rights reserved.</p>
              <div className="site-footer-legal">
                <Link href="/privacy">Privacy Policy</Link>
              </div>
            </div>
          </div>

          <div className="site-footer-navs">
            <nav className="site-footer-nav" aria-label="League links">
              <h2>League</h2>
              <ul>
                {leagueLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav className="site-footer-nav" aria-label="Connect links">
              <h2>Connect</h2>
              <ul>
                {connectLinks.map(({ label, href, external, Icon }) => (
                  <li key={label}>
                    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
                      <Icon size={18} className="footer-icon" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

      </div>
    </footer>
  );
}
