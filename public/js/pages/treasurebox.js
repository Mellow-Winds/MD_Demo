/**
 * pages/treasurebox.js — 百宝箱：番茄时钟 / 运气值 / 替我抉择 / 薛定谔的待办 / 答案之书 / 祈福木鱼 / 今日摸鱼指南 / 吃了么
 * 纯前端工具，不使用后端 API
 */

import { registerPage } from '../core/router.js';
import { showToast } from '../components/ui.js';

/* ============================================
   工具函数
   ============================================ */

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pad(n) { return String(n).padStart(2, '0'); }

function getToday() { return new Date().toISOString().slice(0, 10); }

/* ============================================
   番茄时钟
   ============================================ */

const POMODORO_TOTAL = 25 * 60; // 1500 秒
let _pomodoroTimer = null;

function loadPomodoroState() {
  try {
    return JSON.parse(localStorage.getItem('tb_pomodoro')) || { endAt: null, running: false };
  } catch { return { endAt: null, running: false }; }
}

function savePomodoroState(state) {
  localStorage.setItem('tb_pomodoro', JSON.stringify(state));
}

function renderPomodoro() {
  const state = loadPomodoroState();
  let remaining = POMODORO_TOTAL;
  if (state.running && state.endAt) {
    remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
  }
  const progress = remaining / POMODORO_TOTAL;
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;

  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8zm.5-13H11v6l5.2 3.2l.8-1.3l-4.5-2.7V7z"/></svg>
        <span>番茄时钟</span>
      </div>
      <div class="pomodoro-ring">
        <svg viewBox="0 0 120 120" width="200" height="200">
          <circle class="pomodoro-ring-circle-bg" cx="60" cy="60" r="54" fill="none" stroke-width="8"/>
          <circle class="pomodoro-ring-circle-fg" id="pomodoro-fg" cx="60" cy="60" r="54" fill="none" stroke-width="8"
            stroke-dasharray="${(2 * Math.PI * 54).toFixed(2)}"
            stroke-dashoffset="${((1 - progress) * 2 * Math.PI * 54).toFixed(2)}"/>
        </svg>
        <div class="pomodoro-time" id="pomodoro-time">${pad(min)}:${pad(sec)}</div>
      </div>
      <div class="pomodoro-controls">
        <button class="btn btn-primary" id="pomodoro-start">开始</button>
        <button class="btn btn-secondary" id="pomodoro-pause">暂停</button>
        <button class="btn btn-secondary" id="pomodoro-reset">重置</button>
      </div>
    </div>
  `;
}

function renderPomodoroCompact() {
  const state = loadPomodoroState();
  let preview = '25 分钟专注计时';
  if (state.running && state.endAt) {
    const remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    preview = `剩余 ${pad(min)}:${pad(sec)}`;
  }
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="pomodoro">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8zm.5-13H11v6l5.2 3.2l.8-1.3l-4.5-2.7V7z"/></svg>
      </div>
      <div class="tb-card-label">番茄时钟</div>
      <div class="tb-card-preview">${preview}</div>
    </div>
  `;
}

function startPomodoroTick() {
  if (_pomodoroTimer) clearInterval(_pomodoroTimer);
  _pomodoroTimer = setInterval(() => {
    const state = loadPomodoroState();
    if (!state.running || !state.endAt) {
      clearInterval(_pomodoroTimer);
      _pomodoroTimer = null;
      return;
    }
    const remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    const timeEl = document.getElementById('pomodoro-time');
    if (timeEl) timeEl.textContent = pad(min) + ':' + pad(sec);
    const progress = remaining / POMODORO_TOTAL;
    const fg = document.getElementById('pomodoro-fg');
    if (fg) fg.setAttribute('stroke-dashoffset', ((1 - progress) * 2 * Math.PI * 54).toFixed(2));
    document.title = `${pad(min)}:${pad(sec)} - 课搭子`;

    if (remaining <= 0) {
      clearInterval(_pomodoroTimer);
      _pomodoroTimer = null;
      document.title = '课搭子';
      savePomodoroState({ endAt: null, running: false });
      if (Notification.permission === 'granted') {
        new Notification('番茄时钟', { body: '25 分钟到！休息一下吧' });
      }
      showToast('番茄时钟结束！休息一下吧');
      // 直接更新 DOM，不替换 outerHTML 避免闪变
      const timeEl = document.getElementById('pomodoro-time');
      const fg = document.getElementById('pomodoro-fg');
      if (timeEl) timeEl.textContent = '25:00';
      if (fg) fg.setAttribute('stroke-dashoffset', '0');
    }
  }, 1000);
}

function bindPomodoro() {
  document.getElementById('pomodoro-start')?.addEventListener('click', () => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const endAt = Date.now() + POMODORO_TOTAL * 1000;
    savePomodoroState({ endAt, running: true });
    startPomodoroTick();
  });
  document.getElementById('pomodoro-pause')?.addEventListener('click', () => {
    const state = loadPomodoroState();
    if (!state.running) return;
    const remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    savePomodoroState({ endAt: Date.now() + remaining * 1000, running: false });
    if (_pomodoroTimer) { clearInterval(_pomodoroTimer); _pomodoroTimer = null; }
    document.title = '课搭子';
  });
  document.getElementById('pomodoro-reset')?.addEventListener('click', () => {
    if (_pomodoroTimer) { clearInterval(_pomodoroTimer); _pomodoroTimer = null; }
    savePomodoroState({ endAt: null, running: false });
    document.title = '课搭子';
    // 直接更新 DOM，不替换 outerHTML 避免闪变
    const timeEl = document.getElementById('pomodoro-time');
    const fg = document.getElementById('pomodoro-fg');
    if (timeEl) timeEl.textContent = '25:00';
    if (fg) fg.setAttribute('stroke-dashoffset', '0');
  });
}

/* ============================================
   今日运气值
   ============================================ */

function getLuckValue() {
  const userId = window._currentUser?.id || 'anonymous';
  const date = getToday();
  try {
    const cached = JSON.parse(localStorage.getItem('tb_luck'));
    if (cached && cached.date === date) return cached.value;
  } catch { /* ignore */ }
  const val = hashCode(userId + '_luck_' + date) % 61 + 40;
  localStorage.setItem('tb_luck', JSON.stringify({ value: val, date }));
  return val;
}

function getLuckLabel(val) {
  if (val >= 86) return '好运爆棚';
  if (val >= 71) return '运气不错';
  if (val >= 56) return '好运正在赶来';
  return '运气就在转角';
}

function renderLuck() {
  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01L12 2z"/></svg>
        <span>今日运气值</span>
      </div>
      <div class="luck-display" id="luck-display">
        <div class="luck-number" id="luck-number">?</div>
        <button class="btn btn-outline btn-sm" id="luck-reveal-btn">
          <svg class="mi-svg" viewBox="0 0 24 24" width="16" height="16" style="margin-right:4px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          点击查看
        </button>
        <div class="luck-label" id="luck-label"></div>
      </div>
    </div>
  `;
}

function renderLuckCompact() {
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="luck">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
      <div class="tb-card-label">今日运气值</div>
      <div class="tb-card-preview">点击查看今日运气</div>
    </div>
  `;
}

function animateLuck(val) {
  const el = document.getElementById('luck-number');
  const labelEl = document.getElementById('luck-label');
  const btn = document.getElementById('luck-reveal-btn');
  if (!el) return;
  if (btn) btn.style.display = 'none';
  const duration = 1500;
  const start = performance.now();
  const label = getLuckLabel(val);

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * val);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = val;
      if (labelEl) labelEl.textContent = label;
    }
  }
  requestAnimationFrame(tick);
}

function bindLuck() {
  document.getElementById('luck-reveal-btn')?.addEventListener('click', () => {
    const val = getLuckValue();
    animateLuck(val);
  }, { once: true });
}

/* ============================================
   替我抉择
   ============================================ */

function renderDecide(activeTab = 'coin') {
  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
        <span>替我抉择</span>
      </div>
      <div class="decision-tabs md-pills">
        <button class="md-pill-btn ${activeTab === 'coin' ? 'active' : ''}" data-decide="coin">抛硬币</button>
        <button class="md-pill-btn ${activeTab === 'dice' ? 'active' : ''}" data-decide="dice">掷骰子</button>
        <button class="md-pill-btn ${activeTab === 'rand' ? 'active' : ''}" data-decide="rand">随机数</button>
      </div>
      <div class="decision-content" id="decide-content">
        ${activeTab === 'coin' ? renderCoin() : activeTab === 'dice' ? renderDice() : renderRand()}
      </div>
    </div>
  `;
}

/* --- 抛硬币 --- */

function renderDecideCompact() {
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="decide">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
      </div>
      <div class="tb-card-label">替我抉择</div>
      <div class="tb-card-preview">抛硬币 / 掷骰子 / 随机数</div>
    </div>
  `;
}

/* --- 抛硬币 --- */

function renderCoin(result = null) {
  const showResult = result !== null;
  const faces = { 0: ['正面', '🪙'], 1: ['反面', '🪙'], 2: ['立起来了！', '🎉'] };
  const [text, icon] = result !== null ? faces[result] : ['点击硬币抛一次', '🪙'];
  return `
    <div class="coin-area" id="coin-area">
      <div class="coin-visual ${showResult ? '' : 'coin-idle'}" id="coin-visual">
        <div class="coin-inner">${icon}</div>
      </div>
      <div class="coin-result" id="coin-result">${text}</div>
      <button class="btn btn-primary btn-sm" id="coin-flip-btn">抛一次</button>
    </div>
  `;
}

function flipCoin() {
  const area = document.getElementById('coin-area');
  if (!area || area.querySelector('.coin-flipping')) return;

  const visual = document.getElementById('coin-visual');
  const resultEl = document.getElementById('coin-result');
  const btn = document.getElementById('coin-flip-btn');
  if (btn) btn.disabled = true;

  visual.classList.add('coin-flipping');
  resultEl.textContent = '...';

  setTimeout(() => {
    const rand = Math.random();
    let result;
    if (rand < 0.49) result = 0;
    else if (rand < 0.98) result = 1;
    else result = 2;

    visual.classList.remove('coin-flipping');
    const faces = { 0: ['正面', '🪙'], 1: ['反面', '🪙'], 2: ['立起来了！', '🎉'] };
    resultEl.textContent = faces[result][0];
    visual.querySelector('.coin-inner').textContent = faces[result][1];
    if (btn) btn.disabled = false;
  }, 800);
}

/* --- 掷骰子 --- */

function renderDice(value = null) {
  const display = value !== null ? value : '?';
  return `
    <div class="dice-area" id="dice-area">
      <div class="dice-visual" id="dice-visual">
        <div class="dice-face" id="dice-face">${display}</div>
      </div>
      <button class="btn btn-primary btn-sm" id="dice-roll-btn">掷一次</button>
    </div>
  `;
}

function rollDice() {
  const visual = document.getElementById('dice-visual');
  const faceEl = document.getElementById('dice-face');
  const btn = document.getElementById('dice-roll-btn');
  if (!visual || visual.classList.contains('dice-rolling')) return;
  if (btn) btn.disabled = true;

  visual.classList.add('dice-rolling');
  const finalVal = Math.floor(Math.random() * 6) + 1;

  let count = 0;
  const rapidChange = setInterval(() => {
    faceEl.textContent = Math.floor(Math.random() * 6) + 1;
    count++;
    if (count >= 12) {
      clearInterval(rapidChange);
      faceEl.textContent = finalVal;
      visual.classList.remove('dice-rolling');
      if (btn) btn.disabled = false;
    }
  }, 80);
}

/* --- 随机数 --- */

function renderRand(result = null) {
  return `
    <div class="rand-area">
      <div class="md-input-group" style="margin-bottom:12px">
        <input class="md-input" id="rand-min" type="number" value="1" placeholder=" ">
        <label class="md-label">最小值</label>
        <fieldset class="md-border"><legend><span>最小值</span></legend></fieldset>
      </div>
      <div class="md-input-group" style="margin-bottom:12px">
        <input class="md-input" id="rand-max" type="number" value="100" placeholder=" ">
        <label class="md-label">最大值</label>
        <fieldset class="md-border"><legend><span>最大值</span></legend></fieldset>
      </div>
      <button class="btn btn-primary btn-sm" id="rand-btn" style="width:100%">生成随机数</button>
      <div class="rand-result" id="rand-result">${result !== null ? result : ''}</div>
    </div>
  `;
}

function generateRand() {
  const minEl = document.getElementById('rand-min');
  const maxEl = document.getElementById('rand-max');
  const resultEl = document.getElementById('rand-result');
  if (!minEl || !maxEl || !resultEl) return;
  const min = parseInt(minEl.value) || 1;
  const max = parseInt(maxEl.value) || 100;
  if (min > max) {
    showToast('最小值不能大于最大值');
    return;
  }
  const val = Math.floor(Math.random() * (max - min + 1)) + min;

  let count = 0;
  const scrollAnim = setInterval(() => {
    resultEl.textContent = Math.floor(Math.random() * (max - min + 1)) + min;
    count++;
    if (count >= 10) {
      clearInterval(scrollAnim);
      resultEl.textContent = val;
    }
  }, 60);
}

/* ============================================
   答案之书 — 1000 个答案（每个 ≤10 字）
   ============================================ */

const ANSWER_BOOK_ANSWERS = [
  '放手去做吧','当然可以','没错就是它','勇敢去试试','就是现在','值得一试','尽管去吧','你一定行','毫无疑问','大胆前行',
  '时机正好','就是它了','现在就去','毫无疑问是','这是对的','去实现它','别犹豫了','你可以的','这是正解','天赐良机',
  '现在行动','全力以赴','坚信不疑','不必顾虑','顺势而为','去追逐吧','放手一搏','乘风破浪','去看远方','去发光吧',
  '事在人为','未来可期','势不可挡','一鼓作气','正当其时','志在必得','所向披靡','无往不利','披荆斩棘','破浪前行',
  '向阳而生','追光而去','即刻出发','心之所向','行则将至','做就对了','莫问前程','但行好事','即刻启程','踏上征途',
  '出发吧','说做就做','往前冲','迈出那一步','就是干','拼一把','冲就完了','干就完了','上吧','飞吧',
  '愿你所愿','终将实现','必定如愿','花开有时','静待佳音','好事将近','天随人愿','吉星高照','紫气东来','祥云瑞气',
  '福至心灵','好运连连','喜从天降','万事胜意','得偿所愿','马到成功','旗开得胜','水到渠成','心想事成','万事俱备',
  '只欠东风','风正好','帆已满','天时地利','天地人和','时来运转','转机在即','黎明将至','曙光在前',
  '星辰大海','辽阔天地','前路光明','坦途在前','一片坦途','畅通无阻','大有可为','前程似锦','鹏程万里','扶摇直上',
  '大展宏图','展翅高飞','海阔天空','未来在你手中','乾坤未定','一切皆有可能','大有希望','光芒万丈','熠熠生辉',
  '闪闪发光','你就是答案','答案在手中','自有答案','心知肚明','你早已知晓','听从直觉','第一感觉最准','心里有数','问心无愧',
  '三思而后行','再等等看','现在不是时候','换个方向吧','暂且放下','不必强求','时机未到','别急着决定',
  '先放一放','缓一缓再说','不要冲动','冷静一下','暂缓为妙','且慢','不如搁置','从长计议',
  '不是这条路','此路不通','回头是岸','换条路走','别钻牛角尖','退一步看','绕道而行','另辟蹊径',
  '放弃也是智慧','及时止损','当断则断','不必纠缠','放下吧','算了吧','由它去吧','翻篇了',
  '不太可能','希望渺茫','风险太大','慎重考虑','不太妙','悬而未决','凶多吉少','此非良机',
  '不是最佳选择','有待斟酌','尚需时日','言之过早','为时尚早','还需等待','时候未到','静观其变',
  '别做','别去','别碰','千万别','躲远点','绕开它','避开为妙','敬而远之',
  '多说无益','沉默是金','少说为妙','言多必失','不必多言','保持沉默','守口如瓶','三缄其口',
  '事与愿违','南辕北辙','背道而驰','渐行渐远','覆水难收','木已成舟','尘埃落定','无济于事',
  '算了吧何必呢','不值当','不要也罢','何必自寻烦恼','庸人自扰','多此一举','画蛇添足','过犹不及',
  '你已经很棒了','相信自己','一切都值得','做自己就好','你很了不起','别否定自己','你独一无二','你足够好',
  '坚持下去','再坚持一下','黎明前最暗','熬过去就好','都会好起来的','时间会治愈','伤痕是勋章','杀不死你的',
  '没关系慢慢来','不必完美','允许自己犯错','给自己时间','慢慢成长','不急不躁','按自己的节奏','不必比较',
  '你值得被爱','你很重要','你的存在有意义','这世界需要你','总有人在意你','你被爱着','你并不孤单','有人在等你',
  '加油你可以','挺住意味着一切','撑住','咬咬牙就过了','风雨过后是彩虹','柳暗花明','否极泰来','苦尽甘来',
  '向阳而生吧','心若向阳无畏悲伤','笑对人生','嘴角上扬','记得微笑','开心最重要','快乐很简单','取悦自己',
  '你很美','你很帅','你闪闪发光','你眼里有星星','你笑起来很好看','你声音好听','你的存在就是光','你是礼物',
  '别怕失败','失败是成功之母','错误是成长的阶梯','摔倒了爬起来','跌倒了就躺会儿','歇够了再出发','喘口气也好','休息也是前进',
  '今天辛苦你了','你已经做得很好了','不必逞强','累了就歇歇','困了就睡','饿了就吃','照顾好自己','善待自己',
  '前路漫漫亦灿灿','道阻且长行则将至','路虽远行则将至','事虽难做则必成','念念不忘必有回响','功不唐捐','天道酬勤','厚积薄发',
  '每一小步都算数','聚沙成塔','滴水穿石','积跬步至千里','日拱一卒','星光不负赶路人','岁月不负有心人',
  '春风得意马蹄疾','轻舟已过万重山','守得云开见月明','拨云见日','峰回路转','绝处逢生','涅槃重生',
  '愿你被世界温柔以待','愿你平安喜乐','愿你健康快乐','愿你自由自在','愿你眼里有光','愿你心中有火','愿你脚下有路','愿你前方有灯',
  '你值得更好的','最好的尚未到来','惊喜在路上了','好事多磨','好饭不怕晚','压轴的总在最后','主角都是最后登场','你的剧本还没写完',
  '天将降大任','宝剑锋从磨砺出','梅花香自苦寒来','大器晚成','后来者居上','黑马就是你','逆袭剧本已写好','请开始你的表演',
  '心有灵犀','心意相通','情投意合','一见如故','相见恨晚','命中注定','天生一对','佳偶天成',
  '爱在眼前','珍惜身边人','TA就在你身边','爱要大声说','表白吧','去告白','勇敢说爱','喜欢就去追',
  '缘分已至','缘分妙不可言','有缘千里来相会','缘来是你','在对的时间遇见','相逢即是缘','且行且珍惜','珍惜眼前人',
  '细水长流','日久生情','相濡以沫','执子之手','与子偕老','白头偕老','琴瑟和鸣','举案齐眉',
  '暗恋是糖也是霜','藏在心里也挺好','默默喜欢也是美','远远看着就很好','不打扰是温柔','感谢遇见','遇见就很幸运','谢谢你出现过',
  '放不下就先拿着','时间会冲淡一切','会过去的','各自安好','一别两宽','后会无期','错过了就是错过了','往事随风',
  '下一个更好','总有人翻山越岭而来','你的TA在路上了','月老在牵线了','红绳已系','红线那头是谁','丘比特在瞄准','桃花运将至',
  '等待值得','宁缺毋滥','与其将就不如独行','单身的自由也很美','一个人的精彩','先爱自己再爱人','你若盛开蝴蝶自来','花香蝶自来',
  '朋友一生一起走','友谊长存','知己难得','人生得一知己足矣','兄弟情深','姐妹同心','患难见真情','雪中送炭最珍贵',
  '家人是最温暖的港','常回家看看','打个电话给家人','陪伴是最好的爱','父母在人生尚有来处','家是永远的港湾','归去来兮','倦鸟归林',
  '好久不见甚是想念','去见你想见的人','别等来不及才后悔','趁一切都来得及','活在当下珍惜眼前','来日并不方长','世事无常珍惜当下','明天和意外不知谁先来',
  '释怀吧','原谅自己','与过去和解','放下执念','卸下包袱','别回头往前看','往事清零','重新开始',
  '爱自有天意','情深不寿','慧极必伤','爱是克制','喜欢是放肆','爱是彼此成就','互相照亮','并肩前行',
  '学无止境','温故知新','厚积薄发','学以致用','知行合一','格物致知','博学笃志','切问近思',
  '书山有路勤为径','学海无涯苦作舟','业精于勤荒于嬉','读书破万卷','下笔如有神','腹有诗书气自华','最是书香能致远',
  '别临时抱佛脚','平时不烧香','平时多流汗','考前少流泪','平时多积累','考试不慌张','复习要趁早','别拖到最后',
  '这次考试能过','考试顺利','逢考必过','考的都会','蒙的都对','超常发挥','如有神助','下笔如有神',
  '你的努力不会白费','每一分耕耘都有收获','汗水浇灌出花朵','静待花开','默默扎根','向下扎根向上生长','根深才能叶茂','厚积才能薄发',
  '保持好奇心','永远求知若渴','虚心使人进步','骄傲使人落后','三人行必有我师','处处留心皆学问','学问学问边学边问','勤学好问',
  '专注当下','一心一意','心无旁骛','聚精会神','全神贯注','制心一处','无事不办','专注的力量',
  '图书馆在召唤你','去自习吧','放下手机去学习','书在等你翻开','拿起笔开始写','翻开第一页','迈出第一步','从此刻开始',
  '老师会欣赏你的','请教老师别害羞','多和同学讨论','团队合作力量大','独学而无友则孤陋','找一个学习搭子','并肩作战不孤单','一起变更好',
  '论文会顺利的','答辩一定过','实验会成功的','数据会好看','代码会跑通的','bug能修好','项目能交付','一切顺利',
  '终身学习','活到老学到老','学如逆水行舟','不进则退','学而不思则罔','思而不学则殆','温故而知新','可以为师矣',
  '毕业不是终点','人生处处是考场','学到的谁也拿不走','知识是最好的投资','投资自己永远不亏','学习是终身的事业','今天也要好好学习','明天也要加油',
  '天赋不够努力来凑','勤能补拙是良训','笨鸟先飞','龟兔赛跑','天道酬勤不酬怨','聪明在于勤奋','天才在于积累','水滴石穿',
  '早睡早起身体好','多喝热水','记得吃早饭','好好吃饭','按时吃饭','多吃蔬菜','少吃外卖','别熬夜了',
  '出去走走吧','散个步去','呼吸新鲜空气','拥抱大自然','晒晒太阳','看看天空','数数星星','吹吹晚风',
  '今天适合吃顿好的','犒劳一下自己','奖励自己','给自己买个礼物','买下它','对自己好一点','偶尔放肆一下','偷得浮生半日闲',
  '整理一下房间','断舍离','该扔的就扔','打扫卫生心情好','窗明几净心自安','一屋不扫何以扫天下','收拾收拾换个心情','干净是最好的风水',
  '运动一下吧','跑起来','跳一跳','出出汗','活动活动筋骨','身体是革命的本钱','健康第一','无病无灾就是福',
  '泡杯茶慢慢喝','喝杯咖啡提神','倒杯水歇一歇','点一盏灯读一本书','放一首喜欢的歌','音乐治愈一切','旋律是最好的药','歌声里有答案',
  '养一盆植物','种一株花','看它慢慢长大','养只猫治愈你','撸猫解千愁','狗是人类最好的朋友','小动物很治愈','去摸摸小猫',
  '睡个好觉吧','今晚早点睡','明天又是新的一天','一觉醒来会更好','梦里有答案','好好睡别多想','关掉手机闭上眼','晚安好梦',
  '洗个热水澡放松','泡个脚解解乏','做做拉伸放松肌肉','深呼吸放松','冥想片刻','放空自己','什么都不想','发呆也是一种充电',
  '列个待办清单','一件事一件事来','分清轻重缓急','先做最重要的','别贪多嚼不烂','一次只做一件事','专注一件事做到极致','少即是多',
  '存点钱吧','开源节流','该花的要花','该省的要省','花钱买快乐值得','体验比物品更珍贵','钱是赚不完的','够用就好',
  '换个发型吧','买件新衣服','换个新造型','尝试新风格','换个颜色换个心情','新形象新气象','从头开始','改头换面',
  '按时吃饭按时睡觉','规律作息','养成好习惯','好习惯改变一生','微习惯大力量','每天进步一点点','坚持就是胜利','习惯成就命运',
  '顺其自然','随遇而安','船到桥头自然直','车到山前必有路','柳暗花明又一村','塞翁失马焉知非福','祸兮福所倚',
  '大道至简','返璞归真','少即是多','慢即是快','欲速则不达','过犹不及','物极必反','否极泰来',
  '知足常乐','知止不殆','知足者富','贪多必失','满招损谦受益','月满则亏水满则溢','花看半开酒饮微醺','凡事留三分',
  '静水流深','大音希声','大象无形','大智若愚','大巧若拙','大辩若讷','大勇若怯','大器晚成',
  '无为而无不为','道法自然','天人合一','万物皆有时','春种秋收','瓜熟蒂落','水到渠成','自然而然',
  '一切都会过去','逝者如斯夫','不舍昼夜','时光如流水','岁月不居','时节如流','光阴似箭','白驹过隙',
  '当下即是全部','昨日已过明日未至','活在此刻','此时此刻最重要','拥有当下就是富有','不念过往不畏将来','过去已去未来未来','现在就是礼物',
  '心若不动风又奈何','境由心造','相由心生','心静自然凉','心安即是归处','心宽天地阔','心有多大舞台就有多大','一切唯心造',
  '不以物喜不以己悲','宠辱不惊','去留无意','看庭前花开花落','望天上云卷云舒','闲看花开花落','漫随云卷云舒','淡然处之',
  '上善若水','水善利万物而不争','水利万物','柔能克刚','水滴石穿','海纳百川','有容乃大','无欲则刚',
  '难得糊涂','睁一只眼闭一只眼','看破不说破','心里明白就行了','不必事事较真','糊涂是福','人生难得是糊涂','别想太多',
  '道不远人','道在平常日用间','一花一世界','一叶一菩提','一粒沙里看世界','半瓣花上说人情','微尘中有大千',
  '活在当下','今日事今日毕','明日复明日明日何其多','我生待明日万事成蹉跎','少壮不努力老大徒伤悲','莫等闲白了少年头','及时当勉励岁月不待人','盛年不重来',
  '别做梦了醒醒','你想太多了','洗洗睡吧','梦里什么都有','醒醒吧孩子','别自我感动了','你又来了','差不多得了',
  '这就是命','认命吧','算命的都救不了你','别挣扎了','随缘吧','爱咋咋地','随便吧','无所吊谓',
  '你猜','你猜猜看','你再猜','就不告诉你','无可奉告','佛曰不可说','天机不可泄露','这个不能说',
  '看心情','看情况吧','看缘分','看命','看天意','看运气','看你表现','看你诚意',
  '你自己心里没数吗','你明明知道答案','你其实早就决定了','问我干嘛你知道的','别自欺欺人了','诚实面对自己吧','你需要的不是答案','你需要的是勇气',
  '想peach呢','想多了兄弟','好家伙','真有你的','太卷了吧','别卷了','躺平吧','摆烂也是智慧',
  '打游戏去吧','追剧去吧','刷手机去吧','摸鱼去吧','偷懒一下没事','划水也是门艺术','带薪摸鱼','上班如上坟',
  '吃顿火锅就好了','没有什么是一顿火锅解决不了的','如果有就两顿','烧烤也行','奶茶续命','快乐水拯救世界','甜食治愈一切','吃饱了再说',
  '你开心就好','你高兴就行','你说的都对','你赢了','是在下输了','甘拜下风','这波我服','厉害了我的哥',
  '这就是生活','成年人的世界没有容易二字','除了长胖','除了掉头发','除了变穷','扎心了老铁','人间真实','过于真实',
  '豆瓣拒绝评分','不建议不建议','达咩','漏','NO','别问了','下一个问题','跳过这题',
  '今天不宜做决定','改天再问','择日再问','明日再议','下次一定','改天一定','后天吧','大后天也行',
  '是福不是祸是祸躲不过','看开点','想开点','放宽心','没什么大不了的','天塌不下来','是你的跑不掉的','得之我幸失之我命',
  '小心驶得万年船','警惕身边人','防人之心不可无','害人之心不可有','小心为上','睁大眼睛','擦亮眼睛','提高警惕',
  '谨言慎行','祸从口出','沉默是金','多听少说','三思而后言','言多必失','守心如守城','慎独',
  '别太相信别人','别把底牌全亮出来','给自己留条后路','凡事留有余地','话不说满事不做绝','做人留一线','日后好相见','别把话说死',
  '骄兵必败','得意莫忘形','乐极生悲','喜极而泣','别飘','稳住','低调做人','闷声发大财',
  '有陷阱','前方有坑','注意脚下','小心路滑','看路','当心','留神','警觉',
  '别贪小便宜','天下没有免费的午餐','免费的往往最贵','便宜没好货','天上不会掉馅饼','掉下来也是铁饼','小心糖衣炮弹','甜言蜜语最伤人',
  '酒肉朋友靠不住','遇事见人心','路遥知马力','日久见人心','真金不怕火炼','患难见真情','墙倒众人推','树倒猢狲散',
  '别好了伤疤忘了疼','不要在同一个坑摔两次','吃一堑长一智','前事不忘后事之师','历史总在重演','记住教训','吸取经验',
  '别被表面迷惑','金玉其外败絮其中','知人知面不知心','画龙画虎难画骨','不要被外表欺骗','透过现象看本质','拨开迷雾看真相','真相往往残酷',
  '高处不胜寒','树大招风','人怕出名猪怕壮','枪打出头鸟','木秀于林风必摧之','低调低调再低调','闷声才能发大财','藏拙',
  '你心中已有答案','其实你知道','答案就在你心里','向内求','静下来听听心声','倾听内心的声音','直觉会告诉你','第一反应最真实',
  '一切自有安排','冥冥之中自有天意','命中有时终须有','万事皆有定数','因果不虚','种什么因得什么果','因果循环报应不爽','善恶终有报',
  '宇宙自有安排','交给时间','让子弹飞一会儿','静待花开','耐心等待','好事不怕晚','心急吃不了热豆腐','慢工出细活',
  '这个问题的答案不重要','问错了问题','换个问题问','你确定要问这个吗','跳出框架看问题','换个角度','山不转水转',
  '风知道答案','云会告诉你','雨带来消息','雪藏着秘密','春风十里不如你','夏虫不可语冰','一叶落而知天下秋','冬天来了春天还会远吗',
  '今天不宜问大事','明日再问','吉时未到','良辰吉日再问','初一十五再问','月圆之夜有答案','等到花开时','待到雪化后',
  '天知道','地知道','神知道','鬼知道','只有你自己知道','宇宙知道','月亮知道','星星知道',
  '也许吧','或许吧','大概吧','可能吧','差不多','八九不离十','十有八九','七七八八',
  '不可说','不可思议','玄之又玄','妙不可言','不可思议的奇妙','只可意会不可言传','道可道非常道','名可名非常名',
  '一半一半','各占五成','不好说','说不准','难说','看情况','看造化','看际遇',
  '一切皆空','色即是空空即是色','无即是有','空即是满','虚即是实','梦即是醒','生即是死','一即一切','万物皆备于我',
];

/* ============================================
   薛定谔的待办（盲盒任务）
   ============================================ */

const BLIND_BOX_TASKS = [
  '今天喝满三杯水',
  '站起来伸展一分钟',
  '给一个朋友发一句"加油"',
  '整理一下桌面，哪怕只是把笔放好',
  '闭眼深呼吸 10 次，什么都不想',
  '读一页任何书',
  '对镜子里的自己笑一下',
  '写下今天最想完成的一件事',
  '给通讯录里随机一个人发个表情包',
  '走楼梯而不是坐电梯（至少一次）',
  '吃一个水果',
  '把手机放下 5 分钟，看看窗外',
  '记录今天让你开心的一件事',
  '做 10 个深蹲',
  '给妈妈发一句"我爱你"',
  '收拾一件你一直懒得收的东西',
  '听一首没听过的歌',
  '对自己说三遍"我很棒"',
  '帮陌生人做一件小事',
  '写下一个你想感谢的人的名字',
  '今天不说一句抱怨的话',
  '用左手（或右手）写一行字',
  '拍一张你觉得美的照片',
  '把袜子配对整理好',
  '对自己说：你已经做得很好了'
];

function renderBlindBox(revealedIdx = null) {
  if (revealedIdx !== null) {
    return `
      <div class="tb-card">
        <div class="tb-card-title">
          <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          <span>薛定谔的待办</span>
        </div>
        <div class="blindbox-revealed" id="blindbox-revealed">
          <div class="blindbox-task" id="blindbox-task">${escHtml(BLIND_BOX_TASKS[revealedIdx] || '未知任务')}</div>
          <button class="btn btn-primary btn-sm" id="blindbox-retry-btn" style="margin-top:12px">
            <span class="mi">refresh</span> 再来一次
          </button>
          <button class="btn btn-secondary btn-sm" id="blindbox-share" style="margin-top:8px">
            <span class="mi">share</span> 分享任务
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        <span>薛定谔的待办</span>
      </div>
      <div class="blindbox-sealed" id="blindbox-sealed">
        <div class="blindbox-box-icon">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <rect x="10" y="25" width="60" height="45" rx="8" fill="none" stroke="var(--md-primary)" stroke-width="2.5"/>
            <path d="M10 25 L40 42 L70 25" fill="none" stroke="var(--md-primary)" stroke-width="2.5"/>
            <rect x="32" y="32" width="16" height="18" rx="4" fill="none" stroke="var(--md-primary)" stroke-width="1.5"/>
            <circle cx="40" cy="39" r="2" fill="var(--md-primary)"/>
          </svg>
        </div>
        <p style="font-size:var(--text-sm);color:var(--md-on-surface-variant);margin-top:8px">无限抽取，越玩越上头</p>
        <button class="btn btn-primary btn-sm" id="blindbox-open-btn">🎁 打开盲盒</button>
      </div>
    </div>
  `;
}

function renderBlindBoxCompact() {
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="blindbox">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      </div>
      <div class="tb-card-label">薛定谔的待办</div>
      <div class="tb-card-preview">打开盲盒，抽取今日待办</div>
    </div>
  `;
}

function openBlindBox() {
  const sealed = document.getElementById('blindbox-sealed');
  if (!sealed) return;

  const idx = Math.floor(Math.random() * BLIND_BOX_TASKS.length);

  sealed.style.transition = 'transform 0.4s var(--ease-spring), opacity 0.3s var(--ease-standard)';
  sealed.style.transform = 'scale(0.5) rotate(-10deg)';
  sealed.style.opacity = '0';

  setTimeout(() => {
    const card = sealed.closest('.tb-card');
    if (!card) return;
    let html = renderBlindBox(idx);
    if (card.classList.contains('tb-card--expanded')) {
      html = buildExpandedHTML('blindbox', html, card.style.gridColumn || undefined, card.style.gridRow || undefined);
    }
    card.outerHTML = html;
    bindBlindBox();
    if (_currentExpandedCard && _currentExpandedCard.dataset.tbWidget === 'blindbox') {
      _currentExpandedCard = document.querySelector('[data-tb-widget="blindbox"].tb-card--expanded');
    }
  }, 400);
}

function retryBlindBox() {
  const taskEl = document.getElementById('blindbox-task');
  if (!taskEl) return;

  const idx = Math.floor(Math.random() * BLIND_BOX_TASKS.length);

  // 平滑 crossfade：先缩出旧文字，再更新并弹入新文字
  taskEl.style.transition = 'opacity 0.15s var(--ease-standard), transform 0.2s var(--ease-spring)';
  taskEl.style.opacity = '0';
  taskEl.style.transform = 'scale(0.92)';

  setTimeout(() => {
    taskEl.textContent = BLIND_BOX_TASKS[idx];
    taskEl.style.opacity = '1';
    taskEl.style.transform = 'scale(1)';
  }, 150);
}

function bindBlindBox() {
  document.getElementById('blindbox-open-btn')?.addEventListener('click', openBlindBox);
  document.getElementById('blindbox-retry-btn')?.addEventListener('click', retryBlindBox);
  document.getElementById('blindbox-share')?.addEventListener('click', () => {
    const taskText = document.getElementById('blindbox-task')?.textContent;
    if (taskText) {
      navigator.clipboard.writeText('【课搭子 · 今日待办】' + taskText).then(() => {
        showToast('已复制到剪贴板');
      }).catch(() => {
        showToast('分享失败，请长按手动复制');
      });
    }
  });
}

/* ============================================
   答案之书
   ============================================ */

function renderAnswerBook(revealedAnswer = null) {
  if (revealedAnswer !== null) {
    return `
      <div class="tb-card">
        <div class="tb-card-title">
          <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5c-1.95 0-4.05.4-5.5 1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5c.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5c1.35-.85 3.8-1.5 5.5-1.5c1.65 0 3.35.3 4.75 1.05c.1.05.15.05.25.05c.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5c-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5c1.2 0 2.4.15 3.5.5v11.5z"/></svg>
          <span>答案之书</span>
        </div>
        <div class="answerbook-revealed" id="answerbook-revealed">
          <div class="answerbook-answer" id="answerbook-answer">${escHtml(revealedAnswer)}</div>
          <div class="answerbook-actions">
            <button class="btn btn-primary btn-sm" id="answerbook-retry-btn">
              <span class="mi">auto_stories</span> 再翻一页
            </button>
            <button class="btn btn-secondary btn-sm" id="answerbook-share">
              <span class="mi">share</span> 分享答案
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5c-1.95 0-4.05.4-5.5 1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5c.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5c1.35-.85 3.8-1.5 5.5-1.5c1.65 0 3.35.3 4.75 1.05c.1.05.15.05.25.05c.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5c-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5c1.2 0 2.4.15 3.5.5v11.5z"/></svg>
        <span>答案之书</span>
      </div>
      <div class="answerbook-sealed" id="answerbook-sealed">
        <div class="answerbook-book-icon">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <rect x="40" y="10" width="8" height="80" rx="2" fill="var(--md-primary)" opacity="0.2"/>
            <path d="M40 15 L10 20 L10 85 L40 80 Z" fill="var(--md-surface-container-high)" stroke="var(--md-outline-variant)" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M48 15 L78 20 L78 85 L48 80 Z" fill="var(--md-surface-container-lowest)" stroke="var(--md-outline-variant)" stroke-width="1.5" stroke-linejoin="round"/>
            <line x1="17" y1="32" x2="35" y2="30" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="17" y1="40" x2="35" y2="38" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="17" y1="48" x2="35" y2="46" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="17" y1="56" x2="35" y2="54" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="32" x2="72" y2="30" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="40" x2="72" y2="38" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="48" x2="72" y2="46" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="56" x2="72" y2="54" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <text x="50" y="70" text-anchor="middle" font-size="18" font-weight="700" fill="var(--md-primary)" font-family="serif">?</text>
          </svg>
        </div>
        <p style="font-size:var(--text-sm);color:var(--md-on-surface-variant);margin-top:8px">心中默念问题，轻触书本翻开答案</p>
        <button class="btn btn-primary btn-sm" id="answerbook-open-btn">
          <span class="mi">auto_stories</span> 翻开答案之书
        </button>
      </div>
    </div>
  `;
}

function renderAnswerBookCompact() {
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="answerbook">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5c-1.95 0-4.05.4-5.5 1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5c.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5c1.35-.85 3.8-1.5 5.5-1.5c1.65 0 3.35.3 4.75 1.05c.1.05.15.05.25.05c.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5c-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5c1.2 0 2.4.15 3.5.5v11.5z"/></svg>
      </div>
      <div class="tb-card-label">答案之书</div>
      <div class="tb-card-preview">翻开书本，寻找答案</div>
    </div>
  `;
}

function drawAnswer() {
  const sealed = document.getElementById('answerbook-sealed');
  if (!sealed) return;

  const idx = Math.floor(Math.random() * ANSWER_BOOK_ANSWERS.length);
  const answer = ANSWER_BOOK_ANSWERS[idx];

  sealed.style.transition = 'transform 0.45s var(--ease-spring), opacity 0.3s var(--ease-standard)';
  sealed.style.transform = 'scale(0.9) rotateY(90deg)';
  sealed.style.opacity = '0';

  setTimeout(() => {
    const card = sealed.closest('.tb-card');
    if (!card) return;
    let html = renderAnswerBook(answer);
    if (card.classList.contains('tb-card--expanded')) {
      html = buildExpandedHTML('answerbook', html, card.style.gridColumn || undefined, card.style.gridRow || undefined);
    }
    card.outerHTML = html;
    bindAnswerBook();
    if (_currentExpandedCard && _currentExpandedCard.dataset.tbWidget === 'answerbook') {
      _currentExpandedCard = document.querySelector('[data-tb-widget="answerbook"].tb-card--expanded');
    }
  }, 400);
}

function retryAnswerBook() {
  const answerEl = document.getElementById('answerbook-answer');
  if (!answerEl) return;

  const idx = Math.floor(Math.random() * ANSWER_BOOK_ANSWERS.length);
  const answer = ANSWER_BOOK_ANSWERS[idx];

  // 平滑 crossfade：缩出旧答案 → 更新文字 → 弹入新答案
  answerEl.style.transition = 'opacity 0.15s var(--ease-standard), transform 0.2s var(--ease-spring)';
  answerEl.style.opacity = '0';
  answerEl.style.transform = 'scale(0.92)';

  setTimeout(() => {
    answerEl.textContent = answer;
    answerEl.style.opacity = '1';
    answerEl.style.transform = 'scale(1)';
  }, 150);
}

function bindAnswerBook() {
  document.getElementById('answerbook-open-btn')?.addEventListener('click', drawAnswer);
  document.getElementById('answerbook-retry-btn')?.addEventListener('click', retryAnswerBook);
  document.getElementById('answerbook-share')?.addEventListener('click', () => {
    const answerText = document.getElementById('answerbook-answer')?.textContent;
    if (answerText) {
      navigator.clipboard.writeText('【课搭子 · 答案之书】' + answerText).then(() => {
        showToast('已复制到剪贴板');
      }).catch(() => {
        showToast('分享失败，请长按手动复制');
      });
    }
  });
}

/* ============================================
   祈福木鱼
   ============================================ */

let _wfLastClick = 0;

function playWoodenFishSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 280;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}

function renderWoodenFish() {
  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z" fill="var(--md-primary)"/></svg>
        祈福木鱼
      </div>
      <div class="wf-area">
        <div class="wf-icon" id="wf-icon">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <!-- 木鱼主体 -->
            <ellipse cx="40" cy="44" rx="32" ry="22" fill="none" stroke="var(--md-primary)" stroke-width="2.5"/>
            <ellipse cx="40" cy="44" rx="28" ry="18" fill="none" stroke="var(--md-primary)" stroke-width="1" opacity="0.4"/>
            <!-- 木鱼开口 -->
            <path d="M18 38 Q40 28 62 38" fill="none" stroke="var(--md-primary)" stroke-width="2"/>
            <!-- 敲槌 -->
            <line x1="48" y1="18" x2="54" y2="6" stroke="var(--md-primary)" stroke-width="3" stroke-linecap="round"/>
            <circle cx="55" cy="5" r="4" fill="none" stroke="var(--md-primary)" stroke-width="2"/>
          </svg>
        </div>
      </div>
    </div>
  `;
}

function renderWoodenFishCompact() {
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="woodenfish">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z"/></svg>
      </div>
      <div class="tb-card-label">祈福木鱼</div>
      <div class="tb-card-preview">敲击木鱼，积攒功德</div>
    </div>
  `;
}

function spawnFloatText(x, y, isSpecial) {
  const el = document.createElement('div');
  const SPECIAL_TEXTS = ['老师捞我', '考的都会', '蒙的全对', '期末必过'];
  const text = isSpecial
    ? SPECIAL_TEXTS[Math.floor(Math.random() * SPECIAL_TEXTS.length)]
    : '功德 + 1';
  el.textContent = text;
  el.className = 'wf-float-text' + (isSpecial ? ' wf-float-text--gold' : '');
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  const duration = isSpecial ? 1200 : 800;
  setTimeout(() => el.remove(), duration);
}

function bindWoodenFish() {
  const icon = document.getElementById('wf-icon');
  if (!icon) return;
  icon.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - _wfLastClick < 300) return;
    _wfLastClick = now;

    // 音效
    playWoodenFishSound();

    // 缩放动画
    icon.classList.remove('wf-bumping');
    void icon.offsetWidth; // reflow
    icon.classList.add('wf-bumping');

    // 浮动文字
    const rect = icon.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - 30;
    const cy = rect.top - 8;
    const isSpecial = Math.random() < 0.05;
    spawnFloatText(cx, cy, isSpecial);
  });
}

/* ============================================
   今日摸鱼指南
   ============================================ */

const FISH_GUIDES = [
  '逛菜市场或者花鸟市场',
  '坐公交车或者地铁随机下车',
  '躺北大楼或者操场的草坪上',
  '打卡你认为学校最好看的树',
  '听一张完整的专辑',
  '电影院包场看一部电影',
  '和朋友打一场羽毛球',
  '找一条没走过的路散步，每个路口向右转',
  '吃饭时观察陌生人吃饭，猜测他们的专业和心情',
  '去鱼嘴湿地公园吹风',
  '翻学校论坛考古旧帖',
  '操场夜跑',
  '坐地铁最后一节车厢看隧道灯光后退',
  '整理自己寝室里的东西',
  '对窗外的景色写一段文字',
  '去便利店买一种没喝过的饮料',
  '挑一条公交线路背下沿途所有站名',
  '找一首喜欢的诗背诵',
  '用校园里的落叶或花瓣摆一个图案',
  '夜爬紫金山看日出',
  '从燕子矶公园骑自行车到中山码头',
  '翻出中学时的日记或作文看',
  '去蹭其他专业的课程听',
  '马上去洗澡',
  '在便利贴上抄一句读到的好句子',
];

function loadFishHistory() {
  try {
    return JSON.parse(localStorage.getItem('tb_fish_history') || '[]');
  } catch { return []; }
}

function saveFishHistory(history) {
  localStorage.setItem('tb_fish_history', JSON.stringify(history));
}

function pickFishGuide() {
  const history = loadFishHistory();
  // 排除最近最多 10 条，保证不重复
  const excludeSet = new Set(history.slice(-10));
  const candidates = FISH_GUIDES
    .map((text, i) => ({ text, i }))
    .filter(item => !excludeSet.has(item.i));
  // 如果全部排除了（不太可能）就重置
  const pool = candidates.length > 0 ? candidates : FISH_GUIDES.map((text, i) => ({ text, i }));
  const picked = pool[Math.floor(Math.random() * pool.length)];
  history.push(picked.i);
  if (history.length > 20) history.splice(0, history.length - 20);
  saveFishHistory(history);
  return picked.text;
}

function renderFishGuide() {
  const text = pickFishGuide();
  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="20" height="20"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2zm0 15c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1zm1-4h-2V7h2v6z" fill="var(--md-primary)"/></svg>
        今日摸鱼指南
      </div>
      <div class="fg-area">
        <div class="fg-content" id="fg-content">${escHtml(text)}</div>
        <button class="btn btn-primary btn-sm" id="fg-refresh-btn" style="min-width:120px">再换一条</button>
      </div>
    </div>
  `;
}

function renderFishGuideCompact() {
  // 显示最近一条摸鱼建议，静态不消耗历史
  const history = loadFishHistory();
  let preview = '点击查看摸鱼建议';
  if (history.length > 0) {
    const lastIdx = history[history.length - 1];
    preview = FISH_GUIDES[lastIdx] || preview;
  }
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="fishguide">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2zm0 15c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1zm1-4h-2V7h2v6z"/></svg>
      </div>
      <div class="tb-card-label">今日摸鱼指南</div>
      <div class="tb-card-preview">${escHtml(preview)}</div>
    </div>
  `;
}

function bindFishGuide() {
  const btn = document.getElementById('fg-refresh-btn');
  const content = document.getElementById('fg-content');
  if (!btn || !content) return;

  btn.addEventListener('click', () => {
    btn.textContent = '换一条...';
    btn.disabled = true;
    content.classList.add('fg-switching');

    setTimeout(() => {
      const text = pickFishGuide();
      content.textContent = text;
      content.classList.remove('fg-switching');
      btn.textContent = '再换一条';
      btn.disabled = false;
    }, 200);
  });
}

/* ============================================
   吃了么（南大食堂盲盒）
   ============================================ */

const FOOD_DATA = {
  gulou: [
    '卓粤拉肠：艇仔粥、鲜虾肠粉、生菜',
    '荣记潮汕牛肉火锅（中华路店）：牛肉',
    '垛上渔夫·兴化菜馆：猪头肉、外婆长鱼饭',
    '紫滇源云南生态菜',
    '韵味居：糯米笋炒腊肉',
    '摆川饭堂·豆花饭',
    '味香鸭店：鸭子、素什锦',
    '宜宾燃面：牛肉汤面、蒜泥白肉',
    '仲氏过桥米线：肉酱米线',
    '西北桥头拉面大王：凉皮、锅贴',
    '百姓菜馆：双臭煲',
    '大叔披萨：松露菌菇披萨、希腊沙拉',
    '巴蜀鱼花：辣子鸡、脆皮小土豆',
    '一味米线：酸菜肉片米线、番茄猪蹄米线',
    '重庆鸡公煲：牛肉煲',
    '丁丁精菜馆：酸菜黑鱼、京酱肉丝',
    '锦州烧烤王：油边、爆炒方便面、鲫鱼',
    '食物招领：咖喱小酥肉',
    '云南烧烤：牛肉沫炒饭、黄牛肉串',
    '月星酸菜鱼：特色酸菜鱼',
    '江河叔叔：鬼金棒拉面',
    '河狮园饭店',
    '猪脚饭：烧鸭饭',
    '广和生大排档：羊肉炉、清远鸡',
    '小辣椒湖南米粉：麻辣鸡粉',
    'La Mia Casa：披萨、千层面、蘑菇芝士烩饭',
    '市井川菜：毛血旺',
    '陕西面馆：油泼面',
    '食肉兽：安格斯肥牛饭、咖喱猪排饭、烤鳗鱼',
    '石锅拌饭：泡菜五花肉',
    '泽厨记抓饭·羊排：羊排抓饭',
    '成都娃娃：辣子鸡、豆花',
    '丽哲韩式烧烤：泡菜饼、肉类',
    '百谷茶餐厅：叉烧、油面筋',
    '福桔：菜饭、芥末虾球',
    '箪食记：水煮肉片、招牌红烧肉',
    '眷江南之小蓝鲸：香芋排骨、红烧肉',
    '觅炙海鲜粥火锅：海鲜粥、鲜活对虾、现切吊龙',
    '肖记四川宜宾燃面：招牌燃面、白肉',
    '兄弟砂锅 (陆家巷店)：三鲜土豆粉砂锅',
    '馨罗冷面拌饭 (珠江路店)：荞麦冷面、无骨鸡块',
    '广东阿生鱼捞·斑鱼海鲜粥火锅：斑鱼片、黑虎虾滑、绣球菌',
    '水西门月升鸭子店：招牌烤鸭、盐水鸭、板鸭',
    '芬记台湾无名小店：蚵仔煎、盐酥鸡、卤肉饭',
    '老汪馄饨店：安庆馄饨、鲜肉锅贴、荠菜鲜肉小馄饨',
    '熊猫餐馆：冰糖蹄膀、蛋炒饭、蚂蚁上树',
    '福桔家庭厨房：无花果家烧猪小排、南京菜饭',
    '罗家凉皮店：纯瘦肉夹馍、凉皮凉面面筋',
    '四川小吃 (彩霞街店)：凉皮、卤牛肉、凉拌菜',
    '潮粥馆：潮汕炸肉饼、腌虾、砂锅粥',
    '花记台湾便当 (瑞金店)：台式排骨烩饭、冬瓜海带汤',
    '梅姐麻辣烫：麻辣烫、三鲜炒面、老式炸串',
    '大卫厨房·融合料理：泰式猪肉打抛饭、牛眼菌菇炒饭',
    '蘑菇餐厅：芝士土豆泥、鸡茸蘑菇汤、芝士虾仁焗饭',
    '红玫瑰：西餐/简餐、披萨、意面',
    '怪味麻辣烫：金针菇、麻辣烫、冬瓜、海带',
    '江宁肚包鸡：肚包鸡、鸡汤、配菜拼盘',
    '七家湾牛肉锅贴：牛肉锅贴、牛肉馄饨、红烧牛肉粉丝汤',
    '吉派东北烤肉：牛肉筋、东北酸菜蒸饺、牛上脑',
    '南航粥店：海南清粥、黄桃牛奶燕麦粥',
    '黑皮酸菜鱼 (三山街店)：酸菜鱼、肥肠鱼',
    '小院冒菜 (金银街店)：香辣牛油冒、五香烤鸭冒',
    '真火烧烤 (钱塘路店)：羊肉串、馒头片、蜜汁烤翅',
    '六合腰肚面馆 (水西门大街店)：六合腰肚面、三鲜面',
    '小粉桥猪蹄 (小粉桥店)：炖猪蹄、卤猪蹄',
    '鲜满堂米线 (新街口店)：牛蛙米线、水煮腰片米线',
    '山姐豆花：粉蒸肉、鸭血旺',
    '二食五窗口：淮南牛肉汤',
    '一食：铁板饭、滑蛋饭、干拌米线、盖浇饭、小馄饨、水饺',
    '教工：15r 盒饭',
    '南园餐车',
    '三食：麻辣香锅、酸汤肉片面、生煎包、椰子鸡',
  ],
  xianlin: [
    '沭阳药膳鸡：药膳鸡',
    '寻鲜潮·海南糟粕醋火锅：对虾、文昌鸡',
    '黑哥炭火烤肉：拌肉、酸菜',
    '青春分食：炸猪排炒年糕',
    '青州苗乡牛肉馆：带皮牛肉',
    '今牛潮汕牛肉馆：牛肉粿条、干拌粿条、牛肉火锅',
    '九号披萨店：梨子火腿奶酪披萨',
    '土耳其多拿餐厅：烤肉拼盘',
    '摊摊面皮·菜煎饼：双蛋菜煎饼',
    '鑫花溪牛肉米粉：贵州特色酸汤牛天下',
    '张氏砂锅私房菜：蒜香鸡翅、豉油黑鱼片',
    '小熊罐罐云南菜：老奶洋芋、红三剁、番茄牛腩',
    '鸡手王炭烤羊腿：烤冷面、蜜汁鸡翅',
    '津津鸭血粉丝汤：招牌鸭血粉丝汤、炒饭',
    '刚刚好小火锅：贵州酸汤锅底',
    '多来韩国料理：牛肉汤、海鲜饼、炒年糕',
    '十一食：砂锅、荷叶排骨饭、酱骨饭',
    '十二食：烤鸭饭、牛肉粉丝汤',
    '教一：排骨、鸡爪、大排、豆角、锅仔、玉米猪肉水饺、抄手',
    '教二：酱骨饭、香煎鸡排饭、龙利鱼饭、菠萝鸡肉炒饭',
    '民族餐厅：鸡块、鸭腿、鱼块、肉丸汤、烤鱼、牛肉拉面、牛肉冷面、清汤麻辣烫、黑椒牛肉炒饭',
  ],
};

function loadFoodCampus() {
  try { return localStorage.getItem('tb_food_campus') || 'xianlin'; }
  catch { return 'xianlin'; }
}

function saveFoodCampus(campus) {
  localStorage.setItem('tb_food_campus', campus);
}

function renderFoodPicker() {
  const campus = loadFoodCampus();
  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="20" height="20"><path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" fill="var(--md-primary)"/></svg>
        吃了么
      </div>
      <div class="fp-area">
        <div class="fp-campus-tabs" id="fp-campus-tabs">
          <button class="fp-campus-tab${campus === 'gulou' ? ' active' : ''}" data-campus="gulou">鼓楼</button>
          <button class="fp-campus-tab${campus === 'xianlin' ? ' active' : ''}" data-campus="xianlin">仙林</button>
        </div>
        <div class="fp-result" id="fp-result">点击下方按钮开始抽取</div>
        <button class="btn btn-primary btn-sm" id="fp-pick-btn" style="min-width:140px">今天吃点啥？</button>
      </div>
    </div>
  `;
}

let _fpLastResult = '';

function renderFoodPickerCompact() {
  const campus = loadFoodCampus();
  const campusLabel = campus === 'gulou' ? '鼓楼' : '仙林';
  let preview = _fpLastResult || '点击抽取今日美食';
  return `
    <div class="tb-card tb-card--compact" data-tb-widget="foodpicker">
      <div class="tb-card-icon">
        <svg class="mi-svg" viewBox="0 0 24 24" width="28" height="28"><path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/></svg>
      </div>
      <div class="tb-card-label">吃了么</div>
      <div class="tb-card-preview">${escHtml(preview)} · ${campusLabel}</div>
    </div>
  `;
}

function bindFoodPicker() {
  const tabs = document.getElementById('fp-campus-tabs');
  const pickBtn = document.getElementById('fp-pick-btn');
  const resultEl = document.getElementById('fp-result');

  if (!tabs || !pickBtn || !resultEl) return;

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-campus]');
    if (!tab) return;
    const campus = tab.dataset.campus;
    tabs.querySelectorAll('.fp-campus-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    saveFoodCampus(campus);
    _fpLastResult = '';
    resultEl.textContent = '点击下方按钮开始抽取';
    resultEl.classList.remove('fp-revealing');
  });

  pickBtn.addEventListener('click', () => {
    const campus = loadFoodCampus();
    const list = FOOD_DATA[campus] || FOOD_DATA.xianlin;
    // 排除上次结果避免连续重复
    const candidates = list.filter(item => item !== _fpLastResult);
    const pool = candidates.length > 0 ? candidates : list;

    pickBtn.textContent = '正在抽取...';
    pickBtn.disabled = true;

    setTimeout(() => {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      _fpLastResult = picked;
      resultEl.textContent = picked;
      resultEl.classList.remove('fp-revealing');
      void resultEl.offsetWidth;
      resultEl.classList.add('fp-revealing');
      pickBtn.textContent = '今天吃点啥？';
      pickBtn.disabled = false;
    }, 300);
  });
}

/* ============================================
   组装 & 事件绑定
   ============================================ */

// ---- FLIP 展开引擎 ----

let _isExpanding = false;
let _currentExpandedCard = null;

const WIDGET_RENDERERS = {
  pomodoro:    { render: renderPomodoro,    bind: bindPomodoro,    compact: renderPomodoroCompact },
  luck:        { render: renderLuck,        bind: bindLuck,        compact: renderLuckCompact },
  decide:      { render: () => renderDecide('coin'), bind: bindDecideAll, compact: renderDecideCompact },
  blindbox:    { render: () => renderBlindBox(),     bind: bindBlindBox,    compact: renderBlindBoxCompact },
  answerbook:  { render: () => renderAnswerBook(),   bind: bindAnswerBook,  compact: renderAnswerBookCompact },
  woodenfish:  { render: renderWoodenFish,  bind: bindWoodenFish,  compact: renderWoodenFishCompact },
  fishguide:   { render: renderFishGuide,   bind: bindFishGuide,   compact: renderFishGuideCompact },
  foodpicker:  { render: renderFoodPicker,  bind: bindFoodPicker,  compact: renderFoodPickerCompact },
};

function captureCardRects(grid) {
  var map = {};
  var cards = grid.querySelectorAll('.tb-card[data-tb-widget]');
  for (var i = 0; i < cards.length; i++) {
    map[cards[i].dataset.tbWidget] = cards[i].getBoundingClientRect();
  }
  return map;
}

function flipGridCards(grid, beforeMap, onAllDone) {
  var cards = grid.querySelectorAll('.tb-card[data-tb-widget]');
  var pending = 0;

  function checkDone() {
    if (pending === 0 && onAllDone) {
      onAllDone();
      onAllDone = null;
    }
  }

  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var widget = card.dataset.tbWidget;
    var beforeRect = beforeMap[widget];
    if (!beforeRect) continue;
    var afterRect = card.getBoundingClientRect();
    var dx = beforeRect.left - afterRect.left;
    var dy = beforeRect.top - afterRect.top;
    var sx = beforeRect.width / afterRect.width;
    var sy = beforeRect.height / afterRect.height;

    // 无显著变化则跳过
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;

    pending++;
    card.style.transformOrigin = 'top left';
    card.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')';
    card.style.transition = 'none';
    card.style.willChange = 'transform';

    (function(c) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          c.style.transition = 'transform 0.75s var(--ease-spring)';
          c.style.transform = 'translate(0, 0) scale(1, 1)';
        });
      });
    })(card);

    card.addEventListener('transitionend', function cleanup() {
      card.removeEventListener('transitionend', cleanup);
      card.style.transform = '';
      card.style.transition = '';
      card.style.willChange = '';
      card.style.transformOrigin = '';
      pending--;
      checkDone();
    }, { once: true });
  }

  // 无动画时异步回调
  if (pending === 0) {
    setTimeout(checkDone, 16);
  }
}

function buildExpandedHTML(widgetType, fullHTML, gridColumn, gridRow) {
  const closeBtn = '<button class="tb-expand-close" aria-label="关闭"><svg class="mi-svg" viewBox="0 0 24 24" width="20" height="20"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>';
  var parts = [];
  if (gridColumn) parts.push('grid-column:' + gridColumn);
  if (gridRow) parts.push('grid-row:' + gridRow);
  var styleAttr = parts.length > 0 ? ' style="' + parts.join(';') + '"' : '';
  return fullHTML.replace(
    '<div class="tb-card">',
    '<div class="tb-card tb-card--expanded" data-tb-widget="' + widgetType + '"' + styleAttr + '>' + closeBtn
  );
}

function collapseWidget(expandedCardEl, animate, onDone) {
  if (animate === void 0) animate = true;
  if (_isExpanding && animate) return;
  if (!expandedCardEl) return;

  var widgetType = expandedCardEl.dataset.tbWidget;
  if (!widgetType || !WIDGET_RENDERERS[widgetType]) return;

  var compactHTML = WIDGET_RENDERERS[widgetType].compact();

  if (!animate) {
    expandedCardEl.outerHTML = compactHTML;
    cleanupAfterCollapse();
    if (onDone) onDone();
    return;
  }

  _isExpanding = true;

  var grid = expandedCardEl.closest('.tb-grid');
  if (!grid) { _isExpanding = false; cleanupAfterCollapse(); if (onDone) onDone(); return; }

  var beforeMap = captureCardRects(grid);
  expandedCardEl.outerHTML = compactHTML;

  flipGridCards(grid, beforeMap, function() {
    _isExpanding = false;
    // 番茄钟运行时恢复紧凑预览倒计时
    if (widgetType === 'pomodoro') {
      var pState = loadPomodoroState();
      if (pState.running && pState.endAt) {
        updateCompactPomodoroPreview();
        _pomodoroCompactTimer = setInterval(updateCompactPomodoroPreview, 1000);
      }
    }
    if (onDone) onDone();
  });

  cleanupAfterCollapse();
}

function cleanupAfterCollapse() {
  _currentExpandedCard = null;
  if (_pomodoroCompactTimer) {
    clearInterval(_pomodoroCompactTimer);
    _pomodoroCompactTimer = null;
  }
}

var _pomodoroCompactTimer = null;

function updateCompactPomodoroPreview() {
  var card = document.querySelector('[data-tb-widget="pomodoro"].tb-card--compact');
  if (!card) {
    if (_pomodoroCompactTimer) { clearInterval(_pomodoroCompactTimer); _pomodoroCompactTimer = null; }
    return;
  }
  var state = loadPomodoroState();
  var previewEl = card.querySelector('.tb-card-preview');
  if (!previewEl) return;
  if (state.running && state.endAt) {
    var remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    if (remaining <= 0) {
      previewEl.textContent = '25 分钟专注计时';
      if (_pomodoroCompactTimer) { clearInterval(_pomodoroCompactTimer); _pomodoroCompactTimer = null; }
      return;
    }
    previewEl.textContent = '剩余 ' + pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60);
  } else {
    previewEl.textContent = '25 分钟专注计时';
    if (_pomodoroCompactTimer) { clearInterval(_pomodoroCompactTimer); _pomodoroCompactTimer = null; }
  }
}

function expandWidget(compactCardEl) {
  if (_isExpanding) return;
  if (!compactCardEl) return;

  var widgetType = compactCardEl.dataset.tbWidget;
  if (!widgetType || !WIDGET_RENDERERS[widgetType]) return;
  if (_currentExpandedCard && _currentExpandedCard.dataset.tbWidget === widgetType) return;

  // 先动画收起已展开的不同卡片，收完后自动展开新卡片
  if (_currentExpandedCard && _currentExpandedCard.dataset.tbWidget !== widgetType) {
    var targetWidget = widgetType;
    collapseWidget(_currentExpandedCard, true, function() {
      var targetCompact = document.querySelector('[data-tb-widget="' + targetWidget + '"].tb-card--compact');
      if (targetCompact) expandWidget(targetCompact);
    });
    return;
  }

  _isExpanding = true;

  var grid = compactCardEl.closest('.tb-grid');
  if (!grid) { _isExpanding = false; return; }

  var beforeMap = captureCardRects(grid);

  // 计算紧凑卡片在第几列（0=左, 1=中, 2=右），右侧卡片向左展开并锁定行
  var siblings = Array.from(grid.children);
  var idx = siblings.indexOf(compactCardEl);
  var col = idx % 3;
  var gridCol, gridRow;
  if (col === 2) {
    // 右列：向左跨 2 列，锁定在原行避免被中间卡片阻挡
    gridCol = '2 / 4';
    gridRow = (Math.floor(idx / 3) + 1) + ' / ' + (Math.floor(idx / 3) + 3);
  } else {
    gridCol = 'span 2';
    gridRow = null;
  }

  // 替换紧凑卡片为展开版
  var fullHTML = WIDGET_RENDERERS[widgetType].render();
  var expandedHTML = buildExpandedHTML(widgetType, fullHTML, gridCol, gridRow);
  compactCardEl.outerHTML = expandedHTML;

  // 绑定组件事件
  WIDGET_RENDERERS[widgetType].bind();
  if (widgetType === 'pomodoro') {
    var pState = loadPomodoroState();
    if (pState.running && pState.endAt) { startPomodoroTick(); }
  }

  // 停止紧凑番茄钟预览
  if (_pomodoroCompactTimer) {
    clearInterval(_pomodoroCompactTimer);
    _pomodoroCompactTimer = null;
  }

  // FLIP 动画 —— 展开卡片 + 周围卡片全部参与
  flipGridCards(grid, beforeMap, function() {
    _currentExpandedCard = grid.querySelector('[data-tb-widget="' + widgetType + '"].tb-card--expanded');
    _isExpanding = false;
    if (_currentExpandedCard) {
      _currentExpandedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function bindTreasureBoxGrid(container) {
  var grid = container.querySelector('.tb-grid');
  if (!grid) return;

  grid.addEventListener('click', function(e) {
    var closeBtn = e.target.closest('.tb-expand-close');
    if (closeBtn) {
      if (_currentExpandedCard) collapseWidget(_currentExpandedCard, true);
      return;
    }
    var compactCard = e.target.closest('.tb-card--compact');
    if (compactCard) { expandWidget(compactCard); }
  });
}

function bindDecideAll() {
  var decideCard = document.querySelector('.decision-tabs');
  if (decideCard) bindDecideTabs(decideCard);
  bindDecideActions();
}

function renderTreasureBox() {
  return '\n    <div class="page-header">\n      <h1 class="page-title" style="margin:0">\n        <svg class="mi-svg" viewBox="0 0 24 24" width="24" height="24" style="vertical-align:-5px;margin-right:4px"><path d="M21.18 4.35L18.28 2.5c-.55-.35-1.22-.35-1.77 0L13.7 3.93L9.83 1.7c-.55-.35-1.22-.35-1.77 0L2.82 4.35C2.32 4.62 2 5.15 2 5.71V18.3c0 .56.32 1.09.82 1.36l5.24 2.65c.55.28 1.22.28 1.77 0l3.87-2.23l3.87 2.23c.55.28 1.22.28 1.77 0l5.24-2.65c.5-.27.82-.8.82-1.36V5.71c0-.56-.32-1.09-.82-1.36zM12 16c-1.66 0-3-1.34-3-3s1.34-3 3-3s3 1.34 3 3s-1.34 3-3 3z"/></svg>\n        百宝箱\n      </h1>\n    </div>\n    <div class="tb-grid">\n      ' + renderPomodoroCompact() + '\n      ' + renderLuckCompact() + '\n      ' + renderDecideCompact() + '\n      ' + renderBlindBoxCompact() + '\n      ' + renderAnswerBookCompact() + '\n      ' + renderWoodenFishCompact() + '\n      ' + renderFishGuideCompact() + '\n      ' + renderFoodPickerCompact() + '\n    </div>\n  ';
}

function bindDecideTabs(container) {
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-decide]');
    if (!tab) return;

    const type = tab.dataset.decide;
    container.querySelectorAll('[data-decide]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const content = document.getElementById('decide-content');
    if (!content) return;

    // 平滑 crossfade 切换子内容
    content.style.transition = 'opacity 0.12s var(--ease-standard), transform 0.15s var(--ease-spring)';
    content.style.opacity = '0';
    content.style.transform = 'scale(0.96)';

    setTimeout(() => {
      if (type === 'coin') content.innerHTML = renderCoin();
      else if (type === 'dice') content.innerHTML = renderDice();
      else if (type === 'rand') content.innerHTML = renderRand();

      bindDecideActions();

      content.style.opacity = '1';
      content.style.transform = 'scale(1)';
    }, 120);
  });
}

function bindDecideActions() {
  document.getElementById('coin-flip-btn')?.addEventListener('click', flipCoin);
  document.getElementById('dice-roll-btn')?.addEventListener('click', rollDice);
  document.getElementById('rand-btn')?.addEventListener('click', generateRand);
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

registerPage('treasurebox', function(container) {
  _isExpanding = false;
  _currentExpandedCard = null;
  container.innerHTML = renderTreasureBox();
  setTimeout(function() {
    bindTreasureBoxGrid(container);
    var pState = loadPomodoroState();
    if (pState.running && pState.endAt) {
      startPomodoroTick();
      updateCompactPomodoroPreview();
      _pomodoroCompactTimer = setInterval(updateCompactPomodoroPreview, 1000);
    }
  }, 0);
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && _currentExpandedCard) {
    collapseWidget(_currentExpandedCard, true);
  }
});

export { renderTreasureBox };
