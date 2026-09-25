"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { WifiOff, AlertTriangle, RefreshCw, CheckCircle2, X } from "lucide-react";

type NetworkStatus = "online" | "slow" | "offline";

interface NetworkInfo {
  status: NetworkStatus;
  latencyMs: number | null;
  lastChecked: Date | null;
  isChecking: boolean;
}

export default function NetworkStatusNotifier() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    status: "online",
    latencyMs: null,
    lastChecked: null,
    isChecking: false,
  });

  const [wasDisconnected, setWasDisconnected] = useState(false);
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const reconnectedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const failCountRef = useRef(0);

  const checkConnection = useCallback(async () => {
    // 1. Browser hardware/network status check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNetworkInfo({
        status: "offline",
        latencyMs: null,
        lastChecked: new Date(),
        isChecking: false,
      });
      setWasDisconnected(true);
      setIsDismissed(false);
      return;
    }

    setNetworkInfo((prev) => ({ ...prev, isChecking: true }));

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    try {
      const response = await fetch(`/api/ping?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      failCountRef.current = 0;

      // Check Network Information API if available in browser
      const conn = typeof navigator !== "undefined" ? (navigator as any).connection : null;
      const effectiveType = conn?.effectiveType || "";

      // Consider slow if ping latency > 2500ms OR effectiveType is slow-2g/2g
      const isSlow = latency > 2500 || effectiveType === "slow-2g" || effectiveType === "2g" || (conn?.rtt && conn.rtt > 1800);

      setNetworkInfo({
        status: isSlow ? "slow" : "online",
        latencyMs: latency,
        lastChecked: new Date(),
        isChecking: false,
      });

      if (wasDisconnected) {
        setShowReconnectedBanner(true);
        setWasDisconnected(false);
        setIsDismissed(false);
        if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
        reconnectedTimerRef.current = setTimeout(() => {
          setShowReconnectedBanner(false);
        }, 3500);
      }
    } catch {
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);
      failCountRef.current += 1;

      // Only show offline if navigator is actually offline or ping failed at least 2 times
      const isActuallyOffline = typeof navigator !== "undefined" && !navigator.onLine;
      const shouldFlagOffline = isActuallyOffline || failCountRef.current >= 2;

      setNetworkInfo({
        status: shouldFlagOffline ? "offline" : "slow",
        latencyMs: latency,
        lastChecked: new Date(),
        isChecking: false,
      });

      if (shouldFlagOffline) {
        setWasDisconnected(true);
      }
    }
  }, [wasDisconnected]);

  useEffect(() => {
    // Initial check after page settles
    const initialTimer = setTimeout(() => {
      checkConnection();
    }, 2000);

    const handleOnline = () => {
      failCountRef.current = 0;
      checkConnection();
    };

    const handleOffline = () => {
      setNetworkInfo({
        status: "offline",
        latencyMs: null,
        lastChecked: new Date(),
        isChecking: false,
      });
      setWasDisconnected(true);
      setIsDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const conn = typeof navigator !== "undefined" ? (navigator as any).connection : null;
    if (conn && conn.addEventListener) {
      conn.addEventListener("change", handleOnline);
    }

    // Background interval check every 30 seconds
    pingIntervalRef.current = setInterval(() => {
      checkConnection();
    }, 30000);

    // Tab focus check
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkConnection();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initialTimer);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener("change", handleOnline);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkConnection]);

  // Don't render if everything is normal or user dismissed
  if (networkInfo.status === "online" && !showReconnectedBanner) {
    return null;
  }

  if (isDismissed && !showReconnectedBanner) {
    return (
      <div className="fixed top-2 right-3 z-[99999]">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-md transition ${
            networkInfo.status === "offline"
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "bg-amber-500 text-slate-950 hover:bg-amber-600"
          }`}
          title="Click to view network status"
        >
          {networkInfo.status === "offline" ? (
            <>
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
              <span>Offline</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Slow Network</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none flex flex-col items-center px-3 pt-2">
      {/* ── RECONNECTED SUCCESS BANNER ── */}
      {showReconnectedBanner && networkInfo.status === "online" && (
        <div className="pointer-events-auto flex items-center gap-2.5 bg-emerald-600 text-white px-3.5 py-2 rounded-xl shadow-lg border border-emerald-400/40 animate-fade-in transition-all">
          <CheckCircle2 className="h-4 w-4 text-emerald-100 shrink-0" />
          <p className="text-xs font-semibold">Back Online &bull; Connection restored</p>
        </div>
      )}

      {/* ── OFFLINE BANNER (RED - SHORT & ENGLISH) ── */}
      {networkInfo.status === "offline" && (
        <div className="pointer-events-auto w-full max-w-lg bg-rose-600 text-white rounded-xl shadow-xl border border-rose-400/40 p-2.5 sm:px-3.5 sm:py-2.5 transition-all">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-700 ring-1 ring-white/30">
                <WifiOff className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider bg-rose-800 text-rose-100">
                    Offline
                  </span>
                  <span className="text-xs font-bold text-white truncate">No Internet Connection</span>
                </div>
                <p className="text-[11px] text-rose-100/90 truncate">Please check your network connection.</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => checkConnection()}
                disabled={networkInfo.isChecking}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 active:scale-95 transition shadow-sm disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${networkInfo.isChecking ? "animate-spin" : ""}`} />
                <span>{networkInfo.isChecking ? "Checking..." : "Retry"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="p-1 rounded-md text-rose-200 hover:text-white hover:bg-rose-700 transition"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SLOW INTERNET BANNER (AMBER - SHORT & ENGLISH) ── */}
      {networkInfo.status === "slow" && (
        <div className="pointer-events-auto w-full max-w-lg bg-amber-500 text-slate-950 rounded-xl shadow-xl border border-amber-300/60 p-2.5 sm:px-3.5 sm:py-2.5 transition-all">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white ring-1 ring-white/40">
                <AlertTriangle className="h-4 w-4 text-amber-100" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-600 text-white">
                    Slow Net
                  </span>
                  <span className="text-xs font-bold text-slate-950 truncate">Slow Internet Connection</span>
                  {networkInfo.latencyMs && (
                    <span className="text-[10px] font-semibold text-amber-950 bg-amber-400/80 px-1 rounded">
                      ~{(networkInfo.latencyMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-950/85 truncate">Requests may take longer to load.</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => checkConnection()}
                disabled={networkInfo.isChecking}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition shadow-sm disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${networkInfo.isChecking ? "animate-spin" : ""}`} />
                <span>{networkInfo.isChecking ? "Checking..." : "Retry"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="p-1 rounded-md text-amber-900 hover:text-slate-950 hover:bg-amber-400 transition"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
