/**
 * pages/courses/detail.js — 全站统一大课空间详情页
 * registerPage: course-detail
 *
 * 通过 courseId 动态评估当前用户的在修状态：
 *   - 已选修 → 三段药丸（论坛/资料/交友）+ 发布按钮激活
 *   - 未选修 → 两段药丸（论坛/资料）+ 发布按钮置灰 + 交友 Tab 隐藏
 *   交友 Tab = 课程搭子帖（course_square.js）
 */

import { apiGet, apiPost, apiDelete, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, escHtml, formatTime, formatFileSize, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';
import { TkComments } from '../../components/tk-comments.js';
import { getFavoriteCourseIds, getFavoritePostIds, renderCourseFavoriteButton, renderPostFavoriteButton } from '../favorites.js';
import { renderPostAttachments } from './post_attachments.js';
import { cleanBigCourseName } from './all_courses.js';
import { renderCourseSquareTab, bindCourseSquareInterestBtn } from './course_square.js';

/* =============================================
   全局状态
   ============================================= */

window._courseDetail = {};
window._courseDetailTargetPostId = null;

/* =============================================
   辅助：判断用户是否已选修某课程
   ============================================= */

async function checkEnrollment(courseId) {
  if (!isLoggedIn()) return false;
  try {
    const myCourses = await apiGet('/api/courses');
    // 检查用户是否选了该大课下的任意一门小课
    return Array.isArray(myCourses) && myCourses.some(c =>
      c.big_course_id === Number(courseId) || c.id === Number(courseId)
    );
  } catch {
    return false;
  }
}

/* =============================================
   Page: 统一课程详情页
   ============================================= */

registerPage('course-detail', async (container, data) => {
  const courseId = typeof data === 'object' ? data.id : data;
  const initialTab = typeof data === 'object' ? (data.tab || 'forum') : 'forum';
  const targetPostId = typeof data === 'object' ? (data.targetPostId || 0) : 0;
  const scrollToCommentId = typeof data === 'object' ? (data.scrollToCommentId || 0) : 0;

  // 通知跳转：存储定位参数供 renderForumTab 使用
  if (targetPostId) {
    window._courseDetailTargetPostId = targetPostId;
    window._courseDetailScrollToCommentId = scrollToCommentId;
  }

  container.innerHTML = `<div class="card"><p class="text-secondary">加载中...</p></div>`;

  try {
    const course = await apiGet(`/api/courses/${courseId}`);
    if (course.error) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">error_outline</span>
          <p class="text-secondary" style="margin-top:12px">${escHtml(course.error)}</p>
          <button class="btn btn-secondary mt-6" onclick="navigateTo('mycourse')">
            <span class="mi">arrow_back</span> 返回我的课程
          </button>
        </div>
      `;
      return;
    }

    const enrolled = await checkEnrollment(courseId);
    const cleanName = cleanBigCourseName(course.title);
    const favoriteCourseIds = await getFavoriteCourseIds();

    window._courseDetail = { courseId: Number(courseId), course, enrolled, activeTab: null };

    // 构建药丸 Tabs：已选修多一个"交友"
    const squareTab = enrolled
      ? `<button class="md-pill-btn" data-tab="square" onclick="switchDetailTab('square', ${courseId})">
           <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 交友
         </button>`
      : '';

    container.innerHTML = `
      <div class="page-header">
        <div style="flex:1;min-width:0">
          <h1 class="page-title" style="margin-bottom:4px">${escHtml(cleanName)}</h1>
          <div class="course-info-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <p class="text-secondary" style="margin:0">
              ${course.enrollment_count || 0} 人选课
              ${enrolled ? '' : ' · <span style="color:var(--md-outline)">只读模式</span>'}
            </p>
            ${renderCourseFavoriteButton(courseId, favoriteCourseIds.has(Number(courseId)))}
          </div>
        </div>
      </div>
      <div class="md-pills" id="detail-pills">
        <button class="md-pill-btn${initialTab === 'forum' ? ' active' : ''}" data-tab="forum" onclick="switchDetailTab('forum', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 论坛
        </button>
        <button class="md-pill-btn${initialTab === 'materials' ? ' active' : ''}" data-tab="materials" onclick="switchDetailTab('materials', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料
        </button>
        ${squareTab}
      </div>
      <div id="detail-tab-content" style="min-height:200px"></div>
    `;

    bindRipples(container);
    animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
    animIn(container.querySelector('.md-pills'), { y: 12, delay: 80, dur: 350 });

    await switchDetailTab(initialTab, courseId);
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
});

/* ---- 未选修时的发布拦截 Toast ---- */

export function showPublishBlockedToast() {
  showToast('课程广场为只读档案馆。你未修读本门课程的任何班级，暂无发布权限。');
}

/* ---- 药丸 Tab 切换 ---- */

export async function switchDetailTab(tab, courseId) {
  if (tab === window._courseDetail.activeTab) return;
  window._courseDetail.activeTab = tab;

  document.querySelectorAll('#detail-pills .md-pill-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  const contentEl = document.getElementById('detail-tab-content');
  if (!contentEl) return;

  const { enrolled } = window._courseDetail;

  // 平滑切换：先淡出再加载再淡入
  contentEl.style.transition = 'opacity 0.12s var(--ease-standard)';
  contentEl.style.opacity = '0';
  await new Promise(r => setTimeout(r, 120));

  switch (tab) {
    case 'forum':
      await renderForumTab(contentEl, courseId, enrolled);
      break;
    case 'materials':
      await renderMaterialsTab(contentEl, courseId, enrolled);
      break;
    case 'square':
      if (enrolled) await renderCourseSquareTab(contentEl, courseId, 'dc');
      break;
  }

  contentEl.style.opacity = '1';
}

/* =============================================
   论坛标签页 — 扁平流式分割线架构
   ============================================= */

// ---- 论坛流式状态 ----
const _forumLikeState = {};          // { 'p123': { liked: bool, count: N } } — 帖子级赞（客户端 only）
let _forumDailyCount = 0;            // 当日发布计数
let _forumDailyDate = '';            // 当日日期标记

// ---- TkComments 实例管理（每帖一个实例，懒创建） ----
const _tkCommentsInstances = new Map();  // postId → TkComments

function getOrCreateComments(postId) {
  if (_tkCommentsInstances.has(postId)) return _tkCommentsInstances.get(postId);
  const container = document.getElementById(`forum-comments-${postId}`);
  if (!container) return null;
  const tk = new TkComments({
    apiBase: '/api/courses/posts',
    ctxId: postId,
    container: container,
    layout: 'inline',
    likeKey: 'forum_comment_likes',
    onNavigateProfile: (identifier) => {
      if (typeof identifier === 'number' || /^\d+$/.test(String(identifier))) {
        navigateTo('profile-user', Number(identifier));
      } else {
        navigateTo('profile-user', identifier);
      }
    }
  });
  _tkCommentsInstances.set(postId, tk);
  return tk;
}

function scrollToTkComment(commentId) {
  const tryScroll = (retries = 0) => {
    const el = document.getElementById(`tk-comment-${commentId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.background = 'var(--md-primary-container)';
      el.style.transition = 'background 0.3s';
      setTimeout(() => { el.style.background = ''; }, 2000);
    } else if (retries < 10) {
      setTimeout(() => tryScroll(retries + 1), 300);
    } else {
      showToast('该评论已被删除或移除');
    }
  };
  tryScroll();
}

function destroyAllComments() {
  for (const [, tk] of _tkCommentsInstances) {
    try { tk.destroy(); } catch {}
  }
  _tkCommentsInstances.clear();
}

function updatePostCommentCount(postId) {
  const countEl = document.getElementById(`tk-comment-count-${postId}`);
  const btn = document.querySelector(`[data-action="forum-toggle-comments"][data-post-id="${postId}"]`);
  if (btn && countEl) {
    const count = String(countEl.textContent || '').replace(/[^0-9]/g, '') || '0';
    btn.innerHTML = `<span class="mi" style="font-size:16px">forum</span> ${count} 回复`;
  }
}

async function renderForumTab(contentEl, courseId, enrolled) {
  destroyAllComments();

  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const posts = await apiGet(`/api/courses/${courseId}/posts`);
  const favoritePostIds = await getFavoritePostIds();

  // 初始化点赞状态
  posts.forEach(p => {
    const key = `p${p.id}`;
    if (!_forumLikeState[key]) {
      _forumLikeState[key] = { liked: false, count: 0 };
    }
  });

  // 重置每日计数器（跨日重置）
  const today = new Date().toISOString().slice(0, 10);
  if (_forumDailyDate !== today) {
    _forumDailyDate = today;
    _forumDailyCount = 0;
  }

  const composeBar = enrolled ? `
    <div class="forum-compose-bar" id="forum-compose-bar" onclick="openForumCompose()">
      <div class="forum-compose-avatar">
        ${window._currentUser?.avatar_url
          ? `<img class="forum-avatar" src="${window._currentUser.avatar_url}" alt="">`
          : `<div class="forum-avatar-letter">${((window._currentUser?.nickname || '?')[0] || '?').toUpperCase()}</div>`
        }
      </div>
      <div class="forum-compose-placeholder">分享你的想法...</div>
      <span class="mi" style="color:var(--md-on-surface-variant);font-size:20px">photo_camera</span>
    </div>
    <div id="forum-compose-editor"></div>
  ` : '';

  contentEl.innerHTML = composeBar + (
    posts.length === 0
      ? `<div class="forum-empty">
           <span class="mi forum-empty-icon">forum</span>
           <p class="forum-empty-text">${enrolled ? '暂无帖子，来发第一个吧' : '暂无帖子'}</p>
         </div>`
      : `<div class="forum-stream">${posts.map(p => renderForumPostRow(p, enrolled, favoritePostIds)).join('')}</div>`
  );

  // ---- 事件绑定（绕过 window 注册问题） ----
  bindForumEvents(contentEl, courseId, enrolled);

  // 定位目标帖子（通知跳转）
  const targetId = window._courseDetailTargetPostId;
  if (targetId) {
    const postEl = document.getElementById(`forum-post-${targetId}`);
    if (postEl) {
      postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 自动展开评论
      setTimeout(() => {
        const tk = getOrCreateComments(targetId);
        if (tk) {
          const section = document.getElementById(`forum-comments-${targetId}`);
          if (section) section.style.display = '';
          tk.init();
          // 滚动到目标评论
          const scrollCid = window._courseDetailScrollToCommentId;
          if (scrollCid) {
            setTimeout(() => scrollToTkComment(scrollCid), 600);
          }
        }
      }, 400);
    }
    window._courseDetailTargetPostId = null;
    window._courseDetailScrollToCommentId = null;
  }
}

/* ---- 事件绑定（渲染后 addEventListener，不依赖 window） ---- */

function bindForumEvents(root, courseId, enrolled) {
  // compose bar
  const composeBar = root.querySelector('#forum-compose-bar');
  if (composeBar) {
    composeBar.addEventListener('click', () => openForumCompose());
  }

  // 用事件委托处理所有 forum 内部点击
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const postId = Number(btn.dataset.postId);
    const likeKey = btn.dataset.likeKey;

    switch (action) {
      case 'forum-reply-post': {
        const tk = getOrCreateComments(postId);
        if (!tk) break;
        const section = document.getElementById(`forum-comments-${postId}`);
        if (section && section.style.display === 'none') {
          section.style.display = '';
          await tk.init();
          updatePostCommentCount(postId);
        }
        setTimeout(() => {
          document.getElementById(`comment-main-input-${postId}`)?.focus();
        }, 200);
        break;
      }

      case 'forum-toggle-comments': {
        const section = document.getElementById(`forum-comments-${postId}`);
        if (!section) break;
        if (section.style.display !== 'none') {
          section.style.display = 'none';
        } else {
          section.style.display = '';
          const tk = getOrCreateComments(postId);
          if (!tk._initialized) {
            await tk.init();
            tk._initialized = true;
            updatePostCommentCount(postId);
          }
        }
        break;
      }

      case 'like': {
        const state = _forumLikeState[likeKey] || { liked: false, count: 0 };
        state.liked = !state.liked;
        state.count += state.liked ? 1 : -1;
        if (state.count < 0) state.count = 0;
        _forumLikeState[likeKey] = state;
        btn.classList.toggle('liked', state.liked);
        const icon = btn.querySelector('.mi');
        if (icon) icon.textContent = state.liked ? 'favorite' : 'favorite_border';
        const wrapper = btn.closest('.forum-like-col');
        const countEl = wrapper?.querySelector('.forum-like-count');
        if (countEl) countEl.textContent = state.count;
        break;
      }

      case 'navigate-profile':
        navigateTo('profile-user', Number(btn.dataset.userId));
        break;

      case 'delete-post':
        openModal('确认删除', `<p style="margin-bottom:24px">确定要删除这篇帖子吗？所有回复也将一并删除，且无法恢复</p><div class="inline-btn-group" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" id="confirm-forum-post-delete" style="background:var(--md-error,#e53935)">删除</button></div>`);
        document.getElementById('confirm-forum-post-delete')?.addEventListener('click', async () => {
          const result = await apiDelete(`/api/courses/posts/${postId}`);
          if (result.error) { showToast(result.error); return; }
          closeModal();
          const postEl = document.getElementById(`forum-post-${postId}`);
          if (postEl) {
            const tk = _tkCommentsInstances.get(postId);
            if (tk) { tk.destroy(); _tkCommentsInstances.delete(postId); }
            postEl.remove();
          }
          showToast('已删除');
        });
        break;

      // 评论内部操作（回复/点赞/删除/@提及）由 TkComments._bindEvents() 处理
    }
  });
}

function renderForumPostRow(p, enrolled, favoritePostIds) {
  const likeKey = `p${p.id}`;
  const like = _forumLikeState[likeKey] || { liked: false, count: 0 };
  const avatarLetter = (p.author_name || '?')[0].toUpperCase();
  const isSelf = !!(window._currentUser && Number(p.author_id) === Number(window._currentUser.id));
  const profileAttrs = isSelf ? '' : 'data-action="navigate-profile" data-user-id="' + p.author_id + '"';
  const images = (p.attachments || []).filter(a => a.file_type === 'image');
  const files = (p.attachments || []).filter(a => a.file_type !== 'image');

  return `
    <div class="forum-post-row" id="forum-post-${p.id}">
      <div class="forum-avatar-col">
        ${p.author_avatar_url
          ? `<img class="forum-avatar" src="${p.author_avatar_url}" alt="" ${profileAttrs} style="cursor:${isSelf ? 'default' : 'pointer'}">`
          : `<div class="forum-avatar-letter" ${profileAttrs} style="cursor:${isSelf ? 'default' : 'pointer'}">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-content-col">
        <div class="forum-post-header">
          <div class="forum-post-meta">
            ${isSelf
              ? `<span class="forum-post-name" style="font-weight:600">${escHtml(p.author_name)}</span>`
              : `<button class="forum-post-name" data-action="navigate-profile" data-user-id="${p.author_id}">${escHtml(p.author_name)}</button>`
            }
            <span class="forum-post-time">${formatTime(p.created_at)}</span>
          </div>
          <div class="forum-like-col">
            <button class="forum-like-btn${like.liked ? ' liked' : ''}" data-action="like" data-like-key="${likeKey}">
              <span class="mi" style="font-size:18px;pointer-events:none">${like.liked ? 'favorite' : 'favorite_border'}</span>
            </button>
            <span class="forum-like-count">${like.count}</span>
          </div>
        </div>
        ${p.title ? `<h3 class="forum-post-title">${escHtml(p.title)}</h3>` : ''}
        ${p.content ? `<p class="forum-post-text">${escHtml(p.content)}</p>` : ''}
        ${images.length > 0 ? `
          <div class="forum-image-grid count-${images.length}">
            ${images.map(a => `
              <a href="${a.view_url}" target="_blank" rel="noopener" class="forum-image-link">
                <img src="${a.view_url}" alt="${escHtml(a.file_name)}" loading="lazy">
              </a>
            `).join('')}
          </div>
        ` : ''}
        ${files.length > 0 ? `
          <div class="forum-attachment-list">
            ${files.map(a => `
              <a class="forum-attachment-row" href="${a.download_url}">
                <span class="mi" style="font-size:14px">attach_file</span>
                <span>${escHtml(a.file_name)}</span>
                <span style="color:var(--md-on-surface-variant)">${formatFileSize(a.file_size)}</span>
              </a>
            `).join('')}
          </div>
        ` : ''}
        ${enrolled ? `
          <div class="forum-actions">
            <button class="forum-action-btn" data-action="forum-reply-post" data-post-id="${p.id}">
              <span class="mi" style="font-size:16px">chat_bubble_outline</span> 回复
            </button>
            <button class="forum-action-btn" data-action="forum-toggle-comments" data-post-id="${p.id}">
              <span class="mi" style="font-size:16px">forum</span> ${p.comment_count || 0} 回复
            </button>
            ${renderPostFavoriteButton(p.id, favoritePostIds.has(p.id))}
            ${window._currentUser && p.author_id === window._currentUser.id ? `<button class="forum-action-btn" data-action="delete-post" data-post-id="${p.id}" style="color:var(--md-error)"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
          </div>
        ` : `
          <div class="forum-actions">
            <span style="font-size:12px;color:var(--md-on-surface-variant)">
              <span class="mi" style="font-size:14px;vertical-align:-2px">chat_bubble_outline</span> ${p.comment_count || 0} 回复
            </span>
          </div>
        `}

        <div id="forum-comments-${p.id}" style="display:none"></div>
      </div>
    </div>
  `;
}

/* ---- 评论区展开/收起 ---- */

/* ---- 向后兼容桩（供 my_courses.js / 旧 window 引用） ---- */

export async function toggleComments(postId) {
  // 兼容旧调用 → 触发 forum-toggle-comments
  const btn = document.querySelector(`[data-action="forum-toggle-comments"][data-post-id="${postId}"]`);
  if (btn) btn.click();
}

export async function handleAddComment(e, postId) {
  // 兼容旧调用 → 触发 forum-reply-post
  const btn = document.querySelector(`[data-action="forum-reply-post"][data-post-id="${postId}"]`);
  if (btn) btn.click();
}

export function toggleForumLike(id, type, el) {
  // 已废弃 — 评论点赞由 TkComments 服务端接管，帖子点赞由 bindForumEvents 处理
}

export function autoResizeForumTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ---- 帖子创作（行内 compose） ---- */

const _forumComposeImages = { files: [], urls: [] };

export async function focusForumCompose(courseId) {
  // 确保在论坛 tab
  if (window._courseDetail.activeTab !== 'forum') {
    await switchDetailTab('forum', courseId);
  }
  // 滚动到顶部并打开 compose
  const bar = document.getElementById('forum-compose-bar');
  if (bar) {
    bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => openForumCompose(), 300);
  }
}

export function openForumCompose() {
  const bar = document.getElementById('forum-compose-bar');
  const editor = document.getElementById('forum-compose-editor');
  if (!bar || !editor) return;

  // 隐藏 compose bar，展开编辑器
  bar.style.display = 'none';
  _forumComposeImages.files = [];
  _forumComposeImages.urls = [];

  editor.innerHTML = `
    <div class="forum-compose-expanded">
      <div class="forum-compose-header">
        <span style="font-size:var(--text-base);font-weight:600">发布新帖</span>
        <button class="forum-action-btn" onclick="closeForumCompose()">
          <span class="mi" style="font-size:18px">close</span>
        </button>
      </div>
      <div class="md-input-group" style="margin-bottom:8px">
        <input class="md-input" id="forum-compose-title" placeholder=" " style="font-family:inherit!important">
        <label class="md-label">标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>标题</span></legend></fieldset>
      </div>
      <textarea class="forum-compose-textarea" id="forum-compose-content"
        placeholder=" " rows="3" oninput="autoResizeForumTextarea(this)"></textarea>
      <div class="forum-compose-preview-grid" id="forum-compose-previews"></div>
      <div class="forum-compose-footer">
        <input type="file" id="forum-compose-files" accept="image/jpeg,image/png,image/gif,image/webp"
          multiple style="display:none" onchange="handleForumComposeImageChange()">
        <button class="forum-action-btn" onclick="document.getElementById('forum-compose-files').click()">
          <span class="mi" style="font-size:18px">photo_camera</span> 图片
        </button>
        <span id="forum-compose-count" style="font-size:12px;color:var(--md-on-surface-variant)"></span>
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-compact" id="forum-compose-submit" onclick="submitForumPost()">
          <span class="mi">send</span> 发布
        </button>
      </div>
    </div>
  `;

  setTimeout(() => {
    document.getElementById('forum-compose-title')?.focus();
  }, 100);
}

export function closeForumCompose() {
  const bar = document.getElementById('forum-compose-bar');
  const editor = document.getElementById('forum-compose-editor');
  if (bar) bar.style.display = '';
  if (editor) editor.innerHTML = '';
  _forumComposeImages.urls.forEach(u => URL.revokeObjectURL(u));
  _forumComposeImages.files = [];
  _forumComposeImages.urls = [];
}

export function handleForumComposeImageChange() {
  const input = document.getElementById('forum-compose-files');
  if (!input || !input.files.length) return;

  const remaining = 9 - _forumComposeImages.files.length;
  if (remaining <= 0) { showToast('最多 9 张图片'); input.value = ''; return; }

  Array.from(input.files).slice(0, remaining).forEach(file => {
    if (!file.type.startsWith('image/')) { showToast('仅支持图片文件'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast(`${file.name} 超过 20MB`); return; }
    _forumComposeImages.files.push(file);
    _forumComposeImages.urls.push(URL.createObjectURL(file));
  });
  input.value = '';
  renderForumComposePreviews();
}

function renderForumComposePreviews() {
  const container = document.getElementById('forum-compose-previews');
  const countEl = document.getElementById('forum-compose-count');
  if (!container) return;
  if (countEl) countEl.textContent = _forumComposeImages.files.length > 0 ? `${_forumComposeImages.files.length}/9` : '';

  container.innerHTML = _forumComposeImages.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="removeForumComposeImage(${i})">×</button>
    </div>
  `).join('');
}

export function removeForumComposeImage(index) {
  URL.revokeObjectURL(_forumComposeImages.urls[index]);
  _forumComposeImages.files.splice(index, 1);
  _forumComposeImages.urls.splice(index, 1);
  renderForumComposePreviews();
}

export async function submitForumPost() {
  const titleEl = document.getElementById('forum-compose-title');
  const contentEl = document.getElementById('forum-compose-content');
  const title = titleEl?.value.trim();
  const content = contentEl?.value.trim();

  if (!title) { showToast('请输入标题'); titleEl?.focus(); return; }
  if (!content) { showToast('请输入内容'); contentEl?.focus(); return; }

  // 每日上限
  if (_forumDailyCount >= 100) { showToast('今日发布额度已达上限'); return; }

  const btn = document.getElementById('forum-compose-submit');
  if (btn) { btn.disabled = true; btn.textContent = '发布中...'; }

  try {
    const { courseId } = window._courseDetail;
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    _forumComposeImages.files.forEach(f => formData.append('files', f));

    const { getToken } = await import('../../core/api.js');
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/courses/${courseId}/posts`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      showToast(result.error);
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="mi">send</span> 发布'; }
      return;
    }

    _forumDailyCount++;
    closeForumCompose();
    showToast('发布成功');

    // 刷新论坛
    const contentEl2 = document.getElementById('detail-tab-content');
    const { enrolled } = window._courseDetail;
    if (contentEl2) await renderForumTab(contentEl2, courseId, enrolled);

  } catch {
    showToast('网络错误，请重试');
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="mi">send</span> 发布'; }
  }
}

/* =============================================
   资料标签页
   ============================================= */

async function renderMaterialsTab(contentEl, courseId, enrolled) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  await loadMaterials(contentEl, courseId, enrolled);
}

async function loadMaterials(contentEl, courseId, enrolled, opts = {}) {
  const params = new URLSearchParams();
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
  if (opts.chapter) params.set('chapter', opts.chapter);
  if (opts.sort) params.set('sort', opts.sort);

  const data = await apiGet(`/api/materials/courses/${courseId}?${params.toString()}`);
  const materials = data?.materials || [];
  const categories = ['全部', '课件', '笔记', '作业', '真题', '其他'];

  const uploadBtn = enrolled
    ? `<button class="btn btn-primary" onclick="openUploadMaterialModal(${courseId})"><span class="mi">upload</span> 上传资料</button>`
    : '';

  contentEl.innerHTML = `
    <div class="material-filter-bar">
      ${createMdSelect({
        id: 'detail-mat-category',
        options: categories.map(c => ({ text: c, value: c === '全部' ? 'all' : c })),
        style: 'width:120px;margin-bottom:0'
      })}
      ${createMdSelect({
        id: 'detail-mat-sort',
        options: [
          { text: '最新上传', value: 'newest' },
          { text: '评分最高', value: 'rating' },
          { text: '下载最多', value: 'downloads' }
        ],
        style: 'width:130px;margin-bottom:0'
      })}
      ${createMdInput({
        id: 'detail-mat-chapter',
        label: '按章节搜索',
        style: 'flex:1;margin-bottom:0',
        placeholder: ' ',
        attrs: `onkeydown="if(event.key==='Enter'){event.preventDefault();refreshMyMaterials(${courseId})}"`
      })}
      <button class="btn btn-primary" onclick="refreshMyMaterials(${courseId})"><span class="mi">search</span></button>
      ${uploadBtn}
    </div>
    <div id="detail-materials-list">
      ${renderMaterialsList(materials, courseId, enrolled)}
    </div>
  `;

  // 绑定资料筛选下拉事件
  document.getElementById('detail-mat-category-container')?.addEventListener('md-select-change', () => refreshMyMaterials(courseId));
  document.getElementById('detail-mat-sort-container')?.addEventListener('md-select-change', () => refreshMyMaterials(courseId));

  const cards = contentEl.querySelectorAll('.material-card');
  if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
}

function renderMaterialsList(materials, courseId, enrolled) {
  if (materials.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">folder_open</span>
        <p class="text-secondary" style="margin-top:12px">${enrolled ? '暂无资料，来上传第一份吧' : '暂无资料'}</p>
      </div>
    `;
  }

  const typeIcons = { pdf: 'picture_as_pdf', ppt: 'slideshow', doc: 'description', image: 'image', other: 'insert_drive_file' };
  const typeColors = { pdf: '#e53935', ppt: '#FB8C00', doc: '#1E88E5', image: '#43A047', other: '#757575' };

  return materials.map(m => `
    <div class="card material-card">
      <div class="material-card-inner">
        <div class="material-icon" style="color:${typeColors[m.file_type] || typeColors.other}">
          <span class="mi" style="font-size:34px">${typeIcons[m.file_type] || typeIcons.other}</span>
          <span style="font-size:10px;text-transform:uppercase">${m.file_type}</span>
        </div>
        <div class="material-card-body">
          <div class="material-card-title">${escHtml(m.title)}</div>
          ${m.description ? `<div class="material-card-desc">${escHtml(m.description)}</div>` : ''}
          <div style="margin-top:8px">
            <div class="material-meta-row">
              ${m.chapter ? `<span class="material-meta-item"><span class="mi">bookmark</span> ${escHtml(m.chapter)}</span>` : ''}
              <span class="material-meta-item"><span class="mi">category</span> ${escHtml(m.category)}</span>
              <span class="material-meta-item"><span class="mi">person</span> <button class="user-profile-link" onclick="navigateTo('profile-user', ${m.uploader_id})">${escHtml(m.uploader_name)}</button></span>
            </div>
            <div class="material-meta-row">
              <span class="material-meta-item"><span class="mi">straighten</span> ${formatFileSize(m.file_size)}</span>
              <span class="material-meta-item material-download-count">下载 ${m.download_count}</span>
            </div>
          </div>
          ${enrolled ? `
            <div class="material-stars-row">
              ${renderStars(m.avg_rating, m.id)}
              <span class="material-stars-label">${m.rating_count > 0 ? m.avg_rating.toFixed(1) + ' 分' : '暂无评分'}</span>
            </div>
          ` : ''}
        </div>
        <div class="material-card-actions">
          <a href="/api/materials/${m.id}/download" class="btn btn-primary">
            <span class="mi">download</span> 下载
          </a>
          ${enrolled && m.uploader_id === window._currentUser?.id ? `<button class="btn btn-secondary" onclick="deleteMyMaterial(${m.id}, ${courseId})"><span class="mi">delete</span> 删除</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderStars(avgRating, materialId) {
  let html = '<div class="stars-row">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(avgRating) ? 'star' : 'star_border';
    html += `<span class="mi star-icon" style="font-size:18px;cursor:pointer;color:${i <= Math.round(avgRating) ? '#FB8C00' : 'var(--md-outline-variant)'}" onclick="rateMyMaterial(${materialId}, ${i})">${filled}</span>`;
  }
  html += '</div>';
  return html;
}

export async function rateMyMaterial(materialId, rating) {
  if (!window._currentUser) {
    showToast('请先登录后再评分');
    return;
  }
  const result = await apiPost(`/api/materials/${materialId}/rate`, { rating });
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast(`评分成功 (${result.avg_rating} 分)`);
  const { courseId, enrolled } = window._courseDetail;
  const contentEl = document.getElementById('detail-tab-content');
  if (contentEl && courseId) await loadMaterials(contentEl, courseId, enrolled);
}

export async function refreshMyMaterials(courseId) {
  const category = document.getElementById('detail-mat-category')?.value || 'all';
  const chapter = document.getElementById('detail-mat-chapter')?.value || '';
  const sort = document.getElementById('detail-mat-sort')?.value || 'newest';
  const contentEl = document.getElementById('detail-tab-content');
  const { enrolled } = window._courseDetail;
  if (contentEl) await loadMaterials(contentEl, courseId, enrolled, { category, chapter, sort });
}

export async function deleteMyMaterial(materialId, courseId) {
  if (!confirm('确定删除这份资料？')) return;
  const result = await apiDelete(`/api/materials/${materialId}`);
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast('删除成功');
  const contentEl = document.getElementById('detail-tab-content');
  const { enrolled } = window._courseDetail;
  if (contentEl) await loadMaterials(contentEl, courseId, enrolled);
}

export function openUploadMaterialModal(courseId) {
  const categories = ['课件', '笔记', '作业', '真题', '其他'];
  const html = `
    <form id="upload-material-form" onsubmit="handleUploadMaterial(event, ${courseId})" style="display:flex;flex-direction:column;gap:16px">
      <div id="upload-drop-zone" class="upload-drop-zone">
        <span class="mi" style="font-size:36px;color:var(--md-outline-variant)">cloud_upload</span>
        <p style="margin-top:8px;color:var(--md-on-surface-variant);font-size:14px">点击选择文件或拖拽到此处</p>
        <p style="font-size:12px;color:var(--md-outline)">支持 PDF、PPT、Word、图片，最大 20MB</p>
        <input type="file" id="upload-file-input" style="display:none" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp" onchange="onFileSelected(this)">
        <p id="upload-file-name" style="display:none;font-size:14px;font-weight:500;color:var(--md-primary);margin-top:8px"></p>
      </div>
      <div class="md-input-group">
        <input class="md-input" name="title" placeholder=" " required>
        <label class="md-label">资料标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>资料标题</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" name="description" placeholder=" ">
        <label class="md-label">描述（可选）</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>描述（可选）</span></legend></fieldset>
      </div>
      <div style="display:flex;gap:12px">
        <div class="md-input-group" style="flex:1">
          <input class="md-input" name="chapter" placeholder=" ">
          <label class="md-label">章节</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>章节</span></legend></fieldset>
        </div>
        <div style="flex:1">
          ${createMdSelect({
            id: 'upload-category',
            label: '分类',
            options: categories.map(c => ({ text: c, value: c })),
            selected: '其他'
          })}
        </div>
      </div>
      <div class="form-error" id="upload-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">上传</button>
    </form>
  `;
  openModal('上传资料', html);

  setTimeout(() => {
    const dropZone = document.getElementById('upload-drop-zone');
    const fileInput = document.getElementById('upload-file-input');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          onFileSelected(fileInput);
        }
      });
    }
  }, 100);
}

export function onFileSelected(input) {
  const nameEl = document.getElementById('upload-file-name');
  if (input.files.length && nameEl) {
    nameEl.textContent = '📎 ' + input.files[0].name;
    nameEl.style.display = 'block';
  }
}

export async function handleUploadMaterial(e, courseId) {
  e.preventDefault();
  const form = e.target;
  const fileInput = document.getElementById('upload-file-input');
  const errEl = document.getElementById('upload-error');

  if (!fileInput.files.length) {
    if (errEl) { errEl.textContent = '请选择文件'; errEl.style.display = 'block'; }
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('title', form.title.value.trim());
  formData.append('description', form.description.value.trim());
  formData.append('chapter', form.chapter.value.trim());
  formData.append('category', document.getElementById('upload-category')?.value || '其他');

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '上传中...';

  try {
    const { getToken } = await import('../../core/api.js');
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`/api/materials/courses/${courseId}`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
      btn.disabled = false;
      btn.textContent = '上传';
      return;
    }

    closeModal();
    showToast('上传成功');
    const contentEl = document.getElementById('detail-tab-content');
    const { enrolled } = window._courseDetail;
    if (contentEl) await loadMaterials(contentEl, courseId, enrolled);
  } catch (err) {
    if (errEl) { errEl.textContent = '上传失败'; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '上传';
  }
}

