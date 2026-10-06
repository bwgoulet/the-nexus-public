import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';


const getNameParts = (metadata: User['user_metadata']) => {
  const firstName = typeof metadata?.first_name === 'string' ? metadata.first_name.trim() : '';
  const lastName = typeof metadata?.last_name === 'string' ? metadata.last_name.trim() : '';
  if (firstName || lastName) return { firstName: firstName || 'New', lastName: lastName || 'Player' };

  const fullName = (typeof metadata?.full_name === 'string' ? metadata.full_name : typeof metadata?.name === 'string' ? metadata.name : '').trim();
  if (!fullName) return { firstName: 'New', lastName: 'Player' };

  const [first, ...rest] = fullName.split(/\s+/);
  return { firstName: first || 'New', lastName: rest.join(' ') || 'Player' };
};

const normalizeTag = (value: string) => value.toLowerCase().replace(/[^a-z0-9_]+/g, '');

const getBaseTag = (email: string, metadata: User['user_metadata']) => {
  const candidates = [metadata?.user_name, metadata?.preferred_username, metadata?.name, metadata?.full_name, email.split('@')[0]];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = normalizeTag(candidate.trim());
    if (normalized) return normalized;
  }
  return 'player';
};

const ensurePublicProfile = async (adminClient: SupabaseClient, user: User) => {
  const email = user.email?.trim().toLowerCase();
  if (!email) return 'Authenticated account is missing an email address.';

  const { data: existingUser, error: existingUserError } = await adminClient
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle<{ id: string }>();

  if (existingUserError) return existingUserError.message;
  if (existingUser) return null;

  const { firstName, lastName } = getNameParts(user.user_metadata);
  const fallbackTag = `${getBaseTag(email, user.user_metadata).slice(0, 18)}_${user.id.replace(/-/g, '').slice(0, 6)}`;
  const avatar = typeof user.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : typeof user.user_metadata?.picture === 'string'
      ? user.user_metadata.picture
      : null;

  const { error: insertError } = await adminClient.from('users').insert({
    id: user.id,
    email,
    verified: Boolean(user.email_confirmed_at),
    first_name: firstName,
    last_name: lastName,
    tag: fallbackTag,
    role: 'player',
    avatar
  });

  return insertError?.message ?? null;
};


type ClaimInviteResult = {
  player_id: string;
  player_tag: string;
  team_id: string | null;
  team_name: string;
  claimed_at: string;
};

type InviteClaimRecord = {
  id: string;
  expires_at: string;
  revoked_at: string | null;
  claimed_at: string | null;
  player: {
    id: string;
    tag: string;
    user_id: string | null;
    team_id: string | null;
    team: { id: string; name: string; player_user_ids: string[] | null } | null;
  } | null;
};

type TeamRosterIds = { id: string; player_user_ids: string[] | null };

const removeUserFromStaleTeams = async (adminClient: SupabaseClient, userId: string, exceptTeamId?: string | null) => {
  const { data: teams, error: teamsError } = await adminClient
    .from('teams')
    .select('id,player_user_ids')
    .contains('player_user_ids', [userId])
    .returns<TeamRosterIds[]>();

  if (teamsError) return teamsError.message;

  for (const team of teams ?? []) {
    if (exceptTeamId && team.id === exceptTeamId) continue;

    const { data: linkedPlayer, error: linkedPlayerError } = await adminClient
      .from('players')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (linkedPlayerError) return linkedPlayerError.message;
    if (linkedPlayer) continue;

    const { error: updateTeamError } = await adminClient
      .from('teams')
      .update({ player_user_ids: (team.player_user_ids ?? []).filter((existingUserId) => existingUserId !== userId) })
      .eq('id', team.id);

    if (updateTeamError) return updateTeamError.message;
  }

  return null;
};

const addUserToTeamRoster = async (adminClient: SupabaseClient, team: { id: string; player_user_ids: string[] | null }, userId: string) => {
  const existingUserIds = team.player_user_ids ?? [];
  if (existingUserIds.includes(userId)) return null;

  const { error } = await adminClient
    .from('teams')
    .update({ player_user_ids: [...existingUserIds, userId] })
    .eq('id', team.id);

  return error?.message ?? null;
};

const claimInviteWithAdmin = async (adminClient: SupabaseClient, token: string, userId: string) => {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data: invite, error: inviteError } = await adminClient
    .from('player_roster_invites')
    .select('id,expires_at,revoked_at,claimed_at,player:players(id,tag,user_id,team_id,team:teams!players_team_id_fkey(id,name,player_user_ids))')
    .eq('token_hash', tokenHash)
    .maybeSingle<InviteClaimRecord>();

  if (inviteError) return { error: inviteError.message };
  if (!invite?.player?.team) return { error: 'Invitation not found' };
  if (invite.claimed_at) return { error: 'Invitation has already been claimed' };
  if (invite.revoked_at) return { error: 'Invitation has been replaced' };
  if (new Date(invite.expires_at).getTime() <= Date.now()) return { error: 'Invitation has expired' };

  const previousPlayerUserId = invite.player.user_id;
  const claimedAt = new Date().toISOString();

  const { error: unlinkClaimingUserError } = await adminClient
    .from('players')
    .update({ user_id: null, is_captain: false })
    .eq('user_id', userId)
    .neq('id', invite.player.id);

  if (unlinkClaimingUserError) return { error: unlinkClaimingUserError.message };

  if (previousPlayerUserId && previousPlayerUserId !== userId) {
    const { error: unlinkPreviousUserError } = await adminClient
      .from('players')
      .update({ user_id: null, is_captain: false })
      .eq('id', invite.player.id);

    if (unlinkPreviousUserError) return { error: unlinkPreviousUserError.message };
  }

  const { error: linkPlayerError } = await adminClient
    .from('players')
    .update({ user_id: userId })
    .eq('id', invite.player.id);

  if (linkPlayerError) return { error: linkPlayerError.message };

  const { error: claimInviteError } = await adminClient
    .from('player_roster_invites')
    .update({ claimed_at: claimedAt, claimed_by_user_id: userId })
    .eq('id', invite.id);

  if (claimInviteError) return { error: claimInviteError.message };

  if (previousPlayerUserId && previousPlayerUserId !== userId) {
    const stalePreviousUserError = await removeUserFromStaleTeams(adminClient, previousPlayerUserId);
    if (stalePreviousUserError) return { error: stalePreviousUserError };
  }

  const staleClaimingUserError = await removeUserFromStaleTeams(adminClient, userId, invite.player.team.id);
  if (staleClaimingUserError) return { error: staleClaimingUserError };

  const addToTargetTeamError = await addUserToTeamRoster(adminClient, invite.player.team, userId);
  if (addToTargetTeamError) return { error: addToTargetTeamError };

  return {
    data: {
      player_id: invite.player.id,
      player_tag: invite.player.tag,
      team_id: invite.player.team_id,
      team_name: invite.player.team.name,
      claimed_at: claimedAt
    } satisfies ClaimInviteResult
  };
};

const getAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const adminClient = getAdminClient();
  if (!adminClient) return Response.json({ error: 'Server auth configuration is missing.' }, { status: 500 });

  const { token } = await context.params;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data, error } = await adminClient
    .from('player_roster_invites')
    .select('expires_at,revoked_at,claimed_at,player:players(id,tag,user_id,team:teams!players_team_id_fkey(id,name,short_name,avatar))')
    .eq('token_hash', tokenHash)
    .maybeSingle<{
      expires_at: string;
      revoked_at: string | null;
      claimed_at: string | null;
      player: {
        id: string;
        tag: string;
        user_id: string | null;
        team: { id: string; name: string; short_name: string; avatar: string | null } | null;
      } | null;
    }>();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data?.player?.team) return Response.json({ error: 'Invitation not found.' }, { status: 404 });

  const status = data.claimed_at || data.revoked_at
    ? 'claimed'
    : new Date(data.expires_at).getTime() <= Date.now()
      ? 'expired'
      : 'active';

  return Response.json({
    status,
    expiresAt: data.expires_at,
    player: { id: data.player.id, tag: data.player.tag },
    team: data.player.team
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return Response.json({ error: 'Authentication is required.' }, { status: 401 });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return Response.json({ error: 'Server auth configuration is missing.' }, { status: 500 });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !user) return Response.json({ error: 'Your session is invalid or expired.' }, { status: 401 });

  const adminClient = getAdminClient();
  if (!adminClient) return Response.json({ error: 'Server auth configuration is missing.' }, { status: 500 });

  const profileError = await ensurePublicProfile(adminClient, user);
  if (profileError) return Response.json({ error: `Unable to prepare your roster profile: ${profileError}` }, { status: 500 });

  const { token } = await context.params;
  const { data, error } = await claimInviteWithAdmin(adminClient, token, user.id);
  if (error) {
    const message = error.includes('expired')
      ? 'This invitation has expired.'
      : error.includes('already been claimed') || error.includes('replaced')
        ? 'This invitation can no longer be claimed.'
        : 'Unable to claim this invitation.';
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ claim: data });
}
