/**
 * pages/notifications.js — 通知中心
 * 独立全页面展示通知列表
 */

import { apiGet, apiPut, apiPost } from '../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../core/router.js';
import { showToast, openModal, closeModal, escHtml, formatTime, renderLoginPrompt, bindLoginPrompt, createMdTextarea } from '../components/ui.js';
import { renderAuth } from './auth.js';
import { resolveNotificationTarget } from './notification_routes.mjs';
import { renderFollowingFeed } from './following_feed.js';

let activeTab = 'messages';
let _batchMode = false;

/* =============================================
   页面注册
   ============================================= */

registerPage('notifications', async (container) => {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin:0"><span class="mi" style="vertical-align:-4px;margin-right:4px">notifications</span>通知</h1>
    </div>
    <div class="notif-action-bar">
      <button class="btn btn-text" id="notif-mark-all-btn" style="display:none">
        <span class="mi">done_all</span> 全部标为已读
      </button>
      <button class="btn btn-text" id="notif-batch-toggle-btn">
        <span class="mi">checklist</span> 批量管理
      </button>
      <button class="btn btn-text" id="notif-batch-delete-btn" style="display:none">
        <span class="mi">delete_sweep</span> 批量删除
      </button>
      <button class="btn btn-text" id="notif-select-all-btn" style="display:none">
        <span class="mi">select_all</span> 全选
      </button>
    </div>
    <div class="md-pills" id="notification-pills">
      <button class="md-pill-btn${activeTab === 'messages' ? ' active' : ''}" data-tab="messages" data-notification-tab="messages">
        <span class="mi" style="font-size:16px;vertical-align:-3px">notifications</span> 消息通知
      </button>
      <button class="md-pill-btn${activeTab === 'following' ? ' active' : ''}" data-tab="following" data-notification-tab="following">
        <span class="mi" style="font-size:16px;vertical-align:-3px">rss_feed</span> 关注动态
      </button>
    </div>
    <div id="notification-tab-content"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  document.getElementById('notif-mark-all-btn')?.addEventListener('click', handleMarkAllRead);
  document.getElementById('notif-batch-toggle-btn')?.addEventListener('click', toggleBatchMode);
  document.getElementById('notif-batch-delete-btn')?.addEventListener('click', deleteSelectedNotifications);
  document.getElementById('notif-select-all-btn')?.addEventListener('click', toggleSelectAll);

  container.querySelectorAll('#notification-pills .md-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => switchNotificationTab(btn.dataset.tab));
  });

  await renderActiveTab();
});

/* =============================================
   页签切换
   ============================================= */

async function switchNotificationTab(tab) {
  if (tab === activeTab) return;
  activeTab = tab;
  _batchMode = false;
  document.querySelectorAll('#notification-pills .md-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  await renderActiveTab(true);
}

async function renderActiveTab(animate) {
  const content = document.getElementById('notification-tab-content');
  if (!content) return;

  const markAllBtn = document.getElementById('notif-mark-all-btn');
  const batchToggleBtn = document.getElementById('notif-batch-toggle-btn');
  const batchDeleteBtn = document.getElementById('notif-batch-delete-btn');
  const selectAllBtn = document.getElementById('notif-select-all-btn');

  if (markAllBtn) markAllBtn.style.display = 'none';
  if (batchToggleBtn) batchToggleBtn.style.display = 'none';
  if (batchDeleteBtn) batchDeleteBtn.style.display = 'none';
  if (selectAllBtn) selectAllBtn.style.display = 'none';

  if (animate) {
    content.style.transition = 'opacity 0.12s var(--ease-standard)';
    content.style.opacity = '0';
    await new Promise(r => setTimeout(r, 120));
  }

  if (activeTab === 'following') {
    await renderFollowingFeed(content);
  } else {
    content.innerHTML = '<div id="notif-list-container"></div>';
    const listContainer = document.getElementById('notif-list-container');
    listContainer?.addEventListener('click', (e) => {
      if (e.target.closest('.notif-batch-checkbox')) return;

      if (_batchMode) {
        const card = e.target.closest('.notif-page-item');
        if (card) {
          const cb = card.querySelector('.notif-batch-checkbox');
          if (cb) cb.checked = !cb.checked;
          return;
        }
      }

      const item = e.target.closest('.notif-page-item');
      if (!item) return;
      const { notifId, relatedType, relatedId, relatedCommentId, courseId, isRead } = item.dataset;
      handleNotifItemClick(Number(notifId), relatedType, Number(relatedId), Number(courseId), isRead === 'true', Number(relatedCommentId));
    });
    await loadNotifications();
  }

  if (animate) {
    content.style.opacity = '1';
  }
}

/* =============================================
   加载通知列表
   ============================================= */

async function loadNotifications() {
  const container = document.getElementById('notif-list-container');
  if (!container) return;

  container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>';
  container.scrollTop = 0;
  window.scrollTo(0, 0);

  try {
    const data = await apiGet('/api/notifications');
    const notifs = data?.notifications || [];

    if (notifs.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">notifications_none</span>
          <p class="text-secondary" style="margin-top:12px">暂无通知</p>
        </div>
      `;
      const batchToggleBtn = document.getElementById('notif-batch-toggle-btn');
      if (batchToggleBtn) batchToggleBtn.style.display = 'none';
      return;
    }

    const markAllBtn = document.getElementById('notif-mark-all-btn');
    const batchToggleBtn = document.getElementById('notif-batch-toggle-btn');
    if (markAllBtn) {
      markAllBtn.style.display = data.unread > 0 ? 'inline-flex' : 'none';
    }
    if (batchToggleBtn) batchToggleBtn.style.display = 'inline-flex';

    updateBatchUI();

    container.innerHTML = notifs.map(n => `
      <div class="card notif-page-item${n.is_read ? '' : ' notif-page-unread'}"
           data-notif-id="${n.id}"
           data-related-type="${n.related_type || ''}"
           data-related-id="${n.related_id || 0}"
           data-related-comment-id="${n.related_comment_id || 0}"
           data-course-id="${n.course_id || 0}"
           data-is-read="${!!n.is_read}">
        <input type="checkbox" class="notif-batch-checkbox" style="display:${_batchMode ? 'block' : 'none'}" data-notif-id="${n.id}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div class="notif-page-icon">${getNotifIcon(n.type)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--text-sm);font-weight:${n.is_read ? '400' : '600'};color:var(--md-on-surface)">${escHtml(n.title)}</div>
            <div style="font-size:13px;color:var(--md-on-surface-variant);margin-top:4px;line-height:1.5">${escHtml(n.message)}</div>
            <div style="font-size:12px;color:var(--md-outline);margin-top:6px">${formatTime(n.created_at)}</div>
          </div>
          ${!n.is_read ? '<div class="notif-page-dot"></div>' : ''}
        </div>
      </div>
    `).join('');

    const cards = container.querySelectorAll('.notif-page-item');
    if (cards.length) animStagger(Array.from(cards), { y: 12, dur: 300, gap: 30 });
  } catch {
    container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载失败</p></div>';
  }
}

/* =============================================
   点击通知项
   ============================================= */

async function handleNotifItemClick(notifId, relatedType, relatedId, courseId, isRead, relatedCommentId = 0) {
  if (!isRead) {
    try {
      await apiPut(`/api/notifications/${notifId}/read`, {});
      if (window.refreshNotifBadge) window.refreshNotifBadge();
    } catch { /* 标记已读失败不影响跳转 */ }
  }

  if (relatedType === 'contact_exchange') {
    await showExchangeDetailModal(relatedId);
    return;
  }

  const target = resolveNotificationTarget(relatedType, relatedId, courseId, relatedCommentId);
  if (!target) return;

  try {
    navigateTo(target.page, target.data);
  } catch {
    showToast('内容不存在或已被作者移除');
  }
}

/* =============================================
   全部已读
   ============================================= */

async function handleMarkAllRead() {
  await apiPut('/api/notifications/read-all', {});
  if (window.refreshNotifBadge) window.refreshNotifBadge();
  showToast('全部已读');
  await loadNotifications();
}

/* =============================================
   批量管理模式
   ============================================= */

function toggleBatchMode() {
  _batchMode = !_batchMode;
  updateBatchUI();

  const container = document.getElementById('notif-list-container');
  if (container) {
    container.classList.toggle('notif-batch-mode', _batchMode);
    container.querySelectorAll('.notif-batch-checkbox').forEach(cb => {
      cb.style.display = _batchMode ? 'block' : 'none';
      if (!_batchMode) cb.checked = false;
    });
  }
}

function updateBatchUI() {
  const batchToggleBtn = document.getElementById('notif-batch-toggle-btn');
  const batchDeleteBtn = document.getElementById('notif-batch-delete-btn');
  const selectAllBtn = document.getElementById('notif-select-all-btn');

  if (batchToggleBtn) {
    batchToggleBtn.innerHTML = _batchMode
      ? '<span class="mi">close</span> 退出管理'
      : '<span class="mi">checklist</span> 批量管理';
  }
  if (batchDeleteBtn) batchDeleteBtn.style.display = _batchMode ? 'inline-flex' : 'none';
  if (selectAllBtn) selectAllBtn.style.display = _batchMode ? 'inline-flex' : 'none';
}

function toggleSelectAll() {
  const container = document.getElementById('notif-list-container');
  if (!container) return;
  const checkboxes = container.querySelectorAll('.notif-batch-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => { cb.checked = !allChecked; });
}

async function deleteSelectedNotifications() {
  const checked = document.querySelectorAll('.notif-batch-checkbox:checked');
  if (checked.length === 0) {
    showToast('请先选择要删除的通知');
    return;
  }

  if (!confirm(`确定删除选中的 ${checked.length} 条通知？`)) return;

  const ids = Array.from(checked).map(cb => Number(cb.dataset.notifId));
  try {
    const result = await apiPost('/api/notifications/batch-delete', { ids });
    if (result.error) {
      showToast(result.error);
      return;
    }
    showToast(result.message || `已删除 ${ids.length} 条通知`);
    _batchMode = false;
    await loadNotifications();
  } catch {
    showToast('删除失败，请稍后重试');
  }
}

/* =============================================
   图标映射
   ============================================= */

function getNotifIcon(type) {
  const icons = {
    new_post: 'forum',
    new_comment: 'chat',
    new_material: 'folder',
    invite_join: 'person_add',
    invite_cancel: 'event_busy',
    new_follower: 'person_add',
    contact_exchange_request: 'swap_horiz',
    contact_exchange_accepted: 'check_circle',
    contact_exchange_rejected: 'cancel',
  };
  return `<span class="mi" style="font-size:22px">${icons[type] || 'notifications'}</span>`;
}

/* =============================================
   交换联系方式详情弹窗
   ============================================= */

async function showExchangeDetailModal(requestId) {
  const result = await apiGet(`/api/user/contact-exchange/${requestId}`);
  if (result.error) {
    showToast('获取详情失败');
    return;
  }

  const isRecipient = String(result.toUserId) === String(window._currentUser?.id);
  const isPending = result.status === 'pending';
  const isAccepted = result.status === 'accepted';
  const displayUser = result.otherUser || result.fromUser || {};

  let statusHtml = '';
  if (result.status === 'pending') {
    statusHtml = '<span style="color:var(--md-primary);font-weight:600">等待处理</span>';
  } else if (result.status === 'accepted') {
    statusHtml = '<span style="color:var(--md-success);font-weight:600">已同意</span>';
  } else {
    statusHtml = '<span style="color:var(--md-error);font-weight:600">已拒绝</span>';
  }

  let contactHtml = '';
  if (isAccepted && result.contactInfo) {
    const info = result.contactInfo;
    contactHtml = `
      <div style="margin-top:var(--space-4);padding:var(--space-4);background:var(--md-surface-container);border-radius:8px;">
        <div style="font-weight:600;margin-bottom:var(--space-3);color:var(--md-on-surface)">对方的联系方式</div>
        ${info.qq ? `<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)"><span style="color:var(--md-on-surface-variant)">QQ：</span><span>${escHtml(info.qq)}</span></div>` : ''}
        ${info.wechat ? `<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)"><span style="color:var(--md-on-surface-variant)">微信：</span><span>${escHtml(info.wechat)}</span></div>` : ''}
        ${info.douyin ? `<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)"><span style="color:var(--md-on-surface-variant)">抖音：</span><span>${escHtml(info.douyin)}</span></div>` : ''}
        ${!info.qq && !info.wechat && !info.douyin ? '<div style="color:var(--md-on-surface-variant)">对方暂未填写联系方式</div>' : ''}
      </div>
    `;
  }

  let actionsHtml = '';
  if (isPending && isRecipient) {
    actionsHtml = `
      <div class="inline-btn-group" style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-top:var(--space-4)">
        <button class="btn btn-secondary" id="exchange-reject-btn">
          <span class="mi">close</span> 拒绝
        </button>
        <button class="btn btn-primary" id="exchange-accept-btn">
          <span class="mi">check</span> 同意
        </button>
      </div>
    `;
  }

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4);">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--md-primary-container);display:flex;align-items:center;justify-content:center">
          ${displayUser.avatar_url
            ? `<img src="${escHtml(displayUser.avatar_url)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">`
            : `<span class="mi" style="font-size:24px;color:var(--md-primary)">person</span>`
          }
        </div>
        <div>
          <div style="font-weight:600;color:var(--md-on-surface)">${escHtml(displayUser.nickname || '未知用户')}</div>
          <div style="font-size:var(--text-sm);color:var(--md-on-surface-variant)">${escHtml(displayUser.major || '')} ${escHtml(displayUser.grade || '')}</div>
        </div>
        <div style="margin-left:auto">${statusHtml}</div>
      </div>

      ${result.message ? `
        <div style="padding:var(--space-3);background:var(--md-surface-container-low);border-radius:8px;">
          <div style="font-size:var(--text-xs);color:var(--md-on-surface-variant);margin-bottom:var(--space-1)">附带信息</div>
          <div style="color:var(--md-on-surface)">${escHtml(result.message)}</div>
        </div>
      ` : ''}

      ${contactHtml}
      ${actionsHtml}
    </div>
  `;

  openModal('交换联系方式详情', bodyHtml);

  if (isPending && isRecipient) {
    document.getElementById('exchange-accept-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('exchange-accept-btn');
      btn.disabled = true;
      const res = await apiPut(`/api/user/contact-exchange/${requestId}/accept`, {});
      if (res.error) {
        showToast(res.error);
        btn.disabled = false;
        return;
      }
      showToast('已同意');
      closeModal();
      await loadNotifications();
    });

    document.getElementById('exchange-reject-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('exchange-reject-btn');
      btn.disabled = true;
      const res = await apiPut(`/api/user/contact-exchange/${requestId}/reject`, {});
      if (res.error) {
        showToast(res.error);
        btn.disabled = false;
        return;
      }
      showToast('已拒绝');
      closeModal();
      await loadNotifications();
    });
  }
}
