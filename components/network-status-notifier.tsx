"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { WifiOff, AlertTriangle, Wifi, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

type NetworkStatus = "online" | "slow" | "offline";

interface NetworkInfo {
  status: NetworkStatus;
  latencyMs: number | null;
  effectiveType?: string;
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
  const [isMinimized, setIsMinimized] = useState(false);
  const reconnectedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkConnection = useCallback(async () => {
    // 1. Quick navigator check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNetworkInfo((prev) => ({
        ...prev,
        status: "offline",
        latencyMs: null,
        lastChecked: new Date(),
        isChecking: false,
      }));
      setWasDisconnected(true);
      return;
    }

    setNetworkInfo((prev) => ({ ...prev, isChecking: true }));

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout threshold

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

      // Check Network Information API if available
      const conn = typeof navigator !== "undefined" ? (navigator as any).connection : null;
      const effectiveType = conn?.effectiveType || "";

      // Determine if network is considered slow
      // Consider slow if ping latency > 2200ms OR effectiveType is slow-2g / 2g / high RTT
      const isSlow = latency > 2200 || effectiveType === "slow-2g" || effectiveType === "2g" || (conn?.rtt && conn.rtt > 1500);

      setNetworkInfo({
        status: isSlow ? "slow" : "online",
        latencyMs: latency,
        effectiveType: effectiveType || undefined,
        lastChecked: new Date(),
        isChecking: false,
      });

      if (wasDisconnected) {
        setShowReconnectedBanner(true);
        setWasDisconnected(false);
        if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
        reconnectedTimerRef.current = setTimeout(() => {
          setShowReconnectedBanner(false);
        }, 4000);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      // If aborted or fetch threw, connection is dead or extremely slow
      const isAbort = err?.name === "AbortError";
      const status: NetworkStatus = isAbort ? "slow" : "offline";

      setNetworkInfo({
        status,
        latencyMs: latency,
        lastChecked: new Date(),
        isChecking: false,
      });
      setWasDisconnected(true);
    }
  }, [wasDisconnected]);

  useEffect(() => {
    // Initial check after page stabilizes
    const initialTimer = setTimeout(() => {
      checkConnection();
    }, 1500);

    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setNetworkInfo((prev) => ({
        ...prev,
        status: "offline",
        latencyMs: null,
        lastChecked: new Date(),
        isChecking: false,
      }));
      setWasDisconnected(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Watch Network Information API changes if supported by Chrome/Edge
    const conn = typeof navigator !== "undefined" ? (navigator as any).connection : null;
    if (conn && conn.addEventListener) {
      conn.addEventListener("change", handleOnline);
    }

    // Ping check every 25 seconds
    pingIntervalRef.current = setInterval(() => {
      checkConnection();
    }, 25000);

    // Check when user comes back to the tab
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

  // Don't render anything if everything is normal and reconnected notification is not showing
  if (networkInfo.status === "online" && !showReconnectedBanner) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none flex flex-col items-center px-3 pt-2">
      {/* ── RECONNECTED SUCCESS BANNER ── */}
      {showReconnectedBanner && networkInfo.status === "online" && (
        <div className="pointer-events-auto flex items-center gap-3 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl shadow-emerald-950/20 border border-emerald-400/40 animate-fade-in transition-all">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/50">
            <CheckCircle2 className="h-5 w-5 text-white animate-bounce" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-wide uppercase text-emerald-100">Ayos na!</p>
            <p className="text-sm font-semibold text-white">Naibalik na ang koneksyon sa Internet</p>
          </div>
        </div>
      )}

      {/* ── OFFLINE BANNER (RED) ── */}
      {networkInfo.status === "offline" && (
        <div
          className={`pointer-events-auto w-full max-w-2xl bg-rose-600 text-white rounded-xl shadow-2xl shadow-rose-950/30 border border-rose-400/40 transition-all duration-300 overflow-hidden ${
            isMinimized ? "p-2.5 max-w-sm" : "p-3.5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-700/80 ring-2 ring-white/30 animate-pulse">
                <WifiOff className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-rose-800 text-rose-100 border border-rose-400/30">
                    Offline
                  </span>
                  <p className="text-sm font-bold text-white">Walang Koneksyon sa Internet</p>
                </div>
                {!isMinimized && (
                  <p className="text-xs text-rose-100/90 mt-0.5 leading-relaxed">
                    Hindi makakonekta sa system. Mangyaring suriin ang iyong WiFi o LAN bago mag-save o mag-transact.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => checkConnection()}
                disabled={networkInfo.isChecking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 active:scale-95 transition shadow-sm disabled:opacity-60"
                title="Suriin ang koneksyon"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${networkInfo.isChecking ? "animate-spin" : ""}`} />
                <span>{networkInfo.isChecking ? "Sinusuri..." : "Suriin Ulit"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700/60 transition"
                title={isMinimized ? "Ipakita ang buong detalye" : "Paliitin"}
              >
                {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SLOW INTERNET BANNER (AMBER/ORANGE) ── */}
      {networkInfo.status === "slow" && (
        <div
          className={`pointer-events-auto w-full max-w-2xl bg-amber-500 text-slate-950 rounded-xl shadow-2xl shadow-amber-950/20 border border-amber-300/60 transition-all duration-300 overflow-hidden ${
            isMinimized ? "p-2.5 max-w-sm" : "p-3.5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600/90 text-white ring-2 ring-white/40">
                <AlertTriangle className="h-5 w-5 text-amber-100 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-600 text-white">
                    Mabagal ang Net
                  </span>
                  <p className="text-sm font-bold text-slate-950">Mabagal ang Koneksyon sa Internet</p>
                  {networkInfo.latencyMs && (
                    <span className="text-[11px] font-semibold text-amber-900 bg-amber-400/80 px-1.5 py-0.5 rounded">
                      ~{(networkInfo.latencyMs / 1000).toFixed(1)}s ping
                    </span>
                  )}
                </div>
                {!isMinimized && (
                  <p className="text-xs text-amber-950/85 mt-0.5 leading-relaxed">
                    Medyo mabagal ang network response. Maaaring magtagal ang pag-load o pag-save ng mga form at ulat.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => checkConnection()}
                disabled={networkInfo.isChecking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition shadow-sm disabled:opacity-60"
                title="Suriin ang koneksyon"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${networkInfo.isChecking ? "animate-spin" : ""}`} />
                <span>{networkInfo.isChecking ? "Sinusuri..." : "Suriin Ulit"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg text-amber-900 hover:text-slate-950 hover:bg-amber-400/60 transition"
                title={isMinimized ? "Ipakita ang buong detalye" : "Paliitin"}
              >
                {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
