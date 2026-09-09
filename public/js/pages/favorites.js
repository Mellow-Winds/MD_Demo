import { apiGet, apiPost, apiDelete, isLoggedIn } from '../core/api.js';
import { registerPage, navigateTo, animStagger, bindRipples } from '../core/router.js';
import { showToast, escHtml, formatTime, renderLoginPrompt, bindLoginPrompt } from '../components/ui.js';
import { renderAuth } from './auth.js';
import { navigateToCourseResult } from './search.js';

export async function getFavoriteCourseIds() {
  if (!isLoggedIn()) return new Set();
  const courses = await apiGet('/api/favorites?type=courses');
  return new Set(Array.isArray(courses) ? courses.map(course => course.id) : []);
}

export async function getFavoritePostIds() {
  if (!isLoggedIn()) return new Set();
  const posts = await apiGet('/api/favorites?type=posts');
  return new Set(Array.isArray(posts) ? posts.map(post => post.id) : []);
}

export function renderCourseFavoriteButton(courseId, isFavorited) {
  return `
    <button class="btn btn-secondary btn-compact favorite-btn${isFavorited ? ' favorited' : ''}"
      onclick="event.stopPropagation();toggleCourseFavorite(${courseId}, this)">
      <span class="mi">${isFavorited ? 'bookmark' : 'bookmark_border'}</span><span class="favorite-label">${isFavorited ? '已收藏' : '收藏'}</span>
    </button>
  `;
}

export function renderPostFavoriteButton(postId, isFavorited) {
  return `
    <button class="btn btn-secondary btn-compact favorite-btn${isFavorited ? ' favorited' : ''}"
      onclick="event.stopPropagation();togglePostFavorite(${postId}, this)">
      <span class="mi">${isFavorited ? 'bookmark' : 'bookmark_border'}</span><span class="favorite-label">${isFavorited ? '已收藏' : '收藏'}</span>
    </button>
  `;
}

async function toggleFavorite(type, id, button) {
  const wasFavorited = button.classList.contains('favorited');
  const setState = (favorited) => {
    button.classList.toggle('favorited', favorited);
    button.querySelector('.mi').textContent = favorited ? 'bookmark' : 'bookmark_border';
    button.querySelector('.favorite-label').textContent = favorited ? '已收藏' : '收藏';
  };
  setState(!wasFavorited);
  const url = `/api/favorites/${type}/${id}`;
  const result = wasFavorited ? await apiDelete(url) : await apiPost(url, {});
  if (result.error) {
    setState(wasFavorited);
    showToast(result.error);
  }
}

export async function toggleCourseFavorite(courseId, button) {
  await toggleFavorite('courses', courseId, button);
}

export async function togglePostFavorite(postId, button) {
  await toggleFavorite('posts', postId, button);
}

function renderCourseCards(courses) {
  if (!courses.length) return '<div class="card"><p class="text-secondary">暂未收藏课程</p></div>';
  return courses.map(course => `
    <div class="card mb-4 clickable" onclick="navigateToCourseResult(${course.id})">
      <h3 class="card-title">${escHtml(course.title)}</h3>
      <p class="text-secondary" style="margin-top:4px">${escHtml(course.teacher || '')} · ${course.enrollment_count || 0} 人选课</p>
    </div>
  `).join('');
}

function renderPostCards(posts) {
  if (!posts.length) return '<div class="card"><p class="text-secondary">暂未收藏帖子</p></div>';
  return posts.map(post => `
    <div class="card mb-4 clickable" onclick="navigateToCourseResult(${post.course_id}, ${post.id})">
      <h3 class="card-title">${escHtml(post.title)}</h3>
      <p class="text-secondary" style="margin-top:4px">${escHtml((post.content || '').replace(/<[^>]+>/g, '').slice(0, 100))}</p>
      <p class="text-secondary" style="margin-top:6px;font-size:12px">${escHtml(post.course_title)} · ${escHtml(post.author_name)} · ${formatTime(post.created_at)}</p>
    </div>
  `).join('');
}

registerPage('favorites', async (container) => {
  if (!isLoggedIn()) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }
  const [courses, posts] = await Promise.all([
    apiGet('/api/favorites?type=courses'),
    apiGet('/api/favorites?type=posts'),
  ]);
  container.innerHTML = `
    <div class="page-header"><h1 class="page-title"><span class="mi" style="vertical-align:-4px;margin-right:4px">bookmark</span>我的收藏</h1></div>
    <div class="md-pills" id="favorite-pills">
      <button class="md-pill-btn active" data-tab="courses">
        <span class="mi" style="font-size:16px;vertical-align:-3px">menu_book</span> 课程 ${courses.length}
      </button>
      <button class="md-pill-btn" data-tab="posts">
        <span class="mi" style="font-size:16px;vertical-align:-3px">article</span> 帖子 ${posts.length}
      </button>
    </div>
    <div id="favorite-list">${renderCourseCards(courses)}</div>
  `;
  container.querySelectorAll('#favorite-pills .md-pill-btn').forEach(button => {
    button.addEventListener('click', () => {
      container.querySelectorAll('#favorite-pills .md-pill-btn').forEach(item => item.classList.toggle('active', item === button));
      const listEl = document.getElementById('favorite-list');
      // 平滑 crossfade 切换
      listEl.style.transition = 'opacity 0.12s var(--ease-standard), transform 0.15s var(--ease-spring)';
      listEl.style.opacity = '0';
      listEl.style.transform = 'scale(0.98)';
      setTimeout(() => {
        listEl.innerHTML = button.dataset.tab === 'courses'
          ? renderCourseCards(courses)
          : renderPostCards(posts);
        listEl.style.opacity = '1';
        listEl.style.transform = 'scale(1)';
      }, 120);
    });
  });
  bindRipples(container);
  animStagger(Array.from(container.querySelectorAll('.card')), { y: 16, dur: 350, gap: 40 });
});
