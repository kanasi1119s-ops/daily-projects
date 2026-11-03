import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = process.argv[2] ?? ".";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const port = Number(process.env.PORT ?? 8080);
http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, p.endsWith("/") ? p + "index.html" : p);
  try { res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end("not found"); }
}).listen(port, () => console.log(`http://localhost:${port}`));
