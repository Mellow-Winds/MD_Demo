/**
 * pages/home.js - Apple-style minimal home page
 * Hero (100vh) -> Stats cards -> Navigation Cards
 * Staggered text reveal + scroll-triggered section animations
 */

import { apiGet, isLoggedIn } from '../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples, Ease } from '../core/router.js';
import { escHtml } from '../components/ui.js';

const PLUGIN_ICON = {
  calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 7 10 17l-5-5"/><circle cx="12" cy="12" r="9"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/><path d="m12 11 1.1 2.2 2.4.3-1.7 1.7.4 2.3-2.2-1.1-2.2 1.1.4-2.3-1.7-1.7 2.4-.3L12 11Z"/></svg>',
};

const NAV_ICONS = {
  mycourse: '<svg viewBox="0 0 24 24"><path d="M5 13.18v2.81c0 .73.4 1.41 1.04 1.76l5 2.73c.6.33 1.32.33 1.92 0l5-2.73c.64-.35 1.04-1.03 1.04-1.76v-2.81l-6.04 3.3c-.6.33-1.32.33-1.92 0L5 13.18zm6.04-9.66l-8.43 4.6c-.69.38-.69 1.38 0 1.76l8.43 4.6c.6.33 1.32.33 1.92 0L21 10.09V16c0 .55.45 1 1 1s1-.45 1-1V9.59c0-.37-.2-.7-.52-.88l-9.52-5.19a2.04 2.04 0 0 0-1.92 0z"/></svg>',
  allcourse: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93c0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41c0 2.08-.8 3.97-2.1 5.39z"/></svg>',
  explore: '<svg viewBox="0 0 24 24"><path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/></svg>',
  treasurebox: '<svg viewBox="0 0 24 24"><path d="M21.18 4.35L18.28 2.5c-.55-.35-1.22-.35-1.77 0L13.7 3.93L9.83 1.7c-.55-.35-1.22-.35-1.77 0L2.82 4.35C2.32 4.62 2 5.15 2 5.71V18.3c0 .56.32 1.09.82 1.36l5.24 2.65c.55.28 1.22.28 1.77 0l3.87-2.23l3.87 2.23c.55.28 1.22.28 1.77 0l5.24-2.65c.5-.27.82-.8.82-1.36V5.71c0-.56-.32-1.09-.82-1.36zM12 16c-1.66 0-3-1.34-3-3s1.34-3 3-3s3 1.34 3 3s-1.34 3-3 3z"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4s-4 1.79-4 4s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/></svg>',
  notifications: '<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-1.29 1.29c-.63.63-.19 1.71.7 1.71h13.17c.89 0 1.34-1.08.71-1.71L18 16z"/></svg>',
  my_post: '<svg viewBox="0 0 24 24"><path d="M14 11c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1s.45-1 1-1h9c.55 0 1 .45 1 1zM3 7c0 .55.45 1 1 1h9c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1zm7 8c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1h5c.55 0 1-.45 1-1zm8.01-2.13l.71-.71a.996.996 0 0 1 1.41 0l.71.71c.39.39.39 1.02 0 1.41l-.71.71l-2.12-2.12zm-.71.71l-5.16 5.16c-.09.09-.14.21-.14.35v1.41c0 .28.22.5.5.5h1.41c.13 0 .26-.05.35-.15l5.16-5.16l-2.12-2.11z"/></svg>',
  favorites: '<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3l7 3V5c0-1.1-.9-2-2-2z"/></svg>',
};

const NAV_CARDS = [
  { page: 'mycourse',     name: '我的课程', desc: '管理你的课程与课搭子' },
  { page: 'allcourse',    name: '课程广场', desc: '浏览全校热门课程' },
  { page: 'explore',      name: '发现',     desc: '发现校园新鲜事与邀约' },
  { page: 'treasurebox',  name: '百宝箱',   desc: '番茄钟 · 运势 · 盲盒' },
  { page: 'profile',      name: '个人中心', desc: '签到 · 资料导出 · 关注' },
  { page: 'notifications',name: '通知中心', desc: '查看最新消息与提醒' },
  { page: 'my_post',      name: '我的发布', desc: '管理你已发布的帖子' },
  { page: 'favorites',    name: '我的收藏', desc: '收藏的课程与帖子' },
];

function todayWeekdayText() {
  return ['周日','周一','周二','周三','周四','周五','周六'][new Date().getDay()];
}

function countTodayCourses(courses) {
  const weekday = todayWeekdayText();
  return courses.filter(c => {
    const t = `${c.title||''} ${c.description||''} ${c.teacher||''}`;
    return t.includes(weekday);
  }).length;
}

/* ---- Animation ---- */

function animateHero(container) {
  const els = Array.from(container.querySelectorAll('.home-hero-text > *'));
  animStagger(els, { y: 36, dur: 1000, gap: 200, ease: Ease.gentle });
  const img = container.querySelector('.home-hero-image');
  if (img) animIn(img, { y: 0, dur: 1200, delay: 600, ease: Ease.gentle });
}

function observeSections(container) {
  const secs = container.querySelectorAll('.home-section');
  if (!secs.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        const cards = e.target.querySelectorAll('.home-stat-card, .home-nav-card');
        if (cards.length) animStagger(Array.from(cards), { y: 28, dur: 800, gap: 100, ease: Ease.gentle });
        const heads = e.target.querySelectorAll('.home-section-title');
        if (heads.length) animStagger(Array.from(heads), { y: 22, dur: 750, gap: 140, ease: Ease.gentle });
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  secs.forEach(s => obs.observe(s));
}

/* ---- Render ---- */

function renderHero() {
  return `
    <section class="home-hero">
      <div class="home-hero-text">
        <div class="home-hero-brand">
          <img class="brand-logo" src="/images/blue-whale-logo.png" alt="" aria-hidden="true">
          <span>课搭子</span>
        </div>
        <h1>在这里，选一门课，<br>遇见一些人。</h1>
        <div class="home-hero-actions">
        </div>
      </div>
      <div class="home-hero-image">
        <img src="/images/home-hero-campus.png" alt="">
      </div>
    </section>
  `;
}

function renderStatCard(icon, value, label, page) {
  const a = page ? ` data-jump="${page}"` : '';
  return `<button class="home-stat-card"${a}><span class="home-stat-icon">${icon}</span><span class="home-stat-value">${escHtml(String(value))}</span><span class="home-stat-label">${escHtml(label)}</span></button>`;
}

function renderStats(courses, unread) {
  const tc = countTodayCourses(courses);
  const st = window._currentUser?.checkin_streak || 0;
  return `
    <section class="home-section">
      <h2 class="home-section-title">今日概览</h2>
      <div class="home-stats" id="home-stat-grid">
        ${renderStatCard(PLUGIN_ICON.calendar, tc||courses.length, '今日课程', 'mycourse')}
        ${renderStatCard(PLUGIN_ICON.check, st+'天', '连续签到', 'profile')}
        ${renderStatCard(PLUGIN_ICON.bell, unread, '新消息', 'notifications')}
        ${renderStatCard(PLUGIN_ICON.folder, '查看', '收藏资料', 'favorites')}
      </div>
    </section>
  `;
}

function renderNavCards() {
  const cards = NAV_CARDS.map(c => `
    <button class="home-nav-card" data-jump="${c.page}">
      <span class="home-nav-icon">${NAV_ICONS[c.page]}</span>
      <span class="home-nav-name">${escHtml(c.name)}</span>
      <span class="home-nav-desc">${escHtml(c.desc)}</span>
    </button>
  `).join('');
  return `<section class="home-section"><h2 class="home-section-title">探索更多</h2><div class="home-nav-grid">${cards}</div></section>`;
}

function renderHomeShell(container) {
  container.innerHTML = `<div class="home-page">${renderHero()}<div id="home-below-fold">${renderStats([],0)}${renderNavCards()}</div></div>`;
}

/* ---- Data ---- */

async function loadHomeData() {
  let courses = [], unread = 0;
  if (isLoggedIn()) {
    try { courses = await apiGet('/api/courses'); } catch {}
    try { const d = await apiGet('/api/notifications/unread-count'); unread = Number(d.count||0); } catch {}
  }
  return { courses: Array.isArray(courses)?courses:[], unread };
}

function updateStats({ courses, unread }) {
  const el = document.getElementById('home-stat-grid');
  if (!el) return;
  const tc = countTodayCourses(courses);
  const st = window._currentUser?.checkin_streak || 0;
  el.innerHTML = [
    renderStatCard(PLUGIN_ICON.calendar, tc||courses.length, '今日课程', 'mycourse'),
    renderStatCard(PLUGIN_ICON.check, st+'天', '连续签到', 'profile'),
    renderStatCard(PLUGIN_ICON.bell, unread, '新消息', 'notifications'),
    renderStatCard(PLUGIN_ICON.folder, '查看', '收藏资料', 'favorites'),
  ].join('');
}

/* ---- Events ---- */

function bindHomeEvents(container) {
  container.addEventListener('click', e => {
    const j = e.target.closest('[data-jump]');
    if (j) navigateTo(j.dataset.jump);
  });
}

/* ---- Register ---- */

registerPage('home', async (container) => {
  renderHomeShell(container);
  bindRipples(container);
  bindHomeEvents(container);
  animateHero(container);
  observeSections(container);
  const data = await loadHomeData();
  updateStats(data);
});
