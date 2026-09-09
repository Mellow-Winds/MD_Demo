/**
 * pages/following_feed.js — 关注用户的公开学习动态
 */

import { apiGet } from '../core/api.js';
import { navigateTo, animStagger } from '../core/router.js';
import { escHtml, formatTime } from '../components/ui.js';

const TYPE_META = {
  material: { icon: 'folder', label: '上传了学习资料' },
  invite: { icon: 'event_available', label: '发布了自习邀约' },
  square_post: { icon: 'groups', label: '发布了组队需求' },
};

export async function renderFollowingFeed(container) {
  container.innerHTML = `
    <div id="following-feed-list">
      <div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>
    </div>
  `;

  // 防止重复绑定事件监听器
  if (!container._feedBound) {
    container.addEventListener('click', handleFeedClick);
    container._feedBound = true;
  }
  await loadFollowingFeed();
}

async function loadFollowingFeed() {
  const listEl = document.getElementById('following-feed-list');
  if (!listEl) return;

  try {
    const data = await apiGet('/api/user/feed');
    const activities = data?.activities || [];
    if (!activities.length) {
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">dynamic_feed</span>
          <p class="text-secondary" style="margin-top:12px">暂时没有关注动态</p>
          <p class="text-secondary" style="font-size:13px">从课程成员列表进入同学主页并关注，公开学习动态会出现在这里</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = activities.map(renderActivity).join('');
    animStagger(Array.from(listEl.querySelectorAll('.following-feed-item')), { y: 12, dur: 320, gap: 35 });
  } catch {
    listEl.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载失败</p></div>';
  }
}

function renderActivity(activity) {
  const meta = TYPE_META[activity.activity_type] || { icon: 'notifications', label: '发布了新动态' };
  return `
    <div class="card following-feed-item"
         data-type="${escHtml(activity.activity_type)}"
         data-related-id="${activity.related_id || 0}"
         data-course-id="${activity.course_id || 0}">
      <div class="following-feed-icon"><span class="mi">${meta.icon}</span></div>
      <div style="flex:1;min-width:0">
        <div class="following-feed-meta">
          <button class="following-feed-author" data-author-id="${activity.author_id}">${escHtml(activity.author_name || '未设置昵称')}</button>
          <span>${meta.label}</span>
          <span>· ${formatTime(activity.created_at)}</span>
        </div>
        <div class="following-feed-title">${escHtml(activity.title)}</div>
        <div class="following-feed-context">${escHtml(activity.context_title || '')}</div>
        ${activity.summary ? `<p class="following-feed-summary">${escHtml(activity.summary)}</p>` : ''}
      </div>
      <span class="mi profile-list-arrow">chevron_right</span>
    </div>
  `;
}

function handleFeedClick(event) {
  const author = event.target.closest('.following-feed-author');
  if (author) {
    navigateTo('profile-user', author.dataset.authorId);
    return;
  }

  const item = event.target.closest('.following-feed-item');
  if (!item) return;

  const relatedId = Number(item.dataset.relatedId);
  const courseId = Number(item.dataset.courseId);
  if (item.dataset.type === 'square_post') {
    navigateTo('square-post', relatedId);
  } else if (item.dataset.type === 'invite') {
    navigateTo('explore');
  } else if (item.dataset.type === 'material' && courseId) {
    navigateTo('course-detail', courseId);
  }
}
