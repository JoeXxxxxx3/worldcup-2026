/* 最小静态文件服务器 — 仅用于本地预览 */
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const mime = {
  '.html':'text/html;charset=utf-8', '.css':'text/css', '.js':'text/javascript',
  '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};
const PORT = process.env.PORT || 8765;
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('404 Not Found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(PORT, () => console.log(`▶ 2026 世界杯预言已启动 →  http://localhost:${PORT}`));
