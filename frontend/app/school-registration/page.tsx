"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  RiSchoolFill,
  RiTeamFill,
  RiImageCircleFill,
  RiGlobalFill,
  RiSearchLine,
  RiArrowRightSFill,
  RiCheckFill,
  RiErrorWarningFill,
  RiDeleteBin7Fill,
  RiShieldCheckFill,
} from "@remixicon/react";
import { getSupabaseClient } from "@/lib/supabase";
import { isDirectorRole, type UserRole } from "@/lib/roles";

type UnlinkedTeam = {
  id: string;
  name: string;
  short_name: string;
  avatar: string | null;
  school_site_url: string | null;
};

type CurrentDirectorProfile = {
  id: string;
  first_name: string;
  last_name: string;
  tag: string | null;
  role: UserRole;
  avatar: string | null;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.readAsDataURL(file);
  });

export default function SchoolRegistrationPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<CurrentDirectorProfile | null>(null);
  const [unlinkedTeams, setUnlinkedTeams] = useState<UnlinkedTeam[]>([]);
  const [existingTeam, setExistingTeam] = useState<UnlinkedTeam | null>(null);

  // Form State
  const [mode, setMode] = useState<"register" | "claim">("register");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolSiteUrl, setSchoolSiteUrl] = useState("");
  const [selectedClaimTeamId, setSelectedClaimTeamId] = useState("");
  const [claimSearchQuery, setClaimSearchQuery] = useState("");

  // Logo State
  const [existingLogo, setExistingLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoOffsetX, setLogoOffsetX] = useState(0);
  const [logoOffsetY, setLogoOffsetY] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Authentication & Initial Data Fetch
  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    const bootstrap = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        router.replace("/login?returnTo=/school-registration");
        return;
      }

      const [{ data: userProfile, error: profileError }, { data: teamRows }, { data: directorTeam }] =
        await Promise.all([
          supabase
            .from("users")
            .select("id, first_name, last_name, tag, role, avatar")
            .eq("id", session.user.id)
            .maybeSingle<CurrentDirectorProfile>(),
          supabase
            .from("teams")
            .select("id, name, short_name, avatar, school_site_url")
            .is("director_user_id", null)
            .order("name", { ascending: true }),
          supabase
            .from("teams")
            .select("id, name, short_name, avatar, school_site_url")
            .eq("director_user_id", session.user.id)
            .maybeSingle<UnlinkedTeam>(),
        ]);

      if (!isMounted) return;

      if (
        profileError ||
        !userProfile ||
        (userProfile.role !== "mod" && !isDirectorRole(userProfile.role))
      ) {
        router.replace("/dashboard");
        return;
      }

      setProfile(userProfile);
      setUnlinkedTeams((teamRows as UnlinkedTeam[]) ?? []);

      if (directorTeam) {
        setExistingTeam(directorTeam);
        setSchoolName(directorTeam.name);
        setSchoolCode(directorTeam.short_name);
        setSchoolSiteUrl(directorTeam.school_site_url ?? "");
        setExistingLogo(directorTeam.avatar);
      }

      setIsCheckingAuth(false);
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  // Filter unlinked schools
  const filteredUnlinkedTeams = useMemo(() => {
    const query = claimSearchQuery.trim().toLowerCase();
    if (!query) return unlinkedTeams;
    return unlinkedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.short_name.toLowerCase().includes(query)
    );
  }, [claimSearchQuery, unlinkedTeams]);

  const selectedClaimTeam = useMemo(
    () => unlinkedTeams.find((t) => t.id === selectedClaimTeamId) ?? null,
    [selectedClaimTeamId, unlinkedTeams]
  );

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, WebP, or SVG).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage("Logo file size must be less than 8MB.");
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
  };

  const handleClearLogo = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setExistingLogo(null);
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
  };

  const handleResetSliders = () => {
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
  };

  const activeLogoSource =
    mode === "claim"
      ? selectedClaimTeam?.avatar ?? null
      : logoPreviewUrl ?? existingLogo;

  const logoTransformStyle = {
    transform: `translate(${logoOffsetX}%, ${logoOffsetY}%) scale(${logoZoom})`,
    transformOrigin: "center center",
  };

  // Crop logo to DataURL for submission
  const cropLogoToDataUrl = async (sourceUrl: string): Promise<string> => {
    if (logoFile?.type === "image/svg+xml") {
      return fileToDataUrl(logoFile);
    }

    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(sourceUrl);
          return;
        }

        ctx.clearRect(0, 0, size, size);
        ctx.save();

        const centerX = size / 2;
        const centerY = size / 2;
        ctx.translate(centerX, centerY);

        const panXPixels = (logoOffsetX / 100) * size;
        const panYPixels = (logoOffsetY / 100) * size;
        ctx.translate(panXPixels, panYPixels);
        ctx.scale(logoZoom, logoZoom);

        const aspect = img.width / img.height;
        let drawWidth = size;
        let drawHeight = size;

        if (aspect >= 1) {
          drawHeight = size;
          drawWidth = size * aspect;
        } else {
          drawWidth = size;
          drawHeight = size / aspect;
        }

        ctx.drawImage(
          img,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();

        resolve(canvas.toDataURL("image/png", 0.95));
      };
      img.onerror = () => resolve(sourceUrl);
      img.src = sourceUrl;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !profile) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "claim") {
        if (!selectedClaimTeamId) {
          setErrorMessage("Please choose an unlinked school to claim.");
          setIsSubmitting(false);
          return;
        }

        const { error: claimError } = await supabase
          .from("teams" as never)
          .update({ director_user_id: profile.id } as never)
          .eq("id", selectedClaimTeamId)
          .is("director_user_id", null);

        if (claimError) {
          throw new Error(claimError.message);
        }

        setSuccessMessage("School claimed successfully! Redirecting to dashboard...");
        setTimeout(() => {
          router.replace("/dashboard");
          router.refresh();
        }, 800);
        return;
      }

      // Register / Update Mode
      const trimmedName = schoolName.trim();
      const normalizedCode = schoolCode.trim().toUpperCase();

      if (!trimmedName) {
        setErrorMessage("Please enter a valid school or team name.");
        setIsSubmitting(false);
        return;
      }

      if (!normalizedCode) {
        setErrorMessage("Please provide a school code (e.g. ERG).");
        setIsSubmitting(false);
        return;
      }

      let finalLogo = existingLogo;
      if (logoPreviewUrl) {
        finalLogo = await cropLogoToDataUrl(logoPreviewUrl);
      }

      const payload = {
        name: trimmedName,
        short_name: normalizedCode,
        avatar: finalLogo,
        school_site_url: schoolSiteUrl.trim() || null,
        director_user_id: profile.id,
      };

      if (existingTeam) {
        const { error: updateError } = await supabase
          .from("teams" as never)
          .update(payload as never)
          .eq("id", existingTeam.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from("teams" as never)
          .insert(payload as never);

        if (insertError) throw new Error(insertError.message);
      }

      setSuccessMessage("School program registered successfully! Redirecting...");
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 800);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    }
  };

  const directorDisplayName =
    profile?.tag?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Program Director";

  const displaySchoolName =
    mode === "claim"
      ? selectedClaimTeam?.name || ""
      : schoolName.trim();

  const displaySchoolCode =
    mode === "claim"
      ? selectedClaimTeam?.short_name || ""
      : schoolCode.trim().toUpperCase();

  const displaySchoolSite =
    mode === "claim"
      ? selectedClaimTeam?.school_site_url || ""
      : schoolSiteUrl.trim();

  const isFormValid =
    mode === "claim"
      ? Boolean(selectedClaimTeamId)
      : Boolean(schoolName.trim() && schoolCode.trim());

  return (
    <div className="onboarding-page school-registration-page">
      <header className="onboarding-header">
        <h1 className="onboarding-headline">
          {existingTeam ? "Manage School Program." : "Register Your School."}
        </h1>
      </header>

      <div className="onboarding-layout">
        {/* Left Side: Setup Form Console */}
        <section
          className="onboarding-console-side"
          aria-labelledby="school-form-title"
        >
          <article className="onboarding-console-card">
            <header className="onboarding-card-header">
              <h2 id="school-form-title">
                {existingTeam ? "School Program Details" : "Program Registration"}
              </h2>
            </header>

            {isCheckingAuth ? (
              <div className="onboarding-state-box">
                <span className="onboarding-state-pulse" />
                <p>Verifying director authorization...</p>
              </div>
            ) : !profile ? (
              <div className="onboarding-state-box">
                <RiErrorWarningFill size={32} className="text-nexus-magenta" />
                <p>You must be signed in as a Program Director to access school registration.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="onboarding-form">
                {/* Compact Pathway Switcher */}
                {!existingTeam && (
                  <div className="school-pathway-switch">
                    {mode === "register" ? (
                      <p className="school-pathway-text">
                        Need to claim an unlinked school already in the league?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setMode("claim");
                            setErrorMessage(null);
                          }}
                          className="school-pathway-link"
                        >
                          Claim existing school
                        </button>
                      </p>
                    ) : (
                      <p className="school-pathway-text">
                        Want to create a new school instead?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setMode("register");
                            setErrorMessage(null);
                          }}
                          className="school-pathway-link"
                        >
                          Register new school
                        </button>
                      </p>
                    )}
                  </div>
                )}

                {/* Register Mode */}
                {mode === "register" ? (
                  <>
                    <div className="onboarding-section">
                      <div className="onboarding-section-title">
                        <RiTeamFill size={18} />
                        <span>School Identity</span>
                        <small>Required</small>
                      </div>

                      <div className="onboarding-name-grid">
                        <div className="onboarding-field">
                          <label htmlFor="school-name">
                            Full School Name  <b>*</b>
                          </label>
                          <input
                            id="school-name"
                            type="text"
                            value={schoolName}
                            onChange={(event) => setSchoolName(event.target.value)}
                            placeholder="e.g. University of South Atlantis"
                            required
                          />
                        </div>

                        <div className="onboarding-field">
                          <label htmlFor="school-code">
                            School Code / Short Name <b>*</b>
                          </label>
                          <input
                            id="school-code"
                            type="text"
                            value={schoolCode}
                            onChange={(event) =>
                              setSchoolCode(
                                event.target.value.toUpperCase().slice(0, 8)
                              )
                            }
                            placeholder="e.g. ERG, OW, UND"
                            maxLength={8}
                            required
                          />
                        </div>
                      </div>

                      <div className="onboarding-field">
                        <label htmlFor="school-site">
                          Official Team Site URL
                        </label>
                        <div className="onboarding-input-wrapper">
                          <span className="onboarding-input-icon">
                            <RiGlobalFill size={16} />
                          </span>
                          <input
                            id="school-site"
                            type="url"
                            value={schoolSiteUrl}
                            onChange={(event) =>
                              setSchoolSiteUrl(event.target.value)
                            }
                            placeholder="https://school.edu/esports"
                            autoComplete="off"
                          />
                        </div>
                        <span className="onboarding-field-help">
                          Links to your school&apos;s athletic or esports program page.
                        </span>
                      </div>
                    </div>

                    <div className="onboarding-divider" />

                    {/* School Logo Upload */}
                    <div className="onboarding-section">
                      <div className="onboarding-section-title">
                        <RiImageCircleFill size={18} />
                        <span>School Crest / Logo</span>
                        <small className="is-optional">Optional</small>
                      </div>

                      <div className="onboarding-avatar-uploader">
                        <div className="school-logo-thumb">
                          {activeLogoSource ? (
                            <Image
                              src={activeLogoSource}
                              alt="School logo preview"
                              fill
                              sizes="72px"
                              style={{ objectFit: "contain", ...logoTransformStyle }}
                              unoptimized
                            />
                          ) : (
                            <RiSchoolFill size={32} />
                          )}
                        </div>

                        <div className="onboarding-avatar-meta">
                          <strong>
                            {logoFile?.name ??
                              (existingLogo
                                ? "Current school crest"
                                : "Upload school logo")}
                          </strong>
                          <small>Square SVG or PNG file with transparent background. SVG preferred.</small>
                        </div>

                        <div className="onboarding-avatar-actions">
                          <label className="onboarding-upload-trigger">
                            <RiImageCircleFill size={16} />
                            <span>{activeLogoSource ? "Change" : "Browse"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoChange}
                            />
                          </label>

                          {activeLogoSource ? (
                            <button
                              type="button"
                              className="onboarding-avatar-clear"
                              onClick={handleClearLogo}
                              title="Remove logo"
                              aria-label="Remove logo"
                            >
                              <RiDeleteBin7Fill size={16} />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Adjustment Sliders for Logo Centering */}
                      {activeLogoSource && logoFile?.type !== "image/svg+xml" ? (
                        <div className="onboarding-avatar-adjustments">
                          <div className="onboarding-avatar-adjustments-top">
                            <span className="onboarding-avatar-adjustments-title">
                              Adjust Logo Crop & Scale
                            </span>
                            <button
                              type="button"
                              className="onboarding-slider-reset-btn"
                              onClick={handleResetSliders}
                            >
                              Reset
                            </button>
                          </div>

                          <div className="onboarding-slider-row">
                            <span className="onboarding-slider-label">Scale</span>
                            <input
                              type="range"
                              className="onboarding-slider"
                              min="0.8"
                              max="2.5"
                              step="0.05"
                              value={logoZoom}
                              onChange={(e) =>
                                setLogoZoom(parseFloat(e.target.value))
                              }
                              aria-label="Zoom logo image"
                            />
                            <span className="onboarding-slider-val">
                              {Math.round(logoZoom * 100)}%
                            </span>
                          </div>

                          <div className="onboarding-slider-row">
                            <span className="onboarding-slider-label">Vertical</span>
                            <input
                              type="range"
                              className="onboarding-slider"
                              min="-50"
                              max="50"
                              step="1"
                              value={logoOffsetY}
                              onChange={(e) =>
                                setLogoOffsetY(parseInt(e.target.value, 10))
                              }
                              aria-label="Adjust vertical position"
                            />
                            <span className="onboarding-slider-val">
                              {logoOffsetY > 0
                                ? `+${logoOffsetY}%`
                                : `${logoOffsetY}%`}
                            </span>
                          </div>

                          <div className="onboarding-slider-row">
                            <span className="onboarding-slider-label">
                              Horizontal
                            </span>
                            <input
                              type="range"
                              className="onboarding-slider"
                              min="-50"
                              max="50"
                              step="1"
                              value={logoOffsetX}
                              onChange={(e) =>
                                setLogoOffsetX(parseInt(e.target.value, 10))
                              }
                              aria-label="Adjust horizontal position"
                            />
                            <span className="onboarding-slider-val">
                              {logoOffsetX > 0
                                ? `+${logoOffsetX}%`
                                : `${logoOffsetX}%`}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  /* Claim Mode */
                  <div className="onboarding-section">
                    <div className="onboarding-section-title">
                      <RiSearchLine size={18} />
                      <span>Find Unlinked School</span>
                      <small>Required</small>
                    </div>

                    <div className="onboarding-field">
                      <label htmlFor="claim-search">
                        Search Schools
                      </label>
                      <div className="onboarding-input-wrapper">
                        <span className="onboarding-input-icon">
                          <RiSearchLine size={16} />
                        </span>
                        <input
                          id="claim-search"
                          type="text"
                          value={claimSearchQuery}
                          onChange={(e) => setClaimSearchQuery(e.target.value)}
                          placeholder="Type school name or short code..."
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        maxHeight: "260px",
                        overflowY: "auto",
                        paddingRight: "0.25rem",
                      }}
                      role="radiogroup"
                      aria-label="Available unlinked schools"
                    >
                      {filteredUnlinkedTeams.map((team) => (
                        <div
                          key={team.id}
                          className={`onboarding-role-card ${
                            selectedClaimTeamId === team.id ? "is-selected" : ""
                          }`}
                          style={{
                            padding: "0.85rem 1rem",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                          onClick={() => setSelectedClaimTeamId(team.id)}
                          role="radio"
                          aria-checked={selectedClaimTeamId === team.id}
                          tabIndex={0}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.85rem",
                            }}
                          >
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                display: "grid",
                                placeItems: "center",
                                position: "relative",
                                flexShrink: 0,
                              }}
                            >
                              {team.avatar ? (
                                <Image
                                  src={team.avatar}
                                  alt={team.name}
                                  fill
                                  sizes="38px"
                                  style={{ objectFit: "contain" }}
                                  unoptimized
                                />
                              ) : (
                                <RiSchoolFill size={20} />
                              )}
                            </div>
                            <div>
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: "0.88rem",
                                  color: "var(--nexus-white)",
                                }}
                              >
                                {team.name}
                              </strong>
                              <small
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--container-muted)",
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                }}
                              >
                                {team.short_name}
                              </small>
                            </div>
                          </div>

                          <div className="onboarding-role-check">
                            <RiCheckFill size={14} />
                          </div>
                        </div>
                      ))}

                      {filteredUnlinkedTeams.length === 0 ? (
                        <div
                          style={{
                            padding: "1.5rem",
                            textAlign: "center",
                            background: "rgba(255, 255, 255, 0.015)",
                            borderRadius: "var(--radius-md)",
                            border: "1px dashed rgba(255, 255, 255, 0.1)",
                            color: "var(--container-muted)",
                            fontSize: "0.78rem",
                          }}
                        >
                          No unlinked schools match your query. Click &quot;Register new school&quot; above to create a new program.
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Status Messages */}
                {errorMessage ? (
                  <div className="onboarding-error-banner" role="alert">
                    <RiErrorWarningFill size={18} />
                    <span>{errorMessage}</span>
                  </div>
                ) : null}

                {successMessage ? (
                  <div
                    className="onboarding-error-banner"
                    style={{
                      borderLeftColor: "var(--nexus-emerald)",
                      background: "rgba(80, 200, 120, 0.08)",
                      color: "#bbf7d0",
                    }}
                    role="status"
                  >
                    <RiShieldCheckFill size={18} style={{ color: "var(--nexus-emerald)" }} />
                    <span>{successMessage}</span>
                  </div>
                ) : null}

                {/* Submit Console Button */}
                <div className="onboarding-submit-wrap">
                  <button
                    type="submit"
                    disabled={isSubmitting || !isFormValid}
                    className="btn btn-primary onboarding-submit-btn"
                  >
                    {isSubmitting ? (
                      "Processing..."
                    ) : (
                      <>
                        <span>
                          {existingTeam
                            ? "Update School Program"
                            : mode === "claim"
                            ? "Claim School Program"
                            : "Register School Program"}
                        </span>
                        <RiArrowRightSFill size={18} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </article>
        </section>

        {/* Right Side: Program Preview & Checklist */}
        <aside className="onboarding-preview-side">
          <div className="onboarding-preview-card">
            <div className="onboarding-preview-overline">
              <RiSchoolFill size={14} />
              <span>Program Identity</span>
            </div>

            <div className="stats-profile-logo-mark" style={{ minHeight: "150px", padding: "0.5rem 0" }}>
              {activeLogoSource ? (
                <div style={{ width: 140, height: 140, position: "relative" }}>
                  <Image
                    src={activeLogoSource}
                    alt="School crest preview"
                    fill
                    sizes="140px"
                    style={{
                      objectFit: "contain",
                      ...(mode === "register" ? logoTransformStyle : {}),
                    }}
                    unoptimized
                  />
                </div>
              ) : (
                <div className="school-preview-logo-fallback">
                  <RiSchoolFill size={40} />
                  <span>{displaySchoolCode || "No Crest"}</span>
                </div>
              )}
            </div>

            <div className="stats-profile-logo-caption" style={{ marginBottom: "1rem" }}>
              <strong>{displaySchoolName || "School Name Pending"}</strong>
              <small>
                {displaySchoolCode
                  ? `${displaySchoolCode} • Collegiate League Program`
                  : "Collegiate League Program"}
              </small>
            </div>

            <div className="onboarding-preview-details">
              <div className="onboarding-preview-grid-2col">
                <div className="onboarding-preview-tile">
                  <span>School Code</span>
                  <strong>{displaySchoolCode || "\u00A0"}</strong>
                </div>

                <div className="onboarding-preview-tile">
                  <span>Program Director</span>
                  <strong>{directorDisplayName || "\u00A0"}</strong>
                </div>
              </div>

              {displaySchoolSite ? (
                <div className="onboarding-preview-group">
                  <span className="onboarding-preview-group-title">
                    Official Web Portal
                  </span>
                  <div className="onboarding-preview-tile">
                    <span>Team URL</span>
                    <strong>{displaySchoolSite}</strong>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Setup Progress Checklist */}
          {(() => {
            const completedCount = [
              Boolean(displaySchoolName && displaySchoolCode),
              Boolean(activeLogoSource),
              Boolean(displaySchoolSite),
            ].filter(Boolean).length;
            const progressPct = (completedCount / 3) * 100;

            return (
              <div className="onboarding-checklist-card">
                <div className="onboarding-checklist-header">
                  <div className="onboarding-checklist-title">
                    <RiCheckFill size={14} />
                    <span>Setup Checklist</span>
                  </div>
                  <span className="onboarding-checklist-badge">
                    {completedCount} / 3
                  </span>
                </div>

                <div className="onboarding-checklist-progress-track">
                  <div
                    className="onboarding-checklist-progress-bar"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <ul className="onboarding-checklist-items">
                  <li
                    className={`onboarding-checklist-item ${
                      displaySchoolName && displaySchoolCode ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {displaySchoolName && displaySchoolCode ? (
                        <RiCheckFill size={12} />
                      ) : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      School name & short code
                    </span>
                    <span className="onboarding-checklist-tag">Required</span>
                  </li>

                  <li
                    className={`onboarding-checklist-item ${
                      activeLogoSource ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {activeLogoSource ? <RiCheckFill size={12} /> : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      Upload school crest
                    </span>
                    <span className="onboarding-checklist-tag is-optional">
                      Optional
                    </span>
                  </li>

                  <li
                    className={`onboarding-checklist-item ${
                      displaySchoolSite ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {displaySchoolSite ? <RiCheckFill size={12} /> : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      Link school web portal
                    </span>
                    <span className="onboarding-checklist-tag is-optional">
                      Optional
                    </span>
                  </li>
                </ul>
              </div>
            );
          })()}
        </aside>
      </div>
    </div>
  );
}
