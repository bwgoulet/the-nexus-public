"use client";

import {
  RiArrowLeftSFill,
  RiRefreshFill,
  RiDiscussFill,
  RiCheckboxCircleFill,
  RiArrowRightSFill,
  RiTimeFill,
  RiSendPlaneFill,
  RiShieldCheckFill,
  RiBroadcastFill,
  RiAccountCircleFill,
  RiCloseFill,
  RiCloseCircleFill,
} from "@remixicon/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CSSProperties,
  FormEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RouteLoader } from "@/app/components/route-loader";
import { useTeamColors } from "@/lib/colors";
import { resolveRoundStageIcon } from "@/lib/stages";
import {
  getCharacterIconPath,
  getCharacterOptions,
  getCharacterRenderPath,
  resolveCharacterImagePath,
} from "@/lib/characters";
import {
  clampLiveTeamStocks,
  canAccessLiveMatchRoom,
  getLiveGameRules,
  getBlindedLiveRoster,
  getLiveActionErrorNotice,
  canOperateLiveStageTurn,
  cycleCappedSelection,
  isValidRoundScore,
  getLiveStageTurn,
  reconcileLiveMatchState,
  legalStages,
  reduceLiveStateRow,
  ultimateStarterStages,
  type LiveChatMessage,
  type LiveGame,
  type LiveMatchState,
  type LiveMatchStateRow,
  type LivePhase,
  type LivePlayer,
  type LiveSide,
  type LiveRpsChoice,
} from "@/lib/live-match";
import { getSupabaseClient } from "@/lib/supabase";
import { LiveRoomService } from "@/lib/live-room-service";
import { runRevisionedAction } from "@/lib/live-room-actions";
import {
  mapLiveRoomSnapshot,
  reconcileActivePlayerDraft,
} from "@/lib/live-room-snapshot";
import type { LiveRoomRpcArguments, LiveRoomRpcName } from "@/lib/data";

type RpsChoice = LiveRpsChoice;
type StageAction = {
  stage: string;
  action: "strike" | "pick";
  teamId: string;
  gameId: string | null;
};
type ChatRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  message: string;
  created_at: string;
  users?: {
    tag?: string | null;
    role?: LiveChatMessage["role"] | null;
  } | null;
};
type RealtimePayload<Row> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Partial<Row>;
  old: Partial<Row>;
};

const CHAT_PAGE_SIZE = 50;
const SCORE_DISPUTED_NOTICE =
  "Score disputed. Both teams must report the round stocks again.";

const isScoreDisputeTransition = (
  previous: Pick<LiveMatchState, "phase" | "scoreSubmittedByTeamId"> | null,
  next: Pick<LiveMatchState, "phase" | "scoreSubmittedByTeamId">,
) =>
  previous?.phase === "score_verify" &&
  Boolean(previous.scoreSubmittedByTeamId) &&
  next.phase === "playing" &&
  next.scoreSubmittedByTeamId === null;

const formatChatTimestamp = (createdAt: string) =>
  new Date(createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const areChatMessagesEqual = (
  first: LiveChatMessage,
  second: LiveChatMessage,
) =>
  first.id === second.id &&
  first.author === second.author &&
  first.role === second.role &&
  first.side === second.side &&
  first.message === second.message &&
  first.createdAt === second.createdAt &&
  first.displayTimestamp === second.displayTimestamp;

const areChatMessageListsEqual = (
  first: LiveChatMessage[],
  second: LiveChatMessage[],
) =>
  first.length === second.length &&
  first.every((message, index) => areChatMessagesEqual(message, second[index]));

const sameRecoveryState = (current: LiveMatchState, next: LiveMatchState) =>
  JSON.stringify({ ...current, messages: undefined }) ===
  JSON.stringify({ ...next, messages: undefined });

const rpsChoices: RpsChoice[] = ["rock", "paper", "scissors"];

const rpsChoiceAssets: Record<RpsChoice, { src: string; label: string }> = {
  rock: {
    src: "/misc/rock-svgrepo-com.svg",
    label: "Rock",
  },
  paper: {
    src: "/misc/paper-svgrepo-com.svg",
    label: "Paper",
  },
  scissors: {
    src: "/misc/scissors-svgrepo-com.svg",
    label: "Scissors",
  },
};

const getRpsWinner = (
  home?: RpsChoice | null,
  away?: RpsChoice | null,
): LiveSide | "tie" | null => {
  if (!home || !away) return null;
  if (home === away) return "tie";
  if (
    (home === "rock" && away === "scissors") ||
    (home === "paper" && away === "rock") ||
    (home === "scissors" && away === "paper")
  )
    return "home";
  return "away";
};

const phaseLabels: Record<LivePhase, string> = {
  check_in: "Director check-in",
  blind_pick: "Select two Round 1 starters",
  player_select: "Choose next player",
  stage_strike: "Stage striking",
  playing: "Round in progress",
  score_verify: "Verify round score",
  complete: "Match complete",
};

const flowStepLabels: Record<LivePhase, string> = {
  check_in: "Check-In",
  blind_pick: "Starters",
  player_select: "Next Player",
  stage_strike: "Stage Striking",
  playing: "Round Score",
  score_verify: "Verify Score",
  complete: "Complete",
};

const getSelectedRoster = (players: LivePlayer[]) =>
  players.filter((player) => player.selected);
const hasSelectedCharacter = (
  player: LivePlayer | undefined,
): player is LivePlayer =>
  Boolean(
    player &&
    player.character !== "Character not selected" &&
    player.characterImage,
  );

function RpsChoiceImage({ choice }: { choice: RpsChoice }) {
  const asset = rpsChoiceAssets[choice];

  return (
    <span
      className={`live-rps-choice-art live-rps-choice-art-${choice}`}
      aria-hidden="true"
    >
      <Image src={asset.src} alt="" width={96} height={96} />
    </span>
  );
}

function FighterAvatar({
  player,
  size,
  priority = false,
  useRender = false,
}: {
  player: LivePlayer | undefined;
  size: number;
  priority?: boolean;
  useRender?: boolean;
}) {
  if (!hasSelectedCharacter(player)) {
    return (
      <RiAccountCircleFill
        className="live-fighter-placeholder"
        size={size}
        aria-hidden="true"
      />
    );
  }

  const renderPath =
    useRender && player.character
      ? getCharacterRenderPath(player.character)
      : null;
  const imageSrc = renderPath ?? player.characterImage;

  return (
    <Image
      src={imageSrc}
      alt={player.character}
      width={size}
      height={size}
      priority={priority}
      className={renderPath ? "live-fighter-render" : undefined}
    />
  );
}

function RoundStockPreview({
  homePlayer,
  awayPlayer,
  homeStocks,
  awayStocks,
  homeSlots,
  awaySlots,
  homeName,
  awayName,
}: {
  homePlayer: LivePlayer | undefined;
  awayPlayer: LivePlayer | undefined;
  homeStocks: number;
  awayStocks: number;
  homeSlots: number;
  awaySlots: number;
  homeName: string;
  awayName: string;
}) {
  const renderStocks = (
    side: LiveSide,
    player: LivePlayer | undefined,
    stocks: number,
    slots: number,
  ) =>
    Array.from({ length: slots }, (_, index) => {
      const isActive = index < stocks;

      return (
        <span
          key={`${side}-${index}`}
          className={`live-round-stock-icon ${isActive ? "is-active" : "is-spent"}`}
          aria-hidden="true"
        >
          <FighterAvatar player={player} size={30} />
        </span>
      );
    });

  return (
    <div
      className="live-round-stock-preview"
      aria-label={`${homeName} ${homeStocks} stocks remaining, ${awayName} ${awayStocks} stocks remaining`}
    >
      <span className="live-round-stock-team">
        {renderStocks("home", homePlayer, homeStocks, homeSlots)}
      </span>
      <span className="live-round-stock-separator" aria-hidden="true">
        -
      </span>
      <span className="live-round-stock-team">
        {renderStocks("away", awayPlayer, awayStocks, awaySlots)}
      </span>
    </div>
  );
}

function RoundStockButton({
  side,
  player,
  teamName,
  stocks,
  slots,
  onChange,
}: {
  side: LiveSide;
  player: LivePlayer | undefined;
  teamName: string;
  stocks: number;
  slots: number;
  onChange: (stocks: number) => void;
}) {
  const maxStocks = Math.max(slots, 0);
  const currentStocks = Math.min(Math.max(stocks, 0), maxStocks);
  const nextStocks = currentStocks > 0 ? currentStocks - 1 : maxStocks;

  const handleCycleStocks = () => {
    onChange(nextStocks);
  };

  return (
    <button
      type="button"
      className="live-score-stock-button"
      onClick={handleCycleStocks}
      aria-label={`${teamName} ended with ${currentStocks} stocks. Click to change to ${nextStocks}.`}
    >
      <span>{teamName}</span>
      <span className="live-round-stock-team" aria-hidden="true">
        {Array.from({ length: maxStocks }, (_, index) => {
          const isActive = index < currentStocks;

          return (
            <span
              key={`${side}-score-${index}`}
              className={`live-round-stock-icon ${
                isActive ? "is-active" : "is-spent"
              }`}
            >
              <FighterAvatar player={player} size={30} />
            </span>
          );
        })}
      </span>
      <small>
        {currentStocks} stock{currentStocks === 1 ? "" : "s"}
      </small>
    </button>
  );
}

function RosterPlayerCard({
  player,
  side,
  isActive,
  onSelect,
  isStandby,
}: {
  player: LivePlayer;
  side: LiveSide;
  isActive?: boolean;
  onSelect: (id: string) => void;
  isStandby?: boolean;
}) {
  const isEliminated = player.stocks === 0;
  const tagSizeClass = player.tag.length >= 8 ? " is-long-tag" : "";

  return (
    <button
      type="button"
      className={`live-roster-card player_row ${side === "home" ? "p1" : "p2"} ${isActive ? "active_player is-active" : ""} ${isEliminated ? "eliminated is-eliminated" : ""}`}
      disabled={isEliminated}
      onClick={() => onSelect(player.id)}
    >
      <span className="player_chars" aria-hidden="true">
        <span
          className={`tsh_character ${isEliminated ? "eliminated_char" : ""}`}
        >
          <span>
            <FighterAvatar player={player} size={160} useRender />
          </span>
        </span>
      </span>
      {!isStandby ? (
        <span className="player_stock_count">
          <span>{player.stocks}</span>
          <span className="stock_label">STK</span>
        </span>
      ) : null}
      <span className={`player_row_name${tagSizeClass}`}>
        <span className="player_tag_text">{player.tag}</span>
      </span>
    </button>
  );
}

const RosterRail = memo(function RosterRail({
  side,
  name,
  logo,
  roster,
  rosterSize,
  activeId,
  onSelect,
}: {
  side: LiveSide;
  name: string;
  logo: string;
  roster: LivePlayer[];
  rosterSize: number;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const starters = getSelectedRoster(roster);
  const availableStarters = starters.filter((player) => player.stocks > 0);
  const eliminatedStarters = starters.filter((player) => player.stocks === 0);
  const activeStarters = activeId
    ? [
        ...availableStarters.filter((player) => player.id === activeId),
        ...availableStarters.filter((player) => player.id !== activeId),
        ...eliminatedStarters,
      ]
    : [...availableStarters, ...eliminatedStarters];
  const standby = roster.filter((player) => !player.selected);
  return (
    <aside className={`live-roster-rail live-roster-${side}`}>
      <header className="live-roster-heading">
        <Image src={logo} alt="" width={50} height={50} />
        <div>
          <span>{side} team</span>
          <strong>{name}</strong>
        </div>
      </header>
      <p className="live-rail-label">
        Sent In{" "}
        <span>
          {starters.length}/{rosterSize}
        </span>
      </p>
      <div className="live-roster-list">
        {activeStarters.map((player) => (
          <RosterPlayerCard
            key={player.id}
            player={player}
            side={side}
            isActive={activeId === player.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      <p className="live-rail-label live-bench-label">
        Standby <span>{standby.length}</span>
      </p>
      <div className="live-roster-list live-bench-list">
        {standby.map((player) => (
          <RosterPlayerCard
            key={player.id}
            player={player}
            side={side}
            isStandby
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
});

const ArenaScoreboard = memo(function ArenaScoreboard({
  home,
  away,
  homeStocks,
  awayStocks,
  homeMatchScore,
  awayMatchScore,
}: {
  home: Pick<LiveMatchState["home"], "shortName" | "logo">;
  away: Pick<LiveMatchState["away"], "shortName" | "logo">;
  homeStocks: number;
  awayStocks: number;
  homeMatchScore: number;
  awayMatchScore: number;
}) {
  return (
    <div
      className="live-scoreboard live-scoreboard-overlay"
      aria-label={`${home.shortName} ${homeStocks}, ${away.shortName} ${awayStocks}`}
    >
      <div className="live-layout-score-team live-layout-score-team-home">
        <div className="live-layout-sponsor-icon">
          <Image src={home.logo} alt="" width={86} height={86} />
        </div>
        <div className="live-layout-score-name">
          <div className="live-layout-score">
            {String(homeStocks).padStart(2, "0")}
          </div>
          <div className="live-layout-sponsor">{home.shortName}</div>
        </div>
      </div>
      <div className="live-layout-series-score live-layout-series-score-home">
        <div className="live-layout-series-value">{homeMatchScore}</div>
      </div>
      <div className="live-layout-score-logo" aria-hidden="true" />
      <div className="live-layout-series-score live-layout-series-score-away">
        <div className="live-layout-series-value">{awayMatchScore}</div>
      </div>
      <div className="live-layout-score-team live-layout-score-team-away">
        <div className="live-layout-sponsor-icon">
          <Image src={away.logo} alt="" width={86} height={86} />
        </div>
        <div className="live-layout-score-name">
          <div className="live-layout-score">
            {String(awayStocks).padStart(2, "0")}
          </div>
          <div className="live-layout-sponsor">{away.shortName}</div>
        </div>
      </div>
    </div>
  );
});

const ChatPanel = memo(function ChatPanel({
  messages,
  canSend,
  onSend,
}: {
  messages: LiveChatMessage[];
  canSend: boolean;
  onSend: (message: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const message = draft.trim();
      if (!message) return;
      setDraft("");
      if (!(await onSend(message))) setDraft(message);
    },
    [draft, onSend],
  );
  return (
    <div className="live-chat-panel">
      <div className="live-chat-heading">
        <RiDiscussFill size={22} />
        <div>
          <strong>Match chat</strong>
        </div>
      </div>
      <div className="live-chat-feed">
        {messages.map((message) =>
          message.role === "system" ? (
            <p className="live-system-message" key={message.id}>
              {message.message}
            </p>
          ) : (
            <article
              className={`live-chat-message live-chat-${message.side}`}
              key={message.id}
            >
              <span>{message.author.slice(0, 1)}</span>
              <div>
                <header>
                  <strong>{message.author}</strong>
                  <small>
                    {message.role} ·{" "}
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </small>
                </header>
                <p>{message.message}</p>
              </div>
            </article>
          ),
        )}
      </div>
      <form className="live-chat-form" onSubmit={onSubmit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            canSend
              ? "Message everyone in this match..."
              : "Sign in to send match chat messages"
          }
          aria-label="Chat message"
          disabled={!canSend}
          maxLength={500}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!draft.trim() || !canSend}
        >
          <RiSendPlaneFill size={20} />
        </button>
      </form>
    </div>
  );
});

/** Owns the room's initial load, mutations, and lossless realtime subscriptions. */
export function useLiveMatchRoomState(slug: string) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [match, setMatch] = useState<LiveMatchState | null>(null);
  const [mySide, setMySide] = useState<LiveSide>("home");
  const [directorSide, setDirectorSide] = useState<LiveSide | null>(null);
  const [canResetMatch, setCanResetMatch] = useState(false);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [areMyBlindPicksLocked, setAreMyBlindPicksLocked] = useState(false);
  const [directorUserId, setDirectorUserId] = useState<string | null>(null);
  const [chatAuthor, setChatAuthor] = useState("Director");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(Boolean(supabase));
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isAdvancingPhase, setIsAdvancingPhase] = useState(false);
  const [isResettingMatch, setIsResettingMatch] = useState(false);
  const [activeHomeId, setActiveHomeId] = useState<string | null>(null);
  const [activeAwayId, setActiveAwayId] = useState<string | null>(null);
  const activeHomeIdRef = useRef<string | null>(null);
  const activeAwayIdRef = useRef<string | null>(null);
  const [stageActions, setStageActions] = useState<StageAction[]>([]);
  const [pendingStages, setPendingStages] = useState<string[]>([]);
  const [expiredRpsRevealKey, setExpiredRpsRevealKey] = useState<string | null>(
    null,
  );
  const [pendingRpsChoice, setPendingRpsChoice] =
    useState<RpsChoice | null>(null);
  const [pendingRpsTieCount, setPendingRpsTieCount] =
    useState<number | null>(null);
  const [pendingRpsGameId, setPendingRpsGameId] = useState<string | null>(null);
  const defaultRules = getLiveGameRules("ultimate");
  const [score, setScore] = useState({
    home: defaultRules.stocksPerPlayer,
    away: defaultRules.stocksPerPlayer,
  });
  const livePhaseRef = useRef<LivePhase | null>(null);
  const matchRef = useRef<LiveMatchState | null>(null);
  const [hasEarlierMessages, setHasEarlierMessages] = useState(false);
  const [isLoadingEarlierMessages, setIsLoadingEarlierMessages] =
    useState(false);
  const [notice, setNotice] = useState(
    supabase ? "" : "Live match services are not configured.",
  );
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const stageActionInFlightRef = useRef(false);
  const confirmedHomeId = match?.homeActivePlayerId ?? null;
  const confirmedAwayId = match?.awayActivePlayerId ?? null;
  const rpsHomeChoice = match?.rpsHomeChoice ?? null;
  const rpsAwayChoice = match?.rpsAwayChoice ?? null;
  const rpsWinnerSide: LiveSide | null =
    match?.rpsWinnerTeamId === homeTeamId
      ? "home"
      : match?.rpsWinnerTeamId === awayTeamId
        ? "away"
        : null;
  const setConfirmedHomeId = (value: string | null) =>
    setMatch((current) =>
      current && current.homeActivePlayerId !== value
        ? { ...current, homeActivePlayerId: value }
        : current,
    );
  const setConfirmedAwayId = (value: string | null) =>
    setMatch((current) =>
      current && current.awayActivePlayerId !== value
        ? { ...current, awayActivePlayerId: value }
        : current,
    );
  const setRpsHomeChoice = (value: RpsChoice | null) =>
    setMatch((current) =>
      current && current.rpsHomeChoice !== value
        ? { ...current, rpsHomeChoice: value }
        : current,
    );
  const setRpsAwayChoice = (value: RpsChoice | null) =>
    setMatch((current) =>
      current && current.rpsAwayChoice !== value
        ? { ...current, rpsAwayChoice: value }
        : current,
    );
  const setRpsWinnerSide = (value: LiveSide | null) =>
    setMatch((current) => {
      if (!current) return current;
      const teamId =
        value === "home" ? homeTeamId : value === "away" ? awayTeamId : null;
      return current.rpsWinnerTeamId === teamId
        ? current
        : { ...current, rpsWinnerTeamId: teamId };
    });

  useEffect(() => {
    livePhaseRef.current = match?.phase ?? null;
    matchRef.current = match;
  }, [match]);

  const setPhase = (phase: LivePhase) =>
    setMatch((current) => (current ? { ...current, phase } : current));

  const mapChatRows = useCallback(
    (
      rows: ChatRow[],
      fixtureHomeTeamId = homeTeamId,
      fixtureAwayTeamId = awayTeamId,
    ): LiveChatMessage[] =>
      rows.map((row) => ({
        id: row.id,
        author: row.users?.tag ?? "Director",
        role: row.users?.role === "player" ? "player" : "director",
        side:
          row.team_id === fixtureHomeTeamId
            ? "home"
            : row.team_id === fixtureAwayTeamId
              ? "away"
              : null,
        message: row.message,
        createdAt: row.created_at,
        displayTimestamp: formatChatTimestamp(row.created_at),
      })),
    [awayTeamId, homeTeamId],
  );

  const loadChatMessages = useCallback(
    async (
      fixtureId: string,
      fixtureHomeTeamId = homeTeamId,
      fixtureAwayTeamId = awayTeamId,
    ) => {
      if (!supabase) return;

      const { data, error } = await supabase
        .from("live_match_messages" as never)
        .select("id,user_id,team_id,message,created_at,users(tag,role)")
        .eq("match_id", fixtureId)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE + 1);

      if (error) {
        setNotice(error.message);
        return;
      }

      const rows = (data as ChatRow[] | null) ?? [];
      setHasEarlierMessages(rows.length > CHAT_PAGE_SIZE);
      const recoveredMessages = mapChatRows(
        rows.slice(0, CHAT_PAGE_SIZE).reverse(),
        fixtureHomeTeamId,
        fixtureAwayTeamId,
      );

      setMatch((current) => {
        if (!current) return current;

        const recoveredIds = new Set(recoveredMessages.map(({ id }) => id));
        const retainedMessages = current.messages.filter(
          (message) =>
            message.id.startsWith("local-") || !recoveredIds.has(message.id),
        );
        const nextMessages = [...retainedMessages, ...recoveredMessages].sort(
          (first, second) => first.createdAt.localeCompare(second.createdAt),
        );

        return areChatMessageListsEqual(current.messages, nextMessages)
          ? current
          : { ...current, messages: nextMessages };
      });
    },
    [awayTeamId, homeTeamId, mapChatRows, supabase],
  );

  const liveRoomService = useMemo(
    () => (supabase ? new LiveRoomService(supabase) : null),
    [supabase],
  );

  const snapshotInFlightRef = useRef(false);
  const recoveryRequestCountRef = useRef(0);
  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<LiveRoomService["getLiveMatchRoomSnapshot"]>>) => {
    const previousMatch = matchRef.current;
    const mapped = mapLiveRoomSnapshot(snapshot, previousMatch);
    if (isScoreDisputeTransition(previousMatch, mapped.match)) {
      setNotice(SCORE_DISPUTED_NOTICE);
    }
    const isSamePlayerDraft = Boolean(
      previousMatch &&
      previousMatch.phase === "player_select" &&
      mapped.match.phase === "player_select" &&
      previousMatch.gameId === mapped.match.gameId &&
      previousMatch.roundNumber === mapped.match.roundNumber
    );
    setMatch(mapped.match);
    matchRef.current = mapped.match;
    setStageActions(mapped.stageActions);
    setMatchId(snapshot.fixture.id);
    setHomeTeamId(snapshot.fixture.home_team_id);
    setAwayTeamId(snapshot.fixture.away_team_id);
    setDirectorUserId(snapshot.viewer.user_id);
    setChatAuthor(snapshot.viewer.tag ?? "Director");
    setDirectorSide(snapshot.viewer.authorized_side);
    setCanResetMatch(snapshot.viewer.role === "mod");
    setViewerRole(snapshot.viewer.role);
    const viewerTeamId = snapshot.viewer.authorized_side === "home"
      ? snapshot.fixture.home_team_id
      : snapshot.viewer.authorized_side === "away"
        ? snapshot.fixture.away_team_id
        : null;
    setAreMyBlindPicksLocked(
      Boolean(viewerTeamId && snapshot.blind_picks.filter((pick) => pick.team_id === viewerTeamId).length === 2),
    );
    if (snapshot.viewer.authorized_side) setMySide(snapshot.viewer.authorized_side);
    setHasEarlierMessages(snapshot.has_earlier_messages);
    const nextHomeActiveId = reconcileActivePlayerDraft({
      serverPlayerId: mapped.match.homeActivePlayerId,
      localPlayerId: activeHomeIdRef.current,
      viewerSide: snapshot.viewer.authorized_side,
      playerSide: "home",
      previousPhase: previousMatch?.phase ?? null,
      nextPhase: mapped.match.phase,
      sameGameAndRound: isSamePlayerDraft,
    });
    const nextAwayActiveId = reconcileActivePlayerDraft({
      serverPlayerId: mapped.match.awayActivePlayerId,
      localPlayerId: activeAwayIdRef.current,
      viewerSide: snapshot.viewer.authorized_side,
      playerSide: "away",
      previousPhase: previousMatch?.phase ?? null,
      nextPhase: mapped.match.phase,
      sameGameAndRound: isSamePlayerDraft,
    });
    setActiveHomeId(nextHomeActiveId);
    setActiveAwayId(nextAwayActiveId);
    activeHomeIdRef.current = nextHomeActiveId;
    activeAwayIdRef.current = nextAwayActiveId;
    setScore({
      home: mapped.match.pendingHomeScore ?? mapped.match.homeRoundStartStocks,
      away: mapped.match.pendingAwayScore ?? mapped.match.awayRoundStartStocks,
    });
  }, []);

  const recoverSnapshot = useCallback(async (reason: "subscribe" | "reconnect" | "poll") => {
    if (!liveRoomService || snapshotInFlightRef.current) return;
    snapshotInFlightRef.current = true;
    const started = performance.now();
    recoveryRequestCountRef.current += 1;
    try {
      const snapshot = await liveRoomService.getLiveMatchRoomSnapshot(slug);
      applySnapshot(snapshot);
      if (process.env.NODE_ENV === "development") {
        console.debug("live-room recovery", {
          reason,
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          requestCount: recoveryRequestCountRef.current,
        });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to recover live room state.");
    } finally {
      snapshotInFlightRef.current = false;
    }
  }, [applySnapshot, liveRoomService, slug]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!liveRoomService) return;
    let mounted = true;
    performance.mark("live-room-load-start");
    void liveRoomService.getLiveMatchRoomSnapshot(slug).then((snapshot) => {
      if (!mounted) return;
      performance.mark("live-room-snapshot-received");
      performance.measure("live-room-snapshot-request", "live-room-load-start", "live-room-snapshot-received");
      applySnapshot(snapshot);
      setIsLoadingRoom(false);
      requestAnimationFrame(() => {
        performance.mark("live-room-render-ready");
        performance.measure("live-room-time-to-ready", "live-room-load-start", "live-room-render-ready");
        if (process.env.NODE_ENV === "development") {
          console.debug("live-room performance", performance.getEntriesByType("measure").filter(({ name }) => name.startsWith("live-room-")));
        }
      });
    }).catch((error: unknown) => {
      if (!mounted) return;
      setNotice(error instanceof Error ? error.message : "This match could not be found.");
      setIsLoadingRoom(false);
    });
    return () => { mounted = false; };
  }, [applySnapshot, liveRoomService, slug]);

  useEffect(() => {
    if (match?.status !== "completed" && match?.phase !== "complete") return;

    const timer = window.setTimeout(() => {
      router.replace(`/matches/${match.slug}`);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [match?.phase, match?.slug, match?.status, router]);

  useEffect(() => {
    const result = getRpsWinner(rpsHomeChoice, rpsAwayChoice);

    if (!rpsHomeChoice || !rpsAwayChoice || !result) return;

    const revealKey = `${rpsHomeChoice}:${rpsAwayChoice}:${result}`;
    const timer = window.setTimeout(() => {
      setExpiredRpsRevealKey(revealKey);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [rpsAwayChoice, rpsHomeChoice]);

  const handleCheckInChange = useCallback(
    (payload: RealtimePayload<{ team_id: string }>) => {
      const teamId = (
        payload.eventType === "DELETE" ? payload.old : payload.new
      ).team_id;
      if (!teamId) return;
      const checkedIn = payload.eventType !== "DELETE";
      setMatch((current) => {
        if (!current) return current;
        if (teamId === homeTeamId && current.homeCheckedIn !== checkedIn)
          return { ...current, homeCheckedIn: checkedIn };
        if (teamId === awayTeamId && current.awayCheckedIn !== checkedIn)
          return { ...current, awayCheckedIn: checkedIn };
        return current;
      });
    },
    [awayTeamId, homeTeamId],
  );

  const handleFixtureChange = useCallback(
    (
      payload: RealtimePayload<{
        status: LiveMatchState["status"];
        home_score: number | null;
        away_score: number | null;
      }>,
    ) => {
      if (payload.eventType === "DELETE") return;
      setMatch((current) => {
        if (!current) return current;
        const status = payload.new.status ?? current.status;
        const homeMatchScore = payload.new.home_score ?? current.homeMatchScore;
        const awayMatchScore = payload.new.away_score ?? current.awayMatchScore;
        return status === current.status &&
          homeMatchScore === current.homeMatchScore &&
          awayMatchScore === current.awayMatchScore
          ? current
          : { ...current, status, homeMatchScore, awayMatchScore };
      });
    },
    [],
  );

  const handleRosterSelectionChange = useCallback(
    (
      payload: RealtimePayload<{
        team_id: string;
        player_id: string;
        stocks_remaining: number | null;
        selected_character: string | null;
        selected_character_image: string | null;
      }>,
    ) => {
      const row = payload.eventType === "DELETE" ? payload.old : payload.new;
      if (!row.player_id || !row.team_id) return;
      setMatch((current) => {
        if (!current) return current;
        const side =
          row.team_id === homeTeamId
            ? "home"
            : row.team_id === awayTeamId
              ? "away"
              : null;
        if (!side) return current;
        const roster = current[side].roster.map((player) => {
          if (player.id !== row.player_id) return player;
          if (payload.eventType === "DELETE")
            return player.selected ? { ...player, selected: false } : player;
          const character = row.selected_character ?? player.character;
          return {
            ...player,
            selected: true,
            stocks: row.stocks_remaining ?? player.stocks,
            character,
            characterImage: resolveCharacterImagePath(
              current.game,
              character,
              row.selected_character_image,
            ),
          };
        });
        return roster.every(
          (player, index) => player === current[side].roster[index],
        )
          ? current
          : { ...current, [side]: { ...current[side], roster } };
      });
    },
    [awayTeamId, homeTeamId],
  );

  const handleStageActionChange = useCallback(
    (
      payload: RealtimePayload<{
        team_id: string;
        stage: string;
        action: "strike" | "ban" | "pick";
        round_number: number;
        game_id: string | null;
      }>,
    ) => {
      const row = payload.eventType === "DELETE" ? payload.old : payload.new;
      if (
        !row.team_id ||
        !row.stage ||
        (row.round_number && row.round_number !== matchRef.current?.roundNumber) ||
        (row.game_id &&
          matchRef.current?.gameId &&
          row.game_id !== matchRef.current.gameId)
      )
        return;
      const action: StageAction = {
        teamId: row.team_id,
        stage: row.stage,
        action: row.action === "pick" ? "pick" : "strike",
        gameId: row.game_id ?? null,
      };
      setStageActions((current) => {
        const same = (candidate: StageAction) =>
          candidate.teamId === action.teamId &&
          candidate.stage === action.stage &&
          candidate.action === action.action &&
          candidate.gameId === action.gameId;
        if (payload.eventType === "DELETE")
          return current.some(same)
            ? current.filter((candidate) => !same(candidate))
            : current;
        return current.some(same) ? current : [...current, action];
      });
      if (action.action === "pick" && payload.eventType !== "DELETE")
        setMatch((current) =>
          current &&
          (current.stage !== action.stage || current.phase !== "playing")
            ? { ...current, stage: action.stage, phase: "playing" }
            : current,
        );
    },
    [],
  );

  const handleLiveStateChange = useCallback(
    (
      payload: RealtimePayload<{
        phase: LivePhase;
        game_id: string | null;
        revision: number;
        round_number: number;
        selected_stage: string | null;
        home_active_player_id: string | null;
        away_active_player_id: string | null;
        home_stocks: number;
        away_stocks: number;
        home_round_start_stocks: number;
        away_round_start_stocks: number;
        rps_home_choice: RpsChoice | null;
        rps_away_choice: RpsChoice | null;
        rps_winner_team_id: string | null;
        rps_tie_count: number;
        previous_round_loser_team_id: string | null;
        score_submitted_by_team_id: string | null;
        score_verified_by_team_id: string | null;
        pending_home_score: number | null;
        pending_away_score: number | null;
      }>,
    ) => {
      if (payload.eventType === "DELETE") return;
      const row = payload.new;
      const currentSnapshot = matchRef.current;
      // Recovery can finish before an older queued realtime event is delivered.
      // Never roll the revision back or the next action will conflict needlessly.
      if (
        currentSnapshot &&
        row.revision !== undefined &&
        row.revision < currentSnapshot.revision
      )
        return;
      const nextPhase = row.phase ?? currentSnapshot?.phase;
      const nextScoreSubmittedByTeamId =
        "score_submitted_by_team_id" in row
          ? (row.score_submitted_by_team_id ?? null)
          : (currentSnapshot?.scoreSubmittedByTeamId ?? null);
      if (
        currentSnapshot &&
        nextPhase &&
        isScoreDisputeTransition(currentSnapshot, {
          phase: nextPhase,
          scoreSubmittedByTeamId: nextScoreSubmittedByTeamId,
        })
      ) {
        setNotice(SCORE_DISPUTED_NOTICE);
      }
      const isRoundTransition = Boolean(
        row.round_number &&
          currentSnapshot &&
          row.round_number !== currentSnapshot.roundNumber,
      );
      const isGameTransition = Boolean(
        currentSnapshot &&
          "game_id" in row &&
          row.game_id &&
          row.game_id !== currentSnapshot.gameId,
      );

      // Stage actions belong to one round. Clear the previous round's local
      // actions immediately when realtime advances the state; otherwise a
      // client can keep a completed pick and derive the waiting state until a
      // full-page refresh reloads the correctly filtered action list.
      if (isRoundTransition || isGameTransition) {
        setStageActions([]);
        setPendingStages([]);
        setExpiredRpsRevealKey(null);
      }

      setMatch((current) => {
        if (!current) return current;
        if (
          row.revision !== undefined &&
          row.revision < current.revision
        )
          return current;
        const phase = row.phase ?? current.phase;
        const next = {
          ...current,
          phase,
          revision: row.revision ?? current.revision,
          gameId: row.game_id ?? current.gameId,
          roundNumber: row.round_number ?? current.roundNumber,
          stage:
            "selected_stage" in row
              ? (row.selected_stage ?? null)
              : isRoundTransition
                ? null
                : current.stage,
          homeStocks: row.home_stocks ?? current.homeStocks,
          awayStocks: row.away_stocks ?? current.awayStocks,
          homeRoundStartStocks:
            row.home_round_start_stocks ?? current.homeRoundStartStocks,
          awayRoundStartStocks:
            row.away_round_start_stocks ?? current.awayRoundStartStocks,
          previousRoundLoserTeamId:
            "previous_round_loser_team_id" in row
              ? (row.previous_round_loser_team_id ?? null)
              : current.previousRoundLoserTeamId,
          homeActivePlayerId:
            "home_active_player_id" in row
              ? (row.home_active_player_id ?? null)
              : current.homeActivePlayerId,
          awayActivePlayerId:
            "away_active_player_id" in row
              ? (row.away_active_player_id ?? null)
              : current.awayActivePlayerId,
          pendingHomeScore:
            "pending_home_score" in row
              ? (row.pending_home_score ?? null)
              : current.pendingHomeScore,
          pendingAwayScore:
            "pending_away_score" in row
              ? (row.pending_away_score ?? null)
              : current.pendingAwayScore,
          scoreSubmittedByTeamId:
            "score_submitted_by_team_id" in row
              ? (row.score_submitted_by_team_id ?? null)
              : current.scoreSubmittedByTeamId,
          scoreVerifiedByTeamId:
            "score_verified_by_team_id" in row
              ? (row.score_verified_by_team_id ?? null)
              : current.scoreVerifiedByTeamId,
          rpsHomeChoice:
            "rps_home_choice" in row
              ? (row.rps_home_choice ?? null)
              : current.rpsHomeChoice,
          rpsAwayChoice:
            "rps_away_choice" in row
              ? (row.rps_away_choice ?? null)
              : current.rpsAwayChoice,
          rpsWinnerTeamId:
            "rps_winner_team_id" in row
              ? (row.rps_winner_team_id ?? null)
              : current.rpsWinnerTeamId,
          rpsTieCount:
            "rps_tie_count" in row
              ? Math.max(0, row.rps_tie_count ?? 0)
              : current.rpsTieCount,
        };
        // Keep action requests current without waiting for React's next render.
        matchRef.current = next;
        return next;
      });

      if (row.phase === "score_verify") {
        setScore({
          home:
            row.pending_home_score ??
            row.home_round_start_stocks ??
            defaultRules.stocksPerPlayer,
          away:
            row.pending_away_score ??
            row.away_round_start_stocks ??
            defaultRules.stocksPerPlayer,
        });
      }
      if ("home_active_player_id" in row) {
        const nextHomeActiveId = reconcileActivePlayerDraft({
          serverPlayerId: row.home_active_player_id ?? null,
          localPlayerId: activeHomeIdRef.current,
          viewerSide: directorSide,
          playerSide: "home",
          previousPhase: currentSnapshot?.phase ?? null,
          nextPhase: row.phase ?? currentSnapshot?.phase ?? null,
          sameGameAndRound: Boolean(
            currentSnapshot && !isGameTransition && !isRoundTransition,
          ),
        });
        activeHomeIdRef.current = nextHomeActiveId;
        setActiveHomeId(nextHomeActiveId);
      }
      if ("away_active_player_id" in row) {
        const nextAwayActiveId = reconcileActivePlayerDraft({
          serverPlayerId: row.away_active_player_id ?? null,
          localPlayerId: activeAwayIdRef.current,
          viewerSide: directorSide,
          playerSide: "away",
          previousPhase: currentSnapshot?.phase ?? null,
          nextPhase: row.phase ?? currentSnapshot?.phase ?? null,
          sameGameAndRound: Boolean(
            currentSnapshot && !isGameTransition && !isRoundTransition,
          ),
        });
        activeAwayIdRef.current = nextAwayActiveId;
        setActiveAwayId(nextAwayActiveId);
      }
    },
    [awayTeamId, defaultRules.stocksPerPlayer, directorSide, homeTeamId],
  );

  useEffect(() => {
    if (!supabase || !matchId || !homeTeamId || !awayTeamId) return;

    const fallbackPollIntervalMs = 15_000;
    let isRealtimeSubscribed = false;
    let isDisposed = false;
    let fallbackPollTimer: number | null = null;

    const stopFallbackPolling = () => {
      if (fallbackPollTimer === null) return;
      window.clearInterval(fallbackPollTimer);
      fallbackPollTimer = null;
    };

    const startFallbackPolling = () => {
      if (
        isDisposed ||
        isRealtimeSubscribed ||
        document.hidden ||
        fallbackPollTimer !== null
      )
        return;

      fallbackPollTimer = window.setInterval(() => {
        void recoverSnapshot("poll");
      }, fallbackPollIntervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopFallbackPolling();
      } else if (!isRealtimeSubscribed) {
        startFallbackPolling();
      }
    };

    const refreshLiveRoomState = () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        void recoverSnapshot(isRealtimeSubscribed ? "reconnect" : "subscribe");
      }, 150);
    };

    const channel = supabase
      .channel(`live-match-room:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_match_states",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          handleLiveStateChange(payload as never);
          const phase = (payload.new as { phase?: LivePhase }).phase;
          // The stage-strike transition is the confidential double-blind
          // reveal. Recover the canonical snapshot so both confirmed active
          // players and their roster selections appear together without a
          // manual page refresh, even if roster-selection realtime events are
          // delivered out of order.
          if (
            phase === "blind_pick" ||
            phase === "player_select" ||
            phase === "stage_strike"
          ) {
            refreshLiveRoomState();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_match_roster_selections",
          filter: `match_id=eq.${matchId}`,
        },
        handleRosterSelectionChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_match_stage_actions",
          filter: `match_id=eq.${matchId}`,
        },
        handleStageActionChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_director_check_ins",
          filter: `match_id=eq.${matchId}`,
        },
        handleCheckInChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        handleFixtureChange,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_match_messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as ChatRow;
          const [insertedMessage] = mapChatRows(
            [
              {
                ...row,
                users:
                  row.user_id === directorUserId
                    ? { tag: chatAuthor, role: "director" }
                    : row.users,
              },
            ],
            homeTeamId,
            awayTeamId,
          );

          setMatch((current) => {
            if (!current) return current;
            const existingIndex = current.messages.findIndex(
              ({ id }) => id === insertedMessage.id,
            );
            if (
              existingIndex >= 0 &&
              areChatMessagesEqual(
                current.messages[existingIndex],
                insertedMessage,
              )
            ) {
              return current;
            }

            const nextMessages = [...current.messages];
            if (existingIndex >= 0) {
              nextMessages[existingIndex] = insertedMessage;
            } else {
              nextMessages.push(insertedMessage);
              nextMessages.sort((first, second) =>
                first.createdAt.localeCompare(second.createdAt),
              );
            }
            return { ...current, messages: nextMessages };
          });
        },
      )
      .subscribe((status) => {
        isRealtimeSubscribed = status === "SUBSCRIBED";

        if (status === "SUBSCRIBED") {
          stopFallbackPolling();
          performance.mark("live-room-realtime-subscribed");
          try {
            performance.measure("live-room-time-to-realtime", "live-room-load-start", "live-room-realtime-subscribed");
          } catch {
            // The load mark may have been cleared by developer tooling.
          }
          refreshLiveRoomState();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          startFallbackPolling();
        }
      });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopFallbackPolling();
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [
    awayTeamId,
    chatAuthor,
    directorUserId,
    homeTeamId,
    handleCheckInChange,
    handleFixtureChange,
    handleLiveStateChange,
    handleRosterSelectionChange,
    handleStageActionChange,
    loadChatMessages,
    mapChatRows,
    matchId,
    recoverSnapshot,
    supabase,
  ]);

  const checkInDirector = async () => {
    if (!supabase || !matchId || !directorUserId || !directorSide) return;
    const teamId = directorSide === "home" ? homeTeamId : awayTeamId;
    if (!teamId) return;

    setIsCheckingIn(true);
    setNotice("");
    const { error } = await supabase
      .from("match_director_check_ins" as never)
      .upsert(
        {
          match_id: matchId,
          team_id: teamId,
          director_user_id: directorUserId,
          checked_in_at: new Date().toISOString(),
        } as never,
        { onConflict: "match_id,team_id" },
      );

    if (error) {
      setNotice(error.message);
    } else {
      await recoverSnapshot("poll");
    }
    setIsCheckingIn(false);
  };


  const runRoomServiceAction = useCallback(
    async <Name extends LiveRoomRpcName>(
      name: Name,
      args: Omit<
        LiveRoomRpcArguments[Name],
        "target_match_id" | "expected_revision"
      >,
    ) => {
      if (!liveRoomService || !matchId || !matchRef.current) return null;
      const { data, error } = await runRevisionedAction({
        revision: matchRef.current.revision,
        execute: (expectedRevision) =>
          liveRoomService.execute(name, {
            target_match_id: matchId,
            expected_revision: expectedRevision,
            ...args,
          } as never),
        applyState: (state) =>
          handleLiveStateChange({ eventType: "UPDATE", new: state } as never),
      });
      if (error) {
        setNotice(getLiveActionErrorNotice(error.message) ?? "");
        return null;
      }
      if (!data) return null;
      return data;
    },
    [handleLiveStateChange, liveRoomService, matchId],
  );

  const runLiveAction = useCallback(
    async (
      name: string,
      args: Record<string, unknown>,
      options: {
        retryConflicts?:
          | boolean
          | ((state: LiveMatchStateRow) => boolean);
        applySuccessfulState?: boolean;
        revision?: number;
        shouldRetryConflict?: (state: LiveMatchStateRow) => boolean;
      } = {},
    ) => {
      if (!supabase || !matchId || !matchRef.current) return null;
      const { data, error } = await runRevisionedAction({
        revision: options.revision ?? matchRef.current.revision,
        execute: async (expectedRevision) => {
          const response = await supabase.rpc(
            name as never,
            {
              target_match_id: matchId,
              expected_revision: expectedRevision,
              ...args,
            } as never,
          );
          return {
            data: response.data as {
              conflict: boolean;
              state: LiveMatchStateRow;
            } | null,
            error: response.error
              ? new Error(
                  [
                    response.error.message,
                    response.error.details,
                    response.error.hint,
                    response.error.code,
                  ]
                    .filter(Boolean)
                    .join(" | "),
                )
              : null,
          };
        },
        applyState: (state) =>
          handleLiveStateChange({ eventType: "UPDATE", new: state } as never),
        retryConflicts: options.retryConflicts,
        applySuccessfulState: options.applySuccessfulState,
        shouldRetryConflict: options.shouldRetryConflict,
      });
      if (error) {
        console.error(`[live-room] ${name} failed`, error.message);
        setNotice(getLiveActionErrorNotice(error.message) ?? "");
        await recoverSnapshot("poll");
        return null;
      }
      const result = data;
      if (!result) return null;
      return result;
    },
    [handleLiveStateChange, matchId, recoverSnapshot, supabase],
  );

  const resetMatchFromScratch = async () => {
    if (!match || !supabase || !matchId || !canResetMatch) return;

    const confirmed = window.confirm(
      "Reset this match from scratch? This clears check-ins, standby selections, stage choices, scores, and live-room progress for both teams.",
    );

    if (!confirmed) return;

    setIsResettingMatch(true);
    setNotice("");

    const { error } = await supabase.rpc(
      "reset_live_match" as never,
      {
        target_match_id: matchId,
      } as never,
    );

    if (error) {
      setNotice(error.message);
      setIsResettingMatch(false);
      return;
    }

    const resetHomeRules = getLiveGameRules(match.game, match.homeRosterSize);
    const resetAwayRules = getLiveGameRules(match.game, match.awayRosterSize);

    activeHomeIdRef.current = null;
    activeAwayIdRef.current = null;
    setActiveHomeId(null);
    setActiveAwayId(null);
    setConfirmedHomeId(null);
    setConfirmedAwayId(null);
    setStageActions([]);
    setPendingStages([]);
    setRpsHomeChoice(null);
    setRpsAwayChoice(null);
    setRpsWinnerSide(null);
    setScore({
      home: resetHomeRules.stocksPerPlayer,
      away: resetAwayRules.stocksPerPlayer,
    });

    setMatch((current) =>
      current
        ? {
            ...current,
            status: "upcoming",
            phase: "check_in",
            roundNumber: 1,
            gameNumber: 1,
            stage: null,
            homeStocks: resetHomeRules.totalStocks,
            awayStocks: resetAwayRules.totalStocks,
            pendingHomeScore: null,
            pendingAwayScore: null,
            homeRoundStartStocks: resetHomeRules.stocksPerPlayer,
            awayRoundStartStocks: resetAwayRules.stocksPerPlayer,
            previousRoundLoserTeamId: null,
            scoreSubmittedByTeamId: null,
            scoreVerifiedByTeamId: null,
            homeMatchScore: 0,
            awayMatchScore: 0,
            homeCheckedIn: false,
            awayCheckedIn: false,
            messages: [],
            home: {
              ...current.home,
              roster: current.home.roster.map((player) => ({
                ...player,
                character: "Character not selected",
                characterImage: "",
                stocks: resetHomeRules.stocksPerPlayer,
                selected: false,
              })),
            },
            away: {
              ...current.away,
              roster: current.away.roster.map((player) => ({
                ...player,
                character: "Character not selected",
                characterImage: "",
                stocks: resetAwayRules.stocksPerPlayer,
                selected: false,
              })),
            },
          }
        : current,
    );
    setNotice("Match reset. Both teams can test the full flow from check-in.");
    setIsResettingMatch(false);
  };

  const resetPlayerSelection = async () => {
    if (!match || !matchId || !directorSide || directorSide !== mySide) return;

    setIsAdvancingPhase(true);
    setNotice("");
    const result = await runRoomServiceAction("live_reset_player_selection", {
      target_side: mySide,
    });

    if (result) {
      const activePlayerId = mySide === "home" ? activeHomeId : activeAwayId;
      setMatch((current) =>
        current
          ? {
              ...current,
              [mySide]: {
                ...current[mySide],
                roster: current[mySide].roster.map((player) =>
                  player.id === activePlayerId
                    ? { ...player, selected: false }
                    : player,
                ),
              },
            }
          : current,
      );

      if (mySide === "home") {
        activeHomeIdRef.current = null;
        setActiveHomeId(null);
        setConfirmedHomeId(null);
      } else {
        activeAwayIdRef.current = null;
        setActiveAwayId(null);
        setConfirmedAwayId(null);
      }
      setPhase("player_select");
      setStageActions([]);
      setPendingStages([]);
      setRpsHomeChoice(null);
      setRpsAwayChoice(null);
      setRpsWinnerSide(null);
      setNotice(
        "Player selection reset. Choose your player and character again.",
      );
      if (homeTeamId && awayTeamId)
        await recoverSnapshot("poll");
    }
    setIsAdvancingPhase(false);
  };

  const resetStageActions = async () => {
    if (!match || !matchId || !directorSide) return;

    setIsAdvancingPhase(true);
    setNotice("");
    const result = await runRoomServiceAction("live_reset_stage", {
      target_side: directorSide,
    });

    if (result) {
      setMatch((current) =>
        current ? { ...current, phase: "stage_strike", stage: null } : current,
      );
      setStageActions([]);
      setPendingStages([]);
      setNotice("Round stage striking reset. Select and confirm stages again.");
      if (homeTeamId && awayTeamId)
        await recoverSnapshot("poll");
    }
    setIsAdvancingPhase(false);
  };

  const updatePlayerCharacter = async (
    side: LiveSide,
    playerId: string,
    character: string,
  ) => {
    if (!match || !matchId || side !== directorSide) return;

    const characterImage = getCharacterIconPath(match.game, character);

    // Write the controlled draft to the recovery ref before scheduling React.
    // This closes the race where an opponent update arrives between the input
    // event and React committing the local character render.
    const currentDraft = matchRef.current;
    if (currentDraft) {
      const team = currentDraft[side];
      const next: LiveMatchState = {
        ...currentDraft,
        [side]: {
          ...team,
          roster: team.roster.map((player) =>
            player.id === playerId
              ? {
                  ...player,
                  character,
                  characterImage,
                }
              : player,
          ),
        },
      };
      // Snapshot recovery reads matchRef synchronously. Keep it in lockstep
      // with the controlled character choice instead of waiting for an effect.
      matchRef.current = next;
      setMatch(next);
    }

    // The first-send character travels with the final confirmation. Persisting
    // it earlier would identify which of the two revealed candidates was
    // chosen before both teams finish the double blind.
    if (match.roundNumber === 1) return;

    await runRoomServiceAction("live_update_character", {
      target_side: side,
      player_id: playerId,
      selected_character: character,
      selected_character_image: characterImage,
    });
  };

  const handleRailSelect = (side: LiveSide, id: string) => {
    if (!match) return;
    const player = match[side].roster.find((candidate) => candidate.id === id);
    if (match.phase === "blind_pick" && side === mySide && player) {
      const currentDraft = matchRef.current;
      if (currentDraft) {
        const selectedIds = currentDraft[side].roster
          .filter((candidate) => candidate.blindPick)
          .sort(
            (first, second) =>
              (first.blindPickOrder ?? Number.MAX_SAFE_INTEGER) -
                (second.blindPickOrder ?? Number.MAX_SAFE_INTEGER) ||
              first.id.localeCompare(second.id),
          )
          .map((candidate) => candidate.id);
        const nextSelectedIds = cycleCappedSelection(selectedIds, id, 2);
        const next: LiveMatchState = {
          ...currentDraft,
          [side]: {
            ...currentDraft[side],
            roster: currentDraft[side].roster.map((candidate) => {
              const pickIndex = nextSelectedIds.indexOf(candidate.id);
              return {
                ...candidate,
                blindPick: pickIndex !== -1,
                blindPickOrder: pickIndex === -1 ? undefined : pickIndex + 1,
              };
            }),
          },
        };
        matchRef.current = next;
        setMatch(next);
      }
      return;
    }
    if (
      side !== mySide ||
      !player ||
      (player.selected && match.roundNumber > 1 &&
        player.id !== (side === "home" ? activeHomeId : activeAwayId)) ||
      (match.roundNumber === 1 && !player.blindPick) ||
      player.stocks === 0
    )
      return;
    if (side === "home") {
      activeHomeIdRef.current = id;
      setActiveHomeId(id);
    } else {
      activeAwayIdRef.current = id;
      setActiveAwayId(id);
    }
  };

  const submitBlindPicks = async () => {
    if (!match || !directorSide || directorSide !== mySide) return;
    const picks = match[mySide].roster
      .filter((player) => player.blindPick)
      .sort(
        (first, second) =>
          (first.blindPickOrder ?? Number.MAX_SAFE_INTEGER) -
            (second.blindPickOrder ?? Number.MAX_SAFE_INTEGER) ||
          first.id.localeCompare(second.id),
      );
    if (picks.length !== 2) {
      setNotice("Select exactly two Round 1 starters before submitting.");
      return;
    }
    setIsAdvancingPhase(true);
    const result = await runRoomServiceAction("live_submit_blind_picks", {
      target_side: mySide,
      player_ids: picks.map((player) => player.id),
    });
    if (result) {
      setAreMyBlindPicksLocked(true);
      setNotice("Your two Round 1 starters were submitted. They stay hidden until the other team submits theirs.");
      await recoverSnapshot("poll");
    }
    setIsAdvancingPhase(false);
  };

  const confirmRoundPlayers = async () => {
    if (!match || !directorSide || directorSide !== mySide) return;
    const activeId = mySide === "home" ? activeHomeId : activeAwayId;
    const player = match[mySide].roster.find(
      (candidate) => candidate.id === activeId,
    );
    if (!player || player.stocks <= 0 || !hasSelectedCharacter(player)) {
      setNotice(
        "Choose a player and character with stocks remaining before confirming.",
      );
      return;
    }
    setIsAdvancingPhase(true);
    const result = await runLiveAction("live_confirm_active_player", {
      player_id: player.id,
      selected_character: player.character,
      selected_character_image: player.characterImage,
    });
    if (result)
      setNotice("Player confirmed. Waiting for the next live-room action.");
    setIsAdvancingPhase(false);
  };

  const submitRpsChoice = async (choice: RpsChoice) => {
    if (!match || !directorSide) return;
    const submittedTieCount = match.rpsTieCount;
    setPendingRpsChoice(choice);
    setPendingRpsTieCount(submittedTieCount);
    setPendingRpsGameId(match.gameId);
    setIsAdvancingPhase(true);
    const renderedTieCount = match?.rpsTieCount ?? 0;
    const result = await runLiveAction(
      "live_submit_rps",
      {
        expected_rps_tie_count: renderedTieCount,
        throw_choice: choice,
      },
      // An RPS throw belongs to the revision on which it was made. In
      // particular, never replay a pre-tie click against the cleared state for
      // the next attempt; the director must deliberately submit a fresh throw.
      {
        // A simultaneous throw may legitimately lose the revision race to the
        // other team and is safe to replay within this same RPS attempt. Never
        // replay it after a tie has advanced the attempt generation.
        retryConflicts: (state) =>
          state.rps_tie_count === renderedTieCount,
        // Bind the click to the state actually rendered for this director. Do
        // not silently move a click from a just-finished tie into its rematch.
        revision: match?.revision,
        // Both directors reveal from the same realtime update rather than the
        // second submitter revealing early from its RPC response.
        applySuccessfulState: false,
      },
    );
    if (result?.conflict) {
      setPendingRpsChoice(null);
      setPendingRpsTieCount(null);
      setPendingRpsGameId(null);
      setNotice(
        "That RPS attempt already ended in a tie. Choose again for the new attempt.",
      );
    } else if (result) {
      setNotice("RPS choice locked. Waiting for the other team.");
    } else {
      setPendingRpsChoice(null);
      setPendingRpsTieCount(null);
      setPendingRpsGameId(null);
    }
    setIsAdvancingPhase(false);
  };

  const confirmStageAction = async () => {
    if (
      !match ||
      !matchId ||
      !supabase ||
      pendingStages.length !== requiredStageSelections ||
      !canActOnStage
    ) {
      setNotice("It is not your team's turn to choose stages.");
      return;
    }
    setIsAdvancingPhase(true);
    const action = stageStrikeAction === "pick" ? "pick" : "strike";
    // Submit the team whose turn the canonical state machine resolved. The
    // authorization check below keeps the other team gated, while avoiding a
    // side-label mismatch that could disable the rightful RPS winner.
    const actorTeamId = actingTeamId;
    if (!actorTeamId) {
      setNotice("The room is missing its team identity. Refresh before striking.");
      setIsAdvancingPhase(false);
      return;
    }
    const clientDiagnostic = {
      timestamp: new Date().toISOString(),
      matchId,
      slug,
      revision: match.revision,
      phase: match.phase,
      gameId: match.gameId,
      roundNumber: match.roundNumber,
      directorSide,
      actingSide,
      actorTeamId,
      homeTeamId,
      awayTeamId,
      rpsWinnerTeamId: match.rpsWinnerTeamId,
      stageStrikeCount,
      action,
      pendingStages: [...pendingStages],
    };
    const preflight = await supabase.rpc(
      "get_live_stage_action_diagnostics" as never,
      { target_match_id: matchId } as never,
    );
    console.info("[live-room] stage action preflight", {
      client: clientDiagnostic,
      server: preflight.data,
      diagnosticError: preflight.error,
    });
    const preflightState = preflight.data as {
      expected_actor_team_id?: string | null;
      strike_count?: number;
    } | null;
    if (
      preflightState &&
      (preflightState.strike_count !== stageStrikeCount ||
        preflightState.expected_actor_team_id !== actorTeamId)
    ) {
      console.warn("[live-room] stage action blocked by preflight mismatch", {
        client: clientDiagnostic,
        server: preflightState,
      });
      setPendingStages([]);
      await recoverSnapshot("poll");
      setNotice(
        "The server had a newer stage strike than this screen. The canonical stage turn has been restored without submitting the stale action.",
      );
      setIsAdvancingPhase(false);
      return;
    }
    const result = await runLiveAction(
      "live_confirm_stage_action",
      {
        stages: pendingStages,
        stage_action: action,
        // The four-argument RPC resolves the expected actor transactionally
        // from the fixture and authorizes the current user for that team. Do
        // not send a frontend-derived actor UUID that can disagree with the
        // locked server row even after a hard refresh.
      },
      {
        // A stage action is turn-bound. If realtime has not delivered a newer
        // revision yet, replaying this payload can submit the old actor against
        // the new turn (and incorrectly surface NOT_YOUR_TURN). Apply the
        // canonical conflict state, then let the operator confirm the action
        // that is valid for the newly rendered turn.
        retryConflicts: false,
      },
    );
    if (!result) {
      const afterFailure = await supabase.rpc(
        "get_live_stage_action_diagnostics" as never,
        { target_match_id: matchId } as never,
      );
      console.error("[live-room] stage action failure diagnostic", {
        submittedClientState: clientDiagnostic,
        preflightServerState: preflight.data,
        currentClientState: matchRef.current,
        currentServerState: afterFailure.data,
        diagnosticError: afterFailure.error ?? preflight.error,
      });
      setNotice(
        "Stage progression failed. Copy the “stage action failure diagnostic” entry from the browser console for support.",
      );
    }
    if (result?.conflict) {
      setPendingStages([]);
      setNotice(
        "The stage turn changed before your confirmation. The room is refreshed; choose the stage again.",
      );
    } else if (result) {
      setPendingStages([]);
      setNotice(
        action === "pick"
          ? "Stage selected. The round is live."
          : "Stage strike confirmed.",
      );
    }
    setIsAdvancingPhase(false);
  };

  const reportScore = async () => {
    if (!match) return;
    const homeScore = Math.min(score.home, match.homeRoundStartStocks);
    const awayScore = Math.min(score.away, match.awayRoundStartStocks);
    if (!isValidRoundScore(homeScore, awayScore)) {
      setNotice(
        "You can't report scores where both teams have a player with stocks remaining. Please redo the score report.",
      );
      return;
    }
    setIsAdvancingPhase(true);
    const result = await runLiveAction("live_submit_round_score", {
      home_score: homeScore,
      away_score: awayScore,
    });
    if (result)
      setNotice(
        "Score submitted. Waiting for the opposing director to verify.",
      );
    setIsAdvancingPhase(false);
  };

  const verifyScore = async () => {
    if (!match || !directorSide) return;
    if (match.scoreSubmittedByTeamId === match[directorSide].id) {
      setNotice(
        "Waiting for the opposing director to verify this reported score.",
      );
      return;
    }
    setIsAdvancingPhase(true);
    const result = await runLiveAction("live_verify_and_finalize_round", {});
    if (result) setNotice("Round verified and finalized.");
    setIsAdvancingPhase(false);
  };

  const disputeReportedScore = async () => {
    if (!match || !directorSide) return;
    if (match.scoreSubmittedByTeamId === match[directorSide].id) {
      setNotice("Waiting for the opposing team to verify or dispute this score.");
      return;
    }
    setIsAdvancingPhase(true);
    const result = await runLiveAction("live_dispute_round_score", {});
    if (result) setNotice(SCORE_DISPUTED_NOTICE);
    setIsAdvancingPhase(false);
  };

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message || !supabase || !matchId || !directorUserId) return false;

      const teamId =
        directorSide === "home"
          ? homeTeamId
          : directorSide === "away"
            ? awayTeamId
            : null;
      const optimisticCreatedAt = new Date().toISOString();
      const optimisticMessage: LiveChatMessage = {
        id: `local-${Date.now()}`,
        author: chatAuthor,
        role: "director",
        side: directorSide,
        message,
        createdAt: optimisticCreatedAt,
        displayTimestamp: formatChatTimestamp(optimisticCreatedAt),
      };
      setMatch((current) =>
        current
          ? { ...current, messages: [...current.messages, optimisticMessage] }
          : current,
      );

      const { data, error } = await supabase
        .from("live_match_messages" as never)
        .insert({
          match_id: matchId,
          user_id: directorUserId,
          team_id: teamId,
          message,
        } as never)
        .select("id,user_id,team_id,message,created_at,users(tag,role)")
        .single();

      if (error) {
        setNotice(error.message);
        setMatch((current) =>
          current
            ? {
                ...current,
                messages: current.messages.filter(
                  (chatMessage) => chatMessage.id !== optimisticMessage.id,
                ),
              }
            : current,
        );
        return false;
      }

      const [savedMessage] = mapChatRows(
        [data as ChatRow],
        homeTeamId,
        awayTeamId,
      );
      setMatch((current) => {
        if (!current) return current;
        const withoutOptimisticMessage = current.messages.filter(
          ({ id }) => id !== optimisticMessage.id && id !== savedMessage.id,
        );
        const nextMessages = [...withoutOptimisticMessage, savedMessage].sort(
          (first, second) => first.createdAt.localeCompare(second.createdAt),
        );
        return areChatMessageListsEqual(current.messages, nextMessages)
          ? current
          : { ...current, messages: nextMessages };
      });
      return true;
    },
    [
      awayTeamId,
      chatAuthor,
      directorSide,
      directorUserId,
      homeTeamId,
      mapChatRows,
      matchId,
      supabase,
    ],
  );

  const { homeRgb, awayRgb } = useTeamColors(
    match?.home?.logo,
    match?.away?.logo,
  );

  const teamColorStyles = useMemo<CSSProperties>(
    () =>
      ({
        "--live-home-color": `rgb(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]})`,
        "--live-home-color-subtle": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.08)`,
        "--live-home-border": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.22)`,
        "--live-home-card-bg1": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.16)`,
        "--live-home-card-bg2": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.04)`,
        "--live-home-score-bg1": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.35)`,
        "--live-home-score-bg2": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.12)`,
        "--live-home-chat-bg": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.18)`,
        "--live-home-chat-border": `rgba(${homeRgb[0]}, ${homeRgb[1]}, ${homeRgb[2]}, 0.35)`,

        "--live-away-color": `rgb(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]})`,
        "--live-away-color-subtle": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.08)`,
        "--live-away-border": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.22)`,
        "--live-away-card-bg1": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.16)`,
        "--live-away-card-bg2": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.04)`,
        "--live-away-score-bg1": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.35)`,
        "--live-away-score-bg2": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.12)`,
        "--live-away-chat-bg": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.18)`,
        "--live-away-chat-border": `rgba(${awayRgb[0]}, ${awayRgb[1]}, ${awayRgb[2]}, 0.35)`,
      }) as CSSProperties,
    [homeRgb, awayRgb],
  );

  if (isLoadingRoom) {
    return (
      <main className="live-match-page live-match-loading" style={teamColorStyles}>
        <div className="live-match-ambient" aria-hidden="true" />
        <RouteLoader label="Loading live match" />
      </main>
    );
  }

  if (!match) {
    return (
      <main className="live-match-page" style={teamColorStyles}>
        <div className="live-match-ambient" aria-hidden="true" />
        <section className="live-control-notice" role="alert">
          {notice || "This live match could not be loaded."}
        </section>
      </main>
    );
  }

  if (!canAccessLiveMatchRoom(match.date, viewerRole, currentTime)) {
    return (
      <main className="live-match-page live-match-locked" style={teamColorStyles}>
        <div className="live-match-ambient" aria-hidden="true" />
        <section className="live-match-lock-card" role="status">
          <span>Live room locked</span>
          <h1>Match operations open one hour before start time.</h1>
          <p>
            This room will unlock automatically at {new Date(
              new Date(match.date).getTime() - 60 * 60 * 1000,
            ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
          </p>
          <button type="button" onClick={() => router.push("/dashboard")}>Return to dashboard</button>
        </section>
      </main>
    );
  }

  const myTeam = match[mySide];
  const byBlindPickOrder = (a: LivePlayer, b: LivePlayer) =>
    (a.blindPickOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.blindPickOrder ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id);
  const myBlindPicks = myTeam.roster
    .filter((player) => player.blindPick)
    .sort(byBlindPickOrder);
  const opponentBlindPicks = match[mySide === "home" ? "away" : "home"].roster
    .filter((player) => player.blindPick)
    .sort(byBlindPickOrder);
  const activeHomePlayer = match.home.roster.find(
    (player) => player.id === activeHomeId,
  );
  const activeAwayPlayer = match.away.roster.find(
    (player) => player.id === activeAwayId,
  );
  const activePlayer = mySide === "home" ? activeHomePlayer : activeAwayPlayer;
  const homeRules = getLiveGameRules(match.game, match.homeRosterSize);
  const awayRules = getLiveGameRules(match.game, match.awayRosterSize);
  const verifyingTeamId = directorSide ? match[directorSide].id : null;
  const canVerifyScore = Boolean(
    verifyingTeamId &&
    match.scoreSubmittedByTeamId &&
    match.scoreSubmittedByTeamId !== verifyingTeamId,
  );
  const bothDirectorsCheckedIn = match.homeCheckedIn && match.awayCheckedIn;
  const myDirectorCheckedIn =
    directorSide === "home"
      ? match.homeCheckedIn
      : directorSide === "away"
        ? match.awayCheckedIn
        : false;
  const characterOptions = getCharacterOptions(match.game);
  const myActiveId = mySide === "home" ? activeHomeId : activeAwayId;
  const myConfirmedId = mySide === "home" ? confirmedHomeId : confirmedAwayId;
  const isMyActiveConfirmed = Boolean(
    myActiveId && myConfirmedId === myActiveId,
  );
  const isMyPlayerContinuing = Boolean(
    match.phase === "player_select" && isMyActiveConfirmed,
  );
  const availableNextPlayers = myTeam.roster.filter(
    (player) =>
      player.stocks > 0 &&
      (match.roundNumber === 1 ? player.blindPick : !player.selected),
  );
  const needsNextPlayerSelection = Boolean(
    match.phase === "player_select" &&
    !isMyPlayerContinuing &&
    (!activePlayer || activePlayer.stocks <= 0),
  );
  const struckStages = stageActions
    .filter((action) => action.action === "strike")
    .map((action) => action.stage);
  const pickedStages = stageActions
    .filter((action) => action.action === "pick")
    .map((action) => action.stage);
  const strikePool =
    match.roundNumber === 1 ? ultimateStarterStages : legalStages;
  const unavailableStages = [...struckStages, ...pickedStages];
  const remainingStages = strikePool.filter(
    (stage) => !unavailableStages.includes(stage),
  );
  const stageStrikeCount = stageActions.filter(
    (action) => action.action === "strike",
  ).length;
  const hasConfirmedStagePick = stageActions.some(
    (action) => action.action === "pick",
  );
  const stageTurn = getLiveStageTurn({
    phase: match.phase,
    roundNumber: match.roundNumber,
    actions: stageActions,
    rpsWinnerSide,
    previousRoundLoserTeamId: match.previousRoundLoserTeamId,
    homeTeamId: match.home.id,
    awayTeamId: match.away.id,
  });
  const actingSide = hasConfirmedStagePick ? null : stageTurn.actingSide;
  const currentRpsResult = getRpsWinner(rpsHomeChoice, rpsAwayChoice);
  const areRpsChoicesLocked = Boolean(rpsHomeChoice && rpsAwayChoice);
  const isRpsTie = currentRpsResult === "tie";
  const isAwaitingRpsRematch = match.rpsTieCount > 0 && !rpsWinnerSide;
  const rpsRevealKey =
    currentRpsResult && rpsHomeChoice && rpsAwayChoice
      ? `${rpsHomeChoice}:${rpsAwayChoice}:${currentRpsResult}`
      : null;
  const isRpsRevealVisible = Boolean(
    rpsRevealKey && expiredRpsRevealKey !== rpsRevealKey,
  );
  const stageStrikeAction: "rps" | "strike" | "pick" | "wait" =
    match.phase !== "stage_strike"
      ? "wait"
      : match.roundNumber === 1 &&
          (!rpsWinnerSide || (stageStrikeCount === 0 && isRpsRevealVisible))
        ? "rps"
        : actingSide === null
          ? "wait"
          : stageTurn.action;
  const requiredStageSelections =
    stageStrikeAction === "rps" ? 0 : stageTurn.requiredSelections;
  const actingTeamId =
    actingSide === "home"
      ? homeTeamId
      : actingSide === "away"
        ? awayTeamId
        : null;
  // Compare canonical team UUIDs instead of UI side labels. A recovery can
  // reconcile fixture orientation independently from a newer live revision,
  // but the actual team identities remain authoritative.
  const canActOnStage = canOperateLiveStageTurn({
    directorSide,
    actingSide,
    homeTeamId,
    awayTeamId,
  });
  const persistedMyRpsChoice =
    directorSide === "home"
      ? rpsHomeChoice
      : directorSide === "away"
        ? rpsAwayChoice
        : null;
  const isPendingRpsChoiceCurrent =
    match.phase === "stage_strike" &&
    match.gameId === pendingRpsGameId &&
    match.rpsTieCount === pendingRpsTieCount;
  const myRpsChoice =
    persistedMyRpsChoice ??
    (isPendingRpsChoiceCurrent ? pendingRpsChoice : null);
  const opponentRpsChoice =
    directorSide === "home"
      ? rpsAwayChoice
      : directorSide === "away"
        ? rpsHomeChoice
        : null;
  const opponentRpsLabel =
    directorSide === "home"
      ? match.away.shortName
      : directorSide === "away"
        ? match.home.shortName
        : "Opponent";
  const rpsResultMessage =
    currentRpsResult === "tie"
      ? "Tie"
      : currentRpsResult && directorSide
        ? currentRpsResult === directorSide
          ? "Win"
          : "Lose"
        : currentRpsResult
          ? "Win"
          : null;
  const rpsResultTone =
    currentRpsResult === "tie"
      ? "tie"
      : currentRpsResult && directorSide && currentRpsResult !== directorSide
        ? "lose"
        : "win";
  const bothRoundPlayersConfirmed = Boolean(confirmedHomeId && confirmedAwayId);
  const shouldBlindRoundOneOpponent = Boolean(
    match.roundNumber === 1 &&
    (match.phase === "player_select" || match.phase === "stage_strike") &&
    !bothRoundPlayersConfirmed,
  );
  const blindRoster = (side: LiveSide, roster: LivePlayer[]) => {
    if (!shouldBlindRoundOneOpponent || side === directorSide) return roster;

    // Round-one sends are double blind: until both active player ids are
    // confirmed, do not expose the opponent's active-player id, roster slot,
    // selected state, character, or selection-driven ordering in either rail.
    return roster
      .map((player) => ({
        ...player,
        character: "Character hidden",
        characterImage: "",
        selected: false,
      }))
      .sort((first, second) =>
        first.tag.localeCompare(second.tag, undefined, {
          sensitivity: "base",
        }),
      );
  };
  const displayHomeRoster = blindRoster("home", match.home.roster);
  const displayAwayRoster = blindRoster("away", match.away.roster);
  const displayActiveHomeId =
    shouldBlindRoundOneOpponent && directorSide !== "home"
      ? null
      : activeHomeId;
  const displayActiveAwayId =
    shouldBlindRoundOneOpponent && directorSide !== "away"
      ? null
      : activeAwayId;
  const stagePrompt =
    stageStrikeAction === "rps"
      ? isRpsRevealVisible && rpsResultMessage
        ? `Revealed: ${rpsResultMessage}. Stage striking starts in 5 seconds.`
        : isRpsTie || isAwaitingRpsRematch
          ? "Tie — both teams must choose again."
          : rpsWinnerSide
            ? "RPS complete. Begin stage striking."
            : areRpsChoicesLocked
              ? "Both throws are in. Resolving winner..."
              : "Choose Rock, Paper, or Scissors. The opponent's throw appears after both teams lock in."
      : stageStrikeAction === "pick"
        ? `${actingSide ? match[actingSide].shortName : "The next team"} picks the round stage from the remaining options.`
        : stageStrikeAction === "strike"
          ? `${actingSide ? match[actingSide].shortName : "The next team"} strikes ${requiredStageSelections} stage${requiredStageSelections === 1 ? "" : "s"}.`
          : "Waiting for the next stage-striking action.";

  return (
    <main className="live-match-page" style={teamColorStyles}>
      <div className="live-match-ambient" aria-hidden="true" />
      <header className="live-match-topbar">
        <Link href="/dashboard">
          <RiArrowLeftSFill size={18} /> Dashboard
        </Link>
        <div className="live-room-title">
          <RiBroadcastFill size={18} />
          <span>Live match room</span>
          <strong>
            {match.home.shortName} vs {match.away.shortName}
          </strong>
        </div>
        <div
          className={`live-room-status ${bothDirectorsCheckedIn ? "" : "is-waiting"}`}
        >
          <span className="live-dot" />{" "}
          {bothDirectorsCheckedIn
            ? `Live · Game ${match.gameNumber}`
            : "Waiting for check-in"}
        </div>
      </header>

      <section className="live-arena">
        <RosterRail
          side="home"
          name={match.home.name}
          logo={match.home.logo}
          roster={displayHomeRoster}
          rosterSize={homeRules.rosterSize}
          activeId={displayActiveHomeId}
          onSelect={(id) => handleRailSelect("home", id)}
        />

        <div className="live-center-stage">
          <ArenaScoreboard
            home={match.home}
            away={match.away}
            homeStocks={match.homeStocks}
            awayStocks={match.awayStocks}
            homeMatchScore={match.homeMatchScore}
            awayMatchScore={match.awayMatchScore}
          />

          <div className="live-battlefield live-battlefield-centerpiece">
            <div
              className={`live-stage-display ${match.phase === "stage_strike" ? "is-stage-striking" : ""}`}
            >
              <div className="live-stage-grid" aria-hidden="true" />
              {match.phase === "stage_strike" ? (
                <div className="live-center-strike-panel">
                  <span>Stage striking</span>
                  <strong>
                    {stageStrikeAction === "rps"
                      ? "RPS"
                      : stageStrikeAction === "pick"
                        ? "PICK"
                        : "STRIKE"}
                  </strong>
                  <p>{stagePrompt}</p>
                  {stageStrikeAction === "rps" ? (
                    <div className="live-rps-board">
                      <div
                        className="live-rps-opponent-card"
                        aria-live="polite"
                      >
                        <span>{opponentRpsLabel}</span>
                        {areRpsChoicesLocked && opponentRpsChoice ? (
                          <div className="live-rps-opponent-choice">
                            <RpsChoiceImage choice={opponentRpsChoice} />
                            <strong>
                              {rpsChoiceAssets[opponentRpsChoice].label}
                            </strong>
                          </div>
                        ) : (
                          <strong>?</strong>
                        )}
                      </div>
                      <div className="live-rps-player-card">
                        {isAwaitingRpsRematch && !isRpsRevealVisible ? (
                          <div
                            className="live-rps-result live-rps-result-tie"
                            role="status"
                            aria-live="polite"
                          >
                            <span>RPS result</span>
                            <strong>Tie — choose again</strong>
                          </div>
                        ) : null}
                        {isRpsRevealVisible && rpsResultMessage ? (
                          <div
                            className={`live-rps-result live-rps-result-${rpsResultTone}`}
                          >
                            <span>Your result</span>
                            <strong>{rpsResultMessage}</strong>
                          </div>
                        ) : null}
                        <div className="live-rps-grid">
                          {rpsChoices.map((choice) => {
                            const isSelected = myRpsChoice === choice;

                            return (
                              <button
                                key={choice}
                                type="button"
                                className={isSelected ? "is-selected" : ""}
                                disabled={
                                  !directorSide ||
                                  (Boolean(myRpsChoice) && !isRpsTie) ||
                                  Boolean(rpsWinnerSide) ||
                                  isRpsRevealVisible ||
                                  isAdvancingPhase
                                }
                                onClick={() => void submitRpsChoice(choice)}
                                aria-label={`Choose ${rpsChoiceAssets[choice].label}`}
                              >
                                <RpsChoiceImage choice={choice} />
                                <span className="sr-only">
                                  {rpsChoiceAssets[choice].label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`live-center-stage-options ${stageStrikeAction === "pick" ? "is-pick-mode" : "is-strike-mode"}`}
                      >
                        {strikePool.map((stage) => {
                          const isUnavailable =
                            unavailableStages.includes(stage);
                          const isPending = pendingStages.includes(stage);
                          const stageIcon = resolveRoundStageIcon(stage);
                          const isPick = stageStrikeAction === "pick";

                          return (
                            <button
                              key={stage}
                              type="button"
                              className={`${isUnavailable ? "is-struck" : ""} ${isPending ? `is-selected ${isPick ? "is-pick" : "is-strike"}` : ""}`}
                              disabled={
                                !canActOnStage ||
                                isUnavailable ||
                                isAdvancingPhase
                              }
                              onClick={() => {
                                if (isPending) {
                                  setPendingStages((current) =>
                                    current.filter((item) => item !== stage),
                                  );
                                } else if (stageStrikeAction === "pick") {
                                  setPendingStages([stage]);
                                } else {
                                  setPendingStages((current) =>
                                    cycleCappedSelection(
                                      current,
                                      stage,
                                      requiredStageSelections,
                                    ),
                                  );
                                }
                              }}
                            >
                              <span className="live-stage-option-info">
                                {stageIcon ? (
                                  <span
                                    className="live-stage-option-icon"
                                    aria-hidden="true"
                                  >
                                    <Image
                                      src={stageIcon}
                                      alt=""
                                      width={48}
                                      height={48}
                                      unoptimized
                                    />
                                  </span>
                                ) : null}
                                <span className="live-stage-option-name">
                                  {stage}
                                </span>
                              </span>
                              {isUnavailable ? <RiCloseFill size={16} /> : null}
                            </button>
                          );
                        })}
                      </div>
                      <div className="live-action-group">
                        <button
                          type="button"
                          className="live-center-confirm-stage"
                          disabled={
                            !canActOnStage ||
                            pendingStages.length !== requiredStageSelections ||
                            isAdvancingPhase
                          }
                          onClick={() => void confirmStageAction()}
                        >
                          {isAdvancingPhase
                            ? "Confirming…"
                            : stageStrikeAction === "pick"
                              ? "Confirm stage pick"
                              : "Confirm strike"}
                        </button>
                        {directorSide && match.phase === "stage_strike" ? (
                          <button
                            type="button"
                            className="live-reset-action"
                            disabled={isAdvancingPhase}
                            onClick={() => void resetStageActions()}
                          >
                            Reset round strikes
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <span>
                    {match.stage ? "Selected stage" : phaseLabels[match.phase]}
                  </span>
                  <strong>
                    {match.phase === "check_in"
                      ? "WAITING"
                      : (match.stage ?? "STAGE")}
                  </strong>
                  <p>
                    {match.phase === "check_in"
                      ? "Both directors must check in below to begin"
                      : match.stage
                        ? "Round ready · report stocks when complete"
                        : "Directors complete the current action below"}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="live-flow-bar">
            {(
              [
                "check_in",
                "blind_pick",
                "player_select",
                "stage_strike",
                "score_verify",
              ] as LivePhase[]
            ).map((phase, index) => {
              const isCurrent =
                match.phase === phase ||
                (phase === "score_verify" && match.phase === "playing");

              return (
                <div key={phase} className={isCurrent ? "is-current" : ""}>
                  <span>{index + 1}</span>
                  {flowStepLabels[phase]}
                </div>
              );
            })}
          </div>
        </div>

        <RosterRail
          side="away"
          name={match.away.name}
          logo={match.away.logo}
          roster={displayAwayRoster}
          rosterSize={awayRules.rosterSize}
          activeId={displayActiveAwayId}
          onSelect={(id) => handleRailSelect("away", id)}
        />
      </section>

      <section className="live-operations">
        <div className={`live-director-panel live-director-${mySide}`}>
          <div className="live-panel-heading">
            <div>
              <span>Team controls</span>
              <strong>{directorSide ? myTeam.name : "Match lobby"}</strong>
            </div>
          </div>
          <div className="live-control-progress">
            <span>{phaseLabels[match.phase]}</span>
            <small>
              {isLoadingRoom ? "Loading…" : `Round ${match.roundNumber}`}
            </small>
          </div>

          {canResetMatch ? (
            <div className="live-debug-reset">
              <div>
                <RiRefreshFill size={18} />
                <span>Testing reset</span>
                <small>
                  Clears the match so both teams can start from check-in.
                </small>
              </div>
              <button
                type="button"
                disabled={isResettingMatch}
                onClick={() => void resetMatchFromScratch()}
              >
                {isResettingMatch ? "Resetting…" : "Reset match"}
              </button>
            </div>
          ) : null}

          {match.phase === "check_in" ? (
            <div className="live-check-in-control">
              <div
                className={`live-check-in-team live-check-in-team-home ${match.homeCheckedIn ? "is-checked" : ""}`}
              >
                <Image src={match.home.logo} alt="" width={38} height={38} />
                <span>
                  <strong>{match.home.shortName}</strong>
                  <small>
                    {match.homeCheckedIn
                      ? "Director checked in"
                      : "Waiting for director"}
                  </small>
                </span>
                {match.homeCheckedIn ? (
                  <RiCheckboxCircleFill size={25} />
                ) : (
                  <RiTimeFill size={25} />
                )}
              </div>
              <div
                className={`live-check-in-team live-check-in-team-away ${match.awayCheckedIn ? "is-checked" : ""}`}
              >
                <Image src={match.away.logo} alt="" width={38} height={38} />
                <span>
                  <strong>{match.away.shortName}</strong>
                  <small>
                    {match.awayCheckedIn
                      ? "Director checked in"
                      : "Waiting for director"}
                  </small>
                </span>
                {match.awayCheckedIn ? (
                  <RiCheckboxCircleFill size={25} />
                ) : (
                  <RiTimeFill size={25} />
                )}
              </div>
              {directorSide ? (
                <button
                  type="button"
                  onClick={checkInDirector}
                  disabled={isCheckingIn || myDirectorCheckedIn}
                >
                  {myDirectorCheckedIn
                    ? "You are checked in"
                    : isCheckingIn
                      ? "Checking in…"
                      : "Check in for match"}
                </button>
              ) : (
                <p>
                  Only an assigned director or team captain can check in and
                  operate the live room. You can stay here and the room will
                  begin automatically.
                </p>
              )}
            </div>
          ) : null}
          {match.phase === "blind_pick" ? (
            <div className="live-control-body">
              <RiShieldCheckFill size={26} />
              <div>
                <strong>Select two starters for Round 1</strong>
                <p>
                  {areMyBlindPicksLocked
                    ? "Your two starters are submitted and hidden. Waiting for the opposing team to submit theirs."
                    : "Choose exactly two starters for the Round 1 double blind. Both teams’ selections are revealed only after both submit."}
                </p>
                <div
                  className={`live-next-player-options live-blind-pick-options ${myBlindPicks.length > 0 ? "has-selection" : ""}`}
                  aria-label="Round 1 double-blind starter choices"
                >
                  {myTeam.roster.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      className={player.blindPick ? "is-selected" : "is-available"}
                      disabled={areMyBlindPicksLocked}
                      onClick={() => handleRailSelect(mySide, player.id)}
                      aria-pressed={Boolean(player.blindPick)}
                    >
                      <RiAccountCircleFill size={28} />
                      <span>{player.tag}</span>
                      <small>{player.blindPick ? "Selected" : "Available"}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="live-action-group">
                <button
                  type="button"
                  disabled={areMyBlindPicksLocked || myBlindPicks.length !== 2 || isAdvancingPhase}
                  onClick={() => void submitBlindPicks()}
                >
                  {areMyBlindPicksLocked ? "Starters submitted" : isAdvancingPhase ? "Submitting…" : "Submit two starters"}
                  <RiSendPlaneFill size={17} />
                </button>
              </div>
            </div>
          ) : null}
          {match.phase === "player_select" ? (
            <div className="live-control-body">
              <FighterAvatar
                player={needsNextPlayerSelection ? undefined : activePlayer}
                size={62}
              />
              <div>
                {match.roundNumber === 1 ? (
                  <div className="live-blind-pick-reveal" role="status">
                    <span>Double-blind choices revealed</span>
                    <p>
                      <strong>{myTeam.shortName}:</strong> {myBlindPicks.map((player) => player.tag).join(" or ")}
                      {" · "}
                      <strong>{match[mySide === "home" ? "away" : "home"].shortName}:</strong> {opponentBlindPicks.map((player) => player.tag).join(" or ")}
                    </p>
                  </div>
                ) : null}
                <strong>
                  {needsNextPlayerSelection
                    ? match.roundNumber === 1 ? "Choose one of your two players" : "Pick your next player"
                    : (activePlayer?.tag ?? "Choose a player")}
                </strong>
                <p>
                  {isMyPlayerContinuing
                    ? "Your player won the last round and must stay in with their remaining stocks. Waiting for the opposing team to choose their next player."
                    : needsNextPlayerSelection
                      ? "Select one of your starter players to begin the crew battle."
                      : "Select the next player from standby, then choose their character."}
                </p>
                {needsNextPlayerSelection ? (
                  <div
                    className="live-next-player-options"
                    aria-label="Remaining players"
                  >
                    {availableNextPlayers.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleRailSelect(mySide, player.id)}
                      >
                        <FighterAvatar player={player} size={28} />
                        <span>{player.tag}</span>
                        <small>{player.stocks} stocks</small>
                      </button>
                    ))}
                  </div>
                ) : null}
                {activePlayer && activePlayer.stocks > 0 ? (
                  <label className="live-character-select">
                    Character
                    <select
                      disabled={isMyPlayerContinuing}
                      value={
                        hasSelectedCharacter(activePlayer)
                          ? activePlayer.character
                          : ""
                      }
                      onChange={(event) =>
                        void updatePlayerCharacter(
                          mySide,
                          activePlayer.id,
                          event.target.value,
                        )
                      }
                    >
                      <option value="" disabled>
                        Choose character
                      </option>
                      {characterOptions.map((character) => (
                        <option key={character} value={character}>
                          {character}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="live-action-group">
                <button
                  disabled={
                    !myActiveId ||
                    !hasSelectedCharacter(activePlayer) ||
                    isMyActiveConfirmed ||
                    isAdvancingPhase
                  }
                  onClick={() => void confirmRoundPlayers()}
                >
                  {isAdvancingPhase
                    ? "Confirming…"
                    : isMyActiveConfirmed
                      ? "Player locked"
                      : "Lock in player"}{" "}
                  <RiArrowRightSFill size={17} />
                </button>
                {isMyActiveConfirmed && !isMyPlayerContinuing ? (
                  <button
                    type="button"
                    className="live-reset-action"
                    disabled={isAdvancingPhase}
                    onClick={() => void resetPlayerSelection()}
                  >
                    Reset player
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {match.phase === "stage_strike" ? (
            <div className="live-stage-controls">
              <div className="live-stage-instruction">
                <RiShieldCheckFill size={24} />
                <span>
                  <strong>
                    {stageStrikeAction === "rps"
                      ? "Rock Paper Scissors"
                      : stageStrikeAction === "pick"
                        ? "Pick stage"
                        : "Strike stages"}
                  </strong>
                  <small>{stagePrompt}</small>
                </span>
              </div>
              <div className="live-stage-summary">
                <span>{remainingStages.length} remaining</span>
                <span>{stageActions.length} actions confirmed</span>
                {rpsWinnerSide ? (
                  <span>{match[rpsWinnerSide].shortName} won RPS</span>
                ) : null}
              </div>
            </div>
          ) : null}
          {match.phase === "playing" ? (
            <div className="live-score-controls">
              <div>
                <RiTimeFill size={24} />
                <span>
                  <strong>Round in progress</strong>
                  <small>
                    Tap each fighter icon stack to cycle remaining stocks.
                  </small>
                </span>
              </div>
              <RoundStockButton
                side="home"
                player={activeHomePlayer}
                teamName={match.home.shortName}
                stocks={score.home}
                slots={match.homeRoundStartStocks}
                onChange={(home) =>
                  setScore((value) => ({
                    ...value,
                    home,
                  }))
                }
              />
              <RoundStockButton
                side="away"
                player={activeAwayPlayer}
                teamName={match.away.shortName}
                stocks={score.away}
                slots={match.awayRoundStartStocks}
                onChange={(away) =>
                  setScore((value) => ({
                    ...value,
                    away,
                  }))
                }
              />
              <button
                disabled={isAdvancingPhase}
                onClick={() => void reportScore()}
              >
                {isAdvancingPhase ? "Submitting…" : "Submit score"}
              </button>
            </div>
          ) : null}
          {match.phase === "score_verify" ? (
            <div className="live-verify-card">
              <RiCheckboxCircleFill size={34} />
              <div className="live-verify-summary">
                <strong>Verify round result</strong>
                <RoundStockPreview
                  homePlayer={activeHomePlayer}
                  awayPlayer={activeAwayPlayer}
                  homeStocks={score.home}
                  awayStocks={score.away}
                  homeSlots={match.homeRoundStartStocks}
                  awaySlots={match.awayRoundStartStocks}
                  homeName={match.home.shortName}
                  awayName={match.away.shortName}
                />
              </div>
              <div className="live-action-group">
                <button
                  type="button"
                  className="live-dispute-action"
                  disabled={isAdvancingPhase || !canVerifyScore}
                  onClick={() => void disputeReportedScore()}
                >
                  <RiCloseCircleFill size={15} aria-hidden="true" />
                  <span>Dispute</span>
                </button>
                <button
                  type="button"
                  className="live-verify-action"
                  disabled={isAdvancingPhase || !canVerifyScore}
                  onClick={() => void verifyScore()}
                >
                  <RiCheckboxCircleFill size={16} aria-hidden="true" />
                  <span>
                    {isAdvancingPhase
                      ? "Verifying…"
                      : canVerifyScore
                        ? "Verify & continue"
                        : "Waiting for opponent"}
                  </span>
                </button>
              </div>
            </div>
          ) : null}
          {notice ? <p className="live-control-notice">{notice}</p> : null}
        </div>

        <ChatPanel
          messages={match.messages}
          canSend={Boolean(directorUserId && supabase)}
          onSend={sendMessage}
        />
      </section>
    </main>
  );
}

/** Thin route boundary; room state and subscriptions live in the dedicated hook. */
export function LiveMatchRoom({ slug }: { slug: string }) {
  return useLiveMatchRoomState(slug);
}
