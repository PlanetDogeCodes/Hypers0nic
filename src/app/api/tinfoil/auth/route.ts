import { NextRequest, NextResponse } from "next/server";
import type { TinfoilPayload } from "@/lib/types";

interface AuthBody {
  mode: "login" | "signup" | "sync";
  username: string;
  password: string;
  payload?: TinfoilPayload;
}

const TINFOIL_AUTH_BASE = "https://tinf0il.app";

export async function POST(req: NextRequest) {
  let body: AuthBody;
  try {
    body = (await req.json()) as AuthBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { mode, username, password, payload } = body;

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: "Username and password are required" },
      { status: 400 }
    );
  }

  if (mode === "sync") {
    try {
      const endpoint = `${TINFOIL_AUTH_BASE}/api/auth/sync`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Hypers0nic/1.0",
        },
        body: JSON.stringify({ username, password, payload }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        return NextResponse.json({ ok: true });
      }

    } catch {

    }
    return NextResponse.json({ ok: true, _demo: true });
  }

  if (mode === "signup" && password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  try {
    const endpoint = `${TINFOIL_AUTH_BASE}/api/auth/${mode}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Hypers0nic/1.0",
      },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.profile || data.settings) {
        const payload = normalise(data.profile || data.settings || data);
        return NextResponse.json({
          ok: true,
          profile: { username, payload },
        });
      }
      return NextResponse.json({
        ok: true,
        profile: { username, payload: {} },
      });
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }
    if (res.status === 409) {
      return NextResponse.json(
        { ok: false, error: "Username already exists" },
        { status: 409 }
      );
    }
  } catch {

  }

  const demo = buildDemoProfile(username);
  return NextResponse.json({
    ok: true,
    profile: { username, payload: demo },
    _demo: true,
  });
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
      openInAboutBlank: false,
      preloadServiceWorker: false,
      showShortcuts: true,
      hideFromHistory: false,
      proxyImages: true,
      smoothTransitions: true,
      compactDensity: false,
      topBarAlwaysVisible: true,
      panicKeyEnabled: true,
      panicKey: "Escape",
      panicUrl: "https://classroom.google.com",
    },
  };
}
