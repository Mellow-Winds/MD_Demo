import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createApp}=require('../showcase-server.cjs');
const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
// Load this dependency-free browser module explicitly as ESM without changing
// the archived CommonJS backend's package mode.
const {escapeHtml,createMdInput,createMdSelect,createSwitch}=await import(
 'data:text/javascript;base64,'+Buffer.from(await read('public/js/components/design-controls.js')).toString('base64')
);

test('read-only server serves the app, shared assets and twelve chapters',async()=>{
 const server=createApp().listen(0,'127.0.0.1');
 await new Promise(resolve=>server.on('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try {
  for(const [url,type] of [['/','text/html'],['/css/style.css','text/css'],['/css/material-modes.css','text/css'],['/js/pages/showcase.js','javascript'],['/js/components/design-controls.js','javascript'],['/showcase/design.md','markdown']]){
   const r=await fetch(base+url);assert.equal(r.status,200,url);assert.ok(r.headers.get('content-type').includes(type));
  }
  const doc=await(await fetch(base+'/showcase/design.md')).text();
  assert.equal([...doc.matchAll(/^## /gm)].length,12);
  for(const url of ['/api/courses','/api/auth/login','/showcase/missing']){
   assert.equal((await fetch(base+url)).status,404);
  }
  assert.equal((await fetch(base+'/api/auth/login',{method:'POST'})).status,404);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
test('input factory escapes content and associates validation text',()=>{
 assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
 const input=createMdInput({id:'title',label:'标题',value:'"><script>x</script>',error:'请检查'});
 assert.ok(input.includes('aria-invalid="true"'));assert.ok(input.includes('aria-describedby="title-error"'));
 assert.ok(input.includes('placeholder=" "'));assert.ok(input.includes('<fieldset'));assert.ok(!input.includes('<script>'));
 const area=createMdInput({id:'body',label:'正文',multiline:true,disabled:true});
 assert.match(area,/<textarea[^>]+disabled/);
});
test('selection and switches expose explicit accessible state',()=>{
 const select=createMdSelect({id:'style',label:'样式',options:['描边','填充'],selected:'填充'});
 assert.match(select,/aria-expanded="false"/);assert.match(select,/aria-selected="true">填充/);assert.match(select,/select-chevron/);assert.ok(!select.includes('<select'));
 assert.match(createSwitch('反馈',{id:'feedback',checked:true,disabled:true}),/role="switch" id="feedback" checked disabled/);
});
test('active runtime has four routes, three material modes and retains four base colors',async()=>{
 const [index,css,materialCss,js,lab]=await Promise.all([read('public/index.html'),read('public/css/style.css'),read('public/css/material-modes.css'),read('public/js/pages/showcase.js'),read('public/js/pages/gallery.js')]);
 assert.deepEqual([...new Set([...index.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]))],['overview','components','ugc','docs']);
 assert.match(lab,/\[\['default','普通卡片'\],\['enhanced','更好的卡片'\],\['liquid-glass','液态玻璃'\]\]/);
 assert.doesNotMatch(index,/data-material-mode=/);
 assert.match(materialCss,/data-material-mode="liquid-glass"/);
 assert.match(materialCss,/backdrop-filter: blur\(24px\)/);
 assert.match(js,/MATERIAL_MODE_KEY/);
 assert.deepEqual([...new Set([...css.matchAll(/#[0-9a-f]{6}\b/gi)].map(m=>m[0].toUpperCase()))].sort(),['#1A1B21','#4A90D9','#D3E4FD','#F9F9FF']);
 assert.doesNotMatch(index+js,/课搭子|加入课程|大学英语|学习搭子|EduSpace|blue-whale/);
 assert.doesNotMatch(css,/linear-gradient|backdrop-filter/);
});
test('glass styling is isolated and has accessibility and browser fallbacks',async()=>{
 const css=await read('public/css/gallery.css');
 assert.match(css,/backdrop-filter:blur\(var\(--material-blur,24px\)\)/);
 assert.match(css,/prefers-reduced-transparency/);
 assert.match(css,/prefers-contrast/);
 assert.match(css,/@supports not/);
 assert.match(css,/input-surface/);
});
test('primary action white text meets normal-text contrast',()=>{
 const blend=(a,b,t)=>a.map((v,i)=>(v*t+b[i]*(1-t))/255);
 const lum=rgb=>rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const foreground=lum([249/255,249/255,1]),background=lum(blend([74,144,217],[26,27,33],.76));
 assert.ok((foreground+.05)/(background+.05)>=4.5);
});
