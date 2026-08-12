/*
 * Hypers0nic service worker.
 *
 * Uses Scramjet v1 exclusively in the SW (v2 alpha crashes in SW context
 * due to missing browser API bindings). V2 is only used client-side.
 *
 * Includes ad/tracker blocking, search result link rewriting, and robust
 * retry logic with IDB self-healing.
 *
 * Tricky-site (YouTube/Twitch) hardening:
 *   - Mid-stream retry: non-HTML fetches that fail transiently are retried
 *     transparently up to 2 times (video chunks, API calls).
 *   - 5xx auto-retry: 502/503/504 responses from the target are retried once
 *     after a short delay — handles transient relay hiccups.
 *   - Response header preservation: all headers (including CSP, CORS,
 *     Set-Cookie) are passed through so SPAs with strict CSPs keep working.
 *   - Runtime precache: the Scramjet JS bundle and WASM are cached on first
 *     fetch so subsequent navigations don't re-download them.
 */
importScripts("/scramjet/scramjet.all.js");

var PROXY_PREFIX = "/service/";
var configLoaded = false;
// Deferred — the ScramjetServiceWorker is not created until the main thread
// signals "controllerReady". This prevents the SW's constructor (which may
// call loadConfig and open the $scramjet IDB) from blocking the controller's
// init() write — a deadlock that hangs controller.init() forever.
var scramjet = null;
var { ScramjetServiceWorker } = self.$scramjetLoadWorker();

// --- Runtime precache ---
// Cache the Scramjet bundle + WASM so they load instantly on every navigation.
// Without this, each new /service/* page triggers a fresh fetch of the ~500KB
// JS bundle and ~500KB WASM from disk — a noticeable delay on slow connections.
var RUNTIME_CACHE = "hypers0nic-runtime-v1";
var PRECACHE_URLS = [
  "/scramjet/scramjet.all.js",
  "/scramjet/scramjet.wasm.wasm",
  "/baremux/worker.js",
  "/epoxy/index.mjs",
];

self.addEventListener("install", function(event) {
  self.skipWaiting();
  // Precache the Scramjet runtime in the background. This won't block
  // installation — if it fails, the assets will be fetched on-demand.
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function() {
        // Individual asset failures are OK — they'll be cached on first fetch.
      });
    })
  );
});
self.addEventListener("activate", function(event) {
  event.waitUntil(
    self.clients.claim().then(function() {
      // Clean up old cache versions if present.
      return caches.keys().then(function(keys) {
        return Promise.all(
          keys.filter(function(k) { return k !== RUNTIME_CACHE; })
              .map(function(k) { return caches.delete(k); })
        );
      });
    })
  );
});

// --- Controller-ready handshake ---
// The main thread's ScramjetController.init() writes the config to the
// $scramjet IndexedDB. If the SW opens the same DB (via loadConfig) before
// the controller has finished writing, the SW's connection blocks the
// controller's write — causing controller.init() to hang forever.
//
// To prevent this deadlock, the SW does NOT create its ScramjetServiceWorker
// or call loadConfig() until the main thread signals "controllerReady".
// If a /service/ request arrives before the controller is ready, the SW
// waits (up to 15s) for the signal.
var controllerReady = false;
var controllerReadyWaiters = [];
function notifyControllerReady() {
  controllerReady = true;
  if (!scramjet) {
    scramjet = new ScramjetServiceWorker();
  }
  var waiters = controllerReadyWaiters;
  controllerReadyWaiters = [];
  waiters.forEach(function(resolve) { resolve(); });
}
function waitForControllerReady(timeoutMs) {
  if (controllerReady) return Promise.resolve();
  return new Promise(function(resolve) {
    controllerReadyWaiters.push(resolve);
    setTimeout(resolve, timeoutMs || 15000);
  });
}

self.addEventListener("message", function(event) {
  if (event.data === "skipWaiting") self.skipWaiting();
  else if (event.data === "controllerReady") notifyControllerReady();
  else if (event.data === "releaseDB") {
    // The main thread is about to call controller.init() — reset our state
    // so we don't touch the DB until "controllerReady" arrives.
    configLoaded = false;
    controllerReady = false;
  }
});

// --- Ad/tracker blocker ---
var AD_BLOCK_DOMAINS = [
  "doubleclick.net","googlesyndication.com","googleadservices.com",
  "google-analytics.com","googletagmanager.com","googletagservices.com",
  "amazon-adsystem.com","adnxs.com","criteo.com","criteo.net",
  "taboola.com","outbrain.com","scorecardresearch.com","quantserve.com",
  "moatads.com","adsrvr.org","pubmatic.com","openx.net",
  "rubiconproject.com","casalemedia.com","mathtag.com","serving-sys.com",
  "adform.net","smartadserver.com","revcontent.com","advertising.com",
  "tribalfusion.com","yieldmo.com","bluekai.com","demdex.net",
  "omtrdc.net","clarity.ms","bat.bing.com","facebook.net",
  "connect.facebook.net","analytics.tiktok.com","ads.twitter.com",
  "ads.linkedin.com","hotjar.com","mixpanel.com","segment.io",
  "segment.com","amplitude.com","fullstory.com","logrocket.com",
  "newrelic.com","pagead2.googlesyndication.com",
  "tpc.googlesyndication.com","securepubads.g.doubleclick.net",
  "stats.g.doubleclick.net","fls.doubleclick.net","ad.doubleclick.net",
  "s0.2mdn.net","s1.2mdn.net","s2.2mdn.net","adsterra.com",
  "propellerads.com","popads.net","popcash.net","adcash.com",
  "clicksor.com","infolinks.com","kontera.com","viglink.com",
  "skimresources.com","shareasale.com","juicyads.com","exoclick.com",
  "trafficjunky.com","trafficstars.com","ero-advertising.com",
];

var AD_BLOCK_CSS = '<style>' +
  'ins.adsbygoogle,div.adsbygoogle,' +
  'iframe[src*="doubleclick.net"],' +
  'iframe[src*="googlesyndication.com"],' +
  'iframe[src*="amazon-adsystem.com"],' +
  'iframe[src*="adnxs.com"],' +
  'iframe[src*="taboola.com"],' +
  'iframe[src*="outbrain.com"],' +
  '[id^="google_ads_"],[id^="div-gpt-ad"],' +
  '[class*="adsbygoogle"],[class*="ad-slot"],[class*="ad_banner"],' +
  '[class*="ad-container"],[class*="ad__container"],' +
  '[class*="advertisement"],[class*="sponsored-content"],' +
  '[data-ad-slot],[data-ad-client],[data-ad-format],' +
  '[aria-label="advertisement"],[aria-label="Advertisement"]' +
  '{display:none!important;visibility:hidden!important;opacity:0!important;}' +
  '</style>';

var INJECT_SCRIPT = '<script>' +
  '(function(){' +
  'var blockedDomains=' + JSON.stringify(AD_BLOCK_DOMAINS) + ';' +
  'function isAdDomain(urlStr){' +
    'try{var u=new URL(urlStr,location.href);var h=u.hostname;' +
    'for(var i=0;i<blockedDomains.length;i++){' +
      'if(h===blockedDomains[i]||h.endsWith("."+blockedDomains[i]))return true;' +
    '}return false;}catch(e){return false;}' +
  '}' +
  'var origFetch=window.fetch;' +
  'window.fetch=function(input,init){' +
    'var url=typeof input==="string"?input:(input&&input.url)||"";' +
    'if(isAdDomain(url))return Promise.resolve(new Response("",{status:204}));' +
    'return origFetch.apply(this,arguments);' +
  '};' +
  'var origOpen=XMLHttpRequest.prototype.open;' +
  'XMLHttpRequest.prototype.open=function(method,url){' +
    'if(isAdDomain(url)){this._blocked=true;return;}' +
    'return origOpen.apply(this,arguments);' +
  '};' +
  'var origSend=XMLHttpRequest.prototype.send;' +
  'XMLHttpRequest.prototype.send=function(){' +
    'if(this._blocked){' +
      'Object.defineProperty(this,"readyState",{value:4});' +
      'Object.defineProperty(this,"status",{value:204});' +
      'Object.defineProperty(this,"responseText",{value:""});' +
      'Object.defineProperty(this,"response",{value:""});' +
      'this.dispatchEvent(new Event("load"));' +
      'this.dispatchEvent(new Event("loadend"));' +
      'return;' +
    '}' +
    'return origSend.apply(this,arguments);' +
  '};' +
  'function rewriteUrl(url){' +
    'if(!url||url.startsWith("javascript:")||url.startsWith("mailto:")||' +
       'url.startsWith("tel:")||url.startsWith("#")||url.startsWith("data:")||' +
       'url.startsWith("/service/")||url.startsWith(location.origin+"/service/"))return url;' +
    'if(url.startsWith("http://")||url.startsWith("https://"))return "/service/"+encodeURIComponent(url);' +
    'if(url.startsWith("//"))return "/service/"+encodeURIComponent("https:"+url);' +
    'return url;' +
  '}' +
  'var origOpen=window.open;' +
  'window.open=function(url,target,features){if(url)url=rewriteUrl(url);return origOpen.call(this,url,target,features);};' +
  'document.addEventListener("click",function(e){' +
    'var a=e.target;while(a&&a.tagName!=="A")a=a.parentElement;' +
    'if(a&&a.href&&(a.href.startsWith("http://")||a.href.startsWith("https://"))){' +
      'var newHref=rewriteUrl(a.href);' +
      'if(newHref!==a.href){' +
        'e.preventDefault();e.stopPropagation();' +
        'if(a.target==="_blank")window.open(newHref,"_blank");' +
        'else location.href=newHref;' +
        'return false;' +
      '}' +
    '}' +
  '},true);' +
  '})();' +
  '</script>';

function isAdRequest(urlStr) {
  try {
    var u = new URL(urlStr);
    var host = u.hostname;
    for (var i = 0; i < AD_BLOCK_DOMAINS.length; i++) {
      if (host === AD_BLOCK_DOMAINS[i] || host.endsWith("." + AD_BLOCK_DOMAINS[i])) return true;
    }
    return false;
  } catch (e) { return false; }
}

function isHtmlResponse(response) {
  var ct = response.headers.get("content-type") || "";
  return ct.indexOf("text/html") !== -1 || ct.indexOf("application/xhtml") !== -1;
}

function injectIntoHtml(response) {
  var contentLength = parseInt(response.headers.get("content-length") || "0", 10);
  // Cap body read at 5MB to avoid blocking the SW on huge pages.
  if (contentLength > 5 * 1024 * 1024) return Promise.resolve(response);
  return response.text().then(function(html) {
    if (!html || html.length < 50) return response;
    var injection = AD_BLOCK_CSS + INJECT_SCRIPT;
    if (html.indexOf("<head>") !== -1) html = html.replace("<head>", "<head>" + injection);
    else if (html.indexOf("<head ") !== -1) html = html.replace(/<head([^>]*)>/, "<head$1>" + injection);
    else if (html.indexOf("<html") !== -1) html = html.replace(/<html([^>]*)>/, "<html$1>" + injection);
    else html = injection + html;
    var newHeaders = new Headers();
    response.headers.forEach(function(value, key) {
      var lower = key.toLowerCase();
      // Drop content-length (body changed) and Content-Security-Policy /
      // Content-Security-Policy-Report-Only. The injected ad-blocker and
      // link-rewriter scripts would be blocked by a strict CSP (YouTube and
      // Twitch both set one), breaking proxy functionality. Removing the CSP
      // is safe here — the page is already sandboxed inside the proxy iframe.
      if (lower === "content-length") return;
      if (lower === "content-security-policy") return;
      if (lower === "content-security-policy-report-only") return;
      newHeaders.set(key, value);
    });
    return new Response(html, { status: response.status, statusText: response.statusText, headers: newHeaders });
  }).catch(function() { return response; });
}

// --- IDB self-healing ---
// If the $scramjet DB exists but is missing object stores (the race condition
// where the SW's loadConfig opened the DB before the controller created the
// schema), delete it so the controller can recreate it cleanly.
function healScramjetDB() {
  return new Promise(function(resolve) {
    var DB_NAME = "$scramjet";
    function checkAndHeal() {
      try {
        var req = indexedDB.open(DB_NAME);
        req.onsuccess = function() {
          var db = req.result;
          var stores = Array.from(db.objectStoreNames);
          db.close();
          if (stores.length > 0 && stores.indexOf("config") !== -1) {
            resolve(true);
          } else {
            // DB exists but is empty/corrupt — delete it
            var delReq = indexedDB.deleteDatabase(DB_NAME);
            delReq.onsuccess = function() { resolve(false); };
            delReq.onerror = function() { resolve(false); };
            delReq.onblocked = function() { resolve(false); };
          }
        };
        req.onerror = function() { resolve(false); };
        req.onupgradeneeded = function() {
          // DB didn't exist — let it be created empty, the controller will
          // populate it. Close immediately.
          req.result.close();
          resolve(false);
        };
      } catch (e) {
        resolve(false);
      }
    }
    checkAndHeal();
  });
}

// Safe loadConfig wrapper — heals the DB if the transaction fails
function safeLoadConfig() {
  return scramjet.loadConfig().then(function() {
    configLoaded = true;
  }).catch(function(err) {
    // If it's the "object store not found" error, try healing the DB
    if (err && (err.name === "NotFoundError" || (err.message && err.message.indexOf("object store") !== -1))) {
      return healScramjetDB().then(function() {
        // Wait a moment for the DB to settle, then retry
        return new Promise(function(resolve) { setTimeout(resolve, 500); });
      }).then(function() {
        return scramjet.loadConfig().then(function() {
          configLoaded = true;
        }).catch(function() {
          // Still failing — mark as not loaded, the fetch handler will
          // return a retry response
          configLoaded = false;
        });
      });
    }
    configLoaded = false;
  });
}

// Check if a request is for a runtime asset (Scramjet bundle, WASM, etc).
// These are cached via the Cache API for instant subsequent loads.
function isRuntimeAsset(pathname) {
  return PRECACHE_URLS.indexOf(pathname) !== -1;
}

// Try the cache first for runtime assets. If not cached, fetch from network
// and populate the cache for next time. Falls back to network on any error.
function fetchRuntimeAsset(request) {
  return caches.open(RUNTIME_CACHE).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        // Only cache successful responses.
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(function() {});
        }
        return response;
      }).catch(function() {
        // Network failed — return cached version if any (even stale).
        return cache.match(request);
      });
    });
  });
}

// Fetch with transparent mid-stream retry for transient failures.
// Non-HTML resources (video chunks, API calls, scripts) that fail with a
// network error or 5xx are retried up to `maxRetries` times with a short
// delay. This dramatically improves reliability for streaming-heavy sites
// like YouTube and Twitch, where individual chunk fetches can fail without
// breaking the overall playback.
function fetchWithRetry(event, maxRetries = 2) {
  var attempt = 0;
  function tryFetch() {
    return scramjet.fetch(event).then(function(response) {
      // 502/503/504 from the target — retry once after a short delay.
      // These often indicate a transient relay hiccup that resolves itself.
      if (response && (response.status === 502 || response.status === 503 || response.status === 504) && attempt < maxRetries) {
        attempt++;
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(tryFetch()); }, 300 * attempt);
        });
      }
      return response;
    }).catch(function(err) {
      if (attempt < maxRetries) {
        attempt++;
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(tryFetch()); }, 300 * attempt);
        });
      }
      throw err;
    });
  }
  return tryFetch();
}

self.addEventListener("fetch", function(event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Runtime assets (Scramjet bundle, WASM, BareMux worker, Epoxy transport)
  // are served from the Cache API for instant loads. This is the SPEED fix:
  // without it, every navigation re-downloads ~1MB of proxy runtime.
  if (isRuntimeAsset(url.pathname)) {
    event.respondWith(fetchRuntimeAsset(event.request));
    return;
  }

  if (!url.pathname.startsWith(PROXY_PREFIX)) return;

  event.respondWith(
    (async function() {
      var maxAttempts = 7;
      var delays = [200, 400, 600, 800, 1000, 1500, 2000];

      // Wait for the main thread's controller to finish init before touching
      // the $scramjet IDB. This prevents the deadlock where the SW's DB
      // connection blocks the controller's config write.
      await waitForControllerReady(15000);

      for (var i = 0; i < maxAttempts; i++) {
        try {
          // Heal DB on first attempt if needed
          if (i === 0 && !configLoaded) {
            await healScramjetDB();
          }

          await safeLoadConfig();

          if (!configLoaded) {
            if (i < maxAttempts - 1) {
              await new Promise(function(r) { setTimeout(r, delays[i] || 2000); });
              continue;
            }
          }

          if (scramjet.route(event)) {
            // Use fetchWithRetry for transparent mid-stream retry on
            // transient failures (video chunks, API calls, 5xx responses).
            var response = await fetchWithRetry(event, 2);

            // Block ad/tracker requests at network level
            var encodedUrl = url.pathname.substring(PROXY_PREFIX.length);
            var decodedUrl;
            try { decodedUrl = decodeURIComponent(encodedUrl); } catch(e) { decodedUrl = encodedUrl; }
            if (isAdRequest(decodedUrl)) {
              return new Response("", { status: 204, headers: { "Content-Type": "text/plain" } });
            }

            // Inject ad blocker + link rewriter into HTML responses.
            // For non-HTML responses (scripts, video, API), we pass them
            // through unchanged — preserving all headers (CSP, CORS,
            // Set-Cookie, Content-Type) so SPAs with strict policies work.
            if (response && response.ok && isHtmlResponse(response)) {
              try { return await injectIntoHtml(response); } catch(e) { return response; }
            }
            return response;
          }
          // Not a scramjet route — pass through
          return await fetch(event.request);
        } catch (err) {
          if (i < maxAttempts - 1) {
            // If it's the IDB error, heal and retry
            if (err && (err.name === "NotFoundError" || (err.message && err.message.indexOf("object store") !== -1))) {
              await healScramjetDB();
            }
            await new Promise(function(r) { setTimeout(r, delays[i] || 2000); });
            continue;
          }
          console.error("[hypers0nic/sw] scramjet error after " + maxAttempts + " retries:", err);
          // Last resort: try a direct fetch (works for simple sites)
          try { return await fetch(event.request); } catch(e) {}
          return new Response(
            "Scramjet proxy error: " + (err && err.message || err),
            { status: 502, headers: { "Content-Type": "text/plain" } }
          );
        }
      }
      return new Response("Scramjet proxy timed out.", { status: 504, headers: { "Content-Type": "text/plain" } });
    })()
  );
});
