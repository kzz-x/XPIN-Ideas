import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIO_MIX_DEFAULTS,createAudioMix,normalizeAudioMix} from '../src/audio-mix.mjs';
import {ListeningGate} from '../src/listening-gate.mjs';
import {PresentationTransport} from '../src/transport-r07.mjs';
test('the approved r15 balance replaces provisional r14 settings on first entry',()=>{
 const storage={getItem:key=>key==='linggan-audio-mix-r14'?JSON.stringify({sfx:.8,video:.8,bgm:.15}):null,setItem(){}};
 assert.deepEqual(createAudioMix({storage}).snapshot(),{sfx:1,video:.25,bgm:.06});
});
test('three independent volumes clamp and survive a browser-settings round trip',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},mix=createAudioMix({storage});
 mix.set('sfx',.92);mix.set('video',.54);mix.set('bgm',.08);
 assert.deepEqual(createAudioMix({storage}).snapshot(),{sfx:.92,video:.54,bgm:.08});
 assert.equal(mix.describe(),'音效 92% / 视频 54% / 网页BGM 8%');
 assert.deepEqual(normalizeAudioMix({sfx:2,video:-1,bgm:'bad'}),{sfx:1,video:0,bgm:AUDIO_MIX_DEFAULTS.bgm});
});
test('the headphone cue lasts two visible seconds and waits for actual film readiness',()=>{
 const g=new ListeningGate(2);for(let i=0;i<21;i++)g.update(.1);assert.equal(g.snapshot().done,false);assert.equal(g.snapshot().progress,.96);
 g.ready=true;assert.equal(g.snapshot().done,true);
});
test('dragging a volume pauses the cue and leaves time to finish the adjustment',()=>{
 const g=new ListeningGate(2);g.ready=true;for(let i=0;i<8;i++)g.update(.1);const before=g.elapsed;g.adjusting=true;for(let i=0;i<30;i++)g.update(.1);assert.equal(g.elapsed,before);
 g.adjusting=false;g.adjusted();for(let i=0;i<5;i++)g.update(.1);assert.equal(g.elapsed,before);
 for(let i=0;i<10;i++)g.update(.1);assert.equal(g.snapshot().done,false);for(let i=0;i<10;i++)g.update(.1);assert.equal(g.snapshot().done,true);
});
class Media extends EventTarget{
 constructor(){super();Object.assign(this,{duration:51.9,currentTime:0,readyState:2,paused:true,seeking:false,volume:1,muted:false});this.wait=null;}
 play(){this.paused=false;return this.wait||Promise.resolve();}pause(){this.paused=true;}
}
test('video soundtrack retains independent volume while impact stays silent',()=>{
 let v=.8;const film=new Media(),impact=new Media(),t=new PresentationTransport(film,impact,{getVideoVolume:()=>v});
 assert.equal(film.volume,.8);assert.equal(impact.volume,0);v=.25;t.restoreVolumes();assert.equal(film.volume,.25);assert.equal(impact.volume,0);
 t.setMuted(true);assert.equal(film.muted,true);assert.equal(film.volume,.25);t.setMuted(false);assert.equal(film.volume,.25);
});
test('changing video volume while its silent preflight is pending cannot leak sound or restore stale gain',async()=>{
 let v=.8,a,b;const film=new Media(),impact=new Media();film.wait=new Promise(r=>a=r);impact.wait=new Promise(r=>b=r);const t=new PresentationTransport(film,impact,{getVideoVolume:()=>v});
 const job=t.unlock();v=.35;t.restoreVolumes();assert.equal(film.volume,0);assert.equal(impact.volume,0);a();b();await job;assert.equal(film.volume,.35);assert.equal(film.paused,true);
});
