'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const ANIMATED_PUBLIC_ROUTES = [
  '/',
  '/about',
  '/join',
  '/matches',
  '/rulebook',
  '/schedule',
  '/standings',
  '/signup',
  '/login',
  '/onboarding',
  '/school-registration'
];

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

function isAnimatedPublicRoute(pathname: string) {
  if (pathname.endsWith('/live')) {
    return false;
  }

  return ANIMATED_PUBLIC_ROUTES.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(`${route}/`))
  );
}

function hasConstrainedNetwork() {
  const navigatorWithConnection = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  const connection =
    navigatorWithConnection.connection ??
    navigatorWithConnection.mozConnection ??
    navigatorWithConnection.webkitConnection;

  return Boolean(
    connection?.saveData ||
      connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '2g'
  );
}

export default function BackgroundLayer() {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const shouldAnimate = isAnimatedPublicRoute(pathname);
  const isLiveMatchRoom = /^\/matches\/[^/]+\/live(?:\/|$)/.test(pathname);

  useEffect(() => {
    if (
      !shouldAnimate ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      hasConstrainedNetwork()
    ) {
      return;
    }

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadAfterCriticalContent = () => {
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(() => setShouldLoadVideo(true), { timeout: 2500 });
      } else {
        timeoutId = globalThis.setTimeout(() => setShouldLoadVideo(true), 1200);
      }
    };

    if (document.readyState === 'complete') {
      loadAfterCriticalContent();
    } else {
      window.addEventListener('load', loadAfterCriticalContent, { once: true });
    }

    return () => {
      window.removeEventListener('load', loadAfterCriticalContent);
      if (idleId !== undefined) {
        window.cancelIdleCallback?.(idleId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [shouldAnimate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoadVideo || !shouldAnimate) {
      return;
    }

    video.load();
    void video.play().catch((error: unknown) => {
      setIsPlaying(false);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Nexus BG] Deferred playback was unavailable.', error);
      }
    });
  }, [shouldAnimate, shouldLoadVideo]);

  // The live room supplies its own background as part of its first stable
  // loading shell. Avoid making this global layer another full-viewport paint
  // and LCP candidate on that performance-sensitive route.
  if (isLiveMatchRoom) return null;

  return (
    <>
      <div className="app-background" aria-hidden="true">
        {shouldAnimate ? (
          <video
            ref={videoRef}
            className={`app-background-video${isPlaying ? ' is-playing' : ''}`}
            muted
            loop
            playsInline
            preload="none"
            poster="/backgrounds/Nexus BG.jpg"
            onPlaying={() => setIsPlaying(true)}
            onError={() => setIsPlaying(false)}
          >
            {shouldLoadVideo ? (
              <source src="/video/Nexus_Animated_BG.webm" type="video/webm" />
            ) : null}
          </video>
        ) : null}
      </div>
      <div className="app-overlay" />
    </>
  );
}
