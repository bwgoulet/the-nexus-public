'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

type UserRole = 'director' | 'player' | 'mod';
type SelectableUser = { id: string; email: string; tag: string | null; first_name: string; last_name: string };
type SelectableTeam = { id: string; name: string; short_name: string };

const renderUserLabel = (user: SelectableUser) => {
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const tag = user.tag?.trim();
  return tag ? `${tag} (${fullName})` : `${fullName} (${user.email})`;
};

function CreatePlayerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPlayerId = searchParams.get('edit');
  const isEditing = Boolean(editPlayerId);
  const supabase = getSupabaseClient();
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [teams, setTeams] = useState<SelectableTeam[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tag, setTag] = useState('');
  const [userId, setUserId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    const bootstrap = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return router.replace('/signup');

      const { data: profile } = await supabase.from('users').select('role').eq('id', sessionData.session.user.id).maybeSingle<{ role: UserRole }>();
      if (!mounted) return;
      if (!profile || profile.role !== 'mod') return router.replace('/dashboard');
      setIsAuthorized(true);

      const [{ data: userRows, error: userError }, { data: teamRows, error: teamError }] = await Promise.all([
        supabase.from('users').select('id,email,tag,first_name,last_name').order('tag', { ascending: true, nullsFirst: false }),
        supabase.from('teams').select('id,name,short_name').order('name', { ascending: true })
      ]);

      if (!mounted) return;
      if (userError || teamError) {
        setError(userError?.message ?? teamError?.message ?? 'Failed loading options.');
      } else {
        setUsers((userRows as SelectableUser[]) ?? []);
        setTeams((teamRows as SelectableTeam[]) ?? []);
      }
      setIsChecking(false);
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!supabase || !editPlayerId) return;
    let mounted = true;
    const loadPlayer = async () => {
      const { data } = await supabase.from('players').select('tag,user_id,team_id,first_name,last_name').eq('id', editPlayerId).maybeSingle();
      if (!mounted || !data) return;
      const player = data as { tag: string; user_id: string | null; team_id: string | null; first_name: string | null; last_name: string | null };
      setTag(player.tag ?? '');
      setFirstName(player.first_name ?? '');
      setLastName(player.last_name ?? '');
      setUserId(player.user_id ?? '');
      setTeamId(player.team_id ?? '');
    };
    void loadPlayer();
    return () => { mounted = false; };
  }, [editPlayerId, supabase]);

  const selectedUser = useMemo(() => users.find((u) => u.id === userId), [userId, users]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const normalizedFirst = firstName.trim();
    const normalizedLast = lastName.trim();
    const normalizedTag = tag.trim();

    try {
      const resolvedUserId = userId;
      if (resolvedUserId) {
        const { error: updateError } = await supabase.from('users' as never).update({ first_name: normalizedFirst, last_name: normalizedLast, tag: normalizedTag, role: 'player' } as never).eq('id', resolvedUserId);
        if (updateError) throw updateError;
      }

      const basePlayerPayload = { user_id: resolvedUserId || null, team_id: teamId || null, tag: normalizedTag, first_name: normalizedFirst || null, last_name: normalizedLast || null };
      const query = isEditing
        ? supabase.from('players' as never).update(basePlayerPayload as never).eq('id', editPlayerId as string)
        : supabase.from('players' as never).insert(basePlayerPayload as never);
      const { error: saveError } = await query;

      if (saveError) throw saveError;

      setSuccess(isEditing ? 'Player updated successfully.' : 'Player created successfully.');
      setFirstName('');
      setLastName('');
      setTag('');
      setUserId('');
      setTeamId('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create player.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isChecking) return <section className="auth-shell admin-portal-shell"><article className="login-modal card"><p className="muted">Checking admin access...</p></article></section>;
  if (!isAuthorized) return null;

  return <section className="auth-shell admin-portal-shell" style={{ alignItems: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem' }}><article className="card" style={{ width: 'min(860px, 100%)', padding: '2rem', borderRadius: '1.25rem' }}><header style={{ marginBottom: '1.5rem' }}><p className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '0.8rem' }}>Admin Portal · Players</p><h1 style={{ marginBottom: '0.5rem' }}>{isEditing ? 'Update Player' : 'Create Player'}</h1><p className="muted">{isEditing ? 'Update a player record and adjust linked user/team relationships.' : 'Create a player with a required tag and optional user/team links. If no user is selected, the player is created without a linked account.'}</p></header><form onSubmit={onSubmit} className="grid gap-4"><label className="field-label">First Name (optional, only used when linking a user)<input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label className="field-label">Last Name (optional, only used when linking a user)<input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label className="field-label">Player Tag *<input required value={tag} onChange={(event) => setTag(event.target.value)} /></label><label className="field-label">Link Existing User (optional)<select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">No linked user account</option>{users.map((user) => <option key={user.id} value={user.id}>{renderUserLabel(user)}</option>)}</select></label>{selectedUser && <p className="text-sm text-base-content/75">Selected user will be updated with the name and tag values above.</p>}<label className="field-label">Link Team (optional)<select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">No team assigned</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.short_name})</option>)}</select></label>{error && <p className="text-sm text-red-300">{error}</p>}{success && <p className="text-sm text-emerald-300">{success}</p>}<button type="submit" className="btn-primary" disabled={submitting}>{submitting ? (isEditing ? 'Updating player...' : 'Creating player...') : isEditing ? 'Update Player' : 'Create Player'}</button></form></article></section>;
}

export default function CreatePlayerPage() {
  return (
    <Suspense
      fallback={
        <section className="auth-shell admin-portal-shell">
          <article className="login-modal card">
            <p className="muted">Loading player editor...</p>
          </article>
        </section>
      }
    >
      <CreatePlayerPageContent />
    </Suspense>
  );
}
