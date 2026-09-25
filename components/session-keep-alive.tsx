"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the Cognito session alive by silently refreshing the ID token before
 * it expires (~1 hour). Without this, an active user is logged out after the
 * token lifetime.
 *
 * IMPORTANT: this is best-effort only. It NEVER redirects the user itself — a
 * failed refresh (e.g. an older session created before this feature shipped,
 * or a transient network/JWKS blip) must not kick an otherwise-valid session
 * out. Actual logout is left to the server-side layout guard, which redirects
 * to /login only when there is genuinely no valid session cookie. This avoids
 * the "switch tabs, come back, suddenly logged out" problem.
 *
 * Runs every 45 minutes and on tab re-focus (but at most once every few
 * minutes, so flipping tabs quickly doesn't hammer the endpoint).
 */
const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes (token lives ~60)
const MIN_REFRESH_GAP_MS = 5 * 60 * 1000; // don't refresh more than once / 5 min

export default function SessionKeepAlive() {
  const lastRefreshRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    async function refresh() {
      const now = Date.now();
      if (inFlightRef.current) return;
      if (now - lastRefreshRef.current < MIN_REFRESH_GAP_MS) return;
      inFlightRef.current = true;
      try {
        await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
        // Intentionally ignore the result. On success the cookie is renewed;
        // on failure we do nothing (no redirect) and let the session expire
        // naturally — the server guard handles a truly-dead session.
        lastRefreshRef.current = Date.now();
      } catch {
        // Network blip — ignore; the next tick or focus will try again.
      } finally {
        inFlightRef.current = false;
      }
    }

    // Kick one off shortly after mount so a fresh session gets its refresh
    // cookie/rotation established, but not instantly (let the page settle).
    const initial = setTimeout(refresh, 30 * 1000);
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
