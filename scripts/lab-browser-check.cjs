const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {connect}=require('./cdp.cjs');
(async()=>{
 const c=await connect(),E=c.evaluate;let count=0;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
 const go=async route=>{await E('location.hash='+JSON.stringify('#'+route));await sleep(600);};
 const click=async selector=>{
  await E('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');await sleep(80);
  const point=await E('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(400);
 };
 const key=async key=>{
  const vk={Escape:27,Enter:13,Home:36,ArrowRight:39,ArrowDown:40,ArrowLeft:37,Tab:9}[key];
  for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(550);
 };
 const media=async(features=[])=>{
  const values={'prefers-reduced-transparency':'no-preference','prefers-reduced-motion':'no-preference','prefers-contrast':'no-preference',...Object.fromEntries(features)};
  await c.send('Emulation.setEmulatedMedia',{features:Object.entries(values).map(([name,value])=>({name,value}))});await sleep(100);
 };
 const filter=()=>E('getComputedStyle(document.querySelector(".lab-floating")).backdropFilter');
 const position=()=>E('(()=>{const e=document.querySelector(".lab-floating");return {x:parseFloat(e.style.getPropertyValue("--lab-x"))||0,y:parseFloat(e.style.getPropertyValue("--lab-y"))||0}})()');
 try{
  await fs.mkdir('test-results',{recursive:true});
  await c.send('Page.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)))'});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await media();await c.send('Page.navigate',{url:'http://localhost:3100/?lab-test='+Date.now()+'#lab'});
  await c.wait('document.querySelector(".lab-page")');await sleep(600);
  await check('fifth route and actual glass rendering',async()=>{
   assert.equal(await E('document.querySelectorAll("#sidebar-nav [data-page]").length'),5);
   assert.equal(await E('document.querySelector("#sidebar-nav [data-page=lab]").getAttribute("aria-current")'),'page');
   assert.match(await filter(),/blur\(24px\)/);
   await c.screenshot('test-results/lab-desktop.png');
  });
  await check('presets and range keyboard controls update real material',async()=>{
   await click('[data-lab-preset="light"]');assert.match(await filter(),/blur\(16px\)/);
   await E('document.querySelector("#lab-blur").focus()');await key('ArrowRight');
   assert.match(await filter(),/blur\(17px\)/);assert.equal(await E('document.querySelector("#lab-blur-value").textContent'),'17 像素');
   await E('document.querySelector("#lab-opacity").focus()');await key('ArrowRight');
   assert.equal(await E('document.querySelector(".lab-page").style.getPropertyValue("--lab-opacity")'),'53%');
   await click('[data-lab-preset="soft"]');
  });
  await check('background shifts without moving foreground controls',async()=>{
   const before=await E('getComputedStyle(document.querySelector(".lab-disc")).transform');
   const x=await E('document.querySelector(".lab-dock").getBoundingClientRect().x');
   await click('[data-lab-action="background"]');await sleep(350);
   assert.notEqual(await E('getComputedStyle(document.querySelector(".lab-disc")).transform'),before);
   assert.equal(await E('document.querySelector(".lab-dock").getBoundingClientRect().x'),x);
   await click('[data-lab-action="background"]');
  });
  await check('pointer drag tracks the grab offset, can be interrupted, and settles',async()=>{
   await E('document.querySelector(".lab-scene").scrollIntoView({block:"center"})');await sleep(100);
   const p=await E('(()=>{const r=document.querySelector(".lab-drag").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
   await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
   await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:p.x+64,y:p.y+12});
   const dragged=await position();assert.ok(Math.abs(dragged.x-64)<1);assert.ok(Math.abs(dragged.y-12)<1);
   await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:p.x+64,y:p.y+12});
   await sleep(60);
   const q=await E('(()=>{const r=document.querySelector(".lab-drag").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
   await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...q});
   const grabbed=await position();assert.ok(grabbed.x>0&&grabbed.x<90);
   await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:q.x-20,y:q.y});
   const moved=await position();assert.ok(Math.abs((grabbed.x-moved.x)-20)<2);
   await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:q.x-20,y:q.y});
   await sleep(1100);const end=await position();assert.ok(Math.abs(end.x)<.2&&Math.abs(end.y)<.2);
  });
  await check('keyboard movement and home preserve the drag alternative',async()=>{
   await E('document.querySelector(".lab-drag").focus()');await key('ArrowRight');
   assert.ok((await position()).x>15);
   await key('Home');assert.ok((await position()).x<.2);
  });
  await check('local solid and reduced-motion controls keep interactions available',async()=>{
   await click('#lab-solid');assert.equal(await filter(),'none');assert.equal(await E('document.querySelector("#lab-blur").disabled'),true);
   await click('#lab-solid');assert.match(await filter(),/blur/);
   await click('#lab-still');
   await E('document.querySelector(".lab-drag").focus()');await key('ArrowRight');
   assert.equal((await position()).x,16);assert.equal(await E('document.querySelector(".lab-page").getAnimations({subtree:true}).length'),0);
   await key('Home');await click('#lab-still');
  });
  await check('glass modal edits content, closes via Escape, and restores focus',async()=>{
   await click('[data-lab-action="dialog"]');assert.ok(await E('!!document.querySelector("dialog.lab-dialog[open]")'));
   assert.match(await E('getComputedStyle(document.querySelector("dialog")).backdropFilter'),/blur/);
   assert.equal(await E('document.querySelector("dialog").style.getPropertyValue("--lab-opacity")'),'88%');
   await E('document.querySelector("#lab-dialog-title").value="可以自由修改的玻璃浮层"');
   await click('dialog [type="submit"]');assert.equal(await E('document.querySelector("#lab-preview-title").textContent'),'可以自由修改的玻璃浮层');
   await click('[data-lab-action="dialog"]');await key('Escape');assert.equal(await E('!!document.querySelector("dialog")'),false);
   assert.equal(await E('document.activeElement.dataset.labAction'),'dialog');
  });
  await check('system preferences win; explicit preview is temporary and contrast stays protected',async()=>{
   await media([['prefers-reduced-transparency','reduce']]);assert.equal(await filter(),'none');
   assert.equal(await E('document.querySelector("#lab-solid").disabled'),true);
   await click('[data-lab-action="system-preview"]');assert.match(await filter(),/blur/);
   await go('overview');await go('lab');assert.equal(await filter(),'none');
   await media([['prefers-contrast','more']]);assert.equal(await filter(),'none');
   assert.equal(await E('document.querySelector(".lab-system-preview").hidden'),true);
   await media([['prefers-reduced-motion','reduce']]);assert.equal(await E('document.querySelector("#lab-still").disabled'),true);
   await media();
  });
  await check('unsupported blur receives a solid, usable fallback',async()=>{
   await E('window.__cssSupports=CSS.supports;CSS.supports=()=>false');await go('overview');await go('lab');
   assert.equal(await filter(),'none');assert.match(await E('document.querySelector("#lab-status").textContent'),/不支持/);
   await E('CSS.supports=window.__cssSupports');await go('overview');await go('lab');
  });
  await check('five sizes and long titles keep the card clear of the toolbar',async()=>{
   await click('[data-lab-action="reset"]');
   for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,800]]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(300);
    const result=await E('(()=>{const c=document.querySelector(".lab-floating").getBoundingClientRect(),d=document.querySelector(".lab-dock").getBoundingClientRect(),s=document.querySelector(".lab-scene").getBoundingClientRect();return {overflow:document.querySelector("main").scrollWidth>document.querySelector("main").clientWidth,inside:c.left>=s.left&&c.right<=s.right,separate:c.bottom<d.top}})()');
    assert.deepEqual(result,{overflow:false,inside:true,separate:true},String(width));
    if(width===390){await E('document.querySelector("main").scrollTop=0');await c.screenshot('test-results/lab-mobile.png');}
   }
   await click('[data-lab-action="dialog"]');
   await E('document.querySelector("#lab-dialog-title").value="这是一段比较长的自定义标题用来检验小屏幕上的材质容器布局是否稳定"');
   await click('dialog [type="submit"]');
   assert.ok(await E('document.querySelector(".lab-floating").getBoundingClientRect().bottom<document.querySelector(".lab-dock").getBoundingClientRect().top'));
  });
  await check('copy yields the current reusable CSS including fallback rules',async()=>{
   await c.send('Browser.grantPermissions',{origin:'http://localhost:3100',permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
   await click('[data-lab-action="copy"]');const text=await E('navigator.clipboard.readText()');
   assert.match(text,/\.glass-material/);assert.match(text,/prefers-reduced-transparency/);assert.match(text,/@supports not/);
  });
  await check('leaving lab does not apply glass to existing pages or leak errors',async()=>{
   await go('components');
   assert.equal(await E('!!document.querySelector(".lab-page")'),false);
   assert.equal(await E('getComputedStyle(document.querySelector(".specimen")).backdropFilter'),'none');
   assert.deepEqual(await E('window.__errors'),[]);
  });
  console.log('\n'+count+' laboratory browser checks passed.');
 }finally{c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
