import { NextRequest, NextResponse } from "next/server";
import type { TinfoilPayload } from "@/lib/types";

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

  if (endpoint && token) {
    try {
      const payload = await fetchUpstream(endpoint, username, token);
      return NextResponse.json({
        ok: true,
        profile: { username, payload },
      });
    } catch (err) {

      console.warn("[tinfoil] upstream failed, using demo profile:", err);
    }
  }

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
