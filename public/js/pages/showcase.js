import {escapeHtml as esc, createMdInput, createMdSelect, createSwitch, initControls, openDialog, showToast, transitionElement, sanitizeRichHtml, reducedMotion} from '../components/design-controls.js';
import {overviewGallery, gallerySpecimens, galleryBehaviors, modeButtons} from './gallery.js?v=1';

const icons = {
overview:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
components:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
ugc:'<path d="M20 4c-3-3-7 0-8 2-1-2-5-5-8-2-5 5 8 16 8 16S25 9 20 4Z"/>',
docs:'<path d="M5 3h10l4 4v14H5Z M14 3v5h5M8 12h8M8 16h6"/>',
lab:'<path d="M9 3h6M10 3v7L4 19a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2l-6-9V3M7 15h10"/>',
arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
const btn = (text, attrs='', kind='secondary') => '<button type="button" class="btn '+kind+'" '+attrs+'>'+text+'</button>';
const intro = (_name,title,desc) => '<header class="page-heading"><h1 tabindex="-1">'+title+'</h1><p>'+desc+'</p></header>';
const defaults = () => ({title:'把想法，变成自己的表达',author:'创作者',body:'<p>这里没有固定的主题。写下一段文字，再用<strong>自己的方式</strong>呈现它。</p>',showAuthor:true,showCards:true,cards:[{id:crypto.randomUUID(),title:'留白，也是表达',body:'标题、文字与形状，由你决定。',variant:'描边'}]});
let draft = defaults(), ugcTab = 'post', componentId = 'buttons', currentPage = '', currentChapter = 0, chapters = null, routeVersion = 0, savedRange = null;
const MATERIAL_MODE_KEY = 'design-demo-material-mode';
const materialModes = {
 default: {label:'普通卡片', description:'实色表面、清晰边界，展示基础设计语言。'},
 enhanced: {label:'更好的卡片', description:'不透光的卡片、明确的边界，以及更稳定的层级。'},
 'liquid-glass': {label:'液态玻璃', description:'背景参与层次，卡片保持模糊、高光与可读性。'}
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrapHue = value => ((value % 360) + 360) % 360;
const randomBetween = (min, max) => min + Math.random() * (max - min);
function hexToHsl(value) {
 let hex=String(value||'').trim().replace(/^#/,'');
 if(hex.length===3)hex=hex.split('').map(part=>part+part).join('');
 if(!/^[0-9a-f]{6}$/i.test(hex))return {h:204,s:87,l:48};
 const red=parseInt(hex.slice(0,2),16)/255,green=parseInt(hex.slice(2,4),16)/255,blue=parseInt(hex.slice(4,6),16)/255;
 const max=Math.max(red,green,blue),min=Math.min(red,green,blue),lightness=(max+min)/2;
 if(max===min)return {h:0,s:0,l:lightness*100};
 const delta=max-min,saturation=lightness>.5?delta/(2-max-min):delta/(max+min);
 let hue;
 switch(max){
  case red:hue=(green-blue)/delta+(green<blue?6:0);break;
  case green:hue=(blue-red)/delta+2;break;
  default:hue=(red-green)/delta+4;
 }
 return {h:hue*60,s:saturation*100,l:lightness*100};
}
const pastelHsl = (hue,saturation,lightness) => 'hsl('+Math.round(wrapHue(hue))+' '+Math.round(clamp(saturation,36,74))+'% '+Math.round(clamp(lightness,89,98))+'%)';
function createLiquidGradient(themeColor) {
 const {h,s}=hexToHsl(themeColor),baseHue=wrapHue(h+randomBetween(-12,12)),saturation=clamp(42+s*.25,42,68);
 return {
  angle:Math.round(randomBetween(112,248))+'deg',
  a:pastelHsl(baseHue+randomBetween(-26,-4),saturation+randomBetween(-6,4),randomBetween(93,97)),
  b:pastelHsl(baseHue+randomBetween(-6,22),saturation+randomBetween(-4,8),randomBetween(91,95)),
  c:pastelHsl(baseHue+randomBetween(14,42),saturation+randomBetween(-5,5),randomBetween(93,97))
 };
}
function paintLiquidBackground() {
 const themeColor=getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()||'#4A90D9';
 const {angle,a,b,c}=createLiquidGradient(themeColor);
 document.body.style.backgroundImage=[
  'radial-gradient(circle at 88% 10%, color-mix(in srgb, '+c+' 76%, transparent), transparent 58%)',
  'radial-gradient(circle at 10% 88%, color-mix(in srgb, '+a+' 70%, transparent), transparent 60%)',
  'linear-gradient('+angle+', '+a+', '+b+' 52%, '+c+')'
 ].join(', ');
 document.body.style.backgroundAttachment='fixed';
}
function applyMaterialMode(mode, {persist = true, randomize = true} = {}) {
 const next = Object.hasOwn(materialModes, mode) ? mode : 'default';
 document.body.dataset.materialMode = next;
 if (next === 'liquid-glass' && randomize) {
  paintLiquidBackground();
 } else if (next !== 'liquid-glass') {
  document.body.style.removeProperty('background-image');
  document.body.style.removeProperty('background-attachment');
 }
 document.querySelectorAll('button[data-material-mode]').forEach(button => {
  const active = button.dataset.materialMode === next;
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
 });
 document.querySelectorAll('[data-material-mode-value]').forEach(node => { node.textContent = materialModes[next].label; });
 document.querySelectorAll('[data-material-mode-description]').forEach(node => { node.textContent = materialModes[next].description; });
 if (persist) {
  try { localStorage.setItem(MATERIAL_MODE_KEY, next); } catch {}
 }
}
function initMaterialModes() {
 let mode = 'default';
 try {
  const saved = localStorage.getItem(MATERIAL_MODE_KEY);
  if (saved && Object.hasOwn(materialModes, saved)) mode = saved;
 } catch {}
 applyMaterialMode(mode, {persist:false});
}
try {
 const saved=JSON.parse(localStorage.getItem('design-demo-draft'));
 if(saved && typeof saved.title==='string' && typeof saved.body==='string' && Array.isArray(saved.cards)) draft={...draft,...saved,cards:saved.cards.filter(c=>c && typeof c.title==='string' && typeof c.body==='string').map(c=>({...c,id:crypto.randomUUID(),variant:['描边','填充'].includes(c.variant)?c.variant:'描边'}))};
} catch {}
const specimens = gallerySpecimens;
let specimenMarkup = '';
function overview() { return overviewGallery(); }
function renderCode(text, language='html') {
 return window.markdownit({html:false}).render('\n~~~'+language+'\n'+text+'\n~~~');
}
function components() {
 const active=specimens.find(s=>s.id===componentId)||specimens[0];
 const markup=specimenMarkup=active.html();
 return '<nav class="component-switcher portal-tabs" aria-label="模块目录">'+specimens.map(s=>'<button type="button" class="component-switch" data-component-tab="'+s.id+'" aria-selected="'+(s===active)+'">'+s.name+'</button>').join('')+'</nav>'+modeButtons()+
 '<section class="specimen active-specimen" id="'+active.id+'"><div class="specimen-stage">'+markup+'</div></section>'+
 '<section class="code-card" data-specimen="'+active.id+'"><div class="code-tools">'+['结构','样式','交互'].map((t,i)=>btn(t,'data-code="'+i+'" aria-pressed="'+(!i)+'"','demo-dark')).join('')+btn('复制代码','data-copy-code','demo-light')+btn('下载示例','data-download="'+active.id+'"','demo-light')+'</div><div class="rendered-code">'+renderCode(markup)+'</div></section>';
}
function cardHtml(c) {return '<article class="content-card '+(c.variant==='填充'?'filled':'')+'"><h3>'+esc(c.title||'未命名卡片')+'</h3><p>'+esc(c.body)+'</p></article>';}
function previewHtml() {
 return '<article class="post-preview">'+(draft.showAuthor?'<div class="author"><span class="avatar" aria-hidden="true">'+esc((draft.author||'创作者').slice(0,1))+'</span><span>'+esc(draft.author||'创作者')+'</span></div>':'')+'<h2>'+esc(draft.title||'未命名内容')+'</h2><div class="rich-body">'+sanitizeRichHtml(draft.body)+'</div>'+(draft.showCards?'<div class="preview-cards">'+draft.cards.map(cardHtml).join('')+'</div>':'')+'</article>';
}
function ugc() {
 return '<div class="workbench"><section class="editor-column"><div class="page-switcher portal-tabs" role="tablist" aria-label="编辑模式">'+[['post','帖子'],['cards','卡片']].map(([v,t])=>'<button type="button" role="tab" id="ugc-tab-'+v+'" aria-controls="ugc-panel" aria-selected="'+(ugcTab===v)+'" tabindex="'+(ugcTab===v?0:-1)+'" data-ugc-tab="'+v+'">'+t+'</button>').join('')+'</div><div id="ugc-panel" role="tabpanel" aria-labelledby="ugc-tab-'+ugcTab+'">'+ugcPanel()+'</div></section><aside class="preview-column"><div class="section-heading"><h2>预览</h2></div><div id="live-preview">'+previewHtml()+'</div><div class="editor-actions row">'+btn('保存到本机','data-save','demo-dark')+btn('导出内容','data-export','demo-light')+btn('重置','data-reset','demo-light')+'</div><p id="draft-status" class="sr-only" role="status"></p></aside></div>';
}
function ugcPanel() {
 if(ugcTab==='cards') return '<div class="panel-heading"><h2>组织你的卡片</h2>'+btn('添加卡片','data-add-card','primary')+'</div><div class="card-editors">'+draft.cards.map((c,i)=>'<section class="card-editor" data-card-id="'+c.id+'">'+createMdInput({id:'card-title-'+c.id,label:'卡片标题',value:c.title,attrs:'data-card-field="title"'})+createMdInput({id:'card-body-'+c.id,label:'卡片正文',value:c.body,multiline:true,attrs:'data-card-field="body"'})+createMdSelect({id:'card-style-'+c.id,label:'容器样式',options:['描边','填充'],selected:c.variant})+'<div class="row">'+btn('上移','data-move="-1"'+(!i?' disabled':''),'text')+btn('下移','data-move="1"'+(i===draft.cards.length-1?' disabled':''),'text')+btn('移除','data-remove-card','text')+'</div></section>').join('')+'</div>'+(draft.cards.length?'':'<p class="empty-state">还没有卡片。添加一个空白容器，开始自己的表达。</p>');
 return '<div class="post-editor">'+createMdInput({id:'post-title',label:'标题',value:draft.title})+createMdInput({id:'post-author',label:'署名',value:draft.author})+'<div class="rich-editor"><div class="rich-toolbar" role="toolbar" aria-label="文字格式">'+[['strong','加粗','<b>B</b>'],['em','斜体','<i>I</i>'],['u','下划线','<u>U</u>'],['list','列表','列表'],['link','链接','链接'],['image','图片','图片']].map(([a,b,c])=>btn(c,'data-format="'+a+'" aria-label="'+b+'"','tool-button')).join('')+'</div><label class="editor-label" id="body-label">正文</label><div id="post-body" class="editable rich-body" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="body-label">'+sanitizeRichHtml(draft.body)+'</div><input type="file" id="image-file" accept="image/png,image/jpeg,image/webp" hidden></div>'+createSwitch('显示署名',{id:'show-author',checked:draft.showAuthor})+createSwitch('显示卡片',{id:'show-cards',checked:draft.showCards})+'</div>';
}
async function docs() {
 if(!chapters){
  const response=await fetch('/showcase/design.md'); if(!response.ok) throw Error('规范加载失败');
  const raw=await response.text(), matches=[...raw.matchAll(/^## (.+)$/gm)];
  chapters=matches.map((m,i)=>({title:m[1],content:raw.slice(m.index,matches[i+1]?.index??raw.length)}));
 }
 currentChapter=Math.min(Math.max(currentChapter,0),chapters.length-1);
 return ''+
 '<div class="docs-layout"><nav class="chapter-nav" aria-label="章节目录"><div class="section-heading"><h2>章节目录</h2><span>'+chapters.length+' 个章节</span></div>'+chapters.map((c,i)=>'<button type="button" data-chapter="'+i+'" aria-current="'+(i===currentChapter?'location':'false')+'">'+esc(c.title.replace(/^\d+\.\s*/,''))+'</button>').join('')+'</nav><div id="chapter-content">'+chapterHtml()+'</div></div>';
}
function chapterHtml() {
 const md=window.markdownit({html:false,linkify:false,typographer:false});
 const body=md.render(chapters[currentChapter].content);
 return '<article class="prose">'+body+'</article><nav class="chapter-pager" aria-label="章节翻页">'+btn('上一章','data-chapter="'+(currentChapter-1)+'"'+(!currentChapter?' disabled':''))+btn('下一章','data-chapter="'+(currentChapter+1)+'"'+(currentChapter===chapters.length-1?' disabled':''))+'</nav>';
}
const renderers={overview,components,ugc,docs};
let disposePage = () => {};
export function parseRoute(hash) {
 const [candidate,anchor='']=hash.replace(/^#/,'').split('/');
 return {page:Object.hasOwn(renderers,candidate)?candidate:'overview',anchor};
}
async function navigate() {
 const version=++routeVersion, {page,anchor}=parseRoute(location.hash), root=document.getElementById('showcase-root');
 if(page==='docs') currentChapter=/^\d+$/.test(anchor)?Number(anchor):0;
 if(page==='components' && anchor) componentId=anchor;
 if(page===currentPage && page==='components') {
  root.innerHTML=components();
  document.dispatchEvent(new Event('gallery-render'));applyMaterialMode(document.body.dataset.materialMode,{persist:false,randomize:false});
  document.getElementById('main-content').scrollTop=0;
  await transitionElement(root.querySelector('.active-specimen'));
  return;
 }
 if(page===currentPage && page==='docs' && chapters){
  currentChapter=Math.min(currentChapter,chapters.length-1);
  const main=document.getElementById('main-content'), scrollTop=main.scrollTop;
  document.getElementById('chapter-content').innerHTML=chapterHtml();
  main.scrollTop=scrollTop;
  document.querySelectorAll('[data-chapter]').forEach(b=>{if(b.closest('.chapter-nav'))b.setAttribute('aria-current',Number(b.dataset.chapter)===currentChapter?'location':'false');});
  await transitionElement(document.getElementById('chapter-content'));
  main.scrollTop=scrollTop;
  return;
 }
 await transitionElement(root,false); if(version!==routeVersion)return;
 try {
  const html=await renderers[page](); if(version!==routeVersion)return;
  disposePage();disposePage=()=>{};
  root.innerHTML=html; currentPage=page; document.getElementById('main-content').scrollTop=0;
  document.dispatchEvent(new Event('gallery-render'));applyMaterialMode(document.body.dataset.materialMode,{persist:false,randomize:false});
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page); if(b.closest('nav')) b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
  root.querySelector('h1')?.focus({preventScroll:true});
  await transitionElement(root); if(version!==routeVersion)return;
  if(page==='components'&&anchor)document.querySelector('.active-specimen')?.focus({preventScroll:true});
 } catch(e) {disposePage();disposePage=()=>{};root.innerHTML='<div class="empty-state"><h1>暂时无法加载</h1><p>'+esc(e.message)+'</p>'+btn('重试','data-retry')+'</div>';currentPage='';}
}
function go(page,anchor='') {
 const hash='#'+page+(anchor?'/'+anchor:'');
 if(location.hash===hash)navigate();else location.hash=hash;
}
function refreshPreview(){document.getElementById('live-preview')?.replaceChildren();const p=document.getElementById('live-preview');if(p)p.innerHTML=previewHtml();}
function refreshPanel(){
 const p=document.getElementById('ugc-panel');p.innerHTML=ugcPanel();p.setAttribute('aria-labelledby','ugc-tab-'+ugcTab);refreshPreview();
 transitionElement(p);
}
function captureRange() {
 const editor=document.getElementById('post-body'), selection=getSelection();
 if(editor&&selection.rangeCount&&editor.contains(selection.getRangeAt(0).commonAncestorContainer))savedRange=selection.getRangeAt(0).cloneRange();
}
function insertFormat(tag,attrs={}) {
 const editor=document.getElementById('post-body'); if(!editor)return;
 editor.focus();
 let range=savedRange;
 if(!range||!editor.contains(range.commonAncestorContainer)){range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}
 if(range.collapsed && tag!=='img'){showToast('请先选中需要设置格式的文字');return;}
 const node=document.createElement(tag==='list'?'ul':tag);
 Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));
 if(tag==='list'){const li=document.createElement('li');li.append(range.extractContents());node.append(li);}
 else if(tag!=='img')node.append(range.extractContents());
 range.insertNode(node);range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);savedRange=range.cloneRange();
 draft.body=sanitizeRichHtml(editor.innerHTML);refreshPreview();
}
let assetsPromise;
async function codeAssets(){return assetsPromise??=Promise.all(['/css/style.css','/css/material-modes.css','/css/gallery.css','/js/components/design-controls.js'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('示例依赖加载失败');return r.text();})).then(([base,material,gallery,js])=>[base+'\n'+material+'\n'+gallery,js+'\n'+galleryBehaviors.toString()]);}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function standalone(s) {
 const [css,js]=await codeAssets();
 return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+s.name+'</title><style>'+css+'body{display:block;overflow:auto;padding:24px}body>.specimen{max-width:960px;margin:auto}</style><body data-material-mode="'+document.body.dataset.materialMode+'"><section class="specimen">'+(specimenMarkup||s.html())+'</section><script type="module">'+js+'\ninitControls();\ngalleryBehaviors(document);<\/script></body></html>';
}
export function initShowcase(){
 initMaterialModes();initControls();galleryBehaviors(document);
 document.querySelectorAll('.nav-icon').forEach(el=>el.innerHTML=icon(el.closest('[data-page]').dataset.page));
 document.addEventListener('selectionchange',captureRange);
 document.addEventListener('keydown',e=>{
  const tab=e.target.closest('[data-ugc-tab]');
  if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const tabs=[...tab.parentElement.querySelectorAll('[data-ugc-tab]')],i=tabs.indexOf(tab);
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();tabs[next].click();
 });
 document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-format]')){captureRange();e.preventDefault();}});
 document.addEventListener('click',async e=>{
 const target=e.target;
  const materialButton=target.closest('button[data-material-mode]');
  if(materialButton){applyMaterialMode(materialButton.dataset.materialMode);if(currentPage==='components'&&componentId==='cards')navigate();return;}
  if(target.closest('[data-page]')){go(target.closest('[data-page]').dataset.page);return;}
  if(target.closest('[data-component-tab]')){go('components',target.closest('[data-component-tab]').dataset.componentTab);return;}
  if(target.closest('[data-chapter]')){go('docs',target.closest('[data-chapter]').dataset.chapter);return;}
  if(target.closest('[data-retry]'))navigate();
  const tab=target.closest('[data-ugc-tab]');
  if(tab){ugcTab=tab.dataset.ugcTab;tab.parentElement.querySelectorAll('[role="tab"]').forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;});refreshPanel();}
  const format=target.closest('[data-format]')?.dataset.format;
  if(format==='link')openDialog('插入链接',createMdInput({id:'link-url',label:'网页地址',type:'url',attrs:'required'}),{onSubmit:d=>{const href=d.querySelector('input').value;if(!/^https?:\/\//i.test(href)){showToast('请输入完整的网页地址');return false;}insertFormat('a',{href,rel:'noopener noreferrer'});}});
  else if(format==='image')document.getElementById('image-file').click();
  else if(format)insertFormat(format);
  if(target.closest('[data-save]')){try{localStorage.setItem('design-demo-draft',JSON.stringify(draft));document.getElementById('draft-status').textContent='已保存到此浏览器；刷新后可继续编辑。';showToast('内容已保存');}catch{showToast('存储空间不足，请导出内容保存');}}
  if(target.closest('[data-export]'))download('自定义内容.json',JSON.stringify({...draft,body:sanitizeRichHtml(draft.body)},null,2),'application/json');
  if(target.closest('[data-reset]'))openDialog('重置当前内容','<p>此操作会清空本机草稿并恢复初始示例。你可以先取消并导出内容。</p>',{onSubmit:()=>{draft=defaults();try{localStorage.removeItem('design-demo-draft');}catch{}refreshPanel();}});
  if(target.closest('[data-add-card]')){draft.cards.push({id:crypto.randomUUID(),title:'',body:'',variant:'描边'});refreshPanel();document.querySelector('.card-editor:last-child input')?.focus();}
  const card=target.closest('[data-card-id]');
  if(card&&target.closest('[data-move]')){const i=draft.cards.findIndex(c=>c.id===card.dataset.cardId),j=i+Number(target.closest('[data-move]').dataset.move);if(j>=0&&j<draft.cards.length){[draft.cards[i],draft.cards[j]]=[draft.cards[j],draft.cards[i]];refreshPanel();document.querySelector('[data-card-id="'+card.dataset.cardId+'"] input')?.focus();}}
  if(card&&target.closest('[data-remove-card]')){draft.cards=draft.cards.filter(c=>c.id!==card.dataset.cardId);refreshPanel();document.querySelector('[data-add-card]')?.focus();}
  try{
   const code=target.closest('[data-code]');
   if(code){const box=code.closest('.code-card'),s=specimens.find(s=>s.id===box.dataset.specimen),i=Number(code.dataset.code),assets=i?await codeAssets():[];box.querySelector('.rendered-code').innerHTML=renderCode(i===0?specimenMarkup:assets[i-1],['html','css','javascript'][i]);box.querySelectorAll('[data-code]').forEach(b=>b.setAttribute('aria-pressed',String(b===code)));}
   if(target.closest('[data-copy-code]')){await navigator.clipboard.writeText(target.closest('.code-card').querySelector('code').textContent);showToast('代码已复制');}
   const dl=target.closest('[data-download]');
   if(dl)download(dl.dataset.download+'.html',await standalone(specimens.find(s=>s.id===dl.dataset.download)),'text/html');
  }catch{showToast('操作未完成，请重试或下载完整示例');}
 });
 document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='post-title')draft.title=t.value;
  if(t.id==='post-author')draft.author=t.value;
  if(t.id==='post-body')draft.body=sanitizeRichHtml(t.innerHTML);
  if(t.dataset.cardField){const c=draft.cards.find(c=>c.id===t.closest('[data-card-id]').dataset.cardId);c[t.dataset.cardField]=t.value;}
  if(t.id==='show-author')draft.showAuthor=t.checked;
  if(t.id==='show-cards')draft.showCards=t.checked;
  if(currentPage==='ugc')refreshPreview();
 });
 document.addEventListener('select-change',e=>{const card=e.target.closest('[data-card-id]');if(card){draft.cards.find(c=>c.id===card.dataset.cardId).variant=e.detail.value;refreshPreview();}});
 document.addEventListener('paste',e=>{if(e.target.id!=='post-body')return;e.preventDefault();const text=e.clipboardData.getData('text/plain');captureRange();const selection=getSelection();if(selection.rangeCount){const range=selection.getRangeAt(0);range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);draft.body=sanitizeRichHtml(e.target.innerHTML);refreshPreview();}});
 document.addEventListener('change',e=>{if(e.target.id!=='image-file')return;const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){showToast('请选择两兆字节以内的常用格式图片');return;}const reader=new FileReader();reader.onload=()=>insertFormat('img',{src:reader.result,alt:file.name});reader.readAsDataURL(file);});
 addEventListener('hashchange',navigate);navigate();
}
