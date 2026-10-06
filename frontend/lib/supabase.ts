import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let warnedMissingEnv = false;
let supabaseClient: ReturnType<typeof createClient> | null | undefined;

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const getSupabaseClient = () => {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!warnedMissingEnv) {
      // eslint-disable-next-line no-console
      console.warn('Supabase env vars are missing. Falling back to static seed data.');
      warnedMissingEnv = true;
    }

    supabaseClient = null;
    return supabaseClient;
  }

  if (process.env.NODE_ENV === 'production' && !isHttpsUrl(supabaseUrl)) {
    // eslint-disable-next-line no-console
    console.warn('NEXT_PUBLIC_SUPABASE_URL must use https in production. Falling back to static seed data.');
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
};
