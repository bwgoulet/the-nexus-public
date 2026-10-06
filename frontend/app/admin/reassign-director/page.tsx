'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiArrowLeftLine, RiExchangeBoxLine, RiShieldUserFill } from '@remixicon/react';

import { RouteLoader } from '@/app/components/route-loader';
import type { DirectorAssignment, Team } from '@/lib/data';
import { directorLabel, loadDirectorAssignments, reassignDirector } from '@/lib/director-reassignment';
import { getSupabaseClient } from '@/lib/supabase';

type AssignmentTeam = Pick<Team, 'id' | 'name' | 'short_name' | 'director_user_id'>;

export default function ReassignDirectorPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [directors, setDirectors] = useState<DirectorAssignment[]>([]);
  const [teams, setTeams] = useState<AssignmentTeam[]>([]);
  const [directorId, setDirectorId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured. Director assignments cannot be changed.');
      setLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/signup');
        return;
      }
      const { data: caller, error: callerError } = await supabase.from('users').select('role').eq('id', session.user.id).maybeSingle<{ role: string }>();
      if (callerError || caller?.role !== 'mod') {
        router.replace('/dashboard');
        return;
      }
      const result = await loadDirectorAssignments(supabase);
      setDirectors(result.directors);
      setTeams(result.teams);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load director assignments.');
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const selectedDirector = directors.find((director) => director.id === directorId) ?? null;
  const destination = teams.find((team) => team.id === teamId) ?? null;
  const destinationDirector = directors.find((director) => director.id === destination?.director_user_id) ?? null;
  const hasConflict = Boolean(destinationDirector && destinationDirector.id !== directorId);
  const canContinue = Boolean(selectedDirector && destination && selectedDirector.team?.id !== destination.id && (!hasConflict || replaceExisting));
  const assignmentRows = useMemo(() => directors.map((director) => ({ director, team: director.team })), [directors]);

  const save = async () => {
    if (!supabase || !selectedDirector || !destination || !canContinue) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await reassignDirector(supabase, selectedDirector.id, destination.id, replaceExisting);
      setSuccess(`${directorLabel(selectedDirector)} is now assigned to ${destination.name}.`);
      setConfirming(false);
      setDirectorId('');
      setTeamId('');
      setReplaceExisting(false);
      await refresh();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(message.includes('permission') || message.includes('moderator')
        ? `Permission denied: ${message}`
        : `Assignment conflict: ${message}`);
      setConfirming(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <RouteLoader label="Loading director assignments..." />;

  return (
    <div className="admin-page" style={{ display: 'grid', gap: '1.25rem' }}>
      <Link href="/admin" className="muted" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', textDecoration: 'none' }}>
        <RiArrowLeftLine size={18} /> Moderator portal
      </Link>
      <header className="dashboard-panel">
        <div className="dashboard-section-heading">
          <RiShieldUserFill size={28} />
          <div><span>TEAMS &amp; ROSTERS</span><h2>REASSIGN DIRECTOR</h2></div>
        </div>
        <p className="muted">Move a director between schools in one protected transaction. Existing destination assignments are never replaced without explicit confirmation.</p>
      </header>

      {(error || success) && <div className="dashboard-panel" role="status" style={{ borderColor: error ? 'var(--nexus-magenta)' : 'var(--nexus-emerald)' }}>{error || success}</div>}

      <section className="dashboard-panel">
        <h3 style={{ marginTop: 0 }}>Current assignments</h3>
        <div style={{ display: 'grid', gap: '0.55rem' }}>
          {assignmentRows.map(({ director, team }) => (
            <div key={director.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,.1)', paddingBottom: '.55rem' }}>
              <span><strong>{directorLabel(director)}</strong> <span className="muted">({director.role})</span></span>
              <span>{team ? `${team.name} (${team.short_name})` : 'Unassigned'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-panel" style={{ display: 'grid', gap: '1rem' }}>
        <h3 style={{ margin: 0 }}>Plan reassignment</h3>
        <label>Director
          <select value={directorId} onChange={(event) => { setDirectorId(event.target.value); setConfirming(false); }} style={{ width: '100%', marginTop: '.4rem' }}>
            <option value="">Select a director</option>
            {directors.map((director) => <option key={director.id} value={director.id}>{directorLabel(director)} — {director.team?.name ?? 'Unassigned'}</option>)}
          </select>
        </label>
        <label>Destination team
          <select value={teamId} onChange={(event) => { setTeamId(event.target.value); setReplaceExisting(false); setConfirming(false); }} style={{ width: '100%', marginTop: '.4rem' }}>
            <option value="">Select a team</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.short_name})</option>)}
          </select>
        </label>

        {selectedDirector && destination && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div><span className="muted">Source assignment</span><p><strong>{selectedDirector.team?.name ?? 'Unassigned'}</strong></p></div>
          <div><span className="muted">Destination assignment</span><p><strong>{destinationDirector ? directorLabel(destinationDirector) : 'Unassigned'}</strong></p></div>
        </div>}

        {hasConflict && <label style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={replaceExisting} onChange={(event) => { setReplaceExisting(event.target.checked); setConfirming(false); }} />
          Replace {destinationDirector ? directorLabel(destinationDirector) : 'the existing director'} and leave them unassigned.
        </label>}

        {!confirming ? (
          <button className="button" disabled={!canContinue} onClick={() => setConfirming(true)}><RiExchangeBoxLine size={18} /> Review and confirm</button>
        ) : (
          <div style={{ border: '1px solid var(--nexus-emerald)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <p><strong>Confirm:</strong> Assign {selectedDirector && directorLabel(selectedDirector)} to {destination?.name}{hasConflict ? ` and remove ${destinationDirector && directorLabel(destinationDirector)}` : ''}?</p>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button className="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Confirm reassignment'}</button>
              <button className="button secondary" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
