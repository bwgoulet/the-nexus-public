import type { SupabaseClient } from '@supabase/supabase-js';

import type { DirectorAssignment, DirectorReassignmentResult, Team } from '@/lib/data';

export const DIRECTOR_ROLES = ['director', 'member_director', 'pro_director', 'exclusive_director'] as const;

type AssignmentTeam = Pick<Team, 'id' | 'name' | 'short_name' | 'director_user_id'>;

export async function loadDirectorAssignments(supabase: SupabaseClient) {
  const [{ data: users, error: usersError }, { data: teams, error: teamsError }] = await Promise.all([
    supabase.from('users').select('id,first_name,last_name,tag,email,role').in('role', [...DIRECTOR_ROLES]).order('tag'),
    supabase.from('teams').select('id,name,short_name,director_user_id').order('name')
  ]);

  if (usersError) throw usersError;
  if (teamsError) throw teamsError;

  const typedTeams = (teams ?? []) as AssignmentTeam[];
  const assignments = (users ?? []).map((user) => ({
    ...user,
    team: typedTeams.find((team) => team.director_user_id === user.id) ?? null
  })) as DirectorAssignment[];

  return { directors: assignments, teams: typedTeams };
}

export async function reassignDirector(
  supabase: SupabaseClient,
  directorUserId: string,
  destinationTeamId: string,
  replaceDestinationDirector: boolean
) {
  const { data, error } = await supabase.rpc('reassign_team_director', {
    requested_director_user_id: directorUserId,
    requested_destination_team_id: destinationTeamId,
    replace_destination_director: replaceDestinationDirector
  });

  if (error) throw error;
  return data as DirectorReassignmentResult;
}

export function directorLabel(director: DirectorAssignment) {
  return director.tag?.trim() || `${director.first_name} ${director.last_name}`.trim() || director.email;
}
