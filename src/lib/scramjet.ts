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

function getProxyPrefix(): string {
  if (typeof window === "undefined") return SCRAMJET_PREFIX;
  try {
    const raw = localStorage.getItem("hypers0nic:settings:v1");
    if (!raw) return SCRAMJET_PREFIX;
    const settings = JSON.parse(raw);
    const prefix = settings?.proxyPrefix;
    if (!prefix || typeof prefix !== "string") return SCRAMJET_PREFIX;

    if (!/^\/[a-z0-9\-]+\/$/i.test(prefix)) return SCRAMJET_PREFIX;
    return prefix;
  } catch {
    return SCRAMJET_PREFIX;
  }
}

const FALLBACK_WISP_SERVERS = [
  "wss://anura.pro/",
  "wss://wisp.mercurywork.shop/",
];

const DEFAULT_WISP_URL = "wss://anura.pro/";

export type ScramjetStatus = "idle" | "loading" | "ready" | "error";

export interface ScramjetStateSnapshot {
  status: ScramjetStatus;
  error?: string;
  wispUrl?: string;
  version?: string;

  latency?: number;
}

type Listener = (state: ScramjetStateSnapshot) => void;

class ScramjetManager {
  private controller: any = null;
  private state: ScramjetStateSnapshot = { status: "idle" };
  private listeners = new Set<Listener>();
  private initPromise: Promise<void> | null = null;
  private bundleLoaded = false;

  private transportConn: any = null;
  private transportUrl: string | null = null;

  private transportInitializedAt: number = 0;

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
    if (custom && custom.trim()) {
      var url = custom.trim();
      if (!url.endsWith("/")) url += "/";
      return url;
    }
    return DEFAULT_WISP_URL;
  }

  applyWispPathDisguise(wispUrl: string): string {
    if (typeof window === "undefined") return wispUrl;
    try {
      const settingsRaw = localStorage.getItem("hypers0nic:settings:v1");
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const disguisePath = settings?.wispUrlPath;
      if (!disguisePath || !disguisePath.trim()) return wispUrl;

      const parsed = new URL(wispUrl);
      if (parsed.pathname !== "/" || parsed.search) return wispUrl;

      const cleanPath = disguisePath.trim().startsWith("/")
        ? disguisePath.trim()
        : "/" + disguisePath.trim();
      return parsed.origin + cleanPath;
    } catch {
      return wispUrl;
    }
  }

  async init(customWisp?: string): Promise<void> {

    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit(customWisp).catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  async forceReconnectAndWait(customWisp?: string): Promise<void> {

    if (this.initPromise) {
      try { await this.initPromise; } catch {}
    }
    this.forceReconnect();
    return this.init(customWisp);
  }

  private async doInit(customWisp?: string): Promise<void> {
    this.setState({ status: "loading", error: undefined });
    try {
      let wispUrl = this.resolveWispUrl(customWisp);
      wispUrl = this.applyWispPathDisguise(wispUrl);
      if (!wispUrl.endsWith("/")) wispUrl += "/";

      await this.loadBundle();
      await this.setupTransport(wispUrl);
      await ensureFreshScramjetDB();

      const factory = window.$scramjetLoadController!;
      const { ScramjetController } = factory();

      const prefix = getProxyPrefix();
      this.controller = new ScramjetController({
        prefix: prefix,
        files: SCRAMJET_FILES,
        flags: {},
        codec: {
          encode: (u: string) => (u ? encodeURIComponent(u) : u),
          decode: (u: string) => (u ? decodeURIComponent(u) : u),
        },
      });

      try {
        navigator.serviceWorker.controller?.postMessage({ type: "hypers0nic:releaseDB" });
      } catch {}
      await new Promise((r) => setTimeout(r, 200));

      await Promise.race([
        this.controller.init(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("controller.init() timeout")), 20000)
        ),
      ]);

      try {
        navigator.serviceWorker.controller?.postMessage({ type: "hypers0nic:controllerReady" });
      } catch {}

      this.setState({
        status: "ready",
        wispUrl,
        version: window.$scramjetVersion?.version,
      });

      this.transportInitializedAt = Date.now();
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

    if (this.transportConn && this.transportUrl === wispUrl && this.isTransportHealthy()) {
      return;
    }

    if (!wispUrl || (!wispUrl.startsWith("ws://") && !wispUrl.startsWith("wss://"))) {
      wispUrl = FALLBACK_WISP_SERVERS[0];
    }

    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");

    if (!this.transportConn || !this.isTransportAlive()) {
      this.transportConn = new BareMuxConnection("/baremux/worker.js");
    }
    const conn = this.transportConn;

    const localRelay = this.resolveLocalRelay();
    const rawCandidates = [localRelay, wispUrl, ...FALLBACK_WISP_SERVERS].filter(
      (v, i, a) => v && a.indexOf(v) === i
    );

    var candidates: string[] = [];
    var isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    for (const c of rawCandidates) {
      var normalized = c;
      if (!normalized.endsWith("/")) normalized += "/";
      if (c.startsWith("wss://") && !isHttps) {
        const wsVariant = "ws://" + normalized.slice("wss://".length);
        if (!candidates.includes(wsVariant)) candidates.push(wsVariant);
      }
      if (!candidates.includes(normalized)) candidates.push(normalized);
    }

    const settingsRaw =
      typeof window !== "undefined"
        ? localStorage.getItem("hypers0nic:settings:v1")
        : null;
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const useLibcurl = settings?.preferences?.useLibcurlTransport;

    if (useLibcurl) {
      console.log("[hypers0nic] using libcurl transport (Tinf0il mode)");

      return this.setupLibcurlTransport(conn, candidates);
    }

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const transportPromise = conn.setTransport("/epoxy/index.mjs", [
          { wisp: candidate },
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`transport timeout for ${candidate}`)),
            5000
          )
        );
        await Promise.race([transportPromise, timeoutPromise]);

        try {
          const testClient = new (await import("@mercuryworkshop/bare-mux")).BareClient();
          const testRes = await Promise.race([
            testClient.fetch("https://www.google.com/generate_204", {
              method: "GET",
              credentials: "omit",
              cache: "no-store",
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("transport verification timeout")), 8000)
            ),
          ]);
          if (testRes && testRes.status < 500) {
            this.transportUrl = candidate;
            console.log("[hypers0nic] epoxy transport verified via", candidate);
            return;
          } else {
            throw new Error(`verification failed: status ${testRes?.status}`);
          }
        } catch (verifyErr) {
          console.warn(`[hypers0nic] transport verification failed for ${candidate}:`, verifyErr);
          throw verifyErr;
        }
      } catch (err) {
        console.warn(`[hypers0nic] transport failed for ${candidate}:`, err);
        lastError = err;
      }
    }

    console.log("[hypers0nic] all epoxy candidates failed, trying libcurl fallback...");
    try {
      return await this.setupLibcurlTransport(conn, candidates);
    } catch (libcurlErr) {
      console.warn("[hypers0nic] libcurl fallback also failed:", libcurlErr);
    }
    throw new Error(
      `Could not establish a wisp transport: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private async setupLibcurlTransport(conn: any, candidates: string[]): Promise<void> {
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        console.log("[hypers0nic] trying libcurl transport for", candidate);
        const transportPromise = conn.setTransport("/libcurl/index.mjs", [
          { wisp: candidate },
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`libcurl transport timeout for ${candidate}`)),
            5000
          )
        );
        await Promise.race([transportPromise, timeoutPromise]);

        try {
          const { BareClient } = await import("@mercuryworkshop/bare-mux");
          const testClient = new BareClient();
          const testRes = await Promise.race([
            testClient.fetch("https://www.google.com/generate_204", {
              method: "GET",
              credentials: "omit",
              cache: "no-store",
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("libcurl verification timeout")), 8000)
            ),
          ]);
          if (testRes && testRes.status < 500) {
            this.transportUrl = candidate;
            console.log("[hypers0nic] libcurl transport verified via", candidate);
            return;
          } else {
            throw new Error(`verification failed: status ${testRes?.status}`);
          }
        } catch (verifyErr) {
          console.warn(`[hypers0nic] libcurl verification failed for ${candidate}:`, verifyErr);
          throw verifyErr;
        }
      } catch (err) {
        console.warn(`[hypers0nic] libcurl transport failed for ${candidate}:`, err);
        lastError = err;
      }
    }
    throw new Error(`Could not establish a libcurl transport after trying ${candidates.length} candidates: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  private isTransportAlive(): boolean {
    if (!this.transportConn) return false;
    try {
      const port = this.transportConn.getInnerPort?.();
      return !!(port && typeof port === "object" && "postMessage" in port);
    } catch {
      return false;
    }
  }

  async quickHealthCheck(): Promise<boolean> {
    if (!this.transportConn || !this.transportUrl) return false;
    if (this.state.status !== "ready") return false;

    if (!this.isTransportAlive()) return false;

    if (this.transportInitializedAt && Date.now() - this.transportInitializedAt < 30000) {
      return true;
    }

    return this.probeTransportDirect();
  }

  /**
   * Probe the transport health by sending a ping through the BareMux
   * SharedWorker — NOT through the proxy. This avoids the death loop
   * where a health check fetch goes through the SW, which needs the
   * Scramjet config loaded, which may not be ready yet.
   *
   * We send a simple ping message to the BareMux worker and wait for
   * a pong response. If the worker responds, the transport is alive.
   */
  private async probeTransportDirect(): Promise<boolean> {
    if (!this.transportConn) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const probeStart = Date.now();

      const wispUrl = this.transportUrl;
      const httpUrl = wispUrl.replace(/^wss?:\/\//, "https://").replace(/\/$/, "");

      const res = await fetch(httpUrl, {
        method: "GET",
        signal: ctrl.signal,
        credentials: "omit",
        cache: "no-store",
        mode: "no-cors",
      });
      clearTimeout(timer);

      const probeLatency = Date.now() - probeStart;
      if (this.state.latency !== probeLatency) {
        this.setState({ latency: probeLatency });
      }
      return true;
    } catch {
      return this.isTransportAlive();
    }
  }

  forceReconnect(): void {
    this.initPromise = null;
    this.transportUrl = null;
    this.transportInitializedAt = 0;
    this.controller = null;

    this.setState({ status: "idle" });
  }

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
    return DEFAULT_WISP_URL;
  }

  encodeUrl(url: string): string {
    if (!this.controller) {

      return getProxyPrefix() + encodeURIComponent(url);
    }
    try {
      return this.controller.encodeUrl(url);
    } catch {
      return getProxyPrefix() + encodeURIComponent(url);
    }
  }

  decodeUrl(url: string): string {
    if (!this.controller) {

      try {
        const prefix = getProxyPrefix();
        const encoded = url.startsWith(prefix)
          ? url.substring(prefix.length)
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

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  startHeartbeat(): void {
    if (typeof window === "undefined") return;
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(async () => {
      if (this.state.status !== "ready") return;
      if (this.initPromise) return;

      if (this.transportInitializedAt && Date.now() - this.transportInitializedAt < 60000) {
        return;
      }

      if (!this.isTransportAlive()) {
        console.warn("[hypers0nic] heartbeat: transport worker is dead, reconnecting...");
        const settings = typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("hypers0nic:settings:v1") || "{}")
          : {};
        this.forceReconnectAndWait(settings.wispUrl).catch((e) => {
          console.warn("[hypers0nic] background reconnect failed:", e);
        });
      }
    }, 60000);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private visibilityHandler: (() => void) | null = null;

  startVisibilityWatcher(): void {
    if (typeof document === "undefined") return;
    if (this.visibilityHandler) return;
    this.visibilityHandler = async () => {
      if (document.visibilityState === "visible") {
        if (this.state.status === "ready") {

          if (!this.isTransportAlive()) {
            console.warn("[hypers0nic] transport worker died while tab was hidden, reconnecting...");
            try {
              const settings = JSON.parse(
                localStorage.getItem("hypers0nic:settings:v1") || "{}"
              );
              await this.forceReconnectAndWait(settings.wispUrl);
            } catch (e) {
              console.warn("[hypers0nic] visibility reconnect failed:", e);
            }
          }
        }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  stopVisibilityWatcher(): void {
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

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

  }
}

let instance: ScramjetManager | null = null;
export function getScramjet(): ScramjetManager {
  if (!instance) instance = new ScramjetManager();
  return instance;
}

export async function registerServiceWorker(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await waitForController(reg, 10000);

    if (navigator.serviceWorker.controller) {

      try {
        const prefix = getProxyPrefix();
        navigator.serviceWorker.controller.postMessage({
          type: "hypers0nic:setPrefix",
          prefix: prefix,
        });
      } catch {}

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "hypers0nic:wsFailed") {
          console.warn("[hypers0nic] SW reported WebSocket failure, force-reconnecting transport");
          const sj = getScramjet();
          const settings = JSON.parse(localStorage.getItem("hypers0nic:settings:v1") || "{}");
          sj.forceReconnectAndWait(settings.wispUrl).catch(() => {});
        }
      });

      return true;
    }
    return false;
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
    if (reg.waiting) reg.waiting.postMessage({ type: "hypers0nic:skipWaiting" });
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
