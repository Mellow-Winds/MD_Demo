/**
 * core/router.js — 页面注册/路由系统 + 动效引擎 + Markdown渲染
 * 自包含，零外部依赖
 */

/* =============================================
   Animation Engine
   ============================================= */

export const Ease = {
  standard:   'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
  gentle:     'cubic-bezier(0.25, 0.1, 0.25, 1)',
  bounce:     'cubic-bezier(0.18, 1.25, 0.4, 1)',
};

export function animIn(el, opts = {}) {
  const { y = 24, s = 1, dur = 450, delay = 0, ease = Ease.bounce } = opts;
  el.style.opacity = '0';
  return el.animate(
    [
      { opacity: 0, transform: `translateY(${y}px) scale(${s === 1 ? 1 : 0.96})` },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: dur, delay, easing: ease, fill: 'forwards' }
  );
}

export function animStagger(els, opts = {}) {
  const { y = 20, dur = 420, gap = 55, ease = Ease.bounce } = opts;
  els.forEach((el, i) => {
    el.style.opacity = '0';
    el.animate(
      [
        { opacity: 0, transform: `translateY(${y}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: dur, delay: i * gap, easing: ease, fill: 'forwards' }
    );
  });
}

export function animOut(el, opts = {}) {
  const { dur = 160, ease = Ease.accelerate } = opts;
  return el.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-10px) scale(0.99)' },
    ],
    { duration: dur, easing: ease, fill: 'forwards' }
  );
}

/* =============================================
   Markdown 渲染
   ============================================= */

export function renderMarkdown(text) {
  if (typeof markdownit === 'function') {
    return markdownit({ html: false }).render(text);
  }
  console.warn('markdown-it not loaded, using fallback renderer');
  return '<p>' + text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

/* =============================================
   URL 路由映射
   ============================================= */

const ROUTES = [
  { page: 'home',           pattern: '/home',                  nav: 'home' },
  { page: 'mycourse',       pattern: '/mycourse',              nav: 'mycourse' },
  { page: 'course-detail',  pattern: '/course/:id',            nav: null },
  { page: 'allcourse',      pattern: '/allcourse',             nav: 'allcourse' },
  { page: 'publish',        pattern: '/course/:id/posts',      nav: null },
  { page: 'profile',        pattern: '/profile',               nav: 'profile' },
  { page: 'profile-edit', pattern: '/profile/edit',        nav: 'profile' },
  { page: 'profile-privacy', pattern: '/profile/privacy',  nav: 'profile' },
  { page: 'profile-data', pattern: '/profile/data',        nav: 'profile' },
  { page: 'profile-user', pattern: '/profile/:id',         nav: 'profile' },
  { page: 'explore',      pattern: '/explore',             nav: 'explore' },
  { page: 'explore-posts',pattern: '/explore/posts',       nav: 'explore' },
  { page: 'explore-post-detail', pattern: '/explore/post/:id', nav: 'explore' },
  { page: 'explore-tutorial',   pattern: '/explore/tutorial', nav: 'explore' },
  { page: 'explore-post-editor', pattern: '/explore/new',  nav: 'explore' },
  { page: 'card-editor',   pattern: '/explore/new_card',        nav: 'explore' },
  { page: 'card-editor',   pattern: '/explore/card/:id/edit',   nav: 'explore' },
  { page: 'my-cards',      pattern: '/explore/cards/my',        nav: 'explore' },
  { page: 'explore-my-posts', pattern: '/explore/mine',    nav: 'explore' },
  { page: 'square-post',  pattern: '/explore/square/post/:id', nav: 'explore' },
  { page: 'square-my',    pattern: '/explore/square/my',  nav: 'explore' },
  { page: 'invites-my',   pattern: '/explore/invites/my', nav: 'explore' },
  { page: 'my_post',      pattern: '/my_post',             nav: 'my_post' },
  { page: 'my_post-course',pattern: '/my_post/course',     nav: 'my_post' },
  { page: 'my_post-explore',pattern: '/my_post/explore',   nav: 'my_post' },
  { page: 'notifications',pattern: '/notifications',       nav: 'notifications' },
  { page: 'favorites',    pattern: '/favorites',           nav: 'favorites' },
  { page: 'search',       pattern: '/search',              nav: 'search' },
  { page: 'treasurebox',  pattern: '/treasurebox',          nav: 'treasurebox' },
];

/**
 * buildPath — 根据页面名和数据构建URL路径
 * @param {string} pageName
 * @param {*} data
 * @returns {string}
 */
function buildPath(pageName, data) {
  const route = ROUTES.find(r => r.page === pageName);
  if (!route) return '/mycourse';

  let path = route.pattern;

  // 替换 :id 参数
  if (path.includes(':id')) {
    const id = (typeof data === 'number' || typeof data === 'string') ? data : (data?.id || data?.courseId);
    if (id) path = path.replace(':id', id);
    else return '/mycourse'; // 无ID则回退
  }

  // search 页面附加 query 参数
  if (pageName === 'search' && data?.q) {
    path += '?q=' + encodeURIComponent(data.q);
  }

  return path;
}

/**
 * resolvePath — 根据URL路径解析出页面名和数据
 * @param {string} pathname
 * @returns {{ page: string, data: * }}
 */
function resolvePath(pathname) {
  // 先精确匹配
  const exact = ROUTES.find(r => !r.pattern.includes(':') && r.pattern === pathname);
  if (exact) {
    // search 页面从 query string 取数据
    if (exact.page === 'search') {
      const params = new URLSearchParams(window.location.search);
      return { page: 'search', data: { q: params.get('q') || '' } };
    }
    return { page: exact.page, data: null };
  }

  // 参数化匹配
  for (const route of ROUTES) {
    if (!route.pattern.includes(':')) continue;
    const patternParts = route.pattern.split('/');
    const pathParts = pathname.split('/');
    if (patternParts.length !== pathParts.length) continue;

    let match = true;
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      const id = params.id ? (isNaN(params.id) ? params.id : Number(params.id)) : null;
      return { page: route.page, data: id };
    }
  }

  // 未匹配，返回默认
  return { page: 'mycourse', data: null };
}

/* =============================================
   Page System
   ============================================= */

export const pages = {};

export function registerPage(name, renderFn) { pages[name] = renderFn; }

/**
 * navigateTo — 导航到指定页面，同时更新URL
 * @param {string} pageName
 * @param {*} data
 * @param {object} opts — { pushState: true } 是否更新浏览器历史
 */
export function navigateTo(pageName, data, opts = {}) {
  const { pushState = true } = opts;
  const main = document.getElementById('main-content');
  if (!main || !pages[pageName]) return;

  // 更新侧边栏高亮：子页面映射到父级 nav
  const route = ROUTES.find(r => r.page === pageName);
  const navTarget = route?.nav || pageName;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === navTarget);
  });

  // 更新 URL（不触发 popstate）
  if (pushState) {
    const path = buildPath(pageName, data);
    if (window.location.pathname !== path || window.location.search !== (pageName === 'search' && data?.q ? '?q=' + encodeURIComponent(data.q) : '')) {
      const fullPath = pageName === 'search' && data?.q
        ? path
        : path;
      history.pushState({ page: pageName, data }, '', fullPath);
    }
  }

  const oldEls = Array.from(main.children);

  if (oldEls.length === 0) {
    main.innerHTML = '';
    pages[pageName](main, data);
    return;
  }

  const exits = oldEls.map(el => animOut(el, { dur: 180 }));
  Promise.all(exits.map(a => a.finished)).then(() => {
    main.innerHTML = '';
    pages[pageName](main, data);
  });
}

/**
 * initRouter — 初始化路由系统：监听 popstate + 解析初始URL
 * @param {Function} fallback — 当URL为根路径时的默认导航函数
 */
export function initRouter(fallback) {
  // 浏览器前进/后退
  window.addEventListener('popstate', (e) => {
    const state = e.state;
    if (state?.page) {
      navigateTo(state.page, state.data, { pushState: false });
    } else {
      const { page, data } = resolvePath(window.location.pathname);
      navigateTo(page, data, { pushState: false });
    }
  });

  // 解析当前URL
  const { page, data } = resolvePath(window.location.pathname);
  if (window.location.pathname === '/' || window.location.pathname === '') {
    fallback();
  } else {
    navigateTo(page, data, { pushState: false });
  }
}

/* =============================================
   Ripple Effect
   ============================================= */

export function spawnRipple(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.5;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  Object.assign(ripple.style, {
    width: size + 'px', height: size + 'px',
    left: (e.clientX - rect.left - size / 2) + 'px',
    top: (e.clientY - rect.top - size / 2) + 'px',
  });
  el.appendChild(ripple);
  ripple.animate(
    [
      { transform: 'scale(0)', opacity: 0.2 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
  ).onfinish = () => ripple.remove();
}

export function bindRipples(container) {
  container.querySelectorAll('.btn, .clickable').forEach(el => {
    el.removeEventListener('click', spawnRipple);
    el.addEventListener('click', spawnRipple);
  });
}
