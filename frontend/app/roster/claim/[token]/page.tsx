'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

type InviteDetails = {
  status: 'active' | 'expired' | 'claimed';
  expiresAt: string;
  player: { id: string; tag: string };
  team: { id: string; name: string; short_name: string; avatar: string | null };
};

export default function RosterClaimPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const token = params.token;
  const claimPath = `/roster/claim/${encodeURIComponent(token)}`;
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState('');
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [inviteResponse, sessionResult] = await Promise.all([
        fetch(`/api/roster/invites/${encodeURIComponent(token)}`),
        supabase?.auth.getSession()
      ]);
      const body = await inviteResponse.json().catch(() => ({ error: 'Unable to load invitation.' }));
      if (!mounted) return;
      if (!inviteResponse.ok) setError(typeof body.error === 'string' ? body.error : 'Unable to load invitation.');
      else setInvite(body as InviteDetails);
      setIsSignedIn(Boolean(sessionResult?.data.session));
      setIsLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [supabase, token]);

  const claimInvite = async () => {
    if (!supabase) return;
    setError('');
    setIsClaiming(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/signup?next=${encodeURIComponent(claimPath)}`);
      return;
    }

    const response = await fetch(`/api/roster/invites/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const body = await response.json().catch(() => ({ error: 'Unable to claim invitation.' }));
    setIsClaiming(false);
    if (!response.ok) {
      setError(typeof body.error === 'string' ? body.error : 'Unable to claim invitation.');
      return;
    }
    setClaimed(true);
  };

  if (isLoading) {
    return <section className="auth-shell"><article className="login-modal card"><p className="muted">Loading roster invitation…</p></article></section>;
  }

  return (
    <section className="auth-shell roster-claim-shell">
      <article className="login-modal card roster-claim-card">
        {invite?.team.avatar ? <Image src={invite.team.avatar} alt="" width={84} height={84} unoptimized /> : null}
        <p className="kicker"><span /> Roster invitation</p>
        {claimed ? (
          <>
            <h1>You’re on the roster.</h1>
            <p>Your Nexus account is now linked to <strong>{invite?.player.tag}</strong> on <strong>{invite?.team.name}</strong>.</p>
            <button type="button" className="signin-button" onClick={() => router.replace('/dashboard')}>Continue to dashboard</button>
          </>
        ) : invite ? (
          <>
            <h1>Claim {invite.player.tag}</h1>
            <p>
              You were invited to link your authenticated Nexus account to the existing
              <strong> {invite.player.tag}</strong> roster entry for <strong>{invite.team.name}</strong> ({invite.team.short_name}).
            </p>
            <div className="roster-claim-summary">
              <span>Team<strong>{invite.team.name}</strong></span>
              <span>Roster identity<strong>{invite.player.tag}</strong></span>
              <span>Expires<strong>{new Date(invite.expiresAt).toLocaleString()}</strong></span>
            </div>
            {invite.status === 'active' ? (
              isSignedIn ? (
                <>
                  <p className="muted">Confirm only if this is your roster identity. This does not create a duplicate player or change teams.</p>
                  <button type="button" className="signin-button" disabled={isClaiming} onClick={() => void claimInvite()}>
                    {isClaiming ? 'Linking account…' : `Confirm and claim ${invite.player.tag}`}
                  </button>
                </>
              ) : (
                <>
                  <p className="muted">Sign in or create an account to continue. You will return to this invitation afterward.</p>
                  <button type="button" className="signin-button" onClick={() => router.push(`/signup?next=${encodeURIComponent(claimPath)}`)}>Sign in to claim</button>
                </>
              )
            ) : (
              <p className="status-text status-error">This invitation has {invite.status === 'expired' ? 'expired' : 'already been used or replaced'}.</p>
            )}
          </>
        ) : null}
        {error ? <p className="status-text status-error">{error}</p> : null}
      </article>
    </section>
  );
}
