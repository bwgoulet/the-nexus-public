import { createClient } from '@supabase/supabase-js';
import { isDirectorRole } from '@/lib/roles';

type CreateRosterPlayerPayload = {
  tag?: string;
};

type RemoveRosterPlayerPayload = {
  playerId?: string;
};

type UpdateRosterPlayerPayload = {
  playerId?: string;
  tag?: string;
};

const getClients = (accessToken: string) => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    userClient: createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    }),
    adminClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
};

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return Response.json({ error: 'Authentication is required.' }, { status: 401 });

  const clients = getClients(accessToken);
  if (!clients) return Response.json({ error: 'Server auth configuration is missing.' }, { status: 500 });

  const { data: { user }, error: userError } = await clients.userClient.auth.getUser(accessToken);
  if (userError || !user) return Response.json({ error: 'Your session is invalid or expired.' }, { status: 401 });

  const payload = (await request.json()) as CreateRosterPlayerPayload;
  const tag = payload.tag?.trim();
  if (!tag) return Response.json({ error: 'A player tag is required.' }, { status: 400 });
  if (tag.length > 50) return Response.json({ error: 'Player tags must be 50 characters or fewer.' }, { status: 400 });

  const { data: profile, error: profileError } = await clients.adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!isDirectorRole(profile?.role)) {
    return Response.json({ error: 'Only directors can add players from the dashboard.' }, { status: 403 });
  }

  const { data: team, error: teamError } = await clients.adminClient
    .from('teams')
    .select('id')
    .eq('director_user_id', user.id)
    .maybeSingle<{ id: string }>();

  if (teamError) return Response.json({ error: teamError.message }, { status: 500 });
  if (!team) return Response.json({ error: 'You must manage a team before adding roster players.' }, { status: 404 });

  const { data: existingPlayer, error: existingPlayerError } = await clients.adminClient
    .from('players')
    .select('id')
    .eq('team_id', team.id)
    .ilike('tag', tag)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingPlayerError) return Response.json({ error: existingPlayerError.message }, { status: 500 });
  if (existingPlayer) return Response.json({ error: `${tag} is already on your roster.` }, { status: 409 });

  const { data: player, error: playerError } = await clients.adminClient
    .from('players')
    .insert({ team_id: team.id, tag })
    .select('id,tag,team_id,user_id,is_captain')
    .single();

  if (playerError) return Response.json({ error: playerError.message }, { status: 500 });
  return Response.json({ player }, { status: 201 });
}

export async function PATCH(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return Response.json({ error: 'Authentication is required.' }, { status: 401 });

  const clients = getClients(accessToken);
  if (!clients) return Response.json({ error: 'Server auth configuration is missing.' }, { status: 500 });

  const { data: { user }, error: userError } = await clients.userClient.auth.getUser(accessToken);
  if (userError || !user) return Response.json({ error: 'Your session is invalid or expired.' }, { status: 401 });

  const payload = (await request.json()) as UpdateRosterPlayerPayload;
  const playerId = payload.playerId?.trim();
  const tag = payload.tag?.trim();
  if (!playerId) return Response.json({ error: 'A roster player is required.' }, { status: 400 });
  if (!tag) return Response.json({ error: 'A player tag is required.' }, { status: 400 });
  if (tag.length > 50) return Response.json({ error: 'Player tags must be 50 characters or fewer.' }, { status: 400 });

  const { data: profile, error: profileError } = await clients.adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!isDirectorRole(profile?.role)) {
    return Response.json({ error: 'Only directors can edit players from the dashboard.' }, { status: 403 });
  }

  const { data: team, error: teamError } = await clients.adminClient
    .from('teams')
    .select('id')
    .eq('director_user_id', user.id)
    .maybeSingle<{ id: string }>();

  if (teamError) return Response.json({ error: teamError.message }, { status: 500 });
  if (!team) return Response.json({ error: 'You must manage a team before editing roster players.' }, { status: 404 });

  const { data: player, error: playerError } = await clients.adminClient
    .from('players')
    .select('id,tag,team_id,user_id,is_captain')
    .eq('id', playerId)
    .maybeSingle<{ id: string; tag: string; team_id: string | null; user_id: string | null; is_captain: boolean }>();

  if (playerError) return Response.json({ error: playerError.message }, { status: 500 });
  if (!player || player.team_id !== team.id) {
    return Response.json({ error: 'This player is not on your roster.' }, { status: 404 });
  }

  const { data: existingPlayer, error: existingPlayerError } = await clients.adminClient
    .from('players')
    .select('id')
    .eq('team_id', team.id)
    .ilike('tag', tag)
    .neq('id', player.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingPlayerError) return Response.json({ error: existingPlayerError.message }, { status: 500 });
  if (existingPlayer) return Response.json({ error: `${tag} is already on your roster.` }, { status: 409 });

  const { data: updatedPlayer, error: updateError } = await clients.adminClient
    .from('players')
    .update({ tag })
    .eq('id', player.id)
    .eq('team_id', team.id)
    .select('id,tag,team_id,user_id,is_captain')
    .single();

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
  return Response.json({ player: updatedPlayer });
}

export async function DELETE(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return Response.json({ error: 'Authentication is required.' }, { status: 401 });

  const clients = getClients(accessToken);
  if (!clients) return Response.json({ error: 'Server auth configuration is missing.' }, { status: 500 });

  const { data: { user }, error: userError } = await clients.userClient.auth.getUser(accessToken);
  if (userError || !user) return Response.json({ error: 'Your session is invalid or expired.' }, { status: 401 });

  const payload = (await request.json()) as RemoveRosterPlayerPayload;
  const playerId = payload.playerId?.trim();
  if (!playerId) return Response.json({ error: 'A roster player is required.' }, { status: 400 });

  const { data: profile, error: profileError } = await clients.adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!isDirectorRole(profile?.role)) {
    return Response.json({ error: 'Only directors can remove players from the dashboard.' }, { status: 403 });
  }

  const { data: team, error: teamError } = await clients.adminClient
    .from('teams')
    .select('id')
    .eq('director_user_id', user.id)
    .maybeSingle<{ id: string }>();

  if (teamError) return Response.json({ error: teamError.message }, { status: 500 });
  if (!team) return Response.json({ error: 'You must manage a team before removing roster players.' }, { status: 404 });

  const { data: player, error: playerError } = await clients.adminClient
    .from('players')
    .select('id,tag,team_id')
    .eq('id', playerId)
    .maybeSingle<{ id: string; tag: string; team_id: string | null }>();

  if (playerError) return Response.json({ error: playerError.message }, { status: 500 });
  if (!player || player.team_id !== team.id) {
    return Response.json({ error: 'This player is not on your roster.' }, { status: 404 });
  }

  const { error: updateError } = await clients.adminClient
    .from('players')
    .update({ team_id: null, is_captain: false })
    .eq('id', player.id)
    .eq('team_id', team.id);

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  const { error: inviteError } = await clients.adminClient
    .from('player_roster_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('player_id', player.id)
    .is('claimed_at', null)
    .is('revoked_at', null);

  if (inviteError) return Response.json({ error: inviteError.message }, { status: 500 });

  return Response.json({ playerId: player.id, playerTag: player.tag });
}
