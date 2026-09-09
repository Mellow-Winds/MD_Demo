// Read-only showcase. The archived application/database is never initialized.
const express = require('express');
const path = require('node:path');
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.get('/showcase/design.md', (_req, res) => res.sendFile(path.join(__dirname, 'develop/design.md')));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((_req, res) => res.status(404).type('text').send('未找到此资源'));
  return app;
}
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '127.0.0.1', () => console.log('Design Demo: http://localhost:' + port));
}
module.exports = {createApp};
