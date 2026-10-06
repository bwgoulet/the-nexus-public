import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  LiveMatchActionResult,
  LiveRoomRpcArguments,
  LiveRoomRpcName,
  LiveMatchRoomSnapshot,
} from '@/lib/data';

const isSnapshot = (value: unknown): value is LiveMatchRoomSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { fixture?: unknown; players?: unknown; viewer?: unknown };
  return Boolean(candidate.fixture && candidate.viewer && Array.isArray(candidate.players));
};

/** Typed boundary for transactional mutations of the live-room state machine. */
export class LiveRoomService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getLiveMatchRoomSnapshot(matchIdOrSlug: string): Promise<LiveMatchRoomSnapshot> {
    const { data, error } = await this.supabase.rpc('get_live_match_room_snapshot', {
      target_match_slug: matchIdOrSlug,
    });
    if (error) throw new Error(error.message);
    if (!isSnapshot(data)) throw new Error('The live-room snapshot response was invalid.');
    return data;
  }

  async execute<Name extends LiveRoomRpcName>(
    name: Name,
    args: LiveRoomRpcArguments[Name],
  ): Promise<{ data: LiveMatchActionResult | null; error: Error | null }> {
    const { data, error } = await this.supabase.rpc(name, args);
    return {
      data: data as LiveMatchActionResult | null,
      error: error ? new Error(error.message) : null,
    };
  }
}
