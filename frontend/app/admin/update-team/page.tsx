"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type UserRole = "director" | "player" | "mod";
type TeamOption = {
  id: string;
  name: string;
  short_name: string;
  tier: number;
};

const TEAM_TIERS = [
  {
    value: 0,
    name: "Non-member",
    description: "Default access with no active membership benefits.",
  },
  {
    value: 1,
    name: "Base membership",
    description: "Standard team membership level.",
  },
  {
    value: 2,
    name: "Asynchronous support",
    description: "Enhanced membership with asynchronous support.",
  },
  {
    value: 3,
    name: "Synchronous support",
    description: "Top membership level with priority synchronous support.",
  },
] as const;

export default function UpdateTeamPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(Boolean(supabase));
  const [isLoadingTeams, setIsLoadingTeams] = useState(Boolean(supabase));
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedTier, setSelectedTier] = useState(0);
  const [isSavingTier, setIsSavingTier] = useState(false);
  const [tierNotice, setTierNotice] = useState("");
  const [tierError, setTierError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const bootstrap = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return router.replace("/signup");
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", sessionData.session.user.id)
        .maybeSingle<{ role: UserRole }>();
      if (!mounted) return;
      const canAccess = profile?.role === "mod";
      setIsAuthorized(canAccess);
      setIsChecking(false);
      if (!canAccess) router.replace("/dashboard");
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("teams")
        .select("id,name,short_name,tier")
        .order("name", { ascending: true });
      if (!mounted) return;
      setTeams((data as TeamOption[]) ?? []);
      setIsLoadingTeams(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId),
    [teams, selectedTeamId]
  );

  const saveTeamTier = async () => {
    if (!supabase || !selectedTeam) return;
    setIsSavingTier(true);
    setTierNotice("");
    setTierError("");
    const { error } = await supabase
      .from("teams" as never)
      .update({ tier: selectedTier } as never)
      .eq("id", selectedTeam.id);
    setIsSavingTier(false);

    if (error) {
      setTierError(error.message);
      return;
    }

    setTeams((current) =>
      current.map((team) =>
        team.id === selectedTeam.id ? { ...team, tier: selectedTier } : team
      )
    );
    setTierNotice(
      `${selectedTeam.name} is now Tier ${selectedTier} — ${
        TEAM_TIERS.find((tier) => tier.value === selectedTier)?.name ??
        "Custom tier"
      }.`
    );
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
      className="auth-shell admin-portal-shell"
      style={{
        alignItems: "flex-start",
        paddingTop: "4rem",
        paddingBottom: "4rem",
      }}
    >
      <div
        className="card"
        style={{
          width: "min(820px, 100%)",
          padding: "2rem",
          borderRadius: "1.5rem",
        }}
      >
        <header style={{ marginBottom: "1.5rem" }}>
          <p
            className="muted"
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              fontWeight: 700,
              fontSize: "0.78rem",
            }}
          >
            Admin Portal
          </p>
          <h1 style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
            Update Team
          </h1>
          <p className="muted">
            Select an existing team, update its membership tier, or continue to
            the full team editor.
          </p>
        </header>
        <div className="space-y-4">
          <label
            htmlFor="team-select"
            className="text-sm font-semibold text-base-content"
          >
            Existing teams
          </label>
          <select
            id="team-select"
            className="select select-bordered w-full"
            value={selectedTeamId}
            onChange={(event) => {
              const team = teams.find(
                (entry) => entry.id === event.target.value
              );
              setSelectedTeamId(event.target.value);
              setSelectedTier(team?.tier ?? 0);
              setTierNotice("");
              setTierError("");
            }}
            disabled={isLoadingTeams || teams.length === 0}
          >
            <option value="" disabled>
              Select a team
            </option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.short_name}) — Tier {team.tier ?? 0}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedTeam}
            onClick={() =>
              selectedTeam &&
              router.push(`/admin/create-team?edit=${selectedTeam.id}`)
            }
          >
            Continue to editor
          </button>
        </div>
        {selectedTeam ? (
          <section className="team-tier-panel">
            <div className="team-tier-panel__header">
              <div>
                <p className="team-tier-panel__eyebrow">Team role promotion</p>
                <h2>Membership tier</h2>
                <p className="muted">
                  Choose the membership level for {selectedTeam.name}. Changes
                  update the team numeric tier value (0–3).
                </p>
              </div>
              <div
                className="team-tier-panel__current"
                aria-label={`Current tier: ${selectedTeam.tier ?? 0}`}
              >
                Current tier <strong>{selectedTeam.tier ?? 0}</strong>
              </div>
            </div>
            <div
              className="team-tier-options"
              role="radiogroup"
              aria-label="Team membership tier"
            >
              {TEAM_TIERS.map((tier) => {
                const isSelected = selectedTier === tier.value;
                return (
                  <label
                    key={tier.value}
                    className={`team-tier-option${
                      isSelected ? " team-tier-option--selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="team-tier"
                      value={tier.value}
                      checked={isSelected}
                      onChange={() => setSelectedTier(tier.value)}
                    />
                    <span
                      className="team-tier-option__radio"
                      aria-hidden="true"
                    />
                    <span className="team-tier-option__content">
                      <span className="team-tier-option__kicker">
                        Tier {tier.value}
                      </span>
                      <strong>{tier.name}</strong>
                      <span className="muted">{tier.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="team-tier-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  isSavingTier || selectedTier === (selectedTeam.tier ?? 0)
                }
                onClick={() => void saveTeamTier()}
              >
                {isSavingTier ? "Saving tier..." : "Save team tier"}
              </button>
              <span className="muted">Selected: Tier {selectedTier}</span>
            </div>
            {tierNotice ? (
              <p className="team-tier-message team-tier-message--success">
                {tierNotice}
              </p>
            ) : null}
            {tierError ? (
              <p className="team-tier-message team-tier-message--error">
                {tierError}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}
