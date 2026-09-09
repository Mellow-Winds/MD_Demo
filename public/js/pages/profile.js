/**
 * pages/profile.js — 个人空间：三栖视角仪表盘 + 签到 + 完整度 + 关注系统
 * 纯 ES6 Module，零全局污染
 */

import { apiGet, apiPut, apiPost, apiDelete, getToken } from '../core/api.js';
import { navigateTo, animIn, animStagger } from '../core/router.js';
import { showToast, openModal, closeModal, escHtml, createMdInput, createMdSelect, createMdTextarea, renderLoginPrompt, bindLoginPrompt, showBottomSheet } from '../components/ui.js';
import { renderAuth } from './auth.js';

/* =============================================
   常量
   ============================================= */

const MBTI_OPTIONS = [
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'
];

const GENDER_OPTIONS = [
  { text: '不设置', value: '' },
  { text: '男', value: 'male' },
  { text: '女', value: 'female' }
];

const COMPLETION_FACTORS = [
  { key: 'nickname',   label: '昵称' },
  { key: 'major',      label: '专业' },
  { key: 'grade',      label: '年级' },
  { key: 'qq',         label: 'QQ号' },
  { key: 'wechat',     label: '微信号' },
  { key: 'avatar_desc', label: '肖像描述' },
  { key: 'mbti',       label: 'MBTI人格' },
  { key: 'gender',     label: '性别' },
];

const PROFILE_SUB_PAGES = {
  'profile-edit':    renderEditPage,
  'profile-privacy': renderPrivacyPage,
  'profile-data':    renderDataPage,
  'profile-user':    renderPublicUserPage,
};

/* =============================================
   状态
   ============================================= */

let previewMode = false;
let profileInteractionController = null;

const CHECKIN_KEY = 'kedazi_checkin';

function getTodayShanghai() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function saveCheckinState(streak, lastDate) {
  try {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify({ streak, lastDate }));
  } catch (e) { /* quota exceeded */ }
}

function loadCheckinState() {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted */ }
  return { streak: 0, lastDate: '' };
}

function syncCheckinToUser() {
  const saved = loadCheckinState();
  if (saved.streak > 0) {
    window._currentUser.checkin_streak = saved.streak;
    window._currentUser.last_checkin_date = saved.lastDate;
  }
}

/* =============================================
   路由注册
   ============================================= */

export function registerProfilePages(registerPage) {
  registerPage('profile', renderProfilePage);
  registerPage('profile-edit', renderEditPage);
  registerPage('profile-privacy', renderPrivacyPage);
  registerPage('profile-data', renderDataPage);
  registerPage('profile-user', renderPublicUserPage);
}

function getProfilePath() {
  const p = location.pathname;
  if (p.startsWith('/profile/')) return p.slice('/profile'.length);
  return '';
}

/* =============================================
   数据获取
   ============================================= */

async function fetchProfileData() {
  const user = window._currentUser;
  if (!user) return null;
  const stats = await apiGet(`/api/user/${user.id}/profile`);
  if (stats.error) return null;
  return { ...user, ...stats };
}

async function fetchPreviewData() {
  const user = window._currentUser;
  if (!user) return null;
  const stats = await apiGet(`/api/user/${user.id}/profile?preview=public`);
  if (stats.error) return null;
  return stats;
}

async function fetchPublicUserData(userId) {
  return apiGet(`/api/user/${userId}/profile`);
}

/* =============================================
   主入口：根据子路径分发
   ============================================= */

async function renderProfilePage(container) {
  const sub = getProfilePath();
  if (sub && PROFILE_SUB_PAGES[sub]) {
    await PROFILE_SUB_PAGES[sub](container);
    return;
  }

  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  if (previewMode) {
    const data = (await fetchPreviewData().catch(() => null)) || {
      id: window._currentUser.id,
      nickname: window._currentUser.nickname,
      avatar_url: window._currentUser.avatar_url,
      privacyHidden: true
    };
    container.innerHTML = data.privacyHidden
      ? renderPrivacyLocked(data, { preview: true })
      : `
        <div class="profile-page">
          ${renderBackButton()}
          ${renderPublicProfileCard(data, { preview: true })}
        </div>
      `;
    container.innerHTML += renderPreviewBanner();
    animateProfile(container);
    bindProfileInteractions(container);
    bindModeSwitch(container);
    return;
  }

  const data = (await fetchProfileData().catch(() => null)) || window._currentUser;
  container.innerHTML = renderProfileCard(data, 'owner');
  animateProfile(container);
  bindProfileInteractions(container);
  bindModeSwitch(container);
  bindAvatarClick();
}

function renderErrorCard(msg) {
  return `
    <div class="profile-page">
      <div class="profile-empty-card">
        <span class="mi profile-empty-icon">error_outline</span>
        <h2 class="profile-empty-title">加载失败</h2>
        <p class="profile-empty-desc">${escHtml(msg || '请刷新页面重试')}</p>
        <button class="btn btn-primary" onclick="navigateTo('profile')">
          <span class="mi">refresh</span>
          重新加载
        </button>
      </div>
    </div>
  `;
}

function renderPreviewBanner() {
  return `
    <div class="profile-preview-banner">
      <span class="mi">visibility</span>
      <span>正在预览他人看到的你的主页</span>
      <button class="profile-preview-banner-btn" onclick="window._exitProfilePreview()">
        <span class="mi">edit</span>
        退出预览
      </button>
    </div>
  `;
}

function animateProfile(container) {
  const cards = container.querySelectorAll('.profile-card, .profile-section');
  animStagger(Array.from(cards), { y: 20, gap: 60 });
}

/* =============================================
   三栖视角：主名片渲染
   ============================================= */

function renderProfileCard(data, mode) {
  const isOwner = mode === 'owner';
  const isPreview = mode === 'preview';
  const isPublic = mode === 'public';
  const readonly = isPreview || isPublic;

  const avatarImg = data.avatar_url
    ? `<img class="profile-avatar-img" src="${escHtml(data.avatar_url)}" alt="">`
    : `<span class="profile-avatar-letter">${(data.nickname || data.username || '?')[0]}</span>`;

  const avatar = isOwner
    ? `<div class="profile-avatar profile-avatar-clickable" id="profile-avatar-area" title="点击更换头像">
         ${avatarImg}
         <span class="profile-avatar-overlay"><span class="mi" style="font-size:20px;color:#fff">photo_camera</span></span>
       </div>`
    : `<div class="profile-avatar">${avatarImg}</div>`;

  const streak = data.checkin_streak || 0;
  const checkedInToday = data.last_checkin_date === getTodayShanghai();
  const streakBadge = renderStreakBadge(streak, checkedInToday, data.grace_days);

  const completion = calcCompletion(data);
  const completionBar = renderCompletionBar(completion, readonly);

  const fields = renderProfileFields(data, readonly);
  const statsRow = renderStatsRow(data);
  const settingsList = isOwner ? renderSettingsList() : '';
  const logoutBtn = isOwner ? `
    <div class="profile-section">
      <button class="btn btn-secondary btn-full" onclick="window.logout()">
        <span class="mi">logout</span>
        退出登录
      </button>
    </div>
  ` : '';

  const checkinAction = isOwner && !checkedInToday ? `
    <button class="btn btn-primary btn-compact profile-checkin-btn" id="profile-checkin-btn">
      <span class="mi">event_available</span>
      签到
    </button>
  ` : '';

  return `
    <div class="profile-page">
      <div class="profile-card profile-main-card">
        <div class="profile-header">
          ${avatar}
          <div class="profile-identity">
            <div class="profile-name">${escHtml(data.nickname || data.username || '未设置昵称')}</div>
            ${streakBadge}
            ${checkinAction}
          </div>
        </div>
        ${completionBar}
        ${fields}
        ${statsRow}
      </div>
      ${settingsList}
      ${logoutBtn}
    </div>
  `;
}

/* =============================================
   签到勋章
   ============================================= */

function renderStreakBadge(streak, checkedIn, graceDays) {
  if (streak === 0) {
    return `<div class="profile-streak-badge">
      <span class="mi profile-streak-icon">local_fire_department</span>
      <span class="profile-streak-count">0</span>
      <span class="profile-streak-label">天</span>
    </div>`;
  }

  let graceInfo = '';
  if (!checkedIn && graceDays > 0) {
    graceInfo = `<span class="profile-streak-grace">${graceDays}天后归零</span>`;
  }

  const iconColor = streak >= 45 ? 'profile-streak-icon-gold' : streak >= 7 ? 'profile-streak-icon-fire' : '';

  return `
    <div class="profile-streak-badge ${checkedIn ? 'checked-in' : ''}">
      <span class="mi profile-streak-icon ${iconColor}">local_fire_department</span>
      <span class="profile-streak-count">${streak}</span>
      <span class="profile-streak-label">天</span>
      ${graceInfo}
    </div>
  `;
}

/* =============================================
   完整度进度条
   ============================================= */

function calcCompletion(data) {
  const total = COMPLETION_FACTORS.length;
  let done = 0;
  for (const f of COMPLETION_FACTORS) {
    if (data[f.key] && String(data[f.key]).trim()) done++;
  }
  return { done, total, percent: Math.round((done / total) * 100) };
}

function renderCompletionBar(completion, readonly) {
  const label = readonly ? '资料完整度' : '我的资料完整度';
  const pct = completion.percent;
  const trackClass = pct === 100 ? 'complete' : '';
  return `
    <div class="profile-completion">
      <div class="profile-completion-head">
        <span class="profile-completion-label">${label}</span>
        <span class="profile-completion-count">${completion.done}/${completion.total}</span>
      </div>
      <div class="profile-completion-track ${trackClass}">
        <div class="profile-completion-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function updateCompletionBar(container, data) {
  const completion = calcCompletion(data);
  const pct = completion.percent;
  const countEl = container.querySelector('.profile-completion-count');
  const fillEl = container.querySelector('.profile-completion-fill');
  const trackEl = container.querySelector('.profile-completion-track');
  if (countEl) countEl.textContent = `${completion.done}/${completion.total}`;
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (trackEl) trackEl.classList.toggle('complete', pct === 100);
}

/* =============================================
   资料字段列表（支持原位编辑）
   ============================================= */

function renderProfileFields(data) {
  const genderText = data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '';
  const fields = [
    { icon: 'person',            remixIcon: null,             label: '性别',     value: genderText },
    { icon: 'school',            remixIcon: null,             label: '专业',     value: data.major },
    { icon: 'class',             remixIcon: null,             label: '年级',     value: data.grade },
    { icon: '',                  remixIcon: 'ri-qq-fill',     label: 'QQ号',     value: data.qq },
    { icon: '',                  remixIcon: 'ri-wechat-fill', label: '微信号',   value: data.wechat },
    { icon: '',                  remixIcon: 'ri-tiktok-fill', label: '抖音号',   value: data.douyin },
    { icon: 'face',              remixIcon: null,             label: '肖像描述', value: data.avatar_desc },
    { icon: 'psychology',        remixIcon: null,             label: 'MBTI',     value: data.mbti },
  ];

  return `
    <div class="profile-fields">
      ${fields.map(f => renderProfileField(f)).join('')}
    </div>
  `;
}

function renderProfileField(field) {
  const value = field.value && String(field.value).trim();
  const displayValue = value
    ? escHtml(field.value)
    : `<span class="profile-field-empty">未填写</span>`;

  const iconClass = field.remixIcon
    ? `${field.remixIcon} profile-field-icon remix-align`
    : 'mi profile-field-icon';
  const iconText = field.remixIcon ? '' : field.icon;

  return `
    <div class="profile-field-row">
      <span class="${iconClass}">${iconText}</span>
      <span class="profile-field-label">${field.label}</span>
      <span class="profile-field-value ${!value ? 'empty' : ''}">${displayValue}</span>
    </div>
  `;
}

/* =============================================
   统计行（关注 / 粉丝）
   ============================================= */

function renderStatsRow(data) {
  const isSelf = window._currentUser && String(window._currentUser.id) === String(data.id);
  const showFollowing = isSelf || data.privacyShowFollowing !== false;
  const showFollowers = isSelf || data.privacyShowFollowers !== false;

  const following = data.followingCount;
  const followers = data.followerCount;

  const followingHtml = following !== null
    ? `<button class="profile-stat-btn" data-stat="following" data-user-id="${data.id}">
        <span class="profile-stat-count">${following || 0}</span>
        <span class="profile-stat-label">关注</span>
      </button>`
    : `<div class="profile-stat-item">
        <span class="profile-stat-count">--</span>
        <span class="profile-stat-label">关注</span>
      </div>`;

  const followersHtml = followers !== null
    ? `<button class="profile-stat-btn" data-stat="followers" data-user-id="${data.id}">
        <span class="profile-stat-count">${followers || 0}</span>
        <span class="profile-stat-label">粉丝</span>
      </button>`
    : `<div class="profile-stat-item">
        <span class="profile-stat-count">--</span>
        <span class="profile-stat-label">粉丝</span>
      </div>`;

  return `
    <div class="profile-stats-row">
      ${followingHtml}
      <div class="profile-stat-divider"></div>
      ${followersHtml}
    </div>
  `;
}

/* =============================================
   MD3 设置列表
   ============================================= */

function renderSettingsList() {
  const items = [
    { icon: 'edit',              title: '编辑资料',   desc: '修改昵称、专业、年级等个人信息',        page: 'profile-edit' },
    { icon: 'lock',              title: '隐私与安全', desc: '管理资料可见性、匹配权限',              page: 'profile-privacy' },
    { icon: 'storage',           title: '管理我的数据', desc: '查看数据概览、导出个人信息',          page: 'profile-data' },
    { icon: 'edit_note',         title: '回声洞留言', desc: '留下一句话，或许会出现在侧栏的回声洞里',  page: 'profile-echocave' },
    { icon: 'preview',           title: '预览他人看我', desc: '切换到他人视角，检查隐私隐藏效果',     page: 'profile-preview' },
  ];

  return `
    <div class="profile-section">
      <div class="profile-card">
        ${items.map(item => renderListItem(item)).join('')}
      </div>
    </div>
  `;
}

function renderListItem(item) {
  return `
    <div class="profile-list-item" data-page="${item.page}">
      <span class="mi profile-list-icon">${item.icon}</span>
      <div class="profile-list-content">
        <div class="profile-list-title">${item.title}</div>
        <div class="profile-list-desc">${item.desc}</div>
      </div>
      <span class="mi profile-list-arrow">chevron_right</span>
    </div>
  `;
}

/* =============================================
   事件绑定
   ============================================= */

function bindProfileInteractions(container) {
  if (profileInteractionController) profileInteractionController.abort();
  profileInteractionController = new AbortController();
  const { signal } = profileInteractionController;

  // 签到
  const checkinBtn = container.querySelector('#profile-checkin-btn');
  if (checkinBtn) {
    checkinBtn.addEventListener('click', handleCheckin, { signal });
  }

  // 设置列表点击
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.profile-list-item');
    if (item) {
      const page = item.dataset.page;
      if (page === 'profile-preview') {
        previewMode = true;
        navigateTo('profile');
      } else if (page === 'profile-echocave') {
        showEchoCaveModal();
      } else {
        navigateTo(page);
      }
    }
  }, { signal });

  // 关注/取关
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.profile-follow-btn');
    if (btn) handleFollow(btn);
    const unfollowBtn = e.target.closest('.profile-unfollow-btn');
    if (unfollowBtn) handleUnfollow(unfollowBtn);
  }, { signal });

  // 交换联系方式
  container.addEventListener('click', (e) => {
    const exchangeBtn = e.target.closest('.profile-exchange-btn');
    if (exchangeBtn) {
      const userId = exchangeBtn.dataset.userId;
      showExchangeModal(userId);
    }
  }, { signal });

  // 统计点击（粉丝/关注列表）
  container.addEventListener('click', (e) => {
    const statBtn = e.target.closest('.profile-stat-btn');
    if (statBtn) {
      const type = statBtn.dataset.stat;
      const userId = statBtn.dataset.userId;
      showFollowList(container, userId, type);
    }
  }, { signal });

}

function bindModeSwitch(container) {
  // 由全局函数控制
}

/* =============================================
   签到逻辑
   ============================================= */

async function handleCheckin() {
  const btn = document.getElementById('profile-checkin-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  let result;
  try {
    result = await apiPost('/api/auth/checkin', {});
  } catch (err) {
    result = { error: '接口请求异常或未就绪' };
  }

  // 后端接口未就绪时，前端 Mock 兜底
  if (result.error) {
    console.warn('[Checkin] 后端签到接口未就绪，使用前端模拟数据');
    const saved = loadCheckinState();
    const today = getTodayShanghai();
    if (saved.lastDate === today) {
      result = { streak: saved.streak, alreadyCheckedIn: true };
    } else {
      result = {
        streak: saved.streak + 1,
        alreadyCheckedIn: false,
      };
    }
  }

  if (result.alreadyCheckedIn) {
    showToast('今天已经签到过了');
  } else {
    showToast(`签到成功！已连续 ${result.streak} 天`);
    window._currentUser.checkin_streak = result.streak;
    const todayStr = getTodayShanghai();
    window._currentUser.last_checkin_date = todayStr;
    window._currentUser.grace_days = 0;
    saveCheckinState(result.streak, todayStr);
  }

  btn.disabled = false;
  navigateTo('profile');
}

/* =============================================
   原位编辑（In-place Edit）
   ============================================= */

function startInlineEdit(el) {
  if (previewMode) return;

  const key = el.dataset.editKey;
  const currentValue = el.dataset.editValue || '';
  const row = el.closest('.profile-field-row');
  const label = row ? row.querySelector('.profile-field-label')?.textContent : key;

  // MBTI 特殊处理：下拉选择
  if (key === 'mbti') {
    startMbtiSelect(el, currentValue);
    return;
  }

  // 性别特殊处理：下拉选择
  if (key === 'gender') {
    startGenderSelect(el, currentValue);
    return;
  }

  // avatar_desc 限制 80 字
  const maxLen = key === 'avatar_desc' ? 80 : 999;

  // 替换为输入框
  el.innerHTML = `
    <input class="profile-inline-input" type="text"
      value="${escHtml(currentValue)}"
      placeholder=" "
      maxlength="${maxLen}"
      data-key="${key}">
  `;

  const input = el.querySelector('.profile-inline-input');
  input.focus();
  input.select();

  let saved = false;

  async function save() {
    if (saved) return;
    saved = true;
    const newValue = input.value.trim();

    // 未变化则还原
    if (newValue === currentValue) {
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      el.dataset.editValue = currentValue;
      return;
    }

    // 长度校验
    if (key === 'avatar_desc' && newValue.length > 80) {
      showToast('肖像描述不能超过80字');
      saved = false;
      return;
    }

    // 发送 API
    const result = await apiPut('/api/auth/me', { [key]: newValue });
    if (result.error) {
      showToast('保存失败：' + result.error);
      saved = false;
      return;
    }

    // 更新全局状态
    window._currentUser[key] = newValue;

    // 更新显示
    el.innerHTML = newValue
      ? escHtml(newValue)
      : '<span class="profile-field-empty">未填写</span>';
    el.dataset.editValue = newValue;
    el.classList.toggle('empty', !newValue);

    showToast('已更新');

    // 更新完整度
    const page = el.closest('.profile-page');
    if (page) updateCompletionBar(page, window._currentUser);
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') {
      saved = true; // 防止 blur 触发保存
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      el.dataset.editValue = currentValue;
    }
  });
}

function startMbtiSelect(el, currentValue) {
  const optionsHtml = MBTI_OPTIONS.map(m =>
    `<div class="profile-mbti-option ${m === currentValue ? 'selected' : ''}" data-value="${m}">${m}</div>`
  ).join('');

  el.innerHTML = `
    <div class="profile-mbti-dropdown">
      ${optionsHtml}
    </div>
  `;

  const dropdown = el.querySelector('.profile-mbti-dropdown');

  dropdown.addEventListener('click', async (e) => {
    const opt = e.target.closest('.profile-mbti-option');
    if (!opt) return;

    const newValue = opt.dataset.value;
    if (newValue === currentValue) {
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      return;
    }

    const result = await apiPut('/api/auth/me', { mbti: newValue });
    if (result.error) {
      showToast('保存失败：' + result.error);
      return;
    }

    window._currentUser.mbti = newValue;
    el.innerHTML = escHtml(newValue);
    el.dataset.editValue = newValue;
    el.classList.remove('empty');
    showToast('MBTI 已更新');

    const page = el.closest('.profile-page');
    if (page) updateCompletionBar(page, window._currentUser);
  });

  // 点击外部关闭
  const closeHandler = (e) => {
    if (!el.contains(e.target)) {
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function startGenderSelect(el, currentValue) {
  const genderDisplay = { male: '男', female: '女' };
  const optionsHtml = GENDER_OPTIONS.map(g =>
    `<div class="profile-mbti-option ${g.value === currentValue ? 'selected' : ''}" data-value="${g.value}">${g.text}</div>`
  ).join('');

  el.innerHTML = `
    <div class="profile-mbti-dropdown">
      ${optionsHtml}
    </div>
  `;

  const dropdown = el.querySelector('.profile-mbti-dropdown');

  dropdown.addEventListener('click', async (e) => {
    const opt = e.target.closest('.profile-mbti-option');
    if (!opt) return;

    const newValue = opt.dataset.value;
    if (newValue === currentValue) {
      el.innerHTML = genderDisplay[currentValue]
        ? escHtml(genderDisplay[currentValue])
        : '<span class="profile-field-empty">未填写</span>';
      return;
    }

    const result = await apiPut('/api/auth/me', { gender: newValue });
    if (result.error) {
      showToast('保存失败：' + result.error);
      return;
    }

    window._currentUser.gender = newValue;
    el.innerHTML = genderDisplay[newValue]
      ? escHtml(genderDisplay[newValue])
      : '<span class="profile-field-empty">未填写</span>';
    el.dataset.editValue = newValue;
    el.classList.toggle('empty', !newValue);
    showToast('性别已更新');

    const page = el.closest('.profile-page');
    if (page) updateCompletionBar(page, window._currentUser);
  });

  // 点击外部关闭
  const closeHandler = (e) => {
    if (!el.contains(e.target)) {
      el.innerHTML = genderDisplay[currentValue]
        ? escHtml(genderDisplay[currentValue])
        : '<span class="profile-field-empty">未填写</span>';
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/* =============================================
   关注 / 取关
   ============================================= */

async function handleFollow(btn) {
  const userId = btn.dataset.userId;
  btn.disabled = true;

  const result = await apiPost(`/api/user/${userId}/follow`, {});
  if (result.error) {
    showToast(result.error);
    btn.disabled = false;
    return;
  }

  showToast('已关注');
  navigateTo('profile-user', userId);
}

async function handleUnfollow(btn) {
  const userId = btn.dataset.userId;
  btn.disabled = true;

  const result = await apiDelete(`/api/user/${userId}/follow`);
  if (result.error) {
    showToast(result.error);
    btn.disabled = false;
    return;
  }

  showToast('已取消关注');
  navigateTo('profile-user', userId);
}

/* =============================================
   交换联系方式
   ============================================= */

async function showExchangeModal(userId) {
  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4);">
      <p style="color:var(--md-on-surface-variant);font-size:var(--text-sm);margin:0;">
        发送交换请求后，对方可以在通知中查看并决定是否同意。同意后双方可以看到彼此的联系方式。
      </p>
      ${createMdTextarea({
        id: 'exchange-message',
        label: '附带信息',
        rows: 3,
        placeholder: ' '
      })}
      <div style="display:flex;gap:var(--space-3);justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" id="exchange-confirm-btn">
          <span class="mi">send</span> 发送请求
        </button>
      </div>
    </div>
  `;

  openModal('交换联系方式', bodyHtml);

  document.getElementById('exchange-confirm-btn').addEventListener('click', async () => {
    const btn = document.getElementById('exchange-confirm-btn');
    btn.disabled = true;

    const message = document.getElementById('exchange-message')?.value?.trim() || '';
    const result = await apiPost(`/api/user/${userId}/contact-exchange`, { message });

    if (result.error) {
      showToast(result.error);
      btn.disabled = false;
      return;
    }

    showToast(result.alreadyAccepted ? '你们已交换过联系方式，可在通知中心查看' : '请求已发送');
    closeModal();
  });
}

/* =============================================
   粉丝 / 关注列表弹窗
   ============================================= */

async function showFollowList(container, userId, type) {
  const endpoint = type === 'followers'
    ? `/api/user/${userId}/followers`
    : `/api/user/${userId}/following`;

  const list = await apiGet(endpoint);
  if (list.error) {
    showToast('获取列表失败');
    return;
  }

  const title = type === 'followers' ? '粉丝列表' : '关注列表';

  if (!list.length) {
    showToast(type === 'followers' ? '暂无粉丝' : '暂未关注任何人');
    return;
  }

  const listHtml = list.map(u => `
    <div class="profile-follow-item" data-user-id="${u.id}">
      <div class="avatar-small">${(u.nickname || u.username || '?')[0]}</div>
      <div class="profile-follow-info">
        <div class="profile-follow-name">${escHtml(u.nickname || u.username || '未设置昵称')}</div>
        <div class="profile-follow-meta">${escHtml(u.major || '')} ${escHtml(u.grade || '')}</div>
      </div>
      <span class="mi profile-list-arrow">chevron_right</span>
    </div>
  `).join('');

  // 使用模态框显示
  openModal(title, `<div class="profile-follow-list">${listHtml}</div>`);

  // 绑定点击事件
  document.querySelectorAll('.profile-follow-item').forEach(item => {
    item.addEventListener('click', () => {
      const uid = item.dataset.userId;
      closeModal();
      if (String(uid) === String(window._currentUser?.id)) {
        previewMode = false;
        navigateTo('profile');
      } else {
        navigateTo('profile-user', uid);
      }
    });
  });
}

/* =============================================
   公开主页（查看他人）
   ============================================= */

async function renderPublicUserPage(container, userId) {
  // 从 URL 获取 userId
  const pathParts = location.pathname.split('/');
  const uid = userId || pathParts[pathParts.length - 1];

  if (!uid || isNaN(uid)) {
    container.innerHTML = renderNotFound();
    return;
  }

  // 如果是自己，跳转到自己的主页
  if (window._currentUser && String(window._currentUser.id) === String(uid)) {
    previewMode = false;
    navigateTo('profile');
    return;
  }

  try {
    const data = await fetchPublicUserData(uid);
    if (!data || data.error) {
      container.innerHTML = renderNotFound();
      return;
    }

    if (data.privacyHidden) {
      container.innerHTML = renderPrivacyLocked(data);
      bindProfileInteractions(container);
      return;
    }

    container.innerHTML = `
      <div class="profile-page">
        ${renderBackButton()}
        ${renderPublicProfileCard(data)}
      </div>
    `;
    animateProfile(container);
    bindProfileInteractions(container);
  } catch (err) {
    console.error('[Profile] 加载用户主页失败:', err);
    container.innerHTML = renderErrorCard(err.message);
  }
}

function renderPublicProfileCard(data, options = {}) {
  const isPreview = options.preview === true;
  const avatar = data.avatar_url
    ? `<img class="profile-avatar-img" src="${escHtml(data.avatar_url)}" alt="">`
    : `<span class="profile-avatar-letter">${(data.nickname || '?')[0]}</span>`;

  const followBtn = data.isFollowing
    ? `<button class="btn btn-secondary btn-compact profile-unfollow-btn" data-user-id="${data.id}">
        <span class="mi">person_remove</span> 取消关注
      </button>`
    : `<button class="btn btn-primary btn-compact profile-follow-btn" data-user-id="${data.id}">
        <span class="mi">person_add</span> 关注
      </button>`;

  const exchangeBtn = window._currentUser && !isPreview
    ? `<button class="btn btn-secondary btn-compact profile-exchange-btn" data-user-id="${data.id}">
        <span class="mi">swap_horiz</span> 交换联系方式
      </button>`
    : '';

  const previewActions = isPreview && window._currentUser
    ? `
      <button class="btn btn-primary btn-compact" disabled>
        <span class="mi">person_add</span> 关注
      </button>
      <button class="btn btn-secondary btn-compact" disabled>
        <span class="mi">swap_horiz</span> 交换联系方式
      </button>
    `
    : '';

  const genderText = data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '';
  const fields = [
    { icon: 'person',      remixIcon: null,             label: '性别', value: genderText },
    { icon: 'school',      remixIcon: null,             label: '专业', value: data.major },
    { icon: 'class',       remixIcon: null,             label: '年级', value: data.grade },
    { icon: '',            remixIcon: 'ri-qq-fill',     label: 'QQ号', value: data.qq },
    { icon: '',            remixIcon: 'ri-wechat-fill', label: '微信号', value: data.wechat },
    { icon: '',            remixIcon: 'ri-tiktok-fill', label: '抖音号', value: data.douyin },
    { icon: 'face',        remixIcon: null,             label: '肖像', value: data.avatar_desc },
    { icon: 'psychology',  remixIcon: null,             label: 'MBTI', value: data.mbti },
  ];

  const fieldsHtml = fields.map(f => {
    if (!f.value) return '';
    const iconClass = f.remixIcon
      ? `${f.remixIcon} profile-field-icon remix-align`
      : 'mi profile-field-icon';
    const iconText = f.remixIcon ? '' : f.icon;
    return `
      <div class="profile-field-row">
        <span class="${iconClass}">${iconText}</span>
        <span class="profile-field-label">${f.label}</span>
        <span class="profile-field-value">${escHtml(f.value)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="profile-card profile-main-card">
      <div class="profile-header">
        <div class="profile-avatar">${avatar}</div>
        <div class="profile-identity">
          <div class="profile-name">${escHtml(data.nickname || '未设置昵称')}</div>
          <div class="profile-action-btns">
            ${isPreview ? previewActions : (window._currentUser ? followBtn : '')}
            ${exchangeBtn}
          </div>
        </div>
      </div>
      <div class="profile-fields">${fieldsHtml}</div>
      ${renderCommonCourses(data.commonCourses)}
      ${renderStatsRow(data)}
    </div>
  `;
}

function renderCommonCourses(courses = []) {
  if (!courses.length) return '';
  return `
    <div class="profile-common-courses">
      <div class="profile-common-title"><span class="mi">school</span>共同课程 ${courses.length} 门</div>
      <div class="profile-common-list">
        ${courses.map(course => `
          <button class="profile-common-course" onclick="navigateTo('course-detail', ${course.id})">
            ${escHtml(course.title)}${course.teacher ? `<span>${escHtml(course.teacher)}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPrivacyLocked(data, options = {}) {
  const isPreview = options.preview === true;
  const followBtn = data.isFollowing
    ? `<button class="btn btn-secondary btn-compact profile-unfollow-btn" data-user-id="${data.id}">
        <span class="mi">person_remove</span> 取消关注
      </button>`
    : `<button class="btn btn-primary btn-compact profile-follow-btn" data-user-id="${data.id}">
        <span class="mi">person_add</span> 关注
      </button>`;

  const exchangeBtn = window._currentUser && !isPreview
    ? `<button class="btn btn-secondary btn-compact profile-exchange-btn" data-user-id="${data.id}">
        <span class="mi">swap_horiz</span> 交换联系方式
      </button>`
    : '';

  const previewActions = isPreview && window._currentUser
    ? `
      <button class="btn btn-primary btn-compact" disabled>
        <span class="mi">person_add</span> 关注
      </button>
      <button class="btn btn-secondary btn-compact" disabled>
        <span class="mi">swap_horiz</span> 交换联系方式
      </button>
    `
    : '';

  return `
    <div class="profile-page">
      ${renderBackButton()}
      <div class="profile-empty-card">
        <span class="mi profile-empty-icon">lock</span>
        <h2 class="profile-empty-title">该用户已设置隐私</h2>
        <p class="profile-empty-desc">${escHtml(data.nickname || '该用户')} 暂未公开个人资料</p>
        <div class="profile-action-btns">
          ${isPreview ? previewActions : (window._currentUser ? followBtn : '')}
          ${exchangeBtn}
        </div>
      </div>
    </div>
  `;
}

function renderNotFound() {
  return `
    <div class="profile-page">
      ${renderBackButton()}
      <div class="profile-empty-card">
        <span class="mi profile-empty-icon">person_off</span>
        <h2 class="profile-empty-title">用户不存在</h2>
        <p class="profile-empty-desc">该用户可能已注销</p>
      </div>
    </div>
  `;
}

function renderBackButton() {
  return `
    <div class="profile-sub-header">
      <button class="btn-icon" onclick="history.back()">
        <span class="mi">arrow_back</span>
      </button>
      <span class="profile-breadcrumb">返回</span>
    </div>
  `;
}

/* =============================================
   子页面：编辑资料
   ============================================= */

async function renderEditPage(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  let data;
  try {
    data = await fetchProfileData();
  } catch (e) {
    console.error('[Profile] 加载编辑页失败:', e);
  }
  if (!data) data = window._currentUser;

  container.innerHTML = `
    <div class="profile-page">
      <div class="profile-sub-header">
        <button class="btn-icon" onclick="navigateTo('profile')">
          <span class="mi">arrow_back</span>
        </button>
        <span class="profile-breadcrumb">个人空间 <span class="mi breadcrumb-sep">chevron_right</span> 编辑资料</span>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">基本资料</h2>
        ${createMdInput({ id: 'edit-nickname', label: '昵称', value: data.nickname || '', required: true })}
        ${createMdSelect({
          id: 'edit-gender',
          label: '性别',
          options: GENDER_OPTIONS,
          selected: data.gender || ''
        })}
        ${createMdInput({ id: 'edit-major', label: '专业', value: data.major || '' })}
        ${createMdInput({ id: 'edit-grade', label: '年级', value: data.grade || '' })}
        ${createMdInput({ id: 'edit-qq', label: 'QQ号', value: data.qq || '' })}
        ${createMdInput({ id: 'edit-wechat', label: '微信号', value: data.wechat || '' })}
        ${createMdInput({ id: 'edit-douyin', label: '抖音号', value: data.douyin || '' })}
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">个性资料</h2>
        <div class="md-input-group">
          <textarea class="md-input" id="edit-avatar-desc" placeholder=" " rows="3" maxlength="80" style="resize:none">${escHtml(data.avatar_desc || '')}</textarea>
          <label class="md-label">个人肖像描述</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>个人肖像描述</span></legend></fieldset>
        </div>
        ${createMdSelect({
          id: 'edit-mbti',
          label: 'MBTI 人格',
          options: [
            { text: '请选择', value: '' },
            ...MBTI_OPTIONS.map(m => ({ text: m, value: m }))
          ],
          selected: data.mbti || ''
        })}
      </div>

      <div class="profile-section">
        <button class="btn btn-primary btn-full" id="profile-save-btn">
          <span class="mi">save</span>
          保存修改
        </button>
      </div>
    </div>
  `;

  animIn(container.querySelector('.profile-card'));

  // 绑定保存
  const saveBtn = document.getElementById('profile-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveProfile);
  }
}

async function handleSaveProfile() {
  try {
    const nickname = document.getElementById('edit-nickname')?.value?.trim();
    if (!nickname) {
      showToast('昵称不能为空');
      return;
    }

    const updates = {
      nickname,
      major:    document.getElementById('edit-major')?.value?.trim() || '',
      grade:    document.getElementById('edit-grade')?.value?.trim() || '',
      qq:       document.getElementById('edit-qq')?.value?.trim() || '',
      wechat:   document.getElementById('edit-wechat')?.value?.trim() || '',
      douyin:   document.getElementById('edit-douyin')?.value?.trim() || '',
      avatar_desc: document.getElementById('edit-avatar-desc')?.value?.trim() || '',
      mbti:     document.getElementById('edit-mbti')?.value?.trim() || '',
      gender:   document.getElementById('edit-gender')?.value?.trim() || '',
    };

    const btn = document.getElementById('profile-save-btn');
    if (btn) btn.disabled = true;

    const result = await apiPut('/api/auth/me', updates);
    if (result.error) {
      showToast('保存失败：' + result.error);
      if (btn) btn.disabled = false;
      return;
    }

    window._currentUser = result;
    showToast('资料已保存');
    navigateTo('profile');
  } catch (err) {
    console.error('[Profile] 保存失败:', err);
    showToast('保存异常：' + (err.message || '未知错误'));
    const btn = document.getElementById('profile-save-btn');
    if (btn) btn.disabled = false;
  }
}

/* =============================================
   子页面：隐私与安全
   ============================================= */

async function renderPrivacyPage(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  const user = window._currentUser;
  const showFollowing = user.privacy_show_following !== 0;
  const showFollowers = user.privacy_show_followers !== 0;

  container.innerHTML = `
    <div class="profile-page">
      <div class="profile-sub-header">
        <button class="btn-icon" onclick="navigateTo('profile')">
          <span class="mi">arrow_back</span>
        </button>
        <span class="profile-breadcrumb">个人空间 <span class="mi breadcrumb-sep">chevron_right</span> 隐私与安全</span>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">隐私设置</h2>

        <div class="profile-toggle-row" data-field="privacy_show_following">
          <div class="profile-toggle-info">
            <span class="mi profile-toggle-icon">visibility</span>
            <div>
              <div class="profile-toggle-title">允许其他人查看关注列表</div>
              <div class="profile-toggle-desc">其他用户可以查看你的关注列表</div>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-show-following" ${showFollowing ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="profile-toggle-row" data-field="privacy_show_followers">
          <div class="profile-toggle-info">
            <span class="mi profile-toggle-icon">group</span>
            <div>
              <div class="profile-toggle-title">允许其他人查看粉丝列表</div>
              <div class="profile-toggle-desc">其他用户可以查看你的粉丝列表</div>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-show-followers" ${showFollowers ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;

  animIn(container.querySelector('.profile-card'));

  // 绑定开关
  document.getElementById('toggle-show-following').addEventListener('change', (e) => {
    handlePrivacyToggle('privacy_show_following', e.target.checked);
  });
  document.getElementById('toggle-show-followers').addEventListener('change', (e) => {
    handlePrivacyToggle('privacy_show_followers', e.target.checked);
  });
}

async function handlePrivacyToggle(field, value) {
  const result = await apiPut('/api/auth/me', { [field]: value });
  if (result.error) {
    showToast('设置失败：' + result.error);
    return;
  }
  window._currentUser = result;
  showToast(value ? '已开启' : '已关闭');
}

/* =============================================
   子页面：管理我的数据
   ============================================= */

async function renderDataPage(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  const user = window._currentUser;
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('zh-CN')
    : '未知';
  const completion = calcCompletion(user);

  container.innerHTML = `
    <div class="profile-page">
      <div class="profile-sub-header">
        <button class="btn-icon" onclick="navigateTo('profile')">
          <span class="mi">arrow_back</span>
        </button>
        <span class="profile-breadcrumb">个人空间 <span class="mi breadcrumb-sep">chevron_right</span> 管理我的数据</span>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">数据概览</h2>
        <div class="profile-data-grid">
          <div class="profile-data-item">
            <span class="mi profile-data-icon">calendar_today</span>
            <div class="profile-data-label">注册时间</div>
            <div class="profile-data-value">${joinDate}</div>
          </div>
          <div class="profile-data-item">
            <span class="mi profile-data-icon">assessment</span>
            <div class="profile-data-label">资料完整度</div>
            <div class="profile-data-value">${completion.percent}%</div>
          </div>
          <div class="profile-data-item">
            <span class="mi profile-data-icon">local_fire_department</span>
            <div class="profile-data-label">连续签到</div>
            <div class="profile-data-value">${user.checkin_streak || 0} 天</div>
          </div>
        </div>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">操作</h2>
        <div class="profile-list-item" id="btn-export-data">
          <span class="mi profile-list-icon">download</span>
          <div class="profile-list-content">
            <div class="profile-list-title">下载个人信息</div>
            <div class="profile-list-desc">导出你的账号数据副本</div>
          </div>
          <span class="mi profile-list-arrow">chevron_right</span>
        </div>
        <div class="profile-list-item danger" id="btn-delete-account">
          <span class="mi profile-list-icon">delete_forever</span>
          <div class="profile-list-content">
            <div class="profile-list-title">注销账号</div>
            <div class="profile-list-desc">永久删除你的账号和所有数据</div>
          </div>
          <span class="mi profile-list-arrow">chevron_right</span>
        </div>
      </div>
    </div>
  `;

  animIn(container.querySelector('.profile-card'));

  // 绑定导出
  document.getElementById('btn-export-data')?.addEventListener('click', handleExportData);
  // 绑定注销
  document.getElementById('btn-delete-account')?.addEventListener('click', () => {
    showToast('注销功能暂未开放，如需注销请联系管理员');
  });
}

function handleExportData() {
  const user = window._currentUser;
  if (!user) return;

  const data = {
    导出时间: new Date().toISOString(),
    用户ID: user.id,
    邮箱: user.email,
    昵称: user.nickname,
    专业: user.major,
    年级: user.grade,
    QQ号: user.qq,
    微信号: user.wechat,
    抖音号: user.douyin,
    肖像描述: user.avatar_desc,
    MBTI: user.mbti,
    连续签到: user.checkin_streak,
    注册时间: user.created_at,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `课搭子_个人数据_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出');
}

/* =============================================
   子页面：回声洞留言（模态框）
   ============================================= */

// 留言通过设置列表的 page='profile-echocave' 触发
// 在 bindProfileInteractions 中处理

export async function showEchoCaveModal() {
  // 风控：检查今日是否已提交
  const today = new Date().toISOString().slice(0, 10);
  let alreadySubmitted = false;
  try {
    const saved = JSON.parse(localStorage.getItem('echo_last_submit'));
    if (saved && saved.date === today) alreadySubmitted = true;
  } catch { /* ignore */ }

  const disabledAttr = alreadySubmitted ? 'disabled' : '';
  const hintText = alreadySubmitted
    ? '你今天已经留过言了，明天再来吧 ✨'
    : '每天限留一条心声，它会随机出现在侧栏的回声洞里';

  const html = `
    <div class="profile-feedback-form">
      <p class="echo-cave-daily-hint">${hintText}</p>
      <div class="md-input-group">
        <textarea class="md-input" id="echocave-content" placeholder=" " rows="4" maxlength="200" required style="resize:none" ${disabledAttr}>${disabledAttr ? '今天已留过言啦' : ''}</textarea>
        <label class="md-label">你想对世界说什么？（5-200 字）</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>你想对世界说什么？（5-200 字）</span></legend></fieldset>
      </div>
      <p class="echo-cave-char-count"><span id="echocave-char-count">0</span>/200</p>
      <button class="btn btn-primary btn-full" id="echocave-submit-btn" ${disabledAttr}>
        <span class="mi">edit_note</span>
        投入回声洞
      </button>
    </div>
  `;

  openModal('回声洞留言', html);

  // 如果今天已提交，直接返回不绑定事件
  if (alreadySubmitted) return;

  // 字符计数器
  const textarea = document.getElementById('echocave-content');
  const charCount = document.getElementById('echocave-char-count');
  if (textarea && charCount) {
    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });
  }

  // 提交
  document.getElementById('echocave-submit-btn')?.addEventListener('click', async () => {
    const content = textarea?.value?.trim();
    if (!content) {
      showToast('请填写内容');
      return;
    }
    if (content.length < 5) {
      showToast('内容至少 5 个字');
      return;
    }
    if (content.length > 200) {
      showToast('内容最多 200 个字');
      return;
    }

    const btn = document.getElementById('echocave-submit-btn');
    if (btn) btn.disabled = true;

    const result = await apiPost('/api/echo-cave/quotes', { content });
    if (result.error) {
      showToast(result.error);
      if (btn) btn.disabled = false;
      return;
    }

    // 成功后记录日期
    localStorage.setItem('echo_last_submit', JSON.stringify({ date: today }));
    showToast('你的回声已投入洞中！');
    closeModal();
  });
}

/* =============================================
   头像上传
   ============================================= */

/* =============================================
   头像交互 — 底部抽屉 → 裁剪 → 上传
   ============================================= */

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const AVATAR_MAX_SIZE = 30 * 1024 * 1024; // 30MB 极端兜底，大部分图片会预压缩

/**
 * 点击头像 → 弹出底部动作菜单
 */
function openAvatarSheet() {
  // 检测是否有真实摄像头（桌面端即使 DevTools 模拟手机，也没有摄像头）
  const hasCamera = !!navigator.mediaDevices?.getUserMedia;
  const hasAvatar = !!window._currentUser?.avatar_url;

  const items = [
    {
      icon: 'image',
      label: '从相册选择',
      onClick: () => pickImageFile(false)
    }
  ];

  // 仅有真实摄像头的设备才显示拍照上传
  if (hasCamera) {
    items.push({
      icon: 'camera_alt',
      label: '拍照上传',
      onClick: () => pickImageFile(true)
    });
  }

  // 仅当前有自定义头像时才显示恢复默认
  if (hasAvatar) {
    items.push({
      icon: 'refresh',
      label: '恢复默认头像',
      onClick: resetToDefaultAvatar
    });
  }

  items.push({ label: '取消', isCancel: true });

  showBottomSheet(items);
}

/**
 * 打开文件选择器（相册或拍照）
 */
function pickImageFile(capture) {
  const input = document.createElement('input');
  input.type = 'file';
  // 拍照模式：accept="image/*" 配合 capture 属性，强制调用摄像头
  input.accept = capture ? 'image/*' : AVATAR_ALLOWED_TYPES.join(',');
  if (capture) {
    input.setAttribute('capture', 'environment');
  }
  input.style.display = 'none';

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 前端文件校验（30MB 极端兜底）
    const error = validateAvatarFile(file);
    if (error) {
      showToast(error);
      return;
    }

    // 第一级：预压缩（> 1MB 或需 EXIF 修正时触发）
    let imageUrl;
    if (file.size > 1 * 1024 * 1024) {
      showToast('正在自动压缩图片，请稍候...');
    }
    try {
      const compressed = await precompressImage(file);
      imageUrl = compressed.url;
      // 保存预压缩引用（存入闭包变量，不上字符串属性）
      window._avatarPrecompressed = { blob: compressed.blob, precompressed: compressed.precompressed };
    } catch (err) {
      showToast(err.message || '图片处理失败');
      return;
    }

    showAvatarCropper(imageUrl);
  });

  document.body.appendChild(input);
  input.click();

  // 清理
  setTimeout(() => input.remove(), 500);

  // 检测摄像头权限被拒（仅拍照模式）
  if (capture) {
    setTimeout(async () => {
      if (input.files?.length || document.querySelector('.cropper-fullscreen')) return;
      try {
        const status = await navigator.permissions.query({ name: 'camera' });
        if (status.state === 'denied') {
          showToast('需要相机权限才能拍照上传');
        }
      } catch { /* 不支持 permissions API */ }
    }, 1500);
  }
}

/**
 * 文件前端校验
 */
function validateAvatarFile(file) {
  if (file.size > AVATAR_MAX_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return `图片过大（${sizeMB}MB），请选择小于 30MB 的图片`;
  }
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return '仅支持 JPG、PNG、GIF、WebP 格式';
  }
  return null;
}

/**
 * 读取 JPEG EXIF Orientation
 */
function getExifOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target.result);
      if (view.getUint16(0, false) !== 0xFFD8) return resolve(1);
      const length = view.byteLength;
      let offset = 2;
      while (offset < length) {
        if (view.getUint16(offset, false) !== 0xFFE1) {
          offset += 2 + view.getUint16(offset + 2, false);
          continue;
        }
        offset += 4;
        if (view.getUint32(offset, false) !== 0x45786966) return resolve(1);
        offset += 6;
        const little = view.getUint16(offset, false) === 0x4949;
        const ifdOffset = offset + 2 + view.getUint32(offset + 2, little);
        const tags = view.getUint16(ifdOffset, little);
        let tagOffset = ifdOffset + 2;
        for (let i = 0; i < tags; i++) {
          if (view.getUint16(tagOffset, little) === 0x0112) {
            return resolve(view.getUint16(tagOffset + 8, little));
          }
          tagOffset += 12;
        }
        break;
      }
      resolve(1);
    };
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

/**
 * 第一级压缩：预压缩图片，使最长边 ≤ 2048px，同时修正 EXIF 方向
 * 返回 { url, blob } — url 用于裁剪器预览，blob 用于兜底上传
 */
async function precompressImage(file) {
  // 先检查是否需要预压缩（小图片直接跳过）
  const needsPrecompress = file.size > 1 * 1024 * 1024; // > 1MB 才预压缩
  const orientation = await getExifOrientation(file);
  const needsRotation = orientation > 1;

  if (!needsPrecompress && !needsRotation) {
    // 小图片且无需旋转：直接使用原文件
    return { url: URL.createObjectURL(file), blob: file, precompressed: false };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectURL = URL.createObjectURL(file);

    // 10 秒超时保护
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectURL);
      // 超时降级：直接使用原图
      resolve({ url: objectURL, blob: file, precompressed: false, timeout: true });
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);

      try {
        const MAX_EDGE = 2048;
        let { width, height } = img;

        // 等比缩放使最长边 ≤ MAX_EDGE
        if (width > MAX_EDGE || height > MAX_EDGE) {
          const ratio = Math.min(MAX_EDGE / width, MAX_EDGE / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // iOS Safari canvas 像素限制兼容
        const totalPixels = width * height;
        if (totalPixels > 268435456) { // ~268MP, iOS Safari 硬限制
          const scaleRatio = Math.sqrt(268435456 / totalPixels);
          width = Math.round(width * scaleRatio);
          height = Math.round(height * scaleRatio);
          canvas.width = width;
          canvas.height = height;
        }

        // 处理 EXIF 旋转
        ctx.save();
        switch (orientation) {
          case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
          case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
          case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
          case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
          case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
          case 7: ctx.transform(0, -1, -1, 0, height, width); break;
          case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
        }
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();

        URL.revokeObjectURL(objectURL);

        canvas.toBlob((blob) => {
          if (!blob) {
            // 降级：使用原图
            resolve({ url: URL.createObjectURL(file), blob: file, precompressed: false });
            return;
          }
          const url = URL.createObjectURL(blob);
          resolve({ url, blob, precompressed: true });
        }, 'image/jpeg', 0.9);
      } catch (err) {
        URL.revokeObjectURL(objectURL);
        // 降级：使用原图
        resolve({ url: URL.createObjectURL(file), blob: file, precompressed: false });
        console.warn('预压缩失败，使用原图:', err);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectURL);
      reject(new Error('图片无法读取，请换一张重试'));
    };

    img.src = objectURL;
  });
}

/**
 * 第三级压缩：自动质量降级，确保 blob ≤ 2MB
 * @param {HTMLCanvasElement} canvas
 * @param {number} targetBytes
 * @returns {Promise<Blob>}
 */
function compressToTargetSize(canvas, targetBytes = 2 * 1024 * 1024) {
  return new Promise((resolve) => {
    let quality = 0.9;
    const minQuality = 0.3;

    function tryCompress(q) {
      canvas.toBlob((blob) => {
        if (!blob) {
          // 失败降级：最低质量
          if (q > minQuality) { tryCompress(q - 0.1); return; }
          canvas.toBlob((b) => resolve(b), 'image/jpeg', minQuality);
          return;
        }
        if (blob.size <= targetBytes || q <= minQuality) {
          resolve(blob);
        } else {
          tryCompress(Math.max(minQuality, q - 0.1));
        }
      }, 'image/jpeg', q);
    }

    tryCompress(quality);
  });
}

/**
 * 根据 EXIF Orientation 旋转图片，返回修正后的 object URL
 */
function applyExifRotation(url, orientation) {
  return new Promise((resolve) => {
    if (orientation <= 1) return resolve(url);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const { width, height } = img;

      if (orientation >= 5) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.save();
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, height, width); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(URL.createObjectURL(blob));
      }, 'image/jpeg', 0.95);
    };
    img.src = url;
  });
}

/**
 * 打开裁剪界面
 */
async function showAvatarCropper(imageUrl) {
  // imageUrl 已是预压缩后的 URL（含 EXIF 修正），直接用于裁剪器
  const objectURL = imageUrl;

  const overlay = document.createElement('div');
  overlay.className = 'cropper-fullscreen';
  overlay.id = 'cropper-overlay';
  overlay.innerHTML = `
    <div class="cropper-wrapper">
      <div class="cropper-header">
        <button class="cropper-btn-text" id="cropper-cancel">取消</button>
        <span class="cropper-title">裁剪头像</span>
        <button class="cropper-btn-fill" id="cropper-save">保存</button>
      </div>
      <div class="cropper-area">
        <img id="cropper-image" src="${objectURL}" alt="">
      </div>
      <div class="cropper-footer">
        <button class="cropper-btn-icon" id="cropper-rotate" title="旋转">
          <span class="mi">rotate_right</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 初始化 Cropper（v1.6.2，构造函数直接在 window.Cropper）
  const imageEl = overlay.querySelector('#cropper-image');
  const cropper = new Cropper(imageEl, {
    aspectRatio: 1,
    viewMode: 1,            // 禁止图片拖出裁剪框
    dragMode: 'move',       // 拖动图片而非裁剪框
    autoCropArea: 1,        // 裁剪框初始占满图片
    minCanvasWidth: 300,    // 强制图片最小宽度
    minCanvasHeight: 300,   // 强制图片最小高度
    minCropBoxWidth: 192,   // 裁剪框最小尺寸
    cropBoxMovable: false,  // 禁止移动裁剪框
    cropBoxResizable: false,// 禁止调整裁剪框大小
    guides: true,           // 九宫格辅助线
    background: false,
    modal: true,            // 裁剪框外半透明遮罩
    rotatable: true,
    scalable: true,
    zoomable: true,
    zoomOnWheel: true,
    responsive: true,
    restore: false
  });

  // 保存按钮
  const saveBtn = overlay.querySelector('#cropper-save');
  const cancelBtn = overlay.querySelector('#cropper-cancel');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.innerHTML = '<span class="md-spinner" style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block"></span> 处理中...';

    try {
      const canvas = cropper.getCroppedCanvas({ width: 384, height: 384 });
      const result = await uploadCroppedAvatar(canvas, (progress) => {
        saveBtn.innerHTML = `<span class="md-spinner" style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block"></span> ${progress}%`;
      });

      // 成功
      if (window._currentUser) {
        window._currentUser.avatar_url = result.avatar_url;
      }
      showToast('头像更新成功');

      // 关闭裁剪界面
      closeCropper(overlay, cropper, objectURL);

      // 更新页面上的头像
      updateProfileAvatarDisplay(result.avatar_url);
    } catch (err) {
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      saveBtn.textContent = '保存';
      showToast(err.message || '上传失败，请检查网络后重试');
    }
  });

  // 取消按钮
  overlay.querySelector('#cropper-cancel').addEventListener('click', () => {
    closeCropper(overlay, cropper, objectURL);
  });

  // Escape 关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeCropper(overlay, cropper, objectURL);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // 旋转按钮
  overlay.querySelector('#cropper-rotate').addEventListener('click', () => {
    cropper.rotate(90);
  });
}

function closeCropper(overlay, cropper, objectURL) {
  if (cropper) cropper.destroy();
  if (objectURL) URL.revokeObjectURL(objectURL);
  if (overlay) overlay.remove();
}

/**
 * 上传裁剪后的头像（第二级标准化 + 第三级降级 + XHR 进度）
 * @param {HTMLCanvasElement} canvas
 * @param {Function} onProgress — (percent: number) => void
 */
async function uploadCroppedAvatar(canvas, onProgress) {
  return new Promise((resolve, reject) => {
    // 第二级：标准化输出 384×384 JPEG q=0.92
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('图片处理失败'));
        return;
      }

      // 第三级：自动质量降级，确保 ≤ 2MB
      let finalBlob = blob;
      if (blob.size > 2 * 1024 * 1024) {
        finalBlob = await compressToTargetSize(canvas);
      }

      // 极端情况：即使最低质量仍 > 2MB
      if (finalBlob.size > 2 * 1024 * 1024) {
        reject(new Error('图片过大，请选择更小的图片'));
        return;
      }

      const formData = new FormData();
      formData.append('avatar', finalBlob, 'avatar.jpg');

      const token = getToken();
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && !result.error) {
            resolve(result);
          } else {
            reject(new Error(result.error || '上传失败'));
          }
        } catch {
          reject(new Error('上传失败，请检查网络后重试'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('上传失败，请检查网络后重试'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('上传已取消'));
      });

      xhr.open('POST', '/api/auth/avatar');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    }, 'image/jpeg', 0.92);
  });
}

/**
 * 恢复默认头像
 */
async function resetToDefaultAvatar() {
  openModal('恢复默认头像', `
    <p class="text-secondary">确定要恢复为系统默认头像吗？此操作不可撤销。</p>
    <div style="display:flex;gap:var(--space-2);justify-content:flex-end;margin-top:var(--space-4)">
      <button class="btn btn-secondary" id="reset-avatar-cancel-btn">取消</button>
      <button class="btn btn-primary" id="reset-avatar-confirm-btn">确定</button>
    </div>
  `);

  document.getElementById('reset-avatar-cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('reset-avatar-confirm-btn')?.addEventListener('click', async () => {
    closeModal();
    try {
      const token = getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ avatar_url: '' })
      });
      const result = await res.json();

      if (result.error) {
        showToast(result.error);
        return;
      }

      if (window._currentUser) {
        window._currentUser.avatar_url = '';
      }
      showToast('已恢复默认头像');
      updateProfileAvatarDisplay('');
    } catch {
      showToast('操作失败，请重试');
    }
  });
}

/**
 * 局部更新页面上的头像显示（不刷新整页）
 */
function updateProfileAvatarDisplay(avatarUrl) {
  const container = document.querySelector('#profile-avatar-area');
  if (!container) return;

  if (avatarUrl) {
    container.innerHTML = `
      <img class="profile-avatar-img" src="${escHtml(avatarUrl)}" alt="">
      <span class="profile-avatar-overlay"><span class="mi" style="font-size:20px;color:#fff">photo_camera</span></span>
    `;
  } else {
    const user = window._currentUser;
    const initial = (user?.nickname || user?.username || '?')[0];
    container.innerHTML = `
      <span class="profile-avatar-letter">${escHtml(initial)}</span>
      <span class="profile-avatar-overlay"><span class="mi" style="font-size:20px;color:#fff">photo_camera</span></span>
    `;
  }
}

// 绑定头像点击事件需要在页面渲染后执行
function bindAvatarClick() {
  const avatarArea = document.getElementById('profile-avatar-area');
  if (avatarArea && !avatarArea.dataset.bound) {
    avatarArea.dataset.bound = '1';
    avatarArea.addEventListener('click', openAvatarSheet);
  }
}

// 导出供 renderOwnerProfile 调用
function bindProfileEvents(container) {
  bindAvatarClick();
}

// 挂载到 window（旧兼容）
window._handleAvatarUpload = function(event) {
  // 已废弃，保留以兼容旧代码
  const file = event.target.files?.[0];
  if (!file) return;
  const error = validateAvatarFile(file);
  if (error) { showToast(error); return; }
  showAvatarCropper(file);
};

export async function showFeedbackModal() {
  const html = `
    <div class="profile-feedback-form">
      ${createMdSelect({
        id: 'feedback-category',
        label: '反馈类型',
        options: [
          { text: '功能异常', value: 'bug' },
          { text: '体验建议', value: 'suggestion' },
          { text: '其他问题', value: 'other' },
        ],
        selected: 'bug'
      })}
      <div class="md-input-group">
        <textarea class="md-input" id="feedback-content" placeholder=" " rows="5" required style="resize:none"></textarea>
        <label class="md-label">详细描述</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>详细描述</span></legend></fieldset>
      </div>
      ${createMdInput({ id: 'feedback-contact', label: '联系方式（选填）', placeholder: ' ' })}
      <button class="btn btn-primary btn-full" id="feedback-submit-btn">
        <span class="mi">send</span>
        提交反馈
      </button>
    </div>
  `;

  openModal('问题反馈', html);

  document.getElementById('feedback-submit-btn')?.addEventListener('click', async () => {
    const content = document.getElementById('feedback-content')?.value?.trim();
    if (!content) {
      showToast('请填写反馈内容');
      return;
    }

    const category = document.getElementById('feedback-category')?.value || 'bug';
    const contact = document.getElementById('feedback-contact')?.value?.trim() || '';

    const btn = document.getElementById('feedback-submit-btn');
    if (btn) btn.disabled = true;

    const result = await apiPost('/api/user/feedback', { category, content, contact });
    if (result.error) {
      showToast('提交失败：' + result.error);
      if (btn) btn.disabled = false;
      return;
    }

    showToast('反馈已提交，感谢你的反馈！');
    closeModal();
  });
}

/* =============================================
   退出预览模式（全局函数）
   ============================================= */

window._exitProfilePreview = function () {
  previewMode = false;
  navigateTo('profile');
};

/* =============================================
   导出（供 main.js 注册）
   ============================================= */

// 旧版兼容导出
export async function openEditProfileModal() {
  navigateTo('profile-edit');
}

export async function handleEditProfile(e) {
  // 旧版兼容，重定向到新页面
  navigateTo('profile-edit');
}

export async function handlePrivacyChange(field, value) {
  return handlePrivacyToggle(field, value);
}

// 新版导出
export { handleCheckin, handleSaveProfile, handlePrivacyToggle };
