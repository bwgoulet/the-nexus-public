'use client';

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { RiAddLine, RiArrowDownLine, RiArrowUpLine, RiCalendarScheduleLine, RiCheckboxCircleFill, RiDeleteBinLine, RiEyeLine, RiGroupLine, RiShuffleLine, RiTrophyLine } from '@remixicon/react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

type TeamOption = { id: string; name: string; short_name: string };
type BracketType = 'double_elimination' | 'round_robin';
type CompetitionType = 'tournament' | 'season';
type RegistrationStatus = 'open' | 'closed';
type TournamentOption = { id: string; name: string; bracket_type: BracketType; competition_type: CompetitionType; registration_status: RegistrationStatus; weeks: number | null };
type TournamentTeam = { tournament_season_id: string; team_id: string; seed: number | null };
type Matchup = { id: string; tournament_season_id?: string; week: number; home_team_id: string; away_team_id: string; scheduled_at: string };

const formatLoadError = (message: string) => message.includes('tournament_season_teams')
  ? 'Tournament team assignments are not installed yet. Apply the latest Supabase migrations, then refresh this page.'
  : message;


const toLocalInput = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const newMatchupId = () => `new-${crypto.randomUUID()}`;

const addWeeksToLocalInput = (value: string, weeks: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + (weeks * 7));
  return toLocalInput(date.toISOString());
};

function DateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => inputRef.current?.showPicker();
  const blockTyping = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab') return;
    event.preventDefault();
    if (event.key === 'Enter' || event.key === ' ') openPicker();
  };

  return (
    <input
      ref={inputRef}
      required
      type="datetime-local"
      value={value}
      onClick={openPicker}
      onKeyDown={blockTyping}
      onPaste={(event) => event.preventDefault()}
      onChange={(event) => onChange(event.target.value)}
      title="Open the picker to select the match date and time"
    />
  );
}

function generateRoundRobin(teamIds: string[], weeks: number): Matchup[] {
  if (teamIds.length < 2) return [];
  let rotation: Array<string | null> = [...teamIds];
  if (rotation.length % 2) rotation.push(null);
  return Array.from({ length: weeks }, (_, weekIndex) => {
    if (weekIndex && weekIndex % (rotation.length - 1) === 0) rotation = [...teamIds, ...(teamIds.length % 2 ? [null] : [])];
    const pairings = Array.from({ length: rotation.length / 2 }, (_, index) => [rotation[index], rotation[rotation.length - index - 1]] as const)
      .flatMap(([first, second], index) => first && second ? [{ id: newMatchupId(), week: weekIndex + 1, home_team_id: (weekIndex + index) % 2 ? second : first, away_team_id: (weekIndex + index) % 2 ? first : second, scheduled_at: '' }] : []);
    rotation = [rotation[0], rotation.at(-1)!, ...rotation.slice(1, -1)];
    return pairings;
  }).flat();
}

function BracketPreview({ teams }: { teams: TeamOption[] }) {
  const firstRound = Array.from({ length: Math.ceil(teams.length / 2) }, (_, index) => [teams[index], teams[teams.length - 1 - index]]).filter(([a, b]) => a && b && a.id !== b.id);
  return <section className="bracket-preview"><div className="bracket-preview-title"><span>Double Elimination</span><h3>Bracket preview</h3></div><div className="double-elim-bracket"><div className="bracket-column"><h4>Winners · Round 1</h4>{firstRound.map(([a, b]) => <div className="bracket-match" key={`${a.id}-${b.id}`}><span><i>{teams.indexOf(a) + 1}</i>{a.name}</span><span><i>{teams.indexOf(b) + 1}</i>{b.name}</span></div>)}</div><div className="bracket-column bracket-placeholder"><h4>Winners · Next round</h4>{Array.from({ length: Math.max(1, Math.ceil(firstRound.length / 2)) }, (_, index) => <div className="bracket-match" key={index}><span>TBD</span><span>TBD</span></div>)}</div><div className="bracket-column bracket-lower"><h4>Losers bracket</h4><div className="bracket-match"><span>Round 1 loser</span><span>Round 1 loser</span></div></div></div></section>;
}

function RoundRobinEditor({ matchups, teams, weeks, onChange }: { matchups: Matchup[]; teams: TeamOption[]; weeks: number; onChange: (matchups: Matchup[]) => void }) {
  const teamName = (id: string) => teams.find((team) => team.id === id)?.short_name ?? 'Unknown';
  const patchMatchup = (id: string, patch: Partial<Matchup>) => onChange(matchups.map((matchup) => matchup.id === id ? { ...matchup, ...patch } : matchup));
  const addMatchup = (week: number) => {
    if (teams.length < 2) return;
    onChange([...matchups, { id: newMatchupId(), week, home_team_id: teams[0].id, away_team_id: teams[1].id, scheduled_at: '' }]);
  };
  const weekOneDateTime = matchups.find((matchup) => matchup.week === 1 && matchup.scheduled_at)?.scheduled_at ?? '';
  const populateDateTimes = () => {
    if (!weekOneDateTime) return;
    onChange(matchups.map((matchup) => matchup.week === 1
      ? matchup
      : { ...matchup, scheduled_at: addWeeksToLocalInput(weekOneDateTime, matchup.week - 1) }));
  };
  return <section className="bracket-preview round-robin-editor"><div className="bracket-preview-title"><span>Round Robin</span><h3>Weekly matchups</h3><p>Set each match time, move cards between weeks, or add a rematch. Every team may play at most once in a week.</p></div>
    {Array.from({ length: weeks }, (_, index) => index + 1).map((week) => <section className="round-robin-week" key={week}>
      <header><div><span>Season schedule</span><h4>Week {week}</h4></div><div className="round-robin-week-actions">{week === 1 ? <button type="button" className="secondary-cta" disabled={!weekOneDateTime} onClick={populateDateTimes} title={weekOneDateTime ? 'Copy the Week 1 date and time through the season' : 'Select a Week 1 date and time first'}><RiCalendarScheduleLine size={16} /> Populate Date/Time</button> : null}<button type="button" className="secondary-cta" disabled={teams.length < 2} onClick={() => addMatchup(week)}><RiAddLine size={16} /> Add matchup</button></div></header>
      <div className="round-robin-week-grid">{matchups.filter((matchup) => matchup.week === week).map((matchup) => <article className="round-robin-edit-card" key={matchup.id}>
        <div className="round-robin-team-selects"><select aria-label="Home team" value={matchup.home_team_id} onChange={(event) => patchMatchup(matchup.id, { home_team_id: event.target.value })}>{teams.map((team) => <option value={team.id} key={team.id}>{team.short_name}</option>)}</select><strong>VS</strong><select aria-label="Away team" value={matchup.away_team_id} onChange={(event) => patchMatchup(matchup.id, { away_team_id: event.target.value })}>{teams.map((team) => <option value={team.id} key={team.id}>{team.short_name}</option>)}</select></div>
        <label>Match date &amp; time<DateTimePicker value={matchup.scheduled_at} onChange={(scheduled_at) => patchMatchup(matchup.id, { scheduled_at })} /></label>
        <footer><span>{teamName(matchup.home_team_id)} vs {teamName(matchup.away_team_id)}</span><div><button type="button" aria-label={`Move matchup to week ${week - 1}`} disabled={week === 1} onClick={() => patchMatchup(matchup.id, { week: week - 1 })}><RiArrowUpLine size={16} /></button><button type="button" aria-label={`Move matchup to week ${week + 1}`} disabled={week === weeks} onClick={() => patchMatchup(matchup.id, { week: week + 1 })}><RiArrowDownLine size={16} /></button><button type="button" className="is-delete" aria-label="Delete matchup" onClick={() => onChange(matchups.filter((entry) => entry.id !== matchup.id))}><RiDeleteBinLine size={16} /></button></div></footer>
      </article>)}</div>
      {!matchups.some((matchup) => matchup.week === week) ? <p className="round-robin-week-empty">No matchups scheduled for this week.</p> : null}
    </section>)}
  </section>;
}

export default function TournamentsAdminPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [assignments, setAssignments] = useState<TournamentTeam[]>([]);
  const [savedMatchups, setSavedMatchups] = useState<Matchup[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [bracketType, setBracketType] = useState<BracketType>('double_elimination');
  const [competitionType, setCompetitionType] = useState<CompetitionType>('tournament');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>('closed');
  const [weeks, setWeeks] = useState(7);
  const [showBracket, setShowBracket] = useState(false);
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/signup');

      const [{ data: profile }, tournamentResult, teamResult, assignmentResult, matchupResult] = await Promise.all([
        supabase.from('users').select('role').eq('id', session.user.id).maybeSingle<{ role: string }>(),
        supabase.from('tournaments_seasons').select('id,name,bracket_type,competition_type,registration_status,weeks').order('name'),
        supabase.from('teams').select('id,name,short_name').order('name'),
        supabase.from('tournament_season_teams' as never).select('tournament_season_id,team_id,seed'),
        supabase.from('tournament_season_matchups' as never).select('id,tournament_season_id,week,home_team_id,away_team_id,scheduled_at').order('week')
      ]);

      if (!mounted) return;
      if (profile?.role !== 'mod') return router.replace('/dashboard');
      if (tournamentResult.error || teamResult.error || assignmentResult.error || matchupResult.error) {
        setError(formatLoadError(tournamentResult.error?.message ?? teamResult.error?.message ?? assignmentResult.error?.message ?? matchupResult.error?.message ?? 'Unable to load tournament data.'));
      } else {
        setTournaments((tournamentResult.data as TournamentOption[] | null) ?? []);
        setTeams((teamResult.data as TeamOption[] | null) ?? []);
        setAssignments((assignmentResult.data as TournamentTeam[] | null) ?? []);
        setSavedMatchups(((matchupResult.data as Matchup[] | null) ?? []).map((matchup) => ({ ...matchup, scheduled_at: toLocalInput(matchup.scheduled_at) })));
      }
      setIsChecking(false);
    };

    void load();
    return () => { mounted = false; };
  }, [router, supabase]);

  const chooseTournament = (id: string) => {
    setSelectedId(id);
    setName(tournaments.find((entry) => entry.id === id)?.name ?? '');
    setTeamIds(assignments.filter((entry) => entry.tournament_season_id === id).sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999)).map((entry) => entry.team_id));
    setBracketType(tournaments.find((entry) => entry.id === id)?.bracket_type ?? 'double_elimination');
    setCompetitionType(tournaments.find((entry) => entry.id === id)?.competition_type ?? 'tournament');
    setRegistrationStatus(tournaments.find((entry) => entry.id === id)?.registration_status ?? 'closed');
    setWeeks(tournaments.find((entry) => entry.id === id)?.weeks ?? 7);
    setMatchups(savedMatchups.filter((entry) => entry.tournament_season_id === id));
    setShowBracket(false);
    setError('');
    setMessage('');
  };

  const startNew = () => {
    setSelectedId('');
    setName('');
    setTeamIds([]);
    setBracketType('double_elimination');
    setCompetitionType('tournament');
    setRegistrationStatus('closed');
    setWeeks(7);
    setMatchups([]);
    setShowBracket(false);
    setError('');
    setMessage('');
  };

  const toggleTeam = (teamId: string) => {
    setTeamIds((current) => current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId]);
  };

  const moveTeam = (index: number, direction: -1 | 1) => {
    setTeamIds((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const seedAllTeams = () => setTeamIds(teams.map((team) => team.id));

  const openPreview = () => {
    if (bracketType === 'round_robin' && competitionType === 'season' && !matchups.length) setMatchups(generateRoundRobin(teamIds, weeks));
    setShowBracket((current) => !current);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !name.trim()) return;
    setIsSaving(true);
    setError('');
    setMessage('');

    if (bracketType === 'round_robin' && competitionType === 'season') {
      if (teamIds.length > 1 && !matchups.length) {
        setError('Open Edit matchups to generate the weekly schedule before saving.');
        setIsSaving(false);
        return;
      }
      const invalid = matchups.find((matchup) => matchup.home_team_id === matchup.away_team_id || !matchup.scheduled_at || matchup.week > weeks || !teamIds.includes(matchup.home_team_id) || !teamIds.includes(matchup.away_team_id));
      const duplicateWeekTeam = matchups.some((matchup, index) => matchups.some((other, otherIndex) => otherIndex !== index && other.week === matchup.week && [other.home_team_id, other.away_team_id].some((id) => id === matchup.home_team_id || id === matchup.away_team_id)));
      if (invalid || duplicateWeekTeam) {
        setError(invalid ? 'Every matchup needs two different teams and a date/time.' : 'A team can only appear in one matchup per week. Move or delete the conflicting matchup.');
        setIsSaving(false);
        return;
      }
    }

    const { data, error: saveError } = await supabase.rpc('save_tournament_season_schedule' as never, {
      requested_id: selectedId || null,
      requested_name: name.trim(),
      requested_team_ids: teamIds,
      requested_bracket_type: bracketType,
      requested_competition_type: competitionType,
      requested_registration_status: registrationStatus,
      requested_weeks: competitionType === 'season' ? weeks : null,
      requested_matchups: bracketType === 'round_robin' && competitionType === 'season' ? matchups.map(({ week, home_team_id, away_team_id, scheduled_at }) => ({ week, home_team_id, away_team_id, scheduled_at: new Date(scheduled_at).toISOString() })) : []
    } as never);

    if (saveError || !data) {
      setError(saveError?.message ?? 'Unable to save the tournament or season.');
      setIsSaving(false);
      return;
    }

    const saved = data as TournamentOption;
    setTournaments((current) => [...current.filter((entry) => entry.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
    setAssignments((current) => [
      ...current.filter((entry) => entry.tournament_season_id !== saved.id),
      ...teamIds.map((teamId, index) => ({ tournament_season_id: saved.id, team_id: teamId, seed: index + 1 }))
    ]);
    setSelectedId(saved.id);
    setName(saved.name);
    setTournaments((current) => current.map((entry) => entry.id === saved.id ? { ...entry, bracket_type: bracketType, competition_type: competitionType, registration_status: registrationStatus, weeks: competitionType === 'season' ? weeks : null } : entry));
    const persisted = matchups.map((matchup) => ({ ...matchup, tournament_season_id: saved.id }));
    setSavedMatchups((current) => [...current.filter((entry) => entry.tournament_season_id !== saved.id), ...persisted]);
    setMessage(`${saved.name} was saved with ${teamIds.length} ${teamIds.length === 1 ? 'team' : 'teams'}${bracketType === 'round_robin' && competitionType === 'season' ? ` and ${matchups.length} scheduled matches` : ''}.`);
    setIsSaving(false);
  };

  if (!supabase) return <section className="auth-shell"><article className="login-modal card"><h1>Tournaments &amp; Seasons</h1><p className="muted">Supabase must be configured to manage competitions.</p></article></section>;
  if (isChecking) return <section className="auth-shell admin-portal-shell"><article className="login-modal card"><p className="muted">Checking admin access...</p></article></section>;

  return (
    <section className="auth-shell admin-portal-shell tournament-admin-shell">
      <article className="card tournament-admin-card">
        <header className="tournament-admin-header">
          <div className="tournament-admin-icon"><RiTrophyLine size={26} aria-hidden="true" /></div>
          <div>
            <p>Admin Portal · Competition Setup</p>
            <h1>Tournaments &amp; Seasons</h1>
            <span>Build a competition field before fixtures or brackets are seeded. Return at any time to update its name or participating teams.</span>
          </div>
        </header>

        <div className="tournament-admin-layout">
          <aside className="tournament-admin-sidebar">
            <div className="tournament-admin-sidebar-heading"><span>Competition contexts</span><strong>{tournaments.length}</strong></div>
            <button type="button" className="btn btn-primary tournament-admin-new" onClick={startNew}><RiAddLine size={19} /> New tournament / season</button>
            <div className="tournament-admin-list">
              {tournaments.map((entry) => (
                <button key={entry.id} type="button" className="tournament-admin-list-item" aria-pressed={selectedId === entry.id} onClick={() => chooseTournament(entry.id)}>
                  <span><strong>{entry.name}</strong><small>{entry.competition_type} · registration {entry.registration_status} · {assignments.filter((assignment) => assignment.tournament_season_id === entry.id).length} teams</small></span>
                  {selectedId === entry.id ? <RiCheckboxCircleFill size={19} aria-hidden="true" /> : null}
                </button>
              ))}
              {!tournaments.length && !error ? <p className="tournament-admin-empty">No competition contexts yet. Create the first one to begin.</p> : null}
            </div>
          </aside>

          <form onSubmit={(event) => void handleSubmit(event)} className="tournament-admin-form">
            <div className="tournament-admin-form-heading">
              <div><span>{selectedId ? 'Edit context' : 'New context'}</span><h2>{selectedId ? 'Competition details' : 'Create a competition'}</h2></div>
              <RiGroupLine size={25} aria-hidden="true" />
            </div>
            <div className="tournament-admin-fields">
              <label className="field-label tournament-admin-name">Tournament / Season Name *<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Nexus Fall Invitational 2026" /></label>
              <label className="field-label tournament-admin-name">Bracket format *<select value={bracketType} onChange={(event) => setBracketType(event.target.value as BracketType)}><option value="double_elimination">Double Elimination</option><option value="round_robin">Round Robin</option></select></label>
              <label className="field-label tournament-admin-name">Competition type *<select value={competitionType} onChange={(event) => setCompetitionType(event.target.value as CompetitionType)}><option value="tournament">Tournament</option><option value="season">Season</option></select></label>
              <label className="field-label tournament-admin-name">Registration *<select value={registrationStatus} onChange={(event) => setRegistrationStatus(event.target.value as RegistrationStatus)}><option value="closed">Closed</option><option value="open">Open</option></select></label>
              {competitionType === 'season' ? <label className="field-label tournament-admin-name">Weeks *<input type="number" min="1" max="104" required value={weeks} onChange={(event) => setWeeks(Math.max(1, Number(event.target.value) || 1))} /><small>Each team plays once per week. Matchups reset only after a complete round-robin cycle.</small></label> : null}
            </div>
            <fieldset className="tournament-admin-teams">
              <legend>Attached teams <span>{teamIds.length}</span></legend>
              <div className="tournament-admin-seed-heading"><p>Select eligible teams, then arrange them in seed order.</p><button type="button" className="secondary-cta" onClick={seedAllTeams}><RiShuffleLine size={16} /> Seed all teams</button></div>
              <div className="tournament-admin-team-grid">
                {teams.map((team) => { const seed = teamIds.indexOf(team.id); return (
                  <div key={team.id} className={`tournament-admin-team-option ${seed >= 0 ? 'is-seeded' : ''}`}>
                    <label><input type="checkbox" checked={seed >= 0} onChange={() => toggleTeam(team.id)} /><span><strong>{seed >= 0 ? `${seed + 1}. ${team.name}` : team.name}</strong><small>{team.short_name}</small></span></label>
                    {seed >= 0 ? <span className="tournament-admin-seed-controls"><button type="button" aria-label={`Move ${team.name} up`} disabled={seed === 0} onClick={() => moveTeam(seed, -1)}><RiArrowUpLine size={15} /></button><button type="button" aria-label={`Move ${team.name} down`} disabled={seed === teamIds.length - 1} onClick={() => moveTeam(seed, 1)}><RiArrowDownLine size={15} /></button></span> : null}
                  </div>
                ); })}
              </div>
              {!teams.length ? <div className="tournament-admin-empty-teams"><RiGroupLine size={24} /><strong>No teams available</strong><span>Create teams before building a competition field.</span></div> : null}
            </fieldset>
            {error ? <p className="tournament-admin-feedback is-error" role="alert">{error}</p> : null}
            {message ? <p className="tournament-admin-feedback is-success" role="status">{message}</p> : null}
            {showBracket ? bracketType === 'round_robin' && competitionType === 'season' ? <RoundRobinEditor matchups={matchups} teams={teamIds.map((id) => teams.find((team) => team.id === id)).filter((team): team is TeamOption => Boolean(team))} weeks={weeks} onChange={setMatchups} /> : <BracketPreview teams={teamIds.map((id) => teams.find((team) => team.id === id)).filter((team): team is TeamOption => Boolean(team))} /> : null}
            <div className="tournament-admin-actions"><span>{teamIds.length} {teamIds.length === 1 ? 'team' : 'teams'} seeded</span><div>{teamIds.length > 1 ? <button type="button" className="secondary-cta" onClick={openPreview}><RiEyeLine size={17} /> {showBracket ? 'Hide schedule' : bracketType === 'round_robin' ? 'Edit matchups' : 'View bracket'}</button> : null}<button type="submit" className="btn btn-primary" disabled={isSaving || !name.trim()}>{isSaving ? 'Saving...' : selectedId ? 'Save seeds & format' : 'Create tournament / season'}</button></div></div>
          </form>
        </div>
      </article>
    </section>
  );
}
