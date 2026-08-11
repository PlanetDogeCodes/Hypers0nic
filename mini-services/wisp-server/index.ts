/*
 * Hypers0nic Wisp transport server.
 *
 * Scramjet proxies outbound traffic through a "wisp" WebSocket relay. This
 * process owns that relay on port 3001 and is exposed to the browser through
 * the Caddy gateway (requests carry ?XTransformPort=3001).
 *
 * The server is intentionally tiny: an HTTP listener that answers health
 * checks, plus a WebSocket upgrade handler delegated to wisp-js.
 */
import http from "node:http";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

const PORT = 3001;
const HOST = "0.0.0.0";

logging.set_level(logging.INFO);

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("hypers0nic-wisp OK");
});

server.on("upgrade", (req, socket, head) => {
  // The Caddy gateway routes browser traffic to this service via the
  // ?XTransformPort=3001 query parameter. The wisp-js server, however, decides
  // between its wisp-protocol handler and its raw wsproxy handler by checking
  // whether `req.url` ends with "/". A query string makes that check fail and
  // the connection gets misrouted into the wsproxy path, which then tries to
  // DNS-resolve the query string and dies with ENOTFOUND. Strip the query
  // before handing the request off so routing works as intended.
  try {
    const parsed = new URL(req.url, "http://localhost");
    req.url = parsed.pathname;
  } catch {
    /* leave req.url untouched */
  }
  wisp.routeRequest(req, socket, head);
});

server.listen(PORT, HOST, () => {
  console.log(`[wisp] listening on ${HOST}:${PORT}`);
});
