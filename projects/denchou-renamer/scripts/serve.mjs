import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('../src/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const f = join(root, p === '/' ? 'index.html' : p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(f);
    res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(process.env.PORT || 5173, () => console.log('http://localhost:' + (process.env.PORT || 5173)));
