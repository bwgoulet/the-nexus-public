'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  RiSettings3Fill,
  RiPencilFill,
  RiTwitterXFill,
  RiDiscordFill,
  RiCheckFill,
  RiShieldCheckFill,
} from '@remixicon/react';
import { RouteLoader } from '@/app/components/route-loader';
import { getSupabaseClient } from '@/lib/supabase';

type UserProfileRow = {
  first_name: string;
  last_name: string;
  tag: string;
  avatar: string | null;
  x_handle: string | null;
  discord_handle: string | null;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to process image upload.'));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => reject(new Error('Unable to process image upload.'));

    reader.readAsDataURL(file);
  });

export default function SettingsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tag, setTag] = useState('');
  const [existingAvatar, setExistingAvatar] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [savedState, setSavedState] = useState<UserProfileRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    const loadSettings = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/signup');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('first_name,last_name,tag,avatar,x_handle,discord_handle')
        .eq('id', session.user.id)
        .maybeSingle<UserProfileRow>();

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (data) {
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setTag(data.tag ?? '');
        setExistingAvatar(data.avatar);
        setXHandle(data.x_handle ?? '');
        setDiscordHandle(data.discord_handle ?? '');
        setSavedState(data);
      }

      setIsLoading(false);
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const isFormComplete = useMemo(() => {
    return firstName.trim().length > 0 && lastName.trim().length > 0 && tag.trim().length > 0;
  }, [firstName, lastName, tag]);

  const isDirty = useMemo(() => {
    if (!savedState) {
      return false;
    }

    return (
      savedState.first_name !== firstName ||
      savedState.last_name !== lastName ||
      savedState.tag !== tag ||
      (savedState.x_handle ?? '') !== xHandle ||
      (savedState.discord_handle ?? '') !== discordHandle ||
      avatarFile !== null
    );
  }, [avatarFile, discordHandle, firstName, lastName, savedState, tag, xHandle]);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setAvatarFile(selectedFile);

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
    }

    if (selectedFile) {
      setAvatarPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!supabase) {
      setErrorMessage('Settings are unavailable right now.');
      return;
    }

    if (!isFormComplete) {
      setErrorMessage('First name, last name, and player tag are required.');
      return;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace('/signup');
      return;
    }

    setIsSaving(true);

    let nextAvatar = existingAvatar;

    if (avatarFile) {
      try {
        nextAvatar = await fileToDataUrl(avatarFile);
      } catch (error) {
        setIsSaving(false);
        setErrorMessage(error instanceof Error ? error.message : 'Image upload failed.');
        return;
      }
    }

    const supabaseClient = supabase as unknown as {
      from: (table: 'users') => {
        update: (values: {
          first_name: string;
          last_name: string;
          tag: string;
          avatar: string | null;
          x_handle: string | null;
          discord_handle: string | null;
        }) => {
          eq: (column: string, value: string) => {
            select: (columns: string) => {
              maybeSingle: () => Promise<{ data: UserProfileRow | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };

    const { data, error } = await supabaseClient
      .from('users')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        tag: tag.trim(),
        avatar: nextAvatar,
        x_handle: xHandle.trim() || null,
        discord_handle: discordHandle.trim() || null
      })
      .eq('id', session.user.id)
      .select('first_name,last_name,tag,avatar,x_handle,discord_handle')
      .maybeSingle();

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data) {
      const typedData = data as UserProfileRow;
      setSavedState(typedData);
      setExistingAvatar(typedData.avatar);
    }

    setAvatarFile(null);
    setSuccessMessage('Account settings saved successfully.');
    router.refresh();
  };

  if (!supabase) {
    return (
      <div className="settings-page">
        <section className="settings-panel">
          <div className="settings-header">
            <RiSettings3Fill className="settings-header-icon" aria-hidden="true" />
            <div>
              <h2>Account Settings</h2>
            </div>
          </div>
          <p className="settings-intro">
            Settings are currently unavailable. Please verify your connection or Supabase configuration.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <section className="settings-panel">
        <div className="settings-header">
          <RiSettings3Fill className="settings-header-icon" aria-hidden="true" />
          <div>
            <h2>Account Settings</h2>
          </div>
        </div>
        <p className="settings-intro">
          Update your profile details, player tag, profile avatar, and linked social connections across The Nexus.
        </p>

        {isLoading ? (
          <RouteLoader label="Loading settings…" />
        ) : (
          <form className="settings-form" onSubmit={handleSubmit}>
            {/* Avatar & Profile Identity Banner */}
            <div className="settings-avatar-banner">
              <div className="settings-avatar-wrap" onClick={() => avatarInputRef.current?.click()}>
                <div className="settings-avatar-circle">
                  {avatarPreviewUrl ? (
                    <Image
                      src={avatarPreviewUrl}
                      alt="Avatar preview"
                      width={112}
                      height={112}
                      className="settings-avatar-img"
                      unoptimized
                    />
                  ) : existingAvatar ? (
                    <Image
                      src={existingAvatar}
                      alt="Profile avatar"
                      width={112}
                      height={112}
                      className="settings-avatar-img"
                      unoptimized
                    />
                  ) : (
                    <span className="settings-avatar-fallback">
                      {(tag || firstName || 'N').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="settings-avatar-edit-btn"
                  aria-label="Upload avatar image"
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                >
                  <RiPencilFill size={15} aria-hidden="true" />
                </button>
              </div>

              <div className="settings-avatar-info">
                <span className="settings-banner-kicker">
                  <RiShieldCheckFill size={14} /> Profile Picture
                </span>
                <h3>{tag ? tag : 'Your Avatar'}</h3>
                <p>
                  Click the avatar circle to upload a custom profile picture. Square PNG or JPG files work best.
                </p>
                <input
                  ref={avatarInputRef}
                  className="settings-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            {/* Personal Details & Player Tag */}
            <div className="settings-group">
              <span className="settings-group-kicker">Personal Identity</span>
              <div className="settings-grid">
                <label className="settings-field">
                  <span className="settings-label">
                    First Name <b className="required-star">*</b>
                  </span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    required
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">
                    Last Name <b className="required-star">*</b>
                  </span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    required
                  />
                </label>
              </div>

              <label className="settings-field">
                <span className="settings-label">
                  Player Tag <b className="required-star">*</b>
                </span>
                <input
                  type="text"
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  placeholder="Your competitive player tag"
                  autoComplete="nickname"
                  required
                />
              </label>
            </div>

            {/* Social Accounts Section */}
            <div className="settings-group settings-group-divider">
              <span className="settings-group-kicker">Social Connections</span>
              <p className="settings-group-subtitle">
                Link your social accounts so opponents and fans can find your handles on match pages.
              </p>

              <div className="settings-grid">
                <label className="settings-field">
                  <span className="settings-label">
                    <RiTwitterXFill size={14} className="social-icon" aria-hidden="true" /> X / Twitter Handle
                  </span>
                  <input
                    type="text"
                    value={xHandle}
                    onChange={(event) => setXHandle(event.target.value)}
                    placeholder="@yourhandle"
                    autoComplete="off"
                  />
                </label>

                <label className="settings-field">
                  <span className="settings-label">
                    <RiDiscordFill size={14} className="social-icon" aria-hidden="true" /> Discord Handle
                  </span>
                  <input
                    type="text"
                    value={discordHandle}
                    onChange={(event) => setDiscordHandle(event.target.value)}
                    placeholder="Your Discord username"
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>

            {/* Alerts */}
            {errorMessage ? (
              <div className="settings-alert is-error" role="alert">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="settings-alert is-success" role="status">
                <RiCheckFill size={16} aria-hidden="true" />
                <span>{successMessage}</span>
              </div>
            ) : null}

            {/* Submit Action */}
            <div className="settings-actions">
              <button
                type="submit"
                disabled={isSaving || !isFormComplete || !isDirty}
                className="btn btn-primary"
              >
                <RiCheckFill size={18} aria-hidden="true" />
                {isSaving ? 'Saving Changes…' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
