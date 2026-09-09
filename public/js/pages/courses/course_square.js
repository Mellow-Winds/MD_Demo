/**
 * pages/courses/course_square.js — 课程搭子帖共享模块
 * 供 detail.js 和 my_courses.js 的「交友」标签页使用
 *
 * 所有 DOM ID 均以 prefix 参数化，防止多页面共存时冲突
 * API 走 /api/courses/:id/square-posts/* 课程作用域端点
 */

import { apiGet, apiPost, apiPut, apiDelete, isLoggedIn, getToken } from '../../core/api.js';
import { navigateTo, animIn, animStagger } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, createMdTextarea, escHtml, formatTime } from '../../components/ui.js';
import { TkComments } from '../../components/tk-comments.js';

/* =============================================
   Constants
   ============================================= */

const COURSE_SQUARE_CATEGORIES = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '技能交换', '竞赛组队', '其他'];

/* =============================================
   State（per-prefix 隔离）
   ============================================= */

const _state = {};  // { [prefix]: { postId: {...} } }

function getState(prefix) {
  if (!_state[prefix]) _state[prefix] = { loadedComments: {}, commentImageMap: {}, replyingTo: {} };
  return _state[prefix];
}

/* =============================================
   Tab 入口：渲染交友面板
   ============================================= */

export async function renderCourseSquareTab(container, courseId, prefix) {
  const st = getState(prefix);

  container.innerHTML = `
    <div class="form-row" style="justify-content:space-between;margin-bottom:16px;flex-wrap:wrap">
      ${createMdSelect({
        id: `${prefix}-sq-filter-category`,
        options: [{ text: '全部类型', value: 'all' }, ...COURSE_SQUARE_CATEGORIES.map(c => ({ text: c, value: c }))],
        style: 'width:auto;min-width:120px;margin-bottom:0'
      })}
      <button class="btn btn-primary btn-compact" id="${prefix}-sq-create-btn">
        <span class="mi">add</span> 发布搭子帖
      </button>
    </div>
    <div id="${prefix}-sq-posts-list"></div>
  `;

  // 绑定发帖按钮
  document.getElementById(`${prefix}-sq-create-btn`)?.addEventListener('click', () => {
    openCourseSquareCreateModal(courseId, prefix);
  });

  // 绑定分类筛选下拉事件
  document.getElementById(`${prefix}-sq-filter-category-container`)?.addEventListener('md-select-change', () => {
    refreshCourseSquarePosts(courseId, prefix);
  });

  await refreshCourseSquarePosts(courseId, prefix);
}

/* =============================================
   刷新帖子列表
   ============================================= */

export async function refreshCourseSquarePosts(courseId, prefix) {
  const category = document.getElementById(`${prefix}-sq-filter-category`)?.value || 'all';
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);

  const listEl = document.getElementById(`${prefix}-sq-posts-list`);
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const data = await apiGet(`/api/courses/${courseId}/square-posts?${params.toString()}`);
    const posts = data?.posts || [];
    if (listEl) listEl.innerHTML = renderCourseSquarePosts(posts, courseId, prefix);
    const cards = listEl?.querySelectorAll('.square-post-card');
    if (cards?.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
  } catch {
    if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}

function renderCourseSquarePosts(posts, courseId, prefix) {
  if (posts.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">group_add</span>
        <p class="text-secondary" style="margin-top:12px">暂无搭子帖，来发布第一个吧</p>
      </div>
    `;
  }

  const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
  const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };

  return posts.map(p => `
    <div class="card square-post-card" data-course-id="${courseId}" data-post-id="${p.id}" data-prefix="${prefix}" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <h3 style="font-size:var(--text-lg);font-weight:600">${escHtml(p.title)}</h3>
            <span class="square-category-tag">${escHtml(p.category)}</span>
            <span class="status-badge ${statusClass[p.status] || ''}">${statusMap[p.status] || p.status}</span>
          </div>
          ${p.description ? `<p style="margin-top:6px;font-size:14px;color:var(--md-on-surface-variant);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(p.description)}</p>` : ''}
          <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;font-size:12px;color:var(--md-on-surface-variant)">
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">people</span> ${p.confirmed_count || 0}/${p.max_people}人</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">schedule</span> 剩余 ${p.remaining_days} 天</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">person</span> ${escHtml(p.creator_name)}</span>
          </div>
          ${p.my_status ? `<div style="margin-top:6px;font-size:12px;color:var(--md-primary);font-weight:500">你: ${p.my_status === 'pending' ? '已申请，等待确认' : p.my_status === 'accepted' ? '已通过' : '已拒绝'}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* =============================================
   帖子卡片点击 → 内联详情
   ============================================= */

// 事件委托：点击帖子卡片查看详情
document.addEventListener('click', (e) => {
  const card = e.target.closest('.square-post-card[data-prefix]');
  if (!card) return;
  const courseId = Number(card.dataset.courseId);
  const postId = Number(card.dataset.postId);
  const prefix = card.dataset.prefix;
  if (!courseId || !postId || !prefix) return;
  viewCourseSquarePost(courseId, postId, prefix);
});

/* =============================================
   帖子详情（内联渲染，不注册路由）
   ============================================= */

export async function viewCourseSquarePost(courseId, postId, prefix) {
  const tabContent = document.getElementById('detail-tab-content') || document.getElementById('my-course-tab-content');
  if (!tabContent) return;

  tabContent.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const data = await apiGet(`/api/courses/${courseId}/square-posts/${postId}`);
    if (data.error) { tabContent.innerHTML = `<div class="card"><p class="text-secondary">${data.error}</p></div>`; return; }

    const isCreator = data.creator_id === window._currentUser?.id;
    const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
    const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };

    tabContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <button class="btn btn-secondary" style="padding:6px 8px" id="${prefix}-sq-back-btn"><span class="mi">arrow_back</span></button>
        <h1 class="page-title" style="margin:0">${escHtml(data.title)}</h1>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
          <span class="square-category-tag">${escHtml(data.category)}</span>
          <span class="status-badge ${statusClass[data.status] || ''}">${statusMap[data.status] || data.status}</span>
        </div>
        <p style="white-space:pre-wrap;line-height:1.6">${escHtml(data.description) || '无描述'}</p>
        <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;font-size:14px;color:var(--md-on-surface-variant)">
          <span><span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${data.confirmed?.length || 0}/${data.max_people}人</span>
          <span><span class="mi" style="font-size:16px;vertical-align:-3px">schedule</span> 剩余 ${data.remaining_days} 天</span>
          <span><span class="mi" style="font-size:16px;vertical-align:-3px">person</span> <button class="user-profile-link" onclick="navigateTo('profile-user', ${data.creator_id})">${escHtml(data.creator_name)}</button>${data.creator_major ? ' · ' + escHtml(data.creator_major) : ''}${data.creator_grade ? ' · ' + escHtml(data.creator_grade) : ''}</span>
        </div>
        ${!isCreator ? renderCourseSquareAction(data, courseId, prefix) : ''}
        ${isCreator ? `<div style="margin-top:12px;display:flex;gap:6px"><button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" id="${prefix}-sq-edit-btn"><span class="mi" style="font-size:14px">edit</span> 编辑</button><button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" id="${prefix}-sq-delete-btn"><span class="mi" style="font-size:14px">delete</span> 删除</button></div>` : ''}
      </div>

      ${isCreator ? renderCourseSquareCreatorPanel(data, courseId, prefix) : ''}

      ${data.confirmed && data.confirmed.length > 0 ? `
        <div class="card" style="margin-bottom:16px">
          <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">check_circle</span> 已确认成员</h3>
          ${data.confirmed.map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${data.confirmed.indexOf(m) > 0 ? 'border-top:1px solid var(--md-outline-variant)' : ''}">
              <div class="avatar-small">${(m.nickname || '?')[0]}</div>
              <div style="flex:1">
                <button class="user-profile-link" onclick="navigateTo('profile-user', ${m.user_id})">${escHtml(m.nickname)}</button>
                ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
              </div>
              ${m.qq ? `<div style="font-size:13px;color:var(--md-primary);cursor:pointer" onclick="navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:14px;vertical-align:-2px">qq</span> QQ: ${escHtml(m.qq)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="card" id="tk-comments-container-${postId}">
        ${isLoggedIn() ? '' : '<p class="text-secondary" style="font-size:12px;text-align:center;padding:12px"><a href="#" onclick="navigateTo(\'auth\');return false">登录</a> 后参与讨论</p>'}
      </div>
    `;

    // 返回按钮
    document.getElementById(`${prefix}-sq-back-btn`)?.addEventListener('click', () => {
      renderCourseSquareTab(tabContent, courseId, prefix);
    });

    // 编辑按钮
    document.getElementById(`${prefix}-sq-edit-btn`)?.addEventListener('click', () => {
      openCourseSquareEditModal(courseId, postId, prefix, data);
    });

    // 删除按钮
    document.getElementById(`${prefix}-sq-delete-btn`)?.addEventListener('click', () => {
      openModal('确认删除', `
        <p style="margin-bottom:24px">确定要删除这篇搭子帖吗？删除后无法恢复</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="${prefix}-confirm-delete-post" style="background:var(--md-error,#e53935)">删除</button>
        </div>
      `);
      document.getElementById(`${prefix}-confirm-delete-post`)?.addEventListener('click', async () => {
        const result = await apiDelete(`/api/courses/${courseId}/square-posts/${postId}`);
        if (result.error) { showToast(result.error); return; }
        closeModal();
        showToast('已删除');
        renderCourseSquareTab(tabContent, courseId, prefix);
      });
    });

    // 感兴趣按钮
    bindCourseSquareInterestBtn(courseId, postId, prefix);

    animIn(tabContent.querySelector('.card'), { y: 16, dur: 380 });

    // 初始化统一评论区
    if (isLoggedIn()) {
      const commentContainer = document.getElementById(`tk-comments-container-${postId}`);
      if (commentContainer) {
        const tkComments = new TkComments({
          apiBase: `/api/courses/${courseId}/square-posts`,
          ctxId: postId,
          container: commentContainer,
          layout: 'inline',
          onNavigateProfile: (userId) => { navigateTo('profile-user', userId); }
        });
        tkComments.init();
        tabContent._tkComments = tkComments;
      }
    }
  } catch (e) {
    tabContent.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
}

function renderCourseSquareAction(data, courseId, prefix) {
  if (data.my_status === 'accepted') {
    return '<div class="square-status-msg square-status-accepted"><span class="mi" style="font-size:16px;vertical-align:-3px">check_circle</span> 你的申请已通过，可查看联系方式</div>';
  }
  if (data.my_status === 'pending') {
    return '<div style="margin-top:12px"><button class="btn btn-secondary" disabled>已申请，等待确认</button></div>';
  }
  if (data.my_status === 'rejected') {
    return '<div class="square-status-msg square-status-rejected">你的申请未通过</div>';
  }
  if (data.status !== 'open') {
    return '<div style="margin-top:12px"><button class="btn btn-secondary" disabled>暂不接受申请</button></div>';
  }
  return `<div style="margin-top:12px"><button class="btn btn-primary" id="${prefix}-sq-interest-btn"><span class="mi" style="font-size:16px">favorite</span> 感兴趣</button></div>`;
}

function renderCourseSquareCreatorPanel(data, courseId, prefix) {
  if (!data.pending || data.pending.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:16px">
      <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">pending</span> 待处理申请 (${data.pending.length})</h3>
      ${data.pending.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${data.pending.indexOf(p) > 0 ? 'border-top:1px solid var(--md-outline-variant)' : ''}">
          <div class="avatar-small">${(p.nickname || '?')[0]}</div>
          <div style="flex:1">
            <button class="user-profile-link" onclick="navigateTo('profile-user', ${p.user_id})">${escHtml(p.nickname)}</button>
            ${(p.major || p.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([p.major, p.grade].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary csq-accept-btn" style="font-size:12px;padding:4px 12px" data-interest-id="${p.interest_id}" data-course-id="${courseId}" data-post-id="${data.id}" data-prefix="${prefix}">接受</button>
            <button class="btn btn-secondary csq-reject-btn" style="font-size:12px;padding:4px 12px" data-interest-id="${p.interest_id}" data-course-id="${courseId}" data-post-id="${data.id}" data-prefix="${prefix}">拒绝</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 事件委托：接受 / 拒绝（感兴趣按钮通过 bindCourseSquareInterestBtn 直接绑定）
document.addEventListener('click', async (e) => {
  const acceptBtn = e.target.closest('.csq-accept-btn');
  if (acceptBtn) {
    const { interestId, courseId, postId, prefix } = acceptBtn.dataset;
    await handleCourseSquareInterest(courseId, interestId, 'accept', postId, prefix);
    return;
  }

  const rejectBtn = e.target.closest('.csq-reject-btn');
  if (rejectBtn) {
    const { interestId, courseId, postId, prefix } = rejectBtn.dataset;
    await handleCourseSquareInterest(courseId, interestId, 'reject', postId, prefix);
    return;
  }
});

/* =============================================
   感兴趣 / 接受拒绝
   ============================================= */

// 绑定感兴趣按钮（动态渲染后调用）
export function bindCourseSquareInterestBtn(courseId, postId, prefix) {
  const btn = document.getElementById(`${prefix}-sq-interest-btn`);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const result = await apiPost(`/api/courses/${courseId}/square-posts/${postId}/interest`, {});
    if (result.error) { showToast(result.error); return; }
    showToast('已申请');
    viewCourseSquarePost(courseId, postId, prefix);
  });
}

async function handleCourseSquareInterest(courseId, interestId, action, postId, prefix) {
  const result = await apiPut(`/api/courses/${courseId}/square-interests/${interestId}`, { action });
  if (result.error) { showToast(result.error); return; }
  showToast(action === 'accept' ? '已接受' : '已拒绝');
  viewCourseSquarePost(courseId, Number(postId), prefix);
}

/* =============================================
   发帖 Modal
   ============================================= */

export function openCourseSquareCreateModal(courseId, prefix) {
  openModal('发布搭子帖', `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${createMdInput({ id: `${prefix}-sq-title`, label: '标题', placeholder: ' ' })}
      ${createMdSelect({
        id: `${prefix}-sq-category`,
        label: '类型',
        options: COURSE_SQUARE_CATEGORIES.map(c => ({ text: c, value: c }))
      })}
      ${createMdTextarea({ id: `${prefix}-sq-desc`, label: '描述', placeholder: '详细描述你的需求...', rows: 4 })}
      ${createMdInput({ id: `${prefix}-sq-max`, label: '期望人数', type: 'number', value: '2', min: '1', max: '20' })}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" id="${prefix}-sq-submit-btn">发布</button>
      </div>
    </div>
  `);

  document.getElementById(`${prefix}-sq-submit-btn`)?.addEventListener('click', async () => {
    const title = document.getElementById(`${prefix}-sq-title`)?.value?.trim();
    const category = document.getElementById(`${prefix}-sq-category`)?.value;
    const description = document.getElementById(`${prefix}-sq-desc`)?.value?.trim();
    const max_people = Number(document.getElementById(`${prefix}-sq-max`)?.value) || 2;

    if (!title) { showToast('请输入标题'); return; }
    if (!category) { showToast('请选择类型'); return; }

    const btn = document.getElementById(`${prefix}-sq-submit-btn`);
    btn.disabled = true;
    btn.textContent = '发布中...';

    const result = await apiPost(`/api/courses/${courseId}/square-posts`, { title, category, description, max_people });
    if (result.error) {
      showToast(result.error);
      btn.disabled = false;
      btn.textContent = '发布';
      return;
    }

    closeModal();
    showToast('发布成功');
    await refreshCourseSquarePosts(courseId, prefix);
  });
}

/**
 * 编辑搭子帖 Modal — 复用创建表单，预填数据，提交 PUT
 */
function openCourseSquareEditModal(courseId, postId, prefix, postData) {
  openModal('编辑搭子帖', `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${createMdInput({ id: `${prefix}-sq-edit-title`, label: '标题', placeholder: ' ', value: postData.title || '' })}
      ${createMdSelect({
        id: `${prefix}-sq-edit-category`,
        label: '类型',
        options: COURSE_SQUARE_CATEGORIES.map(c => ({ text: c, value: c })),
        selected: postData.category || ''
      })}
      ${createMdTextarea({ id: `${prefix}-sq-edit-desc`, label: '描述', placeholder: '详细描述你的需求...', rows: 4, value: postData.description || '' })}
      ${createMdInput({ id: `${prefix}-sq-edit-max`, label: '期望人数', type: 'number', value: String(postData.max_people || 2), min: '1', max: '20' })}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" id="${prefix}-sq-edit-submit-btn">保存</button>
      </div>
    </div>
  `);

  document.getElementById(`${prefix}-sq-edit-submit-btn`)?.addEventListener('click', async () => {
    const title = document.getElementById(`${prefix}-sq-edit-title`)?.value?.trim();
    const category = document.getElementById(`${prefix}-sq-edit-category`)?.value;
    const description = document.getElementById(`${prefix}-sq-edit-desc`)?.value?.trim();
    const max_people = Number(document.getElementById(`${prefix}-sq-edit-max`)?.value) || 2;

    if (!title) { showToast('请输入标题'); return; }
    if (!category) { showToast('请选择类型'); return; }

    const btn = document.getElementById(`${prefix}-sq-edit-submit-btn`);
    btn.disabled = true;
    btn.textContent = '保存中...';

    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/courses/${courseId}/square-posts/${postId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title, category, description, max_people })
    });
    const result = await res.json();

    if (result.error) {
      showToast(result.error);
      btn.disabled = false;
      btn.textContent = '保存';
      return;
    }

    closeModal();
    showToast('已更新');
    // 刷新帖子详情
    viewCourseSquarePost(courseId, postId, prefix);
  });
}


