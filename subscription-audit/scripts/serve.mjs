// ローカル確認用の簡易サーバー(npm start / PORT 環境変数で変更可)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', process.env.DIR || '.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!(file + sep).startsWith(normalize(root) + sep)) { res.writeHead(403).end('forbidden'); return; }
    const ext = extname(file);
    if (!types[ext]) { res.writeHead(404).end('not found'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[ext] }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(+process.env.PORT || 8080, () => console.log('http://localhost:' + (process.env.PORT || 8080)));
