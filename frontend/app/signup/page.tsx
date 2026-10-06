'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { NEW_USER_PROFILE } from '@/lib/new-user-profile';
import { getSupabaseClient } from '@/lib/supabase';
import { RiDiscordFill, RiGoogleFill, RiEyeFill, RiEyeOffFill } from '@remixicon/react';


export default function SignupPage() {
  const supabase = getSupabaseClient();
  const [isSignupView, setIsSignupView] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordRecoveryView, setIsPasswordRecoveryView] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const authErrorFromQuery = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    const authError = new URLSearchParams(window.location.search).get('error');
    return authError ? decodeURIComponent(authError) : '';
  }, []);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSocialSubmitting, setIsSocialSubmitting] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null;

  const clearMessages = useCallback(() => {
    setErrorMessage('');
    setNoticeMessage('');
  }, []);

  const normalizeEmail = (rawEmail: string) => rawEmail.trim().toLowerCase();

  const getLoginErrorMessage = (code: string | undefined, fallbackMessage: string) => {
    if (code === 'invalid_credentials') {
      return 'We could not sign you in with that email and password. If this email exists in our player records, finish creating your login in Sign Up or reset your password.';
    }

    if (code === 'email_not_confirmed') {
      return 'Your account exists, but sign-in has not finalized yet. Wait a moment and try again.';
    }

    return fallbackMessage;
  };

  const syncAuthenticatedUser = useCallback(async () => {
    if (!supabase) {
      return { ok: false, error: 'Authentication is unavailable right now.' };
    }

    const {
      data: { user },
      error: getUserError
    } = await supabase.auth.getUser();

    if (getUserError || !user || !user.email) {
      return { ok: false, error: getUserError?.message ?? 'Unable to load your account details.' };
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
      const syncError = await syncResponse.json().catch(() => ({ error: 'Unable to finish account setup.' }));
      const errorMessage =
        typeof syncError.error === 'string' ? syncError.error : 'Unable to finish account setup. Please try again.';
      return { ok: false, error: errorMessage };
    }

    return { ok: true };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSignedInEmail(data.session?.user.email ?? '');
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      setSignedInEmail(session?.user.email ?? '');

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryView(true);
        setIsSignupView(false);
        clearMessages();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearMessages, supabase]);

  const unavailableNoticeMessage = !supabase
    ? 'Authentication is temporarily unavailable. Configure Supabase env vars to enable login.'
    : '';

  const getSignupErrorMessage = (code: string | undefined, fallbackMessage: string) => {
    if (code === 'over_email_send_rate_limit') {
      return 'Supabase email rate limit exceeded. Wait a few minutes, or log in if this account was already created.';
    }

    if (code === 'email_exists' || code === 'user_already_exists') {
      return 'An account with this email already exists. Log in instead, or use Forgot Password to regain access.';
    }

    if (code === 'weak_password') {
      return 'That password does not meet the authentication server\'s requirements. Use at least 8 characters and avoid commonly used passwords.';
    }

    return fallbackMessage;
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();
    if (!supabase) {
      setErrorMessage('Authentication is unavailable right now.');
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setErrorMessage('Enter your email address to sign in.');
      return;
    }

    if (!password) {
      setErrorMessage('Enter your password to sign in.');
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(getLoginErrorMessage(error.code, error.message));
      return;
    }

    if (!data.session) {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage('Sign in succeeded, but no active session was found. Please try again.');
        return;
      }
    }

    const syncResult = await syncAuthenticatedUser();
    if (!syncResult.ok) {
      setErrorMessage(syncResult.error);
      return;
    }

    router.replace(nextPath ?? '/dashboard');
    router.refresh();
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();
    if (!supabase) {
      setErrorMessage('Authentication is unavailable right now.');
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setErrorMessage('Enter an email address to create your account.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    const createUserResponse = await fetch('/api/auth/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: newPassword,
        profile: NEW_USER_PROFILE
      })
    });

    if (!createUserResponse.ok) {
      const signupError = await createUserResponse
        .json()
        .catch(() => ({ error: 'Unable to create your account. Please try again.' }));
      setIsSubmitting(false);
      const message = getSignupErrorMessage(
          typeof signupError.code === 'string' ? signupError.code : undefined,
          typeof signupError.error === 'string' ? signupError.error : 'Unable to create your account. Please try again.'
        );
      const detail = typeof signupError.details === 'string' ? signupError.details : '';
      const reference = typeof signupError.reference === 'string' ? signupError.reference : '';
      const additionalContext = detail && detail !== message ? ` Technical detail: ${detail}` : '';
      const supportReference = reference ? ` Support reference: ${reference}.` : '';
      setErrorMessage(`${message}${additionalContext}${supportReference}`);
      return;
    }

    const {
      data: { session: activeSession }
    } = await supabase.auth.getSession();

    if (activeSession) {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setIsSubmitting(false);
        setErrorMessage(signOutError.message);
        return;
      }
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: newPassword
    });

    if (loginError) {
      setIsSubmitting(false);
      setErrorMessage(getLoginErrorMessage(loginError.code, loginError.message));
      return;
    }

    const syncResult = await syncAuthenticatedUser();
    setIsSubmitting(false);

    if (!syncResult.ok) {
      setErrorMessage(syncResult.error);
      return;
    }

    router.replace(nextPath ?? '/onboarding');
    router.refresh();
  };

  const handleSignOut = async () => {
    clearMessages();
    if (!supabase) {
      setErrorMessage('Authentication is unavailable right now.');
      return;
    }

    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSignedInEmail('');
    setNoticeMessage('You have been signed out. You can now log in or create another account.');
    router.refresh();
  };

  const handleOAuth = async (provider: 'google' | 'discord') => {
    clearMessages();
    if (!supabase) {
      setErrorMessage('Authentication is unavailable right now.');
      return;
    }

    const redirectHost = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const redirectTo = new URL('/auth/callback', redirectHost);
    redirectTo.searchParams.set('next', nextPath ?? '/onboarding');

    setIsSocialSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo.toString()
      }
    });
    setIsSocialSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();
    if (!supabase) {
      setErrorMessage('Authentication is unavailable right now.');
      return;
    }
    if (!email) {
      setErrorMessage('Enter your email address first so we can send a reset link.');
      return;
    }

    setIsSubmitting(true);
    const redirectHost = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const resetRedirectTo = new URL('/signup', redirectHost);
    resetRedirectTo.searchParams.set('mode', 'reset-password');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectTo.toString()
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNoticeMessage('Password reset email sent. Open the email link to set a new password.');
  };

  const handleRecoveryPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();
    if (!supabase) {
      setErrorMessage('Authentication is unavailable right now.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setIsPasswordRecoveryView(false);
    setNoticeMessage('Password updated. You can now sign in with your new password.');
  };

  const toggleView = () => {
    setIsSignupView((current) => !current);
    clearMessages();
    setIsSubmitting(false);
  };

  return (
    <section className="auth-shell">
      <div className="login-modal card">
        {signedInEmail && !isPasswordRecoveryView ? (
          <div className="signed-in-auth-notice" role="status">
            <span>Signed in as {signedInEmail}</span>
            <button
              type="button"
              className="link-button"
              onClick={handleSignOut}
              disabled={isSubmitting || isSocialSubmitting || isSigningOut}
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        ) : null}
        <Image
          src="/logos/Primary/SVG/Nexus Emerald.svg"
          alt="The Nexus"
          width={60}
          height={60}
          className="login-logo"
          priority
        />
        <h1 className="login-title">{isPasswordRecoveryView ? 'Reset Your Password' : isSignupView ? 'Join the Nexus' : 'Return to The Nexus'}</h1>
        {isPasswordRecoveryView ? (
          <form className="login-form" onSubmit={handleRecoveryPasswordReset}>
            <label className="field-label">
              <span>New Password <span className="required">*</span></span>
              <span className="input-with-icon">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="field-icon-button"
                  onClick={() => setShowNewPassword((current) => !current)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <RiEyeOffFill /> : <RiEyeFill />}
                </button>
              </span>
            </label>
            <label className="field-label">
              <span>Confirm Password <span className="required">*</span></span>
              <span className="input-with-icon">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="field-icon-button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <RiEyeOffFill /> : <RiEyeFill />}
                </button>
              </span>
            </label>
            <button type="submit" className="signin-button" disabled={isSubmitting || isSocialSubmitting || isSigningOut}>
              {isSubmitting ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        ) : isSignupView ? (
          <form className="login-form" onSubmit={handleSignup}>
            <label className="field-label">
              <span>Email <span className="required">*</span></span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="field-label">
              <span>New Password <span className="required">*</span></span>
              <span className="input-with-icon">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="field-icon-button"
                  onClick={() => setShowNewPassword((current) => !current)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <RiEyeOffFill /> : <RiEyeFill />}
                </button>
              </span>
            </label>
            <label className="field-label">
              <span>Confirm Password <span className="required">*</span></span>
              <span className="input-with-icon">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="field-icon-button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <RiEyeOffFill /> : <RiEyeFill />}
                </button>
              </span>
            </label>
            <button type="submit" className="signin-button" disabled={isSubmitting || isSocialSubmitting || isSigningOut}>
              {isSubmitting ? 'Creating Account...' : 'Sign Up'}
            </button>
            <p className="auth-legal-consent">
              By creating an account, you agree to The Nexus{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>.
            </p>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <label className="field-label">
              <span>Email <span className="required">*</span></span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="field-label">
              <span>Password <span className="required">*</span></span>
              <span className="input-with-icon">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="field-icon-button"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <RiEyeOffFill /> : <RiEyeFill />}
                </button>
              </span>
            </label>
            <button type="submit" className="signin-button" disabled={isSubmitting || isSocialSubmitting || isSigningOut}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="link-button forgot-password-link"
              onClick={handleForgotPassword}
              disabled={isSubmitting || isSocialSubmitting || isSigningOut}
            >
              Forgot Password?
            </button>
          </form>
        )}

        {(errorMessage || authErrorFromQuery || noticeMessage || unavailableNoticeMessage) && (
          <p
            className={errorMessage || authErrorFromQuery ? 'status-text status-error' : 'status-text status-notice'}
            role="status"
          >
            {errorMessage || authErrorFromQuery || noticeMessage || unavailableNoticeMessage}
          </p>
        )}

        {!isPasswordRecoveryView && <div className="social-divider" />}

        {!isPasswordRecoveryView && <div className="social-actions">
          <button
            type="button"
            className="social-button social-button-google"
            onClick={() => handleOAuth('google')}
            disabled={isSubmitting || isSocialSubmitting || isSigningOut}
          >
            <span className="social-brand-icon" aria-hidden>
              <RiGoogleFill />
            </span>
            <span>{isSignupView ? 'Sign up with Google' : 'Sign in with Google'}</span>
          </button>
          <button
            type="button"
            className="social-button social-button-discord"
            onClick={() => handleOAuth('discord')}
            disabled={isSubmitting || isSocialSubmitting || isSigningOut}
          >
            <span className="social-brand-icon" aria-hidden>
              <RiDiscordFill />
            </span>
            <span>{isSignupView ? 'Sign up with Discord' : 'Sign in with Discord'}</span>
          </button>
        </div>}

        {!isPasswordRecoveryView && <p className="signup-copy">
          {isSignupView ? 'Already have an account?' : 'Need an account?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={toggleView}
          >
            {isSignupView ? 'Log In' : 'Sign Up'}
          </button>
        </p>}
      </div>
    </section>
  );
}
