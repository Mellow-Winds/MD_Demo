import {createMdInput,createMdSelect,createSwitch} from '../components/design-controls.js';

const svg=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
const glyphs=['<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/>','<path d="M5 12h14m-6-6 6 6-6 6"/>','<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>'];
const action=(text,kind='dark',attrs='')=>'<button type="button" class="btn demo-'+kind+'" '+attrs+'>'+text+'</button>';
export const modes=[['default','普通卡片'],['enhanced','更好的卡片'],['liquid-glass','液态玻璃']];
export const modeButtons=()=>'<div class="material-picker" aria-label="卡片材质">'+modes.map(([mode,label])=>action(label,'light','data-material-mode="'+mode+'" aria-pressed="false"')).join('')+'</div>';
function buttons(){return '<div class="button-grid">'+['dark','light','clear'].map((kind,i)=>action(['深色按钮','浅色按钮','透明按钮'][i],kind,'data-demo-toast')).join('')+['dark','light','clear'].map((kind,i)=>action(svg(glyphs[(i+Math.floor(Math.random()*3))%3]),kind+' icon-button','aria-label="'+['深色图标按钮','浅色图标按钮','透明图标按钮'][i]+'" data-demo-toast')).join('')+'</div><div class="row disabled-examples">'+action('禁用状态','dark','disabled')+action(svg('<circle cx="12" cy="12" r="8"/><path d="m6 6 12 12"/>'),'dark icon-button','disabled aria-label="禁用状态"')+'</div>';}
function tabs(id){return '<div class="tab-demo"><div class="portal-tabs" role="tablist" aria-label="切换">'+['选择1','选择2','选择3'].map((t,i)=>'<button type="button" role="tab" id="'+id+'-'+i+'" aria-controls="'+id+'-panel" aria-selected="'+!i+'" tabindex="'+(i?-1:0)+'" data-gallery-tab>'+t+'</button>').join('')+'</div><div id="'+id+'-panel" class="tab-result" role="tabpanel" aria-labelledby="'+id+'-0">选择1</div></div>';}
function selects(id){return '<div class="grid two">'+createMdSelect({id:id+'-current',label:'经典',options:['选择1','选择2','选择3']})+'<div class="options-select">'+createMdSelect({id:id+'-options',label:'Options',options:['选择1','选择2','选择3']})+'</div></div>';}
export function adjustment(){return '<section class="card-adjustment"><h2>卡片调整</h2><div class="adjust-ranges">'+[['blur','背景模糊',0,36,24,' px'],['opacity','表面厚度',40,96,68,'%']].map(([id,label,min,max,value,unit])=>'<div class="adjust-range"><label for="adjust-'+id+'">'+label+'<output data-adjust-output="'+id+'">'+value+unit+'</output></label><input id="adjust-'+id+'" type="range" min="'+min+'" max="'+max+'" value="'+value+'" data-adjust="'+id+'"></div>').join('')+'</div>'+createSwitch('降低透明度',{id:'adjust-solid'})+createSwitch('减少动态效果',{id:'adjust-still'})+action('恢复默认材质','light','data-adjust-reset')+'</section>';}
function activeMaterial(){return modes.some(([mode])=>mode===document.body?.dataset.materialMode)?document.body.dataset.materialMode:'default';}
function cards(){const mode=activeMaterial();return '<section class="card-demo-module" data-card-material="'+mode+'"><article class="material-surface card-sample" data-preview-material="'+mode+'"><span>卡片样式</span></article>'+(mode==='liquid-glass'?adjustment():'')+'</section>';}
export function overviewGallery(){return '<section class="overview-canvas" aria-label="综合展示"><div class="overview-columns">'+modes.map(([mode,label],i)=>'<article class="material-surface overview-card" data-preview-material="'+mode+'"><h2>'+label+'</h2><div class="palette-inline" aria-label="颜色">'+['primary','container','surface','ink'].map(c=>'<span class="color-'+c+'" title="'+c+'"></span>').join('')+'</div><div class="row">'+action('深色按钮','dark','data-demo-toast')+action('浅色按钮','light','data-demo-toast')+action('透明按钮','clear','data-demo-toast')+'</div><div class="input-surface">'+createMdInput({id:'overview-input-'+i,label:'输入框'})+'</div>'+selects('overview-select-'+i)+createSwitch('开启',{id:'overview-switch-'+i,checked:true})+'</article>').join('')+'</div></section>';}
export const gallerySpecimens=[
 {id:'buttons',name:'按钮与涟漪',html:buttons},
 {id:'fields',name:'输入框',html:()=>'<div class="input-surface grid two">'+createMdInput({id:'sample-title',label:'标题'})+createMdInput({id:'sample-value',label:'已填写',value:'示例文字'})+createMdInput({id:'sample-disabled',label:'禁用',disabled:true})+createMdInput({id:'sample-error',label:'错误',error:'请填写'})+'</div>'},
 {id:'selects',name:'下拉菜单',html:()=>selects('sample')},
 {id:'switches',name:'开关与切换',html:()=>'<div class="grid two">'+createSwitch('默认开启',{id:'sample-switch',checked:true})+createSwitch('默认关闭',{id:'sample-switch-off'})+'</div>'+tabs('sample-tabs')+'<div class="row">'+action('下方轻提示','light','data-gallery-toast="bottom" data-gallery-toast-message="下方轻提示已显示"')+action('右下方轻提示','light','data-gallery-toast="right" data-gallery-toast-message="右下方轻提示已显示"')+'</div>'},
 {id:'feedback',name:'弹窗与反馈',html:()=>'<div class="row">'+action('弹窗','dark','data-demo-dialog')+action('底部菜单','light','data-demo-sheet')+action('下方轻提示','light','data-gallery-toast="bottom" data-gallery-toast-message="下方轻提示已显示"')+action('右下方轻提示','light','data-gallery-toast="right" data-gallery-toast-message="右下方轻提示已显示"')+'</div>'},
 {id:'cards',name:'卡片',html:cards},
 {id:'states',name:'进度',html:()=>'<div class="progress-example"><label for="sample-progress">进度 <output id="progress-value">40%</output></label><progress class="sr-only" id="sample-progress" max="100" value="40">40%</progress><div class="visual-progress" aria-hidden="true"><span></span></div><div class="row">'+action('回退','light','data-progress="-20"')+action('推进','dark','data-progress="20"')+'</div></div>'}
];

// Self-contained so exported examples retain the same interactions.
export function galleryBehaviors(root){
 const defaults={blur:24,opacity:68,solid:false,still:false};
 let config={...defaults};
 try{const saved=JSON.parse(localStorage.getItem('design-demo-material-config'));if(saved)config={blur:Math.max(0,Math.min(36,Number.isFinite(saved.blur)?saved.blur:24)),opacity:Math.max(40,Math.min(96,Number.isFinite(saved.opacity)?saved.opacity:68)),solid:saved.solid===true,still:saved.still===true};}catch{}
 const sync=()=>{
  document.body.style.setProperty('--material-blur',config.blur+'px');document.body.style.setProperty('--material-opacity',config.opacity+'%');
  document.body.dataset.materialSolid=String(config.solid);document.body.dataset.still=String(config.still);
  for(const key of ['blur','opacity']){const input=root.querySelector('[data-adjust="'+key+'"]');if(input)input.value=config[key];const out=root.querySelector('[data-adjust-output="'+key+'"]');if(out)out.textContent=config[key]+(key==='blur'?' px':'%');}
  for(const key of ['solid','still']){const input=root.querySelector('#adjust-'+key);if(input)input.checked=config[key];}
 };
 sync();
 root.addEventListener('gallery-render',sync);
 root.addEventListener('input',e=>{const key=e.target.dataset.adjust;if(key)config[key]=Number(e.target.value);if(e.target.id==='adjust-solid')config.solid=e.target.checked;if(e.target.id==='adjust-still')config.still=e.target.checked;if(key||e.target.id.startsWith('adjust-')){sync();try{localStorage.setItem('design-demo-material-config',JSON.stringify(config));}catch{}}});
 root.addEventListener('click',e=>{
  const tab=e.target.closest('[data-gallery-tab]');if(tab){const group=tab.parentElement;group.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;});const panel=document.getElementById(tab.getAttribute('aria-controls'));panel.textContent=tab.textContent;panel.setAttribute('aria-labelledby',tab.id);}
  const advance=e.target.closest('[data-progress]');if(advance){const box=advance.closest('.progress-example'),p=box.querySelector('progress');p.value=Math.max(0,Math.min(100,p.value+Number(advance.dataset.progress)));box.querySelector('output').textContent=p.value+'%';box.querySelector('.visual-progress span').style.transform='scaleX('+p.value/100+')';}
  const notice=e.target.closest('[data-gallery-toast]');if(notice){document.querySelector('.gallery-toast')?.remove();const n=document.createElement('div');n.className='gallery-toast '+(notice.dataset.galleryToast==='right'?'at-right':'');n.setAttribute('role','status');n.textContent=notice.dataset.galleryToastMessage||notice.textContent.trim()||'操作已完成';document.body.append(n);setTimeout(()=>n.remove(),2600);}
  if(e.target.closest('[data-adjust-reset]')){config={...defaults};sync();try{localStorage.setItem('design-demo-material-config',JSON.stringify(config));}catch{}}
 });
 root.addEventListener('keydown',e=>{const tab=e.target.closest('[data-gallery-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...tab.parentElement.children],i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();});
}
