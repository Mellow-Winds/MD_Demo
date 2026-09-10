import {createMdInput, createSwitch, escapeHtml, openDialog, showToast} from '../components/design-controls.js';

const initial = () => ({blur:24, opacity:68, solid:false, still:false, shifted:false, title:'让内容透过来。'});
let settings = initial();
let previewGlass = false;
const presets = {light:{blur:16,opacity:52}, soft:{blur:24,opacity:68}, dense:{blur:32,opacity:88}};
const svg = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
const moveIcon = svg('<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>');
const layerIcon = svg('<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>');
const button = (label,action,kind='secondary') => '<button type="button" class="btn '+kind+'" data-lab-action="'+action+'">'+label+'</button>';

export function renderLaboratory() {
 return '<div class="lab-page"><header class="page-heading"><h1 tabindex="-1">轻一点，层次更分明。</h1><p>把玻璃作为界面的一层，而不是内容的装饰。调节材质、移动浮层，感受边界与反馈。</p></header>'+
 '<div class="lab-workbench"><section class="lab-preview" aria-label="玻璃材质交互场景"><div class="lab-scene" data-scene="rest">'+
 '<div class="lab-landscape" aria-hidden="true"><i class="lab-orbit"></i><i class="lab-disc"></i><i class="lab-bar"></i><span class="lab-backdrop-type">留白</span></div>'+
 '<div class="lab-scene-label"><span class="lab-dot"></span>材质观察窗</div>'+
 '<article class="lab-floating lab-glass"><div class="lab-card-top"><span class="lab-card-tag">浮动容器</span><button type="button" class="lab-drag" aria-label="移动玻璃卡片" aria-describedby="lab-drag-help">'+moveIcon+'</button></div>'+
 '<div class="lab-material-icon">'+layerIcon+'</div><h2 id="lab-preview-title">'+escapeHtml(settings.title)+'</h2><p>保留背景的存在感，<br>也让眼前的内容清楚可读。</p>'+
 '<div class="lab-material-note"><span class="lab-dot"></span><span id="lab-material-label">柔雾玻璃</span></div></article>'+
 '<div class="lab-dock lab-glass" role="toolbar" aria-label="场景操作">'+button('移动背景','background','text')+button('浮层预览','dialog','text')+button('归位','home','text')+'</div></div>'+
 '<p class="caption" id="lab-drag-help">拖动卡片右上角，松手后轻柔归位。聚焦移动按钮后，可用方向键移动、起始键归位。</p><p class="caption lab-status" id="lab-status" role="status"></p><button type="button" class="btn text lab-system-preview" data-lab-action="system-preview" aria-pressed="false" hidden>本页预览玻璃</button></section>'+
 '<aside class="lab-controls" aria-label="材质调校"><div class="section-heading"><h2>材质调校</h2><span>即时生效</span></div><p class="lab-control-intro">用同一组颜色，改变表面的厚度。</p>'+
 '<div class="lab-presets" role="group" aria-label="材质预设">'+[['light','轻透'],['soft','柔雾'],['dense','厚实']].map(([key,label])=>'<button type="button" class="chip" data-lab-preset="'+key+'" aria-pressed="false">'+label+'</button>').join('')+'</div>'+
 '<div class="lab-range"><label for="lab-blur">背景模糊 <output id="lab-blur-value" for="lab-blur">'+settings.blur+' 像素</output></label><input id="lab-blur" type="range" min="0" max="36" step="1" value="'+settings.blur+'"></div>'+
 '<div class="lab-range"><label for="lab-opacity">表面厚度 <output id="lab-opacity-value" for="lab-opacity">'+settings.opacity+'%</output></label><input id="lab-opacity" type="range" min="40" max="96" step="1" value="'+settings.opacity+'"></div>'+
 '<div class="lab-preferences">'+createSwitch('降低透明度',{id:'lab-solid',checked:settings.solid})+createSwitch('减少动态效果',{id:'lab-still',checked:settings.still})+'</div>'+
 '<p class="caption">系统辅助设置优先。关闭玻璃或动态效果后，全部操作仍然可用。</p><div class="lab-control-actions">'+button('复制材质样式','copy','primary')+button('恢复默认','reset','text')+'</div></aside></div>'+
 '<section class="section grid three lab-principles"><article class="principle"><span class="eyebrow">材质</span><h3>透明，但不失焦</h3><p>光线与背景透过表面。实色文字、高亮边缘与背景模糊一起维持可读性。</p></article><article class="principle"><span class="eyebrow">反馈</span><h3>跟手，也能打断</h3><p>拖动从按下的位置开始。回弹中再次抓取，卡片立即回到你的控制之下。</p></article><article class="principle"><span class="eyebrow">选择</span><h3>始终保留退路</h3><p>可以降低透明度、减少位移，或只用键盘操作。材质不应成为使用的门槛。</p></article></section>'+
 '<details class="code-disclosure lab-code"><summary>查看当前材质样式</summary><pre tabindex="0"><code id="lab-css"></code></pre><p class="caption">复制后将类名应用到容器；玻璃后方需要有内容。包含不支持背景模糊、降低透明度与增强对比度的实色回退。</p></details>'+
 '<p class="caption lab-scope">独立实验区域 · 参考 Apple 设计原则的网页实现，并非系统原生玻璃。现有四个页面保持不变。</p></div>';
}

export function materialCSS(blur, opacity, solid=false) {
 const amount=Math.min(96,Math.max(40,Number(opacity)||68));
 const radius=Math.min(36,Math.max(0,Number(blur)||0));
 return '.glass-material {\n  --glass-surface: #F9F9FF;\n  --glass-ink: #1A1B21;\n  color: var(--glass-ink);\n  background: color-mix(in srgb, var(--glass-surface) '+(solid?100:amount)+'%, transparent);\n  -webkit-backdrop-filter: '+(solid?'none':'blur('+radius+'px) saturate(120%)')+';\n  backdrop-filter: '+(solid?'none':'blur('+radius+'px) saturate(120%)')+';\n  border: 1px solid color-mix(in srgb, var(--glass-surface) 80%, transparent);\n  border-radius: 28px;\n  box-shadow: 0 12px 32px color-mix(in srgb, var(--glass-ink) 12%, transparent);\n}\n'+
 '@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {\n  .glass-material { background: var(--glass-surface); backdrop-filter: none; -webkit-backdrop-filter: none; border-color: var(--glass-ink); }\n}\n'+
 '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n  .glass-material { background: var(--glass-surface); }\n}';
}

/** A page-owned controller: leaving the route removes listeners and pending frames. */
export function mountLaboratory(root) {
 const page=root.querySelector('.lab-page');
 const scene=page.querySelector('.lab-scene'), card=page.querySelector('.lab-floating'), handle=page.querySelector('.lab-drag');
 const abort=new AbortController(), opts={signal:abort.signal};
 const media={
  solid:matchMedia('(prefers-reduced-transparency: reduce)'),
  contrast:matchMedia('(prefers-contrast: more)'),
  still:matchMedia('(prefers-reduced-motion: reduce)')
 };
 const hasGlass=CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)');
 let frame=0,lastTime=0,drag=null,disposed=false;
 const pos={x:0,y:0,vx:0,vy:0,tx:0,ty:0};
 const isStill=()=>settings.still||media.still.matches;
 const isSolid=()=>settings.solid||(media.solid.matches&&!previewGlass)||media.contrast.matches||!hasGlass;
 const bounds=()=>({x:Math.max(0,(scene.clientWidth-card.offsetWidth)/2-16),y:24});
 const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 const paint=()=>{
  card.style.setProperty('--lab-x',pos.x+'px');card.style.setProperty('--lab-y',pos.y+'px');
 };
 const stop=()=>{cancelAnimationFrame(frame);frame=0;lastTime=0;};
 const settle=(x=0,y=0)=>{
  const limit=bounds();pos.tx=clamp(x,-limit.x,limit.x);pos.ty=clamp(y,-limit.y,limit.y);
  if(isStill()){stop();pos.x=pos.tx;pos.y=pos.ty;pos.vx=pos.vy=0;paint();return;}
  if(!frame)frame=requestAnimationFrame(tick);
 };
 function tick(time) {
  if(disposed)return;
  const dt=lastTime?Math.min((time-lastTime)/1000,.032):1/60;lastTime=time;
  // Critically damped spring; current position and velocity survive retargeting.
  const omega=18,limit=bounds();
  for(const [axis,v,target,extent] of [['x','vx','tx',limit.x],['y','vy','ty',limit.y]]){
   pos[v]+=(-omega*omega*(pos[axis]-pos[target])-2*omega*pos[v])*dt;
   pos[axis]+=pos[v]*dt;
   if(Math.abs(pos[axis])>extent){pos[axis]=clamp(pos[axis],-extent,extent);pos[v]=0;}
  }
  paint();
  if(Math.abs(pos.x-pos.tx)+Math.abs(pos.y-pos.ty)+Math.abs(pos.vx)+Math.abs(pos.vy)<.2){
   pos.x=pos.tx;pos.y=pos.ty;pos.vx=pos.vy=0;paint();stop();
  }else frame=requestAnimationFrame(tick);
 }
 function materialOn(el) {
  el.style.setProperty('--lab-blur',settings.blur+'px');
  el.style.setProperty('--lab-opacity',(isSolid()?100:el.matches('.lab-dialog')?Math.max(88,settings.opacity):settings.opacity)+'%');
  el.dataset.solid=String(isSolid());
  el.dataset.still=String(isStill());
  el.dataset.previewGlass=String(previewGlass&&!settings.solid);
 }
 function update() {
  materialOn(page);
  const modal=document.querySelector('.lab-dialog');if(modal)materialOn(modal);
  scene.dataset.scene=settings.shifted?'shifted':'rest';
  page.querySelector('#lab-blur').value=settings.blur;
  page.querySelector('#lab-opacity').value=settings.opacity;
  page.querySelector('#lab-blur-value').textContent=settings.blur+' 像素';
  page.querySelector('#lab-opacity-value').textContent=settings.opacity+'%';
  page.querySelectorAll('.lab-range input').forEach(el=>el.disabled=isSolid());
  const solid=page.querySelector('#lab-solid'),still=page.querySelector('#lab-still');
  solid.checked=isSolid();solid.disabled=(media.solid.matches&&!previewGlass)||media.contrast.matches||!hasGlass;
  still.checked=isStill();still.disabled=media.still.matches;
  page.querySelectorAll('[data-lab-preset]').forEach(b=>{
   const p=presets[b.dataset.labPreset];b.setAttribute('aria-pressed',String(p.blur===settings.blur&&p.opacity===settings.opacity));
  });
  const mode=isSolid()?'实色回退':settings.opacity>=80?'厚实玻璃':settings.opacity<60?'轻透玻璃':'柔雾玻璃';
  page.querySelector('#lab-material-label').textContent=mode;
  page.querySelector('#lab-status').textContent=!hasGlass?'当前浏览器不支持背景模糊，已使用实色材质。':media.contrast.matches?'已遵循系统增强对比度设置。':media.solid.matches&&!previewGlass?'已遵循系统降低透明度设置。':previewGlass?'临时预览玻璃；退出实验室后恢复系统材质。':media.still.matches?'已遵循系统减少动态效果设置。':isSolid()?'已切换为实色，所有交互保持可用。':'玻璃效果仅作用于此实验区域。';
  const preview=page.querySelector('.lab-system-preview');
  preview.hidden=!hasGlass||!media.solid.matches||media.contrast.matches;
  preview.textContent=previewGlass?'恢复系统材质':'本页预览玻璃';
  preview.setAttribute('aria-pressed',String(previewGlass));
  page.querySelector('#lab-css').textContent=materialCSS(settings.blur,settings.opacity,isSolid());
  page.querySelector('#lab-preview-title').textContent=settings.title;
  if(isStill())settle(pos.tx,pos.ty);
 }
 page.addEventListener('input',e=>{
  if(e.target.id==='lab-blur')settings.blur=Number(e.target.value);
  if(e.target.id==='lab-opacity')settings.opacity=Number(e.target.value);
  if(e.target.id==='lab-solid')settings.solid=e.target.checked;
  if(e.target.id==='lab-still')settings.still=e.target.checked;
  update();
 },opts);
 page.addEventListener('click',async e=>{
  const preset=e.target.closest('[data-lab-preset]');
  if(preset){Object.assign(settings,presets[preset.dataset.labPreset]);update();}
  const action=e.target.closest('[data-lab-action]')?.dataset.labAction;
  if(action==='background'){settings.shifted=!settings.shifted;update();}
  if(action==='home')settle();
  if(action==='reset'){settings=initial();previewGlass=false;update();settle();}
  if(action==='system-preview'){previewGlass=!previewGlass;settings.solid=false;update();}
  if(action==='copy'){
   try {await navigator.clipboard.writeText(materialCSS(settings.blur,settings.opacity,isSolid()));showToast('材质样式已复制');}
   catch{showToast('无法访问剪贴板，请展开下方样式手动复制');}
  }
  if(action==='dialog'){
   const d=openDialog('浮层预览','<p class="lab-dialog-intro">较厚的玻璃将当前任务与背景分开。标题可编辑，取消始终可用。</p>'+
    createMdInput({id:'lab-dialog-title',label:'卡片标题',value:settings.title,attrs:'required maxlength="32"'}),{
     onSubmit:dialog=>{settings.title=dialog.querySelector('input').value.trim()||'让内容透过来。';update();}
    });
   d.classList.add('lab-dialog');materialOn(d);
   // The page toggle applies locally without changing the system preference.
   if(isStill())d.getAnimations().forEach(a=>a.finish());
  }
 },opts);
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  stop();handle.setPointerCapture(e.pointerId);
  drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:pos.x,y:pos.y,lastX:e.clientX,lastY:e.clientY,time:performance.now()};
  pos.vx=pos.vy=0;card.dataset.dragging='true';
 },opts);
 handle.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const limit=bounds(),now=performance.now(),dt=Math.max((now-drag.time)/1000,.008);
  pos.x=clamp(drag.x+e.clientX-drag.startX,-limit.x,limit.x);
  pos.y=clamp(drag.y+e.clientY-drag.startY,-limit.y,limit.y);
  pos.vx=clamp((e.clientX-drag.lastX)/dt,-800,800);pos.vy=clamp((e.clientY-drag.lastY)/dt,-800,800);
  drag.lastX=e.clientX;drag.lastY=e.clientY;drag.time=now;paint();
 },opts);
 const release=e=>{
  if(!drag||drag.id!==e.pointerId)return;
  if(performance.now()-drag.time>80||e.type==='pointercancel')pos.vx=pos.vy=0;
  drag=null;card.dataset.dragging='false';settle();
 };
 handle.addEventListener('pointerup',release,opts);
 handle.addEventListener('pointercancel',release,opts);
 handle.addEventListener('lostpointercapture',release,opts);
 handle.addEventListener('keydown',e=>{
  const steps={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};
  if(steps[e.key]){e.preventDefault();const [x,y]=steps[e.key];settle(pos.tx+x,pos.ty+y);}
  if(['Home','Enter',' '].includes(e.key)){e.preventDefault();settle();}
 },opts);
 page.querySelector('.lab-dock').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const buttons=[...e.currentTarget.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);
  if(i<0)return;e.preventDefault();
  buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length].focus();
 },opts);
 const resize=new ResizeObserver(()=>{if(!drag)settle();});
 resize.observe(scene);
 Object.values(media).forEach(m=>m.addEventListener('change',update,opts));
 update();
 return ()=>{
  disposed=true;previewGlass=false;abort.abort();resize.disconnect();stop();
  const modal=document.querySelector('.lab-dialog');modal?.close();
 };
}
