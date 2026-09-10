/**
 * Shared, standalone MD3 controls. No backend, globals or page dependencies.
 * Copy this module with style.css and the generated HTML to reuse a specimen.
 */
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function createMdInput({id, label, value = '', type = 'text', multiline = false, disabled = false, error = '', attrs = ''}) {
  const safe = escapeHtml;
  attrs += (error ? ' aria-invalid="true" aria-describedby="' + id + '-error"' : '');
  return '<div class="field-wrap"><div class="md-field' + (error ? ' is-error' : '') + '">' +
    (multiline
      ? '<textarea id="' + id + '" placeholder=" " rows="4" ' + attrs + (disabled ? ' disabled' : '') + '>' + safe(value) + '</textarea>'
      : '<input id="' + id + '" type="' + type + '" value="' + safe(value) + '" placeholder=" " ' + attrs + (disabled ? ' disabled' : '') + '>') +
    '<label for="' + id + '">' + safe(label) + '</label><fieldset aria-hidden="true"><legend><span>' + safe(label) +
    '</span></legend></fieldset></div>' + (error ? '<small id="' + id + '-error">! ' + safe(error) + '</small>' : '') + '</div>';
}

export function createMdSelect({id, label, options, selected = options[0]}) {
  return '<div class="md-select"><span id="' + id + '-label" class="field-caption">' + escapeHtml(label) + '</span>' +
    '<button type="button" id="' + id + '" class="select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' + id + '-label ' + id + '-value" aria-controls="' + id + '-menu">' +
    '<span id="' + id + '-value" data-select-value>' + escapeHtml(selected) + '</span><svg class="select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
    '<ul id="' + id + '-menu" class="select-menu" role="listbox" aria-labelledby="' + id + '-label" hidden>' +
    options.map(v => '<li role="option" tabindex="-1" aria-selected="' + (v === selected) + '">' + escapeHtml(v) + '</li>').join('') +
    '</ul></div>';
}

export function createSwitch(label, {id = '', checked = false, disabled = false} = {}) {
  return '<label class="switch-row"><span>' + escapeHtml(label) + '</span><input type="checkbox" role="switch" id="' + id +
    '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '><span class="switch-track" aria-hidden="true"><i></i></span></label>';
}

export function reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

export async function transitionElement(el, entering = true) {
  if (!el || reducedMotion() || el.closest?.('[data-still="true"]') || el.querySelector?.('.lab-page[data-still="true"]')) return;
  let animation;
  try {
    animation = el.animate(entering ? [{opacity: 0, transform:'translateY(12px)'},{opacity:1,transform:'none'}] :
      [{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-8px)'}],
      {duration: entering ? 280 : 140, easing: entering ? 'cubic-bezier(.2,0,0,1)' : 'ease-in'});
    await animation.finished;
  } catch {} finally {
    animation?.cancel();
    el.style.opacity = '1';
    el.style.transform = 'none';
    const pointerEvents = el.style.pointerEvents;
    el.style.pointerEvents = 'none';
    void el.offsetHeight;
    el.style.pointerEvents = pointerEvents;
  }
}

let toastTimer;
export function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = message;
  const close = document.createElement('button');
  close.className = 'icon-button'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label','关闭提示');
  close.onclick = () => toast.remove();
  toast.append(text, close); document.body.append(toast);
  transitionElement(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 2500);
}

/** Native dialog supplies focus containment, inert background and Escape behavior. */
export function openDialog(title, html, {sheet = false, onSubmit} = {}) {
  const previousDialog = document.querySelector('dialog');
  const originalOverflow = previousDialog?.dataset.previousOverflow ?? document.body.style.overflow;
  previousDialog?.close();
  previousDialog?.remove();
  const returnFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = sheet ? 'demo-dialog sheet' : 'demo-dialog';
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.innerHTML = '<form><header><h2 id="dialog-title">' + escapeHtml(title) +
    '</h2><button type="button" class="icon-button" data-close aria-label="关闭弹窗">×</button></header><div class="dialog-body">' +
    html + '</div><footer><button type="button" class="btn secondary" data-close>取消</button>' +
    '<button type="submit" class="btn primary">确认</button></footer></form>';
  const prevOverflow = originalOverflow;
  dialog.dataset.previousOverflow = prevOverflow;
  document.body.style.overflow = 'hidden';
  let closing = false;
  const dismiss = async () => {
    if (closing) return;
    closing = true;
    if (!reducedMotion() && dialog.dataset.still !== 'true') {
      try { await dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:sheet?'translateY(32px)':'translateY(12px)'}],{duration:140,easing:'ease-in',fill:'forwards'}).finished; } catch {}
    }
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener('cancel', e => { e.preventDefault(); dismiss(); });
  dialog.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) dismiss();
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dismiss();
    }
  });
  dialog.querySelector('form').onsubmit = e => {
    e.preventDefault();
    if (closing) return;
    if (onSubmit?.(dialog) === false) return;
    dismiss();
  };
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (!document.querySelector('dialog[open]')) {
      document.body.style.overflow = prevOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    }
  }, {once:true});
  document.body.append(dialog); dialog.showModal();
  transitionElement(dialog);
  return dialog;
}

export function closeSelects(except) {
  document.querySelectorAll('.md-select').forEach(box => {
    if (box === except) return;
    box.querySelector('.select-menu').hidden = true;
    box.querySelector('.select-trigger').setAttribute('aria-expanded','false');
  });
}

export function initControls(root = document) {
  const abort = new AbortController();
  const options = {signal:abort.signal};
  function rippleAt(e) {
    const button=e.target.closest('button, [data-ripple]');
    if(!button || button.disabled || reducedMotion() || button.closest('[data-still="true"]')) return;
    button.querySelectorAll('.ripple').forEach(n=>n.remove());
    const r=button.getBoundingClientRect(),size=Math.min(160,Math.max(r.width,r.height)*1.4);
    const x=e.detail===0 && e.type==='click'?r.width/2:e.clientX-r.left;
    const y=e.detail===0 && e.type==='click'?r.height/2:e.clientY-r.top;
    const ripple=document.createElement('span');ripple.className='ripple';
    Object.assign(ripple.style,{width:size+'px',height:size+'px',left:x-size/2+'px',top:y-size/2+'px'});
    button.append(ripple);
    ripple.animate([{transform:'scale(0)',opacity:.12},{transform:'scale(1)',opacity:0}],{duration:360,easing:'cubic-bezier(.2,0,0,1)'}).finished.finally(()=>ripple.remove());
  }
  root.addEventListener('pointerdown',e=>{if(e.button===0)rippleAt(e);},options);
  root.addEventListener('click', e => {
    if(e.detail===0)rippleAt(e);
    const trigger = e.target.closest('.select-trigger');
    if (trigger) {
      const box = trigger.closest('.md-select'), menu = box.querySelector('.select-menu');
      const opening = menu.hidden;
      closeSelects(box); menu.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
      if (opening) {
        transitionElement(menu);
        menu.querySelector('[aria-selected="true"]')?.focus();
      }
      return;
    }
    const option = e.target.closest('.select-menu [role="option"]');
    if (option) {
      const box = option.closest('.md-select');
      box.querySelectorAll('[role="option"]').forEach(v => v.setAttribute('aria-selected',String(v === option)));
      box.querySelector('[data-select-value]').textContent = option.textContent;
      closeSelects(); box.querySelector('button').focus();
      box.dispatchEvent(new CustomEvent('select-change',{bubbles:true,detail:{value:option.textContent}}));
      return;
    }
    if (!e.target.closest('.md-select')) closeSelects();
    const modal = e.target.closest('[data-demo-dialog]');
    if (modal) openDialog('操作确认','<p>确认后将显示操作反馈。</p>',{onSubmit:() => showToast('已确认')});
    if (e.target.closest('[data-demo-sheet]')) openDialog('底部操作菜单','<p>操作保持清晰，取消始终可用。</p>',{sheet:true});
    if (e.target.closest('[data-demo-toast]')) showToast('操作已完成');
    if (e.target.closest('[data-demo-card]')) openDialog('卡片详情','<p>标题、正文与操作使用相同的间距和颜色。</p>');
  },options);
  root.addEventListener('keydown',e => {
    const box = e.target.closest('.md-select');
    if (!box) return;
    const menu = box.querySelector('.select-menu'), trigger = box.querySelector('.select-trigger');
    const items = [...menu.querySelectorAll('[role="option"]')];
    if (e.key === 'Escape') {closeSelects();trigger.focus();e.preventDefault();}
    if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
      e.preventDefault(); closeSelects(box); menu.hidden = false; trigger.setAttribute('aria-expanded','true');
      let i = items.indexOf(document.activeElement);
      i = e.key === 'Home' ? 0 : e.key === 'End' ? items.length-1 : (i + (e.key === 'ArrowDown' ? 1 : -1)+items.length)%items.length;
      items[i].focus();
    }
    if (['Enter',' '].includes(e.key) && e.target.matches('[role="option"]')) {e.preventDefault();e.target.click();}
    if (e.key === 'Tab') closeSelects();
  },options);
  return () => abort.abort();
}

export function sanitizeRichHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowed = new Set(['P','BR','STRONG','B','EM','I','U','UL','OL','LI','BLOCKQUOTE','A','IMG','DIV']);
  const walk = parent => {
    [...parent.children].forEach(node => {
      if (['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName)) {node.remove();return;}
      walk(node);
      if (!allowed.has(node.tagName)) {node.replaceWith(...node.childNodes);return;}
      const href = node.getAttribute('href'), src = node.getAttribute('src'), alt = node.getAttribute('alt');
      [...node.attributes].forEach(a=>node.removeAttribute(a.name));
      if (node.tagName === 'A' && /^https?:\/\//i.test(href || '')) {node.setAttribute('href',href);node.setAttribute('rel','noopener noreferrer');}
      if (node.tagName === 'IMG') {
        if (/^data:image\/(png|jpeg|webp);base64,/i.test(src || '')) {node.setAttribute('src',src);node.setAttribute('alt',alt || '用户图片');}
        else node.remove();
      }
    });
  };
  walk(template.content);
  return template.innerHTML;
}
