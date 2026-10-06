'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiAdminFill,
  RiSwordFill,
  RiBuilding4Fill,
  RiGalleryFill,
  RiUserAddFill,
  RiEditBoxFill,
  RiEdit2Fill,
  RiUserSettingsFill,
  RiUserSharedFill,
  RiTeamFill
} from '@remixicon/react';
import { RouteLoader } from '@/app/components/route-loader';
import { getSupabaseClient } from '@/lib/supabase';

type UserRole = 'director' | 'player' | 'mod';

type AdminCard = {
  title: string;
  href: string;
  icon: React.ElementType;
};

type AdminCategory = {
  title: string;
  cards: AdminCard[];
};

const adminCategories: AdminCategory[] = [
  {
    title: 'Tournaments & Seasons',
    cards: [
      { title: 'Add Tournament/Season', href: '/admin/tournaments', icon: RiSwordFill },
    ]
  },
  {
    title: 'Match Operations',
    cards: [
      { title: 'Add Match', href: '/admin/add-match', icon: RiSwordFill },
      { title: 'Update Match', href: '/admin/update-match', icon: RiEditBoxFill }
    ]
  },
  {
    title: 'Teams & Rosters',
    cards: [
      { title: 'Add Team', href: '/admin/create-team', icon: RiBuilding4Fill },
      { title: 'Update Team', href: '/admin/update-team', icon: RiEdit2Fill },
      { title: 'Reassign Director', href: '/admin/reassign-director', icon: RiTeamFill },
      { title: 'Add Player', href: '/create-player', icon: RiUserAddFill }
    ]
  },
  {
    title: 'Administration & Media',
    cards: [
      { title: 'Add Graphics', href: '/admin/add-graphics', icon: RiGalleryFill },
      { title: 'Update User', href: '/admin/update-user', icon: RiUserSettingsFill },
      { title: 'Impersonate', href: '/admin/impersonate', icon: RiUserSharedFill }
    ]
  }
];

export default function AdminPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    const verifyRole = async (attempt = 0) => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/signup');
        return;
      }

      const { data: profile, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle<{ role: UserRole }>();

      if (!isMounted) return;

      if (error || !profile) {
        if (attempt >= 5) {
          setIsChecking(false);
          return;
        }

        setIsChecking(true);
        window.setTimeout(() => {
          if (isMounted) {
            void verifyRole(attempt + 1);
          }
        }, 400 * (attempt + 1));
        return;
      }

      const canAccess = profile.role === 'mod';
      setIsAuthorized(canAccess);
      setIsChecking(false);

      if (!canAccess) {
        router.replace('/dashboard');
      }
    };

    void verifyRole();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  if (isChecking) {
    return <RouteLoader label="Verifying moderator access..." />;
  }

  if (!isAuthorized) return null;

  return (
    <div className="admin-page">
      <header className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="dashboard-section-heading" style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem' }}>
          <RiAdminFill size={28} />
          <div>
            <span>MODERATOR PORTAL</span>
            <h2>CONTROL CENTER</h2>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>
          Manage match operations, team setups, graphics repositories, and user administration.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {adminCategories.map((category) => (
          <section key={category.title}>
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--nexus-emerald)',
                marginBottom: '0.85rem'
              }}
            >
              {category.title}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {category.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="dashboard-panel"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      padding: '1.15rem 1.25rem'
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        flexShrink: 0,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(80, 200, 120, 0.08)',
                        border: '1px solid rgba(80, 200, 120, 0.25)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--nexus-emerald)'
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <h4
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        margin: 0,
                        color: 'var(--nexus-white)'
                      }}
                    >
                      {card.title}
                    </h4>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
