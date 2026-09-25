"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the Cognito session alive by silently refreshing the ID token before
 * it expires (~1 hour). Without this, an active user is logged out after the
 * token lifetime. Runs every 45 minutes and also on tab re-focus. If the
 * refresh token itself has expired (after 30 days) the endpoint returns 401
 * and we send the user to /login.
 */
const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes (token lives ~60)

export default function SessionKeepAlive() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          cache: "no-store",
        });
        if (!res.ok && res.status === 401 && !cancelled) {
          // Refresh token expired/revoked — session is truly over.
          router.push("/login");
        }
      } catch {
        // Network blip — ignore; the next tick will try again.
      }
    }

    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);

    // Also refresh when the user returns to the tab, in case the machine slept
    // past the interval (timers don't fire reliably while a tab is backgrounded).
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
