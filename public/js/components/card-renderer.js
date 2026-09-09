// card-renderer.js — 组件化卡片渲染器
// 将 card.components JSON 渲染为 HTML，8种原子类型

import { escHtml } from './ui.js';

/**
 * 渲染一张完整卡片
 * @param {Object} card - { id, title, template_id, components, max_participants, current_count, status, participants, my_status, my_votes }
 * @param {Object} opts - { compact: boolean, onJoin, onVote }
 * @returns {string} HTML
 */
export function renderCard(card, opts = {}) {
  const { compact = false, showActions = true } = opts;
  const components = Array.isArray(card.components) ? card.components : [];

  const templateAttr = card.template_id ? ` data-template="${card.template_id}"` : '';
  const styles = card.styles || {};
  const styleAttr = (styles.bg || styles.accent)
    ? ` style="background:${styles.bg || '#fff'};border-color:${styles.accent || '#1565C0'}"`
    : '';
  let html = `<div class="explore-card" data-card-id="${card.id || ''}"${templateAttr}${styleAttr}>`;

  // 卡片标题
  if (card.title) {
    html += `<div class="explore-card-header">
      <h4 class="explore-card-title">${escHtml(card.title)}</h4>
      ${renderCardStatus(card.status)}
    </div>`;
  }

  // 模块列表
  if (components.length > 0) {
    html += `<div class="explore-card-modules">`;
    const maxShow = compact ? 3 : components.length;
    for (let i = 0; i < Math.min(maxShow, components.length); i++) {
      html += renderModule(components[i], i, card.id, card.my_votes);
    }
    if (compact && components.length > maxShow) {
      html += `<div class="explore-card-more">还有 ${components.length - maxShow} 项...</div>`;
    }
    html += `</div>`;
  }

  const isOwner = opts.isOwner || false;

  // 参与者信息 + 操作按钮（非 compact 模式）
  if (!compact && showActions && card.max_participants > 0) {
    html += renderParticipantsSection(card);
  }

  // 非 compact 模式下的操作按钮（含编辑按钮，仅拥有者可见）
  if (!compact && (showActions || isOwner)) {
    html += renderCardActions(card, isOwner);
  }

  html += `</div>`;
  return html;
}

/**
 * 渲染单个模块
 */
export function renderModule(mod, index, cardId, myVotes = {}) {
  if (!mod || !mod.type) return '';
  const icon = mod.icon || getDefaultIcon(mod.type);
  const label = mod.label || '';

  switch (mod.type) {
    case 'input':
      return renderInputModule(icon, label, mod.value);
    case 'link':
      return renderLinkModule(icon, label, mod.value);
    case 'contact':
      return renderContactModule(icon, label, mod.value);
    case 'price':
      return renderPriceModule(icon, label, mod.value);
    case 'tags':
      return renderTagsModule(icon, label, mod.value);
    case 'vote':
      return renderVoteModule(mod, index, cardId, myVotes[index] || []);
    case 'timer':
      return renderTimerModule(icon, label, mod.value);
    case 'days_matter':
      return renderDaysMatterModule(icon, label, mod.value);
    default:
      return renderInputModule(icon, label, mod.value);
  }
}

// ---- 各类型渲染函数 ----

function renderInputModule(icon, label, value) {
  return `<div class="module-row">
    <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
    <span class="module-label">${escHtml(label)}</span>
    <span class="module-value">${escHtml(value || '')}</span>
  </div>`;
}

function renderLinkModule(icon, label, value) {
  if (!value) return renderInputModule(icon, label, '');
  const safeUrl = escHtml(value);
  return `<div class="module-row">
    <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
    <span class="module-label">${escHtml(label)}</span>
    <a class="module-value module-link" href="${safeUrl}" target="_blank" rel="noopener">点击查看 →</a>
  </div>`;
}

function renderContactModule(icon, label, value) {
  return `<div class="module-row module-row-contact">
    <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
    <span class="module-label">${escHtml(label)}</span>
    <span class="module-value module-contact-value">${escHtml(value || '')}</span>
    ${value ? `<button class="btn-icon module-copy-btn" data-copy="${escHtml(value)}" title="复制"><i class="ri-file-copy-line"></i></button>` : ''}
  </div>`;
}

function renderPriceModule(icon, label, value) {
  return `<div class="module-row module-row-price">
    <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
    <span class="module-label">${escHtml(label)}</span>
    <span class="module-value module-price-value">${escHtml(value || '')}</span>
  </div>`;
}

function renderTagsModule(icon, label, value) {
  const tags = Array.isArray(value) ? value : (value ? [value] : []);
  const tagsHtml = tags.map(t => `<span class="post-chip">${escHtml(String(t))}</span>`).join('');
  return `<div class="module-row module-row-tags">
    <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
    <span class="module-label">${escHtml(label)}</span>
    <div class="module-value module-tags-value">${tagsHtml || '<span class="text-secondary">-</span>'}</div>
  </div>`;
}

function renderVoteModule(mod, index, cardId, myVoteOptions = []) {
  const options = mod.options || [];
  const totalVotes = options.reduce((s, o) => s + (o.votes || 0), 0);
  const icon = mod.icon || 'ri-bar-chart-2-line';

  let optionsHtml = '';
  for (const opt of options) {
    const pct = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
    const isSelected = myVoteOptions.includes(opt.id);
    optionsHtml += `
      <div class="module-vote-option ${isSelected ? 'module-vote-selected' : ''}" data-option-id="${escHtml(opt.id)}">
        <div class="module-vote-bar" style="width:${pct}%"></div>
        <span class="module-vote-text">${escHtml(opt.text)}</span>
        <span class="module-vote-pct">${pct}%</span>
      </div>`;
  }

  return `<div class="module-vote" data-card-id="${cardId}" data-module-index="${index}">
    <div class="module-vote-header">
      <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
      <span class="module-vote-title">${escHtml(mod.label || '')}</span>
    </div>
    <div class="module-vote-options">${optionsHtml}</div>
    <div class="module-vote-footer">
      <span class="text-secondary">共 ${totalVotes} 人参与</span>
    </div>
  </div>`;
}

function renderTimerModule(icon, label, value) {
  const targetTime = value || '';
  let countdownHtml = '';
  if (targetTime) {
    countdownHtml = `<span class="module-timer-digits" data-target="${escHtml(targetTime)}">--:--:--:--</span>
      <span class="timer-unit">天:时:分:秒</span>`;
  }
  return `<div class="module-timer">
    <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
    <span class="module-timer-label">${escHtml(label)}</span>
    <div class="module-timer-countdown">${countdownHtml}</div>
  </div>`;
}

function renderDaysMatterModule(icon, label, value) {
  const targetDate = value || '';
  let daysHtml = '--';
  let dateStr = '';
  if (targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    daysHtml = diff >= 0 ? diff : '已过';
    dateStr = targetDate.replace(/T.*/, '').replace(/-/g, '/');
  }
  return `<div class="module-days-matter">
    <span class="module-icon"><i class="${escHtml(icon)}"></i></span>
    <span class="module-days-label">${escHtml(label)}</span>
    <div class="module-days-number">${daysHtml}</div>
    <div class="module-days-unit">天</div>
    ${dateStr ? `<div class="module-days-date">${escHtml(dateStr)}</div>` : ''}
  </div>`;
}

// ---- 辅助函数 ----

function renderCardStatus(status) {
  const map = {
    open: { cls: 'status-open', text: '招募中' },
    full: { cls: 'status-full', text: '已满' },
    closed: { cls: 'status-closed', text: '已关闭' },
    expired: { cls: 'status-closed', text: '已过期' }
  };
  const s = map[status] || map.open;
  return `<span class="status-badge ${s.cls}">${s.text}</span>`;
}

function renderParticipantsSection(card) {
  if (!card.max_participants) return '';
  const count = card.current_count || 0;
  const participants = card.participants || [];
  const accepted = participants.filter(p => p.status === 'accepted');
  const names = accepted.map(p => p.nickname || p.username).join('、') || '暂无';

  return `<div class="module-participants">
    <span class="module-participants-label">参与者 (${count}/${card.max_participants})</span>
    <span class="module-participants-names">${escHtml(names)}</span>
  </div>`;
}

function renderCardActions(card, isOwner = false) {
  const myStatus = card.my_status;
  let btnHtml = '';

  if (myStatus === 'accepted') {
    btnHtml = `<button class="btn btn-sm btn-secondary" data-action="cancel-join" data-card-id="${card.id}">取消参与</button>`;
  } else if (myStatus === 'pending') {
    btnHtml = `<button class="btn btn-sm btn-secondary" data-action="cancel-join" data-card-id="${card.id}">取消申请</button>
      <span class="text-secondary" style="font-size:12px">等待批准</span>`;
  } else if (myStatus === 'rejected') {
    btnHtml = `<span class="text-secondary" style="font-size:12px">未通过</span>`;
  } else if (card.status === 'open') {
    const needApproval = card.approval_required ? ' <span class="text-secondary" style="font-size:11px">需批准</span>' : '';
    btnHtml = `<button class="btn btn-sm btn-primary" data-action="join" data-card-id="${card.id}">加入</button>${needApproval}`;
  } else if (card.status === 'full') {
    btnHtml = `<span class="text-secondary" style="font-size:12px">已满员</span>`;
  }

  // 卡片拥有者可见编辑按钮
  if (isOwner) {
    btnHtml += `<button class="btn btn-sm btn-secondary" data-action="edit" data-card-id="${card.id}" style="margin-left:auto"><i class="ri-edit-line"></i> 编辑</button>`;
  }

  return btnHtml ? `<div class="explore-card-actions">${btnHtml}</div>` : (isOwner ? `<div class="explore-card-actions"><button class="btn btn-sm btn-secondary" data-action="edit" data-card-id="${card.id}" style="margin-left:auto"><i class="ri-edit-line"></i> 编辑</button></div>` : '');
}

function getDefaultIcon(type) {
  const map = {
    input: 'ri-text',
    link: 'ri-links-line',
    contact: 'ri-wechat-line',
    price: 'ri-money-cny-circle-line',
    tags: 'ri-price-tag-3-line',
    vote: 'ri-bar-chart-2-line',
    timer: 'ri-timer-line',
    days_matter: 'ri-calendar-event-line'
  };
  return map[type] || 'ri-text';
}

/**
 * 启动倒计时更新（timer模块）
 */
export function startTimers(container) {
  const timers = container.querySelectorAll('.module-timer-digits[data-target]');
  if (timers.length === 0) return;

  function update() {
    for (const el of timers) {
      const target = new Date(el.dataset.target);
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        el.textContent = '已截止';
        continue;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  update();
  return setInterval(update, 1000);
}

/**
 * 绑定卡片交互事件（投票、加入、复制）
 */
export function bindCardActions(container, { onJoin, onCancelJoin, onVote, onCopy, onEdit }) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      // 复制按钮
      const copyBtn = e.target.closest('.module-copy-btn');
      if (copyBtn) {
        const text = copyBtn.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
          if (onCopy) onCopy(text);
        } catch (err) {
          // fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          if (onCopy) onCopy(text);
        }
      }
      return;
    }

    const action = btn.dataset.action;
    const cardId = btn.dataset.cardId;

    if (action === 'join' && onJoin) {
      onJoin(cardId, btn);
    } else if (action === 'cancel-join' && onCancelJoin) {
      onCancelJoin(cardId, btn);
    } else if (action === 'edit' && onEdit) {
      onEdit(cardId, btn);
    }
  });

  // 投票点击
  container.addEventListener('click', async (e) => {
    const option = e.target.closest('.module-vote-option');
    if (!option) return;
    const voteContainer = option.closest('.module-vote');
    if (!voteContainer) return;
    const cardId = voteContainer.dataset.cardId;
    const moduleIndex = voteContainer.dataset.moduleIndex;
    const optionId = option.dataset.optionId;
    if (onVote && cardId !== undefined && moduleIndex !== undefined && optionId) {
      onVote(cardId, moduleIndex, optionId, voteContainer);
    }
  });
}

/**
 * 渲染帖子卡片（列表中的缩略视图）
 * 数据来自 GET /api/explore/posts 列表接口
 * - post.text_preview: 文字摘要（后端提取）
 * - post.card_previews: 卡片预览数组 [{ title, template_id, components }]
 */
export function renderPostCard(post) {
  const nickname = post.creator_nickname || post.creator_name || '匿名';
  const timeAgo = formatTimeAgo(post.created_at);

  // 文字摘要（兼容新旧格式）
  const textPreview = post.text_preview || (post.content ? truncate(post.content, 80) : '');

  // 卡片缩略（兼容新旧格式）
  const cardPreviews = post.card_previews || post.cards || [];
  let cardsHtml = '';
  if (cardPreviews.length > 0) {
    cardsHtml = '<div class="post-card-previews">';
    for (const card of cardPreviews.slice(0, 2)) {
      cardsHtml += renderCard(card, { compact: true, showActions: false });
    }
    if (cardPreviews.length > 2) {
      cardsHtml += `<div class="post-card-more">还有 ${cardPreviews.length - 2} 张卡片</div>`;
    }
    cardsHtml += '</div>';
  }

  return `<div class="card card-interactive explore-post-card" data-post-id="${post.id}">
    <div class="explore-post-meta">
      <span class="text-secondary">${escHtml(timeAgo)}</span>
      <span class="text-secondary">${escHtml(nickname)}</span>
    </div>
    <h3 class="explore-post-title">${escHtml(post.title)}</h3>
    ${textPreview ? `<p class="explore-post-preview">${escHtml(textPreview)}</p>` : ''}
    ${cardsHtml}
    <div class="explore-post-footer">
      <span class="text-secondary"><i class="ri-chat-3-line"></i> ${post.comment_count || 0}</span>
      ${cardPreviews.length > 0 ? `<span class="text-secondary"><i class="ri-layout-grid-line"></i> ${cardPreviews.length} 张卡片</span>` : ''}
    </div>
  </div>`;
}

// ---- 工具函数 ----

function truncate(str, max) {
  if (!str) return '';
  str = str.replace(/[#*_`~\[\]]/g, '').replace(/\n+/g, ' ');
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}
