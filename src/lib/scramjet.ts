// Scramjet controller wrapper.
//
// Uses Scramjet v1 for both the client controller and the service worker.
// V2 alpha crashes in the SW context due to missing browser API bindings,
// so we stick with v1 which is stable.
//
// The proxy pipeline:
//   browser iframe -> /service/<encoded> -> service worker -> ScramjetServiceWorker
//   -> BareClient (bare-mux) -> EpoxyTransport -> wisp WebSocket relay -> target site
//
// The "negotiating wisp" hang is prevented by a 30-second hard timeout on
// transport setup, with fallback to alternative relays.

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
  // Transport connection reuse — a single BareMuxConnection is shared across
  // all init() calls. Creating a new one each time leaks Web Workers and can
  // leave zombie connections to the wisp relay, which eventually exhausts the
  // browser's connection pool and causes "negotiating wisp" hangs.
  private transportConn: any = null;
  private transportUrl: string | null = null;

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
      // Load the bundle FIRST, then set up transport. This order is more
      // reliable: the bundle is a local file (fast, always succeeds), and
      // the transport setup can take time (wisp negotiation). If transport
      // fails, we still have the bundle loaded for the retry.
      await this.loadBundle();
      await this.setupTransport(wispUrl);
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
      // Tell the SW to release its $scramjet DB connection so our
      // controller.init() can write the config without being blocked.
      try {
        navigator.serviceWorker.controller?.postMessage("releaseDB");
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
      // Race controller.init() against a 20-second timeout. If it hangs
      // (IDB deadlock, WASM issue), we throw and the caller can retry.
      await Promise.race([
        this.controller.init(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("controller.init() timeout")), 20000)
        ),
      ]);
      // Tell the SW it can now safely read the config from IDB.
      try {
        navigator.serviceWorker.controller?.postMessage("controllerReady");
      } catch {}

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
    // Reuse existing transport if it's already connected to the same URL.
    // This prevents leaking BareMuxConnection workers on re-init.
    if (this.transportConn && this.transportUrl === wispUrl) {
      // Health check: verify the transport is still alive.
      try {
        const port = this.transportConn.getInnerPort?.();
        if (port && typeof port === "object" && "postMessage" in port) {
          return; // Transport is alive, reuse it.
        }
      } catch {
        // Health check failed — fall through to reconnect.
      }
      this.transportUrl = null;
    }

    // Validate the wisp URL before attempting connection
    if (!wispUrl || (!wispUrl.startsWith("ws://") && !wispUrl.startsWith("wss://"))) {
      wispUrl = FALLBACK_WISP_SERVERS[0];
    }

    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");

    if (!this.transportConn) {
      this.transportConn = new BareMuxConnection("/baremux/worker.js");
    }
    const conn = this.transportConn;

    const localRelay = this.resolveLocalRelay();
    const candidates = [wispUrl, ...FALLBACK_WISP_SERVERS, localRelay].filter(
      (v, i, a) => v && a.indexOf(v) === i
    );

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const transportPromise = conn.setTransport("/epoxy/index.mjs", [
          { wisp: candidate },
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`transport timeout for ${candidate}`)),
            15000
          )
        );
        await Promise.race([transportPromise, timeoutPromise]);
        this.transportUrl = candidate;
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

  /**
   * Force reconnect the transport. Called when a dead connection is detected.
   * Resets the init promise so the next init() call re-establishes the
   * transport from scratch. Also destroys the old transport connection to
   * prevent zombie workers.
   */
  forceReconnect(): void {
    this.initPromise = null;
    this.transportUrl = null;
    this.controller = null;
    // Don't destroy the transportConn — reuse it on next init. Destroying
    // it can leave orphaned workers. Instead, just mark it for re-setup.
    this.setState({ status: "idle" });
  }

  /**
   * Check if the transport is healthy. Called before each navigation to
   * catch dead connections early (the wisp relay may have restarted).
   * Returns true if the transport is alive and ready.
   */
  isTransportHealthy(): boolean {
    if (!this.transportConn || !this.transportUrl) return false;
    if (this.state.status !== "ready") return false;
    try {
      const port = this.transportConn.getInnerPort?.();
      return !!(port && typeof port === "object" && "postMessage" in port);
    } catch {
      return false;
    }
  }

  private resolveLocalRelay(): string {
    if (typeof window === "undefined") return "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/?XTransformPort=3001`;
  }

  encodeUrl(url: string): string {
    if (!this.controller) {
      // Return a manually-encoded URL as a fallback. This allows the
      // direct-iframe-src fallback in ProxyFrame to work even if the
      // controller isn't initialized yet.
      return SCRAMJET_PREFIX + encodeURIComponent(url);
    }
    try {
      return this.controller.encodeUrl(url);
    } catch {
      return SCRAMJET_PREFIX + encodeURIComponent(url);
    }
  }

  decodeUrl(url: string): string {
    if (!this.controller) {
      // Manual decode as fallback.
      try {
        const encoded = url.startsWith(SCRAMJET_PREFIX)
          ? url.substring(SCRAMJET_PREFIX.length)
          : url;
        return decodeURIComponent(encoded);
      } catch {
        return url;
      }
    }
    try {
      return this.controller.decodeUrl(url);
    } catch {
      return url;
    }
  }

  createFrame(iframe: HTMLIFrameElement): any {
    if (!this.controller) {
      throw new Error("Scramjet is not initialised yet");
    }
    return this.controller.createFrame(iframe);
  }
}

/**
 * Drop the `$scramjet` IndexedDB if it exists without its object stores.
 * This prevents the "object store not found" error that occurs when the SW's
 * loadConfig races the controller's init.
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
      // The SW may hold an open connection to $scramjet, which blocks this
      // open request indefinitely. Race against a 3-second timeout so the
      // proxy can still boot — controller.init() will handle the DB.
      const timer = setTimeout(() => {
        reject(new Error("IDB open timeout"));
      }, 3000);
      req.onsuccess = () => {
        clearTimeout(timer);
        const db = req.result;
        const names = Array.from(db.objectStoreNames);
        db.close();
        resolve(names);
      };
      req.onerror = () => {
        clearTimeout(timer);
        reject(req.error);
      };
      req.onblocked = () => {
        clearTimeout(timer);
        reject(new Error("IDB open blocked"));
      };
    });
  } catch {
    // Open failed or timed out — skip the stale check and let the
    // controller handle the DB (it will create or use the existing one).
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
 * the page. Returns true only if the SW is actively controlling, false if
 * registration failed or timed out.
 *
 * If the SW is registered and activated but not controlling the page (the
 * classic first-registration issue where clients.claim() has a delay), this
 * function reloads the page. The reload ensures the SW controls the page on
 * the next load. This is the 100% reliable fix for cold-start failures.
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await waitForController(reg, 30000);
    // If the SW is registered and activated but not controlling the page,
    // reload. On reload, the SW will control the page immediately.
    if (!navigator.serviceWorker.controller && reg.active) {
      console.log("[hypers0nic] SW activated but not controlling — reloading page");
      window.location.reload();
      // Return a promise that never resolves — the page is reloading.
      // The caller should check for this and abort any pending navigation.
      return new Promise<boolean>(() => {});
    }
    return !!navigator.serviceWorker.controller;
  } catch (err) {
    console.warn("[hypers0nic] service worker registration failed:", err);
    return false;
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
