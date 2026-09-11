/**
 * 展示型入口：只负责挂载设计语言展厅，不再初始化业务 API、认证和数据库页面。
 */

import { initShowcase } from './pages/showcase.js?v=showcase-7';

function boot() {
  const root = document.getElementById('showcase-root');
  if (root) initShowcase(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
