"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiUser3Fill,
  RiUserStarFill,
  RiShieldUserFill,
  RiImageCircleFill,
  RiHashtag,
  RiTwitterXFill,
  RiDiscordFill,
  RiArrowRightSFill,
  RiCheckFill,
  RiErrorWarningFill,
  RiTeamFill,
  RiDeleteBin7Fill,
} from "@remixicon/react";
import { getSupabaseClient } from "@/lib/supabase";

type UserRole = "director" | "player";

type UserProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  tag: string | null;
  role: UserRole | "mod";
  avatar: string | null;
  x_handle: string | null;
  discord_handle: string | null;
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

const displayValue = (value: string, defaultValue: string) =>
  value.trim().toLowerCase() === defaultValue ? "" : value;

const normalizeHandle = (value: string) =>
  value.trim().replace(/^@/, "") || null;

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

function cropAvatarToDataUrl(
  imageSource: string,
  zoom: number,
  offsetX: number,
  offsetY: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 360;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Unable to create canvas context"));

      ctx.fillStyle = "#1a1921";
      ctx.fillRect(0, 0, size, size);

      const aspect = img.width / img.height;
      let drawW: number;
      let drawH: number;

      if (aspect > 1) {
        drawH = size;
        drawW = size * aspect;
      } else {
        drawW = size;
        drawH = size / aspect;
      }

      drawW *= zoom;
      drawH *= zoom;

      const centerX = (size - drawW) / 2;
      const centerY = (size - drawH) / 2;

      const shiftX = (offsetX / 100) * (size / 2);
      const shiftY = (offsetY / 100) * (size / 2);

      ctx.drawImage(img, centerX + shiftX, centerY + shiftY, drawW, drawH);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to process image"));
    img.src = imageSource;
  });
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(supabase));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tag, setTag] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [xHandle, setXHandle] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [existingAvatar, setExistingAvatar] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    const verifySessionAndLoadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!session) return router.replace("/signup");

      const { data: loadedProfile, error } = await supabase
        .from("users")
        .select(
          "id,first_name,last_name,tag,role,avatar,x_handle,discord_handle"
        )
        .eq("id", session.user.id)
        .maybeSingle<UserProfileRow>();

      if (!isMounted) return;
      if (error) {
        setErrorMessage(error.message);
        setIsCheckingAuth(false);
        return;
      }
      if (hasCompletedOnboarding(loadedProfile)) {
        router.replace("/dashboard");
        return;
      }
      if (loadedProfile) {
        setFirstName(
          displayValue(loadedProfile.first_name ?? "", DEFAULT_FIRST_NAME)
        );
        setLastName(
          displayValue(loadedProfile.last_name ?? "", DEFAULT_LAST_NAME)
        );
        setTag(loadedProfile.tag ?? "");
        setRole(loadedProfile.role === "director" ? "director" : "player");
        setExistingAvatar(loadedProfile.avatar);
        setXHandle(loadedProfile.x_handle ?? "");
        setDiscordHandle(loadedProfile.discord_handle ?? "");
      }
      setIsCheckingAuth(false);
    };

    void verifySessionAndLoadProfile();
    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  useEffect(
    () => () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    },
    [avatarPreviewUrl]
  );

  const isFormComplete = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      tag.trim().length > 0 &&
      role.length > 0,
    [firstName, lastName, role, tag]
  );

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(selectedFile);
    setAvatarPreviewUrl(
      selectedFile ? URL.createObjectURL(selectedFile) : null
    );
    setAvatarZoom(1);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
  };

  const handleClearAvatar = () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setExistingAvatar(null);
    setAvatarZoom(1);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
  };

  const handleResetSliders = () => {
    setAvatarZoom(1);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    if (!supabase)
      return setErrorMessage("Dashboard onboarding is unavailable right now.");
    if (!isFormComplete)
      return setErrorMessage(
        "Please complete all required fields before submitting."
      );

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return router.replace("/signup");

    setIsSubmitting(true);
    let nextAvatar = existingAvatar;
    if (avatarFile) {
      try {
        const rawDataUrl = await fileToDataUrl(avatarFile);
        nextAvatar = await cropAvatarToDataUrl(
          rawDataUrl,
          avatarZoom,
          avatarOffsetX,
          avatarOffsetY
        );
      } catch (error) {
        setIsSubmitting(false);
        return setErrorMessage(
          error instanceof Error ? error.message : "Image upload failed."
        );
      }
    } else if (
      existingAvatar &&
      (avatarZoom !== 1 || avatarOffsetX !== 0 || avatarOffsetY !== 0)
    ) {
      try {
        nextAvatar = await cropAvatarToDataUrl(
          existingAvatar,
          avatarZoom,
          avatarOffsetX,
          avatarOffsetY
        );
      } catch (error) {
        setIsSubmitting(false);
        return setErrorMessage(
          error instanceof Error ? error.message : "Image processing failed."
        );
      }
    }

    const { error } = await supabase
      .from("users" as never)
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        tag: tag.trim(),
        role,
        avatar: nextAvatar,
        x_handle: normalizeHandle(xHandle),
        discord_handle: discordHandle.trim() || null,
      } as never)
      .eq("id", session.user.id);

    setIsSubmitting(false);
    if (error) return setErrorMessage(error.message);
    router.replace("/dashboard");
    router.refresh();
  };

  const avatarSource = avatarPreviewUrl ?? existingAvatar;
  const fullNameDisplay = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");

  const avatarTransformStyle = {
    transform: `translate(${avatarOffsetX}%, ${avatarOffsetY}%) scale(${avatarZoom})`,
    transformOrigin: "center center",
  };

  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <div className="onboarding-brand-logo">
          <Image
            src="/logos/Primary/SVG/The Nexus Logotype Emerald.svg"
            alt="The Nexus"
            width={160}
            height={50}
            priority
          />
        </div>
        <h1 className="onboarding-headline">
          Enter The Nexus.
        </h1>
      </header>

      <div className="onboarding-layout">
        {/* Left Side: Setup Form Console */}
        <section
          className="onboarding-console-side"
          aria-labelledby="onboarding-form-title"
        >
          <article className="onboarding-console-card">
            <header className="onboarding-card-header">
              <h2 id="onboarding-form-title">Tell Us Who You Are</h2>
              <p>
                Required fields are marked with an asterisk (*). You can edit
                your details anytime in dashboard settings.
              </p>
            </header>

            {isCheckingAuth ? (
              <div className="onboarding-state-box">
                <span className="onboarding-state-pulse" />
                <p>Verifying your credentials...</p>
              </div>
            ) : !supabase ? (
              <div className="onboarding-state-box">
                <p>
                  Dashboard onboarding is unavailable until Supabase is
                  configured.
                </p>
              </div>
            ) : (
              <form className="onboarding-form" onSubmit={handleSubmit}>
                {/* 1. Role Selection */}
                <div className="onboarding-section">
                  <div className="onboarding-section-title">
                    <RiShieldUserFill size={18} />
                    <span>League Role</span>
                    <small>Required</small>
                  </div>
                  <div
                    className="onboarding-role-grid"
                    role="radiogroup"
                    aria-label="Select league role"
                  >
                    <div
                      className={`onboarding-role-card ${
                        role === "player" ? "is-selected" : ""
                      }`}
                      onClick={() => setRole("player")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setRole("player");
                        }
                      }}
                      role="radio"
                      aria-checked={role === "player"}
                      tabIndex={0}
                    >
                      <div className="onboarding-role-card-top">
                        <div className="onboarding-role-card-icon">
                          <RiTeamFill size={20} />
                        </div>
                        <div className="onboarding-role-check">
                          <RiCheckFill size={14} />
                        </div>
                      </div>
                      <div className="onboarding-role-body">
                        <div className="onboarding-role-title">Player</div>
                        <p className="onboarding-role-desc">
                          Competitor representing a school on an active roster.
                        </p>
                      </div>
                    </div>

                    <div
                      className={`onboarding-role-card ${
                        role === "director" ? "is-selected" : ""
                      }`}
                      onClick={() => setRole("director")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setRole("director");
                        }
                      }}
                      role="radio"
                      aria-checked={role === "director"}
                      tabIndex={0}
                    >
                      <div className="onboarding-role-card-top">
                        <div className="onboarding-role-card-icon">
                          <RiUserStarFill size={20} />
                        </div>
                        <div className="onboarding-role-check">
                          <RiCheckFill size={14} />
                        </div>
                      </div>
                      <div className="onboarding-role-body">
                        <div className="onboarding-role-title">Program Staff</div>
                        <p className="onboarding-role-desc">
                          Director, coach, or coordinator managing school operations and rosters.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="onboarding-divider" />

                {/* 2. Identity Details */}
                <div className="onboarding-section">
                  <div className="onboarding-section-title">
                    <RiUser3Fill size={18} />
                    <span>Competitor Identity</span>
                    <small>Required</small>
                  </div>
                  <div className="onboarding-name-grid">
                    <div className="onboarding-field">
                      <label htmlFor="first-name">
                        First name <b>*</b>
                      </label>
                      <input
                        id="first-name"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="e.g. Alex"
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div className="onboarding-field">
                      <label htmlFor="last-name">
                        Last name <b>*</b>
                      </label>
                      <input
                        id="last-name"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="e.g. Mercer"
                        autoComplete="family-name"
                        required
                      />
                    </div>
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="player-tag">
                      Tag / Username <b>*</b>
                    </label>
                    <input
                      id="player-tag"
                      type="text"
                      value={tag}
                      onChange={(event) => setTag(event.target.value)}
                      placeholder="e.g. Sparg0, MkLeo, Apex"
                      autoComplete="nickname"
                      required
                    />
                    <span className="onboarding-field-help">
                      Your in-game tag displayed across match scoreboards,
                      overlays, and leaderboards.
                    </span>
                  </div>
                </div>

                <div className="onboarding-divider" />

                {/* 3. Avatar Upload & Adjustment Controls */}
                <div className="onboarding-section">
                  <div className="onboarding-section-title">
                    <RiImageCircleFill size={18} />
                    <span>Profile Picture</span>
                    <small className="is-optional">Optional</small>
                  </div>

                  <div className="onboarding-avatar-uploader">
                    <div className="onboarding-avatar-circle">
                      {avatarSource ? (
                        <Image
                          src={avatarSource}
                          alt="Profile avatar preview"
                          fill
                          sizes="68px"
                          style={avatarTransformStyle}
                          unoptimized
                        />
                      ) : (
                        <RiUser3Fill size={32} />
                      )}
                    </div>

                    <div className="onboarding-avatar-meta">
                      <strong>
                        {avatarFile?.name ??
                          (existingAvatar
                            ? "Custom profile photo"
                            : "Upload an avatar")}
                      </strong>
                      <small>PNG, JPG, or WebP</small>
                    </div>

                    <div className="onboarding-avatar-actions">
                      <label className="onboarding-upload-trigger">
                        <RiImageCircleFill size={16} />
                        <span>{avatarSource ? "Change" : "Browse"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                        />
                      </label>

                      {avatarSource ? (
                        <button
                          type="button"
                          className="onboarding-avatar-clear"
                          onClick={handleClearAvatar}
                          title="Remove photo"
                          aria-label="Remove photo"
                        >
                          <RiDeleteBin7Fill size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Compact & Clean Adjustment Sliders */}
                  {avatarSource ? (
                    <div className="onboarding-avatar-adjustments">
                      <div className="onboarding-avatar-adjustments-top">
                        <span className="onboarding-avatar-adjustments-title">
                          Adjust Photo Position
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
                          min="1"
                          max="2.5"
                          step="0.05"
                          value={avatarZoom}
                          onChange={(e) =>
                            setAvatarZoom(parseFloat(e.target.value))
                          }
                          aria-label="Zoom avatar image"
                        />
                        <span className="onboarding-slider-val">
                          {Math.round(avatarZoom * 100)}%
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
                          value={avatarOffsetY}
                          onChange={(e) =>
                            setAvatarOffsetY(parseInt(e.target.value, 10))
                          }
                          aria-label="Adjust vertical position"
                        />
                        <span className="onboarding-slider-val">
                          {avatarOffsetY > 0
                            ? `+${avatarOffsetY}%`
                            : `${avatarOffsetY}%`}
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
                          value={avatarOffsetX}
                          onChange={(e) =>
                            setAvatarOffsetX(parseInt(e.target.value, 10))
                          }
                          aria-label="Adjust horizontal position"
                        />
                        <span className="onboarding-slider-val">
                          {avatarOffsetX > 0
                            ? `+${avatarOffsetX}%`
                            : `${avatarOffsetX}%`}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="onboarding-divider" />

                {/* 4. Social Handles */}
                <div className="onboarding-section">
                  <div className="onboarding-section-title">
                    <RiHashtag size={18} />
                    <span>Social Connections</span>
                    <small className="is-optional">Optional</small>
                  </div>
                  <div className="onboarding-field-grid">
                    <div className="onboarding-field">
                      <label htmlFor="x-handle">X / Twitter</label>
                      <div className="onboarding-input-wrapper">
                        <span className="onboarding-input-icon">
                          <RiTwitterXFill size={16} />
                        </span>
                        <input
                          id="x-handle"
                          type="text"
                          value={xHandle}
                          onChange={(event) => setXHandle(event.target.value)}
                          placeholder="@handle"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="onboarding-field">
                      <label htmlFor="discord-handle">Discord</label>
                      <div className="onboarding-input-wrapper">
                        <span className="onboarding-input-icon">
                          <RiDiscordFill size={16} />
                        </span>
                        <input
                          id="discord-handle"
                          type="text"
                          value={discordHandle}
                          onChange={(event) =>
                            setDiscordHandle(event.target.value)
                          }
                          placeholder="username"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {errorMessage ? (
                  <div className="onboarding-error-banner" role="alert">
                    <RiErrorWarningFill size={18} />
                    <span>{errorMessage}</span>
                  </div>
                ) : null}

                {/* Submit Action */}
                <div className="onboarding-submit-wrap">
                  <button
                    type="submit"
                    className="btn btn-primary onboarding-submit-btn"
                    disabled={!isFormComplete || isSubmitting}
                  >
                    <span>
                      {isSubmitting
                        ? "Configuring Profile..."
                        : "Complete Registration"}
                    </span>
                    <RiArrowRightSFill size={20} />
                  </button>
                  <p className="onboarding-legal-consent">
                    By completing registration, you agree to The Nexus{' '}
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>.
                  </p>
                </div>
              </form>
            )}
          </article>
        </section>

        {/* Right Side: Profile Summary Preview */}
        <aside className="onboarding-preview-side" aria-label="Profile summary">
          <div className="onboarding-preview-card">
            <div className="onboarding-preview-overline">
              <RiUser3Fill size={14} aria-hidden="true" /> Profile Summary
            </div>

            <div className="onboarding-preview-name">
              {tag.trim() || "\u00A0"}
            </div>

            <div className="onboarding-preview-avatar-wrap">
              <div className="onboarding-preview-avatar-circle">
                {avatarSource ? (
                  <Image
                    src={avatarSource}
                    alt="Avatar preview"
                    fill
                    sizes="120px"
                    style={avatarTransformStyle}
                    unoptimized
                  />
                ) : (
                  <div className="onboarding-preview-avatar-fallback">
                    <RiUser3Fill size={48} />
                  </div>
                )}
              </div>
            </div>

            <div className="onboarding-preview-details">
              <div className="onboarding-preview-grid-2col">
                <div className="onboarding-preview-tile">
                  <span>Name</span>
                  <strong>{fullNameDisplay || "\u00A0"}</strong>
                </div>

                <div className="onboarding-preview-tile">
                  <span>Role</span>
                  <strong>
                    {role === "player"
                      ? "Player"
                      : role === "director"
                      ? "Program Staff"
                      : "\u00A0"}
                  </strong>
                </div>
              </div>

              {(xHandle.trim() || discordHandle.trim()) && (
                <div className="onboarding-preview-group">
                  <span className="onboarding-preview-group-title">
                    Social Connections
                  </span>
                  <div className="onboarding-preview-grid-2col">
                    {xHandle.trim() ? (
                      <div className="onboarding-preview-tile">
                        <span>X / Twitter</span>
                        <strong>{xHandle.trim().replace(/^@/, "@")}</strong>
                      </div>
                    ) : null}
                    {discordHandle.trim() ? (
                      <div className="onboarding-preview-tile">
                        <span>Discord</span>
                        <strong>{discordHandle.trim()}</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Setup Progress Checklist */}
          {(() => {
            const completedCount = [
              Boolean(role),
              Boolean(firstName.trim() && lastName.trim()),
              Boolean(tag.trim()),
              Boolean(avatarSource),
              Boolean(xHandle.trim() || discordHandle.trim()),
            ].filter(Boolean).length;
            const progressPct = (completedCount / 5) * 100;

            return (
              <div className="onboarding-checklist-card">
                <div className="onboarding-checklist-header">
                  <div className="onboarding-checklist-title">
                    <RiCheckFill size={14} />
                    <span>Setup Checklist</span>
                  </div>
                  <span className="onboarding-checklist-badge">
                    {completedCount} / 5
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
                      role ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {role ? <RiCheckFill size={12} /> : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      Select league role
                    </span>
                    <span className="onboarding-checklist-tag">Required</span>
                  </li>
                  <li
                    className={`onboarding-checklist-item ${
                      firstName.trim() && lastName.trim() ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {firstName.trim() && lastName.trim() ? (
                        <RiCheckFill size={12} />
                      ) : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      Enter name
                    </span>
                    <span className="onboarding-checklist-tag">Required</span>
                  </li>
                  <li
                    className={`onboarding-checklist-item ${
                      tag.trim() ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {tag.trim() ? <RiCheckFill size={12} /> : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      Set tag / username
                    </span>
                    <span className="onboarding-checklist-tag">Required</span>
                  </li>
                  <li
                    className={`onboarding-checklist-item ${
                      avatarSource ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {avatarSource ? <RiCheckFill size={12} /> : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      Upload avatar
                    </span>
                    <span className="onboarding-checklist-tag is-optional">
                      Optional
                    </span>
                  </li>
                  <li
                    className={`onboarding-checklist-item ${
                      xHandle.trim() || discordHandle.trim() ? "is-done" : ""
                    }`}
                  >
                    <span className="onboarding-checklist-check">
                      {xHandle.trim() || discordHandle.trim() ? (
                        <RiCheckFill size={12} />
                      ) : null}
                    </span>
                    <span className="onboarding-checklist-label">
                      Connect socials
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
