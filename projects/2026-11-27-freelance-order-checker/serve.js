import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const T = { ".html": "text/html;charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const root = path.resolve(".");
http.createServer((q, s) => {
  let p = path.normalize(decodeURIComponent(q.url.split("?")[0])); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || /\/(test|docs|node_modules)\//.test(p) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end("not found"); }
  s.writeHead(200, { "content-type": T[path.extname(f)] || "text/plain" }); fs.createReadStream(f).pipe(s);
}).listen(process.env.PORT || 8080, () => console.log("http://localhost:" + (process.env.PORT || 8080)));
