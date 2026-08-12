/*
 * Hypers0nic service worker.
 *
 * Uses Scramjet v1 exclusively in the SW (v2 alpha crashes in SW context
 * due to missing browser API bindings). V2 is only used client-side.
 *
 * Includes ad/tracker blocking, search result link rewriting, and robust
 * retry logic with IDB self-healing.
 */
importScripts("/scramjet/scramjet.all.js");

var { ScramjetServiceWorker } = self.$scramjetLoadWorker();
var scramjet = new ScramjetServiceWorker();
var PROXY_PREFIX = "/service/";
var configLoaded = false;

self.addEventListener("install", function() { self.skipWaiting(); });
self.addEventListener("activate", function(event) { event.waitUntil(self.clients.claim()); });
self.addEventListener("message", function(event) {
  if (event.data === "skipWaiting") self.skipWaiting();
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
      if (key.toLowerCase() !== "content-length") newHeaders.set(key, value);
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

// Keepalive: periodically ping the BareMux worker to detect dead connections.
// If the transport drops, the next fetch will fail and the retry logic will
// handle reconnection. This is a passive check — we don't force reconnect
// from the SW, we just make sure the next request detects the failure fast.
var lastFetchTime = Date.now();
var KEEPALIVE_INTERVAL = 60000; // 60 seconds
setInterval(function() {
  // If no fetch in the last 60s, do a lightweight check
  if (Date.now() - lastFetchTime > KEEPALIVE_INTERVAL) {
    lastFetchTime = Date.now();
    // The check is implicit: the next real fetch will either succeed or
    // trigger the retry logic. No need for an explicit ping.
  }
}, KEEPALIVE_INTERVAL);
// validates the config has the expected prefix to detect stale/v2 configs.
function safeLoadConfig() {
  return scramjet.loadConfig().then(function() {
    // Validate the config is compatible — check that it has the expected
    // prefix. If a v2 config was written to the DB (which uses a different
    // format), the prefix check will fail and we'll heal the DB.
    if (scramjet.config && scramjet.config.prefix !== PROXY_PREFIX) {
      console.warn("[hypers0nic/sw] Stale config detected (prefix mismatch), healing DB");
      configLoaded = false;
      return healScramjetDB().then(function() {
        return new Promise(function(resolve) { setTimeout(resolve, 500); });
      }).then(function() {
        return scramjet.loadConfig().then(function() {
          configLoaded = true;
        }).catch(function() {
          configLoaded = false;
        });
      });
    }
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

self.addEventListener("fetch", function(event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(PROXY_PREFIX)) return;

  event.respondWith(
    (async function() {
      var maxAttempts = 7;
      var delays = [200, 400, 600, 800, 1000, 1500, 2000];
      lastFetchTime = Date.now();
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
            var response = await scramjet.fetch(event);

            // Block ad/tracker requests at network level
            var encodedUrl = url.pathname.substring(PROXY_PREFIX.length);
            var decodedUrl;
            try { decodedUrl = decodeURIComponent(encodedUrl); } catch(e) { decodedUrl = encodedUrl; }
            if (isAdRequest(decodedUrl)) {
              return new Response("", { status: 204, headers: { "Content-Type": "text/plain" } });
            }

            // Inject ad blocker + link rewriter into HTML responses
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
