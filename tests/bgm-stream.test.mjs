import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreamingBgm} from '../src/bgm-stream.mjs';

class Param{constructor(value=0){this.value=value;}cancelAndHoldAtTime(){}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}}
class Context extends EventTarget{
 constructor({blocked=false}={}){super();this.currentTime=0;this.sampleRate=48000;this.state=blocked?'suspended':'running';this.allowed=!blocked;this.destination={};this.nodes=[];}
 createGain(){return{gain:new Param(1),connect(){return this;},disconnect(){}};}
 createBufferSource(){const o={connect(){return this;},disconnect(){},start(at,offset,duration){Object.assign(this,{at,offset,end:at+duration});},stop(at){this.end=Math.min(this.end??Infinity,at);}};this.nodes.push(o);return o;}
 decodeAudioData(data){const frames=new DataView(data).getUint32(0);return Promise.resolve({duration:frames/48000,length:frames});}
 resume(){if(!this.allowed)return new Promise(()=>{});this.state='running';this.dispatchEvent(new Event('statechange'));return Promise.resolve();}
 advance(seconds){this.currentTime=seconds;for(const n of this.nodes)if(n.end<=seconds&&!n.ended){n.ended=true;n.onended?.();}}
}
function fixture({blocked=false,late=false}={}){
 const context=new Context({blocked}),tracks={},pending=[];
 for(const[name,count]of[['intro',2],['loop',3],['outro',1]])tracks[name]={frames:count*96000,duration:count*2,chunks:Array.from({length:count},(_,i)=>({src:name+'-'+i+'.flac',startFrame:i*96000,frames:96000}))};
 const manifest={sampleRate:48000,lossless:true,tracks,gates:[{seconds:1},{seconds:3},{seconds:5}]};
 globalThis.location=new URL('https://audio.test/');globalThis.localStorage={getItem(){return null;},setItem(){}};
 const fetcher=async url=>{if(String(url).includes('manifest'))return{ok:true,json:async()=>manifest};if(late)await new Promise(resolve=>pending.push(resolve));return{ok:true,arrayBuffer:async()=>{const b=new ArrayBuffer(4);new DataView(b).setUint32(0,96000);return b;}};};
 const bgm=createStreamingBgm({getContext:()=>context,fetcher});
 return{bgm,context,release(){late=false;for(const r of pending.splice(0))r();}};
}
const flush=()=>new Promise(r=>setTimeout(r,10));
test('buffer scheduling keeps exact sample boundaries across the intro and loop',async t=>{
 const{bgm}=fixture();t.after(()=>bgm.dispose());bgm.enter({restart:true,section:'opening'});await bgm.prepare();await flush();
 const s=bgm.snapshot().schedule;assert.ok(s.some(x=>x.track==='loop'));
 for(let i=1;i<s.length;i++){assert.equal(s[i-1].startFrame+s[i-1].frames,s[i].startFrame);assert.ok(Math.abs(s[i-1].end-s[i].at)<1/48000);}
});
test('entering the film while music is loading never starts a stale music voice later',async t=>{
 const f=fixture({late:true});t.after(()=>f.bgm.dispose());f.bgm.enter({restart:true,section:'opening'});await flush();f.bgm.leave();f.release();await f.bgm.prepare();await flush();
 const s=f.bgm.snapshot();assert.equal(s.active,false);assert.equal(s.starts,0);assert.equal(s.schedule.length,0);
});
test('scroll entry starts at source frame zero instead of resuming the opening offset',async t=>{
 const{bgm,context}=fixture();t.after(()=>bgm.dispose());bgm.enter({restart:true,section:'opening'});await bgm.prepare();await flush();context.advance(3);assert.ok(bgm.snapshot().elapsed>2);bgm.leave();context.advance(12);bgm.enter({restart:true,section:'scroll'});await flush();
 const s=bgm.snapshot();assert.equal(s.starts,2);assert.equal(s.section,'scroll');assert.equal(s.elapsed,0);const fresh=s.schedule.filter(x=>x.generation===1);assert.equal(fresh[0].startFrame,0);assert.equal(fresh[0].track,'intro');
});
test('a blocked context starts once after the first allowed interaction',async t=>{
 const{bgm,context}=fixture({blocked:true});t.after(()=>bgm.dispose());bgm.enter({restart:true,section:'opening'});await bgm.prepare();assert.equal(bgm.snapshot().starts,0);assert.equal(bgm.snapshot().needsGesture,true);context.allowed=true;bgm.unlock();await flush();assert.equal(bgm.snapshot().starts,1);assert.equal(bgm.snapshot().needsGesture,false);
});
test('the BGM mute changes gain without restarting or stopping the music clock',async t=>{
 const{bgm,context}=fixture();t.after(()=>bgm.dispose());bgm.enter({restart:true,section:'scroll'});await bgm.prepare();bgm.setEnabled(false);context.advance(2);const muted=bgm.snapshot();assert.equal(muted.outputGain,0);assert.equal(muted.active,true);assert.ok(muted.elapsed>1);bgm.setEnabled(true);await flush();assert.equal(bgm.snapshot().starts,1);
});
test('completion waits through the full restarted intro and schedules the supplied outro',async t=>{
 const{bgm}=fixture();t.after(()=>bgm.dispose());bgm.enter({restart:true,section:'scroll'});await bgm.prepare();await flush();bgm.setComplete(true);await flush();const s=bgm.snapshot();const outro=s.schedule.find(x=>x.track==='outro');assert.ok(outro);assert.equal(outro.startFrame,192000);assert.ok(s.exitAt>=4);
});
