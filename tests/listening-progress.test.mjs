import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createFilmMedia} from '../src/film-media.mjs';
import {ListeningGate} from '../src/listening-gate.mjs';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){
  const started=performance.now();
  while(!predicate()){
    if(performance.now()-started>3000)assert.fail('Timed out waiting for '+label);
    await pause(5);
  }
}

// Use the real fetch/ReadableStream over a local HTTP connection. Each response
// can stall with its headers already received, independently of gate frame time.
async function streamedFilm(t,{parts}={}){
  const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{deviceMemory:16,hardwareConcurrency:8}});
  const responses=new Map(),jobs=[];
  const manifest={file:'film.mp4',fileBytes:10,duration:52,width:1920,height:1080,fps:60,segments:[],
    ...(parts?{fileParts:parts.map(([src,bytes])=>({src,bytes}))}:{})};
  const sizes=new Map(parts||[['film.mp4',10]]);
  const server=createServer((request,response)=>{
    const filename=new URL(request.url,'http://local.test').pathname.slice(1);
    if(filename==='manifest.json'){
      response.writeHead(200,{'Content-Type':'application/json'});
      response.end(JSON.stringify(manifest));return;
    }
    if(!sizes.has(filename)){response.writeHead(404);response.end();return;}
    response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':sizes.get(filename),'Connection':'close'});
    response.flushHeaders();
    responses.set(filename,response);
  });
  let media;
  t.after(async()=>{
    media?.dispose();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    await Promise.allSettled(jobs);
    if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const video=new EventTarget();
  Object.assign(video,{currentTime:0,duration:52,readyState:0,videoWidth:1920,videoHeight:1080,
    buffered:{length:0},paused:true,load(){},pause(){this.paused=true;}});
  media=createFilmMedia(video,{manifestURL:`http://127.0.0.1:${server.address().port}/manifest.json`});
  const loading=media.prime();loading.catch(()=>{});jobs.push(loading);
  await until(()=>responses.size===sizes.size&&media.snapshot().mode==='1080p-file','film response headers');
  return{media,video,responses,loading};
}

function advanceCue(gate,media,seconds){
  for(let remaining=seconds;remaining>0;remaining-=.1){
    gate.update(Math.min(.1,remaining),{progress:media.snapshot().downloadProgress});
  }
  return gate.update(0,{progress:media.snapshot().downloadProgress});
}

test('a stalled film keeps real byte progress while elapsed cue time cannot finish download or readiness',async t=>{
  const {media,video,responses,loading}=await streamedFilm(t);
  const gate=new ListeningGate(2),response=responses.get('film.mp4');
  assert.equal(media.snapshot().bytes,0);
  assert.equal(media.snapshot().totalBytes,10);
  assert.equal(media.snapshot().downloadProgress,0);
  let state=advanceCue(gate,media,12);
  assert.equal(state.progress,0,'headers and twelve elapsed seconds are not downloaded video bytes');
  assert.equal(state.done,false);

  response.write(new Uint8Array([1,2]));
  await until(()=>media.snapshot().bytes===2,'first two streamed bytes');
  state=advanceCue(gate,media,.1);
  assert.equal(media.snapshot().downloadProgress,.2);
  assert.equal(state.progress,.2);
  state=advanceCue(gate,media,30);
  assert.equal(state.progress,.2,'a stream stalled at 20% must not drift toward 96%');
  assert.equal(state.done,false);

  response.write(new Uint8Array([3,4,5]));
  await until(()=>media.snapshot().bytes===5,'five streamed bytes');
  assert.equal(advanceCue(gate,media,.1).progress,.5);

  response.end(new Uint8Array([6,7,8,9,10]));
  await until(()=>media.snapshot().bytes===10&&video.src?.startsWith('blob:'),'all bytes and assembled Blob');
  assert.equal(media.snapshot().downloadProgress,1,'100% represents all bytes, even before the first frame decodes');
  assert.equal(media.snapshot().complete,false,'decoder readiness is still deliberately held');
  state=advanceCue(gate,media,8);
  assert.equal(state.progress,1);
  assert.equal(state.done,false,'download completion cannot substitute for media/world readiness');

  video.readyState=3;
  await loading;
  assert.equal(media.snapshot().complete,true);
  assert.equal(advanceCue(gate,media,.1).done,false,'world readiness may still be pending after decode');
  gate.ready=true;
  assert.equal(advanceCue(gate,media,0).done,true);

  gate.reset();
  assert.equal(gate.snapshot().progress,0);
  assert.equal(gate.snapshot().done,false);
  gate.ready=true;
  state=advanceCue(gate,media,.1);
  assert.equal(state.progress,1,'an already downloaded film stays at 100% on re-entry');
  assert.equal(state.done,false,'the minimum headphone cue still runs independently');
  assert.equal(advanceCue(gate,media,3).done,true);
});

test('multipart listening progress includes concurrent partial chunks once, without a time-driven bar',async t=>{
  const {media,video,responses,loading}=await streamedFilm(t,{parts:[['first.bin',4],['second.bin',6]]});
  const gate=new ListeningGate(2);
  responses.get('first.bin').write(new Uint8Array([1,2]));
  responses.get('second.bin').write(new Uint8Array([5,6,7]));
  await until(()=>media.snapshot().bytes===5,'partial bytes from both active part responses');
  assert.equal(media.snapshot().downloadProgress,.5);
  let state=gate.update(.1,{paused:true,progress:media.snapshot().downloadProgress});
  assert.equal(state.elapsed,0);
  assert.equal(state.progress,.5,'pausing the cue cannot hide actual received bytes');
  assert.equal(advanceCue(gate,media,15).progress,.5);

  responses.get('first.bin').end(new Uint8Array([3,4]));
  await until(()=>media.snapshot().events.some(event=>event.event==='file-part-ready'&&event.index===0),'first part committed');
  assert.equal(media.snapshot().bytes,7,'committed first part plus partial second part are counted once');
  assert.equal(media.snapshot().downloadProgress,.7);
  assert.equal(advanceCue(gate,media,10).progress,.7);

  responses.get('second.bin').end(new Uint8Array([8,9,10]));
  await until(()=>media.snapshot().bytes===10&&video.src?.startsWith('blob:'),'ordered multipart Blob');
  state=advanceCue(gate,media,3);
  assert.equal(state.progress,1);
  assert.equal(state.done,false);
  assert.equal(media.snapshot().complete,false);
  video.readyState=3;
  await loading;
  gate.ready=true;
  assert.equal(advanceCue(gate,media,0).done,true);
});
