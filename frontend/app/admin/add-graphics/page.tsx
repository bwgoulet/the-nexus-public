'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { RiImageAddLine, RiUploadCloud2Line, RiCheckFill } from '@remixicon/react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import type { TeamGraphics } from '@/lib/data';

type TeamOption = { id: string; name: string; short_name: string; graphics: TeamGraphics | null };
const TEAM_GRAPHICS_BUCKET = 'team-graphics';
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const safeFilePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '');

export default function AddGraphicsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamId, setTeamId] = useState('');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/signup');
      const [{ data: profile }, { data: teamRows }] = await Promise.all([
        supabase.from('users').select('role').eq('id', session.user.id).maybeSingle<{ role: string }>(),
        supabase.from('teams').select('id,name,short_name,graphics').order('name')
      ]);
      if (!mounted) return;
      if (profile?.role !== 'mod') return router.replace('/dashboard');
      const nextTeams = (teamRows as TeamOption[] | null) ?? [];
      setTeams(nextTeams);
      setTeamId(nextTeams[0]?.id ?? '');
      setIsChecking(false);
    };
    void load();
    return () => { mounted = false; };
  }, [router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !file || !teamId) return;
    setError('');
    setMessage('');
    if (!file.type.startsWith('image/')) return setError('Choose an image file to upload.');
    if (file.size > MAX_FILE_SIZE) return setError('Graphics must be 15 MB or smaller.');
    setIsSaving(true);

    const selectedTeam = teams.find((team) => team.id === teamId);
    const graphicId = crypto.randomUUID();
    const extension = safeFilePart(file.name.split('.').pop() ?? 'png') || 'png';
    const path = `${teamId}/${graphicId}.${extension}`;
    const displayName = label.trim() || file.name.replace(/\.[^.]+$/, '');
    const { error: uploadError } = await supabase.storage
      .from(TEAM_GRAPHICS_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setIsSaving(false);
      return;
    }

    const { data: publicAsset } = supabase.storage.from(TEAM_GRAPHICS_BUCKET).getPublicUrl(path);
    const graphics: TeamGraphics = {
      ...(selectedTeam?.graphics ?? {}),
      [graphicId]: { name: displayName, url: publicAsset.publicUrl, uploadedAt: new Date().toISOString() }
    };
    const { error: updateError } = await supabase.from('teams').update({ graphics } as never).eq('id', teamId);

    if (updateError) {
      await supabase.storage.from(TEAM_GRAPHICS_BUCKET).remove([path]);
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    setTeams((current) => current.map((team) => team.id === teamId ? { ...team, graphics } : team));
    setLabel('');
    setFile(null);
    const input = document.getElementById('team-graphic-file') as HTMLInputElement | null;
    if (input) input.value = '';
    setMessage(`${displayName} was added to ${selectedTeam?.name ?? 'the team'}'s graphics repo.`);
    setIsSaving(false);
  };

  if (!supabase) return <section className="auth-shell"><article className="login-modal card"><h1>Add Graphics</h1><p className="muted">Supabase must be configured to upload team graphics.</p></article></section>;
  if (isChecking) return <section className="auth-shell admin-portal-shell"><article className="login-modal card"><p className="muted">Checking admin access...</p></article></section>;

  return (
    <section className="auth-shell admin-portal-shell team-graphics-admin-shell">
      <article className="card team-graphics-admin-card">
        <header>
          <RiImageAddLine size={34} aria-hidden="true" />
          <p>Admin Portal</p>
          <h1>Add Graphics</h1>
          <span>Publish approved artwork to any team&apos;s shared Nexus graphics repository.</span>
        </header>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="team-graphics-team">Team</label>
          <select id="team-graphics-team" value={teamId} onChange={(event) => setTeamId(event.target.value)} required>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.short_name})</option>)}
          </select>
          <label htmlFor="team-graphic-label">Graphic name</label>
          <input id="team-graphic-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Match day template" maxLength={80} />
          <label className="team-graphics-upload" htmlFor="team-graphic-file">
            <RiUploadCloud2Line size={28} aria-hidden="true" />
            <strong>{file?.name ?? 'Choose a graphic'}</strong>
            <span>PNG, JPG, WebP, or GIF · 15 MB max</span>
          </label>
          <input id="team-graphic-file" className="team-graphics-file-input" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
          {error ? <p className="team-graphics-form-error" role="alert">{error}</p> : null}
          {message ? (
            <p className="team-graphics-form-success flex items-center gap-1.5" role="status">
              <RiCheckFill size={16} aria-hidden="true" className="shrink-0" />
              <span>{message}</span>
            </p>
          ) : null}
          <button type="submit" disabled={isSaving || !file || !teamId}>{isSaving ? 'Publishing…' : 'Add to Graphics Repo'}</button>
        </form>
      </article>
    </section>
  );
}
