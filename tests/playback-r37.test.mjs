import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {groupFilm} from '../scripts/group-film.mjs';
import {planFilmStartup,createFilmTransferMeter} from '../src/film-buffer-plan.mjs';
import {PresentationTransport} from '../src/transport-r07.mjs';
const sha=data=>createHash('sha256').update(data).digest('hex');

test('grouping and host re-grouping preserve every byte and original temporal boundary',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'film-group-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const dir=path.join(root,'assets/media/film-hd');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'init.bin'),Buffer.from([1,2]));
 const original=[];for(let i=0;i<5;i++){const data=Buffer.alloc(2*1024*1024,i+3),src='part-'+i+'.bin';original.push({src,start:i,duration:1,bytes:data.length,sha256:sha(data)});await fs.writeFile(path.join(dir,src),data);}
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({init:'init.bin',segments:original,streamBytes:2+10*1024*1024}));
 const first=await groupFilm(root);assert.equal(first.requests,2);
 const second=await groupFilm(root,{maxBytes:4900000,delivery:{maxConcurrent:4}});assert.equal(second.requests,3);assert.equal(first.streamSHA256,second.streamSHA256);
 const m=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 assert.deepEqual(m.segments.flatMap(s=>s.fragments),original.map(({src,...rest})=>rest));assert.equal(m.delivery.maxConcurrent,4);
});

test('the real film reserve survives a seven-second network outage at every measured link rate',async()=>{
 const m=JSON.parse(await fs.readFile(new URL('../assets/media/film-hd/manifest.json',import.meta.url),'utf8'));
 assert.ok(m.segments.length<20);assert.equal(m.segments[0].duration,1);assert.equal(m.hostingTransport.originalFragmentCount,52);
 for(const mbps of [5,12,25,60]){
  const rate=mbps*1e6/8,p=planFilmStartup(m,{bytesPerSecond:rate,confident:true,minimumSeconds:10,safetySeconds:7,rateMultiplier:.65});let cumulative=m.initBytes;
  for(const s of m.segments){cumulative+=s.bytes;assert.ok(p.bytes+rate*Math.max(0,s.start-7)>=cumulative,'the next grouped GOP arrives before its deadline after jitter');}
 }
});

test('delivery can require a third real sample while cache hits never imply a stable network',()=>{
 let time=0;const meter=createFilmTransferMeter({now:()=>time});meter.configure({minimumNetworkSamples:3});meter.cache(1e9);
 for(let i=0;i<3;i++){meter.start(i);time+=100;meter.add(i,1000);meter.end(i);assert.equal(meter.snapshot().confident,i===2);}
});

test('a stage uses the continuous original clock when occluded video frame callbacks stop',()=>{
 const video=new EventTarget();Object.assign(video,{readyState:3,currentTime:36.04,duration:52,paused:false,seeking:false,volume:1,muted:false,pause(){},play:async()=>{}});
 const transport=new PresentationTransport(video,video,{managedMedia:true});transport.phase='stage';transport.absolute=36.10;transport.presentedTime=36.01;
 assert.equal(transport.visualStageTime,.10000000000000142);transport.absolute=36.17;assert.equal(transport.visualTime,36.17);transport.dispose();
});

test('playback diagnostics subtract hidden warmup frames and count genuine post-start drops',async()=>{
 let q={totalVideoFrames:20,droppedVideoFrames:8};const video=new EventTarget();Object.assign(video,{readyState:3,currentTime:0,duration:52,paused:true,seeking:false,volume:1,muted:false,pause(){this.paused=true;},async play(){this.paused=false;},getVideoPlaybackQuality:()=>q});
 const transport=new PresentationTransport(video,video,{managedMedia:true});await transport.start();q={totalVideoFrames:120,droppedVideoFrames:9};const health=transport.playbackHealth();assert.equal(health.frames,100);assert.equal(health.dropped,1);assert.equal(health.droppedPercent,1);transport.dispose();
});

test('audio-only stage frames intentionally withheld from presentation do not count as visible film drops',async()=>{
 let q={totalVideoFrames:0,droppedVideoFrames:0};const video=new EventTarget();Object.assign(video,{readyState:3,currentTime:0,duration:52,paused:true,seeking:false,volume:1,muted:false,pause(){},play:async()=>{},getVideoPlaybackQuality:()=>q});
 const transport=new PresentationTransport(video,video,{managedMedia:true});await transport.start();q={totalVideoFrames:2160,droppedVideoFrames:1};transport.setPhase('stage');q={totalVideoFrames:3120,droppedVideoFrames:781};assert.equal(transport.playbackHealth().dropped,1);assert.equal(transport.playbackHealth().frames,2160);
 transport.setPhase('film');q={totalVideoFrames:3180,droppedVideoFrames:782};assert.equal(transport.playbackHealth().frames,2220);assert.equal(transport.playbackHealth().dropped,2);transport.dispose();
});

test('batched shader preparation bounds light-list traversals and preserves all scene parents',async()=>{
 const root=new URL('../',import.meta.url),file=new URL('../src/scene-warm.mjs',import.meta.url),html=await fs.readFile(new URL('index.html',root),'utf8'),map=JSON.parse(html.match(/<script type="importmap">([^]*?)<\/script>/)[1]).imports;
 const source=(await fs.readFile(file,'utf8')).replace(/from (['"])(three|\.\/[^'"]+)\1/g,(_,quote,spec)=>'from '+JSON.stringify(spec==='three'?new URL(map.three,root).href:new URL(spec,file).href));
 const [{warmScene},T]=await Promise.all([import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),import(new URL(map.three,root))]);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
 for(let i=0;i<17;i++){const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;scene.add(mesh);}
 const original=[...scene.children],calls=[];const renderer={target:null,getRenderTarget(){return this.target;},setRenderTarget(target){this.target=target;},initTexture(){},compileAsync(root,cam,lighting){calls.push(root);assert.equal(cam,camera);assert.equal(lighting,scene);return Promise.resolve();}};
 await warmScene(renderer,scene,camera);assert.ok(calls.length<=10,'the same lighting scene is not traversed once per glyph per pass');assert.deepEqual(scene.children,original);assert.ok(original.every(mesh=>mesh.parent===scene));assert.equal(renderer.target,null);geometry.dispose();material.dispose();
});
