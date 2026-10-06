'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

const DASHBOARD_PATH = '/dashboard';

export default function OAuthRedirectHandler() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    const completeImplicitAuth = async () => {
      if (!supabase) {
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        return;
      }

      window.history.replaceState({}, '', window.location.pathname + window.location.search);

      router.replace(DASHBOARD_PATH);
      router.refresh();
    };

    void completeImplicitAuth();
  }, [router, supabase]);

  return null;
}
