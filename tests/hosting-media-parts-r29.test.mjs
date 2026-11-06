import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createFilmMedia} from '../src/film-media.mjs';
import {splitHostingMedia} from '../scripts/split-hosting-media.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(t,{manifest,fetchPart,constrained=false}={}){
  const oldFetch=globalThis.fetch,oldURL=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,nav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  let blob;const requests=[],video=new EventTarget();
  Object.assign(video,{currentTime:0,duration:52,readyState:3,videoWidth:1920,videoHeight:1080,buffered:{length:0},volume:.15,muted:false,paused:true,seeking:false,load(){},pause(){this.paused=true;},play(){this.paused=false;this.currentTime=2.6;return Promise.resolve();}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{deviceMemory:constrained?2:16,hardwareConcurrency:8}});
  URL.createObjectURL=value=>{blob=value;return'blob:parts-test';};URL.revokeObjectURL=()=>{};
  globalThis.fetch=async(input,options)=>{const url=String(input);requests.push(url);if(url.endsWith('manifest.json'))return new Response(JSON.stringify(manifest));return fetchPart(url,options);};
  const media=createFilmMedia(video,{manifestURL:'https://film.test/manifest.json'});
  t.after(()=>{media.dispose();globalThis.fetch=oldFetch;URL.createObjectURL=oldURL;URL.revokeObjectURL=oldRevoke;if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;});
  return{media,video,requests,get blob(){return blob;}};
}
const manifest={file:'old-hd.mp4',fileBytes:6,duration:52,width:1920,height:1080,fps:60,segments:[],fileParts:[{src:'p1.bin',bytes:2},{src:'p2.bin',bytes:2},{src:'p3.bin',bytes:2}]};

test('bounded part downloads assemble original byte order and deduplicate homepage/playback preparation',async t=>{
  let active=0,maxActive=0;
  const f=fixture(t,{manifest,fetchPart:async url=>{active++;maxActive=Math.max(maxActive,active);const index=Number(url.match(/p(\d)/)[1]);await delay(index===1?25:2);active--;return new Response(new Uint8Array([index*2-1,index*2]));}});
  const homepage=f.media.prime(),playback=f.media.preparePlayback();await delay(5);
  assert.equal(f.media.snapshot().complete,false);assert.equal(f.media.canPlayAt(0),false);
  await Promise.all([homepage,playback]);
  assert.deepEqual([...new Uint8Array(await f.blob.arrayBuffer())],[1,2,3,4,5,6]);assert.equal(f.blob.type,'video/mp4');
  assert.equal(maxActive,2);assert.equal(f.requests.length,4);assert.ok(!f.requests.some(r=>r.endsWith('.mp4')));
  assert.equal(f.media.snapshot().bytes,6);assert.equal(f.media.snapshot().totalBytes,6);assert.equal(f.media.snapshot().complete,true);
  await f.media.prime();assert.equal(f.requests.length,4);
});

test('compatible devices assemble mobile parts and keep decode preflight silent and cached',async t=>{
  const f=fixture(t,{constrained:true,manifest:{...manifest,mobileFallback:'old-mobile.mp4',mobileBytes:3,mobileParts:[{src:'m1.bin',bytes:2},{src:'m2.bin',bytes:1}]},fetchPart:async url=>new Response(new Uint8Array(url.endsWith('m1.bin')?[9,8]:[7]))});
  await f.media.preparePlayback();assert.equal(f.media.snapshot().mode,'720p-compatible');
  assert.deepEqual([...new Uint8Array(await f.blob.arrayBuffer())],[9,8,7]);assert.ok(f.requests.every(r=>!r.includes('p1.bin')&&!r.endsWith('.mp4')));
  const first=await f.media.preflightDecode(),second=await f.media.preflightDecode();assert.equal(second,first);assert.equal(f.requests.length,3);
  assert.equal(f.video.currentTime,0);assert.equal(f.video.paused,true);assert.equal(f.video.volume,.15);assert.equal(f.video.muted,false);
});

test('a failed part leaves no playable partial film and reuses finished parts on retry',async t=>{
  let failures=3;
  const f=fixture(t,{manifest:{...manifest,fileBytes:4,fileParts:manifest.fileParts.slice(0,2)},fetchPart:async url=>{
    if(url.endsWith('p2.bin')&&failures-->0)return new Response('failed',{status:503});
    return new Response(new Uint8Array(url.endsWith('p1.bin')?[1,2]:[3,4]));
  }});
  await assert.rejects(f.media.prime(),/HTTP 503/);assert.equal(f.media.snapshot().complete,false);assert.equal(f.blob,undefined);
  await f.media.prime();assert.equal(f.requests.filter(r=>r.endsWith('p1.bin')).length,1);
  assert.deepEqual([...new Uint8Array(await f.blob.arrayBuffer())],[1,2,3,4]);assert.equal(f.media.snapshot().bytes,4);
});

test('disposing during multipart download aborts active requests and never creates a video Blob',async t=>{
  let abortedRequests=0;
  const f=fixture(t,{manifest,fetchPart:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{abortedRequests++;reject(signal.reason);},{once:true}))});
  const loading=f.media.prime();await delay(5);f.media.dispose();await assert.rejects(loading,/abort/i);
  assert.equal(abortedRequests,2);assert.equal(f.requests.length,3);assert.equal(f.blob,undefined);assert.equal(f.media.snapshot().complete,false);
});

test('splitter preserves original files, hashes every bounded part and can rerun on extracted static output',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'linggan-host-parts-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const mediaDir=path.join(root,'assets/media'),manifestDir=path.join(mediaDir,'film-hd');await fs.mkdir(manifestDir,{recursive:true});
  const hd=Buffer.from(Array.from({length:27},(_,i)=>i)),mobile=Buffer.from([9,8,7,6,5]);
  await fs.writeFile(path.join(mediaDir,'film-hd.mp4'),hd);await fs.writeFile(path.join(mediaDir,'film-mobile.mp4'),mobile);
  await fs.writeFile(path.join(manifestDir,'manifest.json'),JSON.stringify({file:'../film-hd.mp4',mobileFallback:'../film-mobile.mp4',fileBytes:hd.length,mobileBytes:mobile.length,segments:[]}));
  const first=await splitHostingMedia(root,{partBytes:8}),stored=JSON.parse(await fs.readFile(path.join(manifestDir,'manifest.json'),'utf8'));
  assert.ok(first.files.every(f=>f.assemblyMatchesOriginal&&f.largestPartBytes<=8));
  for(const [bytes,key,parts]of[[hd,'fileSha256','fileParts'],[mobile,'mobileSha256','mobileParts']]){
    const sha=createHash('sha256').update(bytes).digest('hex');assert.equal(stored[key],sha);
    assert.ok(stored[parts].every(p=>p.src.includes(sha.slice(0,12))));
    const assembled=Buffer.concat(await Promise.all(stored[parts].map(p=>fs.readFile(path.resolve(manifestDir,p.src)))));assert.deepEqual(assembled,bytes);
  }
  assert.deepEqual(await fs.readFile(path.join(mediaDir,'film-hd.mp4')),hd);
  await fs.unlink(path.join(mediaDir,'film-hd.mp4'));await fs.unlink(path.join(mediaDir,'film-mobile.mp4'));
  const second=await splitHostingMedia(root,{partBytes:8});assert.deepEqual(second.files,first.files);
});
