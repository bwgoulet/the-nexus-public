'use client';

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { getCharacterIconPath, getStocksPerPlayer } from '@/lib/characters';
import { DEFAULT_MATCH_STREAM_URL } from '@/lib/streams';

type UserRole = 'director' | 'player' | 'mod';
type Team = { id: string; name: string; short_name: string };
type TournamentSeason = { id: string; name: string };
type TeamPlayer = {
  team_id: string | null;
  tag: string | null;
  user: { tag: string | null; first_name: string | null; last_name: string | null } | null;
};
type GameType = 'ultimate' | 'melee';

type CrewRoundInput = {
  home_player_tag: string;
  home_character: string;
  home_stocks_taken: string;
  away_player_tag: string;
  away_character: string;
  away_stocks_taken: string;
  stage: string;
};

type GameInput = {
  rounds: CrewRoundInput[];
};

type StoredCrewRound = {
  round_order: number;
  stage: string | null;
  home_player_tag: string | null;
  home_character: string | null;
  home_stocks_remaining: number | null;
  away_player_tag: string | null;
  away_character: string | null;
  away_stocks_remaining: number | null;
};

const MELEE_CHARACTERS = ['Bowser','Captain Falcon','Donkey Kong','Dr. Mario','Falco','Fox','Ganondorf','Ice Climbers','Jigglypuff','Kirby','Link','Luigi','Mario','Marth','Mewtwo','Mr. Game & Watch','Ness','Peach','Pichu','Pikachu','Roy','Samus','Sheik','Yoshi','Young Link','Zelda'];

const STAGE_OPTIONS = ['Pokémon Stadium 2', 'Small Battlefield', 'Battlefield', 'Town & City', 'Hollow Bastion', 'Smashville', 'Kalos Pokémon League', 'Final Destination', 'Other'];

const ULTIMATE_CHARACTERS = ['Mario','Donkey Kong','Link','Samus','Dark Samus','Yoshi','Kirby','Fox','Pikachu','Luigi','Ness','Captain Falcon','Jigglypuff','Peach','Daisy','Bowser','Ice Climbers','Sheik','Zelda','Dr. Mario','Pichu','Falco','Marth','Lucina','Young Link','Ganondorf','Mewtwo','Roy','Chrom','Mr. Game & Watch','Meta Knight','Pit','Dark Pit','Zero Suit Samus','Wario','Snake','Ike','Pokémon Trainer','Diddy Kong','Lucas','Sonic','King Dedede','Olimar','Lucario','R.O.B.','Toon Link','Wolf','Villager','Mega Man','Wii Fit Trainer','Rosalina & Luma','Little Mac','Greninja','Mii Brawler','Mii Swordfighter','Mii Gunner','Palutena','Pac-Man','Robin','Shulk','Bowser Jr.','Duck Hunt','Ryu','Ken','Cloud','Corrin','Bayonetta','Inkling','Ridley','Simon','Richter','King K. Rool','Isabelle','Incineroar','Piranha Plant','Joker','Hero','Banjo & Kazooie','Terry','Byleth','Min Min','Steve','Sephiroth','Pyra/Mythra','Kazuya','Sora'];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
const newRound = (): CrewRoundInput => ({ home_player_tag: '', home_character: '', home_stocks_taken: '', away_player_tag: '', away_character: '', away_stocks_taken: '', stage: '' });

const newGame = (): GameInput => ({ rounds: [newRound()] });

const swapRoundSides = (round: CrewRoundInput): CrewRoundInput => ({
  home_player_tag: round.away_player_tag,
  home_character: round.away_character,
  home_stocks_taken: round.away_stocks_taken,
  away_player_tag: round.home_player_tag,
  away_character: round.home_character,
  away_stocks_taken: round.home_stocks_taken,
  stage: round.stage
});

const swapGameSides = (game: GameInput): GameInput => ({
  rounds: game.rounds.map(swapRoundSides)
});

const MATCH_GRAPHICS_BUCKET = 'match-graphics';

const uploadGraphicFile = async (supabaseClient: NonNullable<ReturnType<typeof getSupabaseClient>>, file: File) => {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? 'png' : 'png';
  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`;
  const filePath = `uploads/${fileName}`;
  const { error: uploadError } = await supabaseClient.storage.from(MATCH_GRAPHICS_BUCKET).upload(filePath, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = supabaseClient.storage.from(MATCH_GRAPHICS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
};

const computeGameScore = (rounds: CrewRoundInput[], homeRosterSize: number, awayRosterSize: number, gameType: GameType) => {
  const homeTaken = rounds.reduce((sum, round) => sum + Number(round.away_stocks_taken || 0), 0);
  const awayTaken = rounds.reduce((sum, round) => sum + Number(round.home_stocks_taken || 0), 0);
  const stocksPerPlayer = getStocksPerPlayer(gameType);
  return {
    home_score: Math.max(homeRosterSize * stocksPerPlayer - homeTaken, 0),
    away_score: Math.max(awayRosterSize * stocksPerPlayer - awayTaken, 0)
  };
};

const buildRoundsPayload = (gameId: string, rounds: CrewRoundInput[], gameType: GameType) => {
  const stocksPerPlayer = getStocksPerPlayer(gameType);
  const previousStocks = new Map<string, number>();

  return rounds.map((round, roundIndex) => {
    const homePlayerKey = `home:${round.home_player_tag.trim()}`;
    const awayPlayerKey = `away:${round.away_player_tag.trim()}`;

    const homeStocksAtRoundStart = previousStocks.get(homePlayerKey) ?? stocksPerPlayer;
    const awayStocksAtRoundStart = previousStocks.get(awayPlayerKey) ?? stocksPerPlayer;

    const homeStocksRemaining = Math.max(0, homeStocksAtRoundStart - Number(round.away_stocks_taken || 0));
    const awayStocksRemaining = Math.max(0, awayStocksAtRoundStart - Number(round.home_stocks_taken || 0));

    previousStocks.set(homePlayerKey, homeStocksRemaining);
    previousStocks.set(awayPlayerKey, awayStocksRemaining);

    return {
      game_id: gameId,
      round_order: roundIndex + 1,
      stage: round.stage.trim() || 'Unknown',
      home_player_tag: round.home_player_tag.trim(),
      home_character: round.home_character,
      home_character_image: getCharacterIconPath(gameType, round.home_character),
      home_stocks_remaining: homeStocksRemaining,
      away_player_tag: round.away_player_tag.trim(),
      away_character: round.away_character,
      away_character_image: getCharacterIconPath(gameType, round.away_character),
      away_stocks_remaining: awayStocksRemaining
    };
  });
};

const hydrateRoundsForEdit = (storedRounds: StoredCrewRound[], gameType: GameType): CrewRoundInput[] => {
  const stocksPerPlayer = getStocksPerPlayer(gameType);
  const previousStocks = new Map<string, number>();

  return [...storedRounds]
    .sort((a, b) => a.round_order - b.round_order)
    .map((round) => {
      const homeTag = round.home_player_tag?.trim() ?? '';
      const awayTag = round.away_player_tag?.trim() ?? '';
      const homePlayerKey = `home:${homeTag}`;
      const awayPlayerKey = `away:${awayTag}`;

      const homeStocksAtRoundStart = previousStocks.get(homePlayerKey) ?? stocksPerPlayer;
      const awayStocksAtRoundStart = previousStocks.get(awayPlayerKey) ?? stocksPerPlayer;

      const homeStocksRemaining = Math.max(0, Number(round.home_stocks_remaining ?? homeStocksAtRoundStart));
      const awayStocksRemaining = Math.max(0, Number(round.away_stocks_remaining ?? awayStocksAtRoundStart));

      const awayStocksTaken = String(Math.max(homeStocksAtRoundStart - homeStocksRemaining, 0));
      const homeStocksTaken = String(Math.max(awayStocksAtRoundStart - awayStocksRemaining, 0));

      previousStocks.set(homePlayerKey, homeStocksRemaining);
      previousStocks.set(awayPlayerKey, awayStocksRemaining);

      return {
        home_player_tag: homeTag,
        home_character: round.home_character ?? '',
        home_stocks_taken: homeStocksTaken,
        away_player_tag: awayTag,
        away_character: round.away_character ?? '',
        away_stocks_taken: awayStocksTaken,
        stage: round.stage ?? ''
      };
    });
};

const isRoundComplete = (round: CrewRoundInput) =>
  Boolean(
    round.stage.trim() &&
    round.home_player_tag.trim() &&
    round.home_character &&
    round.home_stocks_taken !== '' &&
    round.away_player_tag.trim() &&
    round.away_character &&
    round.away_stocks_taken !== ''
  );

function AddMatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();
  const editSlug = searchParams.get('edit')?.trim() ?? '';
  const isEditing = editSlug.length > 0;
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentsSeasons, setTournamentsSeasons] = useState<TournamentSeason[]>([]);
  const [tournamentSeasonId, setTournamentSeasonId] = useState('');
  const [isAddingTournamentSeason, setIsAddingTournamentSeason] = useState(false);
  const [newTournamentSeasonName, setNewTournamentSeasonName] = useState('');
  const [isCreatingTournamentSeason, setIsCreatingTournamentSeason] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [date, setDate] = useState('');
  const [streamUrl, setStreamUrl] = useState(DEFAULT_MATCH_STREAM_URL);
  const [gameType, setGameType] = useState<GameType>('ultimate');
  const [homeRosterSize, setHomeRosterSize] = useState('4');
  const [awayRosterSize, setAwayRosterSize] = useState('4');
  const [graphicFile, setGraphicFile] = useState<File | null>(null);
  const [manualHomeScore, setManualHomeScore] = useState('');
  const [manualAwayScore, setManualAwayScore] = useState('');
  const [games, setGames] = useState<GameInput[]>([]);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [draftGame, setDraftGame] = useState<GameInput>(newGame());
  const [editingGameIndex, setEditingGameIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);


  useEffect(() => { if (!supabase) return; let mounted = true; const init = async () => {
    const { data: { session } } = await supabase.auth.getSession(); if (!session) { router.replace('/signup'); return; }
    const { data: profile, error: profileError } = await supabase.from('users').select('role').eq('id', session.user.id).maybeSingle<{ role: UserRole }>();
    if (!mounted) return; if (profileError || !profile) { setError('Unable to verify admin role right now. Please retry in a moment.'); setIsChecking(false); return; }
    if (profile.role !== 'mod') { router.replace('/dashboard'); return; }
    const [{ data: teamRows, error: teamsError }, { data: playerRows, error: playersError }, { data: tournamentSeasonRows, error: tournamentsSeasonsError }] = await Promise.all([
      supabase.from('teams').select('id,name,short_name').order('name', { ascending: true }),
      supabase.from('players').select('team_id,tag,user:users(tag,first_name,last_name)'),
      supabase.from('tournaments_seasons').select('id,name').order('name', { ascending: true })
    ]);
    if (!mounted) return;
    if (teamsError) setError(teamsError.message); else setTeams((teamRows as Team[]) ?? []);
    if (playersError) setError(playersError.message); else setTeamPlayers((playerRows as TeamPlayer[]) ?? []);
    if (tournamentsSeasonsError) setError(tournamentsSeasonsError.message); else setTournamentsSeasons((tournamentSeasonRows as TournamentSeason[]) ?? []);
    setIsAuthorized(true); setIsChecking(false);
  }; void init(); return () => { mounted = false; }; }, [router, supabase]);

  const hasValidTeams = Boolean(homeTeamId && awayTeamId && homeTeamId !== awayTeamId);
  const hasValidRosterSizes = Number(homeRosterSize) > 0 && Number(awayRosterSize) > 0;
  const allGamesComplete = games.every((game) => game.rounds.length > 0 && game.rounds.every(isRoundComplete));
  const hasManualScore = manualHomeScore !== '' && manualAwayScore !== '' && Number.isFinite(Number(manualHomeScore)) && Number.isFinite(Number(manualAwayScore));
  const derivedStatus: 'upcoming' | 'completed' = games.length > 0 || hasManualScore ? 'completed' : 'upcoming';
  const formComplete = useMemo(
    () => Boolean(hasValidTeams && tournamentSeasonId && date && gameType && hasValidRosterSizes && (games.length === 0 || allGamesComplete)),
    [date, gameType, hasValidRosterSizes, hasValidTeams, tournamentSeasonId, allGamesComplete, games.length]
  );
  const chars = useMemo(() => (gameType === 'ultimate' ? ULTIMATE_CHARACTERS : MELEE_CHARACTERS).toSorted((a, b) => a.localeCompare(b)), [gameType]);

  useEffect(() => {
    if (!supabase || !isAuthorized || !editSlug) return;

    let isMounted = true;

    const loadExistingMatch = async () => {
      setError('');
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,home_score,away_score,games(id,game_order,game,home_roster_size,away_roster_size,match_crew_rounds(round_order,stage,home_player_tag,home_character,home_stocks_remaining,away_player_tag,away_character,away_stocks_remaining))')
        .eq('slug', editSlug)
        .maybeSingle();

      if (!isMounted) return;
      if (matchError || !matchData) {
        setError('Unable to load match for editing.');
        return;
      }

      const existingMatch = matchData as {
        id: string; date: string; home_team_id: string; away_team_id: string; tournament_season_id: string; stream_url: string | null;
        home_score: number | null; away_score: number | null;
        games: Array<{ id: string; game_order: number; game: GameType; home_roster_size: number; away_roster_size: number; match_crew_rounds: StoredCrewRound[] }> | null;
      };

      setEditingMatchId(existingMatch.id);
      setHomeTeamId(existingMatch.home_team_id);
      setAwayTeamId(existingMatch.away_team_id);
      setTournamentSeasonId(existingMatch.tournament_season_id);
      setDate(existingMatch.date.slice(0, 16));
      setStreamUrl(existingMatch.stream_url ?? DEFAULT_MATCH_STREAM_URL);
      setManualHomeScore(existingMatch.home_score === null ? '' : String(existingMatch.home_score));
      setManualAwayScore(existingMatch.away_score === null ? '' : String(existingMatch.away_score));

      const orderedGames = (existingMatch.games ?? []).sort((a, b) => a.game_order - b.game_order);
      if (orderedGames[0]) {
        setGameType(orderedGames[0].game);
        setHomeRosterSize(String(orderedGames[0].home_roster_size));
        setAwayRosterSize(String(orderedGames[0].away_roster_size));
      }

      setGames(
        orderedGames.map((game) => ({
          rounds: hydrateRoundsForEdit(game.match_crew_rounds ?? [], game.game)
        }))
      );
    };

    void loadExistingMatch();
    return () => {
      isMounted = false;
    };
  }, [editSlug, isAuthorized, supabase]);

  const homeTeamPlayers = useMemo(() => teamPlayers.filter((player) => player.team_id === homeTeamId).map((player) => ({
    tag: player.user?.tag?.trim() || player.tag?.trim() || '',
    name: [player.user?.first_name, player.user?.last_name].filter(Boolean).join(' ').trim()
  })).filter((player) => player.tag), [homeTeamId, teamPlayers]);
  const awayTeamPlayers = useMemo(() => teamPlayers.filter((player) => player.team_id === awayTeamId).map((player) => ({
    tag: player.user?.tag?.trim() || player.tag?.trim() || '',
    name: [player.user?.first_name, player.user?.last_name].filter(Boolean).join(' ').trim()
  })).filter((player) => player.tag), [awayTeamId, teamPlayers]);

  const handleGraphicFileChange = (event: ChangeEvent<HTMLInputElement>) => setGraphicFile(event.target.files?.[0] ?? null);

  const handleSwapSides = () => {
    setHomeTeamId(awayTeamId);
    setAwayTeamId(homeTeamId);
    setHomeRosterSize(awayRosterSize);
    setAwayRosterSize(homeRosterSize);
    setManualHomeScore(manualAwayScore);
    setManualAwayScore(manualHomeScore);
    setGames((currentGames) => currentGames.map(swapGameSides));
    setDraftGame((currentDraft) => swapGameSides(currentDraft));
    setSuccess('Home and away data swapped. Review the fixture, then select Update Match to save.');
    setError('');
  };

  const handleCreateTournamentSeason = async () => {
    const name = newTournamentSeasonName.trim();
    if (!supabase || !name) return;
    setError(''); setIsCreatingTournamentSeason(true);
    const { data, error: createError } = await supabase.rpc('create_tournament_season' as never, { requested_name: name } as never);
    setIsCreatingTournamentSeason(false);
    if (createError || !data) return setError(createError?.message ?? 'Unable to add the tournament or season.');
    const created = (Array.isArray(data) ? data[0] : data) as TournamentSeason | undefined;
    if (!created) return setError('The tournament or season was added, but its details could not be loaded.');
    setTournamentsSeasons((current) => [...current.filter((entry) => entry.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)));
    setTournamentSeasonId(created.id); setNewTournamentSeasonName(''); setIsAddingTournamentSeason(false);
  };

  const handleDeleteMatch = async () => {
    if (!supabase || !editingMatchId) return;

    const matchLabel = homeTeamId && awayTeamId
      ? `${teams.find((team) => team.id === homeTeamId)?.name ?? 'Home team'} vs ${teams.find((team) => team.id === awayTeamId)?.name ?? 'Away team'}`
      : 'this match';
    const confirmed = window.confirm(`Delete ${matchLabel}? This permanently removes the match and all of its game data. This action cannot be undone.`);
    if (!confirmed) return;

    setError(''); setSuccess(''); setWarning(''); setIsDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsDeleting(false);
      setError('Your session has expired. Sign in again before deleting this match.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/matches/${encodeURIComponent(editingMatchId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setIsDeleting(false);
        setError(result?.error ?? 'Unable to delete this match.');
        return;
      }
    } catch {
      setIsDeleting(false);
      setError('Unable to reach the server. Check your connection and try again.');
      return;
    }

    setSuccess('Match deleted successfully. Returning to the match list...');
    window.location.assign('/admin/update-match');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setSuccess(''); setWarning('');
    if (!supabase) return setError('Supabase is not configured.');
    if (!formComplete) return setError('Please complete all required fields.');
    if (homeTeamId === awayTeamId) return setError('Home and away teams must be different.');
    const home = teams.find((team) => team.id === homeTeamId); const away = teams.find((team) => team.id === awayTeamId);
    if (!home || !away) return setError('Please select valid teams.');
    const matchDate = new Date(date);
    const datePart = matchDate.toISOString().slice(0, 10);
    const timePart = matchDate.toISOString().slice(11, 16).replace(':', '');
    const slug = `${slugify(home.name)}-vs-${slugify(away.name)}-${datePart}-${timePart}`;
    setIsSubmitting(true);

    let graphicUrl: string | null = null;
    if (graphicFile) {
      try {
        graphicUrl = await uploadGraphicFile(supabase, graphicFile);
      } catch (uploadError) {
        const uploadMessage = uploadError instanceof Error ? uploadError.message : 'Failed to upload match graphic.';
        const normalizedMessage = uploadMessage.toLowerCase();
        if (normalizedMessage.includes('bucket not found')) {
          setWarning('Graphic upload bucket is not configured yet. Match will be created without a graphic.');
          graphicUrl = null;
        } else if (
          normalizedMessage.includes('row-level security') ||
          normalizedMessage.includes('unauthorized')
        ) {
          setWarning('Graphic upload is blocked by Supabase storage policies. Match was created without a graphic. Update storage INSERT policy for authenticated admins to enable uploads.');
          graphicUrl = null;
        } else {
          setIsSubmitting(false);
          return setError(uploadMessage);
        }
      }
    }

    const gameScores = games.map((gameInput) =>
      computeGameScore(gameInput.rounds, Number(homeRosterSize || 5), Number(awayRosterSize || 5), gameType)
    );
    const matchScore = gameScores.reduce(
      (result, score) => {
        if (score.home_score > score.away_score) result.home += 1;
        if (score.away_score > score.home_score) result.away += 1;
        return result;
      },
      { home: 0, away: 0 }
    );

    const resolvedHomeScore = games.length > 0 ? matchScore.home : hasManualScore ? Number(manualHomeScore) : null;
    const resolvedAwayScore = games.length > 0 ? matchScore.away : hasManualScore ? Number(manualAwayScore) : null;

    let matchId = editingMatchId;
    if (isEditing && editingMatchId) {
      const { error: updateError } = await supabase
        .from('matches' as never)
        .update({
          slug,
          date,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          tournament_season_id: tournamentSeasonId,
          stream_url: streamUrl.trim() || null,
          status: derivedStatus,
          format: 'crew_battle',
          home_score: derivedStatus === 'completed' ? resolvedHomeScore : null,
          away_score: derivedStatus === 'completed' ? resolvedAwayScore : null,
          ...(graphicUrl ? { graphic: graphicUrl } : {})
        } as never)
        .eq('id', editingMatchId);
      if (updateError) { setIsSubmitting(false); return setError(updateError.message); }
      const { data: existingGames } = await supabase.from('games').select('id').eq('match_id', editingMatchId);
      const gameIds = ((existingGames as { id: string }[] | null) ?? []).map((g) => g.id);
      if (gameIds.length > 0) await supabase.from('match_crew_rounds').delete().in('game_id', gameIds);
      await supabase.from('games').delete().eq('match_id', editingMatchId);
    } else {
      const { data: matchRowData, error: insertError } = await supabase.from('matches' as never).insert({ slug, date, home_team_id: homeTeamId, away_team_id: awayTeamId, tournament_season_id: tournamentSeasonId, stream_url: streamUrl.trim() || null, status: derivedStatus, format: 'crew_battle', home_score: derivedStatus === 'completed' ? resolvedHomeScore : null, away_score: derivedStatus === 'completed' ? resolvedAwayScore : null, graphic: graphicUrl } as never).select('id').single();
      const matchRow = matchRowData as { id: string } | null;
      if (insertError || !matchRow) { setIsSubmitting(false); return setError(insertError?.message ?? 'Failed to create match.'); }
      matchId = matchRow.id;
    }

    for (let gameIndex = 0; gameIndex < games.length; gameIndex += 1) {
      const gameInput = games[gameIndex];
      const gameSlug = `${slug}-game-${gameIndex + 1}`;
      const calculated = gameScores[gameIndex];
      const { data: gameRowData, error: gameError } = await supabase.from('games' as never).insert({ match_id: matchId, game_order: gameIndex + 1, game_slug: gameSlug, game: gameType, home_roster_size: Number(homeRosterSize), away_roster_size: Number(awayRosterSize), home_score: calculated.home_score, away_score: calculated.away_score } as never).select('id').single();
      const gameRow = gameRowData as { id: string } | null;
      if (gameError || !gameRow) { setIsSubmitting(false); return setError(gameError?.message ?? `Failed to create game ${gameIndex + 1}.`); }

      const roundsPayload = buildRoundsPayload(gameRow.id, gameInput.rounds, gameType);
      if (roundsPayload.length > 0) {
        const { error: roundsError } = await supabase.from('match_crew_rounds' as never).insert(roundsPayload as never);
        if (roundsError) { setIsSubmitting(false); return setError(roundsError.message); }
      }
    }

    setIsSubmitting(false);
    setSuccess(isEditing ? 'Match updated successfully. Redirecting to match details...' : 'Match created successfully. Redirecting to match details...');

    // Force a full document navigation after writes to avoid intermittently rendering
    // stale RSC payloads when app-router client cache is ahead of freshly mutated match data.
    window.location.assign(`/matches/${slug}`);
  };

  if (isChecking) return <section className="auth-shell admin-portal-shell"><article className="login-modal card add-match-modal"><p className="muted">Checking admin access...</p></article></section>;
  if (!isAuthorized) return null;

  const homeTeam = teams.find((team) => team.id === homeTeamId);
  const awayTeam = teams.find((team) => team.id === awayTeamId);

  return <section className="auth-shell admin-portal-shell match-sheet-shell"><article className="match-sheet-card">
    <header className="match-sheet-hero">
      <div>
        <p className="match-sheet-kicker">Admin Portal · Crew battle sheet</p>
        <h1>{isEditing ? 'Update Match' : 'Add Match'}</h1>
        <p>Enter fixtures the same way directors record them on match night: teams across the top, game rows underneath, fast status feedback below.</p>
      </div>
      <div className="match-sheet-status" aria-label="Match status preview">
        <span>Status</span>
        <strong>{derivedStatus}</strong>
      </div>
    </header>

    <form className="match-sheet-form" onSubmit={handleSubmit}>
      <section className="match-sheet-fixture" aria-labelledby="fixture-details-heading">
        <div className="match-sheet-band">
          <span>Fixture setup</span>
          <strong>{homeTeam?.short_name || 'Team A'} vs {awayTeam?.short_name || 'Team B'}</strong>
          {isEditing ? <button type="button" className="secondary-cta" onClick={handleSwapSides} disabled={isSubmitting || isDeleting || !homeTeamId || !awayTeamId}>⇄ Swap home &amp; away</button> : null}
        </div>
        <div className="match-sheet-grid match-sheet-grid-fixture">
          <label className="sheet-cell sheet-cell-team sheet-cell-home"><span>Team A *</span><select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} required><option value="">Select home team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.short_name})</option>)}</select></label>
          <label className="sheet-cell"><span>Game *</span><select value={gameType} onChange={(e) => setGameType(e.target.value as GameType)}><option value="ultimate">Ultimate</option><option value="melee">Melee</option></select></label>
          <label className="sheet-cell"><span>Date / Time *</span><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label className="sheet-cell sheet-cell-team sheet-cell-away"><span>Team B *</span><select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} required><option value="">Select away team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.short_name})</option>)}</select></label>
          <div className="sheet-cell sheet-cell-wide"><label><span>Tournament / Season *</span><select value={isAddingTournamentSeason ? '__add_new__' : tournamentSeasonId} onChange={(event) => { if (event.target.value === '__add_new__') { setIsAddingTournamentSeason(true); return; } setIsAddingTournamentSeason(false); setTournamentSeasonId(event.target.value); }} required><option value="">Select a tournament or season</option>{tournamentsSeasons.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}<option value="__add_new__">+ Add a new tournament or season</option></select></label>{isAddingTournamentSeason ? <div className="sheet-inline-add"><input aria-label="New tournament or season name" value={newTournamentSeasonName} onChange={(event) => setNewTournamentSeasonName(event.target.value)} placeholder="e.g. Nexus 2026 Season 2" /><button type="button" className="secondary-cta" disabled={isCreatingTournamentSeason || !newTournamentSeasonName.trim()} onClick={() => void handleCreateTournamentSeason()}>{isCreatingTournamentSeason ? 'Adding...' : 'Add'}</button><button type="button" className="secondary-cta" onClick={() => { setIsAddingTournamentSeason(false); setNewTournamentSeasonName(''); }}>Cancel</button></div> : null}</div>
          <label className="sheet-cell"><span>Team A roster *</span><input type="number" min="1" value={homeRosterSize} onChange={(e) => setHomeRosterSize(e.target.value)} required /></label>
          <label className="sheet-cell"><span>Team B roster *</span><input type="number" min="1" value={awayRosterSize} onChange={(e) => setAwayRosterSize(e.target.value)} required /></label>
          <label className="sheet-cell"><span>Team A score</span><input type="number" value={manualHomeScore} onChange={(e) => setManualHomeScore(e.target.value)} placeholder="Optional" /></label>
          <label className="sheet-cell"><span>Team B score</span><input type="number" value={manualAwayScore} onChange={(e) => setManualAwayScore(e.target.value)} placeholder="Optional" /></label>
          <label className="sheet-cell sheet-cell-wide"><span>Stream / VOD URL</span><input type="url" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://..." /></label>
          <label className="sheet-cell sheet-cell-wide"><span>Graphic upload</span><input type="file" accept="image/*" onChange={handleGraphicFileChange} /></label>
        </div>
      </section>

      <section className="match-sheet-games" aria-labelledby="game-sheet-heading">
        <div className="match-sheet-band"><span id="game-sheet-heading">Games ({games.length})</span><button type="button" className="secondary-cta" onClick={() => { setDraftGame(newGame()); setEditingGameIndex(null); setIsGameModalOpen(true); }}>+ Add Game</button></div>
        {games.length === 0 ? <div className="match-sheet-empty"><strong>No games added yet.</strong><span>Add a game to input spreadsheet-style crew rounds.</span></div> : <div className="match-sheet-game-list">{games.map((game, idx) => <div key={`game-preview-${idx}`} className="match-sheet-game-card"><div><span>Game {idx + 1}</span><strong>{game.rounds.length} rounds logged</strong></div><div className="match-sheet-game-actions"><button type="button" className="secondary-cta" onClick={() => { setDraftGame(game); setEditingGameIndex(idx); setIsGameModalOpen(true); }}>Edit rows</button><button type="button" className="secondary-cta sheet-danger" onClick={() => setGames((prev) => prev.filter((_, gameIndex) => gameIndex !== idx))}>Delete</button></div></div>)}</div>}
      </section>

      <section className="match-sheet-feedback">
        {error ? <p className="error-message">{error}</p> : null}
        {warning ? <p className="text-sm text-amber-200">{warning}</p> : null}
        {success ? <p className="muted">{success}</p> : null}
        {!formComplete ? <p className="sheet-warning">Complete required fixture fields and every game row to enable {isEditing ? 'Update Match' : 'Create Match'}.</p> : <p className="sheet-ready">All required fields complete. Ready to {isEditing ? 'update' : 'create'} match.</p>}
        <div className="match-sheet-submit-actions">
          <button type="submit" className="primary-cta match-sheet-submit" disabled={isSubmitting || isDeleting || !formComplete}>{isSubmitting ? 'Saving...' : isEditing ? 'Update Match' : 'Create Match'}</button>
          {isEditing ? <button type="button" className="secondary-cta sheet-danger match-sheet-delete" onClick={() => void handleDeleteMatch()} disabled={isSubmitting || isDeleting || !editingMatchId}>{isDeleting ? 'Deleting match...' : 'Delete match'}</button> : null}
        </div>
      </section>
    </form>
  </article>

  {isGameModalOpen ? <div className="match-sheet-modal-backdrop"><div className="match-sheet-modal"><div className="match-sheet-modal-header"><div><p className="match-sheet-kicker">Round entry sheet</p><h3>{editingGameIndex !== null ? `Edit Game ${editingGameIndex + 1}` : 'Add Game & Rounds'}</h3></div><button type="button" className="secondary-cta" onClick={() => { setIsGameModalOpen(false); setEditingGameIndex(null); }}>Close</button></div>
    <div className="round-sheet-wrap"><table className="round-sheet"><thead><tr><th>Team A Player</th><th>Character</th><th>Stocks Taken</th><th>Stage</th><th>Team B Player</th><th>Character</th><th>Stocks Taken</th><th></th></tr></thead><tbody>{draftGame.rounds.map((round, roundIndex) => <tr key={`draft-round-${roundIndex}`}><td><select aria-label={`Round ${roundIndex + 1} Team A player`} value={round.home_player_tag} onChange={(e) => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.map((r, i) => i === roundIndex ? { ...r, home_player_tag: e.target.value } : r) }))} required><option value="">Player</option>{homeTeamPlayers.map((player) => <option key={player.tag} value={player.tag}>{player.name ? `${player.tag} (${player.name})` : player.tag}</option>)}</select></td><td><select aria-label={`Round ${roundIndex + 1} Team A character`} value={round.home_character} onChange={(e) => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.map((r, i) => i === roundIndex ? { ...r, home_character: e.target.value } : r) }))} required><option value="">Character</option>{chars.map((character) => <option key={character} value={character}>{character}</option>)}</select></td><td><input aria-label={`Round ${roundIndex + 1} Team A stocks taken`} type="number" min="0" value={round.home_stocks_taken} onChange={(e) => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.map((r, i) => i === roundIndex ? { ...r, home_stocks_taken: e.target.value } : r) }))} required /></td><td><select aria-label={`Round ${roundIndex + 1} stage`} value={round.stage} onChange={(e) => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.map((r, i) => i === roundIndex ? { ...r, stage: e.target.value } : r) }))} required><option value="">Stage</option>{STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></td><td><select aria-label={`Round ${roundIndex + 1} Team B player`} value={round.away_player_tag} onChange={(e) => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.map((r, i) => i === roundIndex ? { ...r, away_player_tag: e.target.value } : r) }))} required><option value="">Player</option>{awayTeamPlayers.map((player) => <option key={player.tag} value={player.tag}>{player.name ? `${player.tag} (${player.name})` : player.tag}</option>)}</select></td><td><select aria-label={`Round ${roundIndex + 1} Team B character`} value={round.away_character} onChange={(e) => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.map((r, i) => i === roundIndex ? { ...r, away_character: e.target.value } : r) }))} required><option value="">Character</option>{chars.map((character) => <option key={character} value={character}>{character}</option>)}</select></td><td><input aria-label={`Round ${roundIndex + 1} Team B stocks taken`} type="number" min="0" value={round.away_stocks_taken} onChange={(e) => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.map((r, i) => i === roundIndex ? { ...r, away_stocks_taken: e.target.value } : r) }))} required /></td><td><button type="button" className="round-sheet-remove" aria-label={`Remove round ${roundIndex + 1}`} onClick={() => setDraftGame((prev) => ({ ...prev, rounds: prev.rounds.length === 1 ? [newRound()] : prev.rounds.filter((_, i) => i !== roundIndex) }))}>×</button></td></tr>)}</tbody></table></div>
    <div className="match-sheet-modal-actions"><button type="button" className="secondary-cta" onClick={() => setDraftGame((prev) => ({ ...prev, rounds: [...prev.rounds, newRound()] }))}>+ Add Row</button><button type="button" className="primary-cta" onClick={() => { setGames((prev) => editingGameIndex === null ? [...prev, draftGame] : prev.map((game, idx) => idx === editingGameIndex ? draftGame : game)); setIsGameModalOpen(false); setEditingGameIndex(null); }}>{editingGameIndex !== null ? 'Update Game' : 'Save Game'}</button></div>
  </div></div> : null}
  </section>;
}

export default function AddMatchPage() {
  return (
    <Suspense fallback={<section className="auth-shell admin-portal-shell"><article className="login-modal card add-match-modal"><p className="muted">Loading match editor...</p></article></section>}>
      <AddMatchForm />
    </Suspense>
  );
}
