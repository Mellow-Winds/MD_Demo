/**
 * components/echo-cave.js — 回声洞侧栏底部小组件
 * 从后端随机获取语录，失败则用硬编码语录池；点击触发乱码打字机动画
 */

// 开发者语录池（后端不可用时兜底）
const FALLBACK_QUOTES = [
  '世界上最遥远的距离，不是生与死，而是你在写作业，我在写另一个作业。',
  '今天也是被DDL追着跑的一天呢。',
  '不要害怕慢，你只是在蓄力。',
  '如果学习让你感到痛苦，说明你正在走上坡路。',
  '你有多努力，就有多幸运。这不是鸡汤，是概率。',
  '代码跑通了就是对程序员最好的赞美。',
  '生活不止眼前的bug，还有远方的bug。',
  '没有什么是一杯奶茶解决不了的，如果有，那就两杯。',
  '做一个温柔的人，但不要做一个好欺负的人。',
  '别看了，快去学习。',
  '你以为你在摸鱼，其实鱼也在摸你。',
  '每个学霸背后，都有一个默默崩溃然后又默默振作的自己。',
  '休息是为了走更长的路，不是为了让路变短。',
  '成功不是终点，失败也不是末日，重要的是继续前进的勇气。',
  '学习不是为了考试，是为了在考试的时候不那么慌。'
];

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/';

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

/**
 * 分段吐出乱码 → 解码 → 下一段 → ... 直到完整文本
 * 每次处理 2~3 个字符：先逐字吐出乱码，再逐字解码为真实文字，然后进入下一段
 * @param {HTMLElement} el 文本容器
 * @param {string} text 目标文字
 * @param {function} onDone 完成回调
 */
function scrambleReveal(el, text, onDone) {
  if (!el || !text) return;
  const chars = [...text];
  const total = chars.length;
  const CHUNK = 3; // 每次处理最多 3 个字符

  el.textContent = '';

  let cursor = 0; // 已完全处理的字符数

  function processChunk() {
    if (cursor >= total) {
      el.textContent = text;
      if (onDone) onDone();
      return;
    }

    const chunkStart = cursor;
    const chunkEnd = Math.min(cursor + CHUNK, total);
    const chunkSize = chunkEnd - chunkStart;
    const chunkRandoms = Array.from({ length: chunkSize }, () => randomChar());

    // 构建显示字符串
    function buildDisplay(spawned, decoded) {
      const arr = [];
      for (let i = 0; i < total; i++) {
        if (i < chunkStart) {
          arr.push(chars[i]); // 之前的分段：已解码
        } else if (i < chunkEnd) {
          const ci = i - chunkStart;
          if (decoded > 0) {
            // 解码阶段：已解码的显示真实字，未解码的保持乱码
            arr.push(ci < decoded ? chars[chunkStart + ci] : chunkRandoms[ci]);
          } else {
            // 吐出阶段：已吐出的显示乱码，未吐出的空白
            arr.push(ci < spawned ? chunkRandoms[ci] : ' ');
          }
        } else {
          arr.push(' '); // 后续分段：空白
        }
      }
      return arr.join('');
    }

    // 阶段1：逐字吐出乱码
    let spawned = 0;
    const spawnTimer = setInterval(() => {
      spawned++;
      el.textContent = buildDisplay(spawned, 0);
      if (spawned >= chunkSize) {
        clearInterval(spawnTimer);
        // 阶段2：逐字解码
        decodeChunk();
      }
    }, 35);

    function decodeChunk() {
      let decoded = 0;
      const decodeTimer = setInterval(() => {
        decoded++;
        el.textContent = buildDisplay(chunkSize, decoded);
        if (decoded >= chunkSize) {
          clearInterval(decodeTimer);
          cursor = chunkEnd;
          // 段间短暂停顿，然后处理下一段
          setTimeout(processChunk, 60);
        }
      }, 30);
    }
  }

  processChunk();
}

/**
 * 获取一条语录（优先后端，失败用本地）
 */
async function fetchQuote() {
  try {
    const resp = await fetch('/api/echo-cave/random');
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.content) return data.content;
    }
  } catch { /* 网络错误，用兜底 */ }
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
}

let _echoCaveCooldown = false;

/**
 * 初始化回声洞
 */
export async function initEchoCave() {
  const card = document.querySelector('.echo-cave-card');
  const textEl = document.getElementById('echo-cave-text');
  if (!card || !textEl) return;

  // 初始加载
  const initialQuote = await fetchQuote();
  textEl.textContent = initialQuote;

  // 点击刷新
  card.addEventListener('click', async () => {
    if (_echoCaveCooldown) return;
    _echoCaveCooldown = true;

    const quote = await fetchQuote();
    scrambleReveal(textEl, quote, () => {
      _echoCaveCooldown = false;
    });

    // 超时保护（防止动画卡住导致永久冷却）
    setTimeout(() => { _echoCaveCooldown = false; }, 3000);
  });
}
