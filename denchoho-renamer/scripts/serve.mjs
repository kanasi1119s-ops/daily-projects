import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const port = process.env.PORT || 8080;
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const rel = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(process.cwd(), rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`http://localhost:${port}`));
