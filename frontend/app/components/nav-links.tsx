'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import {
  RiAdminFill,
  RiDashboardFill,
  RiTrophyFill,
  RiMedalFill,
  RiSwordFill,
  RiCalendarFill,
  RiBarChart2Fill,
  RiFileList3Fill,
  RiTeamFill,
  RiMenuFill,
  RiCloseFill,
  RiArrowDownSLine,
  RiInformationFill,
  RiSettings3Fill,
  RiLogoutBoxFill
} from '@remixicon/react';

type NavItem = readonly [string, string, React.ElementType?];

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    tag?: string;
    role?: UserRole;
  };
};

type UserRole = 'director' | 'player' | 'mod';

const leagueNavItems: readonly NavItem[] = [
  ['/tournaments', 'Tournaments', RiTeamFill],
  ['/standings', 'Standings', RiMedalFill],
  ['/matches', 'Matches', RiSwordFill],
  ['/schedule', 'Schedule', RiCalendarFill],
  ['/stats', 'Stats', RiBarChart2Fill],
  ['/rulebook', 'Rulebook', RiFileList3Fill]
] as const;

const modNavItems: readonly NavItem[] = [['/admin', 'Admin', RiAdminFill]] as const;
const PROFILE_CACHE_WINDOW_MS = 60_000;

const isLiveMatchPath = (pathname: string) => /^\/matches\/[^/]+\/live(?:\/|$)/.test(pathname);

const getAvatarLabel = (user: AuthUser | null) => {
  if (!user) return '?';

  const fullName = user.user_metadata?.full_name?.trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
  }

  const tag = user.user_metadata?.tag?.trim();
  if (tag) {
    return tag[0]?.toUpperCase() ?? '?';
  }

  const email = user.email?.trim();
  return email?.[0]?.toUpperCase() ?? '?';
};

export function NavLinks() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const leagueMenuRef = useRef<HTMLDivElement>(null);
  const isLiveMatchRoom = isLiveMatchPath(pathname);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;
    let profileRequest: Promise<void> | null = null;
    let retryTimer: number | null = null;
    let lastProfileLoad: { userId: string; loadedAt: number } | null = null;

    const loadUserProfile = (userId: string, attempt = 0, force = false): Promise<void> => {
      const hasFreshProfile =
        lastProfileLoad?.userId === userId &&
        Date.now() - lastProfileLoad.loadedAt < PROFILE_CACHE_WINDOW_MS;
      if ((!force && hasFreshProfile) || profileRequest) {
        return profileRequest ?? Promise.resolve();
      }

      profileRequest = (async () => {
        const { data: profile, error } = await supabase
          .from('users')
          .select('role,avatar')
          .eq('id', userId)
          .maybeSingle<{ role: UserRole | null; avatar: string | null }>();
        if (!isMounted) return;

        if (!error) {
          // A successful empty or nullable profile is still a completed read.
          // Retrying it competes with the live room's realtime traffic without
          // producing a different result.
          lastProfileLoad = { userId, loadedAt: Date.now() };
          if (profile?.role) setUserRole(profile.role);
          setUserAvatar(profile?.avatar ?? null);
          return;
        }

        // The live operations room favors its match traffic over decorative
        // navbar recovery. Other routes retain the bounded retry behavior.
        if (!isLiveMatchRoom && attempt < 5) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            if (isMounted) void loadUserProfile(userId, attempt + 1, true);
          }, 300 * (attempt + 1));
        }
      })().finally(() => {
        profileRequest = null;
      });

      return profileRequest;
    };

    const syncSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (isMounted) {
        const nextUser = (session?.user as AuthUser) ?? null;
        setUser(nextUser);

        if (nextUser?.id) {
          if (nextUser.user_metadata?.role === 'mod') {
            setUserRole('mod');
          }
          void loadUserProfile(nextUser.id);
        } else {
          setUserRole(null);
          setUserAvatar(null);
        }
      }
    };

    void syncSession();

    const reloadProfile = async () => {
      if (!isMounted) return;
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const activeUserId = session?.user?.id;
      if (activeUserId) {
        void loadUserProfile(activeUserId);
      }
    };

    const handleWindowFocus = () => {
      void reloadProfile();
    };

    if (!isLiveMatchRoom) {
      window.addEventListener('focus', handleWindowFocus);
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = (session?.user as AuthUser) ?? null;
      setUser(nextUser);
      setMenuOpen(false);
      setLeagueMenuOpen(false);
      setMobileMenuOpen(false);

      if (nextUser?.id) {
        void loadUserProfile(nextUser.id);
      } else {
        setUserRole(null);
        setUserAvatar(null);
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleWindowFocus);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      subscription.unsubscribe();
    };
  }, [isLiveMatchRoom, supabase]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (!leagueMenuRef.current?.contains(event.target as Node)) {
        setLeagueMenuOpen(false);
      }
    };

    if (menuOpen || leagueMenuOpen) {
      document.addEventListener('mousedown', closeOnOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [leagueMenuOpen, menuOpen]);

  const avatarLabel = useMemo(() => getAvatarLabel(user), [user]);
  const modItems = useMemo(() => (userRole === 'mod' ? modNavItems : []), [userRole]);

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/login');
  };

  return (
    <>
      <button 
        className="mobile-menu-toggle" 
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle navigation menu"
      >
        {mobileMenuOpen ? <RiCloseFill size={28} /> : <RiMenuFill size={28} />}
      </button>

      <div className={`nav-controls ${mobileMenuOpen ? 'is-open' : ''}`}>
        <nav className="nav-links">
          <Link href="/about" className={`nav-item-link mobile-only-nav-link ${pathname === '/about' ? 'is-active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <RiInformationFill size={20} className="nav-icon" />
            ABOUT
          </Link>
          {modItems.map(([href, label, Icon]) => {
            const isActive = pathname === href || (href === '/tournaments' && pathname.startsWith('/tournaments/'));
            return (
              <Link key={href} href={href} className={`nav-item-link ${isActive ? 'is-active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                {Icon && <Icon size={20} className="nav-icon" />}
                {label}
              </Link>
            );
          })}
          <Link href="/dashboard" className={`nav-item-link ${pathname === '/dashboard' ? 'is-active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <RiDashboardFill size={20} className="nav-icon" />
            Dashboard
          </Link>
          <div 
            className="league-dropdown" 
            ref={leagueMenuRef}
          >
            <button
              type="button"
              className={`league-trigger nav-item-link ${leagueNavItems.some(([path]) => pathname === path || (path === '/tournaments' && pathname.startsWith('/tournaments/'))) ? 'is-active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={leagueMenuOpen}
              onClick={() => setLeagueMenuOpen((open) => !open)}
            >
              <RiTrophyFill size={20} className="nav-icon" />
              League <RiArrowDownSLine size={16} className={`dropdown-arrow ${leagueMenuOpen ? 'is-open' : ''}`} />
            </button>
            {leagueMenuOpen ? (
              <div className="league-menu" role="menu">
                {leagueNavItems.map(([href, label, Icon]) => {
                  const isActive = pathname === href || (href === '/tournaments' && pathname.startsWith('/tournaments/'));
                  return (
                    <Link key={href} href={href} className={isActive ? 'is-active' : ''} role="menuitem" onClick={() => { setLeagueMenuOpen(false); setMobileMenuOpen(false); }}>
                      {Icon && <Icon size={18} className="nav-sub-icon" />}
                      {label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </nav>

        {user ? (
          <div 
            className="nav-profile" 
            ref={menuRef}
          >
            <button
              type="button"
              className="avatar-button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open account menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Your avatar" className="avatar-button-image" />
              ) : (
                <span>{avatarLabel}</span>
              )}
            </button>
            {menuOpen ? (
              <div className="avatar-menu" role="menu">
                <Link href="/settings" role="menuitem" onClick={() => { setMenuOpen(false); setMobileMenuOpen(false); }}>
                  <RiSettings3Fill size={18} className="nav-sub-icon" />
                  SETTINGS
                </Link>
                <button type="button" role="menuitem" onClick={handleSignOut}>
                  <RiLogoutBoxFill size={18} className="nav-sub-icon" />
                  SIGN OUT
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link href="/signup" className="login-cta" onClick={() => setMobileMenuOpen(false)}>
            LOG IN
          </Link>
        )}
      </div>
    </>
  );
}
