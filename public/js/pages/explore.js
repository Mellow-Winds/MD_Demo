/**
 * pages/explore.js — 探索页（组件化卡片系统）
 * 统一帖子流 + 搜索筛选 + 帖子详情分栏布局 + 评论
 */

import { registerPage, navigateTo, animIn, animStagger, bindRipples, renderMarkdown } from '../core/router.js';
import { apiGet, apiPost, apiDelete, isLoggedIn, getToken } from '../core/api.js';
import { showToast, openModal, closeModal, renderLoginPrompt, createMdInput } from '../components/ui.js';
import { renderCard, renderPostCard, renderModule, startTimers, bindCardActions } from '../components/card-renderer.js';
import { TkComments } from '../components/tk-comments.js';

/* =============================================
   状态
   ============================================= */

let _posts = [];
let _page = 1;
let _total = 0;
let _keyword = '';
let _hasMore = true;
let _timerInterval = null;

/* =============================================
   renderExplore — 渲染探索主页
   ============================================= */

async function renderExplore(container) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin:0">
        <i class="ri-compass-3-line" style="vertical-align:-3px;margin-right:4px"></i> 发现
      </h1>
      <div class="explore-header-actions">
        <button class="btn btn-secondary btn-compact" id="explore-my-btn">
          <i class="ri-file-list-3-line"></i> 我的发布
        </button>
      </div>
    </div>

    <div class="explore-search-bar" id="explore-search-bar"></div>

    <div id="explore-posts-list" class="explore-posts-grid"></div>
    <div id="explore-load-more" style="text-align:center;padding:16px"></div>

    <button class="explore-fab" id="explore-publish-btn" title="发布">
      <i class="ri-add-line"></i>
    </button>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  const searchBarEl = container.querySelector('#explore-search-bar');
  if (searchBarEl) {
    searchBarEl.innerHTML = createMdInput({
      id: 'explore-search', label: '搜索', placeholder: ' ', value: _keyword
    });
  }

  bindExploreEvents(container);

  _posts = [];
  _page = 1;
  _hasMore = true;
  await loadPosts(container);
}

/* =============================================
   事件绑定
   ============================================= */

function bindExploreEvents(container) {
  container.querySelector('#explore-publish-btn')?.addEventListener('click', () => {
    if (!isLoggedIn()) { showToast('请先登录'); return; }
    navigateTo('explore-tutorial');
  });

  container.querySelector('#explore-my-btn')?.addEventListener('click', () => {
    if (!isLoggedIn()) { showToast('请先登录'); return; }
    navigateTo('explore-my-posts');
  });

  let searchTimer = null;
  const searchInput = container.querySelector('#explore-search');
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      _keyword = e.target.value.trim();
      _posts = [];
      _page = 1;
      _hasMore = true;
      await loadPosts(container);
    }, 300);
  });

  container.querySelector('#explore-posts-list')?.addEventListener('click', (e) => {
    const postCard = e.target.closest('.explore-post-card');
    if (!postCard) return;
    navigateTo('explore-post-detail', postCard.dataset.postId);
  });
}

/* =============================================
   加载帖子
   ============================================= */

async function loadPosts(container) {
  const listEl = container.querySelector('#explore-posts-list');
  const loadMoreEl = container.querySelector('#explore-load-more');
  if (!listEl) return;

  if (_page === 1) {
    listEl.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>';
  }

  try {
    const params = new URLSearchParams({ page: _page, pageSize: 20 });
    if (_keyword) params.set('keyword', _keyword);

    const data = await apiGet(`/api/explore/posts?${params}`);

    if (data.error) {
      listEl.innerHTML = `<div class="card"><p class="text-secondary">${data.error}</p></div>`;
      return;
    }

    if (_page === 1) listEl.innerHTML = '';

    const newItems = data.items || [];
    _total = data.total || 0;

    if (newItems.length === 0 && _page === 1) {
      listEl.style.display = 'block';
      listEl.style.columns = 'auto';
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <i class="ri-inbox-line" style="font-size:48px;color:var(--md-outline-variant)"></i>
          <p class="text-secondary" style="margin-top:12px">还没有帖子</p>
          <p class="text-secondary">点击右下角 + 创建第一条内容</p>
        </div>`;
      loadMoreEl.innerHTML = '';
      return;
    } else {
      listEl.style.display = '';
      listEl.style.columns = '';
    }

    _posts.push(...newItems);

    const newCards = [];
    for (const post of newItems) {
      const el = document.createElement('div');
      el.innerHTML = renderPostCard(post);
      const cardEl = el.firstElementChild;
      listEl.appendChild(cardEl);
      newCards.push(cardEl);
    }

    animStagger(newCards, { y: 16, dur: 350, gap: 40 });
    _timerInterval = startTimers(listEl);

    _hasMore = _posts.length < _total;
    loadMoreEl.innerHTML = _hasMore
      ? '<button class="btn btn-secondary" id="explore-load-more-btn">加载更多</button>'
      : (_posts.length > 0 ? '<p class="text-secondary" style="text-align:center;font-size:12px">没有更多了</p>' : '');

    container.querySelector('#explore-load-more-btn')?.addEventListener('click', async () => {
      _page++;
      await loadPosts(container);
    });
  } catch (e) {
    if (_page === 1) {
      listEl.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
    }
  }
}

/* =============================================
   帖子详情页
   ============================================= */

registerPage('explore-post-detail', async (container, postId) => {
  const actualPostId = typeof postId === 'object' ? postId.id : postId;
  const scrollToCommentId = typeof postId === 'object' ? (postId.commentId || 0) : 0;

  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" id="detail-back-btn">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <span id="detail-delete-btn-placeholder"></span>
    </div>
    <div id="detail-content"><div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div></div>
  `;

  container.querySelector('#detail-back-btn')?.addEventListener('click', () => navigateTo('explore'));

  try {
    const post = await apiGet(`/api/explore/posts/${actualPostId}`);
    if (post.error) {
      container.querySelector('#detail-content').innerHTML = `<div class="card"><p class="text-secondary">${post.error}</p></div>`;
      return;
    }

    // 作者可见删除 + 编辑按钮
    if (post.creator_id && window._currentUser?.id === post.creator_id) {
      const placeholder = container.querySelector('#detail-delete-btn-placeholder');
      if (placeholder) {
        placeholder.innerHTML = `
          <span style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-compact" id="detail-edit-btn">
              <i class="ri-edit-line"></i> 编辑
            </button>
            <button class="btn btn-secondary btn-compact" id="detail-delete-btn" style="color:var(--md-error)">
              <i class="ri-delete-bin-line"></i> 删除
            </button>
          </span>
        `;
        container.querySelector('#detail-edit-btn')?.addEventListener('click', () => navigateTo('explore-post-editor', post.id));
        container.querySelector('#detail-delete-btn')?.addEventListener('click', () => {
          openModal('确认删除', `
            <p style="margin-bottom:24px">确定要删除这篇帖子吗？删除后无法恢复。</p>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-secondary" onclick="closeModal()">取消</button>
              <button class="btn btn-primary" id="confirm-delete-post" style="background:var(--md-error)">删除</button>
            </div>
          `);
          document.getElementById('confirm-delete-post')?.addEventListener('click', async () => {
            const res = await apiDelete(`/api/explore/posts/${post.id}`);
            if (res.error) { showToast(res.error); closeModal(); return; }
            closeModal();
            showToast('已删除');
            navigateTo('explore');
          });
        });
      }
    }

    renderPostDetail(container.querySelector('#detail-content'), post);

    if (scrollToCommentId) {
      scrollToTkComment(scrollToCommentId);
    }
  } catch (e) {
    container.querySelector('#detail-content').innerHTML = `<div class="card"><p class="text-secondary">加载失败</p></div>`;
  }
});

/* =============================================
   帖子详情渲染 — 左右分栏布局
   ============================================= */

function renderPostDetail(el, post) {
  const nickname = post.creator_nickname || post.creator_name || '匿名';
  const avatarUrl = post.creator_avatar || '';
  const avatarLetter = (nickname || '?')[0].toUpperCase();
  const timeStr = new Date(post.created_at).toLocaleString('zh-CN');
  const isOwner = post.creator_id && window._currentUser?.id === post.creator_id;

  let blocks = post.blocks || [];
  if (blocks.length === 0 && post.content) {
    try {
      const parsed = JSON.parse(post.content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) blocks = parsed;
    } catch (e) {}
  }

  let contentHtml = '';
  if (blocks.length > 0) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type === 'text' && block.data) {
        contentHtml += `<div class="post-text-block">${block.data}</div>`;
      } else if (block.type === 'card' && block.card) {
        contentHtml += `<div class="explore-card-wrapper" data-block-index="${i}">`;
        contentHtml += renderCard(block.card, { compact: false, showActions: true, isOwner });
        contentHtml += `</div>`;
      }
    }
  } else {
    if (post.content) contentHtml += `<div class="post-text-block">${renderMarkdown(post.content)}</div>`;
    if (post.cards) contentHtml += post.cards.map(c => renderCard(c, { compact: false, showActions: true, isOwner })).join('');
  }

  el.innerHTML = `
    <div class="explore-detail-layout">
      <div class="post-section">
        <div class="post-author-row">
          <div class="post-author-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="">` : avatarLetter}</div>
          <div class="post-author-info">
            <span class="post-author-nickname">${escHtml(nickname)}</span>
            <span class="post-author-time">${escHtml(timeStr)}</span>
          </div>
        </div>
        <h2 class="explore-post-title">${escHtml(post.title)}</h2>
        <div class="explore-detail-content">${contentHtml}</div>
      </div>
      <div class="comment-section" id="tk-comments-container-${post.id}">
        ${isLoggedIn() ? '' : `<p class="text-secondary" style="padding:12px 24px;font-size:12px;text-align:center"><a href="#" onclick="navigateTo('auth');return false">登录</a> 后参与评论</p>`}
      </div>
    </div>
  `;

  _timerInterval = startTimers(el);

  bindCardActions(el, {
    onCopy: () => showToast('已复制'),
    onEdit: (cardId, btn) => {
      const wrapper = btn.closest('.explore-card-wrapper');
      const blockIndex = wrapper ? parseInt(wrapper.dataset.blockIndex) : -1;
      if (blockIndex >= 0 && blocks[blockIndex]?.card) {
        openCardEditModal(post, blocks, blockIndex, el);
      }
    }
  });

  // 初始化统一评论区
  if (isLoggedIn()) {
    const commentContainer = el.querySelector('.comment-section');
    if (commentContainer) {
      const tkComments = new TkComments({
        apiBase: '/api/explore/posts',
        ctxId: post.id,
        container: commentContainer,
        layout: 'sidebar',
        onNavigateProfile: (username) => {
          navigateTo('profile-user', username);
        }
      });
      tkComments.init();
      // 保存引用以便销毁
      el._tkComments = tkComments;
    }
  }
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
  setTimeout(() => tryScroll(), 500);
}

/* ---- 卡片编辑弹窗 ---- */

function openCardEditModal(post, blocks, blockIndex, detailEl) {
  const card = blocks[blockIndex].card;
  if (!card) return;

  const components = card.components || [];
  let fieldsHtml = createMdInput({ id: 'card-edit-title', label: '卡片标题', placeholder: ' ', value: card.title || '' });

  components.forEach((comp, i) => {
    if (comp.type === 'days_matter') {
      const dateVal = (comp.value && comp.value.match(/^\d{4}-\d{2}-\d{2}/)) ? comp.value.slice(0, 10) : '';
      fieldsHtml += `<div class="card-edit-field">
        <label class="card-edit-label"><i class="${comp.icon || 'ri-calendar-event-line'}"></i> ${escHtml(comp.label || '')}</label>
        <div class="md-input-group" style="margin-bottom:4px">
          <input class="md-input" type="date" id="card-edit-field-${i}" value="${dateVal}" placeholder=" ">
          <fieldset class="md-border"><legend><span>${escHtml(comp.label || '')}</span></legend></fieldset>
          <label class="md-label">${escHtml(comp.label || '')}</label>
        </div>
      </div>`;
    } else {
      fieldsHtml += `<div class="card-edit-field">${createMdInput({ id: `card-edit-field-${i}`, label: comp.label || '', value: comp.value || '', placeholder: ' ' })}</div>`;
    }
  });

  openModal(escHtml(card.title || '编辑卡片'), `
    <div class="card-edit-form">${fieldsHtml}</div>
    <div class="card-edit-actions" style="margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="card-edit-confirm">确定</button>
    </div>
  `);

  document.getElementById('card-edit-confirm')?.addEventListener('click', () => {
    card.title = document.getElementById('card-edit-title')?.value?.trim() || card.title;
    components.forEach((comp, i) => {
      const input = document.getElementById(`card-edit-field-${i}`);
      if (input) comp.value = input.value;
    });
    card.components = components;
    blocks[blockIndex].card = card;
    renderPostDetail(detailEl, { ...post, blocks });
    closeModal();
    showToast('卡片已更新');
  });
}

/* =============================================
   我的发布页
   ============================================= */

registerPage('explore-my-posts', async (container) => {
  if (!isLoggedIn()) { navigateTo('explore'); return; }

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" onclick="navigateTo('explore')">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <h1 class="page-title" style="margin:0">我的发布</h1>
    </div>
    <div id="my-posts-list"><div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div></div>
  `;

  try {
    const user = window._currentUser;
    const data = await apiGet(`/api/explore/posts?pageSize=100&creator_id=${user?.id || 0}`);
    const posts = data.items || [];
    const listEl = container.querySelector('#my-posts-list');

    if (posts.length === 0) {
      listEl.innerHTML = `
        <div class="explore-empty">
          <div class="explore-empty-icon"><i class="ri-file-list-3-line"></i></div>
          <div class="explore-empty-text">还没有发布过内容</div>
        </div>`;
      return;
    }

    listEl.innerHTML = posts.map(p => renderPostCard(p)).join('');
    animStagger(Array.from(listEl.children), { y: 16, dur: 350, gap: 40 });

    listEl.addEventListener('click', (e) => {
      const card = e.target.closest('.explore-post-card');
      if (card) navigateTo('explore-post-detail', card.dataset.postId);
    });
  } catch (e) {
    container.querySelector('#my-posts-list').innerHTML = `<div class="card"><p class="text-secondary">加载失败</p></div>`;
  }
});

/* =============================================
   工具函数
   ============================================= */

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  // 数据库存的是 UTC，补上 +08:00 时区
  let date = new Date(dateStr);
  if (isNaN(date.getTime())) date = new Date(dateStr + '+08:00');
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

/* =============================================
   页面注册
   ============================================= */

registerPage('explore', (container) => renderExplore(container));
