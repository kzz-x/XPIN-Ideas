import test from 'node:test';
import assert from 'node:assert/strict';
import {cardDetailHTML,prepareCardMedia,stopCardMedia} from '../src/card-media.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=()=>new Promise(setImmediate);
let serial=0;
const freshAssets=()=>import('../src/asset-prefetch.mjs?background-test='+serial++);
function installGlobal(t,key,value){const original=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});}

test('background transfers are limited to two through body completion, deduplicate, and retry failed assets',async t=>{
 installGlobal(t,'location',{href:'https://site.test/'});
 const calls=[];
 t.mock.method(globalThis,'fetch',(url,options)=>{const headers=deferred(),body=deferred();calls.push({url,options,headers,body});return headers.promise;});
 const {assetBytes}=await freshAssets();
 const first=assetBytes('./one.glb'),second=assetBytes('./two.glb'),third=assetBytes('./three.glb');
 assert.equal(assetBytes('./one.glb'),first);await flush();assert.equal(calls.length,2);
 assert.ok(calls.every(call=>call.options.priority==='low'));
 calls[0].headers.resolve({ok:true,arrayBuffer:()=>calls[0].body.promise});await flush();
 assert.equal(calls.length,2,'headers alone must not release a transfer slot');
 const firstBytes=new Uint8Array([1,2]).buffer;calls[0].body.resolve(firstBytes);assert.equal(await first,firstBytes);await flush();assert.equal(calls.length,3);
 calls[1].headers.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
 calls[2].headers.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await Promise.all([second,third]);
 assert.equal(await assetBytes('./one.glb'),firstBytes);assert.equal(calls.length,3,'completed bytes are reused');
 const failed=assetBytes('./retry.glb');const rejection=assert.rejects(failed,/503/);await flush();calls[3].headers.resolve({ok:false,status:503});await rejection;await flush();
 const retry=assetBytes('./retry.glb');await flush();assert.equal(calls.length,5);calls[4].headers.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)});assert.equal((await retry).byteLength,2);
});

test('speculative covers share the model queue, decode at bounded concurrency and reuse duplicate URLs',async t=>{
 installGlobal(t,'location',{href:'https://site.test/'});
 const calls=[],images=[];
 t.mock.method(globalThis,'fetch',url=>{const job=deferred();calls.push({url,job});return job.promise;});
 installGlobal(t,'Image',class{constructor(){this.job=deferred();images.push(this);}decode(){return this.job.promise;}});
 const {assetBytes,prefetchImages}=await freshAssets();
 const model1=assetBytes('./one.glb'),model2=assetBytes('./two.glb');
 const covers=prefetchImages(['./cover-one.webp','./cover-two.webp','./cover-one.webp']);
 const repeated=prefetchImages(['./cover-one.webp']);await flush();assert.equal(calls.length,2);assert.equal(images.length,0);
 calls[0].job.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await model1;await flush();
 assert.equal(images.length,1);assert.equal(images[0].src,'https://site.test/cover-one.webp');assert.equal(images[0].fetchPriority,'low');assert.equal(images[0].decoding,'async');
 images[0].job.resolve();await flush();assert.equal(images.length,2);assert.equal(images[1].src,'https://site.test/cover-two.webp');
 images[1].job.resolve();calls[1].job.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
 const [all,again]=await Promise.all([covers,repeated]);await model2;
 assert.equal(all.length,2);assert.equal(all[0],again[0]);assert.equal(images.length,2);
});

test('an unopened article never fetches its first detail image or video',()=>{
 const html=cardDetailHTML({label:'01',title:'Source',body:['A paragraph'],media:[
  {kind:'image',src:'./first.webp',after:0,caption:'First',width:1920,height:1080},
  {kind:'image',src:'./second.webp',after:1,caption:'Second'},
  {kind:'video',src:'./movie.mp4',poster:'./poster.webp',after:1,caption:'Clip'}
 ]});
 assert.equal((html.match(/data-media-src=/g)||[]).length,3);
 assert.doesNotMatch(html,/(?:<img|<video)[^>]*\ssrc=/);
 assert.match(html,/preload="none"/);assert.match(html,/width="1920" height="1080"/);
});

test('opening an article activates only nearby media and closing releases video sources',t=>{
 const nodes=[{dataset:{mediaSrc:'first.webp'}},{dataset:{mediaSrc:'second.webp'}},{dataset:{mediaSrc:'movie.mp4',mediaPoster:'poster.webp'},currentTime:2.5,pause(){this.paused=true;},load(){this.loads=(this.loads||0)+1;}}];
 for(const node of nodes){node.hasAttribute=name=>!!node[name];node.removeAttribute=name=>delete node[name];}
 const detail={querySelectorAll:()=>nodes},element={querySelector:()=>detail,querySelectorAll:selector=>selector==='video'?[nodes[2]]:nodes.slice(0,2)};
 let observer;
 installGlobal(t,'IntersectionObserver',class{constructor(callback,options){this.callback=callback;this.options=options;this.observed=[];observer=this;}observe(node){this.observed.push(node);}unobserve(node){this.observed=this.observed.filter(value=>value!==node);}disconnect(){this.disconnected=true;}});
 prepareCardMedia(element);assert.equal(observer.options.root,detail);assert.equal(observer.observed.length,3);assert.equal(nodes[0].src,undefined);
 observer.callback([{target:nodes[0],isIntersecting:true},{target:nodes[1],isIntersecting:false}]);
 assert.equal(nodes[0].src,'first.webp');assert.equal(nodes[1].src,undefined);
 observer.callback([{target:nodes[2],isIntersecting:true}]);assert.equal(nodes[2].src,'movie.mp4');assert.equal(nodes[2].poster,'poster.webp');
 stopCardMedia(element);assert.equal(observer.disconnected,true);assert.equal(nodes[2].paused,true);assert.equal(nodes[2].src,undefined);assert.equal(nodes[2].dataset.resumeTime,'2.5');assert.equal(nodes[0].src,undefined);
});
