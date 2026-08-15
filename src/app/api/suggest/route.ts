import { NextRequest, NextResponse } from "next/server";
import { SEARCH_ENGINES } from "@/lib/search-engines";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const engineId = searchParams.get("engine") ?? "duckduckgo";
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  const engine = SEARCH_ENGINES.find((e) => e.id === engineId) ?? SEARCH_ENGINES[0];
  if (!engine.suggest) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = engine.suggest.replace("%s", encodeURIComponent(query));

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/javascript, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }
    const suggestions = parseSuggestions(await res.json(), engineId);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

function parseSuggestions(data: unknown, engineId: string): string[] {
  if (Array.isArray(data)) {

    if (data.length >= 2 && Array.isArray(data[1])) {
      return data[1].filter((s): s is string => typeof s === "string").slice(0, 8);
    }

    return data
      .map((item) =>
        typeof item === "string"
          ? item
          : item && typeof item === "object" && "phrase" in item
            ? String((item as { phrase: unknown }).phrase)
            : ""
      )
      .filter(Boolean)
      .slice(0, 8);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["suggestions", "results", "items"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[])
          .map((item) =>
            typeof item === "string"
              ? item
              : item && typeof item === "object" && "phrase" in item
                ? String((item as { phrase: unknown }).phrase)
                : ""
          )
          .filter(Boolean)
          .slice(0, 8);
      }
    }
  }
  void engineId;
  return [];
}
