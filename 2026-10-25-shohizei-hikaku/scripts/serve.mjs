import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(root, p === '/' ? 'index.html' : p);
  if (!file.startsWith(root) || !types[extname(file)]) { res.writeHead(404).end('not found'); return; }
  try { res.writeHead(200, { 'content-type': types[extname(file)] }).end(await readFile(file)); }
  catch { res.writeHead(404).end('not found'); }
}).listen(process.env.PORT || 5173, () => console.log('http://localhost:' + (process.env.PORT || 5173)));
