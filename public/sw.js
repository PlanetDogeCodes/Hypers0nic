importScripts("/scramjet/scramjet.all.js");

var PROXY_PREFIX = "/service/";
var configLoaded = false;

var scramjet = null;
var { ScramjetServiceWorker } = self.$scramjetLoadWorker();

function setProxyPrefix(newPrefix) {
  if (typeof newPrefix !== "string") return;

  if (!/^\/[a-z0-9\-]+\/$/i.test(newPrefix)) return;
  if (newPrefix === PROXY_PREFIX) return;
  console.log("[hypers0nic/sw] proxy prefix changed:", PROXY_PREFIX, "->", newPrefix);
  PROXY_PREFIX = newPrefix;

  configLoaded = false;

  if (scramjet && scramjet.config) {
    scramjet.config.prefix = PROXY_PREFIX;
  }
}

var RUNTIME_CACHE = "hypers0nic-runtime-v1";
var PRECACHE_URLS = [
  "/scramjet/scramjet.all.js",
  "/scramjet/scramjet.wasm.wasm",
  "/baremux/worker.js",
  "/epoxy/index.mjs",
];

self.addEventListener("install", function(event) {
  self.skipWaiting();

  event.waitUntil(
    caches.open(RUNTIME_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function() {

      });
    })
  );
});
self.addEventListener("activate", function(event) {
  event.waitUntil(
    self.clients.claim().then(function() {

      return caches.keys().then(function(keys) {
        return Promise.all(
          keys.filter(function(k) { return k !== RUNTIME_CACHE; })
              .map(function(k) { return caches.delete(k); })
        );
      });
    })
  );
});

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

    configLoaded = false;
  }
  else if (typeof event.data === "object" && event.data && event.data.type === "setPrefix") {

    setProxyPrefix(event.data.prefix);
  }
  else if (event.data === "ping") {
    event.source && event.source.postMessage({ type: "pong", configLoaded: configLoaded, controllerReady: controllerReady, proxyPrefix: PROXY_PREFIX });
  }
});

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

  if (contentLength > 5 * 1024 * 1024) return Promise.resolve(stripFrameHeaders(response));
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

      if (lower === "content-length") return;
      if (lower === "content-security-policy") return;
      if (lower === "content-security-policy-report-only") return;
      if (lower === "x-frame-options") return;
      if (lower === "cross-origin-opener-policy") return;
      if (lower === "cross-origin-embedder-policy") return;
      if (lower === "cross-origin-embedder-policy-report-only") return;
      newHeaders.set(key, value);
    });
    return new Response(html, { status: response.status, statusText: response.statusText, headers: newHeaders });
  }).catch(function() { return response; });
}

function stripFrameHeaders(response) {
  if (!response) return response;
  var modified = false;
  var newHeaders = new Headers();
  response.headers.forEach(function(value, key) {
    var lower = key.toLowerCase();
    if (lower === "x-frame-options" ||
        lower === "cross-origin-opener-policy" ||
        lower === "cross-origin-embedder-policy" ||
        lower === "cross-origin-embedder-policy-report-only") {
      modified = true;
      return;
    }
    newHeaders.set(key, value);
  });
  if (!modified) return response;
  try {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (e) {
    return response;
  }
}

function healScramjetDB() {
  return new Promise(function(resolve) {
    var DB_NAME = "$scramjet";
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      resolve(false);
    }, 5000);
    function done(val) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    }
    try {
      var req = indexedDB.open(DB_NAME);
      req.onsuccess = function() {
        var db = req.result;
        var stores = Array.from(db.objectStoreNames);
        db.close();
        if (stores.length > 0 && stores.indexOf("config") !== -1) {
          done(true);
        } else {
          var delReq = indexedDB.deleteDatabase(DB_NAME);
          delReq.onsuccess = function() { done(false); };
          delReq.onerror = function() { done(false); };
          delReq.onblocked = function() { done(false); };
        }
      };
      req.onerror = function() { done(false); };
      req.onupgradeneeded = function() {
        req.result.close();
        done(false);
      };
    } catch (e) {
      done(false);
    }
  });
}

function safeLoadConfig() {

  if (!scramjet) {
    console.warn("[hypers0nic/sw] safeLoadConfig: scramjet is null, creating it");
    try {
      scramjet = new ScramjetServiceWorker();
    } catch (e) {
      console.error("[hypers0nic/sw] failed to create ScramjetServiceWorker:", e);
      configLoaded = false;
      return Promise.resolve();
    }
  }

  var configPromise = scramjet.loadConfig();
  var timeoutPromise = new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error("loadConfig timeout")); }, 5000);
  });
  return Promise.race([configPromise, timeoutPromise]).then(function() {

    if (scramjet.config && scramjet.config.prefix === PROXY_PREFIX) {
      configLoaded = true;
    } else {
      console.warn("[hypers0nic/sw] config invalid or missing prefix after loadConfig");
      configLoaded = false;
    }
  }).catch(function(err) {
    if (err && (err.name === "NotFoundError" || (err.message && err.message.indexOf("object store") !== -1))) {
      return healScramjetDB().then(function() {
        return new Promise(function(resolve) { setTimeout(resolve, 500); });
      }).then(function() {
        var retryPromise = scramjet.loadConfig();
        var retryTimeout = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error("loadConfig retry timeout")); }, 5000);
        });
        return Promise.race([retryPromise, retryTimeout]).then(function() {
          configLoaded = scramjet.config && scramjet.config.prefix === PROXY_PREFIX;
        }).catch(function() {
          configLoaded = false;
        });
      });
    }
    configLoaded = false;
  });
}

function isRuntimeAsset(pathname) {
  return PRECACHE_URLS.indexOf(pathname) !== -1;
}

function fetchRuntimeAsset(request) {
  return caches.open(RUNTIME_CACHE).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {

        if (response && response.ok) {
          cache.put(request, response.clone()).catch(function() {});
        }
        return response;
      }).catch(function() {

        return cache.match(request);
      });
    });
  });
}

function fetchWithRetry(event, maxRetries = 3) {

  var BACKOFF_DELAYS = [300, 600, 1200, 2400, 4800];
  var attempt = 0;
  function tryFetch() {
    return scramjet.fetch(event).then(function(response) {

      if (response && (response.status === 502 || response.status === 503 || response.status === 504) && attempt < maxRetries) {
        var delay = BACKOFF_DELAYS[attempt] || (BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1] * 2);
        attempt++;
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(tryFetch()); }, delay);
        });
      }
      return response;
    }).catch(function(err) {
      if (attempt < maxRetries) {
        var delay = BACKOFF_DELAYS[attempt] || (BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1] * 2);
        attempt++;
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(tryFetch()); }, delay);
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

  if (isRuntimeAsset(url.pathname)) {
    event.respondWith(fetchRuntimeAsset(event.request));
    return;
  }

  if (!url.pathname.startsWith(PROXY_PREFIX)) return;

  event.respondWith(
    (async function() {
      var maxAttempts = 7;

      var delays = [100, 300, 700, 1500, 3000, 5000, 8000];

      await waitForControllerReady(15000);

      for (var i = 0; i < maxAttempts; i++) {
        try {

          if (i === 0 && !configLoaded) {
            await healScramjetDB();
          }

          if (!configLoaded || !scramjet || !scramjet.config || scramjet.config.prefix !== PROXY_PREFIX) {
            await safeLoadConfig();
          }

          if (!configLoaded) {
            if (i < maxAttempts - 1) {
              await new Promise(function(r) { setTimeout(r, delays[i] || 2000); });
              continue;
            }

            return new Response(
              "Proxy not ready: config not loaded after " + maxAttempts + " retries.",
              { status: 502, headers: { "Content-Type": "text/plain" } }
            );
          }

          if (!scramjet) {
            console.warn("[hypers0nic/sw] scramjet is null in fetch handler, creating it");
            try {
              scramjet = new ScramjetServiceWorker();
            } catch (e) {
              return new Response(
                "Proxy not ready: failed to create ScramjetServiceWorker: " + (e && e.message || e),
                { status: 502, headers: { "Content-Type": "text/plain" } }
              );
            }
          }

          if (!scramjet.config || !scramjet.config.prefix) {
            console.log("[hypers0nic/sw] config missing, calling loadConfig()...");
            try {
              await scramjet.loadConfig();
            } catch (configErr) {
              console.warn("[hypers0nic/sw] loadConfig() failed:", configErr);
              await healScramjetDB();
              await new Promise(function(r) { setTimeout(r, 500); });
              try { await scramjet.loadConfig(); } catch (e) {}
            }
          }

          if (!scramjet.config || !scramjet.config.prefix) {
            if (i < maxAttempts - 1) {
              console.warn("[hypers0nic/sw] config still not loaded, retrying...");
              await new Promise(function(r) { setTimeout(r, delays[i] || 2000); });
              continue;
            }
            return new Response(
              "Proxy not ready: config not loaded after " + maxAttempts + " retries.",
              { status: 502, headers: { "Content-Type": "text/plain" } }
            );
          }

          configLoaded = true;

          if (scramjet.route(event)) {

            var response = await fetchWithRetry(event, 3);

            var encodedUrl = url.pathname.substring(PROXY_PREFIX.length);
            var decodedUrl;
            try { decodedUrl = decodeURIComponent(encodedUrl); } catch(e) { decodedUrl = encodedUrl; }
            if (isAdRequest(decodedUrl)) {
              return new Response("", { status: 204, headers: { "Content-Type": "text/plain" } });
            }

            if (response && response.ok && isHtmlResponse(response)) {
              try { return await injectIntoHtml(response); } catch(e) { return stripFrameHeaders(response); }
            }
            return stripFrameHeaders(response);
          }

          return new Response("Not found.", { status: 404, headers: { "Content-Type": "text/plain" } });
        } catch (err) {
          if (i < maxAttempts - 1) {

            if (err && (err.name === "NotFoundError" || (err.message && err.message.indexOf("object store") !== -1))) {
              await healScramjetDB();
            }
            await new Promise(function(r) { setTimeout(r, delays[i] || 2000); });
            continue;
          }
          console.error("[hypers0nic/sw] scramjet error after " + maxAttempts + " retries:", err);

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
