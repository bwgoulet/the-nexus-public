export const DIRECTOR_ROLES = ['director', 'member_director', 'pro_director', 'exclusive_director'] as const;

export type DirectorRole = (typeof DIRECTOR_ROLES)[number];
export type PaidDirectorRole = Exclude<DirectorRole, 'director'>;
export type UserRole = DirectorRole | 'player' | 'mod';

export const isDirectorRole = (role: string | null | undefined): role is DirectorRole =>
  Boolean(role && DIRECTOR_ROLES.includes(role as DirectorRole));

export const isPaidDirectorRole = (role: string | null | undefined): role is PaidDirectorRole =>
  role === 'member_director' || role === 'pro_director' || role === 'exclusive_director';

export const DIRECTOR_TIER_ROLES = {
  member: 'member_director',
  pro: 'pro_director',
  exclusive: 'exclusive_director'
} as const;

export type DirectorTier = keyof typeof DIRECTOR_TIER_ROLES;

export const DIRECTOR_TIERS: Array<{ id: DirectorTier; name: string; amount: number; role: PaidDirectorRole; description: string }> = [
  {
    id: 'member',
    name: 'Basic Membership',
    amount: 700,
    role: 'member_director',
    description: 'Grants collegiate league access, sanctioned tournament play, and core program validity.'
  },
  {
    id: 'pro',
    name: 'Asynchronous Support',
    amount: 1500,
    role: 'pro_director',
    description: 'Adds custom team & player graphics for feats and matches, plus season highlight recaps.'
  },
  {
    id: 'exclusive',
    name: 'Synchronous Support',
    amount: 3000,
    role: 'exclusive_director',
    description: 'Guarantees weekly live stream broadcast coverage for every league play match.'
  }
];
