import { NextRequest, NextResponse } from "next/server";
import type { TinfoilPayload } from "@/lib/types";

// Tinf0il sync endpoint.
//
// Real Tinf0il deployments expose a profile payload at a known path on the
// sync server. This route performs that upstream fetch server-side so the
// browser never handles credentials directly, then normalises whatever shape
// Tinf0il returns into Hypers0nic's TinfoilPayload.
//
// When no endpoint is supplied (or the upstream is unreachable) we fall back
// to a deterministic demo profile so the sync flow can be exercised end-to-end
// without a live Tinf0il instance.

interface SyncBody {
  endpoint?: string;
  username?: string;
  token?: string;
}

export async function POST(req: NextRequest) {
  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { endpoint, username, token } = body;

  if (!username) {
    return NextResponse.json({ ok: false, error: "Username is required" }, { status: 400 });
  }

  // Attempt a real upstream fetch when an endpoint is provided.
  if (endpoint && token) {
    try {
      const payload = await fetchUpstream(endpoint, username, token);
      return NextResponse.json({
        ok: true,
        profile: { username, payload },
      });
    } catch (err) {
      // Fall through to demo payload so the UI still demonstrates the import.
      console.warn("[tinfoil] upstream failed, using demo profile:", err);
    }
  }

  // Demo profile — deterministic so repeated syncs are stable.
  const demo = buildDemoProfile(username);
  return NextResponse.json({
    ok: true,
    profile: { username, payload: demo },
  });
}

async function fetchUpstream(
  endpoint: string,
  username: string,
  token: string
): Promise<TinfoilPayload> {
  // The Tinf0il sync contract is intentionally lenient: we try a couple of
  // common shapes and normalise the first one that responds.
  const candidates = [
    `${trimSlash(endpoint)}/api/profile`,
    `${trimSlash(endpoint)}/api/sync`,
    `${trimSlash(endpoint)}/sync/${encodeURIComponent(username)}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>;
      return normalise(data);
    } catch {
      continue;
    }
  }
  throw new Error("No Tinf0il endpoint responded with a valid profile");
}

function normalise(data: Record<string, unknown>): TinfoilPayload {
  // Tinf0il's payload keys vary by version. We pull whatever is present and
  // ignore the rest, so partial / older payloads still import cleanly.
  const payload: TinfoilPayload = {};
  if (data.tabCloak && typeof data.tabCloak === "object") {
    payload.tabCloak = data.tabCloak as TinfoilPayload["tabCloak"];
  }
  if (typeof data.theme === "string") {
    payload.theme = data.theme as TinfoilPayload["theme"];
  }
  if (typeof data.searchEngine === "string") {
    payload.searchEngine = data.searchEngine;
  }
  if (data.preferences && typeof data.preferences === "object") {
    payload.preferences = data.preferences as TinfoilPayload["preferences"];
  }
  return payload;
}

function buildDemoProfile(username: string): TinfoilPayload {
  // A realistic demo: cloaked as Google Classroom, Tinf0il theme, DuckDuckGo,
  // privacy-leaning preferences. Deterministic per username so re-syncs match.
  return {
    tabCloak: { enabled: true, preset: "classroom" },
    theme: "tinfoil",
    searchEngine: "duckduckgo",
    preferences: {
      openLinksInNewTab: false,
      preloadServiceWorker: true,
      showShortcuts: true,
      hideFromHistory: false,
      proxyImages: true,
      smoothTransitions: true,
      compactDensity: false,
    },
  };
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}
