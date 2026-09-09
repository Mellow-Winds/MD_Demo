/**
 * pages/auth.js — 登录/注册 + 个人中心
 * (profile pages are registered via registerProfilePages from profile.js)
 */

import { apiPost, apiGet, saveToken, clearToken, isLoggedIn } from '../core/api.js';
import { navigateTo, animIn, animOut, bindRipples } from '../core/router.js';
import { showToast } from '../components/ui.js';

/* =============================================
   SVG 图标（内嵌，避免 FOUC）
   ============================================= */

const SVG_LOGO = `<svg viewBox="0 0 24 24" width="48" height="48" fill="#4A90D9"><path d="M5 13.18v2.81c0 .73.4 1.41 1.04 1.76l5 2.73c.6.33 1.32.33 1.92 0l5-2.73c.64-.35 1.04-1.03 1.04-1.76v-2.81l-6.04 3.3c-.6.33-1.32.33-1.92 0L5 13.18zm6.04-9.66l-8.43 4.6c-.69.38-.69 1.38 0 1.76l8.43 4.6c.6.33 1.32.33 1.92 0L21 10.09V16c0 .55.45 1 1 1s1-.45 1-1V9.59c0-.37-.2-.7-.52-.88l-9.52-5.19a2.04 2.04 0 0 0-1.92 0z"/></svg>`;

const SVG_EYE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;

const SVG_EYE_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;

/* =============================================
   Auth State
   ============================================= */

let authView = 'login'; // 'login' | 'register' | 'forgot'
let authStudentId = '';
let authPassword = '';
let resendCooldown = 0;
let resendTimer = null;
let turnstileToken = '';

/* =============================================
   登录/注册渲染
   ============================================= */

export function renderAuth(container) {
  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-logo">${SVG_LOGO}</div>
      <h1 class="auth-title">${authView === 'register' ? '注册' : authView === 'forgot' ? '找回密码' : '登录'}</h1>

      <div class="auth-card" id="auth-card">
        ${authView === 'login' ? renderLoginForm() :
          authView === 'forgot' ? renderForgotForm() : renderRegisterForm()}
      </div>
    </div>
  `;

  bindRipples(container);

  // 动效
  const logo = container.querySelector('.auth-logo');
  const title = container.querySelector('.auth-title');
  const card = container.querySelector('.auth-card');
  if (logo) animIn(logo, { y: -10, dur: 300 });
  if (title) animIn(title, { y: 10, delay: 50, dur: 300 });
  if (card) animIn(card, { y: 20, delay: 100, dur: 350 });

  // 绑定密码可见性切换
  bindPasswordToggles();
}

// 登录表单
function renderLoginForm() {
  return `
    <form id="login-form" onsubmit="handleLogin(event)">
      <div class="auth-input-row">
        <div class="md-input-group auth-input-group">
          <input class="md-input auth-student-input" type="text" name="studentId" placeholder=" " required autocomplete="username" maxlength="12">
          <label class="md-label">学号</label>
          <fieldset class="md-border"><legend><span>学号</span></legend></fieldset>
          <span class="auth-email-suffix">@smail.nju.edu.cn</span>
        </div>
      </div>

      <div class="md-input-group">
        <input class="md-input auth-password-input" type="password" name="password" placeholder=" " required autocomplete="current-password" maxlength="30">
        <label class="md-label">密码</label>
        <fieldset class="md-border"><legend><span>密码</span></legend></fieldset>
        <button type="button" class="auth-eye-btn">
          ${SVG_EYE_OFF}
        </button>
      </div>

      <div class="form-error" id="login-error" style="display:none"></div>

      <!-- Turnstile 容器（初始隐藏，点击登录后显示） -->
      <div class="auth-turnstile-wrapper" id="login-turnstile-wrapper" style="display:none">
        <div class="auth-turnstile-container" id="login-turnstile-container"></div>
      </div>

      <div class="auth-buttons">
        <button type="button" class="btn btn-text" onclick="switchAuthView('register')">注册</button>
        <button type="button" class="btn btn-text" onclick="switchAuthView('forgot')">忘记密码</button>
        <button type="submit" class="btn btn-primary auth-next-btn">下一步</button>
      </div>
    </form>
  `;
}

function renderForgotForm() {
  return `
    <form id="forgot-form" onsubmit="handleResetPassword(event)">
      <div class="auth-input-row">
        <div class="md-input-group auth-input-group">
          <input class="md-input auth-student-input" type="text" name="studentId" placeholder=" " required autocomplete="username" maxlength="12">
          <label class="md-label">学号</label>
          <fieldset class="md-border"><legend><span>学号</span></legend></fieldset>
          <span class="auth-email-suffix">@smail.nju.edu.cn</span>
        </div>
      </div>
      <div class="auth-code-row">
        <div class="md-input-group" style="flex:1">
          <input class="md-input auth-code-input" type="text" name="code" placeholder=" " maxlength="6" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]*" id="forgot-code-input">
          <label class="md-label">验证码</label>
          <fieldset class="md-border"><legend><span>验证码</span></legend></fieldset>
        </div>
        <button type="button" class="btn btn-outline auth-send-btn" id="forgot-send-code-btn" onclick="handleForgotSendCode(event)">获取验证码</button>
      </div>

      <!-- Turnstile 容器（初始隐藏，点击获取验证码后显示） -->
      <div class="auth-turnstile-wrapper" id="forgot-turnstile-wrapper" style="display:none">
        <div class="auth-turnstile-container" id="forgot-turnstile-container"></div>
      </div>

      <div class="md-input-group">
        <input class="md-input auth-password-input" type="password" name="password" placeholder=" " required autocomplete="new-password" maxlength="30">
        <label class="md-label">新密码</label>
        <fieldset class="md-border"><legend><span>新密码</span></legend></fieldset>
        <button type="button" class="auth-eye-btn">${SVG_EYE_OFF}</button>
      </div>
      <div class="md-input-group">
        <input class="md-input auth-password-input" type="password" name="confirmPassword" placeholder=" " required autocomplete="new-password" maxlength="30">
        <label class="md-label">确认新密码</label>
        <fieldset class="md-border"><legend><span>确认新密码</span></legend></fieldset>
        <button type="button" class="auth-eye-btn">${SVG_EYE_OFF}</button>
      </div>
      <div class="form-error" id="forgot-error" style="display:none"></div>
      <div class="auth-buttons">
        <button type="button" class="btn btn-text" onclick="switchAuthView('login')">返回登录</button>
        <button type="submit" class="btn btn-primary auth-next-btn">重置密码</button>
      </div>
    </form>
  `;
}

// 注册表单
function renderRegisterForm() {
  return `
    <form id="register-form" onsubmit="handleRegister(event)">
      <div class="auth-input-row">
        <div class="md-input-group auth-input-group">
          <input class="md-input auth-student-input" type="text" name="studentId" placeholder=" " required autocomplete="username" maxlength="12">
          <label class="md-label">学号</label>
          <fieldset class="md-border"><legend><span>学号</span></legend></fieldset>
          <span class="auth-email-suffix">@smail.nju.edu.cn</span>
        </div>
      </div>

      <div class="md-input-group">
        <input class="md-input auth-password-input" type="password" name="password" placeholder=" " required autocomplete="new-password" maxlength="30">
        <label class="md-label">设置密码</label>
        <fieldset class="md-border"><legend><span>设置密码</span></legend></fieldset>
        <button type="button" class="auth-eye-btn">
          ${SVG_EYE_OFF}
        </button>
      </div>

      <div class="md-input-group">
        <input class="md-input auth-password-input" type="password" name="confirmPassword" placeholder=" " required autocomplete="new-password" maxlength="30">
        <label class="md-label">确认密码</label>
        <fieldset class="md-border"><legend><span>确认密码</span></legend></fieldset>
        <button type="button" class="auth-eye-btn">
          ${SVG_EYE_OFF}
        </button>
      </div>

      <div class="auth-code-row">
        <div class="md-input-group" style="flex:1">
          <input class="md-input auth-code-input" type="text" name="code" placeholder=" " maxlength="6" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]*" id="register-code-input">
          <label class="md-label">验证码</label>
          <fieldset class="md-border"><legend><span>验证码</span></legend></fieldset>
        </div>
        <button type="button" class="btn btn-outline auth-send-btn" id="send-code-btn" onclick="handleSendCode()">
          获取验证码
        </button>
      </div>

      <!-- Turnstile 容器（初始隐藏，点击获取验证码后显示） -->
      <div class="auth-turnstile-wrapper" id="turnstile-wrapper" style="display:none">
        <div class="auth-turnstile-container" id="turnstile-container"></div>
      </div>

      <!-- 蜜罐隐藏输入框（机器人会自动填写） -->
      <div style="position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden" aria-hidden="true">
        <input type="text" name="honeypot" tabindex="-1" autocomplete="off">
      </div>

      <div class="form-error" id="register-error" style="display:none"></div>

      <div class="auth-buttons">
        <button type="button" class="btn btn-text" onclick="switchAuthView('login')">返回登录</button>
        <button type="submit" class="btn btn-primary auth-next-btn" id="register-btn">注册</button>
      </div>

      <p class="auth-privacy-text">
        继续操作即表示您同意 <a href="#" onclick="showPrivacyModal(event, 'terms')">《用户协议》</a> 并确认已阅读 <a href="#" onclick="showPrivacyModal(event, 'privacy')">《隐私政策》</a>
      </p>
    </form>
  `;
}


/* =============================================
   Tab 切换
   ============================================= */

export function switchAuthView(view) {
  authView = view;
  const container = document.getElementById('main-content');

  const card = document.getElementById('auth-card');
  const title = container.querySelector('.auth-title');

  if (title) {
    title.textContent = view === 'register' ? '注册' : view === 'forgot' ? '找回密码' : '登录';
  }

  if (card) {
    animOut(card, { dur: 150 }).onfinish = () => {
      card.innerHTML = view === 'login' ? renderLoginForm() :
                       view === 'forgot' ? renderForgotForm() : renderRegisterForm();
      animIn(card, { y: 12, dur: 250 });
      bindPasswordToggles();
    };
  }
}

/* =============================================
   密码可见性切换
   ============================================= */

function bindPasswordToggles() {
  document.querySelectorAll('.auth-eye-btn').forEach(btn => {
    btn.onclick = null;
  });
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.auth-eye-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  togglePasswordVisibility(btn);
}, true);

window.togglePasswordVisibility = function(btn) {
  const group = btn.closest('.md-input-group');
  const input = group?.querySelector('input[type="password"], input[type="text"].auth-password-input');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = SVG_EYE;
  } else {
    input.type = 'password';
    btn.innerHTML = SVG_EYE_OFF;
  }
};

/* =============================================
   Turnstile 集成
   ============================================= */

// Turnstile Site Key — 从 /env.js 注入，详见 .env 配置
const TURNSTILE_SITE_KEY = window.ENV?.TURNSTILE_SITE_KEY || '';

// 跟踪当前活跃的 Turnstile widget ID，用于清理幽灵实例
let _activeTurnstileId = null;

function loadTurnstile() {
  // 如果 Turnstile 脚本未加载，动态加载
  if (!window.turnstile) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => renderTurnstile();
    script.onerror = () => {
      showToast('系统出现未知错误，请在看到此消息后及时反馈');
    };
    document.head.appendChild(script);
  } else {
    renderTurnstile();
  }
}

function renderTurnstile() {
  const container = document.getElementById('turnstile-container');
  if (!container || !window.turnstile) return;

  // 检查 Site Key 是否为占位符（测试 Key 1x00000000000000000000AA 是有效的）
  if (!TURNSTILE_SITE_KEY) {
    console.error('[Turnstile] Site Key 未配置');
    showToast('系统出现未知错误，请在看到此消息后及时反馈');
    return;
  }

  // 清理旧 widget，防止 SPA 路由切换时幽灵实例冲突
  if (_activeTurnstileId) {
    try { window.turnstile.remove(_activeTurnstileId); } catch (e) {}
    _activeTurnstileId = null;
  }
  container.innerHTML = '';

  try {
    const widgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => {
        turnstileToken = token;
        // Turnstile 验证成功，调用发送验证码回调
        onTurnstileSuccess(token);
      },
      'error-callback': () => {
        turnstileToken = '';
        showToast('系统出现未知错误，请在看到此消息后及时反馈');
      },
      'expired-callback': () => {
        turnstileToken = '';
      },
      'timeout-callback': () => {
        turnstileToken = '';
        showToast('系统出现未知错误，请在看到此消息后及时反馈');
      },
    });
    _activeTurnstileId = widgetId;
  } catch (e) {
    console.error('[Turnstile] 渲染失败:', e);
    showToast('系统出现未知错误，请在看到此消息后及时反馈');
  }
}

/* =============================================
   处理函数
   ============================================= */

// 登录表单凭据暂存（Turnstile 通过后使用）
let _loginStudentId = '';
let _loginPassword = '';

// 登录
export async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const studentId = form.studentId.value.trim();
  const password = form.password.value;

  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  // 前端校验
  if (!validateStudentId(studentId)) {
    errEl.textContent = '学号格式不正确';
    errEl.style.display = 'block';
    return;
  }

  if (!validatePassword(password)) {
    errEl.textContent = '密码格式不正确';
    errEl.style.display = 'block';
    return;
  }

  // 暂存凭据，等 Turnstile 通过后使用
  _loginStudentId = studentId;
  _loginPassword = password;

  // 显示 Turnstile 人机验证
  document.getElementById('login-turnstile-wrapper').style.display = 'block';
  loadLoginTurnstile();
}

// 加载 Turnstile（登录专用）
function loadLoginTurnstile() {
  if (!window.turnstile) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => renderLoginTurnstile();
    script.onerror = () => {
      showToast('系统出现未知错误，请在看到此消息后及时反馈');
    };
    document.head.appendChild(script);
  } else {
    renderLoginTurnstile();
  }
}

// 渲染 Turnstile 验证框（登录专用）
function renderLoginTurnstile() {
  const container = document.getElementById('login-turnstile-container');
  if (!container || !window.turnstile) return;

  if (!TURNSTILE_SITE_KEY) {
    console.error('[Turnstile] Site Key 未配置');
    showToast('系统出现未知错误，请在看到此消息后及时反馈');
    return;
  }

  // 清理旧 widget，防止 SPA 路由切换时幽灵实例冲突
  if (_activeTurnstileId) {
    try { window.turnstile.remove(_activeTurnstileId); } catch (e) {}
    _activeTurnstileId = null;
  }
  container.innerHTML = '';

  try {
    const widgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => {
        // Turnstile 验证成功，发送登录请求
        onLoginTurnstileSuccess(token);
      },
      'error-callback': () => {
        showToast('系统出现未知错误，请在看到此消息后及时反馈');
        resetLoginBtn();
      },
      'expired-callback': () => {
        resetLoginBtn();
      },
      'timeout-callback': () => {
        showToast('系统出现未知错误，请在看到此消息后及时反馈');
        resetLoginBtn();
      },
    });
    _activeTurnstileId = widgetId;
  } catch (e) {
    console.error('[Turnstile] 渲染失败:', e);
    showToast('系统出现未知错误，请在看到此消息后及时反馈');
    resetLoginBtn();
  }
}

// Turnstile 验证成功后的回调（登录专用）
async function onLoginTurnstileSuccess(token) {
  const form = document.getElementById('login-form');
  const btn = form ? form.querySelector('button[type="submit"]') : null;
  const errEl = document.getElementById('login-error');

  if (btn) {
    btn.disabled = true;
    btn.textContent = '登录中...';
  }

  try {
    const result = await apiPost('/api/auth/login', {
      studentId: _loginStudentId,
      password: _loginPassword,
      turnstileToken: token,
    });

    if (result.error) {
      if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
      resetLoginBtn();
      return;
    }

    saveToken(result.token);
    window._currentUser = result.user;
    showToast('登录成功');

    // 隐藏 Turnstile
    const turnstileWrapper = document.getElementById('login-turnstile-wrapper');
    if (turnstileWrapper) turnstileWrapper.style.display = 'none';

    navigateTo('mycourse');
    refreshNotifBadge();
    if (!window._notifInterval) window._notifInterval = setInterval(refreshNotifBadge, 30000);
  } catch (e) {
    console.error('[Login] API调用失败:', e);
    if (errEl) {
      errEl.textContent = '系统出现未知错误，请在看到此消息后及时反馈';
      errEl.style.display = 'block';
    }
    resetLoginBtn();
  }
}

function resetLoginBtn() {
  const form = document.getElementById('login-form');
  const btn = form ? form.querySelector('button[type="submit"]') : null;
  if (btn) {
    btn.disabled = false;
    btn.textContent = '下一步';
  }
  // 隐藏 Turnstile
  const turnstileWrapper = document.getElementById('login-turnstile-wrapper');
  if (turnstileWrapper) turnstileWrapper.style.display = 'none';
}

export async function handleForgotSendCode(e) {
  const form = e.target.closest('form');
  const studentId = form?.studentId?.value?.trim() || '';
  const errEl = document.getElementById('forgot-error');
  if (errEl) errEl.style.display = 'none';

  if (!validateStudentId(studentId)) {
    if (errEl) {
      errEl.textContent = '学号格式不正确';
      errEl.style.display = 'block';
    }
    return;
  }

  // 保存学号到状态
  authStudentId = studentId;

  // 显示 Turnstile 人机验证
  document.getElementById('forgot-turnstile-wrapper').style.display = 'block';
  loadForgotTurnstile();
  return;
}

// 加载 Turnstile（忘记密码专用）
function loadForgotTurnstile() {
  if (!window.turnstile) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => renderForgotTurnstile();
    script.onerror = () => {
      showToast('系统出现未知错误，请在看到此消息后及时反馈');
    };
    document.head.appendChild(script);
  } else {
    renderForgotTurnstile();
  }
}

function renderForgotTurnstile() {
  const container = document.getElementById('forgot-turnstile-container');
  if (!container || !window.turnstile) return;

  if (!TURNSTILE_SITE_KEY) {
    console.error('[Turnstile] Site Key 未配置');
    showToast('系统出现未知错误，请在看到此消息后及时反馈');
    return;
  }

  // 清理旧 widget，防止 SPA 路由切换时幽灵实例冲突
  if (_activeTurnstileId) {
    try { window.turnstile.remove(_activeTurnstileId); } catch (e) {}
    _activeTurnstileId = null;
  }
  container.innerHTML = '';

  try {
    const widgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => {
        onForgotTurnstileSuccess(token);
      },
      'error-callback': () => {
        showToast('系统出现未知错误，请在看到此消息后及时反馈');
      },
      'expired-callback': () => {},
      'timeout-callback': () => {
        showToast('系统出现未知错误，请在看到此消息后及时反馈');
      },
    });
    _activeTurnstileId = widgetId;
  } catch (e) {
    console.error('[Turnstile] 渲染失败:', e);
    showToast('系统出现未知错误，请在看到此消息后及时反馈');
  }
}

// Turnstile 验证成功后的回调（忘记密码）
async function onForgotTurnstileSuccess(token) {
  const btn = document.getElementById('forgot-send-code-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '发送中...';
  }

  try {
    const result = await apiPost('/api/auth/forgot-password', {
      studentId: authStudentId,
      turnstileToken: token,
    });

    if (result.error) {
      const errEl = document.getElementById('forgot-error');
      if (errEl) {
        errEl.textContent = result.error;
        errEl.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = '获取验证码';
      }
      return;
    }

    showToast(result.message || '验证码已发送');
    if (btn) btn.textContent = '已发送';

    // 隐藏 Turnstile 验证框
    const turnstileWrapper = document.getElementById('forgot-turnstile-wrapper');
    if (turnstileWrapper) {
      turnstileWrapper.style.display = 'none';
    }

    // 聚焦验证码输入框
    const codeInput = document.getElementById('forgot-code-input');
    if (codeInput) codeInput.focus();
  } catch (e) {
    const errEl = document.getElementById('forgot-error');
    if (errEl) {
      errEl.textContent = '系统出现未知错误，请在看到此消息后及时反馈';
      errEl.style.display = 'block';
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = '获取验证码';
    }
  }
}

export async function handleResetPassword(e) {
  e.preventDefault();
  const form = e.target;
  const studentId = form.studentId.value.trim();
  const code = form.code.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const errEl = document.getElementById('forgot-error');
  if (errEl) errEl.style.display = 'none';

  if (!validateStudentId(studentId)) {
    if (errEl) { errEl.textContent = '学号格式不正确'; errEl.style.display = 'block'; }
    return;
  }
  if (!code || code.length !== 6) {
    if (errEl) { errEl.textContent = '请输入6位验证码'; errEl.style.display = 'block'; }
    return;
  }
  if (!validatePassword(password)) {
    if (errEl) { errEl.textContent = '密码须为8-30位，且包含大小写字母和数字'; errEl.style.display = 'block'; }
    return;
  }
  if (password !== confirmPassword) {
    if (errEl) { errEl.textContent = '两次输入的密码不一致'; errEl.style.display = 'block'; }
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '重置中...';
  const result = await apiPost('/api/auth/reset-password', { studentId, code, password, confirmPassword });
  if (result.error) {
    if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '重置密码';
    return;
  }
  showToast(result.message || '密码已重置');
  switchAuthView('login');
}

// 注册（验证验证码并完成注册）
export async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const code = form.code?.value?.trim();

  const errEl = document.getElementById('register-error');
  errEl.style.display = 'none';

  // 前端校验
  if (!authStudentId || !authPassword) {
    errEl.textContent = '请先获取验证码';
    errEl.style.display = 'block';
    return;
  }

  if (!code || code.length !== 6) {
    errEl.textContent = '请输入6位验证码';
    errEl.style.display = 'block';
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '注册中...';

  try {
    const result = await apiPost('/api/auth/verify-email', {
      studentId: authStudentId,
      code,
      password: authPassword,
    });

    if (result.error) {
      errEl.textContent = result.error;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '注册';
      return;
    }

    // 注册成功
    saveToken(result.token);
    window._currentUser = result.user;
    showToast('注册成功！');
    navigateTo('mycourse');
    refreshNotifBadge();
    if (!window._notifInterval) window._notifInterval = setInterval(refreshNotifBadge, 30000);
  } catch (e) {
    errEl.textContent = '系统出现未知错误，请在看到此消息后及时反馈';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '注册';
  }
}

// 发送验证码（注册页面）
export async function handleSendCode() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const studentId = form.studentId.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  const errEl = document.getElementById('register-error');
  errEl.style.display = 'none';

  // 前端校验
  if (!validateStudentId(studentId)) {
    errEl.textContent = '学号格式不正确';
    errEl.style.display = 'block';
    return;
  }

  if (!validatePassword(password)) {
    errEl.textContent = '密码须为8-30位，且包含大小写字母和数字';
    errEl.style.display = 'block';
    return;
  }

  if (password !== confirmPassword) {
    errEl.textContent = '两次输入的密码不一致';
    errEl.style.display = 'block';
    return;
  }

  // 保存密码到状态
  authStudentId = studentId;
  authPassword = password;

  // 显示 Turnstile 人机验证
  document.getElementById('turnstile-wrapper').style.display = 'block';
  loadTurnstile();
}

// Turnstile 验证成功后的回调
async function onTurnstileSuccess(token) {
  turnstileToken = token;

  const btn = document.getElementById('send-code-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '发送中...';
  }

  try {
    const result = await apiPost('/api/auth/register', {
      studentId: authStudentId,
      password: authPassword,
      confirmPassword: authPassword,
      turnstileToken: token,
      honeypot: '',
    });

    if (result.error) {
      const errEl = document.getElementById('register-error');
      errEl.textContent = result.error;
      errEl.style.display = 'block';
      if (btn) {
        btn.disabled = false;
        btn.textContent = '获取验证码';
      }
      return;
    }

    // 发送成功，开始倒计时
    showToast('验证码已发送至你的学号邮箱');
    startResendCooldown();

    // 隐藏 Turnstile 验证框
    const turnstileWrapper = document.getElementById('turnstile-wrapper');
    if (turnstileWrapper) {
      turnstileWrapper.style.display = 'none';
    }

    // 聚焦验证码输入框
    const codeInput = document.getElementById('register-code-input');
    if (codeInput) codeInput.focus();
  } catch (e) {
    const errEl = document.getElementById('register-error');
    errEl.textContent = '系统出现未知错误，请在看到此消息后及时反馈';
    errEl.style.display = 'block';
    if (btn) {
      btn.disabled = false;
      btn.textContent = '获取验证码';
    }
  }
}

// 重新发送验证码（已登录后重新发送）
export async function handleResendCode() {
  if (resendCooldown > 0) return;

  const btn = document.getElementById('send-code-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '发送中...';
  }

  try {
    const result = await apiPost('/api/auth/resend-code', { studentId: authStudentId });

    if (result.error) {
      showToast(result.error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '获取验证码';
      }
      return;
    }

    showToast('验证码已重新发送');
    startResendCooldown();
  } catch (e) {
    showToast('系统出现未知错误，请在看到此消息后及时反馈');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '获取验证码';
    }
  }
}

// 验证码倒计时
function startResendCooldown() {
  resendCooldown = 60;
  clearInterval(resendTimer);

  const btn = document.getElementById('send-code-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = `重新发送(${resendCooldown}s)`;
  }

  resendTimer = setInterval(() => {
    resendCooldown--;
    if (btn) {
      btn.textContent = resendCooldown > 0 ? `重新发送(${resendCooldown}s)` : '获取验证码';
      if (resendCooldown <= 0) {
        btn.disabled = false;
        clearInterval(resendTimer);
      }
    }
  }, 1000);
}

/* =============================================
   工具函数
   ============================================= */

function validateStudentId(studentId) {
  if (!studentId) return false;
  // 本科：9位纯数字
  if (/^\d{9}$/.test(studentId)) return true;
  // 研究生（2022+）：12位纯数字
  if (/^\d{12}$/.test(studentId)) return true;
  // 研究生（2021-）：MG/MF/BH开头 + 8位数字
  if (/^(MG|MF|BH)\d{8}$/.test(studentId)) return true;
  return false;
}

function validatePassword(password) {
  if (!password || password.length < 8 || password.length > 30) return false;
  if (!/^[a-zA-Z0-9]+$/.test(password)) return false;
  // 必须包含大小写字母和数字
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

/* =============================================
   隐私协议弹窗
   ============================================= */

window.showPrivacyModal = async function(e, type) {
  e.preventDefault();

  const title = type === 'terms' ? '用户协议' : '隐私政策';
  const filePath = type === 'terms' ? '/data/用户协议.md' : '/data/隐私政策.md';

  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error('加载失败');
    const markdown = await response.text();

    // 使用 markdown-it 渲染
    const html = window.markdownit ? window.markdownit({ html: false }).render(markdown) : markdown;

    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content auth-privacy-modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body markdown-body">
          ${html}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 激活弹窗（添加 active 类启用 pointer-events）
    requestAnimationFrame(() => modal.classList.add('active'));

    // 点击遮罩关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  } catch (e) {
    showToast('加载失败，请稍后重试');
  }
};

/* =============================================
   通知 Badge
   ============================================= */

export async function refreshNotifBadge() {
  if (!window._currentUser) return;
  try {
    const data = await apiGet('/api/notifications/unread-count');
    const count = data?.count || 0;
    const display = count > 0 ? 'flex' : 'none';
    const text = count > 99 ? '99+' : String(count);
    ['notif-badge', 'bottom-notif-badge'].forEach(id => {
      const badge = document.getElementById(id);
      if (badge) {
        badge.textContent = text;
        badge.style.display = display;
      }
    });
  } catch { /* ignore */ }
}

// 导出函数供 HTML onclick 使用
window.switchAuthView = switchAuthView;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleSendCode = handleSendCode;
window.handleResendCode = handleResendCode;
window.handleForgotSendCode = handleForgotSendCode;
window.handleResetPassword = handleResetPassword;
