'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RiInformationFill } from '@remixicon/react';
import { NavLinks } from './nav-links';

export function TopNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  const isLiveMatchRoom = /^\/matches\/[^/]+\/live(?:\/|$)/.test(pathname);
  const shouldHideNav = pathname === '/onboarding' || isLiveMatchRoom;

  useEffect(() => {
    if (shouldHideNav) return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, [shouldHideNav]);

  if (shouldHideNav) return null;

  return (
    <header
      className={`top-nav ${isLiveMatchRoom ? 'is-live-match-nav' : ''} ${isScrolled && !isLiveMatchRoom ? 'is-scrolled' : ''}`}
    >
      <div className="top-nav-inner">
        <div className="top-nav-left">
          <Link href="/" className="top-nav-brand">
            <Image
              src={isScrolled ? "/logos/B&W/SVG/Solid Currant.svg" : "/logos/B&W/SVG/Solid White.svg"}
              width={36}
              height={36}
              alt="The Nexus"
              priority
              style={{ width: '36px', height: '36px' }}
            />
          </Link>
          <Link
            href="/about"
            className={`nav-item-link ${pathname === '/about' ? 'is-active' : ''}`}
          >
            <RiInformationFill size={20} className="nav-icon" />
            ABOUT
          </Link>
        </div>
        <NavLinks />
      </div>
    </header>
  );
}
