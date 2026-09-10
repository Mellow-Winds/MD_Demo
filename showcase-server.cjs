// Read-only showcase. The archived application/database is never initialized.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const MIME = {'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.md':'text/markdown; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const publicRoot = path.resolve(__dirname, 'public');
const designDoc = path.resolve(__dirname, 'develop', 'design.md');
function sendFile(res, file, method) {
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});res.end('未找到此资源');return;}
    res.writeHead(200, {'content-type':MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    if (method === 'HEAD') {res.end();return;}
    fs.createReadStream(file).pipe(res);
  });
}
function createApp() {
  return http.createServer((req,res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});res.end('未找到此资源');return;}
    if (pathname === '/showcase/design.md') {sendFile(res, designDoc, req.method);return;}
    let relative;
    try {relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);} catch {res.writeHead(400);res.end();return;}
    const file = path.resolve(publicRoot, '.' + relative);
    if (file !== publicRoot && !file.startsWith(publicRoot + path.sep)) {res.writeHead(404);res.end('未找到此资源');return;}
    sendFile(res, file, req.method);
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '127.0.0.1', () => console.log('Design Demo: http://localhost:' + port));
}
module.exports = {createApp};
