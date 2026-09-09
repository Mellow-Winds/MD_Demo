/**
 * pages/my_posts.js — 我的创作
 * 展示用户在课程空间和探索板块发布的内容
 */

import { apiGet } from '../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../core/router.js';
import { showToast, escHtml, formatTime, renderLoginPrompt, bindLoginPrompt } from '../components/ui.js';
import { renderAuth } from './auth.js';

/* =============================================
   Tab 配置
   ============================================= */

const MY_POST_TABS = [
  { key: 'course',  label: '课程空间', icon: 'menu_book' },
  { key: 'explore', label: '发现', icon: 'explore' },
];

/* =============================================
   主页面 — 我的创作
   ============================================= */

registerPage('my_post', async (container) => {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin:0"><span class="mi" style="vertical-align:-4px;margin-right:4px">edit_note</span>我的发布</h1>
    </div>
    <div class="md-pills" id="my-post-pills">
      ${MY_POST_TABS.map(t => `
        <button class="md-pill-btn${t.key === 'course' ? ' active' : ''}" data-tab="${t.key}">
          <span class="mi" style="font-size:16px;vertical-align:-3px">${t.icon}</span> ${t.label}
        </button>
      `).join('')}
    </div>
    <div id="my-post-content" class="my-post-content"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  container.querySelectorAll('#my-post-pills .md-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMyPostTab(btn.dataset.tab, container));
  });

  await loadMyPostTab('course');
});

/* =============================================
   子路由 — 课程空间 / 探索
   ============================================= */

registerPage('my_post-course', async (container) => {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }
  await renderMyPostPage(container, 'course');
});

registerPage('my_post-explore', async (container) => {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }
  await renderMyPostPage(container, 'explore');
});

async function renderMyPostPage(container, initialTab) {
  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn-icon" onclick="navigateTo('my_post')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title" style="margin:0">我的发布</h1>
      </div>
    </div>
    <div class="md-pills" id="my-post-pills">
      ${MY_POST_TABS.map(t => `
        <button class="md-pill-btn${t.key === initialTab ? ' active' : ''}" data-tab="${t.key}">
          <span class="mi" style="font-size:16px;vertical-align:-3px">${t.icon}</span> ${t.label}
        </button>
      `).join('')}
    </div>
    <div id="my-post-content" class="my-post-content"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  container.querySelectorAll('#my-post-pills .md-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMyPostTab(btn.dataset.tab, container));
  });

  await loadMyPostTab(initialTab);
}

/* =============================================
   Tab 切换
   ============================================= */

async function switchMyPostTab(tabName, container) {
  const tabs = container.querySelectorAll('#my-post-pills .md-pill-btn');
  tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  await loadMyPostTab(tabName, true);
}

/* =============================================
   加载 Tab 内容
   ============================================= */

async function loadMyPostTab(tabName, animate) {
  const contentEl = document.getElementById('my-post-content');
  if (!contentEl) return;

  // 平滑切换：先淡出再加载再淡入
  if (animate) {
    contentEl.style.transition = 'opacity 0.12s var(--ease-standard)';
    contentEl.style.opacity = '0';
    await new Promise(r => setTimeout(r, 120));
  }

  contentEl.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>';

  try {
    if (tabName === 'course') {
      await renderCoursePosts(contentEl);
    } else if (tabName === 'explore') {
      await renderExplorePosts(contentEl);
    }

    // 加载完成后淡入
    if (animate) {
      contentEl.style.opacity = '1';
    }
  } catch (e) {
    contentEl.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
    if (animate) contentEl.style.opacity = '1';
  }
}

/* =============================================
   课程空间 — 帖子 + 资料
   ============================================= */

async function renderCoursePosts(container) {
  const [posts, materials] = await Promise.all([
    apiGet('/api/my-posts/course-posts'),
    apiGet('/api/my-posts/course-materials'),
  ]);

  const postsArr = Array.isArray(posts) ? posts : [];
  const materialsArr = Array.isArray(materials) ? materials : [];

  if (postsArr.length === 0 && materialsArr.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">article</span>
        <p class="text-secondary" style="margin-top:12px">你还没有在课程空间发布过内容</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (postsArr.length > 0) {
    html += `
      <div class="my-post-section">
        <h3 class="my-post-section-title"><span class="mi" style="font-size:18px;vertical-align:-3px">forum</span> 我的帖子 (${postsArr.length})</h3>
        ${postsArr.map(p => `
          <div class="card my-post-card" onclick="navigateTo('course-detail', ${p.course_id})">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="flex:1;min-width:0">
                <h4 style="font-size:var(--text-base);font-weight:600">${escHtml(p.title)}</h4>
                <div style="display:flex;gap:16px;margin-top:6px;flex-wrap:wrap;font-size:12px;color:var(--md-on-surface-variant)">
                  <span><span class="mi" style="font-size:14px;vertical-align:-2px">menu_book</span> ${escHtml(p.course_name)}</span>
                  <span><span class="mi" style="font-size:14px;vertical-align:-2px">schedule</span> ${formatTime(p.created_at)}</span>
                  <span><span class="mi" style="font-size:14px;vertical-align:-2px">chat</span> ${p.comment_count || 0} 评论</span>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (materialsArr.length > 0) {
    html += `
      <div class="my-post-section" ${postsArr.length > 0 ? 'style="margin-top:24px"' : ''}>
        <h3 class="my-post-section-title"><span class="mi" style="font-size:18px;vertical-align:-3px">folder</span> 我的资料 (${materialsArr.length})</h3>
        ${materialsArr.map(m => `
          <div class="card my-post-card" onclick="navigateTo('course-detail', ${m.course_id})">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="flex:1;min-width:0">
                <h4 style="font-size:var(--text-base);font-weight:600">${escHtml(m.title)}</h4>
                <div style="display:flex;gap:16px;margin-top:6px;flex-wrap:wrap;font-size:12px;color:var(--md-on-surface-variant)">
                  <span><span class="mi" style="font-size:14px;vertical-align:-2px">menu_book</span> ${escHtml(m.course_name)}</span>
                  <span><span class="mi" style="font-size:14px;vertical-align:-2px">schedule</span> ${formatTime(m.created_at)}</span>
                  ${m.file_type ? `<span><span class="mi" style="font-size:14px;vertical-align:-2px">description</span> ${escHtml(m.file_type.toUpperCase())}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
  const cards = container.querySelectorAll('.my-post-card');
  if (cards.length) animStagger(Array.from(cards), { y: 12, dur: 300, gap: 30 });
}

/* =============================================
   探索 — 广场帖子 + 邀约
   ============================================= */

async function renderExplorePosts(container) {
  const [squareData, invites] = await Promise.all([
    apiGet('/api/square/my?type=created'),
    apiGet('/api/invites/my?type=created'),
  ]);

  const squareArr = Array.isArray(squareData) ? squareData : [];
  const invitesArr = Array.isArray(invites) ? invites : [];

  if (squareArr.length === 0 && invitesArr.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">explore</span>
        <p class="text-secondary" style="margin-top:12px">你还没有在发现板块发布过内容</p>
      </div>
    `;
    return;
  }

  const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
  const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };

  let html = '';

  if (squareArr.length > 0) {
    html += `
      <div class="my-post-section">
        <h3 class="my-post-section-title"><span class="mi" style="font-size:18px;vertical-align:-3px">explore</span> 交友帖子 (${squareArr.length})</h3>
        ${squareArr.map(p => `
          <div class="card my-post-card" onclick="navigateTo('square-post', ${p.id})">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <span style="font-weight:600">${escHtml(p.title)}</span>
                <span class="square-category-tag" style="margin-left:8px">${escHtml(p.category)}</span>
                <span class="status-badge ${statusClass[p.status] || ''}" style="margin-left:4px">${statusMap[p.status] || p.status}</span>
              </div>
              <span style="font-size:12px;color:var(--md-on-surface-variant)"><span class="mi" style="font-size:14px;vertical-align:-2px">pending</span> ${p.pending_count || 0} 待处理</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (invitesArr.length > 0) {
    html += `
      <div class="my-post-section" ${squareArr.length > 0 ? 'style="margin-top:24px"' : ''}>
        <h3 class="my-post-section-title"><span class="mi" style="font-size:18px;vertical-align:-3px">event_available</span> 自习邀约 (${invitesArr.length})</h3>
        ${invitesArr.map(inv => `
          <div class="card invite-card my-post-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="flex:1;min-width:0">
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <h4 style="font-size:var(--text-base);font-weight:600">${escHtml(inv.title)}</h4>
                  <span class="status-badge ${statusClass[inv.status] || ''}">${statusMap[inv.status] || inv.status}</span>
                </div>
                <div style="display:flex;gap:16px;margin-top:6px;flex-wrap:wrap;font-size:12px;color:var(--md-on-surface-variant)">
                  <span><span class="mi" style="font-size:14px;vertical-align:-2px">event</span> ${escHtml(inv.study_date)}</span>
                  <span><span class="mi" style="font-size:14px;vertical-align:-2px">people</span> ${inv.participant_count}/${inv.max_participants}人</span>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
  const cards = container.querySelectorAll('.my-post-card');
  if (cards.length) animStagger(Array.from(cards), { y: 12, dur: 300, gap: 30 });
}
