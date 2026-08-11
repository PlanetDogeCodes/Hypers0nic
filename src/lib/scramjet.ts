// Scramjet controller wrapper.
//
// Scramjet ships as a pre-built bundle that defines the globals
// $scramjetLoadController / $scramjetLoadWorker. We load that bundle with a
// <script> tag (rather than importing it) because it is not an ESM module and
// relies on those globals being present on `window`.
//
// The proxy pipeline is:
//   browser iframe -> /service/<encoded> -> service worker -> ScramjetServiceWorker
//   -> BareClient (bare-mux) -> EpoxyTransport -> wisp WebSocket relay -> target site
//
// The wisp relay is a separate process (see mini-services/wisp-server). The
// browser opens the WebSocket same-origin through the Caddy gateway.

declare global {
  interface Window {
    $scramjetLoadController?: () => { ScramjetController: any };
    $scramjetLoadWorker?: () => any;
    $scramjetVersion?: { version: string; build: string };
  }
}

const SCRAMJET_PREFIX = "/service/";
const SCRAMJET_FILES = {
  wasm: "/scramjet/scramjet.wasm.wasm",
  all: "/scramjet/scramjet.all.js",
  sync: "/scramjet/scramjet.sync.js",
};

// A small set of public wisp relays used as fallbacks when the primary relay
// is unreachable. The local relay (same-origin via Caddy) is included as a
// last resort so the proxy works in development environments.
const FALLBACK_WISP_SERVERS = [
  "wss://wisp.mercurywork.shop/",
];

export type ScramjetStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

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

  /**
   * Resolve the wisp URL the browser should connect to.
   *
   * 1. If the user configured a custom wisp URL in settings, use it verbatim.
   * 2. Otherwise derive a same-origin URL that the Caddy gateway routes to the
   *    local wisp mini-service on port 3001.
   */
  resolveWispUrl(custom?: string): string {
    if (custom && custom.trim()) return custom.trim();
    if (typeof window === "undefined") return "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Same-origin WS through Caddy. XTransformPort tells the gateway which
    // upstream port to forward to.
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
      // Self-heal: if a previous (buggy) run left an empty $scramjet database,
      // the controller's openDB(version=1) won't re-run the upgrade and will
      // throw "object store not found". Drop it first so the controller
      // recreates it with the full schema.
      await ensureFreshScramjetDB();
      const factory = window.$scramjetLoadController!;
      const { ScramjetController } = factory();
      this.controller = new ScramjetController({
        prefix: SCRAMJET_PREFIX,
        files: SCRAMJET_FILES,
        flags: {},
        codec: {
          encode: (u: string) => (u ? encodeURIComponent(u) : u),
          decode: (u: string) => (u ? decodeURIComponent(u) : u),
        },
      });
      await this.controller.init();
      this.setState({
        status: "ready",
        wispUrl,
        version: window.$scramjetVersion?.version,
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
    if (this.bundleLoaded && window.$scramjetLoadController) return;
    await new Promise<void>((resolve, reject) => {
      if (window.$scramjetLoadController) {
        this.bundleLoaded = true;
        return resolve();
      }
      const script = document.createElement("script");
      script.id = "scramjet-bundle";
      // scramjet.all.js is the self-contained IIFE build that exposes the
      // $scramjetLoadController / $scramjetLoadWorker globals. The larger
      // scramjet.bundle.js relies on a webpack runtime and won't define the
      // globals when loaded as a plain classic script.
      script.src = "/scramjet/scramjet.all.js";
      script.async = true;
      script.onload = () => {
        if (window.$scramjetLoadController) {
          this.bundleLoaded = true;
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
    // Use BareMuxConnection to set up the epoxy transport. We use a single
    // instance to avoid port conflicts. The transport connects to the wisp
    // relay via WebSocket.
    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
    const conn = new BareMuxConnection("/baremux/worker.js");

    const localRelay = this.resolveLocalRelay();
    const candidates = [wispUrl, ...FALLBACK_WISP_SERVERS, localRelay].filter(
      (v, i, a) => v && a.indexOf(v) === i
    );

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        // setTransport creates a Worker that imports the epoxy module and
        // connects to the wisp relay. We use Promise.race with a timeout
        // so an unreachable relay doesn't hang forever.
        const transportPromise = conn.setTransport("/epoxy/index.mjs", [
          { wisp: candidate },
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`transport timeout for ${candidate}`)),
            60000
          )
        );
        await Promise.race([transportPromise, timeoutPromise]);
        return;
      } catch (err) {
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
    if (!this.controller) {
      throw new Error("Scramjet is not initialised yet");
    }
    return this.controller.encodeUrl(url);
  }

  decodeUrl(url: string): string {
    if (!this.controller) {
      throw new Error("Scramjet is not initialised yet");
    }
    return this.controller.decodeUrl(url);
  }

  createFrame(iframe: HTMLIFrameElement): any {
    if (!this.controller) {
      throw new Error("Scramjet is not initialised yet");
    }
    return this.controller.createFrame(iframe);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Drop the `$scramjet` IndexedDB if it exists without its object stores.
 *
 * Scramjet's own `openIDB` opens at version 1 with an upgrade callback, so a
 * missing DB is created correctly. The problem is the service worker's
 * `loadConfig`, which opens the same DB at version 1 *without* an upgrade — if
 * it ever runs before the controller, it leaves behind an empty v1 database
 * that the controller can no longer upgrade (same version = no upgrade). This
 * helper detects that state and deletes the DB so the controller recreates it
 * cleanly.
 *
 * Crucially, we use `indexedDB.databases()` to check existence first — opening
 * a non-existent DB with `open(name)` (no version) would itself create an
 * empty v1 database and trigger the very bug we're trying to fix.
 */
async function ensureFreshScramjetDB(): Promise<void> {
  const DB_NAME = "$scramjet";
  // Bail out early if the DB doesn't exist at all — the controller will create
  // it properly. Never call open() on a name that might not exist.
  if (typeof indexedDB.databases === "function") {
    let dbs: IDBDatabaseInfo[] = [];
    try {
      dbs = await indexedDB.databases();
    } catch {
      return;
    }
    if (!dbs.some((d) => d.name === DB_NAME)) return;
  }

  // The DB exists — inspect its object stores.
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

  // Stale empty DB — delete it so the controller can recreate it with the
  // full schema. Best-effort: a blocked delete just means another connection
  // is open; the controller will retry on the next navigation.
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
 * the page. Called after the Scramjet controller has booted, so the worker's
 * first `loadConfig` finds a fully-initialised IndexedDB schema.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    // Wait until a service worker is actively controlling this client. Without
    // this, the very first proxied navigation can slip past the SW and hit the
    // network, loading the app shell inside the iframe instead of the target.
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
    // Force a waiting worker to activate immediately.
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
    // Also poll as a fallback — controllerchange can fire before the listener
    // is attached in some browsers.
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
