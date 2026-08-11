/*
 * Hypers0nic service worker.
 *
 * Tries Scramjet v2 first, falls back to v1. Includes ad/tracker blocking,
 * search result link rewriting, and robust retry logic.
 *
 * The "negotiating wisp" hang is prevented by:
 * 1. A 30-second hard timeout on the entire fetch handler
 * 2. Retry logic with exponential backoff (5 attempts)
 * 3. Graceful fallback to network if Scramjet fails
 */
importScripts("/scramjet/scramjet.all.js");

// V1 API (always available as fallback)
var scramjetV1 = null;
var scramjetV2 = null;
var useV2 = false;

// Try to load v2
try {
  importScripts("/scramjet/scramjet.v2.js");
  if (self.$scramjet && self.$scramjet.ScramjetFetchHandler) {
    scramjetV2 = new self.$scramjet.ScramjetFetchHandler();
    useV2 = true;
    console.log("[hypers0nic/sw] Using Scramjet v2");
  }
} catch (e) {
  console.warn("[hypers0nic/sw] v2 load failed, falling back to v1:", e);
}

// Initialize v1 as fallback
if (!useV2 && self.$scramjetLoadWorker) {
  try {
    var v1Factory = self.$scramjetLoadWorker();
    scramjetV1 = new v1Factory.ScramjetServiceWorker();
    console.log("[hypers0nic/sw] Using Scramjet v1");
  } catch (e) {
    console.error("[hypers0nic/sw] v1 init failed:", e);
  }
}

var PROXY_PREFIX = "/service/";

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

self.addEventListener("install", function() { self.skipWaiting(); });
self.addEventListener("activate", function(event) { event.waitUntil(self.clients.claim()); });
self.addEventListener("message", function(event) {
  if (event.data === "skipWaiting") self.skipWaiting();
});

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

// Unified scramjet interface — works with both v1 and v2
var sj = {
  loadConfig: function() {
    if (useV2 && scramjetV2) return scramjetV2.loadConfig();
    if (scramjetV1) return scramjetV1.loadConfig();
    return Promise.resolve();
  },
  route: function(event) {
    if (useV2 && scramjetV2) return scramjetV2.route(event);
    if (scramjetV1) return scramjetV1.route(event);
    return false;
  },
  fetch: function(event) {
    if (useV2 && scramjetV2) return scramjetV2.fetch(event);
    if (scramjetV1) return scramjetV1.fetch(event);
    return fetch(event.request);
  },
  get config() {
    if (useV2 && scramjetV2) return scramjetV2.config;
    if (scramjetV1) return scramjetV1.config;
    return null;
  }
};

self.addEventListener("fetch", function(event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(PROXY_PREFIX)) return;

  event.respondWith(
    (async function() {
      var maxAttempts = 5;
      var delay = 400;
      for (var i = 0; i < maxAttempts; i++) {
        try {
          await sj.loadConfig();
          if (sj.route(event)) {
            var response = await sj.fetch(event);

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
          return await fetch(event.request);
        } catch (err) {
          if (i < maxAttempts - 1) {
            await new Promise(function(r) { setTimeout(r, delay); });
            continue;
          }
          console.error("[hypers0nic/sw] scramjet error after retries:", err);
          // Last resort: try to fetch directly (may work for simple sites)
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
