const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {connect}=require('./cdp.cjs');
(async()=>{
 const c=await connect();let passed=0;
 const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
 const E=c.evaluate;
 const delay=()=>new Promise(r=>setTimeout(r,550));
 const click=async selector=>{
  await E('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');
  await new Promise(r=>setTimeout(r,100));
  const r=await E('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});
  await delay();
 };
 const key=async key=>{const vk={Escape:27,Enter:13,' ':32,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Home:36,End:35,Tab:9}[key];const params={key,code:key===' '?'Space':key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk};await c.send('Input.dispatchKeyEvent',{type:'keyDown',...params});await c.send('Input.dispatchKeyEvent',{type:'keyUp',...params});await delay();};
 const go=async route=>{await E('location.hash='+JSON.stringify('#'+route));await delay();};
 const fill=async(id,value)=>{await E('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');};
 const selectText=async()=>{await E('(()=>{const el=document.getElementById("post-body");el.focus();const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event("selectionchange"));})()');};
 try{
  await fs.mkdir('test-results',{recursive:true});
  await c.send('Page.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));'});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await c.send('Page.navigate',{url:'http://localhost:3100/?test='+Date.now()+'#overview'});
  await c.wait('document.querySelector(".hero")');await delay();
  await check('overview has four palette swatches and no business text',async()=>{
   assert.equal(await E('document.querySelectorAll(".swatch").length'),4);
   assert.equal(await E('/课程|课搭子|大学|招募|学习搭子|EduSpace/.test(document.body.innerText)'),false);
   await c.screenshot('test-results/overview-desktop.png');
  });
  await check('hero navigation and all seven component anchors preserve page',async()=>{
   await click('.hero [data-page="components"]');
   for(const id of ['buttons','fields','selects','switches','feedback','cards','states']){
    await click('[data-anchor="'+id+'"]');assert.equal(await E('location.hash'),'#components/'+id);
    assert.equal(await E('document.querySelectorAll(".specimen").length'),7);
   }
  });
  await check('card details open a modal, not the overview',async()=>{
   await go('components/cards');await click('[data-demo-card]');assert.equal(await E('!!document.querySelector("dialog[open]")'),true);
   assert.equal(await E('location.hash'),'#components/cards');await key('Escape');assert.equal(await E('!!document.querySelector("dialog")'),false);
  });
  await check('dialog close button, cancel, confirm, Escape, backdrop and focus return',async()=>{
   await go('components/feedback');
   for(const method of ['close','cancel','confirm','escape','backdrop']){
    await click('#feedback [data-demo-dialog]');
    assert.equal(await E('document.querySelector("dialog").contains(document.activeElement)'),true);
    if(method==='escape')await key('Escape');
    else if(method==='backdrop'){await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:8,y:8});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:8,y:8});await delay();}
    else await click(method==='close'?'dialog header [data-close]':method==='cancel'?'dialog footer [data-close]':'dialog [type="submit"]');
    assert.equal(await E('!!document.querySelector("dialog")'),false,method);
    assert.equal(await E('document.activeElement.matches("#feedback [data-demo-dialog]")'),true,method);
   }
   await click('#feedback [data-demo-sheet]');await key('Escape');assert.equal(await E('!!document.querySelector("dialog")'),false);
  });
  await check('input notch, error semantics and typed content',async()=>{
   await go('components/fields');await click('#sample-title');await c.send('Input.insertText',{text:'自由标题'});await delay();
   assert.equal(await E('document.querySelector("#sample-title").value'),'自由标题');
   const geom=await E('(()=>{const f=document.querySelector("#sample-title").parentElement,l=f.querySelector("legend").getBoundingClientRect(),r=f.getBoundingClientRect();return {left:l.left-r.left,width:l.width,height:r.height}})()');
   assert.ok(geom.left>=12&&geom.width>20,JSON.stringify(geom));assert.equal(geom.height,56);
   assert.equal(await E('document.querySelector("#sample-error").getAttribute("aria-invalid")'),'true');
   await c.screenshot('test-results/fields-desktop.png');
  });
  await check('select pointer, keyboard, outside click and Escape',async()=>{
   await go('components/selects');await click('#sample-select');await key('ArrowDown');await key('Enter');
   assert.equal(await E('document.querySelector("#sample-select-value").textContent'),'填充');
   await click('#sample-select');await key('End');await key('Enter');assert.equal(await E('document.querySelector("#sample-select-value").textContent'),'留白');
   await click('#sample-select');await key('Escape');assert.equal(await E('document.querySelector("#sample-select").getAttribute("aria-expanded")'),'false');
   await click('#sample-select');await click('#selects h2');assert.equal(await E('document.querySelector("#sample-select-menu").hidden'),true);
  });
  await check('switches and animated segmented views change real state',async()=>{
   await go('components/switches');await click('#sample-switch');
   assert.equal(await E('document.querySelector("#sample-switch").checked'),false);
   await E('document.querySelector("#sample-switch").focus()');await key(' ');
   assert.equal(await E('document.querySelector("#sample-switch").checked'),true);
   await click('[data-sample-tab="1"]');assert.match(await E('document.querySelector("#sample-tab-panel").textContent'),/卡片视图/);
   await key('ArrowRight');assert.match(await E('document.querySelector("#sample-tab-panel").textContent'),/预览视图/);
  });
  await check('rich text formats selected text and updates preview',async()=>{
   await go('ugc');await click('[data-reset]');await click('dialog [type="submit"]');
   await fill('post-title','完全自定义的标题');await fill('post-author','测试作者');
   await E('document.querySelector("#post-body").textContent="这是一段可以编辑的正文";document.querySelector("#post-body").dispatchEvent(new Event("input",{bubbles:true}))');
   await selectText();await click('[data-format="strong"]');
   assert.match(await E('document.querySelector("#live-preview").innerHTML'),/<strong>这是一段可以编辑的正文<\/strong>/);
   await selectText();await click('[data-format="em"]');assert.ok(await E('!!document.querySelector("#live-preview em")'));
   await selectText();await click('[data-format="link"]');await fill('link-url','https://example.com/');await click('dialog [type="submit"]');
   assert.equal(await E('document.querySelector("#live-preview a").getAttribute("href")'),'https://example.com/');
   const fixture=path.resolve('test-results','image-fixture.png');
   await fs.writeFile(fixture,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB0cAAAAASUVORK5CYII=','base64'));
   const fileInput=await c.send('Runtime.evaluate',{expression:'document.getElementById("image-file")'});
   await c.send('DOM.setFileInputFiles',{objectId:fileInput.result.objectId,files:[fixture]});
   await c.wait('document.querySelector("#live-preview img")');
   assert.match(await E('document.querySelector("#live-preview img").src'),/^data:image\/png;base64,/);
   await click('#show-author');assert.equal(await E('!!document.querySelector("#live-preview .author")'),false);
   await c.screenshot('test-results/ugc-desktop.png');
  });
  await check('card add/edit/style/reorder/remove and preview remain connected',async()=>{
   await click('[data-ugc-tab="cards"]');await click('[data-add-card]');
   assert.equal(await E('document.querySelectorAll(".card-editor").length'),2);
   const id=await E('document.querySelector(".card-editor:last-child input").id');await fill(id,'新的卡片');
   await click('.card-editor:last-child .select-trigger');await click('.card-editor:last-child [role="option"]:last-child');
   assert.equal(await E('document.querySelector("#live-preview .content-card:last-child").classList.contains("filled")'),true);
   await click('.card-editor:last-child [data-move="-1"]');assert.equal(await E('document.querySelector("#live-preview .content-card h3").textContent'),'新的卡片');
   await click('.card-editor:last-child [data-remove-card]');assert.equal(await E('document.querySelectorAll("#live-preview .content-card").length'),1);
   await click('[data-ugc-tab="preview"]');assert.match(await E('document.querySelector(".full-preview").textContent'),/完全自定义的标题/);
  });
  await check('draft survives refresh, reset is cancellable, hidden cards toggle',async()=>{
   await click('[data-save]');await c.send('Page.reload');await c.wait('document.querySelector("#post-title")');await delay();
   assert.equal(await E('document.querySelector("#post-title").value'),'完全自定义的标题');
   assert.equal(await E('document.querySelector("#live-preview .content-card h3").textContent'),'新的卡片');
   await click('[data-reset]');await click('dialog footer [data-close]');assert.equal(await E('document.querySelector("#post-title").value'),'完全自定义的标题');
   await click('#show-cards');assert.equal(await E('document.querySelectorAll("#live-preview .content-card").length'),0);await click('#show-cards');
  });
  await check('content sanitization rejects executable markup and unsafe URLs',async()=>{
   const result=await E('(async()=>{const {sanitizeRichHtml:s}=await import("/js/components/design-controls.js");return s(\'<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">安全文字</a><strong onclick="alert(1)">格式</strong>\')})()');
   assert.equal(result,'<a>安全文字</a><strong>格式</strong>');
  });
  await check('all twelve document chapters retain the same directory node',async()=>{
   await go('docs');await c.wait('document.querySelector(".chapter-nav")');
   await E('window.__directory=document.querySelector(".chapter-nav")');
   assert.equal(await E('document.querySelectorAll(".chapter-nav button").length'),12);
   for(let i=0;i<12;i++){await click('.chapter-nav [data-chapter="'+i+'"]');assert.equal(await E('document.querySelector(".chapter-nav")===window.__directory'),true);assert.equal(await E('document.querySelector(".chapter-nav").getBoundingClientRect().top>=0'),true);assert.equal(await E('location.hash'),'#docs/'+i);}
   await c.screenshot('test-results/docs-desktop.png');
   await c.send('Page.reload');await c.wait('document.querySelector(".prose h2")');assert.match(await E('document.querySelector(".prose h2").textContent'),/11\./);
   await E('history.back()');await delay();assert.equal(await E('location.hash'),'#docs/10');
  });
  await check('all four pages fit five viewports and documentation stays available',async()=>{
   for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,800]]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const route of ['overview','components','ugc','docs/2']){
     await go(route);
     const overflow=await E('({body:document.body.scrollWidth,viewport:innerWidth,main:document.querySelector("main").scrollWidth,client:document.querySelector("main").clientWidth})');
     assert.ok(overflow.body<=overflow.viewport&&overflow.main<=overflow.client,route+' '+width+' '+JSON.stringify(overflow));
     if(width===390)await c.screenshot('test-results/'+route.replace('/','-')+'-mobile.png');
    }
   }
  });
  await check('reduced motion disables slider transitions and page animations',async()=>{
   await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   await go('ugc');assert.equal(await E('getComputedStyle(document.querySelector(".segment-indicator")).transitionDuration'),'0s');
   assert.equal(await E('document.getAnimations().length'),0);
   await c.send('Emulation.setEmulatedMedia',{features:[]});
  });
  await check('ripple is bounded, clipped and not stacked; tabs have no sliding layer',async()=>{
   await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
   await go('docs/1');
   const result=await E('(()=>{const b=document.querySelectorAll(".chapter-nav button")[1];b.click();b.click();const r=b.querySelector(".ripple");return {count:b.querySelectorAll(".ripple").length,width:r.getBoundingClientRect().width,limit:parseFloat(r.style.width),clip:getComputedStyle(b).overflow}})()');
   assert.equal(result.count,1);assert.ok(result.limit<=160);assert.equal(result.clip,'hidden');
   await go('ugc');
   assert.equal(await E('getComputedStyle(document.querySelector(".segment-indicator")).display'),'none');
  });
  await check('toast stays horizontally centered throughout its animation',async()=>{
   const centers=await E('(async()=>{const {showToast}=await import("/js/components/design-controls.js");showToast("居中检查");const values=[];for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const r=document.querySelector(".toast").getBoundingClientRect();values.push(Math.abs(r.left+r.width/2-innerWidth/2));}return values})()');
   assert.ok(Math.max(...centers)<1,JSON.stringify(centers));
  });
  await check('progress has intermediate animated values and reaches its target',async()=>{
   await go('components/states');
   const values=await E('(async()=>{const bar=document.querySelector(".visual-progress span"),value=()=>new DOMMatrix(getComputedStyle(bar).transform).a;const before=value();document.querySelector("[data-progress]").click();await new Promise(r=>setTimeout(r,100));const during=value();await new Promise(r=>setTimeout(r,350));return {before,during,after:value(),value:document.querySelector("progress").value}})()');
   assert.equal(values.value,60);assert.ok(values.during>values.before&&values.during<.6,JSON.stringify(values));assert.ok(Math.abs(values.after-.6)<.001);
  });
  await check('no uncaught browser errors',async()=>assert.deepEqual(await E('window.__errors'),[]));
  await check('copy operation places the actual specimen HTML on the clipboard',async()=>{
   await c.send('Browser.grantPermissions',{origin:'http://localhost:3100',permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
   await go('components/fields');await click('#fields summary');await click('#fields [data-copy-code]');
   assert.match(await E('navigator.clipboard.readText()'),/sample-title/);
  });
  await check('downloaded HTML examples run without the application',async()=>{
   const dir=path.resolve('test-results','exports-'+Date.now());await fs.mkdir(dir,{recursive:true});
   await c.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
   await go('ugc');await click('[data-export]');await delay();
   const exported=JSON.parse(await fs.readFile(path.join(dir,'自定义内容.json'),'utf8'));
   assert.equal(exported.title,'完全自定义的标题');assert.equal(exported.cards[0].title,'新的卡片');
   await go('components');
   const ids=['buttons','fields','selects','switches','feedback','cards','states'];
   for(const id of ids)await click('[data-download="'+id+'"]');
   for(const id of ids){
    const file=path.join(dir,id+'.html');let exists=false;
    for(let i=0;i<30;i++){try{await fs.access(file);exists=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
    assert.ok(exists,id);assert.match(await fs.readFile(file,'utf8'),/initControls\(\)/);
    await c.send('Page.navigate',{url:require('node:url').pathToFileURL(file).href});await delay();
    assert.ok(await E('!!document.querySelector(".specimen")'),id);
    if(id==='buttons'||id==='feedback'||id==='cards'){await click(id==='cards'?'[data-demo-card]':'[data-demo-dialog]');assert.equal(await E('!!document.querySelector("dialog[open]")'),true);await key('Escape');}
    if(id==='selects'){await click('.select-trigger');assert.equal(await E('document.querySelector(".select-menu").hidden'),false);}
    if(id==='switches'){await click('[data-sample-tab="1"]');assert.match(await E('document.querySelector("#sample-tab-panel").textContent'),/卡片视图/);}
    if(id==='states'){await click('[data-progress]');assert.equal(await E('document.querySelector("progress").value'),60);}
    assert.deepEqual(await E('window.__errors'),[],id);
   }
  });
  console.log('\n'+passed+' browser checks passed.');
 }finally{c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
