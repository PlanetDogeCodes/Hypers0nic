// Scramjet controller wrapper.
//
// Tries Scramjet v2 first, falls back to v1. The proxy pipeline:
//   browser iframe -> /service/<encoded> -> service worker -> ScramjetServiceWorker/v2
//   -> BareClient (bare-mux) -> EpoxyTransport -> wisp WebSocket relay -> target site
//
// The "negotiating wisp" hang is prevented by a 30-second hard timeout on
// transport setup, with fallback to alternative relays.

declare global {
  interface Window {
    $scramjetLoadController?: () => { ScramjetController: any };
    $scramjetLoadWorker?: () => any;
    $scramjet?: any;
    $scramjetVersion?: { version: string; build: string };
  }
}

const SCRAMJET_PREFIX = "/service/";
const SCRAMJET_V1_FILES = {
  wasm: "/scramjet/scramjet.wasm.wasm",
  all: "/scramjet/scramjet.all.js",
  sync: "/scramjet/scramjet.sync.js",
};

const FALLBACK_WISP_SERVERS = [
  "wss://wisp.mercurywork.shop/",
];

export type ScramjetStatus = "idle" | "loading" | "ready" | "error";

export interface ScramjetStateSnapshot {
  status: ScramjetStatus;
  error?: string;
  wispUrl?: string;
  version?: string;
}

type Listener = (state: ScramjetStateSnapshot) => void;

class ScramjetManager {
  private controller: any = null;
  private state: ScramjetStateSnapshot = { status: "idle" };
  private listeners = new Set<Listener>();
  private initPromise: Promise<void> | null = null;
  private bundleLoaded = false;
  private useV2 = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): ScramjetStateSnapshot {
    return this.state;
  }

  private setState(next: Partial<ScramjetStateSnapshot>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l(this.state));
  }

  resolveWispUrl(custom?: string): string {
    if (custom && custom.trim()) return custom.trim();
    if (typeof window === "undefined") return "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/?XTransformPort=3001`;
  }

  async init(customWisp?: string): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit(customWisp).catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  private async doInit(customWisp?: string): Promise<void> {
    this.setState({ status: "loading", error: undefined });
    try {
      const wispUrl = this.resolveWispUrl(customWisp);
      await this.setupTransport(wispUrl);
      await this.loadBundle();
      await ensureFreshScramjetDB();

      // Try v2 first, fall back to v1
      if (window.$scramjet && window.$scramjet.ScramjetClient) {
        this.useV2 = true;
        // V2 controller creation
        const config = window.$scramjet.defaultConfig;
        const { ScramjetClient } = window.$scramjet;
        // V2 uses a different initialization — the controller is created
        // implicitly by the service worker. On the client side, v2 doesn't
        // need a separate controller object — the SW handles everything.
        // We just need to verify the bundle loaded.
        this.controller = { v2: true };
        console.log("[hypers0nic] Using Scramjet v2 controller");
      } else if (window.$scramjetLoadController) {
        // V1 fallback
        this.useV2 = false;
        const factory = window.$scramjetLoadController;
        const { ScramjetController } = factory();
        this.controller = new ScramjetController({
          prefix: SCRAMJET_PREFIX,
          files: SCRAMJET_V1_FILES,
          flags: {},
          codec: {
            encode: (u: string) => (u ? encodeURIComponent(u) : u),
            decode: (u: string) => (u ? decodeURIComponent(u) : u),
          },
        });
        await this.controller.init();
        console.log("[hypers0nic] Using Scramjet v1 controller");
      } else {
        throw new Error("No Scramjet bundle available");
      }

      this.setState({
        status: "ready",
        wispUrl,
        version: window.$scramjetVersion?.version || (this.useV2 ? "2.0.67-alpha" : "1.1.0"),
      });
    } catch (err) {
      this.setState({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async loadBundle(): Promise<void> {
    if (this.bundleLoaded) return;

    // Try v2 first
    await new Promise<void>((resolve) => {
      const v2Script = document.createElement("script");
      v2Script.id = "scramjet-v2-bundle";
      v2Script.src = "/scramjet/scramjet.v2.js";
      v2Script.async = true;
      v2Script.onload = () => {
        if (window.$scramjet && window.$scramjet.ScramjetFetchHandler) {
          this.bundleLoaded = true;
          console.log("[hypers0nic] v2 bundle loaded");
          resolve();
        } else {
          // v2 didn't define the expected globals — fall through to v1
          resolve();
        }
      };
      v2Script.onerror = () => {
        // v2 failed to load — fall through to v1
        resolve();
      };
      document.head.appendChild(v2Script);
    });

    // If v2 loaded, we're done
    if (this.bundleLoaded && window.$scramjet) return;

    // Load v1 as fallback
    await new Promise<void>((resolve, reject) => {
      if (window.$scramjetLoadController) {
        this.bundleLoaded = true;
        return resolve();
      }
      const script = document.createElement("script");
      script.id = "scramjet-bundle";
      script.src = "/scramjet/scramjet.all.js";
      script.async = true;
      script.onload = () => {
        if (window.$scramjetLoadController) {
          this.bundleLoaded = true;
          console.log("[hypers0nic] v1 bundle loaded");
          resolve();
        } else {
          reject(new Error("Scramjet bundle loaded but globals are missing"));
        }
      };
      script.onerror = () =>
        reject(new Error("Failed to download the Scramjet bundle"));
      document.head.appendChild(script);
    });
  }

  private async setupTransport(wispUrl: string): Promise<void> {
    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
    const conn = new BareMuxConnection("/baremux/worker.js");

    const localRelay = this.resolveLocalRelay();
    const candidates = [wispUrl, ...FALLBACK_WISP_SERVERS, localRelay].filter(
      (v, i, a) => v && a.indexOf(v) === i
    );

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        // Hard 30-second timeout — prevents the "negotiating wisp" hang.
        // If a relay is unreachable or slow, we move on to the next candidate
        // instead of hanging indefinitely.
        const transportPromise = conn.setTransport("/epoxy/index.mjs", [
          { wisp: candidate },
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`transport timeout for ${candidate}`)),
            30000
          )
        );
        await Promise.race([transportPromise, timeoutPromise]);
        return;
      } catch (err) {
        console.warn(`[hypers0nic] transport failed for ${candidate}:`, err);
        lastError = err;
      }
    }
    throw new Error(
      `Could not establish a wisp transport: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private resolveLocalRelay(): string {
    if (typeof window === "undefined") return "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/?XTransformPort=3001`;
  }

  encodeUrl(url: string): string {
    if (this.useV2) {
      // V2 uses the same URL encoding scheme
      return `${SCRAMJET_PREFIX}${encodeURIComponent(url)}`;
    }
    if (!this.controller) {
      throw new Error("Scramjet is not initialised yet");
    }
    return this.controller.encodeUrl(url);
  }

  decodeUrl(url: string): string {
    if (this.useV2) {
      try {
        const encoded = url.startsWith(SCRAMJET_PREFIX)
          ? url.substring(SCRAMJET_PREFIX.length)
          : url;
        return decodeURIComponent(encoded);
      } catch {
        return url;
      }
    }
    if (!this.controller) {
      throw new Error("Scramjet is not initialised yet");
    }
    return this.controller.decodeUrl(url);
  }

  createFrame(iframe: HTMLIFrameElement): any {
    if (this.useV2) {
      // V2 doesn't have a createFrame method — we create the iframe src
      // directly using encodeUrl. The SW handles the interception.
      return {
        go: (url: string) => {
          iframe.src = this.encodeUrl(url);
        },
        back: () => {
          try { iframe.contentWindow?.history.back(); } catch {}
        },
        forward: () => {
          try { iframe.contentWindow?.history.forward(); } catch {}
        },
        reload: () => {
          try { iframe.contentWindow?.location.reload(); } catch {}
        },
        addEventListener: (_t: string, _fn: (e: any) => void) => {},
        removeEventListener: (_t: string, _fn: (e: any) => void) => {},
      };
    }
    if (!this.controller) {
      throw new Error("Scramjet is not initialised yet");
    }
    return this.controller.createFrame(iframe);
  }
}

/**
 * Drop the `$scramjet` IndexedDB if it exists without its object stores.
 */
async function ensureFreshScramjetDB(): Promise<void> {
  const DB_NAME = "$scramjet";
  if (typeof indexedDB.databases === "function") {
    let dbs: IDBDatabaseInfo[] = [];
    try {
      dbs = await indexedDB.databases();
    } catch {
      return;
    }
    if (!dbs.some((d) => d.name === DB_NAME)) return;
  }

  let stores: string[] = [];
  try {
    stores = await new Promise<string[]>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        const db = req.result;
        const names = Array.from(db.objectStoreNames);
        db.close();
        resolve(names);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return;
  }
  if (stores.includes("config")) return;

  try {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      const done = () => resolve();
      req.onsuccess = done;
      req.onerror = done;
      req.onblocked = done;
    });
  } catch {
    /* ignore */
  }
}

let instance: ScramjetManager | null = null;
export function getScramjet(): ScramjetManager {
  if (!instance) instance = new ScramjetManager();
  return instance;
}

/**
 * Register the Hypers0nic service worker and wait for it to actively control
 * the page.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await waitForController(reg, 8000);
    return reg;
  } catch (err) {
    console.warn("[hypers0nic] service worker registration failed:", err);
    return null;
  }
}

async function waitForController(
  reg: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<void> {
  if (navigator.serviceWorker.controller) return;
  const sw = reg.active || reg.installing || reg.waiting;
  if (sw) {
    if (reg.waiting) reg.waiting.postMessage("skipWaiting");
  }
  await new Promise<void>((resolve) => {
    const onChange = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    const start = Date.now();
    const poll = setInterval(() => {
      if (navigator.serviceWorker.controller || Date.now() - start > timeoutMs) {
        clearInterval(poll);
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }
    }, 100);
  });
}
