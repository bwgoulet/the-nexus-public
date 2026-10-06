export type LiveSide = "home" | "away";
export type LivePhase =
  | "check_in"
  | "blind_pick"
  | "player_select"
  | "stage_strike"
  | "playing"
  | "score_verify"
  | "complete";
export type LiveGame = "melee" | "ultimate";
export type LiveRpsChoice = "rock" | "paper" | "scissors";

export const LIVE_MATCH_ACCESS_WINDOW_MS = 60 * 60 * 1000;

/** Live operations stay unavailable until one hour before the scheduled start. */
export const isLiveMatchAccessOpen = (
  startsAt: string,
  now: number | Date = Date.now(),
) => {
  const startTime = new Date(startsAt).getTime();
  const currentTime = now instanceof Date ? now.getTime() : now;

  return Number.isFinite(startTime) && currentTime >= startTime - LIVE_MATCH_ACCESS_WINDOW_MS;
};

/** Moderators may enter at any time; every other role keeps the one-hour lock. */
export const canAccessLiveMatchRoom = (
  startsAt: string,
  viewerRole: string | null,
  now: number | Date = Date.now(),
) => viewerRole === "mod" || isLiveMatchAccessOpen(startsAt, now);

/** Toggles ordered choices and replaces the oldest choice once the cap is full. */
export const cycleCappedSelection = <T>(
  selections: T[],
  choice: T,
  limit: number,
) => {
  if (selections.includes(choice))
    return selections.filter((selection) => selection !== choice);
  if (limit <= 0) return [];
  return [...selections, choice].slice(-limit);
};

/** Turns database transition codes into actionable operator messages. */
export const getLiveActionErrorNotice = (message: string) => {
  if (message.includes("LIVE_ACTION_NOT_YOUR_TURN"))
    return "The server says this is the other team's turn. Refresh the room; if the winner is still prompted, report the diagnostic shown in the browser console.";
  if (message.includes("LIVE_ACTION_EXPECTED_TEAM_UNAUTHORIZED"))
    return "The server resolved the prompted team but could not authorize this account for it. Copy the stage-action diagnostic from the browser console.";
  if (message.includes("LIVE_ACTION_FORBIDDEN"))
    return "Your account is not authorized for the team shown in this room. Confirm that you are its director or a linked Captain.";
  if (message.includes("LIVE_ACTION_RPS_REQUIRED"))
    return "The server has not recorded an RPS winner yet. Refresh the room before striking.";
  if (message.includes("LIVE_ACTION_INVALID_STAGE_COUNT"))
    return "The server expected a different number of stage selections. Refresh the room and select the prompted number of stages.";
  if (message.includes("LIVE_ACTION_STAGE_UNAVAILABLE"))
    return "One of those stages was already used. The room has been refreshed; choose from the remaining stages.";
  if (message.includes("LIVE_ACTION_INVALID_STAGE"))
    return "That stage action no longer matches the server state. Refresh the room and try the stages currently shown.";
  return message;
};

/** A crew-battle round must eliminate one of the two active players. */
export const isValidRoundScore = (homeStocks: number, awayStocks: number) =>
  homeStocks === 0 || awayStocks === 0;

/** Complete row shape for public.live_match_states. */
export interface LiveMatchStateRow {
  match_id: string;
  revision: number;
  game_id: string | null;
  phase: LivePhase;
  round_number: number;
  selected_stage: string | null;
  rps_home_choice: LiveRpsChoice | null;
  rps_away_choice: LiveRpsChoice | null;
  rps_winner_team_id: string | null;
  rps_tie_count: number;
  previous_round_loser_team_id: string | null;
  home_active_player_id: string | null;
  away_active_player_id: string | null;
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

export interface LiveStateFixtureContext {
  homeTeamId: string;
  awayTeamId: string;
}

// Compile-time schema fixture: adding a property to LiveMatchStateRow makes
// this fail until synchronization coverage is consciously updated.
export const COMPLETE_LIVE_MATCH_STATE_ROW_FIXTURE = {
  match_id: "00000000-0000-0000-0000-000000000001",
  revision: 0,
  game_id: null,
  phase: "check_in",
  round_number: 1,
  selected_stage: null,
  rps_home_choice: null,
  rps_away_choice: null,
  rps_winner_team_id: null,
  rps_tie_count: 0,
  previous_round_loser_team_id: null,
  home_active_player_id: null,
  away_active_player_id: null,
  home_stocks: 12,
  away_stocks: 12,
  home_round_start_stocks: 3,
  away_round_start_stocks: 3,
  score_submitted_by_team_id: null,
  score_verified_by_team_id: null,
  pending_home_score: null,
  pending_away_score: null,
  updated_at: "2026-01-01T00:00:00.000Z",
} as const satisfies LiveMatchStateRow;

const LIVE_ROSTER_SIZE_BY_GAME: Record<LiveGame, number> = {
  melee: 4,
  ultimate: 4,
};

const LIVE_STOCKS_PER_PLAYER_BY_GAME: Record<LiveGame, number> = {
  melee: 4,
  ultimate: 3,
};

export interface LiveGameRules {
  rosterSize: number;
  stocksPerPlayer: number;
  totalStocks: number;
}

export const getLiveGameRules = (
  game: LiveGame,
  configuredRosterSize?: number,
): LiveGameRules => {
  const rosterSize =
    game === "ultimate"
      ? LIVE_ROSTER_SIZE_BY_GAME.ultimate
      : (configuredRosterSize ?? LIVE_ROSTER_SIZE_BY_GAME[game]);
  const stocksPerPlayer = LIVE_STOCKS_PER_PLAYER_BY_GAME[game];

  return {
    rosterSize,
    stocksPerPlayer,
    totalStocks: rosterSize * stocksPerPlayer,
  };
};

export const clampLiveTeamStocks = (
  game: LiveGame,
  stocks: number | null | undefined,
) => {
  const { totalStocks } = getLiveGameRules(game);
  return Math.min(Math.max(stocks ?? totalStocks, 0), totalStocks);
};

export interface LivePlayer {
  id: string;
  tag: string;
  character: string;
  characterImage: string;
  stocks: number;
  selected?: boolean;
  blindPick?: boolean;
  /** Stable server-assigned order used when displaying the two revealed picks. */
  blindPickOrder?: number;
  eliminated?: boolean;
}

export interface LiveTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: "emerald" | "magenta";
  roster: LivePlayer[];
}

export interface LiveChatMessage {
  id: string;
  author: string;
  role: "director" | "player" | "system";
  side: LiveSide | null;
  message: string;
  createdAt: string;
  displayTimestamp: string;
}

export interface LiveMatchState {
  id: string;
  slug: string;
  date: string;
  status: "upcoming" | "live" | "completed";
  game: LiveGame;
  homeRosterSize: number;
  awayRosterSize: number;
  gameId: string | null;
  gameNumber: number;
  revision: number;
  roundNumber: number;
  phase: LivePhase;
  stage: string | null;
  rpsHomeChoice: LiveRpsChoice | null;
  rpsAwayChoice: LiveRpsChoice | null;
  rpsWinnerTeamId: string | null;
  rpsTieCount: number;
  homeActivePlayerId: string | null;
  awayActivePlayerId: string | null;
  homeStocks: number;
  awayStocks: number;
  pendingHomeScore: number | null;
  pendingAwayScore: number | null;
  homeRoundStartStocks: number;
  awayRoundStartStocks: number;
  previousRoundLoserTeamId: string | null;
  scoreSubmittedByTeamId: string | null;
  scoreVerifiedByTeamId: string | null;
  homeMatchScore: number;
  awayMatchScore: number;
  homeCheckedIn: boolean;
  awayCheckedIn: boolean;
  home: LiveTeam;
  away: LiveTeam;
  messages: LiveChatMessage[];
}

const canonicalLiveStateKeys = [
  "gameId", "phase", "roundNumber", "stage", "rpsHomeChoice",
  "rpsAwayChoice", "rpsWinnerTeamId", "rpsTieCount", "previousRoundLoserTeamId",
  "homeActivePlayerId", "awayActivePlayerId", "homeStocks", "awayStocks",
  "homeRoundStartStocks", "awayRoundStartStocks", "scoreSubmittedByTeamId",
  "scoreVerifiedByTeamId", "pendingHomeScore", "pendingAwayScore",
] as const satisfies readonly (keyof LiveMatchState)[];

/**
 * Applies a complete database snapshot to client state. Null database values
 * are intentional resets; callers must not pass partial rows to this reducer.
 */
export const reduceLiveStateRow = (
  current: LiveMatchState,
  row: LiveMatchStateRow,
  fixtureContext: LiveStateFixtureContext,
): LiveMatchState => {
  // Reading both IDs makes an invalid winner from another fixture canonicalize
  // to null rather than leaking into UI state.
  const validTeamIds = new Set([
    fixtureContext.homeTeamId,
    fixtureContext.awayTeamId,
  ]);
  const next: LiveMatchState = {
    ...current,
    gameId: row.game_id,
    phase: row.phase,
    roundNumber: row.round_number,
    stage: row.selected_stage,
    rpsHomeChoice: row.rps_home_choice,
    rpsAwayChoice: row.rps_away_choice,
    rpsWinnerTeamId:
      row.rps_winner_team_id && validTeamIds.has(row.rps_winner_team_id)
        ? row.rps_winner_team_id
        : null,
    rpsTieCount: Math.max(0, row.rps_tie_count),
    previousRoundLoserTeamId: row.previous_round_loser_team_id,
    homeActivePlayerId: row.home_active_player_id,
    awayActivePlayerId: row.away_active_player_id,
    homeStocks: clampLiveTeamStocks(current.game, row.home_stocks),
    awayStocks: clampLiveTeamStocks(current.game, row.away_stocks),
    homeRoundStartStocks: Math.min(
      Math.max(row.home_round_start_stocks, 0),
      getLiveGameRules(current.game, current.homeRosterSize).stocksPerPlayer,
    ),
    awayRoundStartStocks: Math.min(
      Math.max(row.away_round_start_stocks, 0),
      getLiveGameRules(current.game, current.awayRosterSize).stocksPerPlayer,
    ),
    scoreSubmittedByTeamId: row.score_submitted_by_team_id,
    scoreVerifiedByTeamId: row.score_verified_by_team_id,
    pendingHomeScore: row.pending_home_score,
    pendingAwayScore: row.pending_away_score,
  };

  return canonicalLiveStateKeys.every((key) => current[key] === next[key])
    ? current
    : next;
};

export const ultimateStarterStages = [
  "Battlefield",
  "Small Battlefield",
  "Pokemon Stadium 2",
  "Town & City",
  "Smashville",
];

export const ultimateCounterpickStages = [
  "Final Destination",
  "Hollow Bastion",
  "Kalos Pokemon League",
];

export const legalStages = [
  ...ultimateStarterStages,
  ...ultimateCounterpickStages,
];

export interface LiveStageAction {
  stage: string;
  action: "strike" | "pick";
  teamId: string;
  gameId: string | null;
}

export interface LiveStageTurn {
  pool: readonly string[];
  unavailable: string[];
  remaining: string[];
  strikeCount: number;
  actingSide: LiveSide | null;
  action: "strike" | "pick" | "wait";
  requiredSelections: number;
}

/** Authorizes a rendered stage turn by canonical team identity, not side label. */
export const canOperateLiveStageTurn = ({
  directorSide,
  actingSide,
  homeTeamId,
  awayTeamId,
}: {
  directorSide: LiveSide | null;
  actingSide: LiveSide | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
}) => {
  const teamIdFor = (side: LiveSide | null) =>
    side === "home" ? homeTeamId : side === "away" ? awayTeamId : null;
  const directorTeamId = teamIdFor(directorSide);
  const actingTeamId = teamIdFor(actingSide);
  return Boolean(
    directorTeamId && actingTeamId && directorTeamId === actingTeamId,
  );
};

/** Pure stage-order resolver shared by the UI and realtime recovery paths. */
export function getLiveStageTurn({
  phase,
  roundNumber,
  actions,
  rpsWinnerSide,
  previousRoundLoserTeamId,
  homeTeamId,
  awayTeamId,
}: {
  phase: LivePhase;
  roundNumber: number;
  actions: readonly LiveStageAction[];
  rpsWinnerSide: LiveSide | null;
  previousRoundLoserTeamId: string | null;
  homeTeamId: string;
  awayTeamId: string;
}): LiveStageTurn {
  const pool = roundNumber === 1 ? ultimateStarterStages : legalStages;
  const unavailable = actions.map(({ stage }) => stage);
  const remaining = pool.filter((stage) => !unavailable.includes(stage));
  const strikeCount = actions.filter(
    ({ action }) => action === "strike",
  ).length;
  const hasPick = actions.some(({ action }) => action === "pick");
  let actingSide: LiveSide | null = null;

  if (phase === "stage_strike" && !hasPick) {
    if (roundNumber === 1 && rpsWinnerSide) {
      // The RPS winner opens and closes the 1-2-1 sequence: one strike by the
      // winner, two by the opponent, then the winner picks the final stage.
      actingSide =
        strikeCount === 0 || strikeCount >= 3
          ? rpsWinnerSide
          : rpsWinnerSide === "home"
            ? "away"
            : "home";
    } else if (roundNumber > 1) {
      const loserSide =
        previousRoundLoserTeamId === homeTeamId
          ? "home"
          : previousRoundLoserTeamId === awayTeamId
            ? "away"
            : null;
      const picker = loserSide ?? (roundNumber % 2 === 0 ? "home" : "away");
      actingSide =
        strikeCount < 3 ? (picker === "home" ? "away" : "home") : picker;
    }
  }

  const action =
    actingSide === null ? "wait" : strikeCount >= 3 ? "pick" : "strike";
  return {
    pool,
    unavailable,
    remaining,
    strikeCount,
    actingSide,
    action,
    requiredSelections:
      action === "strike"
        ? roundNumber === 1 && strikeCount === 0
          ? 1
          : Math.max(1, 3 - strikeCount)
        : action === "pick"
          ? 1
          : 0,
  };
}

/** Hides an opponent's unrevealed round-one choices without mutating the canonical roster. */
export function getBlindedLiveRoster(
  roster: readonly LivePlayer[],
  shouldBlind: boolean,
): LivePlayer[] | readonly LivePlayer[] {
  if (!shouldBlind) return roster;
  return roster
    .map((player) => ({
      ...player,
      character: "Character hidden",
      characterImage: "",
      selected: false,
    }))
    .sort((a, b) =>
      a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" }),
    );
}

/** Applies primitive live-state fields while retaining every unchanged nested reference. */
export function reconcileLiveMatchState(
  current: LiveMatchState,
  patch: Partial<LiveMatchState>,
): LiveMatchState {
  let changed = false;
  const next = { ...current };
  (Object.keys(patch) as (keyof LiveMatchState)[]).forEach((key) => {
    const value = patch[key];
    if (value !== undefined && current[key] !== value) {
      changed = true;
      Object.assign(next, { [key]: value });
    }
  });
  return changed ? next : current;
}

const homeRoster: LivePlayer[] = [
  {
    id: "tri-1",
    tag: "Hollow",
    character: "Sheik",
    characterImage: "/characterIcons/melee/105 - Sheik (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "tri-2",
    tag: "Riven",
    character: "Fox",
    characterImage: "/characterIcons/melee/27 - Fox (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "tri-3",
    tag: "Sora",
    character: "Marth",
    characterImage: "/characterIcons/melee/68 - Marth (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "tri-4",
    tag: "Vanta",
    character: "Falco",
    characterImage: "/characterIcons/melee/23 - Falco (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "tri-5",
    tag: "Kairo",
    character: "Captain Falcon",
    characterImage: "/characterIcons/melee/8 - Falcon (Default).png",
    stocks: 3,
  },
  {
    id: "tri-6",
    tag: "Lumen",
    character: "Peach",
    characterImage: "/characterIcons/melee/81 - Peach (Default).png",
    stocks: 3,
  },
];

const awayRoster: LivePlayer[] = [
  {
    id: "inv-1",
    tag: "Talon",
    character: "Fox",
    characterImage: "/characterIcons/melee/27 - Fox (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "inv-2",
    tag: "Osmics",
    character: "Falco",
    characterImage: "/characterIcons/melee/23 - Falco (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "inv-3",
    tag: "Brain",
    character: "Samus",
    characterImage: "/characterIcons/melee/101 - Samus (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "inv-4",
    tag: "meenis",
    character: "Pikachu",
    characterImage: "/characterIcons/melee/86 - Pikachu (Default).png",
    stocks: 3,
    selected: true,
  },
  {
    id: "inv-5",
    tag: "Arc",
    character: "Jigglypuff",
    characterImage: "/characterIcons/melee/90 - Jigglypuff (Default).png",
    stocks: 3,
  },
  {
    id: "inv-6",
    tag: "Moxie",
    character: "Peach",
    characterImage: "/characterIcons/melee/81 - Peach (Default).png",
    stocks: 3,
  },
];

export const getDemoLiveMatch = (slug: string): LiveMatchState => ({
  id: "match-inv-vs-tri-upcoming",
  slug,
  date: "2026-06-10T01:00:00Z",
  status: "live",
  game: "ultimate",
  homeRosterSize: 4,
  awayRosterSize: 4,
  gameId: null,
  gameNumber: 1,
  revision: 0,
  roundNumber: 1,
  phase: "player_select",
  stage: null,
  rpsHomeChoice: null,
  rpsAwayChoice: null,
  rpsWinnerTeamId: null,
  rpsTieCount: 0,
  homeActivePlayerId: null,
  awayActivePlayerId: null,
  homeStocks: 12,
  awayStocks: 12,
  pendingHomeScore: null,
  pendingAwayScore: null,
  homeRoundStartStocks: 3,
  awayRoundStartStocks: 3,
  previousRoundLoserTeamId: null,
  scoreSubmittedByTeamId: null,
  scoreVerifiedByTeamId: null,
  homeMatchScore: 0,
  awayMatchScore: 0,
  homeCheckedIn: true,
  awayCheckedIn: true,
  home: {
    id: "team-2",
    name: "Triad",
    shortName: "TRI",
    logo: "/logos/Secondary/PNG/Nexus Magenta Small.png",
    color: "magenta",
    roster: homeRoster,
  },
  away: {
    id: "team-3",
    name: "Invaders",
    shortName: "INV",
    logo: "/logos/B&W/PNG/Solid White.png",
    color: "emerald",
    roster: awayRoster,
  },
  messages: [],
});
