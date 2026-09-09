/**
 * explore/invites.js — 自习邀约子模块
 * 仅负责：邀约列表渲染、发布、交互
 * 由 explore.js 动态调用，不注册全局路由
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../../core/api.js';
import { navigateTo, animStagger } from '../../core/router.js';
import { showToast, createMdSelect, escHtml, renderLoginPrompt, bindLoginPrompt, openModal, closeModal } from '../../components/ui.js';
import { renderAuth } from '../auth.js';

/* =============================================
   Render — 渲染邀约列表面板
   ============================================= */

export async function renderInvites(container) {
  if (!window._currentUser) {
    await window.loadCurrentUser();
  }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="form-row" style="margin-bottom:16px;flex-wrap:wrap">
      ${createMdSelect({
        id: 'invite-filter-date',
        options: [
          { text: '全部日期', value: 'all' },
          { text: '今天', value: 'today' },
          { text: '近7天', value: 'week' }
        ],
        style: 'width:auto;min-width:100px;margin-bottom:0'
      })}
      ${createMdSelect({
        id: 'invite-filter-status',
        options: [
          { text: '全部状态', value: 'all' },
          { text: '招募中', value: 'open' },
          { text: '已满', value: 'full' },
          { text: '已关闭', value: 'closed' }
        ],
        style: 'width:auto;min-width:100px;margin-bottom:0'
      })}
    </div>
    <div id="invites-list"></div>
  `;

  document.getElementById('invite-filter-date-container')?.addEventListener('md-select-change', refreshInvites);
  document.getElementById('invite-filter-status-container')?.addEventListener('md-select-change', refreshInvites);

  await refreshInvites();
}

/* =============================================
   Bind — 事件绑定（事件委托，只绑一次）
   ============================================= */

export function bindInvitesEvents(container) {
  if (container._invitesBound) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);

    if (action === 'join' && id)            respondInvite(id, 'join');
    if (action === 'cancel-respond' && id)  respondInvite(id, 'cancel');
    if (action === 'cancel-invite' && id)   cancelInvite(id);
    if (action === 'review-invite' && id)   showInviteRequests(id);
    if (action === 'approve-response' && id) reviewInviteResponse(Number(btn.dataset.inviteId), id, 'accept');
    if (action === 'reject-response' && id)  reviewInviteResponse(Number(btn.dataset.inviteId), id, 'reject');
  });

  container._invitesBound = true;
}

/* =============================================
   Data — 数据加载与交互
   ============================================= */

export async function refreshInvites() {
  const date = document.getElementById('invite-filter-date')?.value || 'all';
  const status = document.getElementById('invite-filter-status')?.value || 'all';
  const params = new URLSearchParams();
  if (date !== 'all') params.set('date', date);
  if (status !== 'all') params.set('status', status);

  const listEl = document.getElementById('invites-list');
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const data = await apiGet(`/api/invites?${params.toString()}`);
    const invites = data?.invites || [];
    if (listEl) listEl.innerHTML = renderInvitesList(invites);

    const cards = listEl?.querySelectorAll('.invite-card');
    if (cards?.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
  } catch {
    if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}

function renderInvitesList(invites) {
  if (invites.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">event_available</span>
        <p class="text-secondary" style="margin-top:12px">暂无自习邀约，来发布第一个吧</p>
      </div>
    `;
  }

  return invites.map(inv => {
    const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
    const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };
    const isCreator = inv.creator_id === window._currentUser?.id;
    const isPending = inv.my_status === 'pending';
    const isJoined = inv.my_status === 'accepted' || isCreator;
    const isFull = inv.participant_count >= inv.max_participants;

    return `
      <div class="card invite-card" data-invite-card-id="${inv.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <h3 style="font-size:var(--text-lg);font-weight:600">${escHtml(inv.title)}</h3>
              <span class="status-badge ${statusClass[inv.status] || ''}">${statusMap[inv.status] || inv.status}</span>
              ${inv.approval_required ? '<span class="status-badge">需批准</span>' : ''}
              ${isPending ? '<span class="status-badge">待批准</span>' : ''}
            </div>
            <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;font-size:14px;color:var(--md-on-surface-variant)">
              <span><span class="mi" style="font-size:16px;vertical-align:-3px">event</span> ${escHtml(inv.study_date)}</span>
              <span><span class="mi" style="font-size:16px;vertical-align:-3px">schedule</span> ${escHtml(inv.start_time)} - ${escHtml(inv.end_time)}</span>
              ${inv.location ? `<span><span class="mi" style="font-size:16px;vertical-align:-3px">location_on</span> ${escHtml(inv.location)}</span>` : ''}
              <span><span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${inv.participant_count}/${inv.max_participants}人</span>
            </div>
            ${inv.description ? `<p style="margin-top:8px;font-size:14px;color:var(--md-on-surface-variant)">${escHtml(inv.description)}</p>` : ''}
            <div style="margin-top:8px;font-size:12px;color:var(--md-outline)">发起人: <button class="user-profile-link" onclick="navigateTo('profile-user', ${inv.creator_id})">${escHtml(inv.creator_name)}</button></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
            ${!isCreator && !isJoined && inv.status === 'open' && !isFull ? `<button class="btn btn-primary" style="font-size:12px;padding:6px 16px" data-action="join" data-id="${inv.id}">加入</button>` : ''}
            ${(isJoined || isPending) && !isCreator ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 16px" data-action="cancel-respond" data-id="${inv.id}">取消${isPending ? '申请' : '参与'}</button>` : ''}
            ${isCreator && Number(inv.pending_count || 0) > 0 ? `<button class="btn btn-primary" style="font-size:12px;padding:6px 16px" data-action="review-invite" data-id="${inv.id}">处理申请(${inv.pending_count})</button>` : ''}
            ${isCreator ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 16px" data-action="cancel-invite" data-id="${inv.id}">取消邀约</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export async function respondInvite(inviteId, action) {
  const result = await apiPost(`/api/invites/${inviteId}/respond`, { action });
  if (result.error) { showToast(result.error); return; }
  showToast(result.message);
  await refreshInvites();
}

export async function cancelInvite(inviteId) {
  if (!confirm('确定取消这个邀约？')) return;
  const result = await apiDelete(`/api/invites/${inviteId}`);
  if (result.error) { showToast(result.error); return; }
  showToast('已取消');
  await refreshInvites();
}

export async function showInviteRequests(inviteId) {
  const detail = await apiGet(`/api/invites/${inviteId}`);
  if (detail.error) { showToast(detail.error); return; }
  const pending = detail.pending || [];
  const bodyHtml = pending.length === 0
    ? '<p class="text-secondary">暂无待处理申请</p>'
    : `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${pending.map(item => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--md-outline-variant);border-radius:8px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">${escHtml(item.nickname || '同学')}</div>
              <div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml(item.major || '')} ${escHtml(item.grade || '')}</div>
            </div>
            <button class="btn btn-secondary" data-action="reject-response" data-invite-id="${inviteId}" data-id="${item.response_id}">拒绝</button>
            <button class="btn btn-primary" data-action="approve-response" data-invite-id="${inviteId}" data-id="${item.response_id}">同意</button>
          </div>
        `).join('')}
      </div>
    `;
  openModal('处理自习申请', bodyHtml);
  document.querySelectorAll('.modal-overlay [data-action="approve-response"], .modal-overlay [data-action="reject-response"]').forEach(btn => {
    btn.addEventListener('click', () => {
      reviewInviteResponse(Number(btn.dataset.inviteId), Number(btn.dataset.id), btn.dataset.action === 'approve-response' ? 'accept' : 'reject');
    });
  });
}

export async function reviewInviteResponse(inviteId, responseId, action) {
  const result = await apiPut(`/api/invites/${inviteId}/responses/${responseId}`, { action });
  if (result.error) { showToast(result.error); return; }
  showToast(result.message);
  closeModal();
  await refreshInvites();
  const listEl = document.getElementById('my-invites-list');
  if (listEl) await loadMyInvites('created');
}

/* =============================================
   我的邀约（子页面，独立路由 invites-my）
   ============================================= */

export async function renderMyInvites(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn-icon" onclick="navigateTo('explore')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title"><span class="mi" style="vertical-align:-4px;margin-right:4px">event_available</span>我的邀约</h1>
      </div>
    </div>
    <div class="inline-btn-group" style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary tab-btn active" id="my-tab-created" onclick="switchMyTab('created')">我发起的</button>
      <button class="btn btn-secondary tab-btn" id="my-tab-joined" onclick="switchMyTab('joined')">我参与的</button>
    </div>
    <div id="my-invites-list"></div>
  `;

  await loadMyInvites('created');
}

export async function switchMyTab(type) {
  document.getElementById('my-tab-created')?.classList.toggle('active', type === 'created');
  document.getElementById('my-tab-created')?.classList.toggle('btn-primary', type === 'created');
  document.getElementById('my-tab-created')?.classList.toggle('btn-secondary', type !== 'created');
  document.getElementById('my-tab-joined')?.classList.toggle('active', type === 'joined');
  document.getElementById('my-tab-joined')?.classList.toggle('btn-primary', type === 'joined');
  document.getElementById('my-tab-joined')?.classList.toggle('btn-secondary', type !== 'joined');
  await loadMyInvites(type);
}

async function loadMyInvites(type) {
  const listEl = document.getElementById('my-invites-list');
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  const invites = await apiGet(`/api/invites/my?type=${type}`);
  if (!invites || invites.length === 0) {
    const emptyMsg = type === 'created' ? '你还没有发布过邀约' : '你还没有参与过邀约';
    if (listEl) listEl.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">event_available</span>
        <p class="text-secondary" style="margin-top:12px">${emptyMsg}</p>
      </div>
    `;
    return;
  }

  if (listEl) {
    listEl.innerHTML = renderInvitesList(invites);
    // 列表出现时做交错入场动画
    var cards = listEl.querySelectorAll('.invite-card');
    if (cards.length > 0) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
  }
}
