"use client";

import { useEffect, useRef } from "react";
import { getScramjet } from "@/lib/scramjet";
import { useHypers0nic } from "@/store/hypers0nic";

/**
 * Transport health monitor (Task 4 — reliability).
 *
 * Periodically (every 30s) probes the wisp relay + Scramjet transport and
 * records a coarse `quality` ("good" | "poor" | "dead") + a numeric
 * `latency` into the global store. If the transport is unhealthy for 2
 * consecutive checks, the hook force-reconnects the ScramjetManager and
 * re-inits it (mirroring the recovery path used by ProxyFrame on a
 * navigation failure).
 *
 * Design notes:
 *
 * - Pings via `getScramjet().isTransportHealthy()` (transport port still
 *   alive?) AND a real fetch through /service/ (does an end-to-end request
 *   actually succeed?). Either failing degrades `quality`.
 * - Latency is measured by timing a small fetch through the proxy. We use
 *   Google's `generate_204` endpoint, which returns a 204 with no body —
 *   tiny, fast, cache-busted. The fetch has a 6s AbortController timeout.
 * - All store writes happen synchronously back-to-back inside the check
 *   callback. React 18's auto-batching coalesces them into a single
 *   re-render, so subscribers see at most 1 render per 30s tick.
 * - A `inFlightRef` guard prevents overlapping checks (e.g. if a check
 *   takes longer than the 30s interval due to a slow proxy).
 * - The hook reads `transportQuality` / `transportLatency` from the store
 *   purely so callers can destructure them (`const { quality, latency } =
 *   useTransportHealth()`). Components that don't need the live value
 *   should subscribe directly via `useHypers0nic` to avoid re-rendering
 *   AppShell.
 * - The hook is a no-op until `scramjet.status === "ready"`. Probing an
 *   uninitialised transport would always report "dead" and could trigger
 *   spurious force-reconnects during cold start.
 * - The check runs on a fixed 30s `setInterval` plus a one-shot 8s
 *   initial timer so the indicator lights up shortly after boot instead
 *   of waiting a full 30s.
 */

export type TransportQuality = "good" | "poor" | "dead";

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const INITIAL_DELAY_MS = 8_000;
const LATENCY_PROBE_TIMEOUT_MS = 6_000;
// Google's generate_204 endpoint returns a 204 No Content with an empty
// body — the smallest possible round-trip through the proxy. We pass
// `cache: "no-store"` so the SW doesn't serve a cached response (which
// would make latency look artificially low).
const LATENCY_PROBE_URL = "https://www.google.com/generate_204";

export function useTransportHealth() {
  const setTransportQuality = useHypers0nic((s) => s.setTransportQuality);
  const setTransportLatency = useHypers0nic((s) => s.setTransportLatency);

  // Subscribe to the live values so callers can destructure them. These
  // subscriptions cause the host component (AppShell) to re-render when
  // the values change — at most once per 30s tick.
  const quality = useHypers0nic((s) => s.transportQuality);
  const latency = useHypers0nic((s) => s.transportLatency);

  // Refs to avoid re-subscribing the effect when the setters re-render.
  const setQualityRef = useRef(setTransportQuality);
  const setLatencyRef = useRef(setTransportLatency);
  useEffect(() => {
    setQualityRef.current = setTransportQuality;
    setLatencyRef.current = setTransportLatency;
  }, [setTransportQuality, setTransportLatency]);

  // Refs that persist across renders without triggering re-renders.
  const unhealthyCountRef = useRef(0);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  // Tracks whether we are mid-reconnect so a slow init() doesn't get
  // double-triggered by the next 30s tick.
  const reconnectingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    /**
     * Time a single GET through the proxy. Returns the round-trip latency
     * in ms, or null if the request failed, timed out, or returned a
     * non-success status.
     */
    const measureLatency = async (): Promise<number | null> => {
      const sj = getScramjet();
      if (sj.getState().status !== "ready") return null;
      let encoded: string;
      try {
        encoded = sj.encodeUrl(LATENCY_PROBE_URL);
      } catch {
        return null;
      }
      if (!encoded) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LATENCY_PROBE_TIMEOUT_MS);
      const start = performance.now();
      try {
        const res = await fetch(encoded, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
          // Don't send credentials — the probe target is a third-party
          // origin and we don't want to leak cookies to it.
          credentials: "omit",
        });
        const elapsed = Math.round(performance.now() - start);
        // 204 is the expected status from generate_204; 200 is also fine
        // (some proxies transform the response). Anything else counts as
        // a failure.
        if (res.status !== 204 && res.status !== 200) return null;
        return elapsed;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    const runCheck = async () => {
      if (inFlightRef.current || !mountedRef.current) return;
      inFlightRef.current = true;
      try {
        const sj = getScramjet();
        // Skip the check entirely if scramjet isn't ready yet. Probing an
        // uninitialised transport would always look "dead" and could
        // trigger a force-reconnect that races the cold-start init().
        if (sj.getState().status !== "ready") {
          return;
        }

        const portHealthy = sj.isTransportHealthy();
        const latencyMs = await measureLatency();
        if (!mountedRef.current) return;

        // Compute the coarse quality bucket from latency.
        let nextQuality: TransportQuality;
        if (latencyMs === null) {
          nextQuality = "dead";
        } else if (latencyMs > 2000) {
          nextQuality = "dead";
        } else if (latencyMs >= 500) {
          nextQuality = "poor";
        } else {
          nextQuality = "good";
        }

        // Write both fields synchronously back-to-back — React 18 batches
        // these into a single re-render for any subscriber.
        setQualityRef.current(nextQuality);
        setLatencyRef.current(latencyMs);

        // "Effectively healthy" requires both the transport port to be
        // alive AND a successful end-to-end probe. A live port with a
        // dead probe (e.g. relay up but wisp can't reach the internet)
        // counts as unhealthy — we want to force-reconnect in that case.
        const effectivelyHealthy = portHealthy && nextQuality !== "dead";
        if (effectivelyHealthy) {
          unhealthyCountRef.current = 0;
        } else {
          unhealthyCountRef.current += 1;
          // Two consecutive unhealthy checks → force-reconnect + re-init.
          // The double-check threshold absorbs transient blips (a single
          // dropped packet shouldn't tear down the transport).
          if (unhealthyCountRef.current >= 2 && !reconnectingRef.current) {
            unhealthyCountRef.current = 0;
            reconnectingRef.current = true;
            try {
              sj.forceReconnect();
              await sj.init(useHypers0nic.getState().settings.wispUrl);
            } catch {
              // Reconnect failed — the next tick will retry. Don't
              // bubble the error: this hook must NEVER throw into the
              // AppShell render.
            } finally {
              reconnectingRef.current = false;
            }
          }
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    // Initial check after a short delay (lets scramjet finish booting
    // before the first probe — avoids a false "dead" reading on cold
    // start).
    const initialTimer = setTimeout(runCheck, INITIAL_DELAY_MS);
    const interval = setInterval(runCheck, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return { quality, latency };
}
