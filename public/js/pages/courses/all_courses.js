/**
 * pages/courses/all_courses.js — 课程广场（全校大库目录 · 全局检索）
 * registerPage: allcourse
 *
 * 职责：展示全校大课卡片流、搜索过滤、导航到统一详情页
 * 大课 = 清洗后同名课程的集合（如"离散数学"聚合"离散数学01班""02班"...）
 */

import { apiGet } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { escHtml, createMdInput } from '../../components/ui.js';

/* =============================================
   大课名称清洗
   物理剥离末尾班级号数字与"班"字
   强行保留括号内教学层次限定词
   ============================================= */

export function cleanBigCourseName(title) {
  if (!title) return '';
  const parens = title.match(/[（(].+?[)）]/g) || [];
  let temp = title;
  parens.forEach((p, i) => { temp = temp.replace(p, `__PH${i}__`); });
  // 清除末尾班级号：支持 "07班"、"25班"、孤立数字 "25"、带空格 " 25"
  temp = temp.replace(/\d{1,3}\s*班\s*$/, '');
  temp = temp.replace(/[\s ]*\d{1,3}\s*$/, '');
  temp = temp.replace(/\d{1,3}$/, '');
  parens.forEach((p, i) => { temp = temp.replace(`__PH${i}__`, p); });
  return temp.trim();
}

/* =============================================
   全校大课缓存（API 已只返回大课）
   ============================================= */

let _bigCoursesList = []; // [{ id, name, totalCount }, ...]
let _plazaLoaded = false;

async function loadPlazaDataOnce() {
  if (_plazaLoaded) return;
  try {
    const raw = await apiGet('/api/courses/all');
    // API 已只返回大课，直接映射
    _bigCoursesList = raw.map(c => ({
      id: c.id,
      name: c.title,
      totalCount: c.enrollment_count || 0,
    })).sort((a, b) => b.totalCount - a.totalCount);
  } catch {
    _bigCoursesList = [];
  }
  _plazaLoaded = true;
}

/**
 * navigateToPlazaCourseById — 根据 courseId 找到对应大课并导航
 * 供全局搜索和收藏页跳转使用
 */
export async function navigateToPlazaCourseById(courseId, postId) {
  await loadPlazaDataOnce();
  // 直接用 courseId 导航（已经是大课 ID，或通过 API 查询）
  window._courseDetailTargetPostId = postId || null;
  navigateTo('course-detail', courseId);
  return true;
}

/* =============================================
   Page: 课程广场列表
   ============================================= */

registerPage('allcourse', async (container) => {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="margin-bottom:0"><span class="mi" style="vertical-align:-4px;margin-right:4px">public</span>课程广场</h1>
        <p class="text-secondary" style="margin-top:4px;font-size:var(--text-sm)">全校课程档案馆 · 跨届检索</p>
      </div>
    </div>
    <div class="search-bar-row form-row" style="margin-bottom:var(--space-6)">
      ${createMdInput({ id: 'plaza-search', label: '搜索课程', placeholder: ' ', style: 'flex:1;margin-bottom:0', attrs: 'oninput="filterPlazaCourses(this.value)"' })}
      <button class="btn btn-primary" onclick="filterPlazaCourses(document.getElementById('plaza-search').value)">搜索</button>
    </div>
    <div id="plaza-course-list">
      <div class="card"><p class="text-secondary">加载中...</p></div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
  animIn(container.querySelector('#plaza-search')?.closest('[style*="display:flex"]') || container.querySelector('#plaza-search')?.closest('div'), { y: 12, delay: 60, dur: 350 });

  await loadPlazaDataOnce();
  renderPlazaList(_bigCoursesList);
});

function renderPlazaList(list) {
  const listEl = document.getElementById('plaza-course-list');
  if (!listEl) return;

  if (list.length === 0) {
    listEl.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">search_off</span>
        <p class="text-secondary" style="margin-top:12px">未找到匹配课程</p>
      </div>
    `;
    animIn(listEl.querySelector('.card'), { y: 20, delay: 80 });
    return;
  }

  listEl.innerHTML = list.map(item => `
    <div class="card mb-4 clickable plaza-course-card" onclick="navigateTo('course-detail', ${item.id})">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="flex:1;min-width:0">
          <h3 class="card-title">${escHtml(item.name)}</h3>
        </div>
        <div style="flex-shrink:0;margin-left:16px">
          <span style="font-size:var(--text-sm);color:var(--md-primary);font-weight:600;white-space:nowrap">
            <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${item.totalCount} 人
          </span>
        </div>
      </div>
    </div>
  `).join('');

  const cards = listEl.querySelectorAll('.plaza-course-card');
  if (cards.length) animStagger(Array.from(cards), { y: 22, dur: 420, gap: 60 });
}

export function filterPlazaCourses(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderPlazaList(_bigCoursesList);
    return;
  }
  const filtered = _bigCoursesList.filter(item =>
    item.name.toLowerCase().includes(q)
  );
  renderPlazaList(filtered);
}
