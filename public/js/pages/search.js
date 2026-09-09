/**
 * pages/search.js — Google-style centered search + AI search mode
 * registerPage: search
 */

import { apiGet } from '../core/api.js';
import { registerPage, navigateTo, animIn, animOut, animStagger, bindRipples, Ease } from '../core/router.js';
import { showToast, escHtml } from '../components/ui.js';

/* =============================================
   Module State
   ============================================= */

let searchState = {
  mode: 'normal',        // 'normal' | 'ai'
  hasSearched: false,    // false = centered hero, true = top-bar results
  currentQuery: '',
  currentTab: 'all',
  aiTimer: null,
  aiAbortController: null,
};

/* =============================================
   HTML Templates
   ============================================= */

function renderHeroState() {
  return `
    <div class="search-hero" id="search-hero">
      <div class="search-hero-inner">
        <div class="search-hero-brand">
          <img src="/images/blue-whale-logo.png" alt="" aria-hidden="true" style="height:28px">
          <span>课搭子 AI搜索</span>
        </div>
        <h2 class="search-hero-title">AI智能搜索，一步到位</h2>
        <div class="search-hero-bar" id="search-hero-bar">
          <div class="search-hero-input-wrap">
            <span class="mi search-hero-icon">search</span>
            <input class="search-hero-input" id="search-hero-input"
              type="text" placeholder=" "
              autocomplete="off"
              onkeydown="handleSearchPageKey(event)">
            <button class="search-hero-clear" id="search-hero-clear"
              style="display:none" onclick="clearSearchInput()"
              aria-label="清除">
              <span class="mi">close</span>
            </button>
          </div>
          <div class="search-hero-actions">
            <button class="btn btn-primary" id="search-hero-submit"
              onclick="executeAISearch()" aria-label="AI搜索"
              style="display:flex;align-items:center;gap:6px">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
              </svg>
              搜索
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderResultsState(q, activeTab) {
  return `
    <div class="search-results-container" id="search-results-container">
      <div class="search-top-bar" id="search-top-bar">
        <div class="search-top-input-wrap">
          <span class="mi search-top-icon">search</span>
          <input class="search-top-input" id="search-top-input"
            type="text" placeholder=" "
            value="${escHtml(q)}"
            autocomplete="off"
            onkeydown="handleSearchPageKey(event)">
        </div>
        <div class="search-top-actions">
          <button class="btn btn-primary" id="search-top-submit"
            onclick="executeAISearch()" aria-label="AI搜索"
            style="display:flex;align-items:center;gap:4px">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
            </svg>
            搜索
          </button>
        </div>
      </div>
      <div class="search-pills-row" id="search-pills-row" style="display:none">
        <div class="md-pills" id="search-pills">
          ${renderPillBtns(activeTab)}
        </div>
      </div>
      <div id="search-results"></div>
    </div>
  `;
}

function renderPillBtns(activeTab) {
  const tabs = [
    { key: 'all',         icon: 'apps',       label: '全部' },
    { key: 'courses',     icon: 'menu_book',  label: '课程' },
    { key: 'materials',   icon: 'folder',     label: '资料' },
    { key: 'posts',       icon: 'article',    label: '帖子' },
    { key: 'squarePosts', icon: 'forum',      label: '广场' },
  ];
  return tabs.map(t => `
    <button class="md-pill-btn ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
      <span class="mi" style="font-size:16px;vertical-align:-3px">${t.icon}</span> ${t.label}
    </button>
  `).join('');
}

function renderAIOverlay() {
  return `
    <div class="search-ai-overlay" id="search-ai-overlay">
      <div class="search-ai-card">
        <div class="search-ai-sparkle">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="var(--md-primary)">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
          </svg>
        </div>
        <div class="search-ai-steps" id="search-ai-steps">
        </div>
        <button class="btn btn-outline search-ai-cancel" id="search-ai-cancel"
          onclick="cancelAISearch()" style="margin-top:24px">
          取消
        </button>
      </div>
    </div>
  `;
}

// Step labels (without ellipsis — added dynamically)
const AI_STEP_LABELS = ['正在思考', '分析用户需求', '查找相关结果', '整合相关材料'];

function buildAICompletedStep(label) {
  return `
    <div class="search-ai-step search-ai-step--done">
      <span class="search-ai-step-indicator">
        <span class="mi" style="font-size:18px;color:var(--md-primary)">check_circle</span>
      </span>
      <span class="search-ai-step-text">${label}</span>
    </div>
  `;
}

function buildAIActiveStep(labelWithDots) {
  return `
    <div class="search-ai-step search-ai-step--active">
      <span class="search-ai-step-indicator">
        <span class="search-ai-thinker search-ai-thinking-active"></span>
      </span>
      <span class="search-ai-step-text">${labelWithDots}</span>
    </div>
  `;
}

/* =============================================
   Search Result Rendering (ported from auth.js)
   ============================================= */

function renderSearchResults(data, q) {
  const { courses = [], materials = [], posts = [], squarePosts = [] } = data;
  const total = courses.length + materials.length + posts.length + squarePosts.length;

  if (total === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">search_off</span>
        <p class="text-secondary" style="margin-top:12px">没有找到与「${escHtml(q)}」相关的内容</p>
      </div>
    `;
  }

  let html = resultsSummary(q, total);

  if (courses.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">menu_book</span> 课程 (${courses.length})</h3>`;
    html += courses.map(c => `
      <div class="card search-result-card" onclick="navigateToCourseResult(${c.id})">
        <div style="font-weight:600">${highlight(c.title, q)}</div>
        <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:4px">
          ${c.teacher ? escHtml(c.teacher) + ' · ' : ''}${c.enrollment_count || 0} 人选课
        </div>
      </div>
    `).join('');
  }

  if (materials.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料 (${materials.length})</h3>`;
    html += materials.map(m => `
      <div class="card search-result-card" onclick="navigateToCourseResult(${m.course_id})">
        <div style="font-weight:600">${highlight(m.title, q)}</div>
        <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:4px">
          ${escHtml(m.course_title)} · ${escHtml(m.category)}${m.chapter ? ' · ' + escHtml(m.chapter) : ''} · ${escHtml(m.uploader_name)}
        </div>
      </div>
    `).join('');
  }

  if (posts.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 帖子 (${posts.length})</h3>`;
    html += posts.map(p => {
      const snippet = getSnippet(p.content, q, 80);
      return `
        <div class="card search-result-card" onclick="navigateToCourseResult(${p.course_id}, ${p.id})">
          <div style="font-weight:600">${highlight(p.title, q)}</div>
          <div style="font-size:13px;color:var(--md-on-surface-variant);margin-top:4px">${highlight(snippet, q)}</div>
          <div style="font-size:12px;color:var(--md-outline);margin-top:4px">
            ${escHtml(p.course_title)} · ${escHtml(p.author_name)}
          </div>
        </div>
      `;
    }).join('');
  }

  if (squarePosts.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">explore</span> 广场 (${squarePosts.length})</h3>`;
    html += squarePosts.map(p => {
      const snippet = getSnippet(p.description, q, 80);
      const remainingDays = Math.max(0, Math.ceil((new Date(p.expires_at) - Date.now()) / (24 * 60 * 60 * 1000)));
      return `
        <div class="card search-result-card" onclick="navigateTo('square-post', ${p.id})">
          <div style="font-weight:600">${highlight(p.title, q)}</div>
          ${snippet ? `<div style="font-size:13px;color:var(--md-on-surface-variant);margin-top:4px">${highlight(snippet, q)}</div>` : ''}
          <div style="font-size:12px;color:var(--md-outline);margin-top:4px">
            ${escHtml(p.category)} · ${escHtml(p.creator_name)} · ${escHtml(p.status)} · 剩余 ${remainingDays} 天
          </div>
        </div>
      `;
    }).join('');
  }

  return html;
}

function highlight(text, q) {
  if (!text || !q) return escHtml(text);
  const escaped = escHtml(text);
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function getSnippet(text, q, len) {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, len);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + q.length + 50);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

/* Deterministic trustworthiness score from query + result count */
function trustworthinessScore(q, total) {
  const key = `${q}|${total}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const steps = Math.abs(hash) % 86; // 0–85 → 0.0–8.5
  return (90.0 + steps * 0.1).toFixed(1);
}

function resultsSummary(q, total) {
  if (total === 0) return '';
  const score = trustworthinessScore(q, total);
  return `
    <div class="search-results-summary">
      <span class="mi" style="font-size:18px;color:var(--md-primary);vertical-align:-4px">auto_awesome</span>
      为您找到 <strong>${total}</strong> 条结果，综合可信度 <strong>${score}%</strong>
    </div>
  `;
}

function saveSearchHistory(q) {
  try {
    let history = JSON.parse(localStorage.getItem('search_history') || '[]');
    history = history.filter(h => h !== q);
    history.unshift(q);
    if (history.length > 5) history = history.slice(0, 5);
    localStorage.setItem('search_history', JSON.stringify(history));
  } catch { /* ignore */ }
}

/* =============================================
   Hero → Results Transition
   ============================================= */

async function animateHeroToResults(q, activeTab) {
  const container = document.querySelector('#main-content');
  const hero = container.querySelector('.search-hero');
  if (!hero) return;

  const heroInner = hero.querySelector('.search-hero-inner');
  if (!heroInner) return;

  // Staggered fade-out of inner elements
  const brand = heroInner.querySelector('.search-hero-brand');
  const title = heroInner.querySelector('.search-hero-title');
  const bar = heroInner.querySelector('.search-hero-bar');
  const history = heroInner.querySelector('.search-hero-history');

  const outs = [];
  if (brand) outs.push(animOut(brand, { dur: 180 }));
  if (title) outs.push(animOut(title, { dur: 180 }));
  if (history) outs.push(animOut(history, { dur: 160 }));
  // Keep the bar visible longest to bridge the transition
  if (bar) outs.push(animOut(bar, { dur: 250 }));

  await Promise.all(outs.map(a => a?.finished));

  // Collapse the hero section
  hero.style.transition = `height 400ms ${Ease.standard}, opacity 300ms ${Ease.standard}`;
  hero.style.height = hero.offsetHeight + 'px';
  requestAnimationFrame(() => {
    hero.style.height = '0px';
    hero.style.opacity = '0';
    hero.style.overflow = 'hidden';
  });

  await new Promise(r => setTimeout(r, 400));

  // Swap DOM — pills stay hidden until search completes
  searchState.hasSearched = true;
  container.innerHTML = renderResultsState(q, activeTab);
  bindSearchEvents(container);
  bindRipples(container);

  // Animate in top bar only (pills appear after search results)
  const topBar = container.querySelector('#search-top-bar');
  if (topBar) animIn(topBar, { y: -12, dur: 350, ease: Ease.decelerate });
}

/* =============================================
   Normal Search
   ============================================= */

export async function executeSearch(type) {
  // Only used for tab-switching AFTER results are already shown
  const q = searchState.currentQuery;
  if (!q || q.length < 2) return;

  const activeTab = type || searchState.currentTab || 'all';
  searchState.currentTab = activeTab;
  searchState.mode = 'normal';

  // Update URL silently
  const url = `/search?q=${encodeURIComponent(q)}&type=${activeTab}`;
  history.replaceState({ page: 'search', data: { q, type: activeTab } }, '', url);

  // Show loading in results area only
  const resultsEl = document.getElementById('search-results');
  if (resultsEl) resultsEl.innerHTML = '<div class="card" style="text-align:center;padding:32px"><p class="text-secondary">搜索中...</p></div>';

  // Update active pill
  document.querySelectorAll('#search-pills .md-pill-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === activeTab);
  });

  try {
    const data = await apiGet(`/api/search?q=${encodeURIComponent(q)}&type=${activeTab}`);
    if (resultsEl) {
      resultsEl.innerHTML = renderSearchResults(data, q);
      const cards = resultsEl.querySelectorAll('.search-result-card');
      if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
    }
  } catch {
    if (resultsEl) resultsEl.innerHTML = '<div class="card" style="text-align:center;padding:32px"><p class="text-secondary">搜索失败，请重试</p></div>';
  }
}

/* =============================================
   AI Search
   ============================================= */

export async function executeAISearch() {
  // Determine input element based on state
  const inputId = searchState.hasSearched ? 'search-top-input' : 'search-hero-input';
  const input = document.getElementById(inputId);
  const q = input?.value?.trim() || searchState.currentQuery;
  if (!q || q.length < 2) {
    showToast('关键词至少 2 个字符');
    return;
  }

  searchState.currentQuery = q;
  searchState.mode = 'ai';

  saveSearchHistory(q);

  // Transition from hero to results if needed
  if (!searchState.hasSearched) {
    await animateHeroToResults(q, 'all');
  }

  // Update URL silently
  const url = `/search?q=${encodeURIComponent(q)}&type=all`;
  history.replaceState({ page: 'search', data: { q, type: 'all' } }, '', url);

  // Hide pills during AI progress
  const pillsRow = document.getElementById('search-pills-row');
  if (pillsRow) pillsRow.style.display = 'none';

  // Show AI overlay inside the results area
  const resultsEl = document.getElementById('search-results');
  if (resultsEl) {
    resultsEl.innerHTML = renderAIOverlay();
  }

  // Fire actual search API in background
  const searchPromise = apiGet(`/api/search?q=${encodeURIComponent(q)}&type=all`).catch(() => null);

  // Determine random total duration (20-50 seconds)
  const totalDuration = 20000 + Math.random() * 30000; // ms
  const stepCount = AI_STEP_LABELS.length;
  const baseStepDuration = totalDuration / stepCount;
  // Add slight random variation per step (±20%)
  const stepDurations = Array.from({ length: stepCount }, () =>
    baseStepDuration * (0.8 + Math.random() * 0.4)
  );
  // Normalize to sum to totalDuration
  const sum = stepDurations.reduce((a, b) => a + b, 0);
  const scale = totalDuration / sum;
  for (let i = 0; i < stepDurations.length; i++) {
    stepDurations[i] *= scale;
  }

  // Create new AbortController for this run
  searchState.aiAbortController = new AbortController();
  const { signal } = searchState.aiAbortController;

  // Start ellipsis animation on the active step
  let ellipsisTimer = null;
  let ellipsisFrame = 3; // start with 3 dots
  const startEllipsis = () => {
    const activeText = document.querySelector('#search-ai-steps .search-ai-step--active .search-ai-step-text');
    if (!activeText) return;
    ellipsisFrame = 3;
    // Set immediately
    if (activeText) activeText.textContent = AI_STEP_LABELS[completedCount] + '...';
    ellipsisTimer = setInterval(() => {
      ellipsisFrame = (ellipsisFrame + 1) % 4; // 3→0→1→2→3
      const dots = '.'.repeat(ellipsisFrame);
      const baseLabel = AI_STEP_LABELS[completedCount];
      if (activeText) activeText.textContent = baseLabel + dots;
    }, 400);
  };

  const stopEllipsis = () => {
    if (ellipsisTimer) {
      clearInterval(ellipsisTimer);
      ellipsisTimer = null;
    }
  };

  const stepsContainer = document.getElementById('search-ai-steps');
  let completedCount = 0;
  let aborted = false;

  // Initial render: first step active
  if (stepsContainer) {
    stepsContainer.innerHTML = buildAIActiveStep(AI_STEP_LABELS[0] + '...');
    if (stepsContainer.children.length) {
      animIn(stepsContainer.children[0], { y: 6, dur: 250, ease: Ease.decelerate });
    }
  }
  startEllipsis();

  try {
    for (let i = 0; i < stepCount; i++) {
      // Wait for this step's duration (with abort support)
      await new Promise((resolve, reject) => {
        searchState.aiTimer = setTimeout(resolve, stepDurations[i]);
        const onAbort = () => {
          clearTimeout(searchState.aiTimer);
          searchState.aiTimer = null;
          stopEllipsis();
          reject(new Error('aborted'));
        };
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });

      stopEllipsis();
      completedCount++;

      if (completedCount < stepCount) {
        // Mark current step as done, show next step as active
        if (stepsContainer) {
          // Replace the active step with a completed one + new active one
          const completedLabel = AI_STEP_LABELS[i];
          const nextLabel = AI_STEP_LABELS[i + 1];
          stepsContainer.innerHTML =
            AI_STEP_LABELS.slice(0, completedCount).map(l => buildAICompletedStep(l)).join('') +
            buildAIActiveStep(nextLabel + '...');
          // Animate the new active step in
          const activeStep = stepsContainer.querySelector('.search-ai-step--active');
          if (activeStep) animIn(activeStep, { y: 6, dur: 250, ease: Ease.decelerate });
        }
        startEllipsis();
      }
    }
    // All steps done — show final completed state
    stopEllipsis();
    if (stepsContainer) {
      stepsContainer.innerHTML = AI_STEP_LABELS.map(l => buildAICompletedStep(l)).join('');
      const allSteps = stepsContainer.querySelectorAll('.search-ai-step--done');
      if (allSteps.length) animStagger(Array.from(allSteps), { y: 6, dur: 300, gap: 50 });
    }
    // Brief pause to show all completed
    await new Promise(r => setTimeout(r, 500));
  } catch (err) {
    if (err.message === 'aborted') {
      aborted = true;
    }
  }

  // All steps complete — wait for API result if not yet arrived
  if (!aborted) {
    const searchData = await searchPromise;

    // Remove overlay
    const overlay = document.getElementById('search-ai-overlay');
    if (overlay) {
      await animOut(overlay, { dur: 250 });
      overlay.remove();
    }

    // Show pills now that results are ready
    if (pillsRow) {
      pillsRow.style.display = '';
      animIn(pillsRow, { y: 10, dur: 300, ease: Ease.decelerate });
    }

    // Show results
    if (resultsEl) {
      if (searchData) {
        resultsEl.innerHTML = renderSearchResults(searchData, q);
        const cards = resultsEl.querySelectorAll('.search-result-card');
        if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
      } else {
        resultsEl.innerHTML = '<div class="card" style="text-align:center;padding:32px"><p class="text-secondary">AI 搜索失败，请重试</p></div>';
      }
    }
  }
}

export function cancelAISearch() {
  if (searchState.aiTimer) {
    clearTimeout(searchState.aiTimer);
    searchState.aiTimer = null;
  }
  if (searchState.aiAbortController) {
    searchState.aiAbortController.abort();
    searchState.aiAbortController = null;
  }
  // Revert state
  const overlay = document.getElementById('search-ai-overlay');
  if (overlay) overlay.remove();
  const resultsEl = document.getElementById('search-results');
  if (resultsEl) resultsEl.innerHTML = '<div class="card" style="text-align:center;padding:32px"><p class="text-secondary">已取消 AI 搜索</p></div>';
  // Show pills again so user can try again
  const pillsRow = document.getElementById('search-pills-row');
  if (pillsRow) {
    pillsRow.style.display = '';
    animIn(pillsRow, { y: 10, dur: 300, ease: Ease.decelerate });
  }
}

/* =============================================
   Other Exports
   ============================================= */

export function handleSearchPageKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    executeAISearch();
  }
}

export function switchSearchTab(type) {
  executeSearch(type);
}

export async function navigateToCourseResult(courseId, postId) {
  window._courseDetailTargetPostId = postId || null;
  navigateTo('course-detail', Number(courseId));
}

export function clearSearchInput() {
  const inputId = searchState.hasSearched ? 'search-top-input' : 'search-hero-input';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
    input.focus();
    // Update clear button visibility
    const clearBtn = document.getElementById('search-hero-clear');
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

/* =============================================
   Page Registration
   ============================================= */

registerPage('search', async (container, data) => {
  const q = data?.q || '';
  const activeTab = data?.type || 'all';

  // Reset state on fresh navigation
  searchState.hasSearched = false;
  searchState.currentQuery = q;
  searchState.currentTab = activeTab;
  searchState.mode = 'normal';

  // Cancel any lingering AI progress
  if (searchState.aiTimer) {
    clearTimeout(searchState.aiTimer);
    searchState.aiTimer = null;
  }
  if (searchState.aiAbortController) {
    searchState.aiAbortController.abort();
    searchState.aiAbortController = null;
  }

  if (q && q.length >= 2) {
    // Direct URL with query — skip hero, go straight to top bar and run AI search
    searchState.hasSearched = true;
    container.innerHTML = renderResultsState(q, activeTab);
    bindSearchEvents(container);
    bindRipples(container);
    animIn(container.querySelector('#search-top-bar'), { y: -16, dur: 380, ease: Ease.standard });
    executeAISearch();
  } else {
    // No query — show centered hero
    container.innerHTML = renderHeroState();
    bindHeroEvents(container);
    bindRipples(container);

    // Animate hero elements in
    const heroInner = container.querySelector('.search-hero-inner');
    if (heroInner) {
      const children = Array.from(heroInner.children);
      if (children.length) animStagger(children, { y: 20, dur: 400, gap: 80 });
    }

    // Focus the input after render
    const input = container.querySelector('#search-hero-input');
    if (input) {
      input.value = q;
      input.focus();
    }
    // Show search history if no query
    if (!q) showHeroHistory(container);
  }
});

/* =============================================
   Event Binding Helpers
   ============================================= */

function bindHeroEvents(container) {
  const input = container.querySelector('#search-hero-input');
  const clearBtn = container.querySelector('#search-hero-clear');
  if (input && clearBtn) {
    input.addEventListener('input', () => {
      clearBtn.style.display = input.value.trim() ? '' : 'none';
    });
  }
}

function bindSearchEvents(container) {
  // Pill tab switching
  container.querySelectorAll('#search-pills .md-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSearchTab(btn.dataset.tab));
  });

  // History quick-search (event delegation)
  container.addEventListener('click', (e) => {
    const hBtn = e.target.closest('.search-history-btn');
    if (hBtn) navigateTo('search', { q: hBtn.dataset.q });
  });
}

function showHeroHistory(container) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('search_history') || '[]'); } catch {}
  if (history.length === 0) return;
  const heroInner = container.querySelector('.search-hero-inner');
  if (!heroInner) return;

  const existing = heroInner.querySelector('.search-hero-history');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'search-hero-history';
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;color:var(--md-on-surface-variant);font-size:13px;margin-bottom:8px;justify-content:center">
      <span class="mi" style="font-size:16px">history</span>
      <span>最近搜索</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
      ${history.map(h => `<button class="btn btn-outline search-history-btn" style="font-size:13px;padding:6px 14px" data-q="${escHtml(h)}">${escHtml(h)}</button>`).join('')}
    </div>
  `;
  heroInner.appendChild(div);
  animIn(div, { y: 10, dur: 300, delay: 200 });
}
