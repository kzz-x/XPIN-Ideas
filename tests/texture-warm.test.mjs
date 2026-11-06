import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {warmTextures} from '../src/texture-warm.mjs';

test('texture warmup uploads every original once, at most four per paint, and yields after the last batch',async()=>{
 const textures=Array.from({length:11},(_,id)=>({id,width:2048,height:1024})),events=[],progress=[],target={id:'visible-target'};
 const renderer={target,initTexture(texture){events.push(texture);assert.equal(this.target,target);}};
 const count=await warmTextures(renderer,textures,{now:()=>0,nextFrame:async()=>events.push('paint'),onUploaded:(n,total)=>progress.push([n,total])});
 assert.equal(count,11);assert.deepEqual(events,[...textures.slice(0,4),'paint',...textures.slice(4,8),'paint',...textures.slice(8),'paint']);
 assert.deepEqual(progress,textures.map((_,i)=>[i+1,11]));assert.ok(textures.every(texture=>texture.width===2048&&texture.height===1024));assert.equal(renderer.target,target);
});

test('the elapsed upload budget yields before reaching the four-texture cap',async()=>{
 let clock=0;const events=[],costs=[1.5,1.5,6,1,1,1,1];
 await warmTextures({initTexture(index){events.push(index);clock+=costs[index];}},costs.map((_,i)=>i),{now:()=>clock,nextFrame:async()=>{events.push('paint');clock+=16.7;}});
 assert.deepEqual(events,[0,1,'paint',2,'paint',3,4,5,'paint',6,'paint']);
});

test('an upload failure stops further work and does not report the failed texture as ready',async()=>{
 const completed=[],uploaded=[];
 await assert.rejects(warmTextures({initTexture(texture){uploaded.push(texture);if(texture===2)throw Error('driver upload failed');}},[1,2,3],{now:()=>0,nextFrame:async()=>{},onUploaded:n=>completed.push(n)}),/driver upload failed/);
 assert.deepEqual(uploaded,[1,2]);assert.deepEqual(completed,[1]);
});

// Node has no browser import map. Resolve only this module's static imports to
// the same files selected by index.html, then execute its unchanged functions.
async function sceneModule(){
 const file=new URL('../src/scene-warm.mjs',import.meta.url),root=new URL('../',import.meta.url),html=await fs.readFile(new URL('index.html',root),'utf8');
 const map=JSON.parse(html.match(/<script type="importmap">([^]*?)<\/script>/)[1]).imports;
 const source=(await fs.readFile(file,'utf8')).replace(/from (['"])(three|\.\/[^'"]+)\1/g,(_,quote,spec)=>'from '+JSON.stringify(spec==='three'?new URL(map.three,root).href:new URL(spec,file).href));
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}

test('scene warmup preserves render targets and shader passes after deduplicated texture uploads',async t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame'),events=[],progress=[];
 Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:callback=>setImmediate(()=>{events.push('paint');callback();})});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'requestAnimationFrame',original);else delete globalThis.requestAnimationFrame;});
 const {warmScene}=await sceneModule(),map={isTexture:true},normal={isTexture:true},video={isTexture:true,isVideoTexture:true},saved={name:'existing-render-target'};
 const a={id:'a',material:{map,video},castShadow:true,layers:{},clone(){return{...this};}},b={id:'b',material:{map,normal},layers:{}};
 const scene={traverse(visit){visit(a);visit(b);}},camera={layers:{test:()=>true}},renderer={target:saved,getRenderTarget(){return this.target;},setRenderTarget(value){this.target=value;},initTexture(texture){events.push(texture);},compileAsync(object,cam,lightingScene){
  events.push({object:object.id,target:this.target,shadow:object.material?.isMeshDepthMaterial===true});assert.equal(cam,camera);assert.equal(lightingScene,scene);
  return Promise.resolve().then(()=>assert.equal(this.target,saved,'the visible target must be restored before awaiting compilation'));
 }};
 await warmScene(renderer,scene,camera,{onProgress:value=>progress.push(value)});
 assert.deepEqual(events.slice(0,3),[map,normal,'paint']);assert.equal(events.filter(event=>event===map).length,1);assert.ok(!events.includes(video));
 const compiles=events.filter(event=>event?.object);assert.equal(compiles.length,5);assert.deepEqual(compiles.map(event=>event.object),['a','b','a','b','a']);
 assert.equal(compiles[0].target,null);assert.equal(compiles[1].target,null);assert.ok(compiles[2].target?.isWebGLRenderTarget);assert.equal(compiles[4].shadow,true);
 assert.equal(renderer.target,saved);assert.equal(progress[0],0);assert.equal(progress.at(-1),1);assert.ok(progress.every((value,index)=>index===0||value>=progress[index-1]));
});
