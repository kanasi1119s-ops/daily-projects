import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const root = process.cwd();
createServer(async (req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  const rel = normalize(p === "/" ? "/index.html" : p);
  if (rel.includes("..")) { res.writeHead(400).end(); return; }
  try {
    const buf = await readFile(join(root, rel));
    res.writeHead(200, { "content-type": types[extname(rel)] ?? "application/octet-stream" }).end(buf);
  } catch { res.writeHead(404).end("not found"); }
}).listen(Number(process.env.PORT) || 8080, () => console.log("http://localhost:8080"));
