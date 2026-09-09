/**
 * pages/post-editor.js — 左右分栏流式编辑器
 *
 * 左栏：contentEditable 编辑区，文字和卡片混合排列
 * 右栏：卡片模板列表，拖拽/点击插入
 *
 * 卡片插入后直接渲染，点击弹出 modal 编辑字段
 */

import { registerPage, navigateTo, animIn, bindRipples, renderMarkdown } from '../core/router.js';
import { apiGet, apiPost, isLoggedIn, getToken } from '../core/api.js';
import { showToast, openModal, closeModal, createMdInput } from '../components/ui.js';
import { renderModule } from '../components/card-renderer.js';

/* =============================================
   状态
   ============================================= */

let _templates = [];
let _draggedTemplate = null;   // 正在拖拽的模板对象
let _draggedCardEl = null;     // 正在拖拽的已插入卡片元素
let _editingPostId = null;     // 编辑模式下的帖子 ID，null = 创建模式

/* =============================================
   使用教程弹窗
   ============================================= */

/* 教程页已改为独立路由 explore-tutorial，见文件末尾 */

/* =============================================
   入口
   ============================================= */

async function renderPostEditor(container, postId) {
  if (!isLoggedIn()) { showToast('请先登录'); navigateTo('explore'); return; }

  _editingPostId = postId || null;
  const isEdit = !!_editingPostId;

  // 加载模板
  try {
    _templates = await apiGet('/api/card-templates');
    if (_templates.error) _templates = [];
  } catch (e) { _templates = []; }

  // 编辑模式：加载已有帖子数据
  let existingPost = null;
  if (isEdit) {
    try {
      existingPost = await apiGet(`/api/explore/posts/${postId}`);
    } catch (e) { /* fallback to create mode */ }
  }

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" id="editor-back-btn">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <h1 class="page-title" style="margin:0">${isEdit ? '编辑帖子' : '发布'}</h1>
      <button class="btn btn-primary btn-compact" id="editor-submit-btn">${isEdit ? '保存' : '发布'}</button>
    </div>

    <div id="editor-title-input"></div>

    <div class="editor-split">
      <div class="editor-left">
        <div class="editor-toolbar" id="editor-toolbar">
          <button class="editor-toolbar-btn" data-cmd="bold" title="加粗 Ctrl+B"><i class="ri-bold"></i></button>
          <button class="editor-toolbar-btn" data-cmd="italic" title="斜体 Ctrl+I"><i class="ri-italic"></i></button>
          <button class="editor-toolbar-btn" data-cmd="underline" title="下划线 Ctrl+U"><i class="ri-underline"></i></button>
          <button class="editor-toolbar-btn" data-cmd="strikeThrough" title="删除线"><i class="ri-strikethrough"></i></button>
          <div class="editor-toolbar-sep"></div>
          <button class="editor-toolbar-btn" data-cmd="insertUnorderedList" title="无序列表"><i class="ri-list-unordered"></i></button>
          <button class="editor-toolbar-btn" data-cmd="insertOrderedList" title="有序列表"><i class="ri-list-ordered"></i></button>
          <div class="editor-toolbar-sep"></div>
          <button class="editor-toolbar-btn" data-cmd="justifyLeft" title="左对齐"><i class="ri-align-left"></i></button>
          <button class="editor-toolbar-btn" data-cmd="justifyCenter" title="居中"><i class="ri-align-center"></i></button>
          <button class="editor-toolbar-btn" data-cmd="justifyRight" title="右对齐"><i class="ri-align-right"></i></button>
          <div class="editor-toolbar-sep"></div>
          <button class="editor-toolbar-btn" id="toolbar-insert-link" title="插入链接 Ctrl+K"><i class="ri-link"></i></button>
          <div class="editor-toolbar-sep"></div>
          <span class="editor-char-count" id="editor-char-count">0 字</span>
        </div>
        <div class="editor-canvas" id="editor-canvas" contenteditable="true"></div>
      </div>
      <div class="editor-right">
        <!-- 卡片收藏面板 -->
        <div class="editor-collection" id="editor-collection">
          <div class="editor-collection-header">
            <span>卡片收藏</span>
            <button class="btn btn-sm btn-primary" id="new-card-btn" title="自定义卡片">
              <i class="ri-add-line"></i> 自定义卡片
            </button>
          </div>
          <div class="editor-collection-list" id="editor-collection-list"></div>
        </div>
      </div>
    </div>

    <!-- 卡片市场（独立模块，跨全宽） -->
    <div class="editor-market-section" id="editor-market">
      <div class="editor-market-section-header">
        <span>卡片市场</span>
      </div>
      <div class="editor-market-filters" id="editor-market-filters">
        <button class="market-filter-chip active" data-cat="all">全部</button>
        <button class="market-filter-chip" data-cat="study">学习</button>
        <button class="market-filter-chip" data-cat="social">社交</button>
        <button class="market-filter-chip" data-cat="trade">交易</button>
        <button class="market-filter-chip" data-cat="project">项目</button>
        <button class="market-filter-chip" data-cat="general">通用</button>
      </div>
      <div class="editor-market-grid" id="editor-market-grid"></div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  // 渲染标题输入
  container.querySelector('#editor-title-input').innerHTML = createMdInput({
    id: 'post-title', label: '帖子标题', placeholder: ' ', required: true,
    value: existingPost?.title || ''
  });

  // 渲染卡片收藏 + 卡片市场
  renderCollectionPanel(container);
  renderMarketPanel(container, 'all');

  // 编辑模式：还原已有内容到编辑区
  if (isEdit && existingPost) {
    const canvas = container.querySelector('#editor-canvas');
    restoreBlocksToCanvas(canvas, existingPost.blocks || []);
  }

  // 绑定事件
  bindEditorEvents(container);
}

/**
 * 将 blocks 还原到 contentEditable 编辑区
 */
function restoreBlocksToCanvas(canvas, blocks) {
  if (!blocks || blocks.length === 0) return;
  for (const block of blocks) {
    if (block.type === 'text' && block.data) {
      // contentEditable 需要 HTML 元素来保留格式（对齐、粗体等）
      // 检测是否为 HTML 内容
      const isHtml = /<[a-z][\s\S]*>/i.test(block.data);
      if (isHtml) {
        const div = document.createElement('div');
        div.innerHTML = block.data;
        canvas.appendChild(div);
      } else {
        const div = document.createElement('div');
        div.textContent = block.data;
        canvas.appendChild(div);
      }
    } else if (block.type === 'card' && block.card) {
      const cardEl = createCardElement(block.card);
      canvas.appendChild(cardEl);
      const spacer = document.createElement('div');
      spacer.innerHTML = '<br>';
      canvas.appendChild(spacer);
    }
  }
}

/* =============================================
   卡片收藏（localStorage）
   ============================================= */

function getFavoriteIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem('card_favorites') || '[]'));
  } catch (e) { return new Set(); }
}

function saveFavoriteIds(ids) {
  localStorage.setItem('card_favorites', JSON.stringify([...ids]));
}

function toggleFavorite(templateId) {
  const ids = getFavoriteIds();
  if (ids.has(templateId)) {
    ids.delete(templateId);
  } else {
    ids.add(templateId);
  }
  saveFavoriteIds(ids);
  return ids;
}

/* =============================================
   卡片收藏面板（右上）
   ============================================= */

function renderCollectionPanel(container) {
  const el = container.querySelector('#editor-collection-list');
  if (!el) return;

  const favIds = getFavoriteIds();
  const favorited = _templates.filter(t => favIds.has(t.id));

  if (favorited.length === 0) {
    el.innerHTML = '<p class="text-secondary" style="padding:12px;font-size:12px;text-align:center">在卡片市场中点击 ☆ 收藏</p>';
  } else {
    el.innerHTML = favorited.map(t => `
      <div class="collection-card" draggable="true" data-template-id="${t.id}"
        style="--card-accent:${(t.styles && t.styles.accent) || 'transparent'};background:${(t.styles && t.styles.bg) || '#fff'};border-color:${(t.styles && t.styles.accent) || 'transparent'}">
        <i class="${t.icon || 'ri-layout-grid-line'}"></i>
        <span>${escHtml(t.name)}</span>
        ${t.is_official ? '' : '<span class="badge-community">社区</span>'}
      </div>
    `).join('');

    // 拖拽
    el.querySelectorAll('.collection-card[draggable]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const tid = item.dataset.templateId;
        _draggedTemplate = _templates.find(t => t.id === tid) || null;
        _draggedCardEl = null;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', tid);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        _draggedTemplate = null;
        removeDropIndicator();
      });
    });
  }
}

/* =============================================
   卡片市场面板（右下）
   ============================================= */

let _marketCategory = 'all';

function renderMarketPanel(container, category) {
  _marketCategory = category || 'all';
  const gridEl = container.querySelector('#editor-market-grid');
  if (!gridEl) return;

  const favIds = getFavoriteIds();
  const filtered = _marketCategory === 'all'
    ? _templates
    : _templates.filter(t => t.category === _marketCategory);

  if (filtered.length === 0) {
    gridEl.innerHTML = '<p class="text-secondary" style="padding:16px;font-size:13px;text-align:center">暂无卡片</p>';
    return;
  }

  gridEl.innerHTML = filtered.map(t => {
    const isFav = favIds.has(t.id);
    const starIcon = isFav ? 'ri-star-fill' : 'ri-star-line';
    const starCls = isFav ? 'star-active' : '';
    return `
      <div class="market-card" draggable="true" data-template-id="${t.id}"
        style="--card-accent:${(t.styles && t.styles.accent) || 'transparent'};background:${(t.styles && t.styles.bg) || '#fff'};border-color:${(t.styles && t.styles.accent) || 'transparent'}">
        <button class="market-card-star ${starCls}" data-template-id="${t.id}" title="${isFav ? '取消收藏' : '收藏'}">
          <i class="${starIcon}"></i>
        </button>
        <div class="market-card-icon"><i class="${t.icon || 'ri-layout-grid-line'}"></i></div>
        <div class="market-card-name">${escHtml(t.name)}</div>
        <div class="market-card-desc">${escHtml(t.description || '')}</div>
        <div class="market-card-meta">
          ${t.is_official ? '<span class="badge-official">官方</span>' : '<span class="badge-community">社区</span>'}
          ${t.creator_name ? `<span class="text-secondary" style="font-size:11px">${escHtml(t.creator_name)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // 收藏按钮
  gridEl.querySelectorAll('.market-card-star').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tid = btn.dataset.templateId;
      toggleFavorite(tid);
      // 刷新两个面板
      renderCollectionPanel(container);
      renderMarketPanel(container, _marketCategory);
    });
  });

  // 拖拽
  gridEl.querySelectorAll('.market-card[draggable]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      const tid = item.dataset.templateId;
      _draggedTemplate = _templates.find(t => t.id === tid) || null;
      _draggedCardEl = null;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', tid);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      _draggedTemplate = null;
      removeDropIndicator();
    });
  });
}

/* =============================================
   编辑器事件绑定
   ============================================= */

function bindEditorEvents(container) {
  const canvas = container.querySelector('#editor-canvas');
  const toolbar = container.querySelector('#editor-toolbar');

  // 工具栏格式化
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    document.execCommand(cmd, false, null);
    canvas.focus();
    syncToolbarButtons(toolbar);
  });

  // 插入链接按钮 → 自定义 modal
  toolbar.querySelector('#toolbar-insert-link')?.addEventListener('click', () => {
    const sel = window.getSelection();
    const selectedText = sel.toString();

    openModal('插入链接', `
      <div style="display:flex;flex-direction:column;gap:16px;padding-top:8px">
        <div id="link-url-input"></div>
        <div id="link-text-input"></div>
        <div class="card-edit-actions" style="margin-top:8px">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="link-confirm-btn">插入</button>
        </div>
      </div>
    `);

    document.querySelector('#link-url-input').innerHTML = createMdInput({
      id: 'link-url', label: '链接地址', type: 'url', value: 'https://', placeholder: ' '
    });
    document.querySelector('#link-text-input').innerHTML = createMdInput({
      id: 'link-text', label: '显示文字', value: selectedText || '', placeholder: ' '
    });
    setTimeout(() => document.getElementById('link-url')?.focus(), 100);

    document.getElementById('link-confirm-btn')?.addEventListener('click', () => {
      const url = document.getElementById('link-url')?.value?.trim();
      const text = document.getElementById('link-text')?.value?.trim() || url;
      closeModal();
      canvas.focus();
      if (!url) return;
      const html = `<a href="${escAttr(url)}" target="_blank" rel="noopener">${escHtml(text)}</a>`;
      document.execCommand('insertHTML', false, html);
    });
  });

  // 字符计数
  canvas.addEventListener('input', () => {
    updateCharCount(canvas);
  });

  // 按钮状态同步
  canvas.addEventListener('keyup', () => syncToolbarButtons(toolbar));
  canvas.addEventListener('mouseup', () => syncToolbarButtons(toolbar));
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === canvas || canvas.contains(document.activeElement)) {
      syncToolbarButtons(toolbar);
    }
  });

  // 编辑区内拖拽
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = _draggedCardEl ? 'move' : 'copy';
    showDropIndicatorAt(canvas, e.clientY);
  });

  canvas.addEventListener('dragleave', (e) => {
    // 只在真正离开编辑区时移除指示线
    if (!canvas.contains(e.relatedTarget)) {
      removeDropIndicator();
    }
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    removeDropIndicator();

    const insertBefore = getInsertPoint(canvas, e.clientY);

    if (_draggedCardEl) {
      // 移动已有卡片
      if (insertBefore !== _draggedCardEl) {
        canvas.insertBefore(_draggedCardEl, insertBefore);
      }
      _draggedCardEl = null;
    } else if (_draggedTemplate) {
      // 从模板插入新卡片
      insertCardAtPosition(canvas, _draggedTemplate, insertBefore);
      _draggedTemplate = null;
    }
  });

  // 卡片点击 → 编辑 modal
  canvas.addEventListener('click', (e) => {
    const cardEl = e.target.closest('.editor-card-embed');
    if (!cardEl) return;
    e.preventDefault();
    openCardEditModal(cardEl);
  });

  // 卡片拖拽（编辑区内移动）
  canvas.addEventListener('dragstart', (e) => {
    const cardEl = e.target.closest('.editor-card-embed');
    if (!cardEl) return;
    _draggedCardEl = cardEl;
    _draggedTemplate = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'card');
    cardEl.classList.add('dragging');
  });

  canvas.addEventListener('dragend', () => {
    if (_draggedCardEl) {
      _draggedCardEl.classList.remove('dragging');
      _draggedCardEl = null;
    }
    removeDropIndicator();
  });

  // Delete 键删除选中的卡片 / 键盘快捷键
  canvas.addEventListener('keydown', (e) => {
    // Ctrl+快捷键
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); document.execCommand('bold', false, null); break;
        case 'i': e.preventDefault(); document.execCommand('italic', false, null); break;
        case 'u': e.preventDefault(); document.execCommand('underline', false, null); break;
        case 'k':
          e.preventDefault();
          // 触发链接按钮的点击事件，走自定义 modal 逻辑
          document.getElementById('toolbar-insert-link')?.click();
          break;
      }
      syncToolbarButtons(toolbar);
      return;
    }

    // Delete/Backspace 删除选中卡片
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const node = sel.anchorNode;
      const cardEl = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest?.('.editor-card-embed');
      if (cardEl && canvas.contains(cardEl)) {
        e.preventDefault();
        cardEl.remove();
      }
    }
  });

  // 提交
  container.querySelector('#editor-submit-btn')?.addEventListener('click', () => {
    handleSubmit(canvas);
  });

  // 返回
  container.querySelector('#editor-back-btn')?.addEventListener('click', () => {
    if (_editingPostId) {
      navigateTo('explore-post-detail', _editingPostId);
    } else {
      navigateTo('explore');
    }
  });

  // 分类筛选 chip 按钮
  container.querySelector('#editor-market-filters')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.market-filter-chip');
    if (!chip) return;
    container.querySelectorAll('.market-filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderMarketPanel(container, chip.dataset.cat);
  });

  // 自定义卡片按钮
  container.querySelector('#new-card-btn')?.addEventListener('click', () => {
    navigateTo('card-editor');
  });
}

/* ---- 工具栏状态同步 ---- */

function syncToolbarButtons(toolbar) {
  toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    try {
      const active = document.queryCommandState(cmd);
      btn.classList.toggle('active', active);
    } catch (e) { /* some commands don't support queryCommandState */ }
  });
}

function updateCharCount(canvas) {
  const countEl = document.getElementById('editor-char-count');
  if (!countEl) return;
  const text = canvas.textContent || '';
  countEl.textContent = `${text.length} 字`;
}

/* =============================================
   插入卡片
   ============================================= */

/**
 * 在光标位置插入卡片
 */
function insertCardAtCursor(template) {
  const canvas = document.getElementById('editor-canvas');
  if (!canvas) return;

  const sel = window.getSelection();
  let insertBefore = null;

  if (sel.rangeCount > 0 && canvas.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    // 如果光标在文本节点中间，先分割
    if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
      const after = range.startContainer.splitText(range.startOffset);
      insertBefore = after;
    } else {
      insertBefore = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer.childNodes[range.startOffset] || null
        : range.startContainer.nextSibling;
    }
  }

  insertCardAtPosition(canvas, template, insertBefore);
}

/**
 * 在指定位置插入卡片
 */
function insertCardAtPosition(canvas, template, insertBefore) {
  // 构建卡片数据
  const cardData = {
    title: template.name || '',
    template_id: template.id || null,
    styles: template.styles || {},
    components: (template.components_schema || []).map(comp => ({
      type: comp.type,
      icon: comp.icon || '',
      label: comp.label || '',
      value: comp.value || ''
    }))
  };

  const cardEl = createCardElement(cardData);

  // 插入
  if (insertBefore && canvas.contains(insertBefore)) {
    canvas.insertBefore(cardEl, insertBefore);
  } else {
    canvas.appendChild(cardEl);
  }

  // 卡片前后各插入一个空段落 div（visible block），确保卡片前后都能点击输入文字
  const beforeP = document.createElement('div');
  beforeP.innerHTML = '<br>';
  canvas.insertBefore(beforeP, cardEl);
  const afterP = document.createElement('div');
  afterP.innerHTML = '<br>';
  canvas.insertBefore(afterP, cardEl.nextSibling);

  // 滚动到卡片位置
  cardEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * 创建卡片 DOM 元素
 */
function createCardElement(cardData) {
  const div = document.createElement('div');
  div.className = 'editor-card-embed';
  div.contentEditable = 'false';
  div.draggable = true;
  div.dataset.cardJson = JSON.stringify(cardData);
  if (cardData.template_id) div.dataset.template = cardData.template_id;
  renderCardDom(div, cardData);
  return div;
}

/**
 * 渲染卡片 DOM 内容
 */
function renderCardDom(cardEl, cardData) {
  // 应用卡片自定义颜色（背景 + 边框）
  const styles = cardData.styles || {};
  if (styles.bg) {
    cardEl.style.background = styles.bg;
  }
  if (styles.accent) {
    cardEl.style.borderColor = styles.accent;
    cardEl.style.setProperty('--card-accent', styles.accent);
  }

  const icon = getTemplateIcon(cardData.template_id);
  const componentsHtml = (cardData.components || []).map((comp, i) =>
    renderModule(comp, i, null, {})
  ).join('');

  cardEl.innerHTML = `
    <button class="editor-card-close" title="删除卡片"><i class="ri-close-line"></i></button>
    <div class="editor-card-inner">
      <div class="editor-card-head">
        <i class="${icon}"></i>
        <span>${escHtml(cardData.title || '卡片')}</span>
      </div>
      <div class="editor-card-body">${componentsHtml || '<span class="text-secondary" style="font-size:12px">空卡片</span>'}</div>
    </div>
  `;

  // × 删除按钮（阻止冒泡，不触发卡片编辑）
  cardEl.querySelector('.editor-card-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cardEl.remove();
  });
}

function getTemplateIcon(templateId) {
  const t = _templates.find(t => t.id === templateId);
  return t?.icon || 'ri-layout-grid-line';
}

/* =============================================
   卡片编辑 Modal
   ============================================= */

function openCardEditModal(cardEl) {
  const cardData = JSON.parse(cardEl.dataset.cardJson || '{}');
  const components = cardData.components || [];

  // 为每个字段生成 MD3 输入框（days_matter 用 date picker）
  const fieldsHtml = components.map((comp, i) => {
    const id = `card-edit-field-${i}`;
    const label = `${escHtml(comp.label || `字段${i + 1}`)}`;
    const val = comp.value || '';

    if (comp.type === 'days_matter') {
      // 日期选择器
      const dateVal = val && val.match(/^\d{4}-\d{2}-\d{2}/) ? val.slice(0, 10) : '';
      return `
        <div class="card-edit-field">
          <label class="card-edit-label">
            <i class="${comp.icon || 'ri-calendar-event-line'}"></i> ${label}
          </label>
          <div class="md-input-group" style="margin-bottom:0">
            <input class="md-input" type="date" id="${id}" value="${dateVal}" placeholder=" "
              data-field-index="${i}" data-field-type="${comp.type}"
              style="padding:14px 16px;font-size:14px">
            <fieldset class="md-border"><legend><span>${label}</span></legend></fieldset>
            <label class="md-label">${label}</label>
          </div>
        </div>`;
    }

    // 其他类型：MD3 text input
    return `<div class="card-edit-field">${createMdInput({
      id, label, value: val, placeholder: ' ',
      attrs: `data-field-index="${i}" data-field-type="${comp.type}"`
    })}</div>`;
  }).join('');

  openModal(escHtml(cardData.title || '编辑卡片'), `
    <div class="card-edit-form">${fieldsHtml || '<p class="text-secondary">此卡片没有可编辑的字段</p>'}</div>
    <div class="card-edit-actions">
      <button class="btn btn-secondary" id="card-edit-cancel">取消</button>
      <button class="btn btn-primary" id="card-edit-confirm">确定</button>
    </div>
  `);

  // 聚焦第一个输入框
  const firstInput = document.querySelector('.card-edit-form .md-input, #card-edit-field-0');
  if (firstInput) setTimeout(() => firstInput.focus(), 100);

  // 确定
  document.getElementById('card-edit-confirm')?.addEventListener('click', () => {
    // 读取各字段值（md-input 或 date input）
    document.querySelectorAll('.card-edit-form .md-input, .card-edit-form input[type="date"]').forEach(input => {
      const idx = parseInt(input.dataset.fieldIndex);
      if (components[idx] !== undefined) {
        components[idx].value = input.value;
      }
    });

    cardData.components = components;
    cardEl.dataset.cardJson = JSON.stringify(cardData);
    renderCardDom(cardEl, cardData);
    closeModal();
    showToast('卡片已更新');
  });

  // 取消 / × 关闭
  document.getElementById('card-edit-cancel')?.addEventListener('click', () => closeModal());
}

/**
 * 打开模板选择 modal（工具栏插入卡片时）
 */
function openTemplatePickerModal(canvas) {
  const itemsHtml = _templates.map(t => `
    <div class="editor-modal-template" data-template-id="${t.id}">
      <i class="${t.icon || 'ri-layout-grid-line'}"></i>
      <span>${escHtml(t.name)}</span>
    </div>
  `).join('');

  openModal('选择卡片模板', `
    <div class="editor-modal-template-list">${itemsHtml || '<p class="text-secondary">暂无模板</p>'}</div>
  `);

  document.querySelectorAll('.editor-modal-template').forEach(el => {
    el.addEventListener('click', () => {
      const tid = el.dataset.templateId;
      const template = _templates.find(t => t.id === tid);
      if (!template) return;
      closeModal();
      insertCardAtCursor(template);
    });
  });
}

/* =============================================
   拖拽指示线
   ============================================= */

let _dropIndicator = null;

function showDropIndicatorAt(canvas, clientY) {
  if (!_dropIndicator) {
    _dropIndicator = document.createElement('div');
    _dropIndicator.className = 'editor-drop-indicator';
  }

  const insertBefore = getInsertPoint(canvas, clientY);
  if (insertBefore) {
    canvas.insertBefore(_dropIndicator, insertBefore);
  } else {
    canvas.appendChild(_dropIndicator);
  }
}

function removeDropIndicator() {
  if (_dropIndicator && _dropIndicator.parentNode) {
    _dropIndicator.parentNode.removeChild(_dropIndicator);
  }
}

/**
 * 根据鼠标 Y 坐标计算插入位置（应该插入到哪个节点之前）
 */
function getInsertPoint(canvas, clientY) {
  const children = Array.from(canvas.childNodes).filter(n => {
    // 只考虑元素节点和有意义的文本节点
    if (n.nodeType === Node.ELEMENT_NODE) return true;
    if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) return true;
    return false;
  });

  for (const child of children) {
    if (child === _dropIndicator) continue;
    const rect = (child.nodeType === Node.ELEMENT_NODE ? child : child.parentElement)?.getBoundingClientRect?.();
    if (!rect) continue;
    if (clientY < rect.top + rect.height / 2) {
      return child;
    }
  }
  return null; // 插入到末尾
}

/* =============================================
   序列化编辑器内容
   ============================================= */

function serializeEditor(editorEl) {
  const blocks = [];
  let pendingHtml = '';

  function flushText() {
    // 移除空 <div><br></div> 占位符
    const cleaned = pendingHtml.replace(/<div>\s*<br>\s*<\/div>/gi, '').trim();
    // 进一步移除纯 <br> 且无其他内容的情况
    const hasContent = cleaned.replace(/<br\s*\/?>/gi, '').trim();
    if (hasContent || (cleaned.includes('<img') || cleaned.includes('<a '))) {
      blocks.push({ type: 'text', data: sanitizeHtml(cleaned) });
    }
    pendingHtml = '';
  }

  for (const node of editorEl.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      pendingHtml += escHtmlForSerialize(node.textContent);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('editor-card-embed')) {
        flushText();
        const json = node.dataset.cardJson;
        if (json) {
          try { blocks.push({ type: 'card', card: JSON.parse(json) }); } catch (e) {}
        }
      } else if (node.classList.contains('editor-drop-indicator')) {
        // 忽略
      } else if (node.tagName === 'BR') {
        pendingHtml += '<br>';
      } else {
        // 格式化元素（div, p, ul, ol, b, i, u, a 等）→ 保留 innerHTML
        pendingHtml += node.outerHTML || node.innerHTML || node.textContent || '';
      }
    }
  }

  flushText();
  return blocks;
}

/**
 * HTML 白名单过滤：只允许安全标签
 */
function sanitizeHtml(html) {
  if (!html) return '';
  // 移除事件和脚本
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
}

function escHtmlForSerialize(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* =============================================
   提交
   ============================================= */

async function handleSubmit(canvas) {
  const titleInput = document.getElementById('post-title');
  const title = titleInput?.value?.trim() || '';
  if (!title) { showToast('请输入帖子标题'); return; }

  const blocks = serializeEditor(canvas);

  if (blocks.length === 0) { showToast('请输入内容'); return; }

  const btn = document.getElementById('editor-submit-btn');
  const isEdit = !!_editingPostId;
  btn.disabled = true;
  btn.textContent = isEdit ? '保存中...' : '发布中...';

  try {
    let res;

    if (isEdit) {
      // 编辑模式 → PUT 请求
      const token = getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const fetchRes = await fetch(`/api/explore/posts/${_editingPostId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ title, content: JSON.stringify(blocks) })
      });
      res = await fetchRes.json();
    } else {
      // 创建模式 → POST 请求
      res = await apiPost('/api/explore/posts', {
        title,
        content: JSON.stringify(blocks)
      });
    }

    if (res.error) { showToast(res.error); return; }
    showToast(isEdit ? '已保存' : '发布成功');

    if (isEdit) {
      navigateTo('explore-post-detail', _editingPostId);
    } else {
      navigateTo('explore');
    }
  } catch (e) {
    showToast(isEdit ? '保存失败' : '发布失败');
  } finally {
    btn.disabled = false;
    btn.textContent = isEdit ? '保存' : '发布';
  }
}

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

/* =============================================
   页面注册
   ============================================= */

registerPage('explore-post-editor', (container, postId) => renderPostEditor(container, postId));

/* =============================================
   发布指南页（独立路由）
   ============================================= */

registerPage('explore-tutorial', (container) => {
  const tutorialMd = `## 发布指南

### 基本操作
- **输入文字**：在左侧编辑区直接打字，回车换行
- **插入卡片**：从右侧模板列表拖拽到编辑区，或点击模板上的 **+** 按钮
- **编辑卡片**：点击已插入的卡片，在弹窗中填写各字段
- **删除卡片**：鼠标悬停卡片，点击右上角 **×** 按钮
- **移动卡片**：拖拽卡片到目标位置

### 排版规范
- 文字和卡片可以自由交替排列
- 一张帖子可以包含多张卡片

### 使用规范
- 内容真实有效，禁止虚假信息
- 尊重他人，禁止恶意内容
- 联系方式请填写在卡片对应字段中`;

  container.innerHTML = `
    <div class="page-header" style="justify-content:flex-start;gap:12px">
      <button class="btn btn-secondary btn-compact" id="tutorial-back-btn">
        <i class="ri-arrow-left-line"></i>
      </button>
      <h1 class="page-title" style="margin:0">发布指南</h1>
    </div>
    <div class="card" style="max-width:680px;margin:0 auto">
      <div class="editor-tutorial-content">${renderMarkdown(tutorialMd)}</div>
      <div class="card-edit-actions" style="justify-content:center;margin-top:24px">
        <button class="btn btn-primary" id="tutorial-confirm">确认，开始编辑</button>
      </div>
    </div>
  `;

  container.querySelector('#tutorial-back-btn')?.addEventListener('click', () => navigateTo('explore'));
  container.querySelector('#tutorial-confirm')?.addEventListener('click', () => navigateTo('explore-post-editor'));
});
