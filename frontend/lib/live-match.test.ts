import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessLiveMatchRoom,
  isLiveMatchAccessOpen,
  COMPLETE_LIVE_MATCH_STATE_ROW_FIXTURE,
  canOperateLiveStageTurn,
  cycleCappedSelection,
  getDemoLiveMatch,
  getLiveActionErrorNotice,
  isValidRoundScore,
  getLiveStageTurn,
  reconcileLiveMatchState,
} from "./live-match.ts";

test("capped selections cycle out the oldest choice when full", () => {
  assert.deepEqual(cycleCappedSelection(["camoREX", "Peabnut"], "CJFrozen", 2), [
    "Peabnut",
    "CJFrozen",
  ]);
  assert.deepEqual(cycleCappedSelection(["A", "B", "C"], "D", 3), [
    "B",
    "C",
    "D",
  ]);
  assert.deepEqual(cycleCappedSelection(["A", "B"], "A", 3), ["B"]);
  assert.deepEqual(cycleCappedSelection(["A"], "B", 1), ["B"]);
});

test("round scores require at least one eliminated player", () => {
  assert.equal(isValidRoundScore(0, 3), true);
  assert.equal(isValidRoundScore(2, 0), true);
  assert.equal(isValidRoundScore(0, 0), true);
  assert.equal(isValidRoundScore(1, 1), false);
  assert.equal(isValidRoundScore(3, 2), false);
});

test("RPC rejections remain visible to live-room operators", () => {
  assert.equal(
    getLiveActionErrorNotice("LIVE_ACTION_NOT_YOUR_TURN"),
    "The server says this is the other team's turn. Refresh the room; if the winner is still prompted, report the diagnostic shown in the browser console.",
  );
  assert.equal(
    getLiveActionErrorNotice("permission denied"),
    "permission denied",
  );
  assert.match(
    getLiveActionErrorNotice("LIVE_ACTION_EXPECTED_TEAM_UNAUTHORIZED"),
    /could not authorize this account/,
  );
  assert.match(
    getLiveActionErrorNotice("LIVE_ACTION_INVALID_STAGE_COUNT expected=1 received=2"),
    /different number/,
  );
});

test("round one stage order follows 1-2-1 striking", () => {
  const base = {
    phase: "stage_strike" as const,
    roundNumber: 1,
    rpsWinnerSide: "home" as const,
    previousRoundLoserTeamId: null,
    homeTeamId: "h",
    awayTeamId: "a",
  };
  assert.equal(getLiveStageTurn({ ...base, actions: [] }).actingSide, "home");
  assert.equal(
    getLiveStageTurn({
      ...base,
      actions: [{ stage: "A", action: "strike", teamId: "h", gameId: null }],
    }).actingSide,
    "away",
  );
  assert.equal(
    getLiveStageTurn({
      ...base,
      actions: ["A", "B", "C"].map((stage) => ({
        stage,
        action: "strike" as const,
        teamId: "h",
        gameId: null,
      })),
    }).action,
    "pick",
  );
});

test("round one stage order follows either RPS winner", () => {
  for (const winner of ["home", "away"] as const) {
    const opponent = winner === "home" ? "away" : "home";
    const base = {
      phase: "stage_strike" as const,
      roundNumber: 1,
      rpsWinnerSide: winner,
      previousRoundLoserTeamId: null,
      homeTeamId: "h",
      awayTeamId: "a",
    };

    const first = getLiveStageTurn({ ...base, actions: [] });
    assert.deepEqual(
      [first.actingSide, first.action, first.requiredSelections],
      [winner, "strike", 1],
    );

    const afterFirst = getLiveStageTurn({
      ...base,
      actions: [{
        stage: "A",
        action: "strike",
        teamId: winner === "home" ? "h" : "a",
        gameId: null,
      }],
    });
    assert.deepEqual(
      [afterFirst.actingSide, afterFirst.action, afterFirst.requiredSelections],
      [opponent, "strike", 2],
    );

    const afterSecond = getLiveStageTurn({
      ...base,
      actions: ["A", "B", "C"].map((stage) => ({
        stage,
        action: "strike" as const,
        teamId:
          stage === "A"
            ? winner === "home" ? "h" : "a"
            : opponent === "home" ? "h" : "a",
        gameId: null,
      })),
    });
    assert.deepEqual(
      [afterSecond.actingSide, afterSecond.action, afterSecond.requiredSelections],
      [winner, "pick", 1],
    );
  }
});

test("only the canonical team whose turn it is can operate stage controls", () => {
  const fixture = { homeTeamId: "wu", awayTeamId: "lcu" };
  assert.equal(
    canOperateLiveStageTurn({
      ...fixture,
      directorSide: "home",
      actingSide: "home",
    }),
    true,
  );
  assert.equal(
    canOperateLiveStageTurn({
      ...fixture,
      directorSide: "away",
      actingSide: "home",
    }),
    false,
  );
});

test("round one cannot start stage striking until RPS has a winner", () => {
  const turn = getLiveStageTurn({
    phase: "stage_strike",
    roundNumber: 1,
    actions: [],
    rpsWinnerSide: null,
    previousRoundLoserTeamId: null,
    homeTeamId: "h",
    awayTeamId: "a",
  });
  assert.deepEqual(
    [turn.actingSide, turn.action, turn.requiredSelections],
    [null, "wait", 0],
  );
});

test("later rounds let the previous loser pick after three strikes", () => {
  const turn = getLiveStageTurn({
    phase: "stage_strike",
    roundNumber: 2,
    rpsWinnerSide: null,
    previousRoundLoserTeamId: "a",
    homeTeamId: "h",
    awayTeamId: "a",
    actions: ["A", "B", "C"].map((stage) => ({
      stage,
      action: "strike" as const,
      teamId: "h",
      gameId: null,
    })),
  });
  assert.equal(turn.actingSide, "away");
  assert.equal(turn.requiredSelections, 1);
});

test("reconciliation preserves unchanged nested references and no-op state", () => {
  const state = getDemoLiveMatch("demo");
  assert.equal(reconcileLiveMatchState(state, { phase: state.phase }), state);
  const next = reconcileLiveMatchState(state, { phase: "playing" });
  assert.equal(next.home, state.home);
  assert.equal(next.away.roster, state.away.roster);
  assert.equal(next.messages, state.messages);
});

import { mapLiveRoomSnapshot, reconcileActivePlayerDraft } from './live-room-snapshot.ts';
import type { LiveMatchRoomSnapshot } from './data.ts';
import { runRevisionedAction } from './live-room-actions.ts';

test("live match access opens exactly one hour before the scheduled start", () => {
  const startsAt = "2026-09-14T18:00:00.000Z";

  assert.equal(isLiveMatchAccessOpen(startsAt, Date.parse("2026-09-14T16:59:59.999Z")), false);
  assert.equal(isLiveMatchAccessOpen(startsAt, Date.parse("2026-09-14T17:00:00.000Z")), true);
  assert.equal(isLiveMatchAccessOpen(startsAt, Date.parse("2026-09-14T19:00:00.000Z")), true);
  assert.equal(isLiveMatchAccessOpen("not-a-date", Date.now()), false);
});

test("only moderators bypass the live match access window", () => {
  const startsAt = "2026-09-14T18:00:00.000Z";
  const beforeAccessWindow = Date.parse("2026-09-14T12:00:00.000Z");

  assert.equal(canAccessLiveMatchRoom(startsAt, "mod", beforeAccessWindow), true);
  assert.equal(canAccessLiveMatchRoom(startsAt, "director", beforeAccessWindow), false);
  assert.equal(canAccessLiveMatchRoom(startsAt, "player", beforeAccessWindow), false);
  assert.equal(canAccessLiveMatchRoom(startsAt, null, beforeAccessWindow), false);
});

const snapshotFixture = (): LiveMatchRoomSnapshot => ({
  fixture: { id: 'm', slug: 'h-v-a', date: '2026-01-01', status: 'live', home_team_id: 'h', away_team_id: 'a', home_score: 0, away_score: 0 },
  home_team: { id: 'h', name: 'Home', short_name: 'H', avatar: null, director_user_id: null },
  away_team: { id: 'a', name: 'Away', short_name: 'A', avatar: null, director_user_id: null },
  players: [{ id: 'p2', team_id: 'h', tag: 'Zulu' }, { id: 'p1', team_id: 'h', tag: 'Alpha' }],
  active_game: { id: 'g', game: 'ultimate', game_order: 1, home_roster_size: 4, away_roster_size: 4 },
  live_state: { ...COMPLETE_LIVE_MATCH_STATE_ROW_FIXTURE, match_id: 'm', game_id: 'g', revision: 4 },
  check_in_team_ids: ['h'],
  roster_selections: [
    { match_id: 'm', team_id: 'h', player_id: 'p2', slot_order: 2, selected_character: 'Fox', selected_character_image: '', stocks_remaining: 3 },
    { match_id: 'm', team_id: 'h', player_id: 'p1', slot_order: 1, selected_character: 'Mario', selected_character_image: '', stocks_remaining: 3 },
  ],
  blind_picks: [],
  stage_actions: [
    { id: 'b', match_id: 'm', game_id: 'g', round_number: 1, team_id: 'h', stage: 'B', action: 'strike', created_at: '2026-01-01T00:00:02Z' },
    { id: 'a', match_id: 'm', game_id: 'g', round_number: 1, team_id: 'a', stage: 'A', action: 'strike', created_at: '2026-01-01T00:00:01Z' },
    { id: 'a', match_id: 'm', game_id: 'g', round_number: 1, team_id: 'a', stage: 'A', action: 'strike', created_at: '2026-01-01T00:00:01Z' },
  ],
  viewer: { user_id: null, tag: null, role: null, authorized_side: null, can_operate: false },
  chat_messages: [], has_earlier_messages: false,
});

test('snapshot mapping resets nullable fields and orders roster/actions deterministically', () => {
  const snapshot = snapshotFixture();
  const previous = { ...getDemoLiveMatch('demo'), revision: 3, stage: 'Old', pendingHomeScore: 2 };
  const mapped = mapLiveRoomSnapshot(snapshot, previous);
  assert.equal(mapped.match.stage, null);
  assert.equal(mapped.match.pendingHomeScore, null);
  assert.deepEqual(mapped.match.home.roster.map(({ id }) => id), ['p1', 'p2']);
  assert.deepEqual(mapped.stageActions.map(({ stage }) => stage), ['A', 'B']);
});

test('snapshot mapping preserves blind-pick submission order independently of roster order', () => {
  const snapshot = snapshotFixture();
  snapshot.blind_picks = [
    { match_id: 'm', team_id: 'h', player_id: 'p2', pick_order: 1 },
    { match_id: 'm', team_id: 'h', player_id: 'p1', pick_order: 2 },
  ];

  const mapped = mapLiveRoomSnapshot(snapshot, null);
  assert.deepEqual(
    mapped.match.home.roster
      .filter(({ blindPick }) => blindPick)
      .sort((a, b) => a.blindPickOrder! - b.blindPickOrder!)
      .map(({ id }) => id),
    ['p2', 'p1'],
  );
  assert.deepEqual(mapped.match.home.roster.map(({ id }) => id), ['p1', 'p2']);
});

test("an opponent's blind-pick submission does not clear the viewer's local draft", () => {
  const snapshot = snapshotFixture();
  snapshot.live_state = {
    ...snapshot.live_state!,
    phase: 'blind_pick',
    revision: 5,
  };
  snapshot.viewer = {
    user_id: 'director',
    tag: 'Director',
    role: 'director',
    authorized_side: 'home',
    can_operate: true,
  };
  snapshot.blind_picks = [
    { match_id: 'm', team_id: 'a', player_id: 'away-1', pick_order: 1 },
    { match_id: 'm', team_id: 'a', player_id: 'away-2', pick_order: 2 },
  ];
  const current = mapLiveRoomSnapshot({ ...snapshot, blind_picks: [] }, null).match;
  current.home.roster = current.home.roster.map((player) => ({ ...player, blindPick: true }));

  const mapped = mapLiveRoomSnapshot(snapshot, current);

  assert.deepEqual(
    mapped.match.home.roster.filter(({ blindPick }) => blindPick).map(({ id }) => id),
    ['p1', 'p2'],
  );
});

test("an opponent's player confirmation does not clear the viewer's player character draft", () => {
  const snapshot = snapshotFixture();
  snapshot.live_state = {
    ...snapshot.live_state!,
    phase: 'player_select',
    round_number: 1,
    revision: 6,
    home_active_player_id: null,
    away_active_player_id: 'away-1',
  };
  snapshot.viewer = {
    user_id: 'director',
    tag: 'Director',
    role: 'director',
    authorized_side: 'home',
    can_operate: true,
  };
  snapshot.roster_selections = [];
  snapshot.blind_picks = [
    { match_id: 'm', team_id: 'h', player_id: 'p1', pick_order: 1 },
    { match_id: 'm', team_id: 'h', player_id: 'p2', pick_order: 2 },
    { match_id: 'm', team_id: 'a', player_id: 'away-1', pick_order: 1 },
    { match_id: 'm', team_id: 'a', player_id: 'away-2', pick_order: 2 },
  ];
  const current = mapLiveRoomSnapshot(snapshot, null).match;
  current.revision = 5;
  current.home.roster = current.home.roster.map((player) =>
    player.id === 'p1'
      ? { ...player, character: 'Pikachu', characterImage: '/pikachu.png' }
      : player,
  );

  const mapped = mapLiveRoomSnapshot(snapshot, current);
  const draftedPlayer = mapped.match.home.roster.find(({ id }) => id === 'p1');

  assert.equal(draftedPlayer?.character, 'Pikachu');
  assert.equal(draftedPlayer?.characterImage, '/pikachu.png');
});

test("an opponent's realtime confirmation does not clear the viewer's active player draft", () => {
  assert.equal(reconcileActivePlayerDraft({
    serverPlayerId: null,
    localPlayerId: 'p1',
    viewerSide: 'home',
    playerSide: 'home',
    previousPhase: 'player_select',
    nextPhase: 'player_select',
    sameGameAndRound: true,
  }), 'p1');

  assert.equal(reconcileActivePlayerDraft({
    serverPlayerId: null,
    localPlayerId: 'p1',
    viewerSide: 'home',
    playerSide: 'home',
    previousPhase: 'player_select',
    nextPhase: 'stage_strike',
    sameGameAndRound: true,
  }), null);
});

test('legacy roster snapshots open the actionable Round 1 double blind', () => {
  const snapshot = snapshotFixture();
  snapshot.live_state = { ...snapshot.live_state!, phase: 'roster' as never };
  const mapped = mapLiveRoomSnapshot(snapshot, null);
  assert.equal(mapped.match.phase, 'blind_pick');
});

test('older snapshots cannot overwrite newer realtime revision and chat is deduplicated', () => {
  const snapshot = snapshotFixture();
  snapshot.live_state = { ...snapshot.live_state!, revision: 2, selected_stage: 'Old snapshot' };
  snapshot.chat_messages = [
    { id: 'chat', match_id: 'm', user_id: 'u', team_id: 'h', message: 'hello', created_at: '2026-01-01T00:00:01Z', author_tag: 'Tag', author_role: 'player' },
    { id: 'chat', match_id: 'm', user_id: 'u', team_id: 'h', message: 'hello', created_at: '2026-01-01T00:00:01Z', author_tag: 'Tag', author_role: 'player' },
  ];
  const demo = getDemoLiveMatch('demo');
  const previous = {
    ...demo,
    revision: 5,
    stage: 'Realtime stage',
    home: { ...demo.home, id: 'stale-home' },
    away: { ...demo.away, id: 'stale-away' },
  };
  const mapped = mapLiveRoomSnapshot(snapshot, previous);
  assert.equal(mapped.match.revision, 5);
  assert.equal(mapped.match.stage, 'Realtime stage');
  assert.equal(mapped.match.messages.length, 1);
  assert.equal(mapped.match.home.id, snapshot.fixture.home_team_id);
  assert.equal(mapped.match.away.id, snapshot.fixture.away_team_id);
});

test('snapshot mapping drops stage actions belonging to an earlier game', () => {
  const snapshot = snapshotFixture();
  snapshot.stage_actions.push({
    id: 'old-game-action', match_id: 'm', game_id: 'old-game', round_number: 1,
    team_id: 'h', stage: 'Smashville', action: 'strike', created_at: '2025-12-31T23:59:59Z',
  });

  const mapped = mapLiveRoomSnapshot(snapshot, null);
  assert.deepEqual(mapped.stageActions.map(({ stage }) => stage), ['A', 'B']);
});

test('snapshot mapping retains null-game stage actions for a null-game live state', () => {
  const snapshot = snapshotFixture();
  snapshot.live_state = { ...snapshot.live_state!, game_id: null };
  snapshot.stage_actions = [{
    id: 'null-game-action', match_id: 'm', game_id: null, round_number: 1,
    team_id: 'h', stage: 'Town & City', action: 'strike', created_at: '2026-01-01T00:00:01Z',
  }];

  const mapped = mapLiveRoomSnapshot(snapshot, null);
  assert.equal(mapped.match.gameId, null);
  assert.deepEqual(mapped.stageActions.map(({ stage }) => stage), ['Town & City']);
});

test('revision conflicts refresh state and retry the action without user intervention', async () => {
  const revisions: number[] = [];
  const applied: number[] = [];
  const result = await runRevisionedAction({
    revision: 4,
    execute: async (expectedRevision) => {
      revisions.push(expectedRevision);
      return expectedRevision === 4
        ? { data: { conflict: true, state: { revision: 5 } }, error: null }
        : { data: { conflict: false, state: { revision: 6 } }, error: null };
    },
    applyState: (state) => applied.push(state.revision),
  });

  assert.equal(result.error, null);
  assert.equal(result.data?.conflict, false);
  assert.deepEqual(revisions, [4, 5]);
  assert.deepEqual(applied, [5, 6]);
});

test('attempt-scoped actions apply conflict state without replaying stale input', async () => {
  const revisions: number[] = [];
  const applied: number[] = [];
  const result = await runRevisionedAction({
    revision: 4,
    retryConflicts: false,
    execute: async (expectedRevision) => {
      revisions.push(expectedRevision);
      return { data: { conflict: true, state: { revision: 5 } }, error: null };
    },
    applyState: (state) => applied.push(state.revision),
  });

  assert.equal(result.error, null);
  assert.equal(result.data?.conflict, true);
  assert.deepEqual(revisions, [4]);
  assert.deepEqual(applied, [5]);
});

test('RPS-style conflicts retry only within the same tie generation', async () => {
  const revisions: number[] = [];
  const result = await runRevisionedAction({
    revision: 4,
    retryConflicts: (state) => state.tieCount === 2,
    execute: async (revision) => {
      revisions.push(revision);
      return revision === 4
        ? { data: { conflict: true, state: { revision: 5, tieCount: 2 } }, error: null }
        : { data: { conflict: false, state: { revision: 6, tieCount: 2 } }, error: null };
    },
    applyState: () => undefined,
  });
  assert.equal(result.data?.conflict, false);
  assert.deepEqual(revisions, [4, 5]);

  const staleRevisions: number[] = [];
  const stale = await runRevisionedAction({
    revision: 6,
    retryConflicts: (state) => state.tieCount === 2,
    execute: async (revision) => {
      staleRevisions.push(revision);
      return { data: { conflict: true, state: { revision: 7, tieCount: 3 } }, error: null };
    },
    applyState: () => undefined,
  });
  assert.equal(stale.data?.conflict, true);
  assert.deepEqual(staleRevisions, [6]);
});

test('successful reveal actions can wait for the shared realtime update', async () => {
  const applied: number[] = [];
  const result = await runRevisionedAction({
    revision: 4,
    applySuccessfulState: false,
    execute: async () => ({
      data: { conflict: false, state: { revision: 5 } },
      error: null,
    }),
    applyState: (state) => applied.push(state.revision),
  });

  assert.equal(result.data?.conflict, false);
  assert.deepEqual(applied, []);
});

test('revision retries are bounded during a rapidly changing room', async () => {
  let calls = 0;
  const result = await runRevisionedAction({
    revision: 1,
    execute: async (expectedRevision) => {
      calls += 1;
      return { data: { conflict: true, state: { revision: expectedRevision + 1 } }, error: null };
    },
    applyState: () => undefined,
  });

  assert.equal(calls, 3);
  assert.match(result.error?.message ?? '', /changing quickly/);
});
