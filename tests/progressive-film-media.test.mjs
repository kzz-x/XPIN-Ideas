import test from 'node:test';
import assert from 'node:assert/strict';
import {createFilmMedia,preferCompatible} from '../src/film-media.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('test operation did not settle');};
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
const manifest={duration:52,width:1920,height:1080,fps:60,mime:'video/mp4; codecs="avc1.640033, mp4a.40.2"',timestampOffset:-1/30,init:'init.bin',initBytes:2,file:'unused-hd.mp4',fileBytes:999,fileParts:[{src:'unused-hd.bin',bytes:999}],mobileFallback:'unused-mobile.mp4',mobileBytes:3,mobileParts:[{src:'mobile.bin',bytes:3}],segments:Array.from({length:26},(_,i)=>({src:'segment-'+i+'.bin',start:i*2,duration:2,bytes:20}))};

function fixture(t,{fetchSegment,downlink,supported=true}={}){
 const saved=new Map(['fetch','MediaSource','navigator'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)])),createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL;
 const requests=[],appended=[],loaded=new Set(),sources=[];let active=0,maxActive=0,totalFrames=0;
 const video=new EventTarget();
 const ranges=()=>{const spans=[];for(const i of [...loaded].sort((a,b)=>a-b)){const end=(i+1)*2,last=spans.at(-1);if(last&&last[1]===i*2)last[1]=end;else spans.push([i*2,end]);}return spans;};
 Object.assign(video,{currentTime:0,duration:NaN,readyState:0,videoWidth:1920,videoHeight:1080,volume:.15,muted:false,paused:true,seeking:false,load(){if(this.src==='blob:compatible'){this.duration=52;this.readyState=3;}},pause(){this.paused=true;},play(){this.paused=false;this.currentTime=.16;totalFrames+=10;return Promise.resolve();},getVideoPlaybackQuality(){return{totalVideoFrames:totalFrames,droppedVideoFrames:0};},buffered:{get length(){return ranges().length;},start:i=>ranges()[i][0],end:i=>ranges()[i][1]}});
 class SourceBuffer extends EventTarget{
  appendBuffer(data){assert.notEqual(this.updating,true,'append calls must stay serialized');this.updating=true;const marker=new Uint8Array(data)[0];appended.push(marker);if(marker!==255){loaded.add(marker-1);video.duration=52;video.readyState=3;}queueMicrotask(()=>{this.updating=false;this.dispatchEvent(new Event('updateend'));});}
 }
 class MediaSource extends EventTarget{
  static isTypeSupported(){return supported;}
  constructor(){super();this.readyState='closed';this.buffer=new SourceBuffer();sources.push(this);}
  addSourceBuffer(type){assert.equal(type,manifest.mime);return this.buffer;}
  endOfStream(){this.ended=(this.ended||0)+1;this.readyState='ended';}
 }
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{deviceMemory:16,hardwareConcurrency:8,...(downlink===undefined?{}:{connection:{downlink}})}});
 globalThis.MediaSource=MediaSource;
 URL.createObjectURL=value=>{if(value instanceof MediaSource){queueMicrotask(()=>{value.readyState='open';value.dispatchEvent(new Event('sourceopen'));});return'blob:progressive';}return'blob:compatible';};URL.revokeObjectURL=()=>{};
 globalThis.fetch=async(input,{signal}={})=>{
  const url=String(input),name=url.split('/').at(-1);requests.push(name);
  if(name==='manifest.json')return new Response(JSON.stringify(manifest));
  if(name==='init.bin')return new Response(new Uint8Array([255,255]));
  if(name==='mobile.bin')return new Response(new Uint8Array([9,8,7]));
  const index=Number(name.match(/^segment-(\d+)\.bin$/)?.[1]);assert.ok(Number.isInteger(index),'unexpected resource '+name);
  active++;maxActive=Math.max(maxActive,active);
  try{return fetchSegment?await fetchSegment(index,signal):new Response(new Uint8Array(20).fill(index+1));}finally{active--;}
 };
 const media=createFilmMedia(video,{manifestURL:'https://film.test/manifest.json'});
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

test('an explicit seek schedules its keyframe ahead of untouched background ranges and respects buffered gaps',async t=>{
 const blocked=deferred(),rest=deferred();const f=fixture(t,{fetchSegment:async(index,signal)=>{const gate=index===5||index===6?blocked:index>=7&&index<20?rest:null;if(gate)await Promise.race([gate.promise,new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))]);return new Response(new Uint8Array(20).fill(index+1));}});
 const background=f.media.prime();await f.media.preparePlayback();await wait(()=>f.requests.includes('segment-5.bin'));
 const before=f.requests.length,seeking=f.media.ensure(40.1,3);await tick();blocked.resolve();await seeking;
 const next=f.requests.slice(before);assert.ok(next.indexOf('segment-20.bin')>=0);assert.ok(next.indexOf('segment-21.bin')>=0);
 const nextLow=next.findIndex(name=>/^segment-(?:[7-9]|1\d)\.bin$/.test(name));
 assert.ok(nextLow<0||next.indexOf('segment-20.bin')<nextLow,'seek work must overtake untouched prefetch');
 assert.equal(f.media.canPlayAt(40),true);assert.equal(f.media.canPlayAt(25),false,'later downloads cannot cover a gap');
 rest.resolve();await background;assert.ok(f.maxActive<=2);
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

test('unsupported MSE retains complete mobile Blob playback and a late preflight never rewinds active video',async t=>{
 const f=fixture(t,{supported:false});await f.media.preparePlayback();
 assert.equal(f.media.snapshot().mode,'720p-compatible');assert.equal(f.media.snapshot().startupReady,true);assert.equal(f.media.snapshot().startupProgress,f.media.snapshot().downloadProgress);assert.equal(f.sources.length,0);
 assert.deepEqual(f.requests,['manifest.json','mobile.bin']);f.video.paused=false;f.video.currentTime=12;
 const probe=await f.media.preflightDecode();assert.equal(probe.skipped,true);assert.equal(f.video.currentTime,12);assert.equal(f.video.paused,false);
});

test('only a known positive downlink below three Mbps adds the low-bandwidth compatibility choice',()=>{
 const desktop={mobile:false,memory:16,cores:8};
 assert.equal(preferCompatible({...desktop,connection:{downlink:2.5}}),true);
 for(const downlink of [0,3,10,undefined,NaN,Infinity])assert.equal(preferCompatible({...desktop,connection:{downlink}}),false);
 assert.equal(preferCompatible({...desktop,connection:undefined}),false);
});
