/**
 * pages/card-editor.js — UGC 卡片模板编辑器
 *
 * 左栏：模块搭建区（拖拽排序 + 编辑字段）
 * 右栏：元素选择（8种原子模块，点击/拖拽添加到左栏）
 * 底部：实时预览
 *
 * 路由：/explore/new_card（创建）、/explore/card/:id/edit（编辑）
 */

import { registerPage, navigateTo, animIn, bindRipples } from '../core/router.js';
import { apiGet, apiPost, apiPut, isLoggedIn } from '../core/api.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, escHtml } from '../components/ui.js';
import { renderModule, renderCard } from '../components/card-renderer.js';

/* =============================================
   常量
   ============================================= */

const MODULE_TYPES = [
  { type: 'input',       icon: 'ri-text',                 name: '文本显示', desc: '标签 + 值' },
  { type: 'link',        icon: 'ri-links-line',           name: '链接',     desc: '可点击 URL' },
  { type: 'contact',     icon: 'ri-wechat-line',          name: '联系方式', desc: '一键复制' },
  { type: 'price',       icon: 'ri-money-cny-circle-line',name: '价格',     desc: '金额展示' },
  { type: 'tags',        icon: 'ri-price-tag-3-line',     name: '标签',     desc: '多个标签' },
  { type: 'vote',        icon: 'ri-bar-chart-2-line',     name: '投票',     desc: '选项投票' },
  { type: 'timer',       icon: 'ri-timer-line',           name: '倒计时',   desc: '天:时:分:秒' },
  { type: 'days_matter', icon: 'ri-calendar-event-line',  name: '倒数日',   desc: '距今N天' }
];

const PRESET_COLORS = [
  { bg: '#FFFFFF', accent: '#1565C0', label: '默认蓝' },
  { bg: '#E3F2FD', accent: '#1565C0', label: '浅蓝' },
  { bg: '#E0F7FA', accent: '#00838F', label: '青色' },
  { bg: '#E8F5E9', accent: '#2E7D32', label: '绿色' },
  { bg: '#FFF8E1', accent: '#F9A825', label: '暖黄' },
  { bg: '#FFF3E0', accent: '#E65100', label: '橙色' },
  { bg: '#FFEBEE', accent: '#C62828', label: '浅红' },
  { bg: '#F3E5F5', accent: '#7B1F7D', label: '紫色' }
];

const CATEGORY_OPTIONS = [
  { text: '学习', value: 'study' },
  { text: '社交', value: 'social' },
  { text: '交易', value: 'trade' },
  { text: '项目', value: 'project' },
  { text: '通用', value: 'general' }
];

/* =============================================
   状态
   ============================================= */

let _modules = [];          // 已添加的模块列表
let _styles = { bg: '#FFFFFF', accent: '#1565C0' };
let _editingId = null;      // 编辑模式下的模板 ID
let _draggedModuleType = null;
let _draggedModuleIndex = -1;

/* =============================================
   入口
   ============================================= */

async function renderCardEditor(container, templateId) {
  if (!isLoggedIn()) { showToast('请先登录'); navigateTo('explore'); return; }

  _editingId = templateId || null;
  _modules = [];
  _styles = { bg: '#FFFFFF', accent: '#1565C0' };

  let existingTemplate = null;
  if (_editingId) {
    try {
      existingTemplate = await apiGet(`/api/card-templates/${_editingId}`);
      if (existingTemplate.error) { showToast(existingTemplate.error); navigateTo('explore'); return; }
      _modules = (existingTemplate.components_schema || []).map(m => ({ ...m }));
      _styles = existingTemplate.styles || { bg: '#FFFFFF', accent: '#1565C0' };
    } catch (e) { showToast('加载模板失败'); navigateTo('explore'); return; }
  }

  const isEdit = !!_editingId;

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" id="card-editor-back-btn">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <h1 class="page-title" style="margin:0">${isEdit ? '编辑卡片' : '创建卡片模板'}</h1>
      <button class="btn btn-primary btn-compact" id="card-editor-submit-btn">${isEdit ? '保存' : '发布'}</button>
    </div>

    <div class="card-editor-meta">
      <div id="card-editor-name-input"></div>
      <div id="card-editor-desc-input"></div>
      <div id="card-editor-category-select"></div>
      <div class="card-editor-colors" id="card-editor-colors"></div>
    </div>

    <div class="editor-split">
      <div class="editor-left">
        <div class="card-editor-modules-header">模块搭建</div>
        <div class="card-editor-modules" id="card-editor-modules"></div>
        <!-- 模块通过从右侧元素选择拖拽添加 -->
      </div>
      <div class="editor-right">
        <div class="editor-right-header">元素选择</div>
        <div class="card-editor-elements" id="card-editor-elements"></div>
      </div>
    </div>

    <div class="card-editor-preview" id="card-editor-preview">
      <div class="card-editor-preview-header">实时预览</div>
      <div id="card-editor-preview-card"></div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  // 渲染表单
  renderForm(container, existingTemplate);
  // 渲染元素选择
  renderElementList(container.querySelector('#card-editor-elements'));
  // 渲染模块列表
  renderModuleList(container);
  // 渲染预览
  renderPreview(container);
  // 绑定事件
  bindEditorEvents(container);
}

/* =============================================
   表单渲染
   ============================================= */

function renderForm(container, existing) {
  container.querySelector('#card-editor-name-input').innerHTML = createMdInput({
    id: 'card-name', label: '卡片名称', placeholder: ' ', required: true,
    value: existing?.name || ''
  });
  container.querySelector('#card-editor-desc-input').innerHTML = createMdInput({
    id: 'card-desc', label: '简短描述（最多80字）', placeholder: ' ', required: true,
    value: existing?.description || ''
  });
  container.querySelector('#card-editor-category-select').innerHTML = createMdSelect({
    id: 'card-category', label: '分类',
    options: CATEGORY_OPTIONS,
    selected: existing?.category || 'general'
  });

  // 取色器
  const colorsEl = container.querySelector('#card-editor-colors');
  colorsEl.innerHTML = `
    <div class="card-editor-color-row">
      <label class="card-editor-color-label">背景色</label>
      <input type="color" id="card-color-bg" value="${_styles.bg || '#FFFFFF'}">
      <label class="card-editor-color-label">强调色</label>
      <input type="color" id="card-color-accent" value="${_styles.accent || '#1565C0'}">
    </div>
    <div class="card-editor-presets" id="card-editor-presets">
      ${PRESET_COLORS.map((p, i) => `
        <button class="card-editor-preset ${_styles.bg === p.bg && _styles.accent === p.accent ? 'preset-active' : ''}"
          data-bg="${p.bg}" data-accent="${p.accent}" title="${p.label}"
          style="background:${p.bg};border-color:${p.accent}"></button>
      `).join('')}
    </div>
  `;

  // 取色器变化
  colorsEl.querySelector('#card-color-bg').addEventListener('input', (e) => {
    _styles.bg = e.target.value;
    updatePresetActive();
    renderPreview(container);
  });
  colorsEl.querySelector('#card-color-accent').addEventListener('input', (e) => {
    _styles.accent = e.target.value;
    updatePresetActive();
    renderPreview(container);
  });

  // 预设色块点击
  colorsEl.querySelectorAll('.card-editor-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      _styles.bg = btn.dataset.bg;
      _styles.accent = btn.dataset.accent;
      colorsEl.querySelector('#card-color-bg').value = _styles.bg;
      colorsEl.querySelector('#card-color-accent').value = _styles.accent;
      updatePresetActive();
      renderPreview(container);
    });
  });
}

function updatePresetActive() {
  document.querySelectorAll('.card-editor-preset').forEach(btn => {
    btn.classList.toggle('preset-active',
      btn.dataset.bg === _styles.bg && btn.dataset.accent === _styles.accent);
  });
}

/* =============================================
   元素选择（右栏）
   ============================================= */

function renderElementList(el) {
  if (!el) return;
  el.innerHTML = MODULE_TYPES.map(m => `
    <div class="card-editor-element" draggable="true" data-module-type="${m.type}">
      <i class="${m.icon}"></i>
      <span class="card-editor-element-name">${m.name}</span>
      <span class="card-editor-element-desc">${m.desc}</span>
    </div>
  `).join('');

  // 点击添加
  el.querySelectorAll('.card-editor-element').forEach(item => {
    item.addEventListener('click', () => {
      addModule(item.dataset.moduleType);
    });
  });

  // 拖拽开始
  el.querySelectorAll('.card-editor-element[draggable]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      _draggedModuleType = item.dataset.moduleType;
      _draggedModuleIndex = -1;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', item.dataset.moduleType);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      _draggedModuleType = null;
      removeDropIndicator();
    });
  });
}

/* =============================================
   模块列表（左栏）
   ============================================= */

function renderModuleList(container) {
  const el = container.querySelector('#card-editor-modules');
  if (!el) return;

  if (_modules.length === 0) {
    el.innerHTML = '<p class="text-secondary" style="padding:24px;text-align:center;font-size:13px">从右侧选择元素，或点击下方按钮添加</p>';
    return;
  }

  el.innerHTML = _modules.map((mod, i) => `
    <div class="card-editor-module" draggable="true" data-module-index="${i}">
      <span class="card-editor-module-drag"><i class="ri-draggable"></i></span>
      <span class="card-editor-module-icon"><i class="${escHtml(mod.icon || getDefaultIcon(mod.type))}"></i></span>
      <span class="card-editor-module-type">${getTypeName(mod.type)}</span>
      <span class="card-editor-module-label">${escHtml(mod.label || '未命名')}</span>
      <button class="btn-icon card-editor-module-edit" data-module-index="${i}" title="编辑">
        <i class="ri-edit-line"></i>
      </button>
      <button class="btn-icon card-editor-module-del" data-module-index="${i}" title="删除">
        <i class="ri-close-line"></i>
      </button>
    </div>
  `).join('');

  // 编辑按钮
  el.querySelectorAll('.card-editor-module-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.moduleIndex);
      openModuleEditModal(idx, container);
    });
  });

  // 删除按钮
  el.querySelectorAll('.card-editor-module-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.moduleIndex);
      _modules.splice(idx, 1);
      renderModuleList(container);
      renderPreview(container);
    });
  });

  // 点击行编辑
  el.querySelectorAll('.card-editor-module').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.moduleIndex);
      openModuleEditModal(idx, container);
    });
  });

  // 拖拽排序
  el.querySelectorAll('.card-editor-module[draggable]').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      _draggedModuleIndex = parseInt(row.dataset.moduleIndex);
      _draggedModuleType = null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'module');
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      _draggedModuleIndex = -1;
      removeDropIndicator();
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        row.classList.add('drag-over-top');
        row.classList.remove('drag-over-bottom');
      } else {
        row.classList.add('drag-over-bottom');
        row.classList.remove('drag-over-top');
      }
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over-top', 'drag-over-bottom');
      const rect = row.getBoundingClientRect();
      let targetIdx = parseInt(row.dataset.moduleIndex);
      if (e.clientY > rect.top + rect.height / 2) targetIdx++;

      if (_draggedModuleIndex >= 0 && _draggedModuleIndex !== targetIdx && _draggedModuleIndex !== targetIdx - 1) {
        const [moved] = _modules.splice(_draggedModuleIndex, 1);
        // Adjust target if source was before target
        const adjustedTarget = _draggedModuleIndex < targetIdx ? targetIdx - 1 : targetIdx;
        _modules.splice(adjustedTarget, 0, moved);
        renderModuleList(container);
        renderPreview(container);
      }
      _draggedModuleIndex = -1;
    });
  });
}

function addModule(type) {
  _modules.push({
    type,
    icon: getDefaultIcon(type),
    label: getTypeName(type),
    value: type === 'tags' ? [] : (type === 'vote' ? '' : '')
  });
  const container = document.getElementById('main-content');
  renderModuleList(container);
  renderPreview(container);
  // 滚动到新模块
  setTimeout(() => {
    const last = document.querySelector('#card-editor-modules .card-editor-module:last-child');
    last?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 50);
}

/* =============================================
   模块编辑 Modal
   ============================================= */

function openModuleEditModal(index, container) {
  const mod = _modules[index];
  if (!mod) return;

  const iconOptions = [
    'ri-text','ri-links-line','ri-wechat-line','ri-money-cny-circle-line',
    'ri-price-tag-3-line','ri-bar-chart-2-line','ri-timer-line','ri-calendar-event-line',
    'ri-user-line','ri-map-pin-line','ri-book-2-line','ri-file-text-line',
    'ri-calendar-line','ri-lightbulb-line','ri-tools-line','ri-music-line',
    'ri-phone-line','ri-mail-line','ri-chat-check-line','ri-star-line'
  ];

  const iconGrid = iconOptions.map(ic =>
    `<button class="card-editor-icon-btn ${mod.icon === ic ? 'icon-active' : ''}" data-icon="${ic}">
      <i class="${ic}"></i>
    </button>`
  ).join('');

  let extraFields = '';
  if (mod.type === 'vote') {
    const options = mod.options || [];
    extraFields = `
      <div class="card-edit-field" style="margin-top:12px">
        <label class="card-edit-label">投票选项（每行一个，格式：id|文本）</label>
        <textarea id="module-vote-options" class="md-input" style="min-height:80px;width:100%;padding:12px;font-size:14px;border:1px solid #e0e0e0;border-radius:8px"
          placeholder=" ">${options.map(o => `${o.id}|${o.text}`).join('\n')}</textarea>
      </div>`;
  } else if (mod.type === 'days_matter') {
    extraFields = `
      <div class="card-edit-field" style="margin-top:12px">
        <label class="card-edit-label">默认日期（可选）</label>
        <div class="md-input-group">
          <input class="md-input" type="date" id="module-days-value" value="${(mod.value || '').slice(0, 10)}" placeholder=" "
            style="padding:14px 16px;font-size:14px">
          <fieldset class="md-border"><legend><span>日期</span></legend></fieldset>
        </div>
      </div>`;
  }

  openModal('编辑模块', `
    <div class="card-edit-form" style="display:flex;flex-direction:column;gap:16px;padding-top:8px">
      ${createMdInput({ id: 'module-edit-label', label: '标签名', value: mod.label || '', placeholder: ' ' })}
      <div>
        <label class="card-edit-label" style="display:block;margin-bottom:8px">图标</label>
        <div class="card-editor-icon-grid">${iconGrid}</div>
      </div>
      ${extraFields}
    </div>
    <div class="card-edit-actions" style="margin-top:16px">
      <button class="btn btn-secondary" id="module-edit-cancel">取消</button>
      <button class="btn btn-primary" id="module-edit-confirm">确定</button>
    </div>
  `);

  // 图标选择
  setTimeout(() => {
    document.querySelectorAll('.card-editor-icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.card-editor-icon-btn').forEach(b => b.classList.remove('icon-active'));
        btn.classList.add('icon-active');
      });
    });

    document.getElementById('module-edit-confirm')?.addEventListener('click', () => {
      const label = document.getElementById('module-edit-label')?.value?.trim();
      if (!label) { showToast('标签名不能为空'); return; }
      _modules[index].label = label;

      const activeIcon = document.querySelector('.card-editor-icon-btn.icon-active');
      if (activeIcon) _modules[index].icon = activeIcon.dataset.icon;

      if (mod.type === 'vote') {
        const optsText = document.getElementById('module-vote-options')?.value || '';
        _modules[index].options = optsText.split('\n').filter(line => line.includes('|')).map(line => {
          const [id, ...textParts] = line.split('|');
          return { id: id.trim(), text: textParts.join('|').trim(), votes: 0 };
        });
      } else if (mod.type === 'days_matter') {
        _modules[index].value = document.getElementById('module-days-value')?.value || '';
      }

      closeModal();
      renderModuleList(container);
      renderPreview(container);
    });

    document.getElementById('module-edit-cancel')?.addEventListener('click', () => closeModal());

    // 聚焦
    setTimeout(() => document.getElementById('module-edit-label')?.focus(), 100);
  }, 50);
}

/* =============================================
   预览
   ============================================= */

function renderPreview(container) {
  const previewEl = container?.querySelector('#card-editor-preview-card');
  if (!previewEl) return;

  if (_modules.length === 0) {
    previewEl.innerHTML = '<p class="text-secondary" style="padding:24px;text-align:center;font-size:13px">添加模块后此处显示预览</p>';
    return;
  }

  const cardData = {
    id: 'preview',
    title: document.getElementById('card-name')?.value?.trim() || '卡片预览',
    template_id: null,
    components: _modules.map(m => ({ ...m })),
    styles: _styles
  };

  previewEl.innerHTML = renderCard(cardData, { compact: false, showActions: false });
}

/* =============================================
   事件绑定
   ============================================= */

function bindEditorEvents(container) {
  // 左栏区域接受拖放（从元素选择拖入）
  const modulesEl = container.querySelector('#card-editor-modules');
  if (modulesEl) {
    modulesEl.addEventListener('dragover', (e) => {
      if (_draggedModuleType) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        modulesEl.classList.add('drag-over');
      }
    });
    modulesEl.addEventListener('dragleave', () => {
      modulesEl.classList.remove('drag-over');
    });
    modulesEl.addEventListener('drop', (e) => {
      modulesEl.classList.remove('drag-over');
      if (_draggedModuleType) {
        e.preventDefault();
        addModule(_draggedModuleType);
        _draggedModuleType = null;
      }
    });
  }

  // 提交
  container.querySelector('#card-editor-submit-btn')?.addEventListener('click', () => handleSubmit());

  // 返回
  container.querySelector('#card-editor-back-btn')?.addEventListener('click', () => {
    navigateTo('explore');
  });
}

/* =============================================
   提交
   ============================================= */

async function handleSubmit() {
  const name = document.getElementById('card-name')?.value?.trim();
  const description = document.getElementById('card-desc')?.value?.trim();
  const categoryEl = document.getElementById('card-category');
  const category = categoryEl?.value || 'general';

  if (!name) { showToast('请输入卡片名称'); return; }
  if (!description) { showToast('请输入描述'); return; }
  if (_modules.length === 0) { showToast('请至少添加一个模块'); return; }

  const body = {
    name,
    description,
    icon: _modules[0]?.icon || 'ri-layout-grid-line',
    category,
    components_schema: _modules.map(m => ({
      type: m.type,
      icon: m.icon || getDefaultIcon(m.type),
      label: m.label,
      value: m.type === 'tags' ? [] : (m.options ? '' : (m.value || ''))
    })),
    styles: _styles
  };

  // 保留 vote 模块的 options
  body.components_schema.forEach((comp, i) => {
    if (_modules[i]?.type === 'vote' && _modules[i].options) {
      comp.options = _modules[i].options;
    }
  });

  const btn = document.getElementById('card-editor-submit-btn');
  btn.disabled = true;
  btn.textContent = _editingId ? '保存中...' : '发布中...';

  try {
    let res;
    if (_editingId) {
      res = await apiPut(`/api/card-templates/${_editingId}`, body);
    } else {
      res = await apiPost('/api/card-templates', body);
    }

    if (res.error) { showToast(res.error); return; }
    showToast(_editingId ? '已保存' : '卡片模板已发布');

    // 跳转到编辑器，让用户立即使用
    navigateTo('explore-post-editor');
  } catch (e) {
    showToast(_editingId ? '保存失败' : '发布失败');
  } finally {
    btn.disabled = false;
    btn.textContent = _editingId ? '保存' : '发布';
  }
}

/* =============================================
   工具函数
   ============================================= */

function getTypeName(type) {
  const found = MODULE_TYPES.find(m => m.type === type);
  return found ? found.name : type;
}

function getDefaultIcon(type) {
  const map = {
    input: 'ri-text', link: 'ri-links-line', contact: 'ri-wechat-line',
    price: 'ri-money-cny-circle-line', tags: 'ri-price-tag-3-line',
    vote: 'ri-bar-chart-2-line', timer: 'ri-timer-line', days_matter: 'ri-calendar-event-line'
  };
  return map[type] || 'ri-text';
}

function removeDropIndicator() {
  // No-op — we use CSS class-based indicators instead of a dedicated element
}

/* =============================================
   页面注册
   ============================================= */

registerPage('card-editor', (container, data) => renderCardEditor(container, data));
