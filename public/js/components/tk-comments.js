/**
 * components/tk-comments.js — 统一评论区 UI 工具（tk-* 标准）
 * 供 detail.js / square.js / course_square.js / my_courses.js 共用
 *
 * 标准基于 explore.js 的 TikTok 风格评论系统：
 *   - 32px 圆形头像 + 用户名 + 正文 + 操作行 + 点赞（Remix 心形图标）
 *   - 扁平化楼中楼 + "展开 N 条回复" 切换
 *   - 单行输入框 + 图片上传 + 发送按钮
 */

import { escHtml, formatTimeAgo, showToast, openModal, closeModal } from './ui.js';
import { apiGet, apiPost, apiDelete } from '../core/api.js';

/* =============================================
   楼中楼扁平化
   ============================================= */

export function flattenReplies(replies, parentAuthorName = '') {
  let flatList = [];
  for (const r of replies) {
    r._replyToName = parentAuthorName;
    flatList.push(r);
    if (r.replies && r.replies.length > 0) {
      const authorName = r.author_nickname || r.author_name || '匿名';
      flatList = flatList.concat(flattenReplies(r.replies, authorName));
    }
  }
  return flatList;
}

/* =============================================
   渲染单条评论（tk-* 标准 HTML）
   ============================================= */

/**
 * @param {Object} c       — 评论对象（已归一化字段）
 * @param {string} ctxId   — 上下文 ID（postId / courseId 等，用于 data 属性）
 * @param {number} depth   — 0=顶层, >0=子回复
 * @param {Object} opts    — 选项
 * @param {string} opts.deleteAction — 删除的 data-action 值
 * @param {string} opts.replyAction  — 回复的 data-action 值
 * @param {string} opts.likeStorageKey — localStorage key 前缀
 * @param {Set}    opts.likedSet     — 当前已点赞的评论 ID Set
 */
export function renderTkComment(c, ctxId, depth = 0, opts = {}) {
  const {
    deleteAction = 'delete-comment',
    replyAction = 'reply',
  } = opts;

  const nickname = c.author_nickname || c.author_name || '匿名';
  const avatarUrl = c.author_avatar || c.author_avatar_url || '';
  const avatarLetter = (nickname || '?')[0].toUpperCase();
  const timeStr = c.created_at ? formatTimeAgo(c.created_at) : '';
  const liked = c.is_liked !== undefined ? c.is_liked : (opts.likedSet ? opts.likedSet.has(c.id) : false);
  const replies = c.replies || [];
  const replyCount = c.reply_count || replies.length;
  const isSub = depth > 0;
  const avatarSize = isSub ? 24 : 32;

  // 身份标签：【25软工】
  const grade = c.author_grade || '';
  const major = c.author_major || '';
  const identityTag = (grade || major) ? `<span class="tk-identity">【${escHtml(grade)}${escHtml(major)}】</span>` : '';

  // @用户名高亮渲染
  const contentText = c.content || '';
  const contentHtml = contentText.replace(/@(\w+)/g, '<span class="tk-mention" data-action="mention-profile" data-username="$1">@$1</span>');

  const replyToHtml = isSub && c._replyToName
    ? `<span class="tk-reply-to">回复 <span class="tk-reply-user">${escHtml(c._replyToName)}</span>：</span>`
    : '';

  const isSelf = !!(window._currentUser && Number(c.author_id) === Number(window._currentUser.id));
  const profileAction = isSelf ? '' : `data-action="view-profile" data-user-id="${c.author_id}"`;

  // 是否还有更多二级回复（has_more_replies 后端标记）
  const hasMoreReplies = c.has_more_replies && c.more_reply_count > 0;
  const moreReplyCount = c.more_reply_count || 0;

  return `
    <div class="tk-comment-item ${isSub ? 'tk-sub-item' : ''}" id="tk-comment-${c.id}">
      <div class="tk-avatar-col ${isSelf ? '' : 'tk-clickable'}" ${profileAction}>
        ${avatarUrl
          ? `<img src="${escHtml(avatarUrl)}" class="tk-avatar" style="width:${avatarSize}px;height:${avatarSize}px" alt="">`
          : `<div class="tk-avatar-letter" style="width:${avatarSize}px;height:${avatarSize}px">${avatarLetter}</div>`}
      </div>

      <div class="tk-content-col">
        <span class="tk-username ${isSelf ? '' : 'tk-username-link'}" ${profileAction}>${identityTag}${escHtml(nickname)}</span>
        <div class="tk-text">${replyToHtml}${contentHtml}</div>
        ${c.image_url ? `<img src="${escHtml(c.image_url)}" class="tk-comment-img" alt="">` : ''}

        <div class="tk-meta-row">
          <span class="tk-time">${escHtml(timeStr)}</span>
          <span class="tk-action-btn" data-action="${replyAction}" data-comment-id="${c.id}" data-ctx-id="${ctxId}" data-author="${escHtml(nickname)}">回复</span>
          ${isSelf ? `
            <span class="tk-action-btn tk-danger" data-action="${deleteAction}" data-comment-id="${c.id}" data-ctx-id="${ctxId}">删除</span>
          ` : ''}

          <div class="tk-like-container ${liked ? 'liked' : ''}" data-action="tk-like" data-comment-id="${c.id}" data-ctx-id="${ctxId}">
            <i class="${liked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
            <span>${c.like_count || 0}</span>
          </div>
        </div>

        <div class="inline-reply-box" id="inline-reply-${c.id}">
          <div class="tk-inline-input-row">
            <input type="text" class="inline-reply-input" id="inline-reply-input-${c.id}" placeholder="回复 ${escHtml(nickname)}...">
            <label class="tk-inline-icon-btn">
              <i class="ri-image-line"></i>
              <input type="file" hidden accept="image/jpeg,image/png,image/webp" onchange="window._tkReplyHandleFiles(this,${ctxId},${c.id})">
            </label>
            <button class="tk-inline-send-btn" data-action="${replyAction}-send" data-comment-id="${c.id}" data-ctx-id="${ctxId}">发送</button>
            <button class="tk-inline-close-btn" onclick="document.getElementById('inline-reply-${c.id}').classList.remove('open')"><i class="ri-close-line"></i></button>
          </div>
          <div class="forum-editor-previews" id="inline-reply-previews-${c.id}"></div>
        </div>

        ${!isSub && replyCount > 0 ? `
          <div class="tk-replies-container${replyCount > 3 ? ' collapsed' : ''}" id="sub-list-${c.id}">
            ${flattenReplies(replies, nickname).map(r => renderTkComment(r, ctxId, 1, opts)).join('')}
          </div>
          ${replyCount > 3 ? `
            <div class="tk-view-more-replies" data-action="tk-toggle-replies" data-comment-id="${c.id}" data-ctx-id="${ctxId}">
              <span class="tk-view-more-line"></span>
              <span class="toggle-text">查看更多 ${moreReplyCount || (replyCount - 3)} 条回复</span>
              <i class="ri-arrow-down-s-line"></i>
            </div>
          ` : ''}
        ` : ''}
      </div>
    </div>
  `;
}

/* =============================================
   评论输入区 HTML（底部固定栏）
   ============================================= */

export function renderTkInputArea(ctxId, placeholder = '说点什么...') {
  const currentUser = window._currentUser || {};
  const avatarUrl = currentUser.avatar_url || '';
  const avatarLetter = (currentUser.nickname || '?')[0].toUpperCase();
  const avatarHtml = avatarUrl
    ? `<img src="${escHtml(avatarUrl)}" class="comment-input-avatar" alt="">`
    : `<div class="comment-input-avatar-letter">${avatarLetter}</div>`;
  return `
    <div class="comment-input-area">
      <div class="comment-input-row">
        ${avatarHtml}
        <div class="comment-input-wrapper">
          <textarea class="comment-main-input" id="comment-main-input-${ctxId}" placeholder="${escHtml(placeholder)}" maxlength="200" rows="1" wrap="off"></textarea>
          <label class="comment-input-img-btn" title="选择图片">
            <i class="ri-image-line"></i>
            <input type="file" style="position:absolute;width:0;height:0;opacity:0;overflow:hidden" accept="image/jpeg,image/png,image/webp" id="comment-img-input-${ctxId}" onchange="window._tkCommentHandleFiles(this,${ctxId})">
          </label>
        </div>
        <button class="comment-send-btn" id="comment-send-btn-${ctxId}">发送</button>
      </div>
      <div class="mention-popup" id="mention-popup-${ctxId}" style="display:none"></div>
      <div class="forum-editor-previews" id="comment-previews-${ctxId}"></div>
    </div>
  `;
}

/* =============================================
   通用 DOM 操作
   ============================================= */

// 模块级状态：记录已展开/已加载的子回复
const _replyToggleState = new Map(); // commentId -> { allLoaded, expanded }

export async function toggleSubReplies(commentId, apiBase) {
  const list = document.getElementById(`sub-list-${commentId}`);
  const toggleBar = document.querySelector(`[data-comment-id="${commentId}"][data-action="tk-toggle-replies"]`);
  const text = toggleBar?.querySelector('.toggle-text');
  const arrow = toggleBar?.querySelector('i');
  const ctxId = toggleBar ? Number(toggleBar.dataset.ctxId) : null;
  if (!list || !toggleBar) return;

  // 初始化状态
  if (!_replyToggleState.has(commentId)) {
    _replyToggleState.set(commentId, { allLoaded: false, expanded: false });
  }
  const state = _replyToggleState.get(commentId);
  const total = list.children.length;
  const hidden = Math.max(0, total - 3);

  if (!state.allLoaded && hidden === 0) {
    // 首次点击：加载全部剩余回复
    if (!apiBase || !ctxId) return;
    try {
      const replies = await apiGet(`${apiBase}/${ctxId}/comments/${commentId}/replies`);
      if (replies && replies.length > 0) {
        const opts = { likedSet: getLikedSet('tk_liked_comments'), deleteAction: 'delete-comment', replyAction: 'reply' };
        const parentItem = list.closest('.tk-content-col');
        const parentNameEl = parentItem?.querySelector('.tk-username');
        const parentName = parentNameEl?.textContent?.replace(/【.*】/, '').trim() || '';
        list.innerHTML = flattenReplies(replies, parentName).map(r => renderTkComment(r, ctxId, 1, opts)).join('');
      }
      state.allLoaded = true;
      state.expanded = true;
      list.classList.remove('collapsed');
      if (text) text.textContent = '收起回复';
      if (arrow) arrow.className = 'ri-arrow-up-s-line';
    } catch { showToast('加载回复失败'); return; }
  } else if (state.expanded || (!state.allLoaded && hidden > 0)) {
    // 收起
    state.allLoaded = true;
    state.expanded = false;
    list.classList.add('collapsed');
    const newHidden = list.children.length - 3;
    if (text) text.textContent = `查看更多 ${newHidden} 条回复`;
    if (arrow) arrow.className = 'ri-arrow-down-s-line';
  } else {
    // 展开
    state.expanded = true;
    list.classList.remove('collapsed');
    if (text) text.textContent = '收起回复';
    if (arrow) arrow.className = 'ri-arrow-up-s-line';
  }
}

export function toggleInlineReply(commentId, authorName) {
  const box = document.getElementById(`inline-reply-${commentId}`);
  if (!box) return;
  const isOpen = box.classList.contains('open');
  document.querySelectorAll('.inline-reply-box.open').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    box.classList.add('open');
    const input = box.querySelector('.inline-reply-input');
    if (input) { input.placeholder = `回复 @${authorName}...`; input.value = ''; setTimeout(() => input.focus(), 100); }
  }
}

/* =============================================
   点赞（localStorage 持久化）
   ============================================= */

export function getLikedSet(storageKey) {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  } catch {
    return new Set();
  }
}

export async function toggleLike(commentId, storageKey, apiBase, ctxId, container) {
  const likedSet = getLikedSet(storageKey);
  // 限定搜索范围（避免全局冲突）
  const scope = container || document;
  const btn = scope.querySelector(`[data-comment-id="${commentId}"][data-action="tk-like"]`);
  if (!btn) return { liked: false, like_count: 0 };
  const wasLiked = likedSet.has(commentId);
  const icon = btn.querySelector('i');
  const countSpan = btn.querySelector('span');
  let count = parseInt(countSpan?.textContent || '0');

  // 乐观更新 DOM
  if (wasLiked) {
    likedSet.delete(commentId);
    count = Math.max(0, count - 1);
    if (icon) icon.className = 'ri-heart-line';
    btn.classList.remove('liked');
  } else {
    likedSet.add(commentId);
    count++;
    if (icon) icon.className = 'ri-heart-fill';
    btn.classList.add('liked');
  }
  if (countSpan) countSpan.textContent = count;
  try { localStorage.setItem(storageKey, JSON.stringify([...likedSet])); } catch {}
  const newState = { liked: !wasLiked, like_count: count };

  // 后端同步
  if (apiBase && ctxId) {
    try {
      const token = localStorage.getItem('kedazi_token');
      const method = wasLiked ? 'DELETE' : 'POST';
      const res = await fetch(`${apiBase}/${ctxId}/comments/${commentId}/like`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('like failed');
    } catch {
      // 回滚 DOM
      if (wasLiked) {
        likedSet.add(commentId);
        count++;
        if (icon) icon.className = 'ri-heart-fill';
        btn.classList.add('liked');
      } else {
        likedSet.delete(commentId);
        count = Math.max(0, count - 1);
        if (icon) icon.className = 'ri-heart-line';
        btn.classList.remove('liked');
      }
      if (countSpan) countSpan.textContent = count;
      try { localStorage.setItem(storageKey, JSON.stringify([...likedSet])); } catch {}
      showToast('网络错误，点赞失败');
      return { liked: wasLiked, like_count: count };
    }
  }
  return newState;
}

/* =============================================
   图片预览管理
   ============================================= */

const _tkImages = {}; // { ctxId: { files, urls } }
const _tkReplyImages = {}; // { commentId: { files, urls } }

export function getTkImages(ctxId) {
  if (!_tkImages[ctxId]) _tkImages[ctxId] = { files: [], urls: [] };
  return _tkImages[ctxId];
}

export function getTkReplyImages(commentId) {
  if (!_tkReplyImages[commentId]) _tkReplyImages[commentId] = { files: [], urls: [] };
  return _tkReplyImages[commentId];
}

export function clearTkImages(ctxId) {
  const state = _tkImages[ctxId];
  if (state) { state.urls.forEach(u => URL.revokeObjectURL(u)); }
  _tkImages[ctxId] = { files: [], urls: [] };
}

export function clearTkReplyImages(commentId) {
  const state = _tkReplyImages[commentId];
  if (state) { state.urls.forEach(u => URL.revokeObjectURL(u)); }
  delete _tkReplyImages[commentId];
}

const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_ALLOW_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function addTkImages(ctxId, files, maxFiles, maxSize, toastFn) {
  const state = getTkImages(ctxId);
  const remaining = maxFiles - state.files.length;
  if (remaining <= 0) { if (toastFn) toastFn(`最多只能添加 ${maxFiles} 张图片`); return; }
  for (const file of Array.from(files).slice(0, remaining)) {
    if (!IMAGE_ALLOW_TYPES.includes(file.type)) { if (toastFn) toastFn('仅支持 JPG/PNG/WebP 格式'); continue; }
    if (file.size > IMAGE_MAX_SIZE) { if (toastFn) toastFn('图片不能超过 5MB'); continue; }
    state.files.push(file);
    state.urls.push(URL.createObjectURL(file));
  }
}

export function addTkReplyImages(commentId, files, maxFiles, maxSize, toastFn) {
  const state = getTkReplyImages(commentId);
  const remaining = maxFiles - state.files.length;
  if (remaining <= 0) { if (toastFn) toastFn(`最多只能添加 ${maxFiles} 张图片`); return; }
  for (const file of Array.from(files).slice(0, remaining)) {
    if (!IMAGE_ALLOW_TYPES.includes(file.type)) { if (toastFn) toastFn('仅支持 JPG/PNG/WebP 格式'); continue; }
    if (file.size > IMAGE_MAX_SIZE) { if (toastFn) toastFn('图片不能超过 5MB'); continue; }
    state.files.push(file);
    state.urls.push(URL.createObjectURL(file));
  }
}

export function removeTkImage(ctxId, index) {
  const state = getTkImages(ctxId);
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files.splice(index, 1);
  state.urls.splice(index, 1);
}

export function removeTkReplyImage(commentId, index) {
  const state = getTkReplyImages(commentId);
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files.splice(index, 1);
  state.urls.splice(index, 1);
}

export function renderTkPreviews(ctxId) {
  const el = document.getElementById(`comment-previews-${ctxId}`);
  if (!el) return;
  const state = getTkImages(ctxId);
  if (state.urls.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = state.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="window._tkRemoveImage(${ctxId},${i})">&times;</button>
    </div>
  `).join('');
}

export function renderTkReplyPreviews(commentId) {
  const el = document.getElementById(`inline-reply-previews-${commentId}`);
  if (!el) return;
  const state = getTkReplyImages(commentId);
  if (state.urls.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = state.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="window._tkRemoveReplyImage(${commentId},${i})">&times;</button>
    </div>
  `).join('');
}

/* =============================================
   事件委托绑定
   ============================================= */

/**
 * 绑定评论区通用事件（回复/删除/点赞/展开子回复）
 * @param {HTMLElement} el      — 评论区容器
 * @param {Object} callbacks    — { onReply, onDelete, onLike, onSubmitReply, onToggleSub }
 */
export function bindTkCommentEvents(el, callbacks = {}) {
  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const cid = Number(btn.dataset.commentId);
    const ctxId = Number(btn.dataset.ctxId);

    switch (action) {
      case 'tk-reply':
      case 'reply':
        toggleInlineReply(cid, btn.dataset.author);
        break;
      case 'tk-reply-send':
      case 'reply-send':
        if (callbacks.onSubmitReply) callbacks.onSubmitReply(ctxId, cid);
        break;
      case 'tk-toggle-replies':
        toggleSubReplies(cid, callbacks.likeApiBase || '/api/courses/posts');
        break;
      case 'tk-like':
        if (callbacks.onLike) callbacks.onLike(cid);
        else toggleLike(cid, 'tk_liked_comments', callbacks.likeApiBase, callbacks.likeCtxId);
        break;
      case 'tk-delete-comment':
      case 'delete-comment':
        if (callbacks.onDelete) callbacks.onDelete(ctxId, cid);
        break;
      case 'mention-profile':
        if (callbacks.onNavigateProfile) {
          const username = btn.dataset.username;
          if (username) callbacks.onNavigateProfile(username);
        }
        break;
      case 'view-profile': {
        const userId = Number(btn.dataset.userId);
        if (userId && callbacks.onNavigateProfile) callbacks.onNavigateProfile(userId);
        break;
      }
    }
  });
}

/* =============================================
   全局文件处理（供 inline onchange/onclick 调用）
   ============================================= */

window._tkCommentHandleFiles = function(input, ctxId) {
  addTkImages(ctxId, input.files, 1, IMAGE_MAX_SIZE, (msg) => {
    showToast(msg);
  });
  input.value = '';
  renderTkPreviews(ctxId);
};

window._tkRemoveImage = function(ctxId, index) {
  removeTkImage(ctxId, index);
  renderTkPreviews(ctxId);
};

window._tkReplyHandleFiles = function(input, ctxId, commentId) {
  addTkReplyImages(commentId, input.files, 1, IMAGE_MAX_SIZE, (msg) => {
    showToast(msg);
  });
  input.value = '';
  renderTkReplyPreviews(commentId);
};

window._tkRemoveReplyImage = function(commentId, index) {
  removeTkReplyImage(commentId, index);
  renderTkReplyPreviews(commentId);
};

/* =============================================
   骨架屏渲染
   ============================================= */

export function renderSkeletonComments(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="tk-skeleton-item">
      <div class="tk-skeleton-avatar"></div>
      <div class="tk-skeleton-body">
        <div class="tk-skeleton-line" style="width:40%"></div>
        <div class="tk-skeleton-line" style="width:75%"></div>
        <div class="tk-skeleton-line" style="width:55%"></div>
      </div>
    </div>
  `).join('');
}

/* =============================================
   MentionPopup — @ 提及好友选择弹窗
   ============================================= */

export class MentionPopup {
  constructor(inputEl, ctxId) {
    this.input = inputEl;
    this.ctxId = ctxId;
    this.el = document.getElementById(`mention-popup-${ctxId}`);
    this.visible = false;
    this.friends = [];
    this.selectedIdx = 0;
    this.atStartPos = 0;
    this._boundKeydown = this._onKeydown.bind(this);
  }

  async show(query) {
    if (!this.el) return;
    try {
      const data = await apiGet(`/api/user/friends?q=${encodeURIComponent(query)}&limit=10`);
      this.friends = data.friends || [];
    } catch {
      this.friends = [];
    }
    if (this.friends.length === 0) { this.hide(); return; }

    this.selectedIdx = 0;
    this.el.innerHTML = this.friends.map((f, i) => `
      <div class="mention-popup-item ${i === 0 ? 'active' : ''}" data-index="${i}" data-username="${escHtml(f.username)}">
        ${f.avatar_url
          ? `<img src="${escHtml(f.avatar_url)}" class="mention-popup-avatar" alt="">`
          : `<div class="mention-popup-avatar-letter">${(f.nickname || f.username || '?')[0].toUpperCase()}</div>`}
        <div class="mention-popup-info">
          <span class="mention-popup-name">${escHtml(f.nickname || f.username)}</span>
          <span class="mention-popup-detail">${escHtml(f.grade || '')}${escHtml(f.major || '')}</span>
        </div>
      </div>
    `).join('');

    this.el.style.display = 'block';
    this.visible = true;
    this.input.addEventListener('keydown', this._boundKeydown);

    // 点击选择
    this.el.querySelectorAll('.mention-popup-item').forEach(item => {
      item.addEventListener('click', () => this._selectFriend(item.dataset.username));
    });
  }

  hide() {
    if (this.el) this.el.style.display = 'none';
    this.visible = false;
    this.friends = [];
    this.selectedIdx = 0;
    this.input.removeEventListener('keydown', this._boundKeydown);
  }

  _onKeydown(e) {
    if (!this.visible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIdx = Math.min(this.friends.length - 1, this.selectedIdx + 1);
      this._updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIdx = Math.max(0, this.selectedIdx - 1);
      this._updateHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.friends[this.selectedIdx]) {
        this._selectFriend(this.friends[this.selectedIdx].username);
      }
    } else if (e.key === 'Escape') {
      this.hide();
    }
  }

  _updateHighlight() {
    if (!this.el) return;
    this.el.querySelectorAll('.mention-popup-item').forEach((item, i) => {
      item.classList.toggle('active', i === this.selectedIdx);
    });
  }

  _selectFriend(username) {
    const before = this.input.value.slice(0, this.atStartPos);
    const after = this.input.value.slice(this.input.selectionStart);
    this.input.value = before + '@' + username + ' ' + after;
    this.hide();
    this.input.focus();
  }

  setAtPos(pos) { this.atStartPos = pos; }
}

/* =============================================
   TkComments — 统一评论控制器
   ============================================= */

export class TkComments {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '/api/explore/posts';
    this.ctxId = options.ctxId;
    this.container = options.container;
    this.layout = options.layout || 'inline'; // 'sidebar' | 'inline' | 'modal'
    this.likeKey = options.likeKey || 'tk_liked_comments';
    this.onNavigateProfile = options.onNavigateProfile || null;

    this.comments = [];
    this.hasMore = true;
    this.lastCommentId = null;
    this.loading = false;
    this.likedSet = getLikedSet(this.likeKey);
    this._observer = null;
    this._replyToCommentId = null;
    this._mentionPopup = null;
    this._cooldownTimer = null;
    this._cooldownKey = `comment_cooldown_${this.ctxId}`;
    // 恢复冷却状态（刷新不丢失）
    this._restoreCooldown();
  }

  async init() {
    // 渲染布局框架
    this._renderFrame();
    // 渲染骨架屏
    const listEl = this.container.querySelector('.tk-comment-list');
    if (listEl) listEl.innerHTML = renderSkeletonComments(3);
    // 加载首页评论
    await this.loadMore();
    // 绑定事件
    this._bindEvents();
    // 移动端适配
    this._setupResponsive();
  }

  _renderFrame() {
    const isSidebar = this.layout === 'sidebar';
    this.container.innerHTML = `
      <div class="${isSidebar ? 'comment-sidebar' : 'tk-comment-section'}">
        <div class="comment-section-header">
          <span class="comment-section-title">评论</span>
          <span class="comment-section-count" id="tk-comment-count-${this.ctxId}"></span>
        </div>
        <div class="tk-comment-list" id="tk-comment-list-${this.ctxId}"></div>
        <div class="tk-load-sentinel" id="tk-load-sentinel-${this.ctxId}">
          <span class="tk-load-text">加载中...</span>
        </div>
        ${this._renderInputArea()}
      </div>
    `;
  }

  _renderInputArea() {
    const placeholder = this._replyToCommentId ? '回复中...' : '说点什么...';
    const currentUser = window._currentUser || {};
    const avatarUrl = currentUser.avatar_url || '';
    const avatarLetter = (currentUser.nickname || '?')[0].toUpperCase();
    const avatarHtml = avatarUrl
      ? `<img src="${escHtml(avatarUrl)}" class="comment-input-avatar" alt="">`
      : `<div class="comment-input-avatar-letter">${avatarLetter}</div>`;
    return `
      <div class="comment-input-area">
        <div class="comment-input-row">
          ${avatarHtml}
          <div class="comment-input-wrapper">
            <textarea class="comment-main-input" id="comment-main-input-${this.ctxId}"
              placeholder="${escHtml(placeholder)}" maxlength="200" rows="1" wrap="off"></textarea>
            <label class="comment-input-img-btn" title="选择图片">
              <i class="ri-image-line"></i>
              <input type="file" style="position:absolute;width:0;height:0;opacity:0;overflow:hidden"
                accept="image/jpeg,image/png,image/webp" id="comment-img-input-${this.ctxId}"
                onchange="window._tkCommentHandleFiles(this,${this.ctxId})">
            </label>
          </div>
          <button class="comment-send-btn" id="comment-send-btn-${this.ctxId}">发送</button>
        </div>
        <div class="mention-popup" id="mention-popup-${this.ctxId}" style="display:none"></div>
        <div class="forum-editor-previews" id="comment-previews-${this.ctxId}"></div>
      </div>
    `;
  }

  async loadMore() {
    if (this.loading || !this.hasMore) return;
    this.loading = true;
    this._showLoadState();

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (this.lastCommentId) params.set('lastCommentId', this.lastCommentId.toString());

      const data = await apiGet(`${this.apiBase}/${this.ctxId}/comments?${params.toString()}`);
      this.comments.push(...(data.items || []));
      this.hasMore = data.hasMore;
      if (data.items && data.items.length > 0) {
        this.lastCommentId = data.items[data.items.length - 1].id;
      }
      // 更新评论总数
      const countEl = document.getElementById(`tk-comment-count-${this.ctxId}`);
      if (countEl && data.commentCount !== undefined) {
        countEl.textContent = data.commentCount > 0 ? `・${data.commentCount}` : '';
      }
    } catch {
      // 加载失败静默处理
    }

    this.loading = false;
    this._hideLoadState();
    this._renderList();
    this._updateSentinel();
  }

  _renderList() {
    const listEl = document.getElementById(`tk-comment-list-${this.ctxId}`);
    if (!listEl) return;

    const opts = {
      likedSet: this.likedSet,
      deleteAction: 'tk-delete-comment',
      replyAction: 'tk-reply'
    };

    listEl.innerHTML = this.comments.map(c =>
      renderTkComment(c, this.ctxId, 0, opts)
    ).join('');
  }

  _showLoadState() {
    const sentinel = document.getElementById(`tk-load-sentinel-${this.ctxId}`);
    if (sentinel) sentinel.style.display = 'flex';
  }

  _hideLoadState() {
    const sentinel = document.getElementById(`tk-load-sentinel-${this.ctxId}`);
    if (sentinel) {
      if (!this.hasMore) {
        sentinel.innerHTML = '<span class="tk-load-text">没有更多评论了</span>';
        sentinel.style.display = 'flex';
      } else {
        sentinel.style.display = 'none';
      }
    }
  }

  _updateSentinel() {
    const sentinel = document.getElementById(`tk-load-sentinel-${this.ctxId}`);
    if (!sentinel) return;
    if (this._observer) this._observer.disconnect();

    if (this.hasMore) {
      this._observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) this.loadMore();
      }, { rootMargin: '100px' });
      this._observer.observe(sentinel);
    }
  }

  _bindEvents() {
    const el = this.container;

    // 事件委托
    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const cid = Number(btn.dataset.commentId);
      const ctxId = Number(btn.dataset.ctxId);

      switch (action) {
        case 'tk-reply':
        case 'reply':
          toggleInlineReply(cid, btn.dataset.author);
          this._replyToCommentId = cid;
          this._setReplyMode(cid, btn.dataset.author);
          break;
        case 'tk-reply-send':
        case 'reply-send':
          await this._submitReply(ctxId, cid);
          break;
        case 'tk-toggle-replies':
          await this._handleToggleReplies(ctxId, cid);
          break;
        case 'tk-like':
          await this._handleLike(cid);
          break;
        case 'tk-delete-comment':
          await this._handleDelete(ctxId, cid);
          break;
        case 'mention-profile': {
          const username = btn.dataset.username;
          if (username && this.onNavigateProfile) this.onNavigateProfile(username);
          break;
        }
        case 'view-profile': {
          const userId = Number(btn.dataset.userId);
          if (userId && this.onNavigateProfile) this.onNavigateProfile(userId);
          break;
        }
      }
    });

    // 主发送按钮
    const sendBtn = document.getElementById(`comment-send-btn-${this.ctxId}`);
    if (sendBtn) sendBtn.addEventListener('click', () => this._submitMain());

    // 主输入框
    const mainInput = document.getElementById(`comment-main-input-${this.ctxId}`);
    if (mainInput) {
      mainInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!e.shiftKey) this._submitMain();
        }
      });
      mainInput.addEventListener('input', () => this._handleInput(mainInput));
    }

    // 初始化 mention popup
    this._mentionPopup = new MentionPopup(
      document.getElementById(`comment-main-input-${this.ctxId}`),
      this.ctxId
    );

    // 点击内联回复框外部时自动关闭
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.inline-reply-box.open')) {
        this.container.querySelectorAll('.inline-reply-box.open').forEach(box => box.classList.remove('open'));
      }
    });
  }

  _handleInput(textarea) {
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([\w]*)$/);

    // @提及检测
    if (atMatch) {
      this._mentionPopup.setAtPos(atMatch.index);
      this._mentionPopup.show(atMatch[1]);
    } else {
      this._mentionPopup.hide();
    }
  }

  _setReplyMode(commentId, authorName) {
    const input = document.getElementById(`comment-main-input-${this.ctxId}`);
    if (input) {
      input.placeholder = `回复 @${authorName}...`;
      input.focus();
    }
  }

  async _submitMain() {
    const input = document.getElementById(`comment-main-input-${this.ctxId}`);
    if (!input) return;
    const content = input.value.trim();
    const images = getTkImages(this.ctxId);
    const hasImage = images && images.files && images.files.length > 0;

    if (!content && !hasImage) return;
    if (content.length > 200) { showToast('评论不能超过 200 字'); return; }

    // 冷却检查
    if (this._cooldownTimer) { showToast('发送太频繁，请稍后再试'); return; }

    const sendBtn = document.getElementById(`comment-send-btn-${this.ctxId}`);
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '发送中...'; }

    try {
      const parentId = this._replyToCommentId;
      const newComment = await this._postComment(content, hasImage ? images.files[0] : null, parentId);

      // 清理
      input.value = '';
      input.placeholder = '说点什么...';
      clearTkImages(this.ctxId);
      renderTkPreviews(this.ctxId);
      this._replyToCommentId = null;
      showToast('评论成功');

      if (parentId) {
        // 回复：本地插入，避免 full reload 丢失超过3条的回复
        this._insertReplyLocally(newComment, parentId);
        this._renderList();
        // 自动展开父评论子回复
        const subList = document.getElementById(`sub-list-${parentId}`);
        if (subList) subList.style.display = 'block';
        const toggleBar = this.container.querySelector(`[data-comment-id="${parentId}"][data-action="tk-toggle-sub"]`);
        if (toggleBar) {
          toggleBar.querySelector('.toggle-text').textContent = '收起回复';
          toggleBar.querySelector('i').className = 'ri-arrow-up-s-line';
        }
      } else {
        // 顶层评论：刷新列表
        this.comments = [];
        this.lastCommentId = null;
        this.hasMore = true;
        await this.loadMore();
      }
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '发送'; }
    } catch (err) {
      if (err.retryAfter) {
        this._startCooldown(err.retryAfter);
      } else {
        showToast(err?.message || '发送失败');
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '发送'; }
      }
    }
  }

  /** 递归查找评论（含子回复），并将新回复插入其 replies 列表 */
  _insertReplyLocally(newComment, parentId) {
    const parent = this._findCommentById(parentId);
    if (parent) {
      if (!parent.replies) parent.replies = [];
      parent.replies.push(newComment);
      parent.reply_count = (parent.reply_count || 0) + 1;
      parent.has_more_replies = false;
      parent.more_reply_count = 0;
    }
  }

  /** 递归查找评论（含子回复） */
  _findCommentById(commentId) {
    const search = (list) => {
      for (const c of list) {
        if (c.id === commentId) return c;
        if (c.replies && c.replies.length > 0) {
          const found = search(c.replies);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.comments);
  }

  /** 统一处理子回复折叠/展开/加载（单按钮） */
  async _handleToggleReplies(postId, parentId) {
    if (!this._replyState) this._replyState = {};
    if (!this._replyState[parentId]) this._replyState[parentId] = { allLoaded: false, expanded: false };
    const state = this._replyState[parentId];

    const subList = document.getElementById(`sub-list-${parentId}`);
    const toggleBar = this.container.querySelector(`[data-comment-id="${parentId}"][data-action="tk-toggle-replies"]`);
    const textEl = toggleBar?.querySelector('.toggle-text');
    const arrow = toggleBar?.querySelector('i');
    if (!subList || !toggleBar) return;

    const total = subList.children.length;
    const hidden = Math.max(0, total - 3);

    if (!state.allLoaded) {
      // 首次点击：加载全部剩余回复
      try {
        const replies = await apiGet(`${this.apiBase}/${postId}/comments/${parentId}/replies`);
        if (replies && replies.length > 0) {
          const parentComment = this._findCommentById(parentId);
          if (parentComment) {
            parentComment.replies = replies;
            parentComment.has_more_replies = false;
            parentComment.more_reply_count = 0;
            parentComment.reply_count = replies.length;
          }
          const parentName = parentComment?.author_nickname || parentComment?.author_name || '';
          const opts = {
            likedSet: this.likedSet,
            deleteAction: 'tk-delete-comment',
            replyAction: 'tk-reply'
          };
          subList.innerHTML = flattenReplies(replies, parentName).map(r => renderTkComment(r, postId, 1, opts)).join('');
        }
        state.allLoaded = true;
        state.expanded = true;
        subList.classList.remove('collapsed');
        if (textEl) textEl.textContent = '收起回复';
        if (arrow) arrow.className = 'ri-arrow-up-s-line';
      } catch { showToast('加载回复失败'); return; }
    } else if (state.expanded) {
      // 收起
      state.expanded = false;
      subList.classList.add('collapsed');
      const newHidden = subList.children.length - 3;
      if (textEl) textEl.textContent = `查看更多 ${newHidden} 条回复`;
      if (arrow) arrow.className = 'ri-arrow-down-s-line';
    } else {
      // 展开
      state.expanded = true;
      subList.classList.remove('collapsed');
      if (textEl) textEl.textContent = '收起回复';
      if (arrow) arrow.className = 'ri-arrow-up-s-line';
    }
  }

  async _submitReply(ctxId, parentId) {
    const input = document.getElementById(`inline-reply-input-${parentId}`);
    if (!input) {
      console.warn('[TkComments] inline reply input not found for comment', parentId);
      return;
    }
    const content = input.value.trim();
    const images = getTkReplyImages(parentId);
    const hasImage = images && images.files && images.files.length > 0;

    if (!content && !hasImage) return;
    if (content.length > 200) { showToast('评论不能超过 200 字'); return; }

    // 冷却检查
    if (this._cooldownTimer) { showToast('发送太频繁，请稍后再试'); return; }

    const sendBtn = this.container.querySelector(`[data-comment-id="${parentId}"][data-action="tk-reply-send"]`);
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '发送中...'; }

    try {
      const newComment = await this._postComment(content, hasImage ? images.files[0] : null, parentId);

      // 清理输入框
      input.value = '';
      clearTkReplyImages(parentId);
      renderTkReplyPreviews(parentId);
      document.getElementById(`inline-reply-${parentId}`)?.classList.remove('open');
      showToast('回复成功');

      // 本地插入新回复，避免 full reload 丢失超过3条的回复
      this._insertReplyLocally(newComment, parentId);
      this._renderList();

      // 自动展开父评论的子回复
      const subList = document.getElementById(`sub-list-${parentId}`);
      if (subList) subList.style.display = 'block';
      const toggleBar = this.container.querySelector(`[data-comment-id="${parentId}"][data-action="tk-toggle-sub"]`);
      if (toggleBar) {
        const text = toggleBar.querySelector('.toggle-text');
        const arrow = toggleBar.querySelector('i');
        if (text) text.textContent = '收起回复';
        if (arrow) arrow.className = 'ri-arrow-up-s-line';
      }
    } catch (err) {
      if (err.retryAfter) {
        this._startCooldown(err.retryAfter);
      } else {
        showToast(err?.message || '发送失败');
      }
    }
  }

  async _postComment(content, imageFile, parentId) {
    const token = localStorage.getItem('kedazi_token');

    if (imageFile) {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('image', imageFile);
      if (parentId) formData.append('parent_id', String(parentId));

      const res = await fetch(`${this.apiBase}/${this.ctxId}/comments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error || '发送失败');
        if (res.status === 429 && err.retryAfter) error.retryAfter = err.retryAfter;
        throw error;
      }
      return res.json(); // 返回创建的评论对象
    } else {
      const body = { content };
      if (parentId) body.parent_id = parentId;
      const res = await apiPost(`${this.apiBase}/${this.ctxId}/comments`, body);
      if (res && res.error) {
        const error = new Error(res.error);
        if (res.retryAfter) error.retryAfter = res.retryAfter;
        throw error;
      }
      return res; // 返回创建的评论对象
    }
  }

  async _handleLike(commentId) {
    const comment = this._findCommentById(commentId);
    if (!comment) return;

    const wasLiked = comment.is_liked || this.likedSet.has(commentId);

    // 乐观更新
    if (wasLiked) {
      comment.is_liked = false;
      comment.like_count = Math.max(0, (comment.like_count || 0) - 1);
      this.likedSet.delete(commentId);
    } else {
      comment.is_liked = true;
      comment.like_count = (comment.like_count || 0) + 1;
      this.likedSet.add(commentId);
    }
    try { localStorage.setItem(this.likeKey, JSON.stringify([...this.likedSet])); } catch {}
    this._renderList();

    // 后端同步（用 api 工具函数，统一处理 401/token）
    const url = `${this.apiBase}/${this.ctxId}/comments/${commentId}/like`;
    try {
      if (wasLiked) {
        await apiDelete(url);
      } else {
        await apiPost(url, {});
      }
    } catch (err) {
      // 回滚
      if (wasLiked) {
        comment.is_liked = true;
        comment.like_count = (comment.like_count || 0) + 1;
        this.likedSet.add(commentId);
      } else {
        comment.is_liked = false;
        comment.like_count = Math.max(0, (comment.like_count || 0) - 1);
        this.likedSet.delete(commentId);
      }
      try { localStorage.setItem(this.likeKey, JSON.stringify([...this.likedSet])); } catch {}
      this._renderList();
      showToast('点赞失败，请重试');
    }
  }

  _restoreCooldown() {
    try {
      const endTime = parseInt(localStorage.getItem(this._cooldownKey) || '0');
      if (endTime > Date.now()) {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        this._startCooldown(remaining);
      }
    } catch {}
  }

  _startCooldown(seconds) {
    const sendBtn = document.getElementById(`comment-send-btn-${this.ctxId}`);
    const updateBtn = () => {
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = `重新发送(${seconds}s)`;
      }
    };
    updateBtn();
    // 持久化冷却结束时间
    try { localStorage.setItem(this._cooldownKey, String(Date.now() + seconds * 1000)); } catch {}
    this._cooldownTimer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(this._cooldownTimer);
        this._cooldownTimer = null;
        try { localStorage.removeItem(this._cooldownKey); } catch {}
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '发送'; }
      } else {
        updateBtn();
      }
    }, 1000);
  }

  async _handleDelete(ctxId, commentId) {
    if (typeof openModal !== 'function') {
      showToast('删除功能暂不可用');
      return;
    }
    openModal('删除评论', `
      <p style="text-align:center;margin-bottom:16px">确定要删除这条评论吗？此操作不可撤销。</p>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-danger" id="confirm-delete-comment">删除</button>
      </div>
    `);

    document.getElementById('confirm-delete-comment')?.addEventListener('click', async () => {
      closeModal();
      try {
        await apiDelete(`${this.apiBase}/${ctxId}/comments/${commentId}`);
        // 从列表移除
        this.comments = this.comments.filter(c => c.id !== commentId);
        this._renderList();
        showToast('评论已删除');
      } catch {
        showToast('删除失败');
      }
    });
  }

  _setupResponsive() {
    // CSS media query handles mobile layout automatically.
    // No class swapping needed — .comment-sidebar rules in @media (max-width: 767px) do the work.
  }

  destroy() {
    if (this._observer) this._observer.disconnect();
    this._mentionPopup?.hide();
    this.comments = [];
  }
}
