import { resolveCharacterImagePath } from './characters.ts';
import type { LiveMatchRoomSnapshot } from './data.ts';
import {
  getLiveGameRules,
  reduceLiveStateRow,
  type LiveChatMessage,
  type LiveMatchState,
  type LivePlayer,
  type LiveStageAction,
} from './live-match.ts';

export const reconcileActivePlayerDraft = ({
  serverPlayerId,
  localPlayerId,
  viewerSide,
  playerSide,
  previousPhase,
  nextPhase,
  sameGameAndRound,
}: {
  serverPlayerId: string | null;
  localPlayerId: string | null;
  viewerSide: 'home' | 'away' | null;
  playerSide: 'home' | 'away';
  previousPhase: string | null;
  nextPhase: string | null;
  sameGameAndRound: boolean;
}) => serverPlayerId ?? (
  viewerSide === playerSide &&
  previousPhase === 'player_select' &&
  nextPhase === 'player_select' &&
  sameGameAndRound
    ? localPlayerId
    : null
);

const byCreatedThenId = <T extends { created_at: string; id: string }>(a: T, b: T) =>
  a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

export const mapLiveRoomSnapshot = (
  snapshot: LiveMatchRoomSnapshot,
  current: LiveMatchState | null,
): { match: LiveMatchState; stageActions: LiveStageAction[] } => {
  const { fixture, active_game: game } = snapshot;
  // Rooms opened while the roster-lock rollout was live can still receive one
  // cached/realtime `roster` row during deployment. Treat it as the opening
  // double blind so directors never land on a phase with no controls.
  const state = snapshot.live_state && (snapshot.live_state.phase as string) === 'roster'
    ? { ...snapshot.live_state, phase: 'blind_pick' as const }
    : snapshot.live_state;
  const gameType = game?.game ?? 'ultimate';
  const homeRules = getLiveGameRules(gameType, game?.home_roster_size);
  const awayRules = getLiveGameRules(gameType, game?.away_roster_size);
  const selections = new Map(snapshot.roster_selections.map((row) => [row.player_id, row]));
  const blindPicks = new Map(snapshot.blind_picks.map((row) => [row.player_id, row]));
  const viewerSide = snapshot.viewer.authorized_side;
  const viewerTeamId = viewerSide === 'home'
    ? fixture.home_team_id
    : viewerSide === 'away'
      ? fixture.away_team_id
      : null;
  const viewerHasSubmittedBlindPicks = viewerTeamId !== null && snapshot.blind_picks.some(
    (pick) => pick.team_id === viewerTeamId,
  );
  const preservesViewerPlayerDraft = Boolean(
    viewerTeamId && viewerSide && current &&
    state?.phase === 'player_select' && current.phase === 'player_select' &&
    (game?.id ?? null) === current.gameId &&
    (state?.round_number ?? 1) === current.roundNumber,
  );
  const viewerPlayerDraft = new Map(
    preservesViewerPlayerDraft && viewerSide
      ? current![viewerSide].roster.map((player) => [player.id, player] as const)
      : [],
  );
  // A snapshot contains persisted submissions, not the other director's local
  // draft. Preserve this viewer's unsubmitted choices when the opposing team
  // submits and the resulting revision refreshes the room.
  const localBlindPickDraft = new Set(
    viewerTeamId && viewerSide && !viewerHasSubmittedBlindPicks && state?.phase === 'blind_pick'
      ? (current?.[viewerSide].roster ?? [])
        .filter((player) => player.blindPick)
        .map((player) => player.id)
      : [],
  );
  const roster = (teamId: string, stocksPerPlayer: number): LivePlayer[] =>
    snapshot.players
      .filter((player) => player.team_id === teamId)
      .sort((a, b) => {
        const aSlot = selections.get(a.id)?.slot_order ?? Number.MAX_SAFE_INTEGER;
        const bSlot = selections.get(b.id)?.slot_order ?? Number.MAX_SAFE_INTEGER;
        return aSlot - bSlot || a.tag.localeCompare(b.tag) || a.id.localeCompare(b.id);
      })
      .map((player) => {
        const selection = selections.get(player.id);
        // Player and character choices are intentionally local until confirm.
        // An opposing confirmation increments the shared revision and causes a
        // snapshot refresh, but must not erase this viewer's in-progress draft.
        const localDraft = player.team_id === viewerTeamId ? viewerPlayerDraft.get(player.id) : undefined;
        const character = selection?.selected_character ?? localDraft?.character ?? 'Character not selected';
        return {
          id: player.id,
          tag: player.tag,
          character,
          characterImage: selection
            ? resolveCharacterImagePath(gameType, character, selection.selected_character_image)
            : localDraft?.characterImage ?? '',
          stocks: Math.min(Math.max(selection?.stocks_remaining ?? stocksPerPlayer, 0), stocksPerPlayer),
          selected: Boolean(selection),
          blindPick: blindPicks.has(player.id) || (player.team_id === viewerTeamId && localBlindPickDraft.has(player.id)),
          // Roster order changes as active-player selections are persisted. Keep
          // the reveal tied to the immutable order submitted for the double blind.
          blindPickOrder: blindPicks.get(player.id)?.pick_order,
        };
      });
  const recoveredMessages: LiveChatMessage[] = snapshot.chat_messages
    .slice()
    .sort(byCreatedThenId)
    .map((message) => ({
      id: message.id,
      author: message.author_tag ?? 'Director',
      role: message.author_role === 'player' ? 'player' : 'director',
      side: message.team_id === fixture.home_team_id ? 'home' : message.team_id === fixture.away_team_id ? 'away' : null,
      message: message.message,
      createdAt: message.created_at,
      displayTimestamp: new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }));
  const messageMap = new Map((current?.messages ?? []).filter((m) => m.id.startsWith('local-')).map((m) => [m.id, m]));
  for (const message of recoveredMessages) messageMap.set(message.id, message);
  const messages = Array.from(messageMap.values()).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const checked = new Set(snapshot.check_in_team_ids);
  let match: LiveMatchState = {
    id: fixture.id, slug: fixture.slug, date: fixture.date, status: fixture.status,
    game: gameType, gameId: game?.id ?? null,
    homeRosterSize: homeRules.rosterSize, awayRosterSize: awayRules.rosterSize,
    gameNumber: game?.game_order ?? 1, revision: state?.revision ?? 0,
    roundNumber: state?.round_number ?? 1,
    phase: state?.phase ?? (fixture.status === 'upcoming' ? 'check_in' : 'player_select'),
    stage: null, rpsHomeChoice: null, rpsAwayChoice: null, rpsWinnerTeamId: null, rpsTieCount: 0,
    homeActivePlayerId: null, awayActivePlayerId: null,
    homeStocks: homeRules.totalStocks, awayStocks: awayRules.totalStocks,
    pendingHomeScore: null, pendingAwayScore: null,
    homeRoundStartStocks: homeRules.stocksPerPlayer, awayRoundStartStocks: awayRules.stocksPerPlayer,
    previousRoundLoserTeamId: null, scoreSubmittedByTeamId: null, scoreVerifiedByTeamId: null,
    homeMatchScore: fixture.home_score ?? 0, awayMatchScore: fixture.away_score ?? 0,
    homeCheckedIn: checked.has(fixture.home_team_id), awayCheckedIn: checked.has(fixture.away_team_id), messages,
    home: { id: fixture.home_team_id, name: snapshot.home_team.name, shortName: snapshot.home_team.short_name, logo: snapshot.home_team.avatar ?? '/logos/B&W/PNG/Solid White.png', color: 'magenta', roster: roster(fixture.home_team_id, homeRules.stocksPerPlayer) },
    away: { id: fixture.away_team_id, name: snapshot.away_team.name, shortName: snapshot.away_team.short_name, logo: snapshot.away_team.avatar ?? '/logos/B&W/PNG/Solid White.png', color: 'emerald', roster: roster(fixture.away_team_id, awayRules.stocksPerPlayer) },
  };
  // Never let a recovery response that began before a realtime event roll state back.
  if (state && (!current || state.revision >= current.revision)) {
    match = reduceLiveStateRow(match, state, { homeTeamId: fixture.home_team_id, awayTeamId: fixture.away_team_id });
    match.revision = state.revision;
  } else if (current && state && state.revision < current.revision) {
    match = {
      ...match,
      ...current,
      // Preserve the newer live state, but never copy fixture/team identity
      // from an older render into a canonical snapshot response.
      id: fixture.id,
      slug: fixture.slug,
      home: { ...match.home, roster: current.home.roster },
      away: { ...match.away, roster: current.away.roster },
      messages,
    };
  }
  const stageActions = snapshot.stage_actions.slice().sort(byCreatedThenId).filter((action, index, rows) =>
    action.round_number === match.roundNumber &&
    (action.game_id === match.gameId || (match.gameId !== null && action.game_id === null)) &&
    index === rows.findIndex((other) => other.id === action.id),
  ).map<LiveStageAction>((action) => ({ teamId: action.team_id, stage: action.stage, action: action.action === 'pick' ? 'pick' : 'strike', gameId: action.game_id }));
  return { match, stageActions };
};
