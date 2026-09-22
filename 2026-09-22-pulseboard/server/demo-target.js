'use strict';

// A tiny local HTTP server used ONLY to seed example monitors so the demo
// dashboard is never empty on first run, without depending on any external
// network service. /ok always returns 200, /fail always returns 500.

const http = require('http');

function startDemoTargetServer(port = 0) {
  const server = http.createServer((req, res) => {
    if (req.url === '/fail') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('simulated failure (demo target)');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok (demo target)');
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { startDemoTargetServer };
