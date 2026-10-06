import { createClient } from '@supabase/supabase-js';

const getServerClients = (accessToken: string) => {
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

export async function DELETE(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return Response.json({ error: 'Authentication is required.' }, { status: 401 });

  const clients = getServerClients(accessToken);
  if (!clients) return Response.json({ error: 'Server auth configuration is missing.' }, { status: 500 });

  const {
    data: { user },
    error: userError
  } = await clients.userClient.auth.getUser(accessToken);
  if (userError || !user) return Response.json({ error: 'Your session is invalid or expired.' }, { status: 401 });

  const { data: profile, error: profileError } = await clients.adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (profile?.role !== 'mod') return Response.json({ error: 'Only Nexus moderators can delete matches.' }, { status: 403 });

  const { matchId } = await params;
  const { data: deletedMatch, error: deleteError } = await clients.adminClient
    .from('matches')
    .delete()
    .eq('id', matchId)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });
  if (!deletedMatch) return Response.json({ error: 'Match not found.' }, { status: 404 });

  return Response.json({ deleted: true });
}
