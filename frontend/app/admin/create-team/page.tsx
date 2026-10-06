"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { InvitePlayerAction } from "@/app/components/invite-player-action";

import { isDirectorRole, type UserRole } from "@/lib/roles";

type SelectableUser = {
  id: string;
  tag: string | null;
  first_name: string;
  last_name: string;
  role: UserRole;
};

type PlayerRecord = {
  id: string;
  user_id: string | null;
  team_id: string | null;
  tag: string;
  team?: { name: string; short_name: string } | null;
};

type LinkableTeam = {
  id: string;
  name: string;
  short_name: string;
  avatar: string | null;
};

const normalize = (value: string) => value.trim().toLowerCase();
const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });

const getDisplayLabel = (user: SelectableUser) => {
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  return user.tag?.trim() ? `${user.tag} (${fullName})` : fullName;
};

const matchAndRankUsers = (users: SelectableUser[], query: string) => {
  const normalizedQuery = normalize(query);

  const scored = users
    .map((user) => {
      const tag = normalize(user.tag ?? "");
      const name = normalize(`${user.first_name} ${user.last_name}`);

      if (!normalizedQuery) {
        return { user, rank: tag ? 0 : 1 };
      }

      const tagStarts = tag.startsWith(normalizedQuery);
      const tagHas = tag.includes(normalizedQuery);
      const nameStarts = name.startsWith(normalizedQuery);
      const nameHas = name.includes(normalizedQuery);

      if (!tagStarts && !tagHas && !nameStarts && !nameHas) return null;

      const rank = tagStarts ? 0 : tagHas ? 1 : nameStarts ? 2 : 3;
      return { user, rank };
    })
    .filter((entry): entry is { user: SelectableUser; rank: number } =>
      Boolean(entry),
    );

  return scored
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const aTag = normalize(a.user.tag ?? "");
      const bTag = normalize(b.user.tag ?? "");
      if (aTag && bTag) return aTag.localeCompare(bTag);
      return getDisplayLabel(a.user).localeCompare(getDisplayLabel(b.user));
    })
    .map((entry) => entry.user);
};

export function CreateTeamPageContent({
  directorRegistrationOnly = false,
}: {
  directorRegistrationOnly?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editTeamId = searchParams.get("edit");
  const returnTo = searchParams.get("returnTo") ?? (directorRegistrationOnly ? "/dashboard" : null);
  const isDirectorRegistration =
    directorRegistrationOnly || searchParams.get("mode") === "register-school";
  const isEditing = Boolean(editTeamId);
  const supabase = getSupabaseClient();

  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [playerRecords, setPlayerRecords] = useState<PlayerRecord[]>([]);
  const [linkableTeams, setLinkableTeams] = useState<LinkableTeam[]>([]);
  const [directorRegistrationAction, setDirectorRegistrationAction] = useState<
    "register" | "link"
  >("register");
  const [selectedLinkTeamId, setSelectedLinkTeamId] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [schoolSiteUrl, setSchoolSiteUrl] = useState("");
  const [directorUserId, setDirectorUserId] = useState("");
  const [selectedPlayerUserIds, setSelectedPlayerUserIds] = useState<string[]>(
    [],
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [newPlayerTag, setNewPlayerTag] = useState("");
  const [newPlayerTags, setNewPlayerTags] = useState<string[]>([]);
  const [existingAvatar, setExistingAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [directorQuery, setDirectorQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [isDirectorOpen, setIsDirectorOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLoadingExistingTeam, setIsLoadingExistingTeam] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const bootstrap = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/signup");
        return;
      }

      const { data: profile, error: roleError } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: UserRole }>();

      if (!mounted) return;
      if (
        roleError ||
        !profile ||
        (profile.role !== "mod" &&
          !(isDirectorRegistration && isDirectorRole(profile.role)))
      ) {
        router.replace("/dashboard");
        return;
      }

      setCurrentUserId(session.user.id);
      if (isDirectorRegistration) {
        setDirectorUserId(session.user.id);
      }
      setIsAuthorized(true);

      const [
        { data: userRows, error: userError },
        { data: playerRows, error: playerError },
        { data: teamRows, error: teamError },
      ] = await Promise.all([
        supabase
          .from("users")
          .select("id,tag,first_name,last_name,role")
          .in("role", ["director", "member_director", "pro_director", "exclusive_director", "player"])
          .order("tag", { ascending: true, nullsFirst: false }),
        supabase
          .from("players")
          .select(
            "id,user_id,team_id,tag,team:teams!players_team_id_fkey(name,short_name)",
          )
          .order("tag", { ascending: true }),
        supabase
          .from("teams")
          .select("id,name,short_name,avatar")
          .is("director_user_id", null)
          .order("name", { ascending: true }),
      ]);

      if (!mounted) return;
      if (userError || playerError || teamError) {
        setError(
          userError?.message ??
            playerError?.message ??
            teamError?.message ??
            "Unable to load team data.",
        );
      } else {
        setUsers((userRows as SelectableUser[]) ?? []);
        setPlayerRecords((playerRows as unknown as PlayerRecord[]) ?? []);
        setLinkableTeams((teamRows as LinkableTeam[]) ?? []);
      }

      setIsChecking(false);
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [isDirectorRegistration, router, supabase]);

  useEffect(() => {
    if (!supabase || !editTeamId) return;
    let mounted = true;
    const loadTeam = async () => {
      const [
        { data, error: teamError },
        { data: rosterRows, error: rosterError },
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("name,short_name,avatar,school_site_url,director_user_id,player_user_ids")
          .eq("id", editTeamId)
          .maybeSingle(),
        supabase.from("players").select("id,user_id").eq("team_id", editTeamId),
      ]);
      if (!mounted) return;
      if (teamError || rosterError || !data) {
        setError(
          teamError?.message ??
            rosterError?.message ??
            "The selected team could not be found.",
        );
        setIsLoadingExistingTeam(false);
        return;
      }
      const team = data as {
        name: string;
        short_name: string;
        avatar: string | null;
        school_site_url: string | null;
        director_user_id: string | null;
        player_user_ids: string[] | null;
      };
      setName(team.name ?? "");
      setShortName(team.short_name ?? "");
      setExistingAvatar(team.avatar ?? null);
      setSchoolSiteUrl(team.school_site_url ?? "");
      setDirectorUserId(team.director_user_id ?? "");
      const roster =
        (rosterRows as Array<{ id: string; user_id: string | null }> | null) ??
        [];
      setSelectedPlayerIds(roster.map((player) => player.id));
      setSelectedPlayerUserIds(
        Array.from(
          new Set([
            ...(team.player_user_ids ?? []),
            ...roster.flatMap((player) =>
              player.user_id ? [player.user_id] : [],
            ),
          ]),
        ),
      );
      setIsLoadingExistingTeam(false);
    };
    void loadTeam();
    return () => {
      mounted = false;
    };
  }, [editTeamId, supabase]);

  useEffect(
    () => () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    },
    [avatarPreviewUrl],
  );
  const directors = useMemo(
    () => users.filter((user) => isDirectorRole(user.role)),
    [users],
  );
  const players = useMemo(
    () => users.filter((user) => user.role === "player"),
    [users],
  );

  const filteredDirectors = useMemo(
    () => matchAndRankUsers(directors, directorQuery),
    [directors, directorQuery],
  );
  const filteredPlayers = useMemo(
    () => matchAndRankUsers(players, playerQuery),
    [players, playerQuery],
  );
  const filteredPlayerRecords = useMemo(() => {
    const query = normalize(playerQuery);
    return playerRecords.filter(
      (player) => !query || normalize(player.tag).includes(query),
    );
  }, [playerQuery, playerRecords]);

  const selectedDirector = directors.find(
    (director) => director.id === directorUserId,
  );
  const filteredLinkableTeams = useMemo(() => {
    const query = normalize(teamQuery);
    return linkableTeams.filter((team) => {
      if (!query) return true;
      return (
        normalize(team.name).includes(query) ||
        normalize(team.short_name).includes(query)
      );
    });
  }, [linkableTeams, teamQuery]);
  const selectedLinkTeam = linkableTeams.find(
    (team) => team.id === selectedLinkTeamId,
  );

  const togglePlayerUser = (userId: string) => {
    setSelectedPlayerUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const togglePlayerRecord = (player: PlayerRecord) => {
    setSelectedPlayerIds((previous) =>
      previous.includes(player.id)
        ? previous.filter((id) => id !== player.id)
        : [...previous, player.id],
    );
    if (player.user_id) {
      setSelectedPlayerUserIds((previous) =>
        previous.includes(player.user_id as string)
          ? previous.filter((id) => id !== player.user_id)
          : [...previous, player.user_id as string],
      );
    }
  };

  const addNewPlayer = () => {
    const tag = newPlayerTag.trim();
    if (!tag) return;
    const rosterTags = [
      ...playerRecords
        .filter((player) => selectedPlayerIds.includes(player.id))
        .map((player) => player.tag),
      ...newPlayerTags,
    ];
    if (
      rosterTags.some(
        (existingTag) => normalize(existingTag) === normalize(tag),
      )
    ) {
      setError(`A player named ${tag} is already selected for this roster.`);
      return;
    }
    setNewPlayerTags((previous) => [...previous, tag]);
    setNewPlayerTag("");
    setError(null);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setAvatarFile(selectedFile);
    setAvatarZoom(1);
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
    }
    if (selectedFile) {
      setAvatarPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (isDirectorRegistration && directorRegistrationAction === "link") {
      if (!selectedLinkTeamId) {
        setError("Choose an unlinked school before continuing.");
        setSubmitting(false);
        return;
      }

      const { error: linkError } = await supabase
        .from("teams" as never)
        .update({ director_user_id: currentUserId } as never)
        .eq("id", selectedLinkTeamId)
        .is("director_user_id", null);

      if (linkError) {
        setError(linkError.message);
        setSubmitting(false);
        return;
      }

      setSuccess("School linked successfully.");
      if (returnTo) {
        router.replace(returnTo);
        return;
      }
      setSelectedLinkTeamId("");
      setTeamQuery("");
      setIsTeamOpen(false);
      setSubmitting(false);
      return;
    }

    let nextAvatar = existingAvatar;

    if (avatarFile) {
      try {
        nextAvatar = await fileToDataUrl(avatarFile);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Unable to upload avatar.",
        );
        setSubmitting(false);
        return;
      }
    }

    const normalizedShortName = shortName.trim().toUpperCase();

    const payload = {
      name: name.trim(),
      short_name: normalizedShortName,
      avatar: nextAvatar,
      school_site_url: schoolSiteUrl.trim() || null,
      director_user_id: isDirectorRegistration
        ? currentUserId
        : directorUserId || null,
      player_user_ids: selectedPlayerUserIds,
    };

    let savedTeamId = editTeamId;
    if (isEditing) {
      const { error: saveError } = await supabase
        .from("teams" as never)
        .update(payload as never)
        .eq("id", editTeamId as string);
      if (saveError) {
        setError(saveError.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { data: createdTeam, error: saveError } = await supabase
        .from("teams" as never)
        .insert(payload as never)
        .select("id")
        .single<{ id: string }>();
      if (saveError || !createdTeam) {
        setError(saveError?.message ?? "Unable to create team.");
        setSubmitting(false);
        return;
      }
      savedTeamId = createdTeam.id;
    }

    if (!isDirectorRegistration && savedTeamId) {
      const { error: rosterError } = await supabase.rpc(
        "update_team_roster" as never,
        {
          target_team_id: savedTeamId,
          selected_player_ids: selectedPlayerIds,
          selected_user_ids: selectedPlayerUserIds,
          new_player_tags: newPlayerTags,
        } as never,
      );
      if (rosterError) {
        setError(
          `The team details were saved, but the roster could not be updated: ${rosterError.message}`,
        );
        setSubmitting(false);
        return;
      }
    }

    setSuccess(
      isEditing
        ? "Team and roster updated successfully."
        : isDirectorRegistration
          ? "School registered successfully."
          : "Team and roster created successfully.",
    );
    if (isDirectorRegistration && returnTo) {
      router.replace(returnTo);
      return;
    }
    setName("");
    setShortName("");
    setSchoolSiteUrl("");
    setDirectorUserId(isDirectorRegistration ? currentUserId : "");
    setSelectedPlayerUserIds([]);
    setSelectedPlayerIds([]);
    setNewPlayerTag("");
    setNewPlayerTags([]);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setAvatarZoom(1);
    if (!isEditing) setExistingAvatar(null);
    setDirectorQuery("");
    setPlayerQuery("");
    setIsDirectorOpen(false);
    setIsPlayerOpen(false);
    setSubmitting(false);
  };

  if (isChecking)
    return (
      <section className="auth-shell admin-portal-shell">
        <article className="login-modal card">
          <p className="muted">Checking admin access...</p>
        </article>
      </section>
    );
  if (!isAuthorized) return null;

  return (
    <section
      className={`auth-shell admin-portal-shell ${
        isDirectorRegistration ? "school-registration-shell" : ""
      }`}
      style={{
        alignItems: "flex-start",
        paddingTop: "4rem",
        paddingBottom: "4rem",
      }}
    >
      <article
        className={isDirectorRegistration ? "school-registration-card" : "card"}
        style={{
          width: isDirectorRegistration ? undefined : "min(720px, 100%)",
          padding: isDirectorRegistration ? undefined : "2rem",
          borderRadius: isDirectorRegistration ? undefined : "1.25rem",
        }}
      >
        <header className={isDirectorRegistration ? "school-registration-hero" : undefined} style={{ marginBottom: "1.5rem" }}>
          <p
            className={isDirectorRegistration ? "school-registration-eyebrow" : "muted"}
            style={isDirectorRegistration ? undefined : {
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              fontSize: "0.8rem",
            }}
          >
            {isDirectorRegistration
              ? "Director Portal · School Registration"
              : "Admin Portal · Teams"}
          </p>
          <h1 style={{ marginBottom: "0.5rem" }}>
            {isEditing
              ? "Update Team"
              : isDirectorRegistration
                ? "Launch Your School"
                : "Create Team"}
          </h1>
          <p className="muted">
            {isEditing
              ? "Update an existing team and adjust director/player attachments."
              : isDirectorRegistration
                ? "Create a polished school profile or claim an existing unlinked school so your players have a trusted roster home inside The Nexus."
                : "Create a new team with optional director/player attachments."}
          </p>
        </header>

        {isDirectorRegistration ? (
          <div
            className="team-registration-mode-switch"
            role="tablist"
            aria-label="School registration options"
          >
            <button
              type="button"
              className={`btn ${directorRegistrationAction === "register" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setDirectorRegistrationAction("register")}
            >
              Register School
            </button>
            <button
              type="button"
              className={`btn ${directorRegistrationAction === "link" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setDirectorRegistrationAction("link")}
            >
              Link School
            </button>
          </div>
        ) : null}

        {isDirectorRegistration ? (
          <div className="school-registration-steps" aria-label="Registration checklist">
            <div><span>1</span><strong>Identify</strong><small>Confirm your school name and competitive tag.</small></div>
            <div><span>2</span><strong>Brand</strong><small>Add a crest or logo for match cards and rosters.</small></div>
            <div><span>3</span><strong>Roster</strong><small>Return to your dashboard to invite and promote players.</small></div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className={isDirectorRegistration ? "school-registration-form" : "flex flex-col gap-4"}>
          {isDirectorRegistration && directorRegistrationAction === "link" ? (
            <div className="field-label" style={{ position: "relative" }}>
              <span>Link School *</span>
              <input
                value={teamQuery}
                onChange={(event) => {
                  setTeamQuery(event.target.value);
                  setIsTeamOpen(true);
                  setSelectedLinkTeamId("");
                }}
                onFocus={() => setIsTeamOpen(true)}
                placeholder={
                  selectedLinkTeam
                    ? `${selectedLinkTeam.name} (${selectedLinkTeam.short_name})`
                    : "Search schools without a linked director"
                }
                required={!selectedLinkTeamId}
              />
              {isTeamOpen ? (
                <div
                  className="card"
                  style={{
                    marginTop: "0.5rem",
                    maxHeight: "220px",
                    overflowY: "auto",
                    padding: "0.5rem",
                  }}
                >
                  {filteredLinkableTeams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className="w-full text-left p-2 text-sm"
                      onClick={() => {
                        setSelectedLinkTeamId(team.id);
                        setTeamQuery("");
                        setIsTeamOpen(false);
                      }}
                    >
                      <strong>{team.name}</strong>{" "}
                      <span className="muted">({team.short_name})</span>
                    </button>
                  ))}
                  {filteredLinkableTeams.length === 0 ? (
                    <p className="p-2 text-sm muted">
                      No unlinked schools match your search.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {selectedLinkTeam ? (
                <p className="text-sm text-emerald-300">
                  Ready to link {selectedLinkTeam.name} to your director
                  account.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <label className="field-label">
                {isDirectorRegistration ? "School / Team Name *" : "Team Name *"}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder={isDirectorRegistration ? "Example: East Ridge Esports" : "Example: Obsidian Wolves"}
                />
              </label>

              <label className="field-label">
                {isDirectorRegistration ? "School Code *" : "Team Short Name *"}
                <input
                  value={shortName}
                  onChange={(event) =>
                    setShortName(event.target.value.slice(0, 8))
                  }
                  required
                  placeholder={isDirectorRegistration ? "Example: ERG" : "Example: OW"}
                  maxLength={8}
                />
              </label>

              <label className="field-label">
                School Team Site (optional)
                <input
                  type="url"
                  inputMode="url"
                  pattern="https?://.*"
                  value={schoolSiteUrl}
                  onChange={(event) => setSchoolSiteUrl(event.target.value)}
                  placeholder="https://school.edu/esports"
                />
              </label>

              <label className="field-label">
                {isDirectorRegistration ? "School Logo" : "Team Avatar (logo)"}
                <input
                  type="file"
                  accept="image/*"
                  aria-describedby="team-logo-branding-guidelines"
                  onChange={handleAvatarChange}
                />
              </label>
              <aside
                id="team-logo-branding-guidelines"
                className="team-logo-branding-guidelines"
                aria-labelledby="team-logo-branding-guidelines-title"
              >
                <div>
                  <span className="team-logo-branding-guidelines-mark" aria-hidden="true">
                    i
                  </span>
                  <div>
                    <strong id="team-logo-branding-guidelines-title">
                      Logo guidelines
                    </strong>
                    <p>For the best display across match cards and rosters:</p>
                  </div>
                </div>
                <ul>
                  <li>Use a transparent background</li>
                  <li>Prefer a square logo</li>
                  <li>SVG preferred; PNG or WebP also works</li>
                </ul>
              </aside>
              {avatarPreviewUrl || existingAvatar ? (
                <div className="onboarding-avatar-preview team-avatar-preview">
                  <div className="team-avatar-preview-frame">
                    <Image
                      src={
                        avatarPreviewUrl ??
                        existingAvatar ??
                        "/logos/Primary/PNG/Nexus White Small.png"
                      }
                      alt="Team avatar preview"
                      width={86}
                      height={86}
                      unoptimized
                      style={{ transform: `scale(${avatarZoom})` }}
                    />
                  </div>
                  <div className="team-avatar-preview-controls">
                    <p className="text-xs text-white/65">
                      Preview of the team logo used for this team avatar.
                    </p>
                    <label className="field-label team-avatar-zoom-control">
                      Avatar Zoom ({Math.round(avatarZoom * 100)}%)
                      <input
                        type="range"
                        min="0.6"
                        max="2"
                        step="0.05"
                        value={avatarZoom}
                        onChange={(event) =>
                          setAvatarZoom(Number(event.target.value))
                        }
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {!isDirectorRegistration ? (
                <div className="field-label" style={{ position: "relative" }}>
                  <span>Director (optional)</span>
                  <input
                    value={directorQuery}
                    onChange={(event) => {
                      setDirectorQuery(event.target.value);
                      setIsDirectorOpen(true);
                    }}
                    onFocus={() => setIsDirectorOpen(true)}
                    placeholder={
                      selectedDirector
                        ? getDisplayLabel(selectedDirector)
                        : "Type name or tag to find a director"
                    }
                  />
                  {isDirectorOpen && (
                    <div
                      className="card"
                      style={{
                        marginTop: "0.5rem",
                        maxHeight: "220px",
                        overflowY: "auto",
                        padding: "0.5rem",
                      }}
                    >
                      <button
                        type="button"
                        className="w-full text-left p-2 text-sm"
                        onClick={() => {
                          setDirectorUserId("");
                          setDirectorQuery("");
                          setIsDirectorOpen(false);
                        }}
                      >
                        No director attached
                      </button>
                      {filteredDirectors.map((director) => (
                        <button
                          key={director.id}
                          type="button"
                          className="w-full text-left p-2 text-sm"
                          onClick={() => {
                            setDirectorUserId(director.id);
                            setDirectorQuery("");
                            setIsDirectorOpen(false);
                          }}
                        >
                          {getDisplayLabel(director)}
                        </button>
                      ))}
                      {filteredDirectors.length === 0 && (
                        <p className="p-2 text-sm muted">
                          No matching directors.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {!isDirectorRegistration ? (
                <div className="team-roster-editor">
                  <div>
                    <span className="field-label">Team roster</span>
                    <p className="muted text-sm">
                      Select existing player records, attach player accounts, or
                      create a new player entry. Players removed here become
                      free agents and can be assigned to another team later.
                    </p>
                  </div>

                  <div className="team-roster-selected">
                    {playerRecords
                      .filter((player) => selectedPlayerIds.includes(player.id))
                      .map((player) => (
                        <div key={player.id} className="team-roster-chip-wrap">
                          <button
                            type="button"
                            className="team-roster-chip"
                            onClick={() => togglePlayerRecord(player)}
                            title="Remove from roster"
                          >
                            <span>{player.tag}</span>
                            <small>
                              {player.team_id && player.team_id !== editTeamId
                                ? `Moving from ${player.team?.short_name ?? "another team"}`
                                : "Player entry"}
                            </small>{" "}
                            ×
                          </button>
                          {isEditing &&
                          player.team_id === editTeamId &&
                          !player.user_id ? (
                            <InvitePlayerAction
                              playerId={player.id}
                              playerTag={player.tag}
                              compact
                            />
                          ) : null}
                        </div>
                      ))}
                    {newPlayerTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="team-roster-chip is-new"
                        onClick={() =>
                          setNewPlayerTags((previous) =>
                            previous.filter((entry) => entry !== tag),
                          )
                        }
                        title="Remove new player"
                      >
                        <span>{tag}</span>
                        <small>New player</small> ×
                      </button>
                    ))}
                    {selectedPlayerIds.length === 0 &&
                    newPlayerTags.length === 0 ? (
                      <p className="muted text-sm">
                        No player records selected yet.
                      </p>
                    ) : null}
                  </div>

                  <div className="team-roster-add-row">
                    <label className="field-label">
                      Add a new player entry
                      <input
                        value={newPlayerTag}
                        onChange={(event) =>
                          setNewPlayerTag(event.target.value)
                        }
                        placeholder="Player tag"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addNewPlayer();
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addNewPlayer}
                      disabled={!newPlayerTag.trim()}
                    >
                      Add player
                    </button>
                  </div>

                  <div className="field-label" style={{ position: "relative" }}>
                    <span>Find existing players</span>
                    <input
                      value={playerQuery}
                      onChange={(event) => {
                        setPlayerQuery(event.target.value);
                        setIsPlayerOpen(true);
                      }}
                      onFocus={() => setIsPlayerOpen(true)}
                      placeholder="Search player records or account names"
                    />
                    {isPlayerOpen && (
                      <div className="card team-roster-results">
                        <p className="team-roster-results-heading">
                          Player records
                        </p>
                        {filteredPlayerRecords.map((player) => (
                          <label key={player.id} className="team-roster-result">
                            <input
                              type="checkbox"
                              checked={selectedPlayerIds.includes(player.id)}
                              onChange={() => togglePlayerRecord(player)}
                            />
                            <span>
                              <strong>{player.tag}</strong>
                              <small>
                                {player.team_id
                                  ? (player.team?.name ?? "Assigned team")
                                  : "Free agent"}
                              </small>
                            </span>
                          </label>
                        ))}
                        {filteredPlayerRecords.length === 0 && (
                          <p className="p-2 text-sm muted">
                            No matching player records.
                          </p>
                        )}

                        <p className="team-roster-results-heading">
                          Player accounts without a selected entry
                        </p>
                        {filteredPlayers
                          .filter(
                            (player) =>
                              !playerRecords.some(
                                (record) =>
                                  record.user_id === player.id &&
                                  selectedPlayerIds.includes(record.id),
                              ),
                          )
                          .map((player) => (
                            <label
                              key={player.id}
                              className="team-roster-result"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPlayerUserIds.includes(
                                  player.id,
                                )}
                                onChange={() => togglePlayerUser(player.id)}
                              />
                              <span>
                                <strong>{getDisplayLabel(player)}</strong>
                                <small>
                                  Creates or moves their player entry
                                </small>
                              </span>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-base-content/70">
                    {selectedPlayerIds.length + newPlayerTags.length} player
                    record(s) selected, plus{" "}
                    {
                      selectedPlayerUserIds.filter(
                        (userId) =>
                          !playerRecords.some(
                            (record) =>
                              record.user_id === userId &&
                              selectedPlayerIds.includes(record.id),
                          ),
                      ).length
                    }{" "}
                    account attachment(s).
                  </p>
                </div>
              ) : null}
            </>
          )}

          {isLoadingExistingTeam ? (
            <p className="muted text-sm">Loading existing team details...</p>
          ) : null}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {success && <p className="text-sm text-emerald-300">{success}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || isLoadingExistingTeam}
            style={{ width: isDirectorRegistration ? undefined : "fit-content", minWidth: "170px" }}
          >
            {submitting
              ? isEditing
                ? "Updating team..."
                : isDirectorRegistration &&
                    directorRegistrationAction === "link"
                  ? "Linking school..."
                  : isDirectorRegistration
                    ? "Registering school..."
                    : "Creating team..."
              : isEditing
                ? "Update Team"
                : isDirectorRegistration &&
                    directorRegistrationAction === "link"
                  ? "Link School"
                  : isDirectorRegistration
                    ? "Register School"
                    : "Create Team"}
          </button>
        </form>
      </article>
    </section>
  );
}

export default function CreateTeamPage() {
  return (
    <Suspense
      fallback={
        <section className="auth-shell admin-portal-shell">
          <article className="login-modal card">
            <p className="muted">Loading team editor...</p>
          </article>
        </section>
      }
    >
      <CreateTeamPageContent />
    </Suspense>
  );
}
