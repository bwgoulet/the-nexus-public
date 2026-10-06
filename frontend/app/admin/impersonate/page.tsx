'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

type UserRole = 'director' | 'member_director' | 'pro_director' | 'exclusive_director' | 'player' | 'mod';

type ImpersonationUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  tag: string | null;
  role: UserRole;
};

type Target = { type: 'user'; id: string };

const labelForUser = (user: ImpersonationUser) => `${user.tag ?? `${user.first_name} ${user.last_name}`} — ${user.role} — ${user.email}`;

export default function AdminImpersonatePage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [users, setUsers] = useState<ImpersonationUser[]>([]);
  const [targetId, setTargetId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    const bootstrap = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace('/signup');
        return;
      }

      const { data: profile } = await supabase.from('users').select('role').eq('id', sessionData.session.user.id).maybeSingle<{ role: UserRole }>();
      if (!mounted) return;

      const canAccess = profile?.role === 'mod';
      setIsAuthorized(canAccess);
      setIsChecking(false);
      if (!canAccess) {
        router.replace('/dashboard');
        return;
      }

      const response = await fetch('/api/admin/impersonate', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
      });
      const payload = await response.json();
      if (!mounted) return;

      if (!response.ok) {
        setError(payload.error ?? 'Unable to load test login targets.');
      } else {
        setUsers(payload.users ?? []);
      }
      setIsLoading(false);
    };

    void bootstrap();
    return () => { mounted = false; };
  }, [router, supabase]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => labelForUser(user).toLowerCase().includes(needle));
  }, [query, users]);

  const target: Target | null = targetId ? { type: 'user', id: targetId } : null;

  const loginAsTarget = async () => {
    if (!supabase || !target) return;
    setError(null);
    setStatus('Preparing test login...');

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.replace('/signup');
      return;
    }

    const response = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetType: 'user', userId: target.id })
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Unable to prepare test login.');
      setStatus(null);
      return;
    }

    setStatus('Switching sessions...');
    await supabase.auth.signOut();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });

    if (signInError) {
      setError(signInError.message);
      setStatus(null);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  };

  if (isChecking) return <section className="auth-shell"><article className="login-modal card"><p className="muted">Checking admin access...</p></article></section>;
  if (!isAuthorized) return null;

  return (
    <section className="auth-shell admin-portal-shell" style={{ alignItems: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div className="card" style={{ width: 'min(860px, 100%)', padding: '2rem', borderRadius: '1.5rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <p className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, fontSize: '0.78rem' }}>Admin Portal</p>
          <h1 style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Test Login</h1>
          <p className="muted">Switch into any user profile on the platform to test dashboards, onboarding, and live match operations.</p>
        </header>

        <div className="space-y-5">
          <label className="space-y-2 block" htmlFor="impersonation-search">
            <span className="text-sm font-semibold text-base-content">Search</span>
            <input id="impersonation-search" className="input input-bordered w-full" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by tag, name, role, or email" />
          </label>

          <label className="space-y-2 block" htmlFor="impersonation-target">
            <span className="text-sm font-semibold text-base-content">Login target</span>
            <select id="impersonation-target" className="select select-bordered w-full" value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={isLoading}>
              <option value="">{isLoading ? 'Loading user profiles...' : 'Select a user profile'}</option>
              {filteredUsers.map((user) => <option key={user.id} value={user.id}>{labelForUser(user)}</option>)}
            </select>
          </label>

          {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
          {status ? <p className="text-sm font-semibold text-primary">{status}</p> : null}

          <button type="button" className="btn btn-primary w-full" disabled={!target || Boolean(status)} onClick={() => void loginAsTarget()}>
            Login as selected user
          </button>
        </div>
      </div>
    </section>
  );
}
