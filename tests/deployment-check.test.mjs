import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {deploymentCheck} from '../deployment-check.mjs';

test('browser deployment check reports missing assets, HTML fallbacks and correct JS without changing files',async()=>{
 const files=[{path:'src/main.js',bytes:12},{path:'assets/font.woff',bytes:20},{path:'assets/sound.wav',bytes:30},{path:'index.html',bytes:40}];
 const {html,js}=deploymentCheck({version:'abc123',files});
 assert.match(html,/deployment-check\.js\?v=abc123/);
 const element=()=>({textContent:'',disabled:false,children:[],listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.children=[];},append(value){this.children.push(value);}});
 const elements=Object.fromEntries(['summary','results','run','copy'].map(id=>[id,element()]));
 const requests=[],clipboard=[];
 const context={URL,AbortController,setTimeout,clearTimeout,location:{href:'https://example.com/nested/deployment-check.html',origin:'https://example.com'},navigator:{clipboard:{writeText:async value=>clipboard.push(value)}},document:{getElementById:id=>elements[id],createElement:element},fetch:async(url,options)=>{
  requests.push({url:String(url),options});const missing=url.pathname.endsWith('.woff'),htmlFallback=url.pathname.endsWith('.wav');
  return{ok:!missing,status:missing?404:200,headers:{get:name=>name==='content-type'?(url.pathname.endsWith('.js')?'text/javascript':'text/html'):null}};
 }};
 vm.runInNewContext(js,context);
 await elements.run.listeners.click();
 assert.equal(requests.length,4);assert.ok(requests.every(r=>r.options.method==='HEAD'&&r.options.cache==='no-store'));
 assert.ok(requests.every(r=>r.url.startsWith('https://example.com/nested/')&&r.url.endsWith('?v=abc123')));
 assert.match(elements.summary.textContent,/2 个文件不可用/);
 assert.equal(elements.run.disabled,false);assert.equal(elements.copy.disabled,false);
 await elements.copy.listeners.click();const report=JSON.parse(clipboard[0]);
 assert.equal(report.failed,2);assert.equal(report.results.find(r=>r.path.endsWith('.woff')).status,404);
 assert.equal(report.results.find(r=>r.path.endsWith('.wav')).ok,false);
 assert.equal(report.results.find(r=>r.path.endsWith('.js')).ok,true);
});
