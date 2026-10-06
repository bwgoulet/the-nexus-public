'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { matches as fallbackMatches, teams as fallbackTeams, type Match } from '@/lib/data';

type UserRole = 'director' | 'player' | 'mod';

type MatchOption = {
  id: string;
  slug: string;
  date: string;
  label: string;
};

const formatMatchLabel = (match: Match, teamMap: Map<string, string>) => {
  const homeName = teamMap.get(match.home_team_id) ?? 'Home Team';
  const awayName = teamMap.get(match.away_team_id) ?? 'Away Team';
  const dateLabel = new Date(match.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return `${homeName} vs ${awayName} — ${dateLabel}`;
};

export default function UpdateMatchPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const fallbackTeamMap = new Map(fallbackTeams.map((team) => [team.id, team.short_name || team.name]));
  const fallbackOptions = [...fallbackMatches]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((match) => ({
      id: match.id,
      slug: match.slug,
      date: match.date,
      label: formatMatchLabel(match, fallbackTeamMap)
    }));

  const [isLoadingMatches, setIsLoadingMatches] = useState(Boolean(supabase));
  const [matches, setMatches] = useState<MatchOption[]>(supabase ? [] : fallbackOptions);
  const [selectedSlug, setSelectedSlug] = useState('');

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    const verifyRole = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/signup');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle<{ role: UserRole }>();

      if (!isMounted) return;

      const canAccess = profile?.role === 'mod';
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

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    const loadMatches = async () => {
      const [{ data: matchRows }, { data: teamRows }] = await Promise.all([
        supabase.from('matches').select('id, slug, date, home_team_id, away_team_id, tournament_season_id').order('date', { ascending: false }),
        supabase.from('teams').select('id, name, short_name')
      ]);

      if (!isMounted) return;

      const typedMatches = (matchRows as Match[]) ?? [];
      const teamMap = new Map(
        ((teamRows as { id: string; name: string; short_name: string | null }[]) ?? []).map((team) => [
          team.id,
          team.short_name || team.name
        ])
      );

      const options = typedMatches.map((match) => ({
        id: match.id,
        slug: match.slug,
        date: match.date,
        label: formatMatchLabel(match, teamMap)
      }));

      setMatches(options);
      setIsLoadingMatches(false);
    };

    void loadMatches();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const selectedMatch = useMemo(() => matches.find((match) => match.slug === selectedSlug), [matches, selectedSlug]);

  const handleContinue = () => {
    if (!selectedMatch) return;

    // The add-match editor owns a large amount of local form state. A full
    // document navigation prevents App Router from reusing a previously mounted
    // blank editor and guarantees the edit query is present before the editor
    // starts its preload effect.
    window.location.assign(`/admin/add-match?edit=${encodeURIComponent(selectedMatch.slug)}`);
  };

  if (isChecking) {
    return (
      <section className="auth-shell admin-portal-shell">
        <article className="login-modal card">
          <p className="muted">Checking admin access...</p>
        </article>
      </section>
    );
  }

  if (!isAuthorized) return null;

  return (
    <section className="auth-shell admin-portal-shell match-sheet-shell">
      <div className="match-sheet-card">
        <header className="match-sheet-hero">
          <div>
            <p className="match-sheet-kicker">Admin Portal · Existing match sheet</p>
            <h1>Update Match</h1>
            <p>Pick a fixture from the schedule and jump into the faster spreadsheet-style editor for teams, scores, games, and crew rows.</p>
          </div>
          <div className="match-sheet-status" aria-label="Loaded matches">
            <span>Loaded</span>
            <strong>{matches.length}</strong>
          </div>
        </header>

        <div className="match-sheet-form">
          <section className="match-sheet-fixture">
            <div className="match-sheet-band"><span>Choose fixture</span><strong>{selectedMatch?.label ?? 'No match selected'}</strong></div>
            <div className="match-sheet-grid">
              <label htmlFor="match-select" className="sheet-cell sheet-cell-wide">
                <span>Existing matches</span>
                <select id="match-select" value={selectedSlug} onChange={(event) => setSelectedSlug(event.target.value)} disabled={isLoadingMatches || matches.length === 0}>
                  <option value="">Select a match</option>
                  {matches.map((match) => (
                    <option key={match.id} value={match.slug}>{match.label}</option>
                  ))}
                </select>
              </label>
              <div className="sheet-cell sheet-cell-wide">
                <span>Next action</span>
                <button type="button" className="primary-cta match-sheet-submit" onClick={handleContinue} disabled={!selectedMatch}>Continue to editor</button>
              </div>
            </div>
          </section>
          {!isLoadingMatches && matches.length === 0 ? <p className="match-sheet-empty">No matches available yet. Add a match first.</p> : null}
        </div>
      </div>
    </section>
  );
}
