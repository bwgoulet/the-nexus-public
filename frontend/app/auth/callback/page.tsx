'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();

  useEffect(() => {
    const completeOAuth = async () => {
      if (!supabase) {
        router.replace('/signup?error=auth-unavailable');
        return;
      }

      const authCode = searchParams.get('code');
      const authError = searchParams.get('error_description') ?? searchParams.get('error');

      if (authError) {
        const encodedError = encodeURIComponent(authError);
        router.replace(`/signup?error=${encodedError}`);
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);

        if (error) {
          router.replace(`/signup?error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/signup?error=Unable%20to%20load%20your%20account');
        return;
      }

      const syncResponse = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          user_metadata: user.user_metadata
        })
      });

      if (!syncResponse.ok) {
        const syncError = await syncResponse.json().catch(() => ({ error: 'Account setup failed.' }));
        const errorMessage =
          typeof syncError.error === 'string' ? syncError.error : 'Unable to finish account setup. Please try again.';
        router.replace(`/signup?error=${encodeURIComponent(errorMessage)}`);
        return;
      }

      const requestedNext = searchParams.get('next');
      const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/dashboard';

      router.replace(nextPath);
      router.refresh();
    };

    void completeOAuth();
  }, [router, searchParams, supabase]);

  return (
    <section>
      <h1>Signing you in...</h1>
      <p className="muted">Completing secure sign in. You will be redirected automatically.</p>
    </section>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className="muted">Preparing secure sign in...</p>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
