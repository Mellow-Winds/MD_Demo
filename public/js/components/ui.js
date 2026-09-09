/**
 * components/ui.js — MD3 组件工厂 + Toast + Modal + 工具函数
 * 自包含动画常量，与 router.js 无循环依赖
 */

/* =============================================
   动画缓动曲线（副本，用于 Modal 动画）
   ============================================= */

const Ease = {
  standard:   'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce:     'cubic-bezier(0.18, 1.25, 0.4, 1)',
};

/* =============================================
   工具函数
   ============================================= */

export function escHtml(str) {
  if (!str || typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
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

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

/* =============================================
   Toast System
   ============================================= */

export function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  });
}

// 挂载到 window 供模块外使用
window.showToast = showToast;

/* =============================================
   MD3 Component Factories
   ============================================= */

/**
 * createMdInput — MD3 outlined input with CSS-driven floating label
 * @param {{ id?: string, label: string, type?: string, value?: string, required?: boolean, attrs?: string, style?: string, onchange?: string, placeholder?: string }} config
 * @returns {string} HTML string
 */
export function createMdInput(config) {
  const { id = '', label, type = 'text', value = '', required = false, attrs = '', style = '', onchange = '', placeholder = ' ' } = config;
  const idAttr = id ? `id="${id}"` : '';
  const reqAttr = required ? 'required' : '';
  const valAttr = value ? `value="${escHtml(value)}"` : '';
  const styleAttr = style ? ` style="${style}"` : '';
  const onchangeAttr = onchange ? ` onchange="${onchange}"` : '';
  return `
    <div class="md-input-group"${styleAttr}>
      <input class="md-input" ${idAttr} type="${type}" placeholder="${placeholder}" ${reqAttr} ${valAttr} ${onchangeAttr} ${attrs}>
      <label class="md-label">${escHtml(label)}</label>
      <fieldset class="md-border" aria-hidden="true"><legend><span>${escHtml(label)}</span></legend></fieldset>
    </div>
  `;
}

/**
 * createMdTextarea — MD3 outlined textarea with <fieldset> native notch
 * @param {{ id?: string, label: string, rows?: number, required?: boolean, attrs?: string }} config
 * @returns {string} HTML string
 */
export function createMdTextarea(config) {
  const { id = '', label, rows = 5, required = false, attrs = '', value = '' } = config;
  const idAttr = id ? `id="${id}"` : '';
  const reqAttr = required ? 'required' : '';
  return `
    <div class="md-input-group">
      <textarea class="md-input" ${idAttr} placeholder=" " rows="${rows}" ${reqAttr} style="resize:none" ${attrs}>${escHtml(String(value))}</textarea>
      <label class="md-label">${escHtml(label)}</label>
      <fieldset class="md-border" aria-hidden="true"><legend><span>${escHtml(label)}</span></legend></fieldset>
    </div>
  `;
}

/**
 * createMdSelect — Custom div+ul select (no native <select>)
 * @param {{ id?: string, label?: string, options: {text: string, value: string}[], selected?: string, style?: string, onchange?: string }} config
 * @returns {string} HTML string
 */
export function createMdSelect(config) {
  const { id = '', label = '', options, selected = '', style = '' } = config;
  const containerId = id ? `${id}-container` : 'md-select-' + Math.random().toString(36).slice(2, 8);
  const hiddenId = id;
  const valueId = id ? `${id}-value` : '';

  const selectedOpt = options.find(o => o.value === selected) || options[0];
  const triggerLabel = label ? label : selectedOpt.text;

  const listItems = options.map(o =>
    `<li class="md-select-option${o.value === selected ? ' selected' : ''}" data-value="${escHtml(o.value)}">${escHtml(o.text)}</li>`
  ).join('');

  const styleAttr = style ? ` style="${style}"` : '';

  return `
    <div class="md-select-container" id="${containerId}"${styleAttr}>
      <div class="md-select-trigger">
        <span class="md-select-value" id="${valueId}">${escHtml(triggerLabel)}</span>
        <span class="md-select-arrow mi">arrow_drop_down</span>
      </div>
      <ul class="md-select-menu">${listItems}</ul>
      <input type="hidden" id="${hiddenId}" value="${escHtml(selected)}">
    </div>
  `;
}

/* ---- Global Event Delegation for Custom Select ---- */

document.addEventListener('click', (e) => {
  // 调试：记录所有点击目标
  if (e.target.closest('.md-select-container')) {
    console.log('[select-debug] click on:', e.target.tagName, e.target.className, 'closest-option:', !!e.target.closest('.md-select-option'), 'closest-trigger:', !!e.target.closest('.md-select-trigger'));
  }

  const trigger = e.target.closest('.md-select-trigger');
  if (trigger) {
    const container = trigger.closest('.md-select-container');
    if (container) {
      document.querySelectorAll('.md-select-container.open').forEach(c => {
        if (c !== container) c.classList.remove('open');
      });
      container.classList.toggle('open');
      console.log('[select] trigger click, open=', container.classList.contains('open'), container.id);
      e.stopPropagation();
    }
    return;
  }

  const option = e.target.closest('.md-select-option');
  if (option) {
    console.log('[select] option click:', option.getAttribute('data-value'), option.textContent);
    const container = option.closest('.md-select-container');
    if (container) {
      const value = option.getAttribute('data-value');
      const text = option.textContent;
      const hidden = container.querySelector('input[type="hidden"]');
      const valueEl = container.querySelector('.md-select-value');
      if (hidden) hidden.value = value;
      if (valueEl) valueEl.textContent = text;
      container.querySelectorAll('.md-select-option').forEach(li => {
        li.classList.toggle('selected', li === option);
      });
      container.classList.remove('open');
      container.dispatchEvent(new CustomEvent('md-select-change', { detail: { value, text }, bubbles: true }));
      e.stopPropagation();
    }
    return;
  }

  if (!e.target.closest('.md-select-container')) {
    document.querySelectorAll('.md-select-container.open').forEach(c => c.classList.remove('open'));
  }
});

/* =============================================
   Modal System
   ============================================= */

export function openModal(title, bodyHtml) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" onclick="closeModal()">
          <span class="mi">close</span>
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('active');
    overlay.animate(
      { backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.32)'] },
      { duration: 300, easing: Ease.decelerate, fill: 'forwards' }
    );
    const modal = overlay.querySelector('.modal');
    modal.animate(
      [
        { opacity: 0, transform: 'scale(0.82) translateY(32px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' },
      ],
      { duration: 450, easing: Ease.bounce, fill: 'forwards' }
    );
  });
}

export function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;
  const modal = overlay.querySelector('.modal');
  overlay.animate(
    { backgroundColor: ['rgba(0,0,0,0.32)', 'rgba(0,0,0,0)'] },
    { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
  );
  modal.animate(
    [
      { opacity: 1, transform: 'scale(1) translateY(0)' },
      { opacity: 0, transform: 'scale(0.92) translateY(12px)' },
    ],
    { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
  ).onfinish = () => overlay.remove();
}

// 挂载到 window 供 openModal 模板中的 onclick="closeModal()" 使用
window.closeModal = closeModal;

/* =============================================
   登录提示组件（统一风格）
   ============================================= */

/**
 * 渲染登录提示卡片
 * @returns {string} HTML 字符串
 */
export function renderLoginPrompt() {
  return `
    <div class="profile-page">
      <div class="profile-empty-card">
        <span class="mi profile-empty-icon">person_off</span>
        <h2 class="profile-empty-title">尚未登录</h2>
        <p class="profile-empty-desc">登录后即可使用完整功能</p>
        <button class="btn btn-primary" id="login-prompt-btn">
          <span class="mi">login</span>
          前往登录
        </button>
      </div>
    </div>
  `;
}

/**
 * 绑定登录提示按钮事件（点击后在当前页面内渲染登录表单）
 * @param {HTMLElement} container - 页面容器
 * @param {Function} renderAuthFn - renderAuth 函数，接收 container 参数
 */
export function bindLoginPrompt(container, renderAuthFn) {
  const btn = container.querySelector('#login-prompt-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (renderAuthFn) renderAuthFn(container);
    });
  }
}

/* =============================================
   Bottom Sheet — MD3 底部动作菜单
   ============================================= */

/**
 * 显示 MD3 底部动作菜单
 * @param {Array} items - [{ icon, label, onClick, danger, hideOnDesktop }]
 *   - icon: Material Icons 名称（可选，取消项不需要）
 *   - label: 菜单文字
 *   - onClick: 点击回调（可选）
 *   - danger: 红色文字（用于"恢复默认"等操作，可选）
 *   - hideOnDesktop: 桌面端隐藏（如"拍照上传"，可选）
 *   - isCancel: 是否为取消按钮（自动放到最下面，可选）
 */
export function showBottomSheet(items) {
  // 移除已有的
  const existing = document.querySelector('.bottom-sheet-overlay');
  if (existing) existing.remove();

  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  // 分离常规项和取消项
  const regularItems = items.filter(i => !i.isCancel);
  const cancelItem = items.find(i => i.isCancel);

  // 过滤桌面端隐藏项
  const visibleItems = regularItems.filter(i => !i.hideOnDesktop || isMobile);

  const itemsHtml = visibleItems.map((item, i) => {
    const showDivider = i < visibleItems.length - 1 || cancelItem;
    const divider = showDivider ? '<div class="bottom-sheet-divider"></div>' : '';
    const dangerClass = item.danger ? ' bottom-sheet-item--danger' : '';
    return `
      <button class="bottom-sheet-item${dangerClass}" data-bs-index="${i}">
        ${item.icon ? `<span class="mi" style="font-size:24px;color:var(--md-on-surface-variant);flex-shrink:0">${item.icon}</span>` : ''}
        <span>${item.label}</span>
      </button>
      ${divider}
    `;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-overlay';
  overlay.id = 'bottom-sheet-overlay';
  overlay.innerHTML = `
    <div class="bottom-sheet">
      <div class="bottom-sheet-items">${itemsHtml}</div>
      ${cancelItem ? `<button class="bottom-sheet-cancel">${cancelItem.label}</button>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);

  // 绑定点击事件
  overlay.querySelectorAll('.bottom-sheet-item').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const fn = visibleItems[i]?.onClick;
      closeBottomSheet();
      if (fn) fn();
    });
  });

  overlay.querySelector('.bottom-sheet-cancel')?.addEventListener('click', () => {
    closeBottomSheet();
  });

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeBottomSheet();
  });

  // Escape 关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeBottomSheet(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  // 入场动画
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
}

function closeBottomSheet() {
  const overlay = document.querySelector('.bottom-sheet-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  setTimeout(() => overlay.remove(), 300);
}

window.closeBottomSheet = closeBottomSheet;
