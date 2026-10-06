import { unstable_cache } from 'next/cache';

import { resolveCharacterImagePath, type GameType } from '@/lib/characters';
import { getSupabaseClient } from '@/lib/supabase';

export type Role = 'director' | 'member_director' | 'pro_director' | 'exclusive_director' | 'player' | 'mod';

export interface User {
  id: string;
  email: string;
  verified: boolean;
  first_name: string;
  last_name: string;
  tag: string;
  role: Role;
  avatar: string;
  x_handle: string | null;
  discord_handle: string | null;
}

export interface Team {
  id: string;
  name: string;
  short_name: string;
  avatar: string | null;
  school_site_url: string | null;
  graphics: TeamGraphics;
  director_tag: string;
  director_user_id?: string | null;
  player_user_ids?: string[];
  wins: number;
  losses: number;
  tier: number;
}

export type DirectorEquivalentRole = Extract<Role, 'director' | 'member_director' | 'pro_director' | 'exclusive_director'>;

export interface DirectorAssignment {
  id: string;
  first_name: string;
  last_name: string;
  tag: string | null;
  email: string;
  role: DirectorEquivalentRole;
  team: Pick<Team, 'id' | 'name' | 'short_name'> | null;
}

export interface DirectorReassignmentResult {
  director_user_id: string;
  destination_team_id: string;
  previous_team_ids: string[];
  replaced_director_user_id: string | null;
}

export type TeamGraphic = {
  name: string;
  url: string;
  uploadedAt: string;
};

export type TeamGraphics = Record<string, TeamGraphic>;

export interface Player {
  id: string;
  user_id?: string | null;
  team_id: string | null;
  tag: string;
  first_name?: string | null;
  last_name?: string | null;
  is_captain?: boolean;
  matches: string[];
  wins: number;
  losses: number;
}

export type PlayerTeamJoinRequestStatus = 'pending' | 'accepted' | 'denied';

export interface PlayerTeamJoinRequest {
  id: string;
  user_id: string;
  team_id: string;
  status: PlayerTeamJoinRequestStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerRosterInvite {
  id: string;
  player_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  created_by_user_id: string;
  revoked_at: string | null;
  claimed_at: string | null;
  claimed_by_user_id: string | null;
}

export type MatchStatus = 'upcoming' | 'live' | 'completed';

export interface TournamentSeason {
  id: string;
  slug?: string;
  name: string;
  bracket_type?: 'double_elimination' | 'round_robin';
  competition_type?: 'tournament' | 'season';
  registration_status?: 'open' | 'closed';
  weeks?: number | null;
  team_ids?: string[];
}

export interface CompetitionTeam {
  id: string;
  name: string;
  short_name: string;
  avatar: string | null;
  seed: number | null;
}

export interface CompetitionMatch {
  id: string;
  slug: string;
  date: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_team: Omit<CompetitionTeam, 'seed'>;
  away_team: Omit<CompetitionTeam, 'seed'>;
}

export interface CompetitionMatchup {
  id: string;
  week: number;
  home_team: Omit<CompetitionTeam, 'seed'>;
  away_team: Omit<CompetitionTeam, 'seed'>;
  scheduled_at?: string | null;
}

export interface CompetitionDetail extends Required<Pick<TournamentSeason, 'id' | 'slug' | 'name' | 'bracket_type' | 'competition_type' | 'registration_status'>> {
  weeks: number | null;
  teams: CompetitionTeam[];
  matches: CompetitionMatch[];
  matchups: CompetitionMatchup[];
}

export const tournamentSeasons: TournamentSeason[] = [
  { id: 'tournament-season-preseason-2026', name: 'Nexus 2026 Preseason' },
  { id: 'c50e0270-bc10-4bf9-a07a-4d245b2c5c9f', name: 'Season 1 - Fall 2026', slug: 'season-1-fall-2026' }
];

export interface Match {
  id: string;
  slug: string;
  date: string;
  home_team_id: string;
  away_team_id: string;
  tournament_season_id: string;
  stream_url: string | null;
  status: MatchStatus;
  format: 'crew_battle';
  home_score: number | null;
  away_score: number | null;
  graphic: string | null;
}

export interface MatchDirectorCheckIn {
  id: string;
  match_id: string;
  team_id: string;
  director_user_id: string;
  checked_in_at: string;
}

export interface MatchEndConfirmation {
  id: string;
  match_id: string;
  team_id: string;
  director_user_id: string;
  confirmed_at: string;
}

export interface Game {
  id: string;
  match_id: string;
  game_order: number;
  game_slug: string;
  game: 'melee' | 'ultimate';
  home_roster_size: number;
  away_roster_size: number;
  home_score: number | null;
  away_score: number | null;
}

export type LiveMatchPhase = 'check_in' | 'blind_pick' | 'player_select' | 'stage_strike' | 'playing' | 'score_verify' | 'complete';

export interface LiveMatchStateRow {
  match_id: string;
  revision: number;
  game_id: string | null;
  phase: LiveMatchPhase;
  round_number: number;
  selected_stage: string | null;
  rps_home_choice: 'rock' | 'paper' | 'scissors' | null;
  rps_away_choice: 'rock' | 'paper' | 'scissors' | null;
  rps_winner_team_id: string | null;
  rps_tie_count: number;
  home_active_player_id: string | null;
  away_active_player_id: string | null;
  previous_round_loser_team_id: string | null;
  home_stocks: number;
  away_stocks: number;
  home_round_start_stocks: number;
  away_round_start_stocks: number;
  score_submitted_by_team_id: string | null;
  score_verified_by_team_id: string | null;
  pending_home_score: number | null;
  pending_away_score: number | null;
  updated_at: string;
}

export interface LiveMatchRosterSelection {
  match_id: string;
  team_id: string;
  player_id: string;
  slot_order: number;
  selected_character: string;
  selected_character_image: string;
  stocks_remaining: number;
}

export interface LiveMatchBlindPick {
  match_id: string;
  team_id: string;
  player_id: string;
  pick_order: number;
}


export interface LiveMatchStageAction {
  id: string;
  match_id: string;
  game_id: string | null;
  round_number: number;
  team_id: string;
  stage: string;
  action: 'strike' | 'ban' | 'pick';
  created_at: string;
}

export interface LiveMatchActionResult {
  conflict: boolean;
  state: LiveMatchStateRow;
  roster_selections: LiveMatchRosterSelection[];
  blind_picks: LiveMatchBlindPick[];
  stage_actions: LiveMatchStageAction[];
}

export interface LiveRoomRpcArguments {
  live_submit_blind_picks: {
    target_match_id: string;
    expected_revision: number;
    target_side: 'home' | 'away';
    player_ids: string[];
  };
  live_reset_player_selection: {
    target_match_id: string;
    expected_revision: number;
    target_side: 'home' | 'away';
  };
  live_reset_stage: {
    target_match_id: string;
    expected_revision: number;
    target_side: 'home' | 'away';
  };
  live_update_character: {
    target_match_id: string;
    expected_revision: number;
    target_side: 'home' | 'away';
    player_id: string;
    selected_character: string;
    selected_character_image: string;
  };
}

export type LiveRoomRpcName = keyof LiveRoomRpcArguments;

export interface LiveMatchMessage {
  id: string;
  match_id: string;
  user_id: string;
  team_id: string | null;
  message: string;
  created_at: string;
}

export interface LiveRoomSnapshotTeam {
  id: string;
  name: string;
  short_name: string;
  avatar: string | null;
  director_user_id: string | null;
}

export interface LiveRoomSnapshotPlayer {
  id: string;
  team_id: string;
  tag: string;
}

export interface LiveRoomSnapshotGame {
  id: string;
  game: 'melee' | 'ultimate';
  game_order: number;
  home_roster_size: number;
  away_roster_size: number;
}

export interface LiveRoomSnapshotChatMessage extends LiveMatchMessage {
  author_tag: string | null;
  author_role: string | null;
}

/** Canonical, read-only payload returned by get_live_match_room_snapshot. */
export interface LiveMatchRoomSnapshot {
  fixture: {
    id: string;
    slug: string;
    date: string;
    status: 'upcoming' | 'live' | 'completed';
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
  };
  home_team: LiveRoomSnapshotTeam;
  away_team: LiveRoomSnapshotTeam;
  players: LiveRoomSnapshotPlayer[];
  active_game: LiveRoomSnapshotGame | null;
  live_state: LiveMatchStateRow | null;
  check_in_team_ids: string[];
  roster_selections: LiveMatchRosterSelection[];
  blind_picks: LiveMatchBlindPick[];
  stage_actions: LiveMatchStageAction[];
  viewer: {
    user_id: string | null;
    tag: string | null;
    role: string | null;
    authorized_side: 'home' | 'away' | null;
    can_operate: boolean;
  };
  chat_messages: LiveRoomSnapshotChatMessage[];
  has_earlier_messages: boolean;
}

export interface CrewBattleRound {
  id: string;
  game_id: string;
  round_order: number;
  stage: string;
  home_player_tag: string;
  home_character: string;
  home_character_image: string;
  home_stocks_remaining: number;
  away_player_tag: string;
  away_character: string;
  away_character_image: string;
  away_stocks_remaining: number;
}

export const teams: Team[] = [
  { id: 'team-1', name: 'Emerald Ravens', short_name: 'RAV', avatar: '/logos/Primary/PNG/Nexus Emerald Small.png', school_site_url: 'https://example.edu/esports', graphics: {}, director_tag: 'Astra', director_user_id: null, player_user_ids: [], wins: 2, losses: 1, tier: 1 },
  { id: 'team-2', name: 'Triad', short_name: 'TRI', avatar: '/logos/Secondary/PNG/Nexus Magenta Small.png', school_site_url: null, graphics: {}, director_tag: 'Cipher', director_user_id: null, player_user_ids: [], wins: 3, losses: 0, tier: 2 },
  { id: 'team-3', name: 'Invaders', short_name: 'INV', avatar: '/logos/B&W/PNG/Solid White.png', school_site_url: null, graphics: {}, director_tag: 'Orbit', director_user_id: null, player_user_ids: [], wins: 1, losses: 2, tier: 0 }
];

export const players: Player[] = [
  { id: 'player-1', team_id: 'team-1', tag: 'Nova', first_name: 'Noah', last_name: 'Vale', is_captain: true, matches: ['match-inv-vs-rav', 'match-rav-vs-tri'], wins: 7, losses: 3 },
  { id: 'player-2', team_id: 'team-1', tag: 'Mako', matches: ['match-inv-vs-rav'], wins: 6, losses: 4 },
  { id: 'player-3', team_id: 'team-2', tag: 'Riven', first_name: 'Miles', last_name: 'Kim', matches: ['match-tri-vs-inv', 'match-rav-vs-tri'], wins: 8, losses: 2 },
  { id: 'player-4', team_id: 'team-2', tag: 'Sora', matches: ['match-tri-vs-inv'], wins: 5, losses: 5 },
  { id: 'player-5', team_id: 'team-3', tag: 'Talon', matches: ['match-tri-vs-inv', 'match-inv-vs-rav'], wins: 4, losses: 6 }
];

export const users: User[] = [
  {
    id: 'user-1',
    email: 'astra@nexus.gg',
    verified: true,
    first_name: 'Ana',
    last_name: 'Rivera',
    tag: 'Astra',
    role: 'director',
    avatar: '/logos/Secondary/PNG/Nexus Magenta Small.png',
    x_handle: 'astra_nexus',
    discord_handle: 'astra#8484'
  },
  {
    id: 'user-2',
    email: 'riven@nexus.gg',
    verified: true,
    first_name: 'Miles',
    last_name: 'Kim',
    tag: 'Riven',
    role: 'player',
    avatar: '/logos/Primary/PNG/Nexus Emerald Small.png',
    x_handle: null,
    discord_handle: 'riven#1337'
  },
  {
    id: 'user-3',
    email: 'hex@nexus.gg',
    verified: true,
    first_name: 'Jordan',
    last_name: 'Lee',
    tag: 'Hex',
    role: 'mod',
    avatar: '/logos/Secondary/PNG/Nexus Magenta Big.png',
    x_handle: null,
    discord_handle: null
  }
];

export const matches: Match[] = [
  {
    id: 'match-tri-vs-rav-live',
    slug: 'triad-vs-emerald-ravens-2026-06-03-live',
    date: '2026-06-03T01:00:00Z',
    home_team_id: 'team-2',
    away_team_id: 'team-1',
    tournament_season_id: 'tournament-season-preseason-2026',
    stream_url: 'https://www.youtube.com/@TheNexus-gg',
    status: 'live',
    format: 'crew_battle',
    home_score: null,
    away_score: null,
    graphic: '/graphics/NCSU Wins Graphic Week 4.png'
  },
  {
    id: 'match-inv-vs-tri-upcoming',
    slug: 'invaders-vs-triad-2026-06-10',
    date: '2026-06-10T01:00:00Z',
    home_team_id: 'team-3',
    away_team_id: 'team-2',
    tournament_season_id: 'tournament-season-preseason-2026',
    stream_url: 'https://www.youtube.com/@TheNexus-gg',
    status: 'upcoming',
    format: 'crew_battle',
    home_score: null,
    away_score: null,
    graphic: '/graphics/WU WIns Graphic Week 4.png'
  },
  {
    id: 'match-rav-vs-inv-vod',
    slug: 'emerald-ravens-vs-invaders-2026-06-02-vod',
    date: '2026-06-02T01:00:00Z',
    home_team_id: 'team-1',
    away_team_id: 'team-3',
    tournament_season_id: 'tournament-season-preseason-2026',
    stream_url: 'https://www.youtube.com/watch?v=nexus-test-vod',
    status: 'completed',
    format: 'crew_battle',
    home_score: 2,
    away_score: 1,
    graphic: '/graphics/NCSU Wins Graphic Week 4.png'
  },
  {
    id: 'match-tri-vs-inv-no-vod',
    slug: 'triad-vs-invaders-2026-06-01-no-vod',
    date: '2026-06-01T01:00:00Z',
    home_team_id: 'team-2',
    away_team_id: 'team-3',
    tournament_season_id: 'tournament-season-preseason-2026',
    stream_url: null,
    status: 'completed',
    format: 'crew_battle',
    home_score: 1,
    away_score: 2,
    graphic: '/graphics/WU WIns Graphic Week 4.png'
  },
  {
    id: 'match-rav-vs-tri',
    slug: 'emerald-ravens-vs-triad-2026-04-20',
    date: '2026-04-20T01:00:00Z',
    home_team_id: 'team-1',
    away_team_id: 'team-2',
    tournament_season_id: 'tournament-season-preseason-2026',
    stream_url: 'https://www.youtube.com/@TheNexus-gg',
    status: 'upcoming',
    format: 'crew_battle',
    home_score: null,
    away_score: null,
    graphic: '/graphics/NCSU Wins Graphic Week 4.png'
  },
  {
    id: 'match-inv-vs-rav',
    slug: 'invaders-vs-emerald-ravens-2026-04-14',
    date: '2026-04-14T01:00:00Z',
    home_team_id: 'team-3',
    away_team_id: 'team-1',
    tournament_season_id: 'tournament-season-preseason-2026',
    stream_url: 'https://www.youtube.com/@TheNexus-gg',
    status: 'completed',
    format: 'crew_battle',
    home_score: 3,
    away_score: 4,
    graphic: '/graphics/WU WIns Graphic Week 4.png'
  },
  {
    id: 'match-tri-vs-inv',
    slug: 'triad-vs-invaders-2026-04-12',
    date: '2026-04-12T01:00:00Z',
    home_team_id: 'team-2',
    away_team_id: 'team-3',
    tournament_season_id: 'tournament-season-preseason-2026',
    stream_url: 'https://www.youtube.com/@TheNexus-gg',
    status: 'completed',
    format: 'crew_battle',
    home_score: 0,
    away_score: 1,
    graphic: '/graphics/NCSU Wins Graphic Week 4.png'
  }
];

export const games: Game[] = [
  {
    id: 'game-1-rav-vs-tri',
    match_id: 'match-rav-vs-tri',
    game_order: 1,
    game_slug: 'emerald-ravens-vs-triad-2026-04-20-game-1',
    game: 'melee',
    home_roster_size: 5,
    away_roster_size: 5,
    home_score: null,
    away_score: null
  },
  {
    id: 'game-1-inv-vs-rav',
    match_id: 'match-inv-vs-rav',
    game_order: 1,
    game_slug: 'invaders-vs-emerald-ravens-2026-04-14-game-1',
    game: 'melee',
    home_roster_size: 5,
    away_roster_size: 5,
    home_score: 3,
    away_score: 4
  },
  {
    id: 'game-1-tri-vs-inv',
    match_id: 'match-tri-vs-inv',
    game_order: 1,
    game_slug: 'triad-vs-invaders-2026-04-12-game-1',
    game: 'melee',
    home_roster_size: 5,
    away_roster_size: 5,
    home_score: 0,
    away_score: 1
  }
];

export const crewBattleRounds: CrewBattleRound[] = [
  {
    id: 'cb-1',
    game_id: 'game-1-tri-vs-inv',
    round_order: 1,
    stage: 'Battlefield',
    home_player_tag: 'Hollow',
    home_character: 'Sheik',
    home_character_image: '/characterIcons/melee/105 - Sheik (Default).png',
    home_stocks_remaining: 2,
    away_player_tag: 'Brain',
    away_character: 'Samus',
    away_character_image: '/characterIcons/melee/101 - Samus (Default).png',
    away_stocks_remaining: 0
  },
  {
    id: 'cb-2',
    game_id: 'game-1-tri-vs-inv',
    round_order: 2,
    stage: 'Yoshi’s Story',
    home_player_tag: 'Hollow',
    home_character: 'Sheik',
    home_character_image: '/characterIcons/melee/105 - Sheik (Default).png',
    home_stocks_remaining: 2,
    away_player_tag: 'Osmics',
    away_character: 'Falco',
    away_character_image: '/characterIcons/melee/23 - Falco (Default).png',
    away_stocks_remaining: 0
  },
  {
    id: 'cb-3',
    game_id: 'game-1-tri-vs-inv',
    round_order: 3,
    stage: 'Dream Land',
    home_player_tag: 'Hollow',
    home_character: 'Sheik',
    home_character_image: '/characterIcons/melee/105 - Sheik (Default).png',
    home_stocks_remaining: 2,
    away_player_tag: 'med.',
    away_character: 'Pikachu',
    away_character_image: '/characterIcons/melee/86 - Pikachu (Default).png',
    away_stocks_remaining: 0
  },
  {
    id: 'cb-4',
    game_id: 'game-1-tri-vs-inv',
    round_order: 4,
    stage: 'Pokémon Stadium',
    home_player_tag: 'Hollow',
    home_character: 'Sheik',
    home_character_image: '/characterIcons/melee/105 - Sheik (Default).png',
    home_stocks_remaining: 0,
    away_player_tag: 'meenis',
    away_character: 'Fox',
    away_character_image: '/characterIcons/melee/27 - Fox (Default).png',
    away_stocks_remaining: 3
  },
  {
    id: 'cb-5',
    game_id: 'game-1-tri-vs-inv',
    round_order: 5,
    stage: 'Final Destination',
    home_player_tag: 'Shenalco',
    home_character: 'Falco',
    home_character_image: '/characterIcons/melee/23 - Falco (Default).png',
    home_stocks_remaining: 0,
    away_player_tag: 'meenis',
    away_character: 'Fox',
    away_character_image: '/characterIcons/melee/27 - Fox (Default).png',
    away_stocks_remaining: 3
  },
  {
    id: 'cb-6',
    game_id: 'game-1-tri-vs-inv',
    round_order: 6,
    stage: 'Town & City',
    home_player_tag: 'qwain',
    home_character: 'Fox',
    home_character_image: '/characterIcons/melee/27 - Fox (Default).png',
    home_stocks_remaining: 0,
    away_player_tag: 'meenis',
    away_character: 'Fox',
    away_character_image: '/characterIcons/melee/27 - Fox (Default).png',
    away_stocks_remaining: 1
  },
  {
    id: 'cb-7',
    game_id: 'game-1-tri-vs-inv',
    round_order: 7,
    stage: 'Small Battlefield',
    home_player_tag: 'Shenal',
    home_character: 'Mr. Game & Watch',
    home_character_image: '/characterIcons/melee/36 - Mr Game and Watch (Default).png',
    home_stocks_remaining: 1,
    away_player_tag: 'meenis',
    away_character: 'Fox',
    away_character_image: '/characterIcons/melee/27 - Fox (Default).png',
    away_stocks_remaining: 0
  },
  {
    id: 'cb-8',
    game_id: 'game-1-tri-vs-inv',
    round_order: 8,
    stage: 'Smashville',
    home_player_tag: 'Shenal',
    home_character: 'Mr. Game & Watch',
    home_character_image: '/characterIcons/melee/36 - Mr Game and Watch (Default).png',
    home_stocks_remaining: 0,
    away_player_tag: 'MP3',
    away_character: 'Ness',
    away_character_image: '/characterIcons/melee/73 - Ness (Default).png',
    away_stocks_remaining: 4
  },
  {
    id: 'cb-9',
    game_id: 'game-1-tri-vs-inv',
    round_order: 9,
    stage: 'Hollow Bastion',
    home_player_tag: 'Mystik',
    home_character: 'Jigglypuff',
    home_character_image: '/characterIcons/melee/90 - Jigglypuff (Default).png',
    home_stocks_remaining: 0,
    away_player_tag: 'MP3',
    away_character: 'Ness',
    away_character_image: '/characterIcons/melee/73 - Ness (Default).png',
    away_stocks_remaining: 2
  }
];

export const formatMatchDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'America/New_York'
  }).format(new Date(iso));

export const getTeamById = (id: string) => teams.find((team) => team.id === id);

export const getGamesByMatch = (matchId: string) =>
  games
    .filter((game) => game.match_id === matchId)
    .sort((a, b) => a.game_order - b.game_order);

export const getCrewBattleRounds = (gameId: string) =>
  crewBattleRounds
    .filter((round) => round.game_id === gameId)
    .sort((a, b) => a.round_order - b.round_order);

const buildTeamLookup = (teamRows: Team[]) =>
  new Map<string, Team>(teamRows.map((team) => [team.id, team]));

const sortGames = (gameRows: Game[]) => [...gameRows].sort((a, b) => a.game_order - b.game_order);
const sortRounds = (roundRows: CrewBattleRound[]) => [...roundRows].sort((a, b) => a.round_order - b.round_order);

export interface MatchScoreline {
  home: number | null;
  away: number | null;
}

export const resolveMatchScoreline = (match: Match, matchGames: Game[]): MatchScoreline => {
  const scoredGames = matchGames.filter((game) => game.home_score !== null && game.away_score !== null);

  if (scoredGames.length === 0) {
    return { home: match.home_score, away: match.away_score };
  }

  return scoredGames.reduce(
    (acc, game) => {
      if ((game.home_score ?? 0) > (game.away_score ?? 0)) {
        acc.home += 1;
      } else if ((game.away_score ?? 0) > (game.home_score ?? 0)) {
        acc.away += 1;
      }

      return acc;
    },
    { home: 0, away: 0 }
  );
};

const getSupabaseTeams = async (): Promise<Team[]> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return teams;
  }

  const { data, error } = await supabase.from('teams').select('id,name,short_name,avatar,school_site_url,graphics,director_user_id,player_user_ids,wins,losses,tier').order('name');

  if (error || !data) {
    return teams;
  }

  const typedTeams = data as Array<{ id: string; name: string; short_name: string; avatar: string | null; school_site_url: string | null; graphics: TeamGraphics | null; director_user_id: string | null; player_user_ids: string[] | null; wins: number; losses: number; tier: number }>;

  return typedTeams.map((team) => ({
    id: team.id,
    name: team.name,
    short_name: team.short_name,
    avatar: team.avatar,
    school_site_url: team.school_site_url,
    graphics: team.graphics ?? {},
    director_tag: '',
    director_user_id: team.director_user_id,
    player_user_ids: team.player_user_ids ?? [],
    wins: team.wins,
    losses: team.losses,
    tier: team.tier ?? 0
  }));
};

export interface BroadcastScheduleEntry {
  id: string;
  slug: string;
  homeTeam: Team;
  awayTeam: Team;
  status: MatchStatus;
  startsAt: string;
  streamUrl: string | null;
  graphic: string | null;
}

const LIVE_MATCH_WINDOW_MS = 4 * 60 * 60 * 1000;

const hasStreamUrl = (streamUrl: string | null | undefined) => Boolean(streamUrl?.trim());

const toBroadcastEntry = (match: Match, teamLookup: Map<string, Team>): BroadcastScheduleEntry | null => {
  const homeTeam = teamLookup.get(match.home_team_id);
  const awayTeam = teamLookup.get(match.away_team_id);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  return {
    id: match.id,
    slug: match.slug,
    homeTeam,
    awayTeam,
    status: match.status,
    startsAt: match.date,
    streamUrl: match.stream_url,
    graphic: match.graphic
  };
};

export const getBroadcastScheduleEntries = async (): Promise<BroadcastScheduleEntry[]> => {
  const supabase = getSupabaseClient();
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - LIVE_MATCH_WINDOW_MS).toISOString();

  if (!supabase) {
    const teamLookup = buildTeamLookup(teams);
    const liveAndUpcomingMatches = matches
      .filter((match) =>
        match.status === 'live' ||
        (match.status === 'upcoming' &&
          new Date(match.date).getTime() >= new Date(liveWindowStart).getTime() &&
          hasStreamUrl(match.stream_url))
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const recentStreamMatches = matches
      .filter((match) => match.status === 'completed' && hasStreamUrl(match.stream_url))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    return [...liveAndUpcomingMatches, ...recentStreamMatches]
      .map((match) => toBroadcastEntry(match, teamLookup))
      .filter((entry): entry is BroadcastScheduleEntry => entry !== null);
  }

  const [{ data: scheduledRows, error: scheduledError }, { data: recentRows, error: recentError }, teamRows] = await Promise.all([
    supabase
      .from('matches')
      .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic')
      .or(`status.eq.live,and(status.eq.upcoming,date.gte.${liveWindowStart},stream_url.not.is.null,stream_url.neq.)`)
      .order('date', { ascending: true }),
    supabase
      .from('matches')
      .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic')
      .eq('status', 'completed')
      .not('stream_url', 'is', null)
      .neq('stream_url', '')
      .order('date', { ascending: false })
      .limit(3),
    getSupabaseTeams()
  ]);

  if (scheduledError || recentError) {
    return [];
  }

  const teamLookup = buildTeamLookup(teamRows);
  const scheduledMatches = ((scheduledRows ?? []) as Match[]).filter((match) =>
    match.status === 'live' ? true : hasStreamUrl(match.stream_url)
  );

  return ([...scheduledMatches, ...((recentRows ?? []) as Match[])])
    .map((match) => toBroadcastEntry(match, teamLookup))
    .filter((entry): entry is BroadcastScheduleEntry => entry !== null);
};

export interface StandingRow {
  rank: number;
  team: string;
  teamShortName: string;
  teamAvatar?: string | null;
  w: number;
  l: number;
}

type StandingsTeam = Pick<Team, 'id' | 'name' | 'short_name' | 'avatar'>;

const buildStandings = (
  teamRows: StandingsTeam[],
  matchRows: Match[],
  gameRows: Game[],
  options?: { seedMap?: Map<string, number | null>; hasSeasonTeams?: boolean }
): StandingRow[] => {
  const gamesByMatch = gameRows.reduce<Record<string, Game[]>>((acc, game) => {
    acc[game.match_id] ??= [];
    acc[game.match_id].push(game);
    return acc;
  }, {});

  const seedMap = options?.seedMap;
  const hasSeasonTeams = options?.hasSeasonTeams ?? false;

  const records = new Map(
    teamRows.map((team) => [
      team.id,
      {
        team: team.name,
        teamShortName: team.short_name,
        teamAvatar: team.avatar ?? null,
        seed: seedMap?.get(team.id) ?? null,
        w: 0,
        l: 0
      }
    ])
  );

  for (const match of matchRows) {
    const scoreline = resolveMatchScoreline(match, sortGames(gamesByMatch[match.id] ?? []));

    if (scoreline.home === null || scoreline.away === null || scoreline.home === scoreline.away) {
      continue;
    }

    const homeRecord = records.get(match.home_team_id);
    const awayRecord = records.get(match.away_team_id);

    if (!homeRecord || !awayRecord) {
      continue;
    }

    if (scoreline.home > scoreline.away) {
      homeRecord.w += 1;
      awayRecord.l += 1;
    } else {
      awayRecord.w += 1;
      homeRecord.l += 1;
    }
  }

  return Array.from(records.values())
    .filter((record) => hasSeasonTeams || record.w > 0 || record.l > 0)
    .sort((a, b) => {
      if (b.w !== a.w) return b.w - a.w;
      if (a.l !== b.l) return a.l - b.l;
      if (a.seed !== null && b.seed !== null && a.seed !== b.seed) {
        return a.seed - b.seed;
      }
      if (a.seed !== null && b.seed === null) return -1;
      if (a.seed === null && b.seed !== null) return 1;
      return a.team.localeCompare(b.team);
    })
    .map((record, index) => ({
      rank: index + 1,
      team: record.team,
      teamShortName: record.teamShortName,
      teamAvatar: record.teamAvatar,
      w: record.w,
      l: record.l
    }));
};

const fetchTournamentSeasons = async (): Promise<TournamentSeason[]> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return tournamentSeasons;
  }

  const { data, error } = await supabase.from('tournaments_seasons').select('id,name,bracket_type,competition_type,registration_status,weeks').order('name');

  if (error || !data?.length) {
    return tournamentSeasons;
  }

  return data as TournamentSeason[];
};

export const getTournamentSeasons = unstable_cache(fetchTournamentSeasons, ['tournament-seasons'], {
  revalidate: 120,
  tags: ['tournament-seasons']
});

const fallbackCompetitionSlug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Loads all public competition-detail data on the server in a small set of bounded queries. */
export const getCompetitionBySlug = async (slug: string): Promise<CompetitionDetail | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const competition = tournamentSeasons.find((entry) => (entry.slug ?? fallbackCompetitionSlug(entry.name)) === slug);
    if (!competition) return null;
    const competitionTeams = teams.map(({ id, name, short_name, avatar }) => ({ id, name, short_name, avatar, seed: null }));
    const teamMap = new Map(competitionTeams.map((team) => [team.id, team]));
    return {
      id: competition.id, slug, name: competition.name,
      bracket_type: competition.bracket_type ?? 'double_elimination', competition_type: competition.competition_type ?? 'season',
      registration_status: competition.registration_status ?? 'closed', teams: competitionTeams,
      weeks: competition.weeks ?? null, matchups: [],
      matches: matches.filter((match) => match.tournament_season_id === competition.id).map((match) => ({
        ...match,
        home_team: teamMap.get(match.home_team_id)!, away_team: teamMap.get(match.away_team_id)!
      })).filter((match) => match.home_team && match.away_team)
    };
  }

  const { data: competitionRow, error } = await supabase.from('tournaments_seasons')
    .select('id,slug,name,bracket_type,competition_type,registration_status,weeks').eq('slug', slug).maybeSingle();
  if (error || !competitionRow) return null;
  const competition = competitionRow as Omit<CompetitionDetail, 'teams' | 'matches'>;
  const [assignmentResult, matchResult, matchupResult] = await Promise.all([
    supabase.from('tournament_season_teams').select('team_id,seed').eq('tournament_season_id', competition.id).order('seed'),
    supabase.from('matches').select('id,slug,date,status,home_score,away_score,home_team_id,away_team_id').eq('tournament_season_id', competition.id).order('date'),
    supabase.from('tournament_season_matchups').select('id,week,home_team_id,away_team_id,scheduled_at').eq('tournament_season_id', competition.id).order('week')
  ]);
  if (assignmentResult.error || matchResult.error || matchupResult.error) return null;
  const assignments = (assignmentResult.data ?? []) as Array<{ team_id: string; seed: number | null }>;
  const rawMatches = (matchResult.data ?? []) as Array<Pick<Match, 'id' | 'slug' | 'date' | 'status' | 'home_score' | 'away_score' | 'home_team_id' | 'away_team_id'>>;
  const rawMatchups = (matchupResult.data ?? []) as Array<{ id: string; week: number; home_team_id: string; away_team_id: string; scheduled_at: string | null }>;
  const teamIds = Array.from(new Set([...assignments.map(({ team_id }) => team_id), ...rawMatches.flatMap((match) => [match.home_team_id, match.away_team_id]), ...rawMatchups.flatMap((matchup) => [matchup.home_team_id, matchup.away_team_id])]));
  const teamResult = teamIds.length ? await supabase.from('teams').select('id,name,short_name,avatar').in('id', teamIds) : { data: [], error: null };
  if (teamResult.error) return null;
  const teamMap = new Map(((teamResult.data ?? []) as Array<Omit<CompetitionTeam, 'seed'>>).map((team) => [team.id, team]));
  const seededTeams = assignments.flatMap(({ team_id, seed }) => {
    const team = teamMap.get(team_id); return team ? [{ ...team, seed }] : [];
  });
  return {
    ...competition,
    teams: seededTeams,
    matchups: rawMatchups.flatMap((matchup) => {
      const home_team = teamMap.get(matchup.home_team_id); const away_team = teamMap.get(matchup.away_team_id);
      return home_team && away_team ? [{ id: matchup.id, week: matchup.week, scheduled_at: matchup.scheduled_at, home_team, away_team }] : [];
    }),
    matches: rawMatches.flatMap((match) => {
      const home_team = teamMap.get(match.home_team_id); const away_team = teamMap.get(match.away_team_id);
      return home_team && away_team ? [{ id: match.id, slug: match.slug, date: match.date, status: match.status, home_score: match.home_score, away_score: match.away_score, home_team, away_team }] : [];
    })
  };
};

export const getStandingsByTournamentSeason = async (tournamentSeasonId: string): Promise<StandingRow[]> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return buildStandings(
      teams,
      matches.filter(
        (match) => match.status === 'completed' && match.tournament_season_id === tournamentSeasonId
      ),
      games
    );
  }

  const [
    { data: teamRows, error: teamError },
    { data: matchRows, error: matchError },
    { data: seasonTeamRows }
  ] = await Promise.all([
    supabase.from('teams').select('id,name,short_name,avatar').order('name'),
    supabase
      .from('matches')
      .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic')
      .eq('status', 'completed')
      .eq('tournament_season_id', tournamentSeasonId)
      .order('date'),
    supabase
      .from('tournament_season_teams')
      .select('team_id,seed')
      .eq('tournament_season_id', tournamentSeasonId)
      .order('seed')
  ]);

  if (teamError || matchError || !teamRows || !matchRows) {
    return buildStandings(
      teams,
      matches.filter(
        (match) => match.status === 'completed' && match.tournament_season_id === tournamentSeasonId
      ),
      games
    );
  }

  const rawTeams = teamRows as StandingsTeam[];
  const teamMap = new Map(rawTeams.map((team) => [team.id, team]));
  const seededAssignments = (seasonTeamRows ?? []) as Array<{ team_id: string; seed: number | null }>;
  const hasSeasonTeams = seededAssignments.length > 0;
  const seedMap = new Map(seededAssignments.map((st) => [st.team_id, st.seed]));

  const typedTeams: StandingsTeam[] = hasSeasonTeams
    ? seededAssignments.map((st) => teamMap.get(st.team_id)).filter((t): t is StandingsTeam => Boolean(t))
    : rawTeams;

  const typedMatches = matchRows as Match[];
  const matchIds = typedMatches.map((match) => match.id);

  const { data: gameRows } = matchIds.length
    ? await supabase
        .from('games')
        .select('id,match_id,game_order,game_slug,game,home_roster_size,away_roster_size,home_score,away_score')
        .in('match_id', matchIds)
        .order('game_order')
    : { data: [] as Game[] };

  return buildStandings(typedTeams, typedMatches, (gameRows ?? []) as Game[], {
    seedMap,
    hasSeasonTeams
  });
};

export const getSeason1Standings = async (): Promise<StandingRow[]> => {
  const seasons = await getTournamentSeasons();
  const season1 = seasons.find((season) => /season[\s-]?1|fall[\s-]?2026/i.test(season.name))
    ?? seasons.find((season) => !/pre[\s-]?season/i.test(season.name))
    ?? seasons[0]
    ?? tournamentSeasons[0];

  return getStandingsByTournamentSeason(season1.id);
};

export const getPreSeasonStandings = async (): Promise<StandingRow[]> => {
  const seasons = await getTournamentSeasons();
  const preseason = seasons.find((season) => /pre[\s-]?season/i.test(season.name)) ?? seasons[0] ?? tournamentSeasons[0];

  return getStandingsByTournamentSeason(preseason.id);
};


export interface PlayerStatsRow {
  rank: number;
  playerTag: string;
  playerRealName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamShortName: string | null;
  teamAvatar: string | null;
  isCaptain: boolean;
  mostPlayedCharacter: string | null;
  mostPlayedCharacterIcon: string | null;
  characterUsage: PlayerCharacterUsage[];
  matchesPlayed: number;
  gamesPlayed: number;
  attendancePercentage: number;
  stocksTaken: number;
  matchWins: number;
  matchLosses: number;
  matchWinLossRatio: number | null;
  stagePreferences: PlayerStagePreference[];
}

export interface PlayerCharacterUsage {
  character: string;
  icon: string;
  gamesPlayed: number;
  percentage: number;
}

export interface PlayerStagePreference {
  stage: string;
  picks: number;
  percentage: number;
  selections: PlayerStageSelection[];
}

export interface PlayerStageSelection {
  gameId: string;
  gameLabel: string;
  gameHref: string;
  opponentTag: string;
  opponentCharacter: string;
  opponentCharacterIcon: string;
}

export interface TeamStatsRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamAvatar: string | null;
  teamSchoolSiteUrl: string | null;
  teamGraphics: TeamGraphics;
  activeRoster: ActiveRosterPlayer[];
  totalStocksTaken: number;
  matchesPlayed: number;
  gamesPlayed: number;
  matchWins: number;
  matchLosses: number;
  matchWinLossRatio: number | null;
  mostCommonLead: TeamLineupTendency | null;
  mostCommonAnchor: TeamLineupTendency | null;
}

export interface ActiveRosterPlayer {
  playerTag: string;
  isCaptain: boolean;
}

export interface TeamLineupTendency {
  playerTag: string;
  appearances: number;
  percentage: number;
}

export interface LeagueStatsSnapshot {
  players: PlayerStatsRow[];
  teams: TeamStatsRow[];
  totals: {
    stocksTaken: number;
    matchesPlayed: number;
    gamesPlayed: number;
    playersRanked: number;
    teamsRanked: number;
  };
}

export interface PlayerStockStatRow {
  rank: number;
  playerTag: string;
  playerRealName: string | null;
  teamName: string | null;
  teamShortName: string | null;
  teamAvatar: string | null;
  stocksTaken: number;
  roundsPlayed: number;
}

type PlayerStatsAccumulator = Omit<PlayerStatsRow, 'rank' | 'mostPlayedCharacter' | 'mostPlayedCharacterIcon' | 'characterUsage' | 'matchesPlayed' | 'gamesPlayed' | 'attendancePercentage' | 'matchWinLossRatio' | 'stagePreferences'> & {
  matchIds: Set<string>;
  gameIds: Set<string>;
  characterUsage: Map<string, { character: string; icon: string; count: number }>;
  playedGameCharacters: Set<string>;
  stagePreferenceCounts: Map<string, { stage: string; selections: PlayerStageSelection[] }>;
};

type TeamStatsAccumulator = Omit<TeamStatsRow, 'rank' | 'activeRoster' | 'matchesPlayed' | 'gamesPlayed' | 'matchWinLossRatio' | 'mostCommonLead' | 'mostCommonAnchor'> & {
  matchIds: Set<string>;
  gameIds: Set<string>;
  leadCounts: Map<string, { playerTag: string; count: number }>;
  anchorCounts: Map<string, { playerTag: string; count: number }>;
};

const normalizePlayerTag = (tag: string) => tag.trim().toLowerCase();

const calculateWinLossRatio = (wins: number, losses: number) => {
  if (losses === 0) {
    return wins > 0 ? wins : null;
  }

  return Number((wins / losses).toFixed(2));
};


const getMatchWinnerTeamId = (match: Match, matchGames: Game[]) => {
  const scoreline = resolveMatchScoreline(match, matchGames);

  if (scoreline.home === null || scoreline.away === null || scoreline.home === scoreline.away) {
    return null;
  }

  return scoreline.home > scoreline.away ? match.home_team_id : match.away_team_id;
};

type PlayerIdentity = { tag: string | null; team_id?: string | null; first_name: string | null; last_name: string | null; is_captain?: boolean };
type PlayerIdentityLookup = { byTeamAndTag: Map<string, PlayerIdentity>; byTag: Map<string, PlayerIdentity> };

const formatPlayerRealName = (identity: PlayerIdentity | undefined) => {
  const name = [identity?.first_name, identity?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');

  return name || null;
};

const getPlayerIdentityKey = (teamId: string, tag: string) => `${teamId}:${normalizePlayerTag(tag)}`;

// Completed match rounds only persist player tags, so join names through the roster row for that tag/team first.
const buildPlayerIdentityLookup = (identities: PlayerIdentity[] = []): PlayerIdentityLookup => {
  const byTeamAndTag = new Map<string, PlayerIdentity>();
  const byTag = new Map<string, PlayerIdentity>();

  for (const identity of identities) {
    const tag = identity.tag?.trim();

    if (!tag) {
      continue;
    }

    if (identity.team_id) {
      byTeamAndTag.set(getPlayerIdentityKey(identity.team_id, tag), identity);
    }

    byTag.set(normalizePlayerTag(tag), identity);
  }

  return { byTeamAndTag, byTag };
};

const getPlayerIdentity = (lookup: PlayerIdentityLookup, tag: string, team: Team | undefined) => {
  if (team) {
    const rosterIdentity = lookup.byTeamAndTag.get(getPlayerIdentityKey(team.id, tag));

    if (rosterIdentity) {
      return rosterIdentity;
    }
  }

  return lookup.byTag.get(normalizePlayerTag(tag));
};

const ensurePlayerStats = (stats: Map<string, PlayerStatsAccumulator>, playerTag: string, team: Team | undefined, playerIdentityLookup: PlayerIdentityLookup) => {
  const trimmedTag = playerTag.trim();

  if (!trimmedTag) {
    return null;
  }

  const key = normalizePlayerTag(trimmedTag);
  const existing = stats.get(key);

  if (existing) {
    const identity = getPlayerIdentity(playerIdentityLookup, trimmedTag, team);
    existing.playerRealName ??= formatPlayerRealName(identity);
    existing.isCaptain ||= identity?.is_captain === true;
    existing.teamId ??= team?.id ?? null;
    existing.teamName ??= team?.name ?? null;
    existing.teamShortName ??= team?.short_name ?? null;
    existing.teamAvatar ??= team?.avatar ?? null;
    return existing;
  }

  const identity = getPlayerIdentity(playerIdentityLookup, trimmedTag, team);
  const next: PlayerStatsAccumulator = {
    playerTag: trimmedTag,
    playerRealName: formatPlayerRealName(identity),
    teamId: team?.id ?? null,
    teamName: team?.name ?? null,
    teamShortName: team?.short_name ?? null,
    teamAvatar: team?.avatar ?? null,
    isCaptain: identity?.is_captain === true,
    stocksTaken: 0,
    characterUsage: new Map<string, { character: string; icon: string; count: number }>(),
    playedGameCharacters: new Set<string>(),
    stagePreferenceCounts: new Map<string, { stage: string; selections: PlayerStageSelection[] }>(),
    matchWins: 0,
    matchLosses: 0,
    matchIds: new Set<string>(),
    gameIds: new Set<string>()
  };

  stats.set(key, next);
  return next;
};

const trackTeamLineupPosition = (counts: TeamStatsAccumulator['leadCounts'], playerTag: string) => {
  const key = normalizePlayerTag(playerTag);
  if (!key) return;

  const existing = counts.get(key);
  counts.set(key, { playerTag: existing?.playerTag ?? playerTag.trim(), count: (existing?.count ?? 0) + 1 });
};

const getMostCommonLineupPosition = (
  counts: TeamStatsAccumulator['leadCounts'],
  gamesWithRounds: number
): TeamLineupTendency | null => {
  const [mostCommon] = Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.playerTag.localeCompare(b.playerTag));

  if (!mostCommon) return null;

  return {
    playerTag: mostCommon.playerTag,
    appearances: mostCommon.count,
    percentage: Number(((mostCommon.count / Math.max(gamesWithRounds, 1)) * 100).toFixed(1))
  };
};

const trackPlayerStagePreference = (
  player: PlayerStatsAccumulator | null,
  stage: string,
  selection: PlayerStageSelection
) => {
  if (!player) return;

  const trimmedStage = stage.trim();
  if (!trimmedStage) return;

  const key = trimmedStage.toLowerCase();
  const existing = player.stagePreferenceCounts.get(key);

  if (existing) {
    existing.selections.push(selection);
  } else {
    player.stagePreferenceCounts.set(key, { stage: trimmedStage, selections: [selection] });
  }
};

const getPlayerStagePreferences = (player: PlayerStatsAccumulator): PlayerStagePreference[] => {
  const preferences = Array.from(player.stagePreferenceCounts.values());
  const totalPicks = preferences.reduce((total, preference) => total + preference.selections.length, 0);

  return preferences
    .map(({ stage, selections }) => ({
      stage,
      picks: selections.length,
      percentage: Number(((selections.length / totalPicks) * 100).toFixed(1)),
      selections
    }))
    .sort((a, b) => b.picks - a.picks || a.stage.localeCompare(b.stage));
};


const trackPlayerCharacter = (player: PlayerStatsAccumulator | null, gameId: string, game: GameType, character: string, characterImage: string | null) => {
  if (!player) {
    return;
  }

  const trimmedCharacter = character.trim();

  if (!trimmedCharacter) {
    return;
  }

  const key = `${game}:${trimmedCharacter.toLowerCase()}`;
  const gameCharacterKey = `${gameId}:${key}`;

  // Crew players can persist across several rounds in one game. Count that character
  // once per game so the profile percentages describe game usage, not round duration.
  if (player.playedGameCharacters.has(gameCharacterKey)) {
    return;
  }

  player.playedGameCharacters.add(gameCharacterKey);
  const existing = player.characterUsage.get(key);

  if (existing) {
    existing.count += 1;
    return;
  }

  player.characterUsage.set(key, {
    character: trimmedCharacter,
    icon: resolveCharacterImagePath(game, trimmedCharacter, characterImage),
    count: 1
  });
};

const getMostPlayedCharacter = (player: PlayerStatsAccumulator) => {
  const [mostPlayed] = Array.from(player.characterUsage.values())
    .sort((a, b) => b.count - a.count || a.character.localeCompare(b.character));

  return mostPlayed ?? null;
};

const getPlayerCharacterUsage = (player: PlayerStatsAccumulator): PlayerCharacterUsage[] => {
  const gamesPlayed = Math.max(player.gameIds.size, 1);

  return Array.from(player.characterUsage.values())
    .sort((a, b) => b.count - a.count || a.character.localeCompare(b.character))
    .slice(0, 4)
    .map(({ character, icon, count }) => ({
      character,
      icon,
      gamesPlayed: count,
      percentage: Number(((count / gamesPlayed) * 100).toFixed(1))
    }));
};

const ensureTeamStats = (stats: Map<string, TeamStatsAccumulator>, team: Team | undefined) => {
  if (!team) {
    return null;
  }

  const existing = stats.get(team.id);

  if (existing) {
    return existing;
  }

  const next: TeamStatsAccumulator = {
    teamId: team.id,
    teamName: team.name,
    teamShortName: team.short_name,
    teamAvatar: team.avatar,
    teamSchoolSiteUrl: team.school_site_url,
    teamGraphics: team.graphics ?? {},
    totalStocksTaken: 0,
    matchWins: 0,
    matchLosses: 0,
    matchIds: new Set<string>(),
    gameIds: new Set<string>(),
    leadCounts: new Map(),
    anchorCounts: new Map()
  };

  stats.set(team.id, next);
  return next;
};

const buildLeagueStats = (teamRows: Team[], matchRows: Match[], gameRows: Game[], roundRows: CrewBattleRound[], playerIdentities: PlayerIdentity[] = []): LeagueStatsSnapshot => {
  const teamLookup = buildTeamLookup(teamRows);
  const gamesByMatch = gameRows.reduce<Record<string, Game[]>>((acc, game) => {
    acc[game.match_id] ??= [];
    acc[game.match_id].push(game);
    return acc;
  }, {});
  const roundsByGame = roundRows.reduce<Record<string, CrewBattleRound[]>>((acc, round) => {
    acc[round.game_id] ??= [];
    acc[round.game_id].push(round);
    return acc;
  }, {});
  const playerStats = new Map<string, PlayerStatsAccumulator>();
  const playerIdentityLookup = buildPlayerIdentityLookup(playerIdentities);
  const activeRosterByTeam = playerIdentities.reduce<Map<string, ActiveRosterPlayer[]>>((rosters, player) => {
    const playerTag = player.tag?.trim();

    if (!player.team_id || !playerTag) {
      return rosters;
    }

    const roster = rosters.get(player.team_id) ?? [];
    roster.push({ playerTag, isCaptain: player.is_captain === true });
    rosters.set(player.team_id, roster);
    return rosters;
  }, new Map());
  const teamStats = new Map<string, TeamStatsAccumulator>();

  for (const match of matchRows) {
    const matchGames = sortGames(gamesByMatch[match.id] ?? []);
    const homeTeam = teamLookup.get(match.home_team_id);
    const awayTeam = teamLookup.get(match.away_team_id);
    const winningTeamId = getMatchWinnerTeamId(match, matchGames);
    const participatedPlayers = new Map<string, { stat: PlayerStatsAccumulator; teamId: string | null }>();
    const matchTeamStats = [ensureTeamStats(teamStats, homeTeam), ensureTeamStats(teamStats, awayTeam)].filter(Boolean) as TeamStatsAccumulator[];

    for (const teamStat of matchTeamStats) {
      teamStat.matchIds.add(match.id);
      if (winningTeamId === teamStat.teamId) {
        teamStat.matchWins += 1;
      } else if (winningTeamId && winningTeamId !== teamStat.teamId) {
        teamStat.matchLosses += 1;
      }
    }

    for (const game of matchGames) {
      const homeStocksByPlayer = new Map<string, number>();
      const awayStocksByPlayer = new Map<string, number>();
      const stocksPerPlayer = game.game === 'ultimate' ? 3 : 4;
      const homeTeamStat = ensureTeamStats(teamStats, homeTeam);
      const awayTeamStat = ensureTeamStats(teamStats, awayTeam);

      homeTeamStat?.gameIds.add(game.id);
      awayTeamStat?.gameIds.add(game.id);

      const gameRounds = sortRounds(roundsByGame[game.id] ?? []);
      const gameLabel = `${homeTeam?.short_name ?? homeTeam?.name ?? 'Home'} vs ${awayTeam?.short_name ?? awayTeam?.name ?? 'Away'} · Game ${game.game_order}`;
      const gameHref = `/matches/${encodeURIComponent(match.slug)}#game-${encodeURIComponent(game.game_slug || game.id)}`;

      if (gameRounds.length > 0) {
        const openingRound = gameRounds[0];
        const closingRound = gameRounds[gameRounds.length - 1];
        if (homeTeamStat) {
          trackTeamLineupPosition(homeTeamStat.leadCounts, openingRound.home_player_tag);
          trackTeamLineupPosition(homeTeamStat.anchorCounts, closingRound.home_player_tag);
        }
        if (awayTeamStat) {
          trackTeamLineupPosition(awayTeamStat.leadCounts, openingRound.away_player_tag);
          trackTeamLineupPosition(awayTeamStat.anchorCounts, closingRound.away_player_tag);
        }
      }

      for (let roundIndex = 0; roundIndex < gameRounds.length; roundIndex += 1) {
        const round = gameRounds[roundIndex];
        const homeKey = normalizePlayerTag(round.home_player_tag);
        const awayKey = normalizePlayerTag(round.away_player_tag);
        const homeStocksAtStart = homeStocksByPlayer.get(homeKey) ?? stocksPerPlayer;
        const awayStocksAtStart = awayStocksByPlayer.get(awayKey) ?? stocksPerPlayer;
        const homeStocksLost = Math.max(0, homeStocksAtStart - round.home_stocks_remaining);
        const awayStocksLost = Math.max(0, awayStocksAtStart - round.away_stocks_remaining);
        const homePlayer = ensurePlayerStats(playerStats, round.home_player_tag, homeTeam, playerIdentityLookup);
        const awayPlayer = ensurePlayerStats(playerStats, round.away_player_tag, awayTeam, playerIdentityLookup);

        // After an elimination, the incoming player on the losing side selects the next stage.
        // A changed tag proves that this player did not play in the previous round, so opening
        // stages and stages selected by the continuing winner are intentionally excluded.
        const previousRound = gameRounds[roundIndex - 1];
        if (previousRound) {
          if (previousRound.home_stocks_remaining === 0 && normalizePlayerTag(previousRound.home_player_tag) !== homeKey) {
            trackPlayerStagePreference(homePlayer, round.stage, {
              gameId: game.id,
              gameLabel,
              gameHref,
              opponentTag: round.away_player_tag,
              opponentCharacter: round.away_character,
              opponentCharacterIcon: resolveCharacterImagePath(game.game, round.away_character, round.away_character_image)
            });
          }
          if (previousRound.away_stocks_remaining === 0 && normalizePlayerTag(previousRound.away_player_tag) !== awayKey) {
            trackPlayerStagePreference(awayPlayer, round.stage, {
              gameId: game.id,
              gameLabel,
              gameHref,
              opponentTag: round.home_player_tag,
              opponentCharacter: round.home_character,
              opponentCharacterIcon: resolveCharacterImagePath(game.game, round.home_character, round.home_character_image)
            });
          }
        }

        trackPlayerCharacter(homePlayer, game.id, game.game, round.home_character, round.home_character_image);
        trackPlayerCharacter(awayPlayer, game.id, game.game, round.away_character, round.away_character_image);

        if (homePlayer) {
          homePlayer.stocksTaken += awayStocksLost;
          homePlayer.matchIds.add(match.id);
          homePlayer.gameIds.add(game.id);
          const entry = participatedPlayers.get(homeKey) ?? { stat: homePlayer, teamId: homeTeam?.id ?? null };
          participatedPlayers.set(homeKey, entry);
        }

        if (awayPlayer) {
          awayPlayer.stocksTaken += homeStocksLost;
          awayPlayer.matchIds.add(match.id);
          awayPlayer.gameIds.add(game.id);
          const entry = participatedPlayers.get(awayKey) ?? { stat: awayPlayer, teamId: awayTeam?.id ?? null };
          participatedPlayers.set(awayKey, entry);
        }

        if (homeTeamStat) homeTeamStat.totalStocksTaken += awayStocksLost;
        if (awayTeamStat) awayTeamStat.totalStocksTaken += homeStocksLost;

        homeStocksByPlayer.set(homeKey, round.home_stocks_remaining);
        awayStocksByPlayer.set(awayKey, round.away_stocks_remaining);
      }
    }

    for (const { stat, teamId } of Array.from(participatedPlayers.values())) {
      if (winningTeamId === teamId) {
        stat.matchWins += 1;
      } else if (winningTeamId && winningTeamId !== teamId) {
        stat.matchLosses += 1;
      }
    }
  }

  const players = Array.from(playerStats.values())
    .map((row) => {
      const matchesPlayed = row.matchIds.size;
      const mostPlayedCharacter = getMostPlayedCharacter(row);
      return {
        rank: 0,
        playerTag: row.playerTag,
        playerRealName: row.playerRealName,
        teamId: row.teamId,
        teamName: row.teamName,
        teamShortName: row.teamShortName,
        teamAvatar: row.teamAvatar,
        isCaptain: row.isCaptain,
        mostPlayedCharacter: mostPlayedCharacter?.character ?? null,
        mostPlayedCharacterIcon: mostPlayedCharacter?.icon ?? null,
        characterUsage: getPlayerCharacterUsage(row),
        matchesPlayed,
        gamesPlayed: row.gameIds.size,
        attendancePercentage: row.teamId ? Number(((row.gameIds.size / Math.max(teamStats.get(row.teamId)?.gameIds.size ?? 0, 1)) * 100).toFixed(1)) : 0,
        stocksTaken: row.stocksTaken,
        matchWins: row.matchWins,
        matchLosses: row.matchLosses,
        matchWinLossRatio: calculateWinLossRatio(row.matchWins, row.matchLosses),
        stagePreferences: getPlayerStagePreferences(row)
      } satisfies PlayerStatsRow;
    })
    .sort((a, b) => b.stocksTaken - a.stocksTaken || a.playerTag.localeCompare(b.playerTag))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const teamsRanked = Array.from(teamStats.values())
    .filter((row) => row.matchIds.size > 0 || row.totalStocksTaken > 0)
    .map((row) => ({
      rank: 0,
      teamId: row.teamId,
      teamName: row.teamName,
      teamShortName: row.teamShortName,
      teamAvatar: row.teamAvatar,
      teamSchoolSiteUrl: row.teamSchoolSiteUrl,
      teamGraphics: row.teamGraphics,
      activeRoster: (activeRosterByTeam.get(row.teamId) ?? [])
        .sort((a, b) => a.playerTag.localeCompare(b.playerTag)),
      totalStocksTaken: row.totalStocksTaken,
      matchesPlayed: row.matchIds.size,
      gamesPlayed: row.gameIds.size,
      matchWins: row.matchWins,
      matchLosses: row.matchLosses,
      matchWinLossRatio: calculateWinLossRatio(row.matchWins, row.matchLosses),
      mostCommonLead: getMostCommonLineupPosition(row.leadCounts, row.gameIds.size),
      mostCommonAnchor: getMostCommonLineupPosition(row.anchorCounts, row.gameIds.size)
    } satisfies TeamStatsRow))
    .sort((a, b) => b.totalStocksTaken - a.totalStocksTaken || b.matchWins - a.matchWins || a.teamName.localeCompare(b.teamName))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    players,
    teams: teamsRanked,
    totals: {
      stocksTaken: teamsRanked.reduce((sum, team) => sum + team.totalStocksTaken, 0),
      matchesPlayed: matchRows.length,
      gamesPlayed: gameRows.length,
      playersRanked: players.length,
      teamsRanked: teamsRanked.length
    }
  };
};

export const getLeagueStats = async (tournamentSeasonId?: string): Promise<LeagueStatsSnapshot> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const completedMatches = matches.filter((match) =>
      match.status === 'completed' && (!tournamentSeasonId || match.tournament_season_id === tournamentSeasonId)
    );
    const completedMatchIds = new Set(completedMatches.map((match) => match.id));
    const completedGames = games.filter((game) => completedMatchIds.has(game.match_id));
    const completedGameIds = new Set(completedGames.map((game) => game.id));

    return buildLeagueStats(
      teams,
      completedMatches,
      completedGames,
      crewBattleRounds.filter((round) => completedGameIds.has(round.game_id)),
      players.map((player) => ({
        tag: player.tag,
        team_id: player.team_id,
        first_name: player.first_name ?? null,
        last_name: player.last_name ?? null,
        is_captain: player.is_captain === true
      }))
    );
  }

  let completedMatchesQuery = supabase
    .from('matches')
    .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic')
    .eq('status', 'completed');

  if (tournamentSeasonId) {
    completedMatchesQuery = completedMatchesQuery.eq('tournament_season_id', tournamentSeasonId);
  }

  const [{ data: teamRows, error: teamError }, { data: matchRows, error: matchError }, { data: playerRows }, { data: userRows }] = await Promise.all([
    supabase.from('teams').select('id,name,short_name,avatar,school_site_url,graphics,director_user_id,player_user_ids,wins,losses,tier').order('name'),
    completedMatchesQuery,
    supabase.from('players').select('tag,team_id,first_name,last_name,is_captain,user:users!players_user_id_fkey(first_name,last_name)'),
    supabase.from('users').select('tag,first_name,last_name')
  ]);

  if (teamError || matchError || !teamRows || !matchRows) {
    const completedMatches = matches.filter((match) =>
      match.status === 'completed' && (!tournamentSeasonId || match.tournament_season_id === tournamentSeasonId)
    );
    const completedMatchIds = new Set(completedMatches.map((match) => match.id));
    const completedGames = games.filter((game) => completedMatchIds.has(game.match_id));
    const completedGameIds = new Set(completedGames.map((game) => game.id));
    return buildLeagueStats(
      teams,
      completedMatches,
      completedGames,
      crewBattleRounds.filter((round) => completedGameIds.has(round.game_id))
    );
  }

  const typedMatches = matchRows as Match[];
  const matchIds = typedMatches.map((match) => match.id);

  if (matchIds.length === 0) {
    return buildLeagueStats((teamRows ?? []) as Team[], [], [], []);
  }

  const { data: gameRows, error: gameError } = await supabase
    .from('games')
    .select('id,match_id,game_order,game_slug,game,home_roster_size,away_roster_size,home_score,away_score')
    .in('match_id', matchIds)
    .order('game_order');

  if (gameError || !gameRows) {
    return buildLeagueStats((teamRows ?? []) as Team[], typedMatches, [], []);
  }

  const typedGames = gameRows as Game[];
  const gameIds = typedGames.map((game) => game.id);
  const { data: roundRows, error: roundError } = gameIds.length > 0
    ? await supabase
        .from('match_crew_rounds')
        .select(
          'id,game_id,round_order,stage,home_player_tag,home_character,home_character_image,home_stocks_remaining,away_player_tag,away_character,away_character_image,away_stocks_remaining'
        )
        .in('game_id', gameIds)
        .order('round_order')
    : { data: [] as CrewBattleRound[], error: null };

  if (roundError || !roundRows) {
    return buildLeagueStats((teamRows ?? []) as Team[], typedMatches, typedGames, []);
  }

  const typedTeams = (teamRows as Array<{
    id: string;
    name: string;
    short_name: string;
    avatar: string | null;
    school_site_url: string | null;
    graphics: TeamGraphics | null;
    director_user_id: string | null;
    player_user_ids: string[] | null;
    wins: number;
    losses: number;
    tier: number;
  }>).map((team) => ({
    id: team.id,
    name: team.name,
    short_name: team.short_name,
    avatar: team.avatar,
    school_site_url: team.school_site_url,
    graphics: team.graphics ?? {},
    director_tag: '',
    director_user_id: team.director_user_id,
    player_user_ids: team.player_user_ids ?? [],
    wins: team.wins,
    losses: team.losses,
    tier: team.tier ?? 0
  }));

  const userIdentities = ((userRows ?? []) as Array<PlayerIdentity>).map((user) => ({
    tag: user.tag,
    first_name: user.first_name,
    last_name: user.last_name
  }));
  const playerIdentities = ((playerRows ?? []) as Array<{ tag: string; team_id: string | null; first_name: string | null; last_name: string | null; is_captain: boolean; user: { first_name: string | null; last_name: string | null } | null }>).map((player) => ({
    tag: player.tag,
    team_id: player.team_id,
    first_name: player.first_name ?? player.user?.first_name ?? null,
    last_name: player.last_name ?? player.user?.last_name ?? null,
    is_captain: player.is_captain
  }));
  const typedPlayerIdentities = [...playerIdentities, ...userIdentities];

  return buildLeagueStats(typedTeams, typedMatches, typedGames, (roundRows ?? []) as CrewBattleRound[], typedPlayerIdentities);
};

export const getPlayerStockStats = async (): Promise<PlayerStockStatRow[]> => {
  const stats = await getLeagueStats();
  return stats.players.map((player) => ({
    rank: player.rank,
    playerTag: player.playerTag,
    playerRealName: player.playerRealName,
    teamName: player.teamName,
    teamShortName: player.teamShortName,
    teamAvatar: player.teamAvatar,
    stocksTaken: player.stocksTaken,
    roundsPlayed: player.gamesPlayed
  }));
};

export interface CompletedMatchHistoryEntry {
  match: Match;
  tournamentSeason?: TournamentSeason;
  homeTeam?: Team;
  awayTeam?: Team;
  primaryGame?: Game;
  rounds: CrewBattleRound[];
  scoreline: MatchScoreline;
}

export interface CompletedMatchHistoryCursor {
  date: string;
  id: string;
}

export interface CompletedMatchHistoryPage {
  entries: CompletedMatchHistoryEntry[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const COMPLETED_MATCH_HISTORY_PAGE_SIZE = 8;

export interface UpcomingMatchEntry {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
}

export interface ScheduleMatchEntry {
  match: Match;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  tournamentSeason: TournamentSeason | undefined;
}

export const getScheduleMatchEntries = async (): Promise<ScheduleMatchEntry[]> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const teamLookup = buildTeamLookup(teams);
    const seasonLookup = new Map(tournamentSeasons.map((season) => [season.id, season]));
    return [...matches]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((match) => ({
        match,
        homeTeam: teamLookup.get(match.home_team_id),
        awayTeam: teamLookup.get(match.away_team_id),
        tournamentSeason: seasonLookup.get(match.tournament_season_id)
      }));
  }

  const [{ data: matchRows, error }, teamRows, seasonRows] = await Promise.all([
    supabase
      .from('matches')
      .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic')
      .order('date', { ascending: true }),
    getSupabaseTeams(),
    getTournamentSeasons()
  ]);

  if (error || !matchRows) {
    return [];
  }

  const teamLookup = buildTeamLookup(teamRows);
  const seasonLookup = new Map(seasonRows.map((season) => [season.id, season]));

  return (matchRows as Match[]).map((match) => ({
    match,
    homeTeam: teamLookup.get(match.home_team_id),
    awayTeam: teamLookup.get(match.away_team_id),
    tournamentSeason: seasonLookup.get(match.tournament_season_id)
  }));
};

export const getUpcomingMatchEntries = async (): Promise<UpcomingMatchEntry[]> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return matches
      .filter((match) => match.status === 'upcoming')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((match) => ({
        match,
        homeTeam: getTeamById(match.home_team_id),
        awayTeam: getTeamById(match.away_team_id)
      }));
  }

  const [{ data: matchRows, error: matchError }, teamRows] = await Promise.all([
    supabase
      .from('matches')
      .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic')
      .eq('status', 'upcoming')
      .order('date', { ascending: true }),
    getSupabaseTeams()
  ]);

  if (matchError || !matchRows) {
    return [];
  }

  const teamLookup = buildTeamLookup(teamRows);

  return (matchRows as Match[]).map((match) => ({
    match,
    homeTeam: teamLookup.get(match.home_team_id),
    awayTeam: teamLookup.get(match.away_team_id)
  }));
};

export const getCompletedMatchHistoryEntries = async ({
  cursor,
  direction = 'next',
  pageSize = COMPLETED_MATCH_HISTORY_PAGE_SIZE
}: {
  cursor?: CompletedMatchHistoryCursor;
  direction?: 'next' | 'previous';
  pageSize?: number;
} = {}): Promise<CompletedMatchHistoryPage> => {
  const boundedPageSize = Math.min(Math.max(Math.trunc(pageSize), 1), COMPLETED_MATCH_HISTORY_PAGE_SIZE);
  const supabase = getSupabaseClient();

  if (!supabase) {
    const completed = matches
      .filter((match) => match.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const tournamentSeasonLookup = new Map(tournamentSeasons.map((entry) => [entry.id, entry]));
    const cursorIndex = cursor
      ? completed.findIndex((match) => match.date === cursor.date && match.id === cursor.id)
      : -1;
    const pageStart = direction === 'previous'
      ? Math.max(0, cursorIndex - boundedPageSize)
      : cursorIndex + 1;
    const pageMatches = completed.slice(pageStart, pageStart + boundedPageSize);
    const entries = pageMatches.map((match) => {
      const matchGames = getGamesByMatch(match.id);
      const primaryGame = matchGames[0];
      const rounds = primaryGame ? getCrewBattleRounds(primaryGame.id).slice(0, 5) : [];

      return {
        match,
        tournamentSeason: tournamentSeasonLookup.get(match.tournament_season_id),
        homeTeam: getTeamById(match.home_team_id),
        awayTeam: getTeamById(match.away_team_id),
        primaryGame,
        rounds,
        scoreline: resolveMatchScoreline(match, matchGames)
      };
    });

    return {
      entries,
      hasNextPage: pageStart + pageMatches.length < completed.length,
      hasPreviousPage: pageStart > 0
    };
  }

  const { data, error } = await supabase.rpc('get_completed_match_history_cards' as never, {
    cursor_date: cursor?.date ?? null,
    cursor_id: cursor?.id ?? null,
    page_direction: direction,
    requested_limit: boundedPageSize + 1
  } as never);

  if (error || !data) {
    return { entries: [], hasNextPage: false, hasPreviousPage: false };
  }

  const rows = data as unknown as Array<{
    match: Match;
    tournament_season: TournamentSeason | null;
    home_team: Team | null;
    away_team: Team | null;
    primary_game: Game | null;
    rounds: CrewBattleRound[];
    scoreline: MatchScoreline;
  }>;
  const hasExtraRow = rows.length > boundedPageSize;
  const pageRows = rows.slice(0, boundedPageSize);

  return {
    entries: pageRows.map((row) => ({
      match: row.match,
      tournamentSeason: row.tournament_season ?? undefined,
      homeTeam: row.home_team ?? undefined,
      awayTeam: row.away_team ?? undefined,
      primaryGame: row.primary_game ?? undefined,
      rounds: row.rounds ?? [],
      scoreline: row.scoreline
    })),
    hasNextPage: direction === 'previous' ? Boolean(cursor) : hasExtraRow,
    hasPreviousPage: direction === 'previous' ? hasExtraRow : Boolean(cursor)
  };
};

export const getAllCompletedMatchEntries = async (): Promise<CompletedMatchHistoryEntry[]> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const completed = matches
      .filter((match) => match.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const tournamentSeasonLookup = new Map(tournamentSeasons.map((entry) => [entry.id, entry]));
    return completed.map((match) => {
      const matchGames = getGamesByMatch(match.id);
      const primaryGame = matchGames[0];
      const rounds = primaryGame ? getCrewBattleRounds(primaryGame.id).slice(0, 5) : [];

      return {
        match,
        tournamentSeason: tournamentSeasonLookup.get(match.tournament_season_id),
        homeTeam: getTeamById(match.home_team_id),
        awayTeam: getTeamById(match.away_team_id),
        primaryGame,
        rounds,
        scoreline: resolveMatchScoreline(match, matchGames)
      };
    });
  }

  const [
    { data: matchRows, error: matchError },
    teamRows,
    tournamentsSeasons
  ] = await Promise.all([
    supabase
      .from('matches')
      .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic')
      .eq('status', 'completed')
      .order('date', { ascending: false }),
    getSupabaseTeams(),
    getTournamentSeasons()
  ]);

  if (matchError || !matchRows || matchRows.length === 0) {
    return [];
  }

  const typedMatches = matchRows as unknown as Match[];
  const matchIds = typedMatches.map((m) => m.id);
  const { data: gameRows } = await supabase
    .from('games')
    .select('id,match_id,game,home_roster_size,away_roster_size,home_score,away_score,game_order')
    .in('match_id', matchIds)
    .order('game_order', { ascending: true });

  const typedGames = (gameRows ?? []) as Game[];
  const primaryGamesByMatch = new Map<string, Game>();
  const primaryGameIds: string[] = [];

  for (const game of typedGames) {
    if (!primaryGamesByMatch.has(game.match_id)) {
      primaryGamesByMatch.set(game.match_id, game);
      primaryGameIds.push(game.id);
    }
  }

  const { data: roundRows } = primaryGameIds.length > 0
    ? await supabase
        .from('match_crew_rounds')
        .select('id,game_id,round_order,stage,home_player_tag,home_character,home_character_image,home_stocks_remaining,away_player_tag,away_character,away_character_image,away_stocks_remaining')
        .in('game_id', primaryGameIds)
        .order('round_order', { ascending: true })
    : { data: [] };

  const roundsByGame = new Map<string, CrewBattleRound[]>();
  for (const round of (roundRows ?? []) as CrewBattleRound[]) {
    const list = roundsByGame.get(round.game_id) ?? [];
    list.push(round);
    roundsByGame.set(round.game_id, list);
  }

  const teamLookup = buildTeamLookup(teamRows);
  const tournamentLookup = new Map(tournamentsSeasons.map((ts) => [ts.id, ts]));

  return typedMatches.map((match) => {
    const primaryGame = primaryGamesByMatch.get(match.id);
    const rounds = primaryGame ? (roundsByGame.get(primaryGame.id) ?? []).slice(0, 5) : [];
    const scoreline: MatchScoreline = {
      home: match.home_score ?? primaryGame?.home_score ?? 0,
      away: match.away_score ?? primaryGame?.away_score ?? 0
    };

    return {
      match,
      tournamentSeason: tournamentLookup.get(match.tournament_season_id),
      homeTeam: teamLookup.get(match.home_team_id),
      awayTeam: teamLookup.get(match.away_team_id),
      primaryGame,
      rounds,
      scoreline
    };
  });
};

export interface MatchDetailEntry {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  games: Array<{
    game: Game;
    rounds: CrewBattleRound[];
  }>;
  scoreline: MatchScoreline;
}

export const getMatchDetailEntry = async (matchSlugOrId: string): Promise<MatchDetailEntry | null> => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const match = matches.find((entry) => entry.slug === matchSlugOrId || entry.id === matchSlugOrId);

    if (!match) {
      return null;
    }

    const matchGames = getGamesByMatch(match.id);
    const games = matchGames.map((game) => ({
      game,
      rounds: getCrewBattleRounds(game.id)
    }));

    return {
      match,
      homeTeam: getTeamById(match.home_team_id),
      awayTeam: getTeamById(match.away_team_id),
      games,
      scoreline: resolveMatchScoreline(match, matchGames)
    };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchSlugOrId);
  const matchQuery = supabase
    .from('matches')
    .select('id,slug,date,home_team_id,away_team_id,tournament_season_id,stream_url,status,format,home_score,away_score,graphic');

  const [{ data: matchRow }, teamRows] = await Promise.all([
    (isUuid ? matchQuery.eq('id', matchSlugOrId) : matchQuery.eq('slug', matchSlugOrId)).maybeSingle(),
    getSupabaseTeams()
  ]);

  if (!matchRow) {
    return null;
  }

  const match = matchRow as Match;
  const teamLookup = buildTeamLookup(teamRows);
  const { data: gameRows } = await supabase
    .from('games')
    .select('id,match_id,game_order,game_slug,game,home_roster_size,away_roster_size,home_score,away_score')
    .eq('match_id', match.id)
    .order('game_order');

  const matchGames = sortGames((gameRows ?? []) as Game[]);
  const roundsByGame = new Map<string, CrewBattleRound[]>();
  const gameIds = matchGames.map((game) => game.id);

  if (gameIds.length > 0) {
    const { data: allRoundRows } = await supabase
      .from('match_crew_rounds')
      .select(
        'id,game_id,round_order,stage,home_player_tag,home_character,home_character_image,home_stocks_remaining,away_player_tag,away_character,away_character_image,away_stocks_remaining'
      )
      .in('game_id', gameIds)
      .order('round_order');

    for (const round of (allRoundRows ?? []) as CrewBattleRound[]) {
      const existingRounds = roundsByGame.get(round.game_id) ?? [];
      existingRounds.push(round);
      roundsByGame.set(round.game_id, existingRounds);
    }
  }

  return {
    match,
    homeTeam: teamLookup.get(match.home_team_id),
    awayTeam: teamLookup.get(match.away_team_id),
    games: matchGames.map((game) => ({
      game,
      rounds: sortRounds(roundsByGame.get(game.id) ?? [])
    })),
    scoreline: resolveMatchScoreline(match, matchGames)
  };
};
