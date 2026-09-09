/**
 * pages/courses/my_courses.js — 我的课程（选修课表列表）
 * registerPage: mycourse
 *
 * 职责：展示用户已选课程列表、选课模态框、导入课程表、退出课程
 * 详情页逻辑已迁移至 detail.js（统一 course-detail 页面）
 */

import { apiGet, apiPost, apiPut, apiDelete, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples, renderMarkdown } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, escHtml, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';
import { renderTkComment, renderTkInputArea, flattenReplies, toggleSubReplies, toggleInlineReply, toggleLike, getLikedSet, bindTkCommentEvents, getTkImages, clearTkImages, getTkReplyImages, clearTkReplyImages, renderTkPreviews, renderTkReplyPreviews } from '../../components/tk-comments.js';

/* =============================================
   学期工具函数
   ============================================= */

export function getCurrentSemesterKey() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();
  if ((m === 8 && d >= 15) || m >= 9 || (m === 1 && d === 1)) return `${y}-1`;
  if ((m === 2 && d >= 15) || (m >= 3 && m <= 5) || (m === 6 && d <= 14)) return `${y}-2`;
  if ((m === 6 && d >= 15) || m === 7 || (m === 8 && d <= 14)) return `${y}-summer`;
  return `${y}-closed`;
}

export function semesterLabel(key) {
  if (!key || key === 'all') return '全部学期';
  const parts = key.split('-');
  if (parts.length < 2) return key;
  const year = parts[0];
  const tag = parts[1];
  if (tag === '1') return `${year} 第一学期`;
  if (tag === '2') return `${year} 第二学期`;
  if (tag === 'summer') return `${year} 暑期`;
  return key;
}

export function semesterFullLabel(key) {
  if (!key || key === 'all') return '';
  const parts = key.split('-');
  if (parts.length < 2) return key;
  const year = parts[0];
  const tag = parts[1];
  if (tag === '1') return `${year}学年 第1学期`;
  if (tag === '2') return `${year}学年 第2学期`;
  if (tag === 'summer') return `${year}学年 暑期`;
  return key;
}

let _myCurrentSemester = getCurrentSemesterKey();

function parseSemesterKey(key) {
  if (!key || key === 'all') return { year: 'all', type: 'all' };
  const parts = key.split('-');
  if (parts.length < 2) {
    // 纯学期类型（如 "1"、"2"、"summer"）→ type-only
    if (['1', '2', 'summer'].includes(key)) return { year: 'all', type: key };
    return { year: key, type: 'all' };
  }
  return { year: parts[0], type: parts[1] };
}

function combineYearSemester(year, type) {
  if (year === 'all' && type === 'all') return 'all';
  if (type === 'all') return year;
  if (year === 'all') return type;        // 只选学期类型 → 按类型筛选所有年份
  return `${year}-${type}`;
}

const SEMESTER_TYPES = [
  { text: '全部学期', value: 'all' },
  { text: '第一学期', value: '1' },
  { text: '第二学期', value: '2' },
  { text: '暑期', value: 'summer' },
];

/* =============================================
   Page: 我的课程列表
   ============================================= */

registerPage('mycourse', async (container) => {
  if (!isLoggedIn()) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  // 先获取学期数据，再一次性渲染完整页面（避免 innerHTML 替换导致事件丢失）
  let yearOptions = [{ text: '全部年份', value: 'all' }];
  let initYear = 'all', initType = 'all';
  try {
    const semesters = await apiGet('/api/courses/semesters');
    if (semesters.length > 0) {
      const allKeys = new Set([_myCurrentSemester, ...semesters]);
      const years = [...new Set(Array.from(allKeys).map(k => parseSemesterKey(k).year))].filter(Boolean).sort().reverse();
      const parsed = parseSemesterKey(_myCurrentSemester);
      initYear = years.includes(parsed.year) ? parsed.year : 'all';
      initType = parsed.type || 'all';
      yearOptions = [{ text: '全部年份', value: 'all' }, ...years.map(y => ({ text: `${y} 年`, value: y }))];
    }
  } catch {}

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="margin-bottom:0"><span class="mi" style="vertical-align:-4px;margin-right:4px">school</span>我的课程</h1>
        <p class="text-secondary" style="margin-top:4px;font-size:var(--text-sm)">当前学期的班级课程</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="openCourseSearchModal()">
          <span class="mi">search</span> 选择已有课程
        </button>
        <button class="btn btn-primary" onclick="openImportModal()">
          <span class="mi">upload_file</span> 导入课程表
        </button>
      </div>
    </div>
    <div id="my-semester-filter-wrap" class="form-row inline-selects" style="margin-bottom:var(--space-4);width:auto">
      <div>
        ${createMdSelect({ id: 'my-year-filter', options: yearOptions, selected: initYear })}
      </div>
      <div>
        ${createMdSelect({ id: 'my-sem-filter', options: SEMESTER_TYPES, selected: initType })}
      </div>
    </div>
    <div id="my-course-list">
      <div class="card"><p class="text-secondary">加载中...</p></div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  // 绑定学期筛选事件
  document.getElementById('my-semester-filter-wrap')?.addEventListener('md-select-change', () => {
    const year = document.getElementById('my-year-filter')?.value || 'all';
    const type = document.getElementById('my-sem-filter')?.value || 'all';
    _myCurrentSemester = combineYearSemester(year, type);
    loadMyCourseList(_myCurrentSemester);
  });

  await loadMyCourseList(_myCurrentSemester);
});

async function loadMyCourseList(semester) {
  const listEl = document.getElementById('my-course-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    let url = '/api/courses';
    if (semester !== 'all') {
      const parsed = parseSemesterKey(semester);
      if (parsed.year === 'all' && parsed.type !== 'all') {
        // 全部年份 + 指定学期类型 → 按类型筛选
        url = `/api/courses?type=${encodeURIComponent(parsed.type)}`;
      } else if (parsed.type === 'all') {
        url = `/api/courses?year=${encodeURIComponent(parsed.year)}`;
      } else {
        url = `/api/courses?semester=${encodeURIComponent(semester)}`;
      }
    }
    console.log('[loadMyCourseList] semester=%s → url=%s', semester, url);
    const courses = await apiGet(url);
    console.log('[loadMyCourseList] 返回 %d 门课程', courses.length);

    if (courses.length === 0) {
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">menu_book</span>
          <p class="text-secondary" style="margin-top:12px">该学期暂无课程</p>
          <p class="text-secondary" style="white-space:nowrap">点击"导入课程表"或"选择已有课程"添加</p>
        </div>
      `;
      animIn(listEl.querySelector('.card'), { y: 20, delay: 80 });
      return;
    }

    listEl.innerHTML = courses.map(c => {
      const semText = c.enrolled_semester_key ? semesterLabel(c.enrolled_semester_key) : (c.semester ? semesterLabel(c.semester) : '');
      const descLine = [c.description || '', semText].filter(Boolean).join(' · ');
      return `
      <div class="card mb-4 clickable" onclick="navigateTo('course-detail', ${c.big_course_id || c.id})">
        <div class="course-card-row">
          <div style="flex:1;min-width:0">
            <h3 class="card-title">${escHtml(c.title)}</h3>
            <p class="text-secondary" style="margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.teacher || '')}</p>
            <p class="text-secondary" style="margin-top:2px;font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(descLine || '暂无描述')}</p>
          </div>
          <div class="course-card-right">
            <span style="font-size:var(--text-sm);color:var(--md-primary);font-weight:600;white-space:nowrap">
              <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${c.enrollment_count || 0} 人
            </span>
            <div class="inline-btn-group" style="display:flex;gap:6px">
              <button class="btn btn-secondary" title="移动学期" style="padding:4px 12px;font-size:12px" onclick="event.stopPropagation();openMoveSemesterModal(${c.id}, '${escHtml(c.title)}')">
                <span class="mi" style="font-size:14px">swap_horiz</span><span class="btn-text"> 移动学期</span>
              </button>
              <button class="btn btn-secondary" title="退出课程" style="padding:4px 12px;font-size:12px" onclick="event.stopPropagation();handleLeaveCourse(${c.id})">
                <span class="mi" style="font-size:14px">logout</span><span class="btn-text"> 退出课程</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `}).join('');

    const cards = listEl.querySelectorAll('.card');
    animStagger(Array.from(cards), { y: 22, dur: 420, gap: 60 });
  } catch {
    listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}

/* =============================================
   选择已有课程（模态框）
   ============================================= */

export async function openCourseSearchModal() {
  const now = new Date();
  const curYear = now.getFullYear();
  const yearOptions = [
    { text: '全部学年', value: '' },
    { text: `${curYear}`, value: `${curYear}` },
    { text: `${curYear - 1}`, value: `${curYear - 1}` },
    { text: `${curYear - 2}`, value: `${curYear - 2}` },
  ];
  const weekdaySelect = createMdSelect({
    id: 'search-course-day',
    options: [
      { text: '全部时间', value: '' },
      { text: '周一', value: '周一' },
      { text: '周二', value: '周二' },
      { text: '周三', value: '周三' },
      { text: '周四', value: '周四' },
      { text: '周五', value: '周五' },
      { text: '周六', value: '周六' },
      { text: '周日', value: '周日' },
    ],
    selected: '',
  });
  const yearSelect = createMdSelect({ id: 'search-course-year', options: yearOptions, selected: '' });
  const semSelect = createMdSelect({
    id: 'search-course-semester',
    options: [
      { text: '全部学期', value: '' },
      { text: '第一学期', value: '1' },
      { text: '第二学期', value: '2' },
      { text: '暑期', value: 'summer' },
    ],
    selected: '',
  });

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:16px">
      <div style="display:flex;gap:12px">
        <div style="flex:1">${createMdInput({ id: 'search-course-id', label: '课程号' })}</div>
        <div style="flex:1">${createMdInput({ id: 'search-course-name', label: '课程名称' })}</div>
      </div>
      <div style="display:flex;gap:12px">
        <div style="flex:1">${weekdaySelect}</div>
        <div style="flex:1">${createMdInput({ id: 'search-course-teacher', label: '教师' })}</div>
      </div>
      <div style="display:flex;gap:12px">
        <div style="flex:1">${yearSelect}</div>
        <div style="flex:1">${semSelect}</div>
      </div>
      <button class="btn btn-primary" onclick="doCourseSearch()" style="align-self:flex-end">
        <span class="mi">search</span> 搜索
      </button>
    </div>
    <div id="search-results" style="max-height:320px;overflow-y:auto">
      <p class="text-secondary" style="text-align:center">输入条件后点击搜索</p>
    </div>
  `;

  openModal('选择已有课程', bodyHtml);
}

export async function doCourseSearch() {
  const courseId = document.getElementById('search-course-id').value.trim();
  const name = document.getElementById('search-course-name').value.trim();
  const day = document.getElementById('search-course-day').value;
  const teacher = document.getElementById('search-course-teacher').value.trim();
  const year = document.getElementById('search-course-year').value;
  const semVal = document.getElementById('search-course-semester').value;

  const params = new URLSearchParams();
  if (courseId) params.set('courseId', courseId);
  if (name) params.set('name', name);
  if (day) params.set('day', day);
  if (teacher) params.set('teacher', teacher);
  // 学期筛选：优先精确匹配 semester=year-tag，否则按年份匹配
  if (year && semVal) {
    params.set('semester', `${year}-${semVal}`);
  } else if (year) {
    params.set('year', year);
  }

  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<p class="text-secondary" style="text-align:center">搜索中...</p>';

  try {
    const courses = await apiGet('/api/schedule/available?' + params.toString());
    if (courses.length === 0) {
      resultsEl.innerHTML = '<p class="text-secondary" style="text-align:center">未找到匹配课程</p>';
      return;
    }

    resultsEl.innerHTML = courses.map(c => {
      // description 格式: "课程号 · 时间 · 地点"
      const descParts = (c.description || '').split(' · ').filter(Boolean);
      const semText = c.semester ? semesterLabel(c.semester) : '';
      // 构建详情行: 教师 · 课程号 · 时间 · 地点 · 学期
      const detailParts = [c.teacher || '', ...descParts, semText].filter(Boolean);
      return `
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:var(--text-sm)">${escHtml(c.title)}</div>
            <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:2px">${detailParts.map(p => escHtml(p)).join(' · ')}</div>
          </div>
          <div style="flex-shrink:0;margin-left:12px">
            ${c.is_enrolled
              ? '<span class="enrolled-badge" style="font-size:12px"><span class="mi" style="font-size:14px">check</span> 已加入</span>'
              : `<button class="btn btn-primary" style="padding:4px 12px;font-size:12px" onclick="handleEnrollFromSearch(${c.id})">加入</button>`
            }
          </div>
        </div>
      </div>
    `}).join('');
  } catch {
    resultsEl.innerHTML = '<p class="text-secondary" style="text-align:center">搜索失败</p>';
  }
}

export async function handleEnrollFromSearch(courseId) {
  let enrollSemester = _myCurrentSemester;
  if (enrollSemester === 'all' || parseSemesterKey(enrollSemester).type === 'all') {
    enrollSemester = getCurrentSemesterKey();
  }
  const result = await apiPost(`/api/courses/${courseId}/enroll`, { semester_key: enrollSemester });
  if (result.error) {
    showToast(result.error);
  } else {
    showToast('加入成功');
    closeModal();
    navigateTo('mycourse');
  }
}

/* =============================================
   导入课程表（模态框）
   ============================================= */

export async function openImportModal() {
  if (!isLoggedIn()) {
    showToast('请先登录后再导入课程表');
    return;
  }

  const bodyHtml = `
    <div class="import-section">
      <div class="import-notes markdown-body" id="pre-notes-content">
        <p class="text-secondary">加载中...</p>
      </div>
    </div>
    <div class="inline-btn-group" style="display:flex;gap:12px;justify-content:flex-end;margin-top:var(--space-4)">
      <button class="btn btn-secondary" onclick="closeModal()">不同意</button>
      <button class="btn btn-primary" onclick="handleAgreeAndImport()">我已同意并知晓</button>
    </div>
  `;

  openModal('使用须知', bodyHtml);

  try {
    const data = await apiGet('/api/schedule/pre-notes');
    const el = document.getElementById('pre-notes-content');
    if (data.content && data.content.trim()) {
      el.innerHTML = renderMarkdown(data.content);
    } else {
      el.innerHTML = '<p class="text-secondary">暂无须知内容。</p>';
    }
  } catch (err) {
    console.error('加载须知失败:', err);
    const el = document.getElementById('pre-notes-content');
    if (el) el.innerHTML = '<p class="text-secondary">加载失败。</p>';
  }
}

export function handleAgreeAndImport() {
  const bodyHtml = `
    <div class="import-section">
      <h3 class="import-section-title">导入说明</h3>
      <div class="import-notes markdown-body" id="import-notes">
        <p class="text-secondary">加载中...</p>
      </div>
    </div>
    <div class="import-section">
      <h3 class="import-section-title">选择文件</h3>
      <label class="btn btn-primary" style="cursor:pointer">
        <span class="mi">upload_file</span>
        <span>选择课程表文件</span>
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handleScheduleImport(this.files[0])">
      </label>
    </div>
  `;

  openModal('导入课程表', bodyHtml);

  apiGet('/api/schedule/notes').then(data => {
    const el = document.getElementById('import-notes');
    if (data.content && data.content.trim()) {
      el.innerHTML = renderMarkdown(data.content);
    } else {
      el.innerHTML = '<p class="text-secondary">暂无说明。</p>';
    }
  }).catch(() => {
    const el = document.getElementById('import-notes');
    if (el) el.innerHTML = '<p class="text-secondary">加载说明失败。</p>';
  });
}

export async function handleScheduleImport(file) {
  if (!file) return;
  try {
    const { apiPostFile } = await import('../../core/api.js');
    const result = await apiPostFile('/api/schedule/import', file);
    if (result.error) {
      showToast('导入失败: ' + result.error);
      return;
    }
    closeModal();
    showToast(`成功导入 ${result.imported} 门课程`);
    setTimeout(() => navigateTo('mycourse'), 280);
  } catch {
    showToast('导入失败，请检查网络连接');
  }
}

/* =============================================
   退出课程
   ============================================= */

export async function handleLeaveCourse(courseId) {
  if (!confirm('确定要退出该课程吗？')) return;
  const result = await apiDelete(`/api/courses/${courseId}/leave`);
  if (result.error) {
    showToast(result.error);
  } else {
    showToast('已退出课程');
    navigateTo('mycourse');
  }
}

/* =============================================
   移动学期
   ============================================= */

export async function openMoveSemesterModal(courseId, courseTitle) {
  try {
    const semesters = await apiGet('/api/courses/semesters');
    const allKeys = new Set([...semesters]);
    // 添加常用学期选项
    const now = new Date();
    const y = now.getFullYear();
    [`${y}-1`, `${y}-2`, `${y}-summer`, `${y - 1}-1`, `${y - 1}-2`].forEach(k => allKeys.add(k));

    const years = [...new Set(Array.from(allKeys).filter(Boolean).map(k => parseSemesterKey(k).year))].sort().reverse();
    const yearOptions = years.map(y => ({ text: `${y} 年`, value: y }));

    const { year: initYear, type: initType } = parseSemesterKey(_myCurrentSemester === 'all' ? getCurrentSemesterKey() : _myCurrentSemester);

    const bodyHtml = `
      <p style="margin-bottom:16px;color:var(--md-on-surface-variant)">将「${escHtml(courseTitle)}」移动到：</p>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <div style="flex:1">
          ${createMdSelect({
            id: 'move-year-target',
            options: yearOptions,
            selected: years.includes(initYear) ? initYear : years[0],
          })}
        </div>
        <div style="flex:1">
          ${createMdSelect({
            id: 'move-sem-target',
            options: SEMESTER_TYPES.filter(o => o.value !== 'all'),
            selected: initType || '1',
          })}
        </div>
      </div>
      <div class="inline-btn-group" style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="handleMoveSemester(${courseId})">确认移动</button>
      </div>
    `;

    openModal('移动学期', bodyHtml);
  } catch {
    showToast('加载学期列表失败');
  }
}

export async function handleMoveSemester(courseId) {
  const year = document.getElementById('move-year-target')?.value;
  const type = document.getElementById('move-sem-target')?.value;
  if (!year || !type) {
    showToast('请选择目标学期');
    return;
  }
  const target = `${year}-${type}`;

  const result = await apiPut(`/api/courses/${courseId}/move-semester`, { semester_key: target });
  if (result.error) {
    showToast(result.error);
  } else {
    _myCurrentSemester = target;
    showToast('移动成功');
    closeModal();
    navigateTo('mycourse');
  }
}


/* =============================================
   穿梭门：清洗班级名 → 导航到广场
   ============================================= */

function cleanPortalName(title) {
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

export async function handlePortalToPlaza(cleanName) {
  // 先搜索课程ID，确保URL正确
  try {
    const allCourses = await apiGet('/api/courses');
    const q = cleanName.toLowerCase();
    const found = allCourses.find(c => {
      const big = cleanPortalName(c.title).toLowerCase();
      return big.includes(q) || (c.title || '').toLowerCase().includes(q);
    });
    if (found) {
      navigateTo('plaza-course', found.id);
    } else {
      showToast('未在课程广场找到对应的课程');
    }
  } catch {
    showToast('搜索课程失败');
  }
}

/* =============================================
   评论区 — tk-* 统一标准（由 tk-comments.js 驱动）
   ============================================= */

let loadedComments = {};       // 缓存：postId → { comments, total }

// 格式化相对时间
const TK_LIKE_KEY = 'mycourses_liked_comments';
const _myCoursesLikedSet = getLikedSet(TK_LIKE_KEY);

function loadCommentsForPost(postId) {
  if (!loadedComments[postId]) loadedComments[postId] = { comments: [], total: 0 };
  return loadedComments[postId];
}

export async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  if (section.style.display === 'block') {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (!loadedComments[postId]) {
    section.innerHTML = '<p class="text-secondary" style="text-align:center;padding:24px;font-size:13px">加载中...</p>';
    try {
      const data = await apiGet(`/api/courses/posts/${postId}/comments?page=1&pageSize=50`);
      loadedComments[postId] = {
        comments: data.comments || [],
        total: data.total || 0
      };
      renderTkComments(section, postId);
    } catch {
      section.innerHTML = '<p class="text-secondary" style="text-align:center;padding:24px;font-size:13px">加载失败，点击重试</p>';
      section.style.cursor = 'pointer';
      section.onclick = () => { section.onclick = null; loadedComments[postId] = null; toggleComments(postId); };
    }
  } else {
    renderTkComments(section, postId);
  }
}

function renderTkComments(section, postId) {
  const data = loadCommentsForPost(postId);
  const allComments = data.comments || [];

  const topComments = allComments.filter(c => !c.parent_id);
  const childMap = {};
  allComments.forEach(c => {
    if (c.parent_id) {
      if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
      childMap[c.parent_id].push(c);
    }
  });
  function attach(comment) {
    const children = childMap[comment.id] || [];
    children.forEach(attach);
    comment.replies = children;
    comment.reply_count = children.length;
  }
  topComments.forEach(attach);

  section.innerHTML = `
    <div class="comment-list" id="tk-comment-list-${postId}">
      ${topComments.length === 0
        ? '<p class="text-secondary" style="text-align:center;padding:24px;font-size:13px">暂无评论</p>'
        : topComments.map(c => renderTkComment(c, postId, 0, {
            deleteAction: 'delete-comment',
            replyAction: 'reply',
            likedSet: _myCoursesLikedSet
          })).join('')
      }
    </div>
    ${isLoggedIn() ? renderTkInputArea(postId, '说点什么...') : '<p class="text-secondary" style="padding:12px 24px;font-size:12px;text-align:center"><a href="#" onclick="navigateTo(\'auth\');return false">登录</a> 后参与评论</p>'}
  `;

  bindTkCommentEvents(section, {
    onSubmitReply: (ctxId, cid) => submitTkReply(ctxId, cid, section),
    onDelete: (ctxId, cid) => deleteTkComment(ctxId, cid, section),
    onLike: (cid) => toggleLike(cid, TK_LIKE_KEY)
  });

  const sendBtn = document.getElementById(`comment-send-btn-${postId}`);
  const mainInput = document.getElementById(`comment-main-input-${postId}`);
  sendBtn?.addEventListener('click', () => submitTkMain(postId, section));
  mainInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitTkMain(postId, section); } });
}

async function submitTkMain(postId, section) {
  const input = document.getElementById(`comment-main-input-${postId}`);
  const content = input?.value?.trim();
  const state = getTkImages(postId);
  if (!content && state.files.length === 0) return;

  try {
    let res;
    if (state.files.length > 0) {
      const formData = new FormData();
      formData.append('content', content || '');
      state.files.forEach((f, i) => formData.append(i === 0 ? 'image' : 'images', f));
      const token = localStorage.getItem('kedazi_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const fetchRes = await fetch(`/api/courses/posts/${postId}/comments`, { method: 'POST', headers, body: formData });
      res = await fetchRes.json();
    } else {
      res = await apiPost(`/api/courses/posts/${postId}/comments`, { content });
    }
    if (res.error) { showToast(res.error); return; }
    if (input) input.value = '';
    clearTkImages(postId);
    renderTkPreviews(postId);
    loadedComments[postId] = null;
    toggleComments(postId);
    showToast('评论成功');
  } catch { showToast('发送失败'); }
}

async function submitTkReply(postId, parentCommentId, section) {
  const input = document.getElementById(`inline-reply-input-${parentCommentId}`);
  const content = input?.value?.trim();
  const state = getTkReplyImages(parentCommentId);
  if (!content && state.files.length === 0) return;

  try {
    let res;
    if (state.files.length > 0) {
      const formData = new FormData();
      formData.append('content', content || '');
      formData.append('parent_id', parentCommentId);
      state.files.forEach((f, i) => formData.append(i === 0 ? 'image' : 'images', f));
      const token = localStorage.getItem('kedazi_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const fetchRes = await fetch(`/api/courses/posts/${postId}/comments`, { method: 'POST', headers, body: formData });
      res = await fetchRes.json();
    } else {
      res = await apiPost(`/api/courses/posts/${postId}/comments`, { content, parent_id: parentCommentId });
    }
    if (res.error) { showToast(res.error); return; }
    clearTkReplyImages(parentCommentId);
    renderTkReplyPreviews(parentCommentId);
    loadedComments[postId] = null;
    toggleComments(postId);
    showToast('回复成功');
  } catch { showToast('发送失败'); }
}

async function deleteTkComment(postId, commentId, section) {
  openModal('确认删除', `
    <p style="margin-bottom:24px">确定要删除这条评论吗？</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="confirm-del-cmt" style="background:var(--md-error)">删除</button>
    </div>
  `);
  document.getElementById('confirm-del-cmt')?.addEventListener('click', async () => {
    const result = await apiDelete(`/api/courses/posts/${postId}/comments/${commentId}`);
    if (result.error) { showToast(result.error); } else { showToast('已删除'); loadedComments[postId] = null; toggleComments(postId); }
    closeModal();
  });
}

