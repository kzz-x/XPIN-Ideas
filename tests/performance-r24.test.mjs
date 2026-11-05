import test from 'node:test';
import assert from 'node:assert/strict';
import {preferCompatible,createFilmMedia} from '../src/film-media.mjs';
import {constrainedDevice,nextRasterScale} from '../src/performance-budget.mjs';
import {PresentationTransport} from '../src/transport-r07.mjs';

class Media extends EventTarget{
  constructor(){super();Object.assign(this,{duration:51.983333,currentTime:0,readyState:3,paused:true,seeking:false,ended:false,volume:1,muted:false,buffered:{length:0}});}
  play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}
}
test('low-memory, limited cores and slow/data-saver links choose compatible film',()=>{
  for(const x of [{memory:2,cores:8},{memory:8,cores:4},{connection:{saveData:true}},{connection:{effectiveType:'3g'}}])assert.equal(preferCompatible(x),true);
  assert.equal(preferCompatible({memory:8,cores:8,connection:{effectiveType:'4g'}}),false);assert.equal(preferCompatible({mobile:true,memory:8,cores:8}),true);
  assert.equal(constrainedDevice({memory:4,cores:8}),true);assert.equal(constrainedDevice({memory:8,cores:8}),false);
});
test('sustained slow frames lower raster cost promptly, while isolated stalls do not',()=>{
  assert.equal(nextRasterScale(Array(60).fill(80),1,3),.88);
  assert.equal(nextRasterScale([...Array(59).fill(16),350],1,3),1);
  assert.equal(nextRasterScale(Array(60).fill(40),.55,3),.55);
  assert.equal(nextRasterScale(Array(60).fill(16),.7,5),.7);
  assert.equal(nextRasterScale(Array(60).fill(16),.7,26),.74);
});
test('a not-ready decoder holds the original clock and resumes only after readiness',async()=>{
  let ready=false;const changes=[],v=new Media(),t=new PresentationTransport(v,new Media(),{canPlayAt:()=>ready,onBuffering:x=>changes.push(x)});
  await t.start(12);assert.equal(v.paused,true);assert.equal(t.waitingAt,'media');t.update(.05);assert.equal(t.currentTime,12);
  ready=true;t.update(.05);await Promise.resolve();assert.equal(v.paused,false);assert.equal(t.waitingAt,null);assert.deepEqual(changes,[true,false]);t.dispose();
});
test('decoder starvation pauses Dot with the film; pausing cancels automatic resume',async()=>{
  let ready=true;const v=new Media(),t=new PresentationTransport(v,new Media(),{canPlayAt:()=>ready});await t.start(38);
  ready=false;v.dispatchEvent(new Event('waiting'));assert.equal(t.waitingAt,'media');assert.equal(v.paused,true);
  t.pause();ready=true;t.update(.05);assert.equal(v.paused,true);assert.equal(t.playing,false);assert.equal(t.waitingAt,null);t.dispose();
});
test('a new seek replaces a pending media wait without resuming the old position',async()=>{
  let ready=false;const v=new Media(),t=new PresentationTransport(v,new Media(),{canPlayAt:()=>ready,canEnterStage:()=>true});await t.start(3);t.seek(40,{resume:false});ready=true;t.update(.05);
  assert.equal(t.currentTime,40);assert.equal(t.phase,'stage');assert.equal(t.playing,false);assert.equal(v.paused,true);t.dispose();
});
test('compatible preload waits for complete bytes and retries a temporary failure',async()=>{
  const originalFetch=globalThis.fetch,originalMSE=globalThis.MediaSource;
  const v=new Media();v.load=()=>{v.readyState=3;};v.videoWidth=1280;v.videoHeight=720;
  let release,calls=0;const blocked=new Promise(resolve=>release=resolve),manifest={duration:51.983333,segments:[],mobileFallback:'film.mp4',mobileBytes:3};
  globalThis.MediaSource=undefined;
  globalThis.fetch=async url=>{
    if(String(url).endsWith('manifest.json'))return new Response(JSON.stringify(manifest));
    calls++;if(calls===1)return new Response('',{status:503});await blocked;return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Length':'3'}});
  };
  const media=createFilmMedia(v,{manifestURL:'https://example.test/manifest.json'});
  try{
    let done=false;const loading=media.preparePlayback().then(()=>done=true);await new Promise(r=>setTimeout(r,400));assert.equal(done,false);assert.equal(media.snapshot().complete,false);assert.equal(media.canPlayAt(0),false);
    release();await loading;assert.equal(calls,2);assert.equal(media.snapshot().complete,true);assert.equal(media.snapshot().progress,1);assert.equal(media.canPlayAt(0),true);
  }finally{media.dispose();globalThis.fetch=originalFetch;globalThis.MediaSource=originalMSE;}
});
