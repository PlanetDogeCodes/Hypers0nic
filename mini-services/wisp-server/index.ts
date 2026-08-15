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

  try {
    const parsed = new URL(req.url, "http://localhost");
    req.url = parsed.pathname;
  } catch {

  }
  wisp.routeRequest(req, socket, head);
});

server.listen(PORT, HOST, () => {
  console.log(`[wisp] listening on ${HOST}:${PORT}`);
});
