const fs = require('node:fs/promises');
async function connect() {
 const pages = await (await fetch('http://localhost:9222/json/list')).json();
 const page=pages.find(p=>p.type==='page');
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let next=0;
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value;};
 const wait=async(expression,ms=6000)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('Timed out: '+expression);};
 const screenshot=async path=>{const r=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path,Buffer.from(r.data,'base64'));};
 return {send,evaluate,wait,screenshot,close:()=>ws.close()};
}
module.exports={connect};
if(require.main===module)(async()=>{const c=await connect();try{
 if(process.argv[2]==='open'){await c.send('Page.navigate',{url:process.argv[3]});await new Promise(r=>setTimeout(r,3500));console.log(await c.evaluate('document.body.innerText'));}
 else if(process.argv[2]==='shot'){await c.screenshot(process.argv[3]);}
 else console.log(JSON.stringify(await c.evaluate(process.argv[2]),null,2));
}finally{c.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
