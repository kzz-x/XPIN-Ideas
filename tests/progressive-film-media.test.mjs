import test from 'node:test';
import assert from 'node:assert/strict';
import {createFilmMedia} from '../src/film-media.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('test operation did not settle');};
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
const manifest={duration:52,width:1920,height:1080,fps:60,mime:'video/mp4; codecs="avc1.640033, mp4a.40.2"',timestampOffset:-1/30,init:'init.bin',initBytes:2,file:'unused-hd.mp4',fileBytes:999,fileParts:[{src:'unused-hd.bin',bytes:999}],mobileFallback:'unused-mobile.mp4',mobileBytes:3,mobileParts:[{src:'mobile.bin',bytes:3}],segments:Array.from({length:26},(_,i)=>({src:'segment-'+i+'.bin',start:i*2,duration:2,bytes:20}))};

function fixture(t,{fetchSegment,downlink,supported=true,quotaAt=-1,adaptive=false,deviceHints={}}={}){
 const saved=new Map(['fetch','MediaSource','navigator'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)])),createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL;
 const requests=[],appended=[],loaded=new Set(),sources=[];let active=0,maxActive=0,totalFrames=0;
 const video=new EventTarget();
 const ranges=()=>{const spans=[];for(const i of [...loaded].sort((a,b)=>a-b)){const end=(i+1)*2,last=spans.at(-1);if(last&&last[1]===i*2)last[1]=end;else spans.push([i*2,end]);}return spans;};
 Object.assign(video,{currentTime:0,duration:NaN,readyState:0,videoWidth:1920,videoHeight:1080,volume:.15,muted:false,paused:true,seeking:false,load(){if(this.src==='blob:compatible'){this.duration=52;this.readyState=3;}},pause(){this.paused=true;},play(){this.paused=false;this.currentTime=.16;totalFrames+=10;return Promise.resolve();},getVideoPlaybackQuality(){return{totalVideoFrames:totalFrames,droppedVideoFrames:0};},buffered:{get length(){return ranges().length;},start:i=>ranges()[i][0],end:i=>ranges()[i][1]}});
 class SourceBuffer extends EventTarget{
  appendBuffer(data){assert.notEqual(this.updating,true,'append calls must stay serialized');const marker=new Uint8Array(data)[0];if(marker!==255&&marker-1===quotaAt)throw new DOMException('buffer full','QuotaExceededError');this.updating=true;appended.push(marker);if(marker!==255){loaded.add(marker-1);video.duration=52;video.readyState=3;}queueMicrotask(()=>{this.updating=false;this.dispatchEvent(new Event('updateend'));});}
 }
 class MediaSource extends EventTarget{
  static isTypeSupported(){return supported;}
  constructor(){super();this.readyState='closed';this.buffer=new SourceBuffer();sources.push(this);}
  addSourceBuffer(type){assert.equal(type,manifest.mime);return this.buffer;}
  endOfStream(){this.ended=(this.ended||0)+1;this.readyState='ended';}
 }
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{deviceMemory:16,hardwareConcurrency:8,...(downlink===undefined?{}:{connection:{downlink}}),...deviceHints}});
 globalThis.MediaSource=MediaSource;
 URL.createObjectURL=value=>{if(value instanceof MediaSource){queueMicrotask(()=>{value.readyState='open';value.dispatchEvent(new Event('sourceopen'));});return'blob:progressive';}return'blob:compatible';};URL.revokeObjectURL=()=>{};
 globalThis.fetch=async(input,{signal}={})=>{
  const url=String(input),name=url.split('/').at(-1);requests.push(name);
  if(name==='manifest.json')return new Response(JSON.stringify({...manifest,...(adaptive?{qualityPolicy:'preserve-source'}:{})}));
  if(name==='init.bin')return new Response(new Uint8Array([255,255]));
  if(name==='mobile.bin')return new Response(new Uint8Array([9,8,7]));
  const index=Number(name.match(/^segment-(\d+)\.bin$/)?.[1]);assert.ok(Number.isInteger(index),'unexpected resource '+name);
  active++;maxActive=Math.max(maxActive,active);
  try{return fetchSegment?await fetchSegment(index,signal):new Response(new Uint8Array(20).fill(index+1));}finally{active--;}
 };
 const media=createFilmMedia(video,{manifestURL:'https://film.test/manifest.json',cacheEnabled:false});
 t.after(()=>{media.dispose();for(const[name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL;});
 return{media,video,requests,appended,loaded,sources,get maxActive(){return maxActive;}};
}

test('first playback and short decode warm-up finish from ten seconds while the same decoder continues downloading',async t=>{
 const rest=deferred();const f=fixture(t,{fetchSegment:async(index,signal)=>{if(index>=5)await Promise.race([rest.promise,new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))]);return new Response(new Uint8Array(20).fill(index+1));}});
 let finished=false;const background=f.media.prime().then(()=>finished=true);await f.media.preparePlayback();
 const m=f.media.snapshot();assert.equal(m.mode,'1080p-segments');assert.equal(m.complete,false);assert.equal(finished,false);
 assert.equal(m.startupProgress,1);assert.equal(m.startupReady,true);assert.equal(m.playbackReady,true);assert.equal(m.startupBufferSeconds,8);
 assert.equal(m.startupTotalBytes,102);assert.equal(m.startupBytes,102);assert.ok(m.downloadProgress<1);assert.equal(m.totalBytes,522);
 assert.equal(f.media.canPlayAt(0),true);assert.equal(f.media.canPlayAt(16),false);assert.equal(f.sources[0].buffer.timestampOffset,-1/30);
 const probe=await f.media.preflightDecode();assert.equal(probe.seconds,.16);assert.equal(probe.frames,10);assert.equal(await f.media.preflightDecode(),probe);
 assert.equal(f.video.currentTime,0);assert.equal(f.video.paused,true);assert.equal(f.video.muted,false);assert.equal(f.video.volume,.15);assert.equal(finished,false);
 rest.resolve();await background;assert.equal(f.media.snapshot().complete,true);assert.equal(f.media.snapshot().downloadProgress,1);assert.equal(f.sources[0].ended,1);
 assert.equal(new Set(f.requests).size,f.requests.length,'homepage, preflight and playback deduplicate every request');assert.ok(f.maxActive<=2);
 assert.ok(!f.requests.some(name=>name.includes('unused-')),'a progressive manifest must not select its legacy HD file fields');
});

test('parallel downloads append chronologically even when later fragments finish first',async t=>{
 const finished=[];const f=fixture(t,{fetchSegment:async index=>{
  await new Promise(resolve=>setTimeout(resolve,index>0&&index%2===0?20:1));finished.push(index);
  return new Response(new Uint8Array(20).fill(index+1));
 }});
 await f.media.prime();
 assert.ok(finished.indexOf(3)<finished.indexOf(2),'the fixture must actually finish the later fragment first');
 assert.deepEqual(f.appended,[255,...Array.from({length:26},(_,i)=>i+1)]);
 assert.equal(f.media.snapshot().bufferComplete,true);assert.ok(f.maxActive<=2);
});

test('an explicit seek fills its chronological prefix without accumulating the whole future film in memory',async t=>{
 const blocked=deferred(),rest=deferred();const f=fixture(t,{fetchSegment:async(index,signal)=>{const gate=index===5||index===6?blocked:index>=7&&index<20?rest:null;if(gate)await Promise.race([gate.promise,new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))]);return new Response(new Uint8Array(20).fill(index+1));}});
 const background=f.media.prime();await f.media.preparePlayback();await wait(()=>f.requests.includes('segment-5.bin'));
 let seekReady=false;const before=f.requests.length,seeking=f.media.ensure(40.1,3).then(()=>seekReady=true);await tick();blocked.resolve();
 await tick();await tick();
 assert.equal(seekReady,false,'a future fragment must wait for its missing chronological prefix');
 assert.ok(!f.appended.includes(21),'never insert the future GOP before older frames');
 const next=f.requests.slice(before);assert.ok(!next.includes('segment-20.bin')&&!next.includes('segment-21.bin'),'far-future bytes are not retained while an earlier prefix is blocked');
 assert.equal(f.media.canPlayAt(40),false,'downloaded bytes cannot cover an unappended prefix');
 assert.equal(f.media.snapshot().bufferComplete,false);
 rest.resolve();await seeking;assert.equal(f.media.canPlayAt(40),true);await background;assert.ok(f.maxActive<=2);
 assert.deepEqual(f.appended,[255,...Array.from({length:26},(_,i)=>i+1)]);
});

test('an exhausted earlier download never permits later insertion and retry resumes the original timeline',async t=>{
 let failures=3;const f=fixture(t,{fetchSegment:async index=>index===2&&failures-->0?new Response('temporary',{status:503}):new Response(new Uint8Array(20).fill(index+1))});
 await assert.rejects(f.media.preparePlayback(),/HTTP 503/);await tick();
 assert.deepEqual(f.appended,[255,1,2],'later downloaded fragments must remain cached behind the failed index');
 assert.equal(f.media.snapshot().bufferComplete,false);assert.equal(f.media.snapshot().complete,false);
 await f.media.preparePlayback();await f.media.prime();
 assert.deepEqual(f.appended,[255,...Array.from({length:26},(_,i)=>i+1)]);
 assert.equal(f.requests.filter(name=>name==='segment-2.bin').length,4);
 assert.equal(f.requests.filter(name=>name==='segment-3.bin').length,1,'completed future downloads are reused');
 assert.equal(f.media.snapshot().bufferComplete,true);
});

test('adaptive preparation retries a failed startup fragment instead of rejecting a stale error',async t=>{
 let failures=3;const f=fixture(t,{adaptive:true,fetchSegment:async index=>index===1&&failures-->0?new Response('temporary',{status:503}):new Response(new Uint8Array(20).fill(index+1))});
 await assert.rejects(f.media.preparePlayback(),/HTTP 503/);await tick();
 await f.media.preparePlayback();await f.media.prime();
 assert.equal(f.media.snapshot().error,null);assert.equal(f.media.snapshot().complete,true);
 assert.deepEqual(f.appended,[255,...Array.from({length:26},(_,i)=>i+1)]);
});

test('adaptive readiness does not count the tiny initialization file as a second network sample',async t=>{
 const release=deferred();const f=fixture(t,{adaptive:true,fetchSegment:async(index,signal)=>{if(index>0)await Promise.race([release.promise,new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))]);return new Response(new Uint8Array(20).fill(index+1));}});
 const job=f.media.prime();await f.media.open();const state=f.media.snapshot();
 assert.equal(state.transfer.networkSamples,1);assert.equal(state.throughputConfident,false);assert.equal(state.startupReady,false);
 release.resolve();await job;
});

test('startup progress counts incoming partial bytes without pretending the whole film is downloaded',async t=>{
 let controller;const gate=deferred();const f=fixture(t,{fetchSegment:async index=>{
  if(index!==0)return new Response(new Uint8Array(20).fill(index+1));
  return new Response(new ReadableStream({start(c){controller=c;c.enqueue(new Uint8Array(10).fill(1));gate.resolve();}}));
 }});
 const startup=f.media.preparePlayback();await gate.promise;await tick();
 const m=f.media.snapshot();assert.equal(m.startupBytes,12);assert.equal(m.startupTotalBytes,102);assert.equal(m.startupProgress,12/102);assert.equal(m.downloadProgress,12/522);assert.equal(m.startupReady,false);
 controller.enqueue(new Uint8Array(10).fill(1));controller.close();await startup;
});

test('unsupported MSE assembles the same original fragments and a late preflight never rewinds active video',async t=>{
 const f=fixture(t,{supported:false});await f.media.preparePlayback();
 assert.equal(f.media.snapshot().mode,'1080p-compatible');assert.equal(f.media.snapshot().startupReady,true);assert.equal(f.media.snapshot().startupProgress,f.media.snapshot().downloadProgress);assert.equal(f.sources.length,0);
 assert.equal(f.requests.length,28);assert.ok(!f.requests.includes('mobile.bin'));f.video.paused=false;f.video.currentTime=12;
 const probe=await f.media.preflightDecode();assert.equal(probe.skipped,true);assert.equal(f.video.currentTime,12);assert.equal(f.video.paused,false);
});

test('slow-link, data-saving and constrained hardware hints never select a lower-quality rendition',async t=>{
 const f=fixture(t,{downlink:.5,deviceHints:{deviceMemory:2,hardwareConcurrency:2,connection:{saveData:true,effectiveType:'2g',downlink:.5}}});await f.media.preparePlayback();await f.media.prime();
 assert.equal(f.media.snapshot().mode,'1080p-segments');assert.ok(!f.requests.includes('mobile.bin'));
});

test('quota fallback preserves the active original clock at the moment the original Blob is ready',async t=>{
 const release=deferred(),quota=deferred(),seen=deferred();let blocked=false;
 const f=fixture(t,{quotaAt:8,fetchSegment:async(index,signal)=>{if(index===8)await quota.promise;if(index===12&&!blocked){blocked=true;seen.resolve();await Promise.race([release.promise,new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))]);}return new Response(new Uint8Array(20).fill(index+1));}});
 const job=f.media.prime();await f.media.preparePlayback();f.video.currentTime=9;f.video.paused=false;f.video.play=async()=>{f.video.paused=false;};
 quota.resolve();
 await seen.promise;assert.equal(f.video.paused,false);assert.equal(f.video.src,'blob:progressive');
 f.video.currentTime=12.5;release.resolve();await job;
 assert.equal(f.media.snapshot().mode,'1080p-compatible');assert.equal(f.video.paused,false);
 assert.equal(f.video.currentTime,12.5+1/30);assert.equal(f.media.timeOffset,1/30);assert.equal(f.video.volume,.15);assert.equal(f.video.muted,false);
 assert.ok(!f.requests.includes('mobile.bin'));
});

test('a manual ensure waits for original-quality quota recovery even without a background prime',async t=>{
 const f=fixture(t,{quotaAt:2});await f.media.open();
 await f.media.ensure(12,3);
 assert.equal(f.media.snapshot().mode,'1080p-compatible');assert.equal(f.media.snapshot().complete,true);assert.equal(f.video.paused,true);assert.ok(!f.requests.includes('mobile.bin'));
});

test('a seek during quota recovery joins the pending conversion before the Blob job exists',async t=>{
 const quota=deferred(),other=deferred();let held=false;
 const f=fixture(t,{quotaAt:8,fetchSegment:async index=>{
   if(index===8)await quota.promise;
   if(index===9&&!held){held=true;await other.promise;}
   return new Response(new Uint8Array(20).fill(index+1));
 }});
 const job=f.media.prime();await f.media.preparePlayback();await wait(()=>f.requests.includes('segment-9.bin'));
 quota.resolve();await wait(()=>f.media.snapshot().converting);
 let settled=false;const seeking=f.media.ensure(20,3).then(()=>settled=true);await tick();assert.equal(settled,false);
 other.resolve();await Promise.all([job,seeking]);assert.equal(settled,true);assert.equal(f.media.snapshot().mode,'1080p-compatible');
});
