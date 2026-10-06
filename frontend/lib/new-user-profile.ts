export const NEW_USER_PROFILE = {
  first_name: 'New',
  last_name: 'Player',
  tag: null,
  role: 'player',
  avatar: null,
  x_handle: null,
  discord_handle: null
} as const;

export type NewUserProfile = typeof NEW_USER_PROFILE;

export const isExpectedNewUserProfile = (profile: Partial<NewUserProfile> | undefined) =>
  profile === undefined ||
  Object.entries(NEW_USER_PROFILE).every(([key, value]) => profile[key as keyof NewUserProfile] === value);
