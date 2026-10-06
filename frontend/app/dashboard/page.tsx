"use client";

import {
  Fragment,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RiCalendarFill,
  RiArrowRightSFill,
  RiBankCardFill,
  RiMailFill,
  RiCloseFill,
  RiLink,
  RiUserAddFill,
  RiPencilFill,
  RiEditBoxFill,
  RiShieldCheckFill,
  RiBroadcastFill,
  RiUserFill,
  RiTrophyFill,
  RiDeleteBinFill,
  RiTeamFill,
  RiHistoryLine,
  RiTwitterXFill,
  RiDiscordFill,
  RiCheckFill,
  RiArrowDownSLine,
} from "@remixicon/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RouteLoader } from "@/app/components/route-loader";
import FloatingTOC from "@/app/components/floating-toc";
import { InvitePlayerAction } from "@/app/components/invite-player-action";
import { TeamGraphicsRepo } from "@/app/components/team-graphics-repo";
import { getSupabaseClient } from "@/lib/supabase";
import type { TeamGraphics } from "@/lib/data";
import { isLiveMatchAccessOpen } from "@/lib/live-match";
import {
  DIRECTOR_TIERS,
  isDirectorRole,
  isPaidDirectorRole,
  type DirectorTier,
  type UserRole,
} from "@/lib/roles";

type UserProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole | "mod";
  avatar: string | null;
  tag: string | null;
  x_handle: string | null;
  discord_handle: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string | null;
  avatar: string | null;
  director_user_id: string | null;
  player_user_ids: string[] | null;
  graphics: TeamGraphics | null;
};
type PlayerRow = {
  id: string;
  tag: string;
  team_id: string | null;
  user_id: string | null;
  is_captain: boolean;
};
type RosterPlayer = PlayerRow & {
  user: Pick<
    UserProfileRow,
    "id" | "first_name" | "last_name" | "avatar"
  > | null;
};
type MatchRow = {
  id: string;
  slug: string;
  date: string;
  status: "upcoming" | "live" | "completed";
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};
type RoundRow = {
  home_player_tag: string;
  home_character: string;
  away_player_tag: string;
  away_character: string;
};

const DEFAULT_FIRST_NAME = "new";
const DEFAULT_LAST_NAME = "player";

const hasCompletedOnboarding = (profile: UserProfileRow | null) => {
  if (!profile) return false;
  const hasPlaceholderName =
    profile.first_name.trim().toLowerCase() === DEFAULT_FIRST_NAME &&
    profile.last_name.trim().toLowerCase() === DEFAULT_LAST_NAME;

  return !hasPlaceholderName && Boolean(profile.tag?.trim());
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string")
        return reject(new Error("Unable to process image upload."));
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Unable to process image upload."));
    reader.readAsDataURL(file);
  });

const normalizeHandle = (value: string) =>
  value.trim().replace(/^@/, "") || null;

const formatRosterNamePart = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized
    ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    : "";
};

const formatRosterDisplayName = (
  user: Pick<UserProfileRow, "first_name" | "last_name"> | null
) => {
  if (!user) return "";
  return [
    formatRosterNamePart(user.first_name),
    formatRosterNamePart(user.last_name),
  ]
    .filter(Boolean)
    .join(" ");
};

const pickMainAndSecondaries = (characters: string[]) => {
  const counts = new Map<string, number>();
  characters.forEach((char) => counts.set(char, (counts.get(char) ?? 0) + 1));
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  return { main: ranked[0] ?? "None", secondaries: ranked[1] ?? "None" };
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [existingAvatar, setExistingAvatar] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [upcomingMatches, setUpcomingMatches] = useState<MatchRow[]>([]);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [selectedEnrollmentTier, setSelectedEnrollmentTier] =
    useState<DirectorTier>("member");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const isSectionCollapsed = (sectionId: string, isEmpty: boolean = false) => {
    return collapsedSections[sectionId] !== undefined
      ? collapsedSections[sectionId]
      : isEmpty;
  };
  const toggleSectionCollapse = (
    sectionId: string,
    isEmpty: boolean = false
  ) => {
    setCollapsedSections((prev) => {
      const current = prev[sectionId] !== undefined ? prev[sectionId] : isEmpty;
      return {
        ...prev,
        [sectionId]: !current,
      };
    });
  };
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
  const [recentMatchesLimit, setRecentMatchesLimit] = useState(5);
  const [allTeams, setAllTeams] = useState<TeamRow[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [captainActionId, setCaptainActionId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerTag, setEditingPlayerTag] = useState("");
  const [savingPlayerTagId, setSavingPlayerTagId] = useState<string | null>(
    null
  );
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
  const [newPlayerTag, setNewPlayerTag] = useState("");
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [addPlayerMessage, setAddPlayerMessage] = useState("");
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);
  const [mainCharacter, setMainCharacter] = useState("None");
  const [secondaryCharacter, setSecondaryCharacter] = useState("None");
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    tag: "",
    role: "player" as UserProfileRow["role"],
    xHandle: "",
    discordHandle: "",
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    const loadDashboardData = async (userProfile: UserProfileRow) => {
      const [{ data: players }, { data: teamsData }] = await Promise.all([
        supabase.from("players").select("id,tag,team_id,user_id,is_captain"),
        supabase
          .from("teams")
          .select("id,name,short_name,avatar,director_user_id,player_user_ids,graphics")
          .order("name", { ascending: true }),
      ]);

      if (!isMounted) return;

      const allPlayers = (players as PlayerRow[] | null) ?? [];
      const teamList = (teamsData as TeamRow[] | null) ?? [];
      setAllTeams(teamList);

      const linkedPlayer = allPlayers.find(
        (player) =>
          player.user_id === userProfile.id ||
          player.tag.toLowerCase() === (userProfile.tag ?? "").toLowerCase()
      );
      const directorTeam = teamList.find(
        (candidate) => candidate.director_user_id === userProfile.id
      );
      const playerTeam = teamList.find(
        (candidate) => candidate.id === linkedPlayer?.team_id
      );
      const resolvedTeam = isDirectorRole(userProfile.role)
        ? directorTeam ?? null
        : playerTeam ?? null;

      setTeam(resolvedTeam);
      setRoster([]);

      if (resolvedTeam) {
        const teamPlayers = allPlayers.filter(
          (player) => player.team_id === resolvedTeam.id
        );
        const rosterUserIds = teamPlayers.flatMap((player) =>
          player.user_id ? [player.user_id] : []
        );
        const { data: rosterUsers } =
          rosterUserIds.length > 0
            ? await supabase
                .from("users")
                .select("id,first_name,last_name,avatar")
                .in("id", rosterUserIds)
            : { data: [] };

        if (!isMounted) return;
        const usersById = new Map(
          (
            (rosterUsers as Array<
              Pick<UserProfileRow, "id" | "first_name" | "last_name" | "avatar">
            > | null) ?? []
          ).map((user) => [user.id, user])
        );
        setRoster(
          teamPlayers
            .map((player) => ({
              ...player,
              user: player.user_id
                ? usersById.get(player.user_id) ?? null
                : null,
            }))
            .sort(
              (first, second) =>
                Number(second.is_captain) - Number(first.is_captain) ||
                first.tag.localeCompare(second.tag)
            )
        );
      }

      const userTag = linkedPlayer?.tag ?? userProfile.tag ?? "";
      if (userTag) {
        const { data: rounds } = await supabase
          .from("match_crew_rounds")
          .select(
            "home_player_tag,home_character,away_player_tag,away_character"
          );

        if (!isMounted) return;

        const matchingCharacters = (
          (rounds as RoundRow[] | null) ?? []
        ).flatMap((round) => {
          const found: string[] = [];
          if (round.home_player_tag.toLowerCase() === userTag.toLowerCase())
            found.push(round.home_character);
          if (round.away_player_tag.toLowerCase() === userTag.toLowerCase())
            found.push(round.away_character);
          return found;
        });

        const picked = pickMainAndSecondaries(matchingCharacters);
        setMainCharacter(picked.main);
        setSecondaryCharacter(picked.secondaries);
      }

      const isModerator = userProfile.role === "mod";
      if (!resolvedTeam && !isModerator) return;

      let nextMatchesQuery = supabase
        .from("matches")
        .select(
          "id,slug,date,status,home_team_id,away_team_id,home_score,away_score"
        )
        .in("status", ["upcoming", "live"])
        .order("date", { ascending: true });

      if (isModerator) {
        nextMatchesQuery = nextMatchesQuery.limit(8);
      } else if (resolvedTeam) {
        nextMatchesQuery = nextMatchesQuery.or(
          `home_team_id.eq.${resolvedTeam.id},away_team_id.eq.${resolvedTeam.id}`
        );
      }

      const { data: nextMatches, error: nextMatchesError } =
        await nextMatchesQuery;

      if (!isMounted) return;
      if (nextMatchesError) {
        setErrorMessage(nextMatchesError.message);
        setUpcomingMatches([]);
      } else {
        setUpcomingMatches((nextMatches as MatchRow[] | null) ?? []);
      }

      if (!resolvedTeam) return;

      const { data: recent } = await supabase
        .from("matches")
        .select(
          "id,slug,date,status,home_team_id,away_team_id,home_score,away_score"
        )
        .or(
          `home_team_id.eq.${resolvedTeam.id},away_team_id.eq.${resolvedTeam.id}`
        )
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(6);

      if (!isMounted) return;
      setRecentMatches((recent as MatchRow[] | null) ?? []);
    };

    const verifySessionAndLoadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!session) return router.replace("/signup");

      const { data: loadedProfile, error } = await supabase
        .from("users")
        .select(
          "id,first_name,last_name,role,avatar,tag,x_handle,discord_handle"
        )
        .eq("id", session.user.id)
        .maybeSingle<UserProfileRow>();

      if (!isMounted) return;
      if (error) setErrorMessage(error.message);
      if (!loadedProfile) {
        router.replace("/onboarding");
        return;
      }

      if (loadedProfile) {
        setProfile(loadedProfile);
        setExistingAvatar(loadedProfile.avatar);
        setProfileForm({
          firstName: loadedProfile.first_name ?? "",
          lastName: loadedProfile.last_name ?? "",
          tag: loadedProfile.tag ?? "",
          role: loadedProfile.role,
          xHandle: loadedProfile.x_handle ?? "",
          discordHandle: loadedProfile.discord_handle ?? "",
        });
        if (!hasCompletedOnboarding(loadedProfile)) {
          router.replace("/onboarding");
          return;
        }
        await loadDashboardData(loadedProfile);
      }
      setIsCheckingAuth(false);
    };

    void verifySessionAndLoadProfile();
    return () => {
      isMounted = false;
    };
  }, [dashboardReloadKey, router, supabase]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(
      selectedFile ? URL.createObjectURL(selectedFile) : null
    );

    if (!selectedFile || !profile || !supabase) return;

    setErrorMessage("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return router.replace("/signup");

    setIsSavingProfile(true);
    try {
      const nextAvatar = await fileToDataUrl(selectedFile);
      const { error } = await supabase
        .from("users" as never)
        .update({ avatar: nextAvatar } as never)
        .eq("id", session.user.id);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setExistingAvatar(nextAvatar);
        setProfile({ ...profile, avatar: nextAvatar });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Image upload failed."
      );
    }

    setIsSavingProfile(false);
  };

  const handleProfileUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    if (!supabase || !profile) return;

    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
    const tag = profileForm.tag.trim();
    if (!firstName || !lastName || !tag) {
      setErrorMessage("First name, last name, and player tag are required.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return router.replace("/signup");

    const nextProfile = {
      first_name: firstName,
      last_name: lastName,
      tag,
      role: profileForm.role,
      x_handle: normalizeHandle(profileForm.xHandle),
      discord_handle: profileForm.discordHandle.trim() || null,
    };

    setIsSavingProfile(true);
    const { error } = await supabase
      .from("users" as never)
      .update(nextProfile as never)
      .eq("id", session.user.id);

    setIsSavingProfile(false);
    if (error) return setErrorMessage(error.message);

    setProfile((previous) =>
      previous ? { ...previous, ...nextProfile } : previous
    );
    setProfileForm({
      firstName,
      lastName,
      tag,
      role: profileForm.role,
      xHandle: nextProfile.x_handle ?? "",
      discordHandle: nextProfile.discord_handle ?? "",
    });
    setIsEditingProfile(false);
    setDashboardReloadKey((key) => key + 1);
  };

  const handleProfileEditCancel = () => {
    setProfileForm({
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      tag: profile?.tag ?? "",
      role: profile?.role ?? "player",
      xHandle: profile?.x_handle ?? "",
      discordHandle: profile?.discord_handle ?? "",
    });
    setIsEditingProfile(false);
  };

  const handleCaptainToggle = async (player: RosterPlayer) => {
    if (
      !supabase ||
      !isDirectorRole(profile?.role) ||
      !team ||
      !player.user_id ||
      player.team_id !== team.id
    )
      return;
    setErrorMessage("");
    setCaptainActionId(player.id);

    const { error } = await supabase
      .from("players" as never)
      .update({ is_captain: !player.is_captain } as never)
      .eq("id", player.id)
      .eq("team_id", team.id);

    setCaptainActionId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setDashboardReloadKey((key) => key + 1);
  };

  const handleEditPlayerTagStart = (player: RosterPlayer) => {
    setEditingPlayerId(player.id);
    setEditingPlayerTag(player.tag);
    setAddPlayerMessage("");
    setErrorMessage("");
  };

  const handleEditPlayerTagCancel = () => {
    setEditingPlayerId(null);
    setEditingPlayerTag("");
  };

  const handlePlayerTagUpdate = async (
    player: RosterPlayer
  ) => {
    const tag = editingPlayerTag.trim();
    if (
      !supabase ||
      !isDirectorRole(profile?.role) ||
      !team ||
      player.team_id !== team.id ||
      !tag
    )
      return;
    if (tag === player.tag) {
      handleEditPlayerTagCancel();
      return;
    }

    setErrorMessage("");
    setAddPlayerMessage("");
    setSavingPlayerTagId(player.id);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSavingPlayerTagId(null);
      return router.replace("/signup");
    }

    try {
      const response = await fetch("/api/roster/players", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId: player.id, tag }),
      });
      const result = (await response.json()) as {
        error?: string;
        player?: PlayerRow;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to update this player tag.");

      setRoster((current) =>
        current.map((entry) =>
          entry.id === player.id ? { ...entry, tag } : entry
        )
      );
      setAddPlayerMessage(`${player.tag} is now listed as ${tag}.`);
      handleEditPlayerTagCancel();
      setDashboardReloadKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this player tag."
      );
    } finally {
      setSavingPlayerTagId(null);
    }
  };

  const handleAddPlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tag = newPlayerTag.trim();
    if (!supabase || !isDirectorRole(profile?.role) || !team || !tag) return;

    setErrorMessage("");
    setAddPlayerMessage("");
    setIsAddingPlayer(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setIsAddingPlayer(false);
      return router.replace("/signup");
    }

    try {
      const response = await fetch("/api/roster/players", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tag }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to add this player.");

      setNewPlayerTag("");
      setAddPlayerMessage(
        `${tag} was added. You can now send them an account invite.`
      );
      setDashboardReloadKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to add this player."
      );
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const handleRemovePlayer = async (player: RosterPlayer) => {
    if (
      !supabase ||
      !isDirectorRole(profile?.role) ||
      !team ||
      player.team_id !== team.id ||
      removingPlayerId
    )
      return;

    const confirmed = window.confirm(
      `Remove ${player.tag} from your roster? Their Nexus account will stay intact, but they will lose this team assignment and Captain access.`
    );
    if (!confirmed) return;

    setErrorMessage("");
    setAddPlayerMessage("");
    setRemovingPlayerId(player.id);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setRemovingPlayerId(null);
      return router.replace("/signup");
    }

    try {
      const response = await fetch("/api/roster/players", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId: player.id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to remove this player.");

      setRoster((current) => current.filter((entry) => entry.id !== player.id));
      setAddPlayerMessage(`${player.tag} was removed from your roster.`);
      setDashboardReloadKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to remove this player."
      );
    } finally {
      setRemovingPlayerId(null);
    }
  };

  const openEnrollmentContact = (tier: DirectorTier) => {
    setSelectedEnrollmentTier(tier);
    setIsEnrollmentOpen(true);
  };

  const closeEnrollmentContact = () => {
    setIsEnrollmentOpen(false);
  };

  const handleJoinLiveMatch = (match: MatchRow) => {
    if (profile?.role !== "mod" && !isLiveMatchAccessOpen(match.date)) return;
    setJoiningMatchId(match.id);
    setErrorMessage("");
    router.push(`/matches/${match.slug}/live`);
  };

  const teamNameFromId = (teamId: string) =>
    allTeams.find((entry) => entry.id === teamId)?.short_name ??
    allTeams.find((entry) => entry.id === teamId)?.name ??
    "TBD";
  const showRegisterSchoolCard = isDirectorRole(profile?.role) && !team;
  const showEnrollmentCard = isDirectorRole(profile?.role) && Boolean(team);
  const canRegisterSchool = isDirectorRole(profile?.role);

  const tocItems = useMemo(() => {
    const items: { id: string; label: string }[] = [];

    if (showRegisterSchoolCard) {
      items.push({ id: "dashboard-school-setup", label: "School Setup" });
    }

    if (showEnrollmentCard) {
      items.push({ id: "dashboard-league-enrollment", label: "League Enrollment" });
    }

    items.push({ id: "dashboard-upcoming-matches", label: "Upcoming Matches" });
    items.push({ id: "dashboard-recent-matches", label: "Recent Matches" });

    if (team) {
      items.push({ id: "dashboard-team-graphics", label: "Graphics Repository" });
    }

    if (profile?.role === "player" || (isDirectorRole(profile?.role) && team)) {
      items.push({ id: "dashboard-roster", label: "Roster" });
    }

    return items;
  }, [showRegisterSchoolCard, showEnrollmentCard, team, profile?.role]);

  const wins = recentMatches.filter((match) => {
    const isHome = team?.id === match.home_team_id;
    const myScore = isHome ? match.home_score : match.away_score;
    const theirScore = isHome ? match.away_score : match.home_score;
    return myScore !== null && theirScore !== null && myScore > theirScore;
  }).length;

  if (!supabase) {
    return (
      <section className="auth-shell">
        <article className="login-modal card">
          <h1>Dashboard</h1>
          <p className="muted">
            Dashboard is unavailable until Supabase is configured.
          </p>
        </article>
      </section>
    );
  }

  if (isCheckingAuth) {
    return <RouteLoader label="Loading dashboard" />;
  }

  const competitorName = profile?.tag ?? profile?.first_name ?? "competitor";
  const heroTagText = `${competitorName}.`;

  return (
    <div className="dashboard-page">
      <FloatingTOC items={tocItems} />
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="kicker">
            <span /> Dashboard
          </div>
          <h1>
            Welcome back,{" "}
            <span
              style={{ "--name-len": Math.max(heroTagText.length, 1) } as CSSProperties}
              title={competitorName}
            >
              {heroTagText}
            </span>
          </h1>
        </div>
        <div className="dashboard-hero-stats" aria-label="Dashboard summary">
          <div>
            <RiCalendarFill aria-hidden="true" />
            <span>Upcoming</span>
            <strong>{String(upcomingMatches.length).padStart(2, "0")}</strong>
          </div>
          <div>
            <RiTrophyFill aria-hidden="true" />
            <span>Recent wins</span>
            <strong>{String(wins).padStart(2, "0")}</strong>
          </div>
        </div>
      </section>

      <section className="dashboard-content">
        <div className="dashboard-layout">
          <main className="dashboard-main">
            {showRegisterSchoolCard ? (
              <section
                id="dashboard-school-setup"
                className={`dashboard-panel dashboard-enrollment-card ${
                  collapsedSections["dashboard-school-setup"]
                    ? "is-collapsed"
                    : ""
                }`}
                aria-labelledby="dashboard-register-school-title"
              >
                <div
                  className="dashboard-section-heading dashboard-enrollment-heading"
                  onClick={() => toggleSectionCollapse("dashboard-school-setup")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSectionCollapse("dashboard-school-setup");
                    }
                  }}
                >
                  <RiTeamFill
                    className="dashboard-live-icon"
                    size={28}
                    aria-hidden="true"
                  />
                  <div>
                    <span>School setup</span>
                    <h2 id="dashboard-register-school-title">
                      Register your school
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="dashboard-section-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSectionCollapse("dashboard-school-setup");
                    }}
                    aria-expanded={!collapsedSections["dashboard-school-setup"]}
                    aria-label={
                      collapsedSections["dashboard-school-setup"]
                        ? "Expand section"
                        : "Collapse section"
                    }
                  >
                    <RiArrowDownSLine
                      size={20}
                      className={`dashboard-section-toggle-icon ${
                        collapsedSections["dashboard-school-setup"]
                          ? "is-collapsed"
                          : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div className="dashboard-section-body-wrapper">
                  <div className="dashboard-section-body-inner">
                    <div className="dashboard-enrollment-body">
                      <p>
                        Create your school profile or claim an existing unlinked
                        school before handling league enrollment. Once registration
                        is complete, you’ll return here to review the next
                        enrollment step.
                      </p>
                      <Link
                        className="btn btn-primary"
                        href="/school-registration"
                      >
                        Register School{" "}
                        <RiArrowRightSFill size={18} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {showEnrollmentCard ? (
              <section
                id="dashboard-league-enrollment"
                className={`dashboard-panel dashboard-enrollment-section ${
                  collapsedSections["dashboard-league-enrollment"]
                    ? "is-collapsed"
                    : ""
                }`}
                aria-labelledby="dashboard-enrollment-title"
              >
                <div
                  className="dashboard-section-heading"
                  onClick={() =>
                    toggleSectionCollapse("dashboard-league-enrollment")
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSectionCollapse("dashboard-league-enrollment");
                    }
                  }}
                >
                  <RiBankCardFill
                    className="dashboard-live-icon"
                    size={28}
                    aria-hidden="true"
                  />
                  <div>
                    <span>Membership & League Dues</span>
                    <h2 id="dashboard-enrollment-title">League Enrollment</h2>
                  </div>
                  <button
                    type="button"
                    className="dashboard-section-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSectionCollapse("dashboard-league-enrollment");
                    }}
                    aria-expanded={
                      !collapsedSections["dashboard-league-enrollment"]
                    }
                    aria-label={
                      collapsedSections["dashboard-league-enrollment"]
                        ? "Expand section"
                        : "Collapse section"
                    }
                  >
                    <RiArrowDownSLine
                      size={20}
                      className={`dashboard-section-toggle-icon ${
                        collapsedSections["dashboard-league-enrollment"]
                          ? "is-collapsed"
                          : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <div className="dashboard-section-body-wrapper">
                  <div className="dashboard-section-body-inner">
                    <div className="dashboard-enrollment-content">
                      <p className="dashboard-enrollment-desc">
                        Your school is registered. Select your preferred enrollment
                        tier below to connect with the Nexus league team and
                        finalize your team&apos;s seasonal onboarding.
                      </p>

                      <div className="dashboard-tier-grid">
                        {/* Tier 1: Basic Membership */}
                        <article className="dashboard-tier-card tier-basic">
                          <div className="dashboard-tier-card-top">
                            <div className="dashboard-tier-meta">
                              <h3 className="dashboard-tier-name">
                                Nexus Membership
                              </h3>
                            </div>
                            <div className="dashboard-tier-price-row">
                              <span className="dashboard-tier-currency">$</span>
                              <strong className="dashboard-tier-amount">700</strong>
                              <span className="dashboard-tier-cycle">/ year</span>
                            </div>
                            <p className="dashboard-tier-summary">
                              Core sanctioned collegiate league entry, guided match
                              room, and public stats engine.
                            </p>
                          </div>

                          <div className="dashboard-tier-card-body">
                            <div className="dashboard-tier-divider" />
                            <span className="dashboard-tier-features-title">
                              What&apos;s Included
                            </span>
                            <ul className="dashboard-tier-feature-list">
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <span>Sanctioned Tournament Play</span>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <span>Guided Live Match Room Access</span>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <span>Public Team Profile & Stats Engine</span>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <span>Roster & Captain Management</span>
                              </li>
                            </ul>
                          </div>

                          <div className="dashboard-tier-card-footer">
                            <button
                              type="button"
                              className="dashboard-tier-action-btn"
                              onClick={() => openEnrollmentContact("member")}
                            >
                              <span>Select Membership</span>
                              <RiArrowRightSFill size={18} aria-hidden="true" />
                            </button>
                          </div>
                        </article>

                        {/* Tier 2: Asynchronous Support */}
                        <article className="dashboard-tier-card tier-pro is-featured">
                          <div className="dashboard-tier-card-top">
                            <div className="dashboard-tier-meta">
                              <h3 className="dashboard-tier-name text-emerald">
                                +Asynchronous Support
                              </h3>
                            </div>
                            <div className="dashboard-tier-price-row">
                              <span className="dashboard-tier-currency">$</span>
                              <strong className="dashboard-tier-amount">
                                1,500
                              </strong>
                              <span className="dashboard-tier-cycle">/ year</span>
                            </div>
                            <p className="dashboard-tier-summary">
                              Adds custom weekly branded graphics, feat posters, and
                              season highlight assets.
                            </p>
                          </div>

                          <div className="dashboard-tier-card-body">
                            <div className="dashboard-tier-divider" />
                            <span className="dashboard-tier-features-title">
                              What&apos;s Included
                            </span>
                            <ul className="dashboard-tier-feature-list">
                              <li className="feature-highlight">
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <strong>All Nexus Membership Features</strong>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <span>Custom Graphics Repository</span>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <span>Weekly Match Feat Artwork</span>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-emerald"
                                  aria-hidden="true"
                                />
                                <span>Season Highlight Recaps</span>
                              </li>
                            </ul>
                          </div>

                          <div className="dashboard-tier-card-footer">
                            <button
                              type="button"
                              className="dashboard-tier-action-btn btn-emerald"
                              onClick={() => openEnrollmentContact("pro")}
                            >
                              <span>Select Asynchronous</span>
                              <RiArrowRightSFill size={18} aria-hidden="true" />
                            </button>
                          </div>
                        </article>

                        {/* Tier 3: Synchronous Support */}
                        <article className="dashboard-tier-card tier-exclusive">
                          <div className="dashboard-tier-card-top">
                            <div className="dashboard-tier-meta">
                              <h3 className="dashboard-tier-name text-magenta">
                                +Synchronous Support
                              </h3>
                            </div>
                            <div className="dashboard-tier-price-row">
                              <span className="dashboard-tier-currency">$</span>
                              <strong className="dashboard-tier-amount">
                                3,000
                              </strong>
                              <span className="dashboard-tier-cycle">/ year</span>
                            </div>
                            <p className="dashboard-tier-summary">
                              Guarantees broadcast coverage and
                              professional production for your matches.
                            </p>
                          </div>

                          <div className="dashboard-tier-card-body">
                            <div className="dashboard-tier-divider" />
                            <span className="dashboard-tier-features-title">
                              What&apos;s Included
                            </span>
                            <ul className="dashboard-tier-feature-list">
                              <li className="feature-highlight">
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-magenta"
                                  aria-hidden="true"
                                />
                                <strong>All Asynchronous Features</strong>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-magenta"
                                  aria-hidden="true"
                                />
                                <span>Weekly Live Stream Broadcast</span>
                              </li>
                              <li>
                                <RiCheckFill
                                  size={15}
                                  className="feature-icon text-magenta"
                                  aria-hidden="true"
                                />
                                <span>Dedicated Production & Casters</span>
                              </li>
                            </ul>
                          </div>

                          <div className="dashboard-tier-card-footer">
                            <button
                              type="button"
                              className="dashboard-tier-action-btn btn-magenta"
                              onClick={() => openEnrollmentContact("exclusive")}
                            >
                              <span>Select Synchronous</span>
                              <RiArrowRightSFill size={18} aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {(() => {
              const isUpcomingEmpty = upcomingMatches.length === 0;
              const isUpcomingCollapsed = isSectionCollapsed(
                "dashboard-upcoming-matches",
                isUpcomingEmpty
              );

              return (
                <section
                  id="dashboard-upcoming-matches"
                  className={`dashboard-panel ${
                    isUpcomingCollapsed ? "is-collapsed" : ""
                  }`}
                >
                  <div
                    className="dashboard-section-heading"
                    onClick={() =>
                      toggleSectionCollapse(
                        "dashboard-upcoming-matches",
                        isUpcomingEmpty
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSectionCollapse(
                          "dashboard-upcoming-matches",
                          isUpcomingEmpty
                        );
                      }
                    }}
                  >
                    <RiBroadcastFill className="dashboard-live-icon" size={28} />
                    <div>
                      <span>Match operations</span>
                      <h2>Upcoming Matches</h2>
                    </div>
                    <button
                      type="button"
                      className="dashboard-section-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionCollapse(
                          "dashboard-upcoming-matches",
                          isUpcomingEmpty
                        );
                      }}
                      aria-expanded={!isUpcomingCollapsed}
                      aria-label={
                        isUpcomingCollapsed
                          ? "Expand section"
                          : "Collapse section"
                      }
                    >
                      <RiArrowDownSLine
                        size={20}
                        className={`dashboard-section-toggle-icon ${
                          isUpcomingCollapsed ? "is-collapsed" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <div className="dashboard-section-body-wrapper">
                    <div className="dashboard-section-body-inner">
                  {upcomingMatches.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <RiBroadcastFill size={28} aria-hidden="true" />
                      <p>
                        {profile?.role === "mod"
                          ? "No upcoming matches are currently scheduled."
                          : "No upcoming matches scheduled for your team yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="dashboard-upcoming-grid">
                      {upcomingMatches.map((match) => {
                        const isModerator = profile?.role === "mod";
                        const isHome = team?.id === match.home_team_id;
                        const opponentId = isHome
                          ? match.away_team_id
                          : match.home_team_id;
                        const opponent = allTeams.find(
                          (entry) => entry.id === opponentId
                        );
                        const isLive = match.status === "live";
                        const isAccessLocked =
                          !isModerator &&
                          !isLiveMatchAccessOpen(match.date, currentTime);
                        const homeTeam = allTeams.find(
                          (entry) => entry.id === match.home_team_id
                        );
                        const awayTeam = allTeams.find(
                          (entry) => entry.id === match.away_team_id
                        );
                        const opponentStatsHref = opponent?.short_name
                          ? `/stats/teams/${encodeURIComponent(opponent.short_name.toLowerCase())}`
                          : opponent?.name
                          ? `/stats/teams/${encodeURIComponent(opponent.name.toLowerCase())}`
                          : null;

                        return (
                          <article
                            className={`dashboard-upcoming-card ${
                              isLive ? "is-live" : ""
                            } ${isAccessLocked ? "is-locked" : ""}`}
                            key={match.id}
                          >
                            <div className="dashboard-match-date-badge">
                              <span className="dashboard-match-month">
                                {new Date(match.date).toLocaleDateString([], {
                                  month: "short",
                                })}
                              </span>
                              <strong className="dashboard-match-day">
                                {new Date(match.date).getDate()}
                              </strong>
                              <span className="dashboard-match-time">
                                {new Date(match.date).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <div className="dashboard-match-body">
                              <div className="dashboard-match-header">
                                {isLive ? (
                                  <span className="dashboard-match-badge is-live">
                                    <span
                                      className="dashboard-match-live-pulse"
                                      aria-hidden="true"
                                    />
                                    LIVE MATCH
                                  </span>
                                ) : (
                                  <span className="dashboard-match-badge">
                                    UPCOMING MATCH
                                  </span>
                                )}
                              </div>

                              <div className="dashboard-match-matchup">
                                {!isModerator ? (
                                  <span className="dashboard-matchup-vs">VS</span>
                                ) : null}

                                {isModerator ? (
                                  <>
                                    {[homeTeam, awayTeam].map(
                                      (matchTeam, index) => (
                                        <Fragment key={`${match.id}-${index}`}>
                                          <div className="dashboard-matchup-team">
                                            {matchTeam?.avatar ? (
                                              <img
                                                src={matchTeam.avatar}
                                                alt={matchTeam.name}
                                                className="dashboard-matchup-logo"
                                              />
                                            ) : null}
                                            <div className="dashboard-matchup-info">
                                              <strong>
                                                {matchTeam?.short_name ??
                                                  matchTeam?.name ??
                                                  "TBD"}
                                              </strong>
                                              {matchTeam?.name &&
                                              matchTeam.short_name ? (
                                                <small>{matchTeam.name}</small>
                                              ) : null}
                                            </div>
                                          </div>
                                          {index === 0 ? (
                                            <span className="dashboard-matchup-vs">
                                              VS
                                            </span>
                                          ) : null}
                                        </Fragment>
                                      )
                                    )}
                                  </>
                                ) : opponentStatsHref ? (
                                  <Link
                                    href={opponentStatsHref}
                                    className="dashboard-matchup-team dashboard-team-link"
                                    title={`View ${opponent?.name ?? "opponent"} stats`}
                                  >
                                    {opponent?.avatar ? (
                                      <img
                                        src={opponent.avatar}
                                        alt={opponent?.name ?? "Opponent"}
                                        className="dashboard-matchup-logo"
                                      />
                                    ) : null}
                                    <div className="dashboard-matchup-info">
                                      <strong>
                                        {opponent?.short_name ?? opponent?.name ?? "TBD"}
                                      </strong>
                                      {opponent?.name && opponent.short_name ? (
                                        <small>{opponent.name}</small>
                                      ) : null}
                                    </div>
                                  </Link>
                                ) : (
                                  <div className="dashboard-matchup-team">
                                    {opponent?.avatar ? (
                                      <img
                                        src={opponent.avatar}
                                        alt={opponent?.name ?? "Opponent"}
                                        className="dashboard-matchup-logo"
                                      />
                                    ) : null}
                                    <div className="dashboard-matchup-info">
                                      <strong>
                                        {opponent?.short_name ?? opponent?.name ?? "TBD"}
                                      </strong>
                                      {opponent?.name && opponent.short_name ? (
                                        <small>{opponent.name}</small>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`dashboard-join-match ${
                                isLive ? "is-live" : ""
                              } ${isAccessLocked ? "is-locked" : ""}`}
                              disabled={isAccessLocked || joiningMatchId === match.id}
                              aria-label={isAccessLocked ? "Live room opens one hour before the match" : undefined}
                              onClick={() => void handleJoinLiveMatch(match)}
                            >
                              <span>
                                {joiningMatchId === match.id
                                  ? "Joining..."
                                  : isAccessLocked
                                  ? "Locked until 1 hour before"
                                  : isLive
                                  ? "Enter Live Room"
                                  : isModerator
                                  ? "Join as Moderator"
                                  : isDirectorRole(profile?.role)
                                  ? "Join & Check In"
                                  : "Join Room"}
                              </span>
                              <RiArrowRightSFill size={18} />
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

            {(() => {
              const isRecentEmpty = recentMatches.length === 0;
              const isRecentCollapsed = isSectionCollapsed(
                "dashboard-recent-matches",
                isRecentEmpty
              );

              return (
                <section
                  id="dashboard-recent-matches"
                  className={`dashboard-panel ${
                    isRecentCollapsed ? "is-collapsed" : ""
                  }`}
                >
                  <div
                    className="dashboard-section-heading"
                    onClick={() =>
                      toggleSectionCollapse(
                        "dashboard-recent-matches",
                        isRecentEmpty
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSectionCollapse(
                          "dashboard-recent-matches",
                          isRecentEmpty
                        );
                      }
                    }}
                  >
                    <RiHistoryLine size={28} />
                    <div>
                      <span>Latest results</span>
                      <h2>Recent Matches</h2>
                    </div>
                    <button
                      type="button"
                      className="dashboard-section-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionCollapse(
                          "dashboard-recent-matches",
                          isRecentEmpty
                        );
                      }}
                      aria-expanded={!isRecentCollapsed}
                      aria-label={
                        isRecentCollapsed
                          ? "Expand section"
                          : "Collapse section"
                      }
                    >
                      <RiArrowDownSLine
                        size={20}
                        className={`dashboard-section-toggle-icon ${
                          isRecentCollapsed ? "is-collapsed" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <div className="dashboard-section-body-wrapper">
                    <div className="dashboard-section-body-inner">
                      {recentMatches.length === 0 ? (
                        <div className="dashboard-empty-state">
                          <RiHistoryLine size={28} aria-hidden="true" />
                          <p>
                            No recent completed matches are available for your team.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="dashboard-recent-list">
                            {recentMatches.slice(0, recentMatchesLimit).map((match) => {
                              const isHome = team?.id === match.home_team_id;
                              const myScore = isHome
                                ? match.home_score
                                : match.away_score;
                              const theirScore = isHome
                                ? match.away_score
                                : match.home_score;
                              const result =
                                myScore !== null && theirScore !== null
                                  ? myScore > theirScore
                                    ? "WIN"
                                    : "LOSS"
                                  : "FINAL";
                              const opponentTeam = isHome
                                ? allTeams.find((t) => t.id === match.away_team_id)
                                : allTeams.find((t) => t.id === match.home_team_id);
                              const opponent =
                                opponentTeam?.name ??
                                (isHome
                                  ? teamNameFromId(match.away_team_id)
                                  : teamNameFromId(match.home_team_id));

                              const opponentStatsHref = opponentTeam?.short_name
                                ? `/stats/teams/${encodeURIComponent(opponentTeam.short_name.toLowerCase())}`
                                : opponentTeam?.name
                                ? `/stats/teams/${encodeURIComponent(opponentTeam.name.toLowerCase())}`
                                : null;

                              return (
                                <div
                                  key={match.id}
                                  className={`dashboard-recent-match ${
                                    result === "WIN"
                                      ? "is-win"
                                      : result === "LOSS"
                                      ? "is-loss"
                                      : ""
                                  }`}
                                >
                                  <Link
                                    href={`/matches/${match.slug}`}
                                    className="dashboard-result"
                                    aria-label={`View match details: ${result}`}
                                  >
                                    {result}
                                  </Link>
                                  {opponentStatsHref ? (
                                    <Link
                                      href={opponentStatsHref}
                                      className="dashboard-recent-team-info dashboard-team-link"
                                      title={`View ${opponent} stats`}
                                    >
                                      {opponentTeam?.avatar ? (
                                        <img
                                          src={opponentTeam.avatar}
                                          alt={opponent}
                                          className="dashboard-recent-team-logo"
                                        />
                                      ) : null}
                                      <div>
                                        <small>Final result</small>
                                        <strong>vs {opponent}</strong>
                                      </div>
                                    </Link>
                                  ) : (
                                    <div className="dashboard-recent-team-info">
                                      {opponentTeam?.avatar ? (
                                        <img
                                          src={opponentTeam.avatar}
                                          alt={opponent}
                                          className="dashboard-recent-team-logo"
                                        />
                                      ) : null}
                                      <div>
                                        <small>Final result</small>
                                        <strong>vs {opponent}</strong>
                                      </div>
                                    </div>
                                  )}
                                  <Link
                                    href={`/matches/${match.slug}`}
                                    className="dashboard-recent-match-details-link"
                                    title="View match details"
                                  >
                                    <time dateTime={match.date}>
                                      {new Date(match.date).toLocaleDateString([], {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </time>
                                    <RiArrowRightSFill aria-hidden="true" />
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                          {recentMatches.length > recentMatchesLimit ? (
                            <button
                              type="button"
                              className="dashboard-load-more-btn"
                              onClick={() => setRecentMatchesLimit((prev) => prev + 5)}
                            >
                              Load More Matches ({recentMatches.length - recentMatchesLimit} remaining)
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </section>
              );
            })()}

            {team ? (
              <TeamGraphicsRepo
                id="dashboard-team-graphics"
                className="dashboard-panel"
                graphics={team.graphics}
                teamName={team.name}
              />
            ) : null}

            {profile?.role === "player" ? (() => {
              const isPlayerRosterEmpty = !team;
              const isPlayerRosterCollapsed = isSectionCollapsed(
                "dashboard-player-roster",
                isPlayerRosterEmpty
              );

              return (
                <section
                  id="dashboard-roster"
                  className={`dashboard-panel dashboard-player-roster-section ${
                    team ? "dashboard-roster-section" : ""
                  } ${isPlayerRosterCollapsed ? "is-collapsed" : ""}`}
                >
                  <div
                    className="dashboard-section-heading"
                    onClick={() =>
                      toggleSectionCollapse(
                        "dashboard-player-roster",
                        isPlayerRosterEmpty
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSectionCollapse(
                          "dashboard-player-roster",
                          isPlayerRosterEmpty
                        );
                      }
                    }}
                  >
                    <RiTeamFill size={28} />
                    <div>
                      <span>{team ? "Team roster" : "Team access"}</span>
                      <h2>Roster</h2>
                    </div>
                    <button
                      type="button"
                      className="dashboard-section-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionCollapse(
                          "dashboard-player-roster",
                          isPlayerRosterEmpty
                        );
                      }}
                      aria-expanded={!isPlayerRosterCollapsed}
                      aria-label={
                        isPlayerRosterCollapsed
                          ? "Expand section"
                          : "Collapse section"
                      }
                    >
                      <RiArrowDownSLine
                        size={20}
                        className={`dashboard-section-toggle-icon ${
                          isPlayerRosterCollapsed ? "is-collapsed" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                <div className="dashboard-section-body-wrapper">
                  <div className="dashboard-section-body-inner">
                    {team ? (
                      <>
                        <div className="dashboard-player-team-summary">
                          {team.avatar ? (
                            <Image
                              src={team.avatar}
                              alt=""
                              width={52}
                              height={52}
                              unoptimized
                            />
                          ) : (
                            <span>
                              {(team.short_name ?? team.name)
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                          )}
                          <div>
                            <small>Your school</small>
                            <strong>{team.name}</strong>
                            <p>
                              {roster.length} roster{" "}
                              {roster.length === 1 ? "member" : "members"} on this
                              team.
                            </p>
                          </div>
                        </div>
                        {roster.length === 0 ? (
                          <div className="dashboard-roster-empty">
                            <RiTeamFill size={28} aria-hidden="true" />
                            <p>Your team roster is empty.</p>
                          </div>
                        ) : (
                          <div className="dashboard-roster-grid dashboard-player-roster-grid">
                            {roster.map((player) => {
                              const isCurrentPlayer = player.user_id === profile.id;
                              return (
                                <article
                                  key={player.id}
                                  className={`dashboard-roster-card dashboard-player-roster-card ${
                                    player.is_captain ? "is-captain" : ""
                                  } ${isCurrentPlayer ? "is-current-player" : ""}`}
                                >
                                  <div className="dashboard-roster-avatar">
                                    {player.user?.avatar ? (
                                      <Image
                                        src={player.user.avatar}
                                        alt=""
                                        width={54}
                                        height={54}
                                        unoptimized
                                      />
                                    ) : (
                                      <span>
                                        {player.tag.slice(0, 1).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="dashboard-roster-identity">
                                    <strong>{player.tag}</strong>
                                    {formatRosterDisplayName(player.user) ? (
                                      <span>
                                        {formatRosterDisplayName(player.user)}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="dashboard-roster-role">
                                    {isCurrentPlayer ? (
                                      <span className="dashboard-player-you-badge">
                                        You
                                      </span>
                                    ) : null}
                                    {player.is_captain ? (
                                      <span>
                                        <RiShieldCheckFill size={15} /> Captain
                                      </span>
                                    ) : (
                                      <span>Player</span>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="dashboard-player-roster-copy">
                        <p>
                          Roster spots are invite-only. To join a school, ask your
                          director to send your specific roster invite link from
                          their dashboard.
                        </p>
                        <p>
                          Once you open and accept that link while signed in, your
                          Nexus account will be linked to your school roster and
                          your team fixtures will appear here automatically.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })() : null}

            {isDirectorRole(profile?.role) && team ? (() => {
              const isDirectorRosterEmpty = roster.length === 0;
              const isDirectorRosterCollapsed = isSectionCollapsed(
                "dashboard-director-roster",
                isDirectorRosterEmpty
              );

              return (
                <section
                  id="dashboard-roster"
                  className={`dashboard-panel dashboard-roster-section ${
                    isDirectorRosterCollapsed ? "is-collapsed" : ""
                  }`}
                >
                  <div
                    className="dashboard-section-heading"
                    onClick={() =>
                      toggleSectionCollapse(
                        "dashboard-director-roster",
                        isDirectorRosterEmpty
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSectionCollapse(
                          "dashboard-director-roster",
                          isDirectorRosterEmpty
                        );
                      }
                    }}
                  >
                    <RiTeamFill size={28} />
                    <div>
                      <span>Team management</span>
                      <h2>Roster</h2>
                    </div>
                    <button
                      type="button"
                      className="dashboard-section-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionCollapse(
                          "dashboard-director-roster",
                          isDirectorRosterEmpty
                        );
                      }}
                      aria-expanded={!isDirectorRosterCollapsed}
                      aria-label={
                        isDirectorRosterCollapsed
                          ? "Expand section"
                          : "Collapse section"
                      }
                    >
                      <RiArrowDownSLine
                        size={20}
                        className={`dashboard-section-toggle-icon ${
                          isDirectorRosterCollapsed ? "is-collapsed" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                <div className="dashboard-section-body-wrapper">
                  <div className="dashboard-section-body-inner">
                    <p className="dashboard-roster-intro">
                      Account status shows which roster players have signed in and
                      linked their Nexus profile. Only linked players can be
                      promoted to Captain.
                    </p>
                    <form
                      className="dashboard-roster-add"
                      onSubmit={(event) => void handleAddPlayer(event)}
                    >
                      <div>
                        <label htmlFor="dashboard-new-player-tag">
                          Add a player
                        </label>
                        <span>
                          Create an unlinked roster spot, then use the invite action
                          to connect their Nexus account.
                        </span>
                      </div>
                      <div className="dashboard-roster-add-controls">
                        <input
                          id="dashboard-new-player-tag"
                          type="text"
                          maxLength={50}
                          value={newPlayerTag}
                          onChange={(event) => setNewPlayerTag(event.target.value)}
                          placeholder="Player tag"
                          aria-describedby={
                            addPlayerMessage
                              ? "dashboard-add-player-message"
                              : undefined
                          }
                          disabled={isAddingPlayer}
                        />
                        <button
                          type="submit"
                          disabled={isAddingPlayer || !newPlayerTag.trim()}
                        >
                          <RiUserAddFill size={16} aria-hidden="true" />
                          {isAddingPlayer ? "Adding…" : "Add player"}
                        </button>
                      </div>
                    </form>
                    {addPlayerMessage ? (
                      <p
                        id="dashboard-add-player-message"
                        className="dashboard-roster-add-success flex items-center gap-1.5"
                        role="status"
                      >
                        <RiCheckFill
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 text-nexus-emerald"
                        />
                        <span>{addPlayerMessage}</span>
                      </p>
                    ) : null}
                    {roster.length === 0 ? (
                      <div className="dashboard-roster-empty">
                        <RiTeamFill size={28} aria-hidden="true" />
                        <p>Your team roster is empty.</p>
                      </div>
                    ) : (
                      <div className="dashboard-roster-grid">
                        {roster.map((player) => (
                          <article
                            key={player.id}
                            className={`dashboard-roster-card ${
                              player.is_captain ? "is-captain" : ""
                            } ${player.user_id ? "is-linked" : "is-unlinked"}`}
                          >
                            <div className="dashboard-roster-avatar">
                              {player.user?.avatar ? (
                                <Image
                                  src={player.user.avatar}
                                  alt=""
                                  width={54}
                                  height={54}
                                  unoptimized
                                />
                              ) : (
                                <span>{player.tag.slice(0, 1).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="dashboard-roster-identity">
                              {editingPlayerId === player.id ? (
                                <>
                                  <label
                                    className="sr-only"
                                    htmlFor={`dashboard-roster-tag-${player.id}`}
                                  >
                                    Player tag
                                  </label>
                                  <input
                                    id={`dashboard-roster-tag-${player.id}`}
                                    className="dashboard-roster-tag-input"
                                    type="text"
                                    maxLength={50}
                                    value={editingPlayerTag}
                                    onChange={(event) =>
                                      setEditingPlayerTag(event.target.value)
                                    }
                                    disabled={savingPlayerTagId === player.id}
                                    autoFocus
                                    required
                                  />
                                </>
                              ) : (
                                <strong>{player.tag}</strong>
                              )}
                              {formatRosterDisplayName(player.user) ? (
                                <span>{formatRosterDisplayName(player.user)}</span>
                              ) : null}
                              <span
                                className={`dashboard-roster-link-status ${
                                  player.user_id ? "is-linked" : "is-unlinked"
                                }`}
                              >
                                <RiLink size={13} aria-hidden="true" />
                                {player.user_id
                                  ? "Account linked"
                                  : "Account not linked"}
                              </span>
                            </div>
                            <div className="dashboard-roster-role">
                              {player.is_captain ? (
                                <span>
                                  <RiShieldCheckFill size={15} /> Captain
                                </span>
                              ) : (
                                <span>Player</span>
                              )}
                              <div className="dashboard-roster-actions">
                                {editingPlayerId === player.id ? (
                                  <>
                                    <button
                                      type="button"
                                      className="dashboard-roster-save"
                                      disabled={
                                        savingPlayerTagId === player.id ||
                                        !editingPlayerTag.trim()
                                      }
                                      onClick={() =>
                                        void handlePlayerTagUpdate(player)
                                      }
                                    >
                                      {savingPlayerTagId === player.id
                                        ? "Saving…"
                                        : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      className="dashboard-roster-cancel"
                                      onClick={handleEditPlayerTagCancel}
                                      disabled={savingPlayerTagId === player.id}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {player.user_id ? (
                                      <button
                                        type="button"
                                        disabled={
                                          captainActionId === player.id ||
                                          removingPlayerId === player.id
                                        }
                                        onClick={() =>
                                          void handleCaptainToggle(player)
                                        }
                                      >
                                        {captainActionId === player.id
                                          ? "Saving…"
                                          : player.is_captain
                                          ? "Remove captain"
                                          : "Make captain"}
                                      </button>
                                    ) : (
                                      <InvitePlayerAction
                                        playerId={player.id}
                                        playerTag={player.tag}
                                        compact
                                      />
                                    )}
                                    <button
                                      type="button"
                                      className="dashboard-roster-edit"
                                      disabled={
                                        removingPlayerId === player.id ||
                                        captainActionId === player.id
                                      }
                                      onClick={() =>
                                        handleEditPlayerTagStart(player)
                                      }
                                    >
                                      <RiEditBoxFill
                                        size={14}
                                        aria-hidden="true"
                                      />
                                      Edit tag
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  className="dashboard-roster-remove"
                                  disabled={
                                    removingPlayerId === player.id ||
                                    captainActionId === player.id ||
                                    savingPlayerTagId === player.id
                                  }
                                  onClick={() =>
                                    void handleRemovePlayer(player)
                                  }
                                  aria-label={
                                    removingPlayerId === player.id
                                      ? `Removing ${player.tag}…`
                                      : `Remove ${player.tag}`
                                  }
                                  title={
                                    removingPlayerId === player.id
                                      ? `Removing ${player.tag}…`
                                      : `Remove ${player.tag}`
                                  }
                                >
                                  <RiDeleteBinFill
                                    size={15}
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })() : null}
          </main>

          <aside className="dashboard-profile-card">
            <div className="dashboard-profile-header">
              <div className="dashboard-profile-overline">
                <RiUserFill size={14} aria-hidden="true" /> Profile
              </div>
              {!isEditingProfile ? (
                <button
                  type="button"
                  className="dashboard-tag-edit-btn"
                  aria-label="Edit profile"
                  onClick={() => setIsEditingProfile(true)}
                >
                  <RiEditBoxFill aria-hidden="true" size={14} />
                  <span>Edit</span>
                </button>
              ) : null}
            </div>
            <div className="dashboard-name-row">
              <h2 className="dashboard-profile-name">
                {profile?.tag ?? "No Tag"}
              </h2>
            </div>
            <div className="dashboard-avatar-wrap">
              <div className="dashboard-avatar-frame">
                {avatarPreviewUrl ? (
                  <Image
                    src={avatarPreviewUrl}
                    alt="Avatar preview"
                    width={144}
                    height={144}
                    unoptimized
                  />
                ) : existingAvatar ? (
                  <Image
                    src={existingAvatar}
                    alt="User avatar"
                    width={144}
                    height={144}
                    unoptimized
                  />
                ) : (
                  <div className="dashboard-avatar-fallback">No Avatar</div>
                )}
                <button
                  type="button"
                  className="dashboard-avatar-edit-btn"
                  aria-label="Edit avatar"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <RiPencilFill
                    aria-hidden="true"
                    className="dashboard-avatar-edit-icon"
                  />
                </button>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => void handleAvatarChange(event)}
            />
            {isSavingProfile ? (
              <p className="muted">Saving profile updates...</p>
            ) : null}
            {isEditingProfile ? (
              <form
                className="dashboard-profile-edit-form"
                onSubmit={(event) => void handleProfileUpdate(event)}
              >
                <div className="dashboard-profile-edit-grid">
                  <label>
                    <span>
                      First name <b>*</b>
                    </span>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                      autoComplete="given-name"
                      required
                    />
                  </label>
                  <label>
                    <span>
                      Last name <b>*</b>
                    </span>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                      autoComplete="family-name"
                      required
                    />
                  </label>
                </div>

                <div className="dashboard-profile-edit-grid">
                  <label>
                    <span>
                      Player tag <b>*</b>
                    </span>
                    <input
                      type="text"
                      value={profileForm.tag}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          tag: event.target.value,
                        }))
                      }
                      autoComplete="nickname"
                      required
                    />
                  </label>
                  <label>
                    <span>
                      League role <b>*</b>
                    </span>
                    <select
                      value={profileForm.role}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          role: event.target.value as UserProfileRow["role"],
                        }))
                      }
                      required
                    >
                      <option value="player">Player</option>
                      <option value="director">Director</option>
                      {isPaidDirectorRole(profile?.role) ? (
                        <option value={profile.role}>Paid Director</option>
                      ) : null}
                      {profile?.role === "mod" ? (
                        <option value="mod">Mod</option>
                      ) : null}
                    </select>
                  </label>
                </div>

                <div className="dashboard-profile-group">
                  <span className="dashboard-profile-group-title">Social Connections</span>
                  <div className="dashboard-profile-edit-grid">
                    <label>
                      <span className="flex items-center gap-1.5">
                        <RiTwitterXFill size={13} className="text-gray-400" aria-hidden="true" /> X / Twitter
                      </span>
                      <input
                        type="text"
                        value={profileForm.xHandle}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            xHandle: event.target.value,
                          }))
                        }
                        placeholder="@yourhandle"
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      <span className="flex items-center gap-1.5">
                        <RiDiscordFill size={13} className="text-gray-400" aria-hidden="true" /> Discord
                      </span>
                      <input
                        type="text"
                        value={profileForm.discordHandle}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            discordHandle: event.target.value,
                          }))
                        }
                        placeholder="Discord handle"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                </div>

                <div className="dashboard-name-actions">
                  <button
                    type="submit"
                    className="dashboard-inline-action dashboard-inline-action-primary"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Saving…" : "Save profile"}
                  </button>
                  <button
                    type="button"
                    className="dashboard-inline-action"
                    onClick={handleProfileEditCancel}
                    disabled={isSavingProfile}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="dashboard-profile-details">
                <div className="dashboard-profile-grid-2col">
                  <div className="dashboard-profile-tile">
                    <span>Name</span>
                    <strong>
                      {`${profile?.first_name ?? ""} ${
                        profile?.last_name ?? ""
                      }`.trim() || "None"}
                    </strong>
                  </div>
                  <div className="dashboard-profile-tile">
                    <span>League role</span>
                    <strong>{profile?.role ?? "Player"}</strong>
                  </div>
                </div>

                <div className="dashboard-profile-tile dashboard-school-tile">
                  <span>School</span>
                  {team ? (
                    <Link
                      href={`/stats/teams/${encodeURIComponent(
                        (team.short_name || team.name).toLowerCase()
                      )}`}
                      className="dashboard-school-info dashboard-team-link"
                      title={`View ${team.name} stats`}
                    >
                      {team.avatar ? (
                        <img
                          src={team.avatar}
                          alt={team.name}
                          className="dashboard-school-logo"
                        />
                      ) : null}
                      <div className="dashboard-school-text">
                        <strong>
                          {team.short_name ?? team.name}
                        </strong>
                        {team.short_name && team.name ? (
                          <small>{team.name}</small>
                        ) : null}
                      </div>
                    </Link>
                  ) : canRegisterSchool ? (
                    <Link
                      className="dashboard-inline-action dashboard-inline-action-primary no-underline mt-1 inline-flex items-center justify-center"
                      href="/school-registration"
                    >
                      Register School
                    </Link>
                  ) : profile?.role === "player" ? (
                    <strong>Invite needed</strong>
                  ) : (
                    <strong>None</strong>
                  )}
                </div>

                <div className="dashboard-profile-grid-2col">
                  <div className="dashboard-profile-tile">
                    <span>Main</span>
                    <strong>{mainCharacter}</strong>
                  </div>
                  <div className="dashboard-profile-tile">
                    <span>Secondary</span>
                    <strong>{secondaryCharacter}</strong>
                  </div>
                </div>

                <div className="dashboard-profile-group">
                  <span className="dashboard-profile-group-title">Social Accounts</span>
                  <div className="dashboard-social-list">
                    <div className={`dashboard-social-chip x-chip ${profile?.x_handle ? "is-connected" : ""}`}>
                      <RiTwitterXFill className="dashboard-social-icon" aria-hidden="true" />
                      <div className="dashboard-social-info">
                        <small>X / Twitter</small>
                        {profile?.x_handle ? (
                          <a
                            href={`https://x.com/${profile.x_handle.replace(/^@/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dashboard-social-link"
                          >
                            @{profile.x_handle.replace(/^@/, '')}
                          </a>
                        ) : (
                          <span className="unconnected">Not linked</span>
                        )}
                      </div>
                    </div>

                    <div className={`dashboard-social-chip discord-chip ${profile?.discord_handle ? "is-connected" : ""}`}>
                      <RiDiscordFill className="dashboard-social-icon" aria-hidden="true" />
                      <div className="dashboard-social-info">
                        <small>Discord</small>
                        {profile?.discord_handle ? (
                          <strong className="truncate">{profile.discord_handle}</strong>
                        ) : (
                          <span className="unconnected">Not linked</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {errorMessage ? (
              <p className="status-text status-error">{errorMessage}</p>
            ) : null}
          </aside>
        </div>
      </section>
      {isEnrollmentOpen ? (
        <div
          className="dashboard-checkout-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-contact-title"
        >
          <div
            className="dashboard-checkout-backdrop"
            onClick={closeEnrollmentContact}
            aria-hidden="true"
          />
          <section className="dashboard-checkout-dialog">
            <header className="dashboard-checkout-header">
              <div>
                <span>Contact The Nexus</span>
                <h2 id="dashboard-contact-title">Enrollment contact</h2>
              </div>
              <button
                type="button"
                onClick={closeEnrollmentContact}
                aria-label="Close contact details"
              >
                <RiCloseFill aria-hidden="true" />
              </button>
            </header>
            <div className="dashboard-checkout-body">
              <div className="dashboard-checkout-config">
                <RiMailFill aria-hidden="true" />
                <h3>
                  {DIRECTOR_TIERS.find(
                    (tier) => tier.id === selectedEnrollmentTier
                  )?.name ?? "Enrollment"}{" "}
                  plan
                </h3>
                <p>
                  Email Buddwaur to coordinate the right enrollment path for
                  your school while the Nexus payment process is finalized.
                </p>
                <a
                  className="btn btn-primary"
                  href={`mailto:buddwaur@thenexus.gg?subject=${encodeURIComponent(
                    `${
                      DIRECTOR_TIERS.find(
                        (tier) => tier.id === selectedEnrollmentTier
                      )?.name ?? "Enrollment"
                    } plan inquiry`
                  )}`}
                >
                  Email buddwaur@thenexus.gg
                </a>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
