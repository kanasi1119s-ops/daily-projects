import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, "http://x").pathname;
    const rel = normalize(p === "/" ? "/index.html" : p).replace(/^(\.\.[/\\])+/, "");
    const file = join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const ext = file.slice(file.lastIndexOf("."));
    res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream" }).end(await readFile(file));
  } catch { res.writeHead(404).end("not found"); }
}).listen(process.env.PORT ?? 5173, () => console.log("http://localhost:" + (process.env.PORT ?? 5173)));
