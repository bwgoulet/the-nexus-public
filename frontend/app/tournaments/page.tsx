'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RiArrowRightFill,
  RiCheckboxCircleFill,
  RiGroupFill,
  RiShieldStarFill,
  RiSwordFill,
  RiTrophyFill
} from '@remixicon/react';
import { getSupabaseClient } from '@/lib/supabase';
import { isDirectorRole } from '@/lib/roles';

type Competition = {
  id: string;
  slug?: string;
  name: string;
  bracket_type: 'double_elimination' | 'round_robin';
  competition_type: 'tournament' | 'season';
  registration_status: 'open' | 'closed';
};

type DirectorTeam = { id: string; name: string; short_name: string };

const fallbackCompetitions: Competition[] = [
  { id: 'tournament-season-preseason-2026', slug: 'nexus-2026-preseason', name: 'Nexus 2026 Preseason', bracket_type: 'round_robin', competition_type: 'season', registration_status: 'closed' },
  { id: 'c50e0270-bc10-4bf9-a07a-4d245b2c5c9f', slug: 'season-1-fall-2026', name: 'Season 1 - Fall 2026', bracket_type: 'round_robin', competition_type: 'season', registration_status: 'closed' }
];

export default function TournamentsPage() {
  const supabase = getSupabaseClient();
  const [competitions, setCompetitions] = useState<Competition[]>(fallbackCompetitions);
  const [team, setTeam] = useState<DirectorTeam | null>(null);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [isDirector, setIsDirector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!supabase) {
        setCompetitions(fallbackCompetitions);
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const competitionResult = await supabase
        .from('tournaments_seasons')
        .select('id,slug,name,bracket_type,competition_type,registration_status')
        .order('name');

      if (!mounted) return;
      const availableCompetitions = competitionResult.data as Competition[] | null;
      setCompetitions(availableCompetitions?.length ? availableCompetitions : fallbackCompetitions);

      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle<{ role: string | null }>();

      if (!mounted || !isDirectorRole(profile?.role)) {
        setIsLoading(false);
        return;
      }
      setIsDirector(true);

      const { data: directorTeam } = await supabase
        .from('teams')
        .select('id,name,short_name')
        .eq('director_user_id', session.user.id)
        .maybeSingle<DirectorTeam>();

      if (!mounted) return;
      setTeam(directorTeam ?? null);
      if (directorTeam) {
        const { data: registrations } = await supabase
          .from('tournament_season_teams')
          .select('tournament_season_id')
          .eq('team_id', directorTeam.id);
        if (mounted) {
          setRegisteredIds(((registrations as Array<{ tournament_season_id: string }> | null) ?? []).map((entry) => entry.tournament_season_id));
        }
      }
      if (mounted) setIsLoading(false);
    };

    void load();
    return () => { mounted = false; };
  }, [supabase]);

  const register = async (competition: Competition) => {
    if (!supabase || !team || competition.registration_status !== 'open') return;
    setSavingId(competition.id);
    setFeedback('');
    const { error } = await supabase.rpc('register_director_team_for_tournament' as never, {
      requested_tournament_season_id: competition.id
    } as never);
    if (error) {
      setFeedback(error.message);
    } else {
      setRegisteredIds((current) => current.includes(competition.id) ? current : [...current, competition.id]);
      setFeedback(`${team.name} is registered for ${competition.name}.`);
    }
    setSavingId(null);
  };

  const openCompetitionCount = competitions.filter((competition) => competition.registration_status === 'open').length;

  const callout = !isLoading && (!isDirector || !team) ? (
    <aside className="tournament-callout">
      <RiShieldStarFill size={28} aria-hidden="true" />
      <div>
        <strong>{isDirector ? 'Register or claim your school first' : 'Director access required'}</strong>
        <p>{isDirector ? 'Connect a team to your director account before entering a competition.' : 'Sign in with a director account to register your school’s crew.'}</p>
      </div>
      <Link className="btn btn-primary" href={isDirector ? '/school-registration' : '/signup'}>
        {isDirector ? 'Set up team' : 'Sign in'} <RiArrowRightFill size={18} />
      </Link>
    </aside>
  ) : null;

  return (
    <section className="tournament-page" aria-labelledby="tournament-title">
      <header className="tournament-hero">
        <p className="tournament-kicker"><span /> Competition registration</p>
        <h1 id="tournament-title">Choose your<br /><em>next battle.</em></h1>
        <p>Enter your school’s crew in an upcoming Nexus tournament or season. Directors can secure a place for their full team in one click.</p>
        <div className="tournament-hero-stats">
          <span><strong>{openCompetitionCount}</strong> Open competitions</span>
          <span><RiGroupFill size={18} /> One registration per team</span>
        </div>
      </header>

      <div className="tournament-content">
        {callout}
        {feedback ? <p className="tournament-feedback" role="status">{feedback}</p> : null}
        <div className="tournament-section-heading">
          <div><p>Competition directory</p><h2>Tournaments &amp; seasons</h2></div>
        </div>

        <div className="tournament-grid">
          {competitions.map((competition, index) => {
            const registered = registeredIds.includes(competition.id);
            const isOpen = competition.registration_status === 'open';
            return (
              <article className={`tournament-card ${isOpen ? '' : 'is-closed'}`} key={competition.id}>
                <div className="tournament-card-topline"><span>0{index + 1}</span><small className={isOpen ? '' : 'is-closed'}>Registration {competition.registration_status}</small></div>
                <div className="tournament-card-icon">{competition.bracket_type === 'round_robin' ? <RiSwordFill size={28} /> : <RiTrophyFill size={28} />}</div>
                <div className="tournament-card-labels"><p>{competition.competition_type}</p><span>{competition.bracket_type === 'round_robin' ? 'Round Robin' : 'Double Elimination'}</span></div>
                <h3>{competition.name}</h3>
                <div className="tournament-card-actions">
                  <Link className="btn btn-primary tournament-detail-link" href={`/tournaments/${competition.slug ?? competition.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}>View {competition.competition_type} <RiArrowRightFill size={18} /></Link>
                  <button className={`btn ${registered ? 'tournament-registered' : isOpen ? 'btn-primary' : 'tournament-closed'}`} type="button" disabled={!team || registered || !isOpen || savingId === competition.id} onClick={() => void register(competition)}>
                    {registered ? <><RiCheckboxCircleFill size={19} /> Team registered</> : !isOpen ? 'Registration closed' : savingId === competition.id ? 'Registering…' : <>Register team <RiArrowRightFill size={18} /></>}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
