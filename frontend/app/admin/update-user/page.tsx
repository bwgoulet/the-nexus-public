'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

type UserRole = 'director' | 'member_director' | 'pro_director' | 'exclusive_director' | 'player' | 'mod';
type UserOption = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  tag: string | null;
  role: UserRole | null;
  avatar: string | null;
  x_handle: string | null;
  discord_handle: string | null;
};

const roleOptions: UserRole[] = ['player', 'director', 'member_director', 'pro_director', 'exclusive_director', 'mod'];

const formatRole = (role: UserRole | null) => role?.replaceAll('_', ' ') ?? 'No role';

const labelForUser = (user: UserOption) => {
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'No name';
  const tag = user.tag?.trim() ? `“${user.tag}”` : 'No tag';
  return `${fullName} — ${tag} — ${user.email ?? 'No email'} — ${formatRole(user.role)}`;
};

export default function UpdateUserPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isLoadingUsers, setIsLoadingUsers] = useState(Boolean(supabase));
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tag, setTag] = useState('');
  const [role, setRole] = useState<UserRole>('player');
  const [avatar, setAvatar] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      if (!canAccess) router.replace('/dashboard');
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!supabase || isChecking || !isAuthorized) return;
    let mounted = true;
    const load = async () => {
      setIsLoadingUsers(true);
      setError(null);
      const { data, error: usersError } = await supabase
        .from('users')
        .select('id,email,first_name,last_name,tag,role,avatar,x_handle,discord_handle')
        .order('email', { ascending: true, nullsFirst: false });
      if (!mounted) return;
      if (usersError) {
        setError(usersError.message);
        setUsers([]);
      } else {
        setUsers((data as UserOption[]) ?? []);
      }
      setIsLoadingUsers(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [isAuthorized, isChecking, supabase]);

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId), [selectedUserId, users]);

  const updateSelectedUserId = (nextUserId: string) => {
    const nextUser = users.find((user) => user.id === nextUserId);
    setSelectedUserId(nextUserId);
    setFirstName(nextUser?.first_name ?? '');
    setLastName(nextUser?.last_name ?? '');
    setTag(nextUser?.tag ?? '');
    setRole(nextUser?.role ?? 'player');
    setAvatar(nextUser?.avatar ?? '');
    setXHandle(nextUser?.x_handle ?? '');
    setDiscordHandle(nextUser?.discord_handle ?? '');
    setSuccess(null);
    setError(null);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !selectedUser) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      tag: tag.trim(),
      role,
      avatar: avatar.trim() || null,
      x_handle: xHandle.trim() || null,
      discord_handle: discordHandle.trim() || null
    };

    const { data, error: updateError } = await supabase
      .from('users' as never)
      .update(payload as never)
      .eq('id', selectedUser.id)
      .select('id,email,first_name,last_name,tag,role,avatar,x_handle,discord_handle')
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
    } else if (data) {
      const updatedUser = data as UserOption;
      setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
      setSuccess('User updated successfully.');
    }
    setSubmitting(false);
  };

  if (isChecking) return <section className="auth-shell admin-portal-shell"><article className="login-modal card"><p className="muted">Checking admin access...</p></article></section>;
  if (!isAuthorized) return null;

  return (
    <section className="auth-shell admin-portal-shell" style={{ alignItems: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div className="card" style={{ width: 'min(860px, 100%)', padding: '2rem', borderRadius: '1.5rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <p className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, fontSize: '0.78rem' }}>Admin Portal · Users</p>
          <h1 style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Update User</h1>
          <p className="muted">Select any Nexus user account and update profile, role, avatar, and social handle details.</p>
        </header>
        <div className="space-y-4">
          <label htmlFor="user-select" className="text-sm font-semibold text-base-content">Existing users</label>
          <select id="user-select" className="select select-bordered w-full" value={selectedUserId} onChange={(event) => updateSelectedUserId(event.target.value)} disabled={isLoadingUsers || users.length === 0}>
            <option value="">{isLoadingUsers ? 'Loading users...' : 'Select a user'}</option>
            {users.map((user) => <option key={user.id} value={user.id}>{labelForUser(user)}</option>)}
          </select>
          {error && !selectedUser && <p className="text-sm text-red-300">Failed to load users: {error}</p>}
          {!isLoadingUsers && !error && users.length === 0 && <p className="text-sm text-base-content/75">No user accounts are available to edit.</p>}
        </div>
        {selectedUser && (
          <form onSubmit={onSubmit} className="grid gap-4" style={{ marginTop: '1.5rem' }}>
            <label className="field-label">First Name *<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
            <label className="field-label">Last Name *<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
            <label className="field-label">Tag *<input required value={tag} onChange={(event) => setTag(event.target.value)} /></label>
            <label className="field-label">Role<select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>{roleOptions.map((option) => <option key={option} value={option}>{formatRole(option)}</option>)}</select></label>
            <label className="field-label">Avatar URL<input value={avatar} onChange={(event) => setAvatar(event.target.value)} /></label>
            <label className="field-label">X/Twitter Handle<input value={xHandle} onChange={(event) => setXHandle(event.target.value)} /></label>
            <label className="field-label">Discord Handle<input value={discordHandle} onChange={(event) => setDiscordHandle(event.target.value)} /></label>
            <p className="text-sm text-base-content/70">Email is shown for selection only and cannot be changed here: {selectedUser.email ?? 'No email on file'}.</p>
            {error && <p className="text-sm text-red-300">{error}</p>}
            {success && <p className="text-sm text-emerald-300">{success}</p>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Updating user...' : 'Update User'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
