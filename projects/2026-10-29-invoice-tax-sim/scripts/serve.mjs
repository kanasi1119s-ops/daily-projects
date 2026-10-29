import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const root = join(process.cwd(), "src");
createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = join(root, p === "/" ? "index.html" : p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(file); res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(b); }
  catch { res.writeHead(404).end("not found"); }
}).listen(process.env.PORT || 5173, () => console.log("http://localhost:" + (process.env.PORT || 5173)));
