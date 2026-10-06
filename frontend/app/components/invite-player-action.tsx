'use client';

import { useState } from 'react';
import { RiFileCopyFill, RiSendInsFill } from '@remixicon/react';
import { getSupabaseClient } from '@/lib/supabase';

type InvitePlayerActionProps = {
  playerId: string;
  playerTag: string;
  compact?: boolean;
};

export function InvitePlayerAction({ playerId, playerTag, compact = false }: InvitePlayerActionProps) {
  const supabase = getSupabaseClient();
  const [claimUrl, setClaimUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState('');
  const [showCopied, setShowCopied] = useState(false);

  const triggerCopied = () => {
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const createInvite = async () => {
    if (!supabase) return;
    setIsCreating(true);
    setNotice('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNotice('Sign in again to create an invitation.');
      setIsCreating(false);
      return;
    }

    const response = await fetch('/api/roster/invites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ playerId })
    });
    const body = await response.json().catch(() => ({ error: 'Unable to create invitation.' }));
    setIsCreating(false);

    if (!response.ok || typeof body.claimUrl !== 'string') {
      setNotice(typeof body.error === 'string' ? body.error : 'Unable to create invitation.');
      return;
    }

    setClaimUrl(body.claimUrl);
    try {
      await navigator.clipboard.writeText(body.claimUrl);
      triggerCopied();
    } catch {
      setNotice('Invitation created. Use Copy link to copy it.');
    }
  };

  const copyInvite = async () => {
    if (!claimUrl) return;
    try {
      await navigator.clipboard.writeText(claimUrl);
      triggerCopied();
    } catch {
      setNotice('Copy failed — check browser permissions.');
    }
  };

  return (
    <div className={compact ? 'roster-invite-action is-compact' : 'roster-invite-action'}>
      <button type="button" onClick={() => void createInvite()} disabled={isCreating}>
        <RiSendInsFill size={15} aria-hidden="true" />
        {isCreating ? 'Creating…' : claimUrl ? 'Resend invite' : 'Invite player'}
      </button>
      {claimUrl ? (
        <button
          type="button"
          onClick={() => void copyInvite()}
          className={showCopied ? 'is-copied' : undefined}
        >
          <RiFileCopyFill size={15} aria-hidden="true" />
          {showCopied ? `Copied!` : 'Copy link'}
        </button>
      ) : null}
      {notice ? <small role="status">{notice}</small> : null}
    </div>
  );
}
