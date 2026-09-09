/**
 * pages/courses/plaza.js — 课程广场（全校大课档案馆 · 只读熔断）
 * registerPage: allcourse, plaza-course
 *
 * 大课 = 清洗后同名课程的集合（如"离散数学"聚合"离散数学01班""离散数学02班"...）
 * 物理只读：绝不加载成员。
 */

import { apiGet } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { escHtml, formatTime, formatFileSize, createMdInput } from '../../components/ui.js';
import { getFavoriteCourseIds, getFavoritePostIds, renderCourseFavoriteButton, renderPostFavoriteButton } from '../favorites.js';
import { renderPostAttachments } from './post_attachments.js';

/* =============================================
   大课名称清洗
   物理剥离末尾班级号数字与"班"字
   强行保留括号内教学层次限定词
   ============================================= */

function cleanBigCourseName(title) {
  if (!title) return '';
  const parens = title.match(/[（(].+?[)）]/g) || [];
  let temp = title;
  parens.forEach((p, i) => { temp = temp.replace(p, `__PH${i}__`); });
  // 清除末尾班级号：支持 "07班"、"25班"、孤立数字 "25"、带空格 " 25"
  temp = temp.replace(/\d{1,3}\s*班\s*$/, '');
  temp = temp.replace(/[\s ]*\d{1,3}\s*$/, '');
  temp = temp.replace(/\d{1,3}$/, '');
  parens.forEach((p, i) => { temp = temp.replace(`__PH${i}__`, p); });
  return temp.trim();
}

/* =============================================
   全校课程聚合缓存
   ============================================= */

let _allCoursesRaw = [];
let _bigCoursesMap = {};  // { bigName: [course, course, ...] }
let _bigCoursesList = []; // [{ name, totalCount, courseIds }, ...]
let _plazaLoaded = false;

async function loadPlazaDataOnce() {
  if (_plazaLoaded) return;
  try {
    _allCoursesRaw = await apiGet('/api/courses/all');
  } catch {
    _allCoursesRaw = [];
  }

  // 按大课名聚合
  _bigCoursesMap = {};
  for (const c of _allCoursesRaw) {
    const big = cleanBigCourseName(c.title);
    if (!big) continue;
    if (!_bigCoursesMap[big]) _bigCoursesMap[big] = [];
    _bigCoursesMap[big].push(c);
  }

  _bigCoursesList = Object.entries(_bigCoursesMap).map(([name, courses]) => {
    const totalEnrollment = courses.reduce((sum, c) => sum + (c.enrollment_count || 0), 0);
    return {
      name,
      courseIds: courses.map(c => c.id),
      totalCount: totalEnrollment,
      courseCount: courses.length,
    };
  }).sort((a, b) => b.totalCount - a.totalCount);

  _plazaLoaded = true;
}

export async function navigateToPlazaCourseById(courseId, postId) {
  await loadPlazaDataOnce();
  const idx = _bigCoursesList.findIndex(item => item.courseIds.includes(Number(courseId)));
  if (idx < 0) return false;
  window._plazaTargetPostId = postId || null;
  window._plazaCourseId = Number(courseId);
  navigateTo('plaza-course', Number(courseId));
  return true;
}

/* =============================================
   Page: 课程广场列表
   ============================================= */

registerPage('allcourse', async (container) => {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="margin-bottom:0">课程广场</h1>
        <p class="text-secondary" style="margin-top:4px;font-size:var(--text-sm)">全校课程档案馆 · 只读浏览</p>
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

  listEl.innerHTML = list.map((item) => `
    <div class="card mb-4 clickable plaza-course-card" onclick="navigateTo('plaza-course', ${item.courseIds[0]})">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="flex:1;min-width:0">
          <h3 class="card-title">${escHtml(item.name)}</h3>
          <p class="text-secondary" style="margin-top:4px;font-size:var(--text-sm)">${item.courseCount} 个班级</p>
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

/* =============================================
   Page: 大课详情（只读 · 双轨渲染）
   data = _bigCoursesList 的索引
   ============================================= */

window._plazaSpace = {};

registerPage('plaza-course', async (container, courseIdOrIdx) => {
  await loadPlazaDataOnce();

  // 优先按 courseId 匹配，回退到索引（旧版兼容）
  let bigCourse = _bigCoursesList.find(item => item.courseIds.includes(Number(courseIdOrIdx)));
  if (!bigCourse && typeof courseIdOrIdx === 'number' && courseIdOrIdx < _bigCoursesList.length) {
    bigCourse = _bigCoursesList[courseIdOrIdx];
  }
  if (!bigCourse) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">error_outline</span>
        <p class="text-secondary" style="margin-top:12px">课程不存在</p>
        <button class="btn btn-secondary mt-6" onclick="navigateTo('allcourse')">
          <span class="mi">arrow_back</span> 返回课程广场
        </button>
      </div>
    `;
    return;
  }

  window._plazaSpace = {
    bigCourse,
    activeTab: null,
  };
  const favoriteCourseId = window._plazaCourseId || bigCourse.courseIds[0];
  const favoriteCourseIds = await getFavoriteCourseIds();

  container.innerHTML = `
    <div class="page-header">
      <div style="flex:1;min-width:0">
        <h1 class="page-title" style="margin-bottom:4px">${escHtml(bigCourse.name)}</h1>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <p class="text-secondary" style="margin:0">
            ${bigCourse.courseCount} 个班级 · ${bigCourse.totalCount} 人 · 课程广场（只读）
          </p>
          ${renderCourseFavoriteButton(favoriteCourseId, favoriteCourseIds.has(favoriteCourseId))}
        </div>
      </div>
    </div>
    <div class="md-pills" id="plaza-pills">
      <button class="md-pill-btn active" data-tab="forum" onclick="switchPlazaTab('forum')">
        <span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 论坛
      </button>
      <button class="md-pill-btn" data-tab="materials" onclick="switchPlazaTab('materials')">
        <span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料
      </button>
    </div>
    <div id="plaza-tab-content" style="min-height:200px"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
  animIn(container.querySelector('.md-pills'), { y: 12, delay: 80, dur: 350 });

  await switchPlazaTab('forum');
});

/* ---- Tab切换 ---- */

export async function switchPlazaTab(tab) {
  if (tab === window._plazaSpace.activeTab) return;
  window._plazaSpace.activeTab = tab;

  document.querySelectorAll('#plaza-pills .md-pill-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  const contentEl = document.getElementById('plaza-tab-content');
  if (!contentEl) return;

  const { courseIds } = window._plazaSpace.bigCourse;

  // 平滑切换：先淡出再加载再淡入
  contentEl.style.transition = 'opacity 0.12s var(--ease-standard)';
  contentEl.style.opacity = '0';
  await new Promise(r => setTimeout(r, 120));

  switch (tab) {
    case 'forum':
      await renderPlazaForumTab(contentEl, courseIds);
      break;
    case 'materials':
      await renderPlazaMaterialsTab(contentEl, courseIds);
      break;
  }

  contentEl.style.opacity = '1';
}

/* ---- 从多个小课加载帖子 ---- */

async function fetchPostsFromCourses(courseIds) {
  const results = await Promise.all(
    courseIds.map(id => apiGet(`/api/courses/${id}/posts`).catch(() => []))
  );
  // 给每个帖子附加来源 courseTitle
  const allPosts = [];
  for (let i = 0; i < results.length; i++) {
    const posts = results[i];
    const course = _allCoursesRaw.find(c => c.id === courseIds[i]);
    for (const p of posts) {
      p._sourceTitle = course ? course.title : '';
      allPosts.push(p);
    }
  }
  // 按时间倒序
  allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return allPosts;
}

/* ---- 从多个小课加载资料 ---- */

async function fetchMaterialsFromCourses(courseIds) {
  const results = await Promise.all(
    courseIds.map(id => apiGet(`/api/materials/courses/${id}`).catch(() => ({ materials: [] })))
  );
  const allMaterials = [];
  for (let i = 0; i < results.length; i++) {
    const data = results[i];
    const materials = data?.materials || [];
    const course = _allCoursesRaw.find(c => c.id === courseIds[i]);
    for (const m of materials) {
      m._sourceTitle = course ? course.title : '';
      allMaterials.push(m);
    }
  }
  allMaterials.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return allMaterials;
}

/* ---- 论坛标签页 ---- */

async function renderPlazaForumTab(contentEl, courseIds) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const posts = await fetchPostsFromCourses(courseIds);
  const favoritePostIds = await getFavoritePostIds();

  if (posts.length === 0) {
    contentEl.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">forum</span>
        <p class="text-secondary" style="margin-top:12px">暂无讨论动态</p>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = posts.map(p => {
    // 出处角标：来自哪个小班
    const originTag = p._sourceTitle
      ? `<span class="plaza-origin-tag">来自 ${escHtml(p._sourceTitle)}</span>`
      : '';
    return `
      <div class="card mb-4 plaza-post-card" id="post-${p.id}">
        ${originTag ? `<div style="margin-bottom:8px">${originTag}</div>` : ''}
        <h3 class="card-title">${escHtml(p.title)}</h3>
        <p style="margin-top:8px;white-space:pre-wrap">${escHtml(p.content)}</p>
        ${renderPostAttachments(p.attachments)}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:var(--text-sm);color:var(--md-on-surface-variant)">
          <span><button class="user-profile-link" onclick="event.stopPropagation();navigateTo('profile-user', ${p.author_id})">${escHtml(p.author_name)}</button> · ${formatTime(p.created_at)}</span>
          ${renderPostFavoriteButton(p.id, favoritePostIds.has(p.id))}
          <span>
            <span class="mi" style="font-size:16px;vertical-align:-3px">chat_bubble_outline</span> ${p.comment_count || 0} 回复
          </span>
        </div>
      </div>
    `;
  }).join('');

  const cards = contentEl.querySelectorAll('.plaza-post-card');
  if (cards.length) animStagger(Array.from(cards), { y: 20, dur: 400, gap: 50 });
  if (window._plazaTargetPostId) {
    document.getElementById(`post-${window._plazaTargetPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window._plazaTargetPostId = null;
  }
}

/* ---- 资料标签页 ---- */

async function renderPlazaMaterialsTab(contentEl, courseIds) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const materials = await fetchMaterialsFromCourses(courseIds);

  if (materials.length === 0) {
    contentEl.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">folder_open</span>
        <p class="text-secondary" style="margin-top:12px">暂无资料</p>
      </div>
    `;
    return;
  }

  const typeIcons = { pdf: 'picture_as_pdf', ppt: 'slideshow', doc: 'description', image: 'image', other: 'insert_drive_file' };
  const typeColors = { pdf: '#e53935', ppt: '#FB8C00', doc: '#1E88E5', image: '#43A047', other: '#757575' };

  contentEl.innerHTML = materials.map(m => `
    <div class="card material-card">
      <div class="material-card-inner">
        <div class="material-icon" style="color:${typeColors[m.file_type] || typeColors.other}">
          <span class="mi" style="font-size:28px">${typeIcons[m.file_type] || typeIcons.other}</span>
          <span style="font-size:10px;text-transform:uppercase">${m.file_type}</span>
        </div>
        <div class="material-card-body">
          <div class="material-card-title">${escHtml(m.title)}</div>
          ${m.description ? `<div class="material-card-desc">${escHtml(m.description)}</div>` : ''}
          <div class="material-meta-row">
            ${m._sourceTitle ? `<span class="material-meta-item"><span class="mi">school</span> ${escHtml(m._sourceTitle)}</span>` : ''}
            <span class="material-meta-item"><span class="mi">person</span> <button class="user-profile-link" onclick="navigateTo('profile-user', ${m.uploader_id})">${escHtml(m.uploader_name)}</button></span>
          </div>
          <div class="material-meta-row">
            <span class="material-meta-item"><span class="mi">straighten</span> ${formatFileSize(m.file_size)}</span>
            <span class="material-meta-item material-download-count">下载 ${m.download_count}</span>
          </div>
        </div>
        <div class="material-card-actions">
          <a href="/api/materials/${m.id}/download" class="btn btn-primary">
            <span class="mi">download</span> 下载
          </a>
        </div>
      </div>
    </div>
  `).join('');

  const cards = contentEl.querySelectorAll('.material-card');
  if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
}
