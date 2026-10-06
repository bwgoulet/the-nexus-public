import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

type InvitePayload = {
  playerId?: string;
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

  const payload = (await request.json()) as InvitePayload;
  const playerId = payload.playerId?.trim();
  if (!playerId) return Response.json({ error: 'A roster player is required.' }, { status: 400 });

  const { data: player, error: playerError } = await clients.adminClient
    .from('players')
    .select('id,tag,user_id,team_id,team:teams!players_team_id_fkey(id,name,director_user_id)')
    .eq('id', playerId)
    .maybeSingle<{
      id: string;
      tag: string;
      user_id: string | null;
      team_id: string | null;
      team: { id: string; name: string; director_user_id: string | null } | null;
    }>();

  if (playerError) return Response.json({ error: playerError.message }, { status: 500 });
  if (!player?.team) return Response.json({ error: 'This player is not assigned to a team.' }, { status: 404 });
  const { data: profile } = await clients.adminClient.from('users').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
  if (profile?.role !== 'mod' && player.team.director_user_id !== user.id) {
    return Response.json({ error: 'Only the team director or a Nexus moderator can invite this player.' }, { status: 403 });
  }

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: expireError } = await clients.adminClient
    .from('player_roster_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('player_id', player.id)
    .is('claimed_at', null)
    .is('revoked_at', null);
  if (expireError) return Response.json({ error: expireError.message }, { status: 500 });

  const { error: inviteError } = await clients.adminClient.from('player_roster_invites').insert({
    player_id: player.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by_user_id: user.id
  });
  if (inviteError) return Response.json({ error: inviteError.message }, { status: 500 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const claimUrl = new URL(`/roster/claim/${rawToken}`, siteUrl).toString();
  return Response.json({ claimUrl, expiresAt, playerTag: player.tag, teamName: player.team.name });
}
