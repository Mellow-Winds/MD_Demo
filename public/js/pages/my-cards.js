/**
 * pages/my-cards.js — 我的卡片模板管理页
 *
 * 路由：/explore/cards/my
 * 展示当前用户创建的所有 UGC 卡片模板，支持编辑和删除
 */

import { registerPage, navigateTo, animIn, animStagger } from '../core/router.js';
import { apiGet, apiDelete, isLoggedIn } from '../core/api.js';
import { showToast, openModal, closeModal, escHtml } from '../components/ui.js';

async function renderMyCards(container) {
  if (!isLoggedIn()) { showToast('请先登录'); navigateTo('explore'); return; }

  let templates = [];
  try {
    templates = await apiGet('/api/card-templates?creator_id=me');
    if (templates.error) templates = [];
  } catch (e) { templates = []; }

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" id="my-cards-back-btn">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <h1 class="page-title" style="margin:0">我的卡片</h1>
      <button class="btn btn-primary btn-compact" id="my-cards-new-btn">
        <i class="ri-add-line"></i> 新建
      </button>
    </div>
    <div class="my-cards-grid" id="my-cards-grid"></div>
  `;

  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  const grid = container.querySelector('#my-cards-grid');
  if (!grid) return;

  if (templates.length === 0) {
    grid.innerHTML = `
      <div class="card" style="text-align:center;padding:48px 24px">
        <i class="ri-emotion-happy-line" style="font-size:48px;color:#9e9e9e"></i>
        <p class="text-secondary" style="margin-top:16px">还没有创建卡片模板</p>
        <button class="btn btn-primary" id="my-cards-empty-new" style="margin-top:12px">
          <i class="ri-add-line"></i> 创建第一个卡片
        </button>
      </div>`;
    grid.querySelector('#my-cards-empty-new')?.addEventListener('click', () => navigateTo('card-editor'));
    return;
  }

  grid.innerHTML = templates.map(t => {
    const styles = t.styles || {};
    return `
      <div class="card my-card-item" style="--card-accent:${styles.accent || 'transparent'};border-color:${styles.accent || 'transparent'};background:${styles.bg || '#fff'}">
        <div class="my-card-header">
          <i class="${t.icon || 'ri-layout-grid-line'}" style="font-size:20px"></i>
          <h3 style="margin:0;font-size:15px">${escHtml(t.name)}</h3>
          <span class="badge-community" style="margin-left:auto">社区</span>
        </div>
        <p class="text-secondary" style="font-size:12px;margin:8px 0">${escHtml(t.description || '')}</p>
        <div class="my-card-footer">
          <span class="text-secondary" style="font-size:11px"><i class="ri-bar-chart-line"></i> 使用 ${t.usage_count || 0} 次</span>
          <span class="text-secondary" style="font-size:11px"><i class="ri-price-tag-3-line"></i> ${getCategoryName(t.category)}</span>
        </div>
        <div class="my-card-actions">
          <button class="btn btn-sm btn-secondary my-card-edit-btn" data-id="${t.id}">
            <i class="ri-edit-line"></i> 编辑
          </button>
          <button class="btn btn-sm btn-secondary my-card-delete-btn" data-id="${t.id}" data-name="${escHtml(t.name)}">
            <i class="ri-delete-bin-line"></i> 删除
          </button>
        </div>
      </div>`;
  }).join('');

  animStagger(grid.querySelectorAll('.my-card-item'), { y: 16, dur: 350, stagger: 60 });

  // 编辑
  grid.querySelectorAll('.my-card-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo('card-editor', btn.dataset.id));
  });

  // 删除
  grid.querySelectorAll('.my-card-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      openModal('删除卡片', `
        <p>确定要删除 <strong>${name}</strong> 吗？已使用此模板的卡片不受影响。</p>
        <div class="card-edit-actions" style="margin-top:16px">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="my-card-delete-confirm">删除</button>
        </div>
      `);

      setTimeout(() => {
        document.getElementById('my-card-delete-confirm')?.addEventListener('click', async () => {
          closeModal();
          const res = await apiDelete(`/api/card-templates/${id}`);
          if (res && res.error) { showToast(res.error); return; }
          showToast('已删除');
          renderMyCards(container);
        });
      }, 50);
    });
  });

  // 新建按钮
  container.querySelector('#my-cards-new-btn')?.addEventListener('click', () => navigateTo('card-editor'));
  // 返回按钮
  container.querySelector('#my-cards-back-btn')?.addEventListener('click', () => navigateTo('explore'));
}

function getCategoryName(cat) {
  const map = { study: '学习', social: '社交', trade: '交易', project: '项目', general: '通用' };
  return map[cat] || cat;
}

registerPage('my-cards', (container) => renderMyCards(container));
