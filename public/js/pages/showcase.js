import {escapeHtml as esc, createMdInput, createMdSelect, createSwitch, initControls, openDialog, showToast, transitionElement, sanitizeRichHtml, reducedMotion} from '../components/design-controls.js';

const icons = {
overview:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
components:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
ugc:'<path d="M20 4c-3-3-7 0-8 2-1-2-5-5-8-2-5 5 8 16 8 16S25 9 20 4Z"/>',
docs:'<path d="M5 3h10l4 4v14H5Z M14 3v5h5M8 12h8M8 16h6"/>',
arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
const btn = (text, attrs='', kind='secondary') => '<button type="button" class="btn '+kind+'" '+attrs+'>'+text+'</button>';
const intro = (name,title,desc) => '<header class="page-heading"><p class="eyebrow">'+name+'</p><h1 tabindex="-1">'+title+'</h1><p>'+desc+'</p></header>';
const defaults = () => ({title:'把想法，变成自己的表达',author:'创作者',body:'<p>这里没有固定的主题。写下一段文字，再用<strong>自己的方式</strong>呈现它。</p>',showAuthor:true,showCards:true,cards:[{id:crypto.randomUUID(),title:'留白，也是表达',body:'标题、文字与形状，由你决定。',variant:'描边'}]});
let draft = defaults(), ugcTab = 'post', currentPage = '', currentChapter = 0, chapters = null, routeVersion = 0, savedRange = null;
try {
 const saved=JSON.parse(localStorage.getItem('design-demo-draft'));
 if(saved && typeof saved.title==='string' && typeof saved.body==='string' && Array.isArray(saved.cards)) draft={...draft,...saved,cards:saved.cards.filter(c=>c && typeof c.title==='string' && typeof c.body==='string').map(c=>({...c,id:crypto.randomUUID(),variant:['描边','填充'].includes(c.variant)?c.variant:'描边'}))};
} catch {}
const specimens = [
 {id:'buttons',name:'按钮与涟漪',desc:'操作层级清晰；点击时，从触点展开反馈。',html:()=>'<div class="row">'+btn('保存变更','data-demo-toast','primary')+btn('添加内容','data-demo-dialog')+btn('取消','data-demo-toast','text')+btn('···','data-demo-sheet aria-label="更多操作"','icon-button')+'</div><div class="state-row"><span>禁用状态</span>'+btn('已完成','disabled','primary')+'<span class="badge">可用</span><span class="badge outlined">已关闭</span><span class="badge outlined">! 需检查</span></div>'},
 {id:'fields',name:'输入框',desc:'完整描边与浮动标签。错误通过文字与边框表达，不增加颜色。',html:()=>'<div class="grid two">'+createMdInput({id:'sample-title',label:'标题'})+createMdInput({id:'sample-value',label:'已填写',value:'一段自由的表达'})+createMdInput({id:'sample-disabled',label:'不可编辑',value:'禁用状态',disabled:true})+createMdInput({id:'sample-error',label:'需要检查',error:'请填写完整内容'})+'</div>'+createMdInput({id:'sample-description',label:'描述',multiline:true})},
 {id:'selects',name:'下拉菜单',desc:'支持方向键、首尾跳转、回车选择、退出键和点击外部关闭。',html:()=>'<div class="grid two">'+createMdSelect({id:'sample-select',label:'呈现方式',options:['描边','填充','留白']})+createMdSelect({id:'sample-density',label:'内容密度',options:['舒展','紧凑']})+'</div>'},
 {id:'switches',name:'开关与切换',desc:'状态、焦点和点击反馈同样重要。按空格切换开关。',html:()=>'<div class="grid two">'+createSwitch('启用反馈',{id:'sample-switch',checked:true})+createSwitch('显示辅助信息',{id:'sample-switch-off'})+createSwitch('已锁定',{id:'sample-switch-disabled',checked:true,disabled:true})+'</div><div class="segmented" role="tablist" aria-label="视图示例" data-demo-tabs><span class="segment-indicator"></span>'+['列表','卡片','预览'].map((s,i)=>'<button type="button" role="tab" id="sample-tab-'+i+'" aria-controls="sample-tab-panel" aria-selected="'+(!i)+'" tabindex="'+(i?-1:0)+'" data-sample-tab="'+i+'">'+s+'</button>').join('')+'</div><div id="sample-tab-panel" class="tab-example" role="tabpanel" aria-labelledby="sample-tab-0">列表视图 · 让信息依次展开。</div>'},
 {id:'feedback',name:'弹窗与反馈',desc:'确认、取消、关闭和退出键始终可用；关闭后焦点回到触发位置。',html:()=>'<div class="row">'+btn('打开弹窗','data-demo-dialog','primary')+btn('底部菜单','data-demo-sheet')+btn('轻提示','data-demo-toast')+'</div>'},
 {id:'cards',name:'卡片',desc:'用轮廓或填充区分层次。卡片没有编号，也不会把你带回首页。',html:()=>'<div class="grid two"><article class="content-card"><span class="eyebrow">描边容器</span><h3>让内容成为主角</h3><p>清晰的边界，恰好的留白。</p>'+btn('查看内容 '+icon('arrow'),'data-demo-card','text')+'</article><article class="content-card filled"><span class="eyebrow">填充容器</span><h3>把重点轻轻托起</h3><p>相同的语言，不同的层次。</p>'+btn('查看内容 '+icon('arrow'),'data-demo-card','text')+'</article></div>'},
 {id:'states',name:'空状态与进度',desc:'让当前状态可感知；不把颜色作为唯一线索。',html:()=>'<div class="grid two"><div class="empty-state"><h3>还没有内容</h3><p>从一段自己的文字开始。</p>'+btn('添加内容','data-demo-dialog')+'</div><div class="progress-example"><label for="sample-progress">完成进度 <output id="progress-value">40%</output></label><progress class="sr-only" id="sample-progress" max="100" value="40">40%</progress><div class="visual-progress" aria-hidden="true"><span></span></div>'+btn('推进进度','data-progress')+'</div></div>'}
];
function overview() {
 return intro('总览 / 设计语言','清晰的秩序，柔和的回应。','从页面骨架到每一次点击，以克制的颜色、明确的层级和连续的反馈建立一致体验。')+
 '<section class="hero"><div><span class="eyebrow">少一点装饰，多一点感知</span><h2>四种颜色。<br>一种完整的语言。</h2><p>浅色承载内容，蓝色标记交互。<br>让形状、间距与动作，说清楚每一个状态。</p><div class="row">'+btn('查看模块 '+icon('arrow'),'data-page="components"','primary')+btn('阅读细则','data-page="docs"','text')+'</div></div><div class="composition" aria-label="设计语言交互示例"><div class="composition-bar"><span></span><span></span><span></span></div><div class="composition-content"><div class="mini-side"><i></i><i></i><i></i></div><div class="mini-main"><span class="eyebrow">有边界，也有呼吸</span><h3>触摸一种秩序</h3>'+createSwitch('即时反馈',{id:'hero-switch',checked:true})+btn('试试涟漪','data-demo-toast','primary')+'</div></div></div></section>'+
 '<section class="section"><div class="section-heading"><h2>颜色，各司其职</h2><span>仅四个基础色</span></div><div class="palette">'+[['primary','交互蓝','#4A90D9'],['container','容器蓝','#D3E4FD'],['surface','画布白','#F9F9FF'],['ink','文字墨','#1A1B21']].map(([c,n,v])=>'<article class="swatch"><div class="swatch-color '+c+'"></div><h3>'+n+'</h3><code>'+v+'</code></article>').join('')+'</div><p class="caption">悬停、禁用和遮罩仅使用上述颜色的透明度变化；状态同时由文字、图形和边框表达。</p></section>'+
 '<section class="section grid three">'+[['层级','让阅读自然发生','标题、正文和辅助说明各有位置。边界轻，重点明确。'],['空间','让内容自由呼吸','以四像素为基础组织间距，侧栏稳定，正文独立滚动。'],['动效','让变化有迹可循','涟漪回应点击，涟漪回应选择；尊重系统的减少动态效果设置。']].map(([a,b,c])=>'<article class="principle"><span class="eyebrow">'+a+'</span><h3>'+b+'</h3><p>'+c+'</p></article>').join('')+'</section>'+
 '<section class="section statement"><h2>同一套原则，贯穿每个细节。</h2><p>借鉴 Material Design 的层级、状态与反馈，以及 Apple 人机界面指南的清晰、一致和用户控制。这里是独立的网页实现，并非官方组件库。</p><div class="row">'+btn('自定义表达 '+icon('arrow'),'data-page="ugc"','text')+btn('查看原则来源','data-page="docs"','text')+'</div></section>';
}
function components() {
 return intro('细节 / 可复用模块','看得见，也用得起来。','每个展示都是真实控件。试用状态、检查反馈，再带走完整的结构、样式与交互。')+
 '<nav class="section-nav" aria-label="模块目录">'+specimens.map(s=>btn(s.name,'data-anchor="'+s.id+'"','chip')).join('')+'</nav>'+
 specimens.map(s=>'<section class="specimen" id="'+s.id+'"><div class="section-heading"><div><h2>'+s.name+'</h2><p>'+s.desc+'</p></div>'+btn('下载示例','data-download="'+s.id+'"','text')+'</div><div class="specimen-stage">'+s.html()+'</div><details class="code-disclosure" data-specimen="'+s.id+'"><summary>查看与复制代码</summary><div class="code-tools"><div class="row">'+['结构','样式','交互'].map((t,i)=>btn(t,'data-code="'+i+'" aria-pressed="'+(!i)+'"','chip')).join('')+'</div>'+btn('复制代码','data-copy-code','text')+'</div><pre tabindex="0"><code>'+esc(s.html())+'</code></pre><p class="caption">下载示例包含全部依赖，可独立打开。样式与交互来自本页实际使用的共享模块。</p></details></section>').join('');
}
function cardHtml(c) {return '<article class="content-card '+(c.variant==='填充'?'filled':'')+'"><h3>'+esc(c.title||'未命名卡片')+'</h3><p>'+esc(c.body)+'</p></article>';}
function previewHtml() {
 return '<article class="post-preview">'+(draft.showAuthor?'<div class="author"><span class="avatar" aria-hidden="true">'+esc((draft.author||'创作者').slice(0,1))+'</span><span>'+esc(draft.author||'创作者')+'</span></div>':'')+'<h2>'+esc(draft.title||'未命名内容')+'</h2><div class="rich-body">'+sanitizeRichHtml(draft.body)+'</div>'+(draft.showCards?'<div class="preview-cards">'+draft.cards.map(cardHtml).join('')+'</div>':'')+'</article>';
}
function ugc() {
 return intro('温度 / 自定义表达','内容的样子，由你决定。','编辑文字、组织卡片、选择展示方式。没有预设业务，也不需要发布到任何服务。')+
 '<div class="workbench"><section class="editor-column"><div class="segmented" role="tablist" aria-label="编辑模式"><span class="segment-indicator" style="--segment:'+['post','cards','preview'].indexOf(ugcTab)+'"></span>'+[['post','帖子'],['cards','卡片'],['preview','预览']].map(([v,t])=>'<button type="button" role="tab" id="ugc-tab-'+v+'" aria-controls="ugc-panel" aria-selected="'+(ugcTab===v)+'" tabindex="'+(ugcTab===v?0:-1)+'" data-ugc-tab="'+v+'">'+t+'</button>').join('')+'</div><div id="ugc-panel" role="tabpanel" aria-labelledby="ugc-tab-'+ugcTab+'">'+ugcPanel()+'</div><div class="editor-actions row">'+btn('保存到本机','data-save','primary')+btn('导出内容','data-export')+btn('重置','data-reset','text')+'</div><p class="caption" id="draft-status" role="status">内容只保存在此浏览器；导出可带走文字与卡片。</p></section><aside class="preview-column"><div class="section-heading"><h2>实时呈现</h2><span>随编辑更新</span></div><div id="live-preview">'+previewHtml()+'</div></aside></div>';
}
function ugcPanel() {
 if(ugcTab==='preview') return '<div class="full-preview">'+previewHtml()+'</div>';
 if(ugcTab==='cards') return '<div class="panel-heading"><h2>组织你的卡片</h2>'+btn('添加卡片','data-add-card','primary')+'</div><p class="caption">可自由编辑、移动与移除。展示不包含序号。</p><div class="card-editors">'+draft.cards.map((c,i)=>'<section class="card-editor" data-card-id="'+c.id+'">'+createMdInput({id:'card-title-'+c.id,label:'卡片标题',value:c.title,attrs:'data-card-field="title"'})+createMdInput({id:'card-body-'+c.id,label:'卡片正文',value:c.body,multiline:true,attrs:'data-card-field="body"'})+createMdSelect({id:'card-style-'+c.id,label:'容器样式',options:['描边','填充'],selected:c.variant})+'<div class="row">'+btn('上移','data-move="-1"'+(!i?' disabled':''),'text')+btn('下移','data-move="1"'+(i===draft.cards.length-1?' disabled':''),'text')+btn('移除','data-remove-card','text')+'</div></section>').join('')+'</div>'+(draft.cards.length?'':'<p class="empty-state">还没有卡片。添加一个空白容器，开始自己的表达。</p>');
 return '<div class="post-editor">'+createMdInput({id:'post-title',label:'标题',value:draft.title})+createMdInput({id:'post-author',label:'署名',value:draft.author})+'<div class="rich-editor"><div class="rich-toolbar" role="toolbar" aria-label="文字格式">'+[['strong','加粗','<b>粗</b>'],['em','斜体','<i>斜</i>'],['u','下划线','<u>线</u>'],['list','项目列表','列表'],['link','插入链接','链接'],['image','插入图片','图片']].map(([a,b,c])=>btn(c,'data-format="'+a+'" aria-label="'+b+'"','tool-button')).join('')+'</div><label class="editor-label" id="body-label">正文</label><div id="post-body" class="editable rich-body" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="body-label">'+sanitizeRichHtml(draft.body)+'</div><input type="file" id="image-file" accept="image/png,image/jpeg,image/webp" hidden></div><p class="caption">选中文字后设置格式。图片保留原始内容；支持本地图片，最大两兆字节。</p>'+createSwitch('显示署名',{id:'show-author',checked:draft.showAuthor})+createSwitch('显示卡片',{id:'show-cards',checked:draft.showCards})+'</div>';
}
async function docs() {
 if(!chapters){
  const response=await fetch('/showcase/design.md'); if(!response.ok) throw Error('规范加载失败');
  const raw=await response.text(), matches=[...raw.matchAll(/^## (.+)$/gm)];
  chapters=matches.map((m,i)=>({title:m[1],content:raw.slice(m.index,matches[i+1]?.index??raw.length)}));
 }
 currentChapter=Math.min(Math.max(currentChapter,0),chapters.length-1);
 return intro('细则 / 设计规范','从原则，到每一个实现。','按章节阅读设计规范。目录保持在侧栏，切换只更新正文。')+
 '<div class="docs-layout"><nav class="chapter-nav" aria-label="章节目录"><div class="section-heading"><h2>章节目录</h2><span>'+chapters.length+' 个章节</span></div>'+chapters.map((c,i)=>'<button type="button" data-chapter="'+i+'" aria-current="'+(i===currentChapter?'location':'false')+'">'+esc(c.title.replace(/^\d+\.\s*/,''))+'</button>').join('')+'</nav><div id="chapter-content">'+chapterHtml()+'</div></div>';
}
function chapterHtml() {
 const md=window.markdownit({html:false,linkify:false,typographer:false});
 const body=md.render(chapters[currentChapter].content);
 return '<article class="prose">'+body+'</article><nav class="chapter-pager" aria-label="章节翻页">'+btn('上一章','data-chapter="'+(currentChapter-1)+'"'+(!currentChapter?' disabled':''))+btn('下一章','data-chapter="'+(currentChapter+1)+'"'+(currentChapter===chapters.length-1?' disabled':''))+'</nav>';
}
const renderers={overview,components,ugc,docs};
export function parseRoute(hash) {
 const [candidate,anchor='']=hash.replace(/^#/,'').split('/');
 return {page:Object.hasOwn(renderers,candidate)?candidate:'overview',anchor};
}
async function navigate() {
 const version=++routeVersion, {page,anchor}=parseRoute(location.hash), root=document.getElementById('showcase-root');
 if(page==='docs') currentChapter=/^\d+$/.test(anchor)?Number(anchor):0;
 if(page===currentPage && page==='components') {document.getElementById(anchor)?.scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'start'});return;}
 if(page===currentPage && page==='docs' && chapters){
  currentChapter=Math.min(currentChapter,chapters.length-1);
  document.getElementById('chapter-content').innerHTML=chapterHtml();
  document.querySelectorAll('[data-chapter]').forEach(b=>{if(b.closest('.chapter-nav'))b.setAttribute('aria-current',Number(b.dataset.chapter)===currentChapter?'location':'false');});
  document.querySelector('.docs-layout').scrollIntoView({block:'start',behavior:'instant'});
  await transitionElement(document.getElementById('chapter-content'));return;
 }
 await transitionElement(root,false); if(version!==routeVersion)return;
 try {
  const html=await renderers[page](); if(version!==routeVersion)return;
  root.innerHTML=html; currentPage=page; document.getElementById('main-content').scrollTop=0;
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page); if(b.closest('nav')) b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
  root.querySelector('h1')?.focus({preventScroll:true});
  await transitionElement(root); if(version!==routeVersion)return;
  if(page==='components'&&anchor)document.getElementById(anchor)?.scrollIntoView({block:'start'});
 } catch(e) {root.innerHTML='<div class="empty-state"><h1>暂时无法加载</h1><p>'+esc(e.message)+'</p>'+btn('重试','data-retry')+'</div>';currentPage='';}
}
function go(page,anchor='') {
 const hash='#'+page+(anchor?'/'+anchor:'');
 if(location.hash===hash)navigate();else location.hash=hash;
}
function refreshPreview(){document.getElementById('live-preview')?.replaceChildren();const p=document.getElementById('live-preview');if(p)p.innerHTML=previewHtml();}
function refreshPanel(){
 const p=document.getElementById('ugc-panel');p.innerHTML=ugcPanel();p.setAttribute('aria-labelledby','ugc-tab-'+ugcTab);refreshPreview();
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
async function codeAssets(){return assetsPromise??=Promise.all(['/css/style.css','/js/components/design-controls.js'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('示例依赖加载失败');return r.text();}));}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function standalone(s) {
 const [css,js]=await codeAssets();
 return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+s.name+'</title><style>'+css+'body{display:block;overflow:auto;padding:24px}body>.specimen{max-width:960px;margin:auto}</style><body><section class="specimen"><h1>'+s.name+'</h1>'+s.html()+'</section><script type="module">'+js+'\ninitControls();\n'+specimenBehaviors.toString()+'\nspecimenBehaviors(document);<\/script></body></html>';
}
/** Kept self-contained so exported specimens run exactly the same interactions. */
function specimenBehaviors(root) {
 root.addEventListener('click',e=>{
  const tab=e.target.closest('[data-sample-tab]');
  if(tab){const group=tab.closest('[role="tablist"]'),i=Number(tab.dataset.sampleTab);group.querySelector('.segment-indicator').style.setProperty('--segment',i);group.querySelectorAll('[role="tab"]').forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;});const p=root.querySelector('#sample-tab-panel');p.textContent=['列表视图 · 让信息依次展开。','卡片视图 · 让内容保持边界。','预览视图 · 让结果清晰可见。'][i];p.setAttribute('aria-labelledby',tab.id);}
  if(e.target.closest('[data-progress]')){const p=root.querySelector('#sample-progress');p.value=p.value>=100?0:Math.min(100,p.value+20);root.querySelector('#progress-value').textContent=p.value+'%';root.querySelector('.visual-progress span').style.transform='scaleX('+(p.value/100)+')';}
 });
 root.addEventListener('keydown',e=>{const tab=e.target.closest('[role="tab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')],i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();});
}
export function initShowcase(){
 initControls();specimenBehaviors(document);
 document.querySelectorAll('.nav-icon').forEach(el=>el.innerHTML=icon(el.closest('[data-page]').dataset.page));
 document.addEventListener('selectionchange',captureRange);
 document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-format]')){captureRange();e.preventDefault();}});
 document.addEventListener('click',async e=>{
  const target=e.target;
  if(target.closest('[data-page]')){go(target.closest('[data-page]').dataset.page);return;}
  if(target.closest('[data-anchor]')){go('components',target.closest('[data-anchor]').dataset.anchor);return;}
  if(target.closest('[data-chapter]')){go('docs',target.closest('[data-chapter]').dataset.chapter);return;}
  if(target.closest('[data-retry]'))navigate();
  const tab=target.closest('[data-ugc-tab]');
  if(tab){ugcTab=tab.dataset.ugcTab;tab.closest('.segmented').querySelector('.segment-indicator').style.setProperty('--segment',['post','cards','preview'].indexOf(ugcTab));tab.parentElement.querySelectorAll('[role="tab"]').forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;});refreshPanel();}
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
   if(code){const box=code.closest('details'),s=specimens.find(s=>s.id===box.dataset.specimen),i=Number(code.dataset.code),assets=i?await codeAssets():[];box.querySelector('code').textContent=i===0?s.html():assets[i-1];box.querySelectorAll('[data-code]').forEach(b=>b.setAttribute('aria-pressed',String(b===code)));}
   if(target.closest('[data-copy-code]')){await navigator.clipboard.writeText(target.closest('details').querySelector('code').textContent);showToast('代码已复制');}
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
