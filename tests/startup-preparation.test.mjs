import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PresentationTransport} from '../src/transport-r07.mjs';
import {createOpeningScreenSource} from '../assets/r03-stage/v020-white-encore-cpu/opening-screen-source-r05.mjs';

const main=fs.readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
function actualFunction(name){
 const match=main.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\r?\\n\\}'));
 assert.ok(match,'main function exists: '+name);return match[0];
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=()=>new Promise(setImmediate);

test('the actual listening gate waits only for startup media and decode, independently of pending scene preparation',async()=>{
 const buffer=deferred(),decode=deferred(),world=deferred(),events=[],label={textContent:''};
 const context={Promise,performance:{now:()=>100},ui:{phase:'chat'},listeningGate:{ready:false,reset(){this.ready=false;}},
  paintListeningProgress(){},setPhase(phase){context.ui.phase=phase;},sound:{play(){}},$:()=>label,
  media:{snapshot:()=>({}),preparePlayback(at){events.push(['buffer',at]);return buffer.promise;},preflightDecode(){events.push(['decode']);return decode.promise;},prime(){events.push(['stream']);return Promise.resolve();}},
  prepareWorld(){events.push(['world']);return world.promise;},transport:{restoreVolumes(){events.push(['volumes']);}},toast(message){assert.fail(message);}};
 vm.runInNewContext('let listenGeneration=0;'+actualFunction('beginListening')+';globalThis.run=beginListening;',context);
 context.run();await flush();assert.equal(context.listeningGate.ready,false);assert.ok(events.some(event=>event[0]==='world'));
 buffer.resolve();await flush();assert.equal(context.listeningGate.ready,false);assert.ok(events.some(event=>event[0]==='decode'));
 decode.resolve();await flush();assert.equal(context.listeningGate.ready,true);assert.equal(context.ui.phase,'listen');
 assert.match(label.textContent,/准备就绪/);
});

test('the actual startFilm begins media playback while the world promise remains pending',async()=>{
 const buffer=deferred(),world=deferred(),events=[];
 const context={Promise,setTimeout:()=>1,clearTimeout(){},buffering(){},
  prepareWorld(){events.push('world');return world.promise;},
  media:{preparePlayback(at){events.push(['buffer',at]);return buffer.promise;},prime(){return Promise.resolve();}},
  transport:{started:false,async start(at){events.push(['play',at]);}},toast(message){assert.fail(message);},setPhase(phase){assert.fail(phase);}};
 vm.runInNewContext('let filmStarting=false;'+actualFunction('startFilm')+';globalThis.run=startFilm;',context);
 const started=context.run(0);await flush();assert.equal(context.transport.started,false);
 buffer.resolve();await started;assert.equal(context.transport.started,true);assert.ok(events.some(event=>Array.isArray(event)&&event[0]==='play'));
});

test('a manual film start finishes an already-running decoder probe before it can rewind live playback',async()=>{
 const decode=deferred(),events=[],context={Promise,setTimeout:()=>1,clearTimeout(){},buffering(){},prepareWorld:()=>new Promise(()=>{}),
  media:{preflighting:true,preparePlayback:()=>Promise.resolve(),preflightDecode(){events.push('decode');return decode.promise;},prime:()=>Promise.resolve()},
  transport:{started:false,async start(at){events.push(['play',at]);}},toast(message){assert.fail(message);},setPhase(phase){assert.fail(phase);}};
 vm.runInNewContext('let filmStarting=false;'+actualFunction('startFilm')+';globalThis.run=startFilm;',context);
 const started=context.run(35);await flush();assert.deepEqual(events,['decode']);assert.equal(context.transport.started,false);
 decode.resolve();await started;assert.deepEqual(events,['decode',['play',35]]);
});

function worldHarness({phase='launch',holdScroll=false}={}){
 const events=[],waiters=[],scroll=deferred(),context={Promise,performance:{now:()=>100},runtime:{stagePrepared:false,stageReady:false,ready:false},ui:{phase},$:()=>({open:false}),
  media:{preparePlayback(at){events.push(['buffer',at]);return Promise.resolve();}},
  waitFor(predicate){if(predicate())return Promise.resolve();const pending=deferred();waiters.push({predicate,pending});return pending.promise;},
  async prepareStage(){events.push('stage');context.runtime.stagePrepared=true;},
  async prepareScroll(){events.push('scroll');if(holdScroll)await scroll.promise;},
  async warmHandoff(){assert.ok(['listen','black','film-wait','film','return-wait'].includes(context.ui.phase));events.push('handoff');context.runtime.handoffReady=true;},
  resolveWorld(){events.push('ready');},rejectWorld(error){events.push(['error',error]);}};
 vm.runInNewContext('let worldJob,scrollJob,screenReady=Promise.resolve();'+actualFunction('prepareWorld')+';globalThis.run=prepareWorld;',context);
 return{context,events,scroll,release(){for(const entry of waiters)if(entry.predicate())entry.pending.resolve();}};
}

test('world preparation retains the stage gate until ordered shared-scene warming has a safe visual cover',async()=>{
 const h=worldHarness(),job=h.context.run();await flush();
 assert.equal(h.context.runtime.stagePrepared,true);assert.equal(h.context.runtime.stageReady,false);
 assert.deepEqual(h.events,[['buffer',0],'stage','scroll']);
 h.context.ui.phase='film';h.release();await job;
 assert.deepEqual(h.events,[['buffer',0],'stage','scroll','handoff','ready']);
 assert.equal(h.context.runtime.stageReady,true);assert.equal(h.context.runtime.ready,true);assert.equal(h.context.runtime.worldPreparing,false);
});

class Media extends EventTarget{
 constructor(){super();Object.assign(this,{duration:51.983333,currentTime:0,readyState:3,paused:true,seeking:false,ended:false,volume:1,muted:false});}
 play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}
}
test('slow shared-scene preparation keeps the 36-second video frame visible until handoff warming finishes',async()=>{
 const h=worldHarness({phase:'film',holdScroll:true}),video=new Media(),audio=new Media();
 const transport=new PresentationTransport(video,audio,{managedMedia:true,canEnterStage:()=>h.context.runtime.stageReady,canDepart:()=>h.context.runtime.ready,onStage(){h.context.ui.phase='stage';}});
 const job=h.context.run();await flush();await transport.start();video.currentTime=36.015;transport.update(1/60);
 assert.equal(transport.phase,'film');assert.equal(transport.waitingAt,'stage');assert.equal(video.paused,true);assert.equal(h.context.runtime.stageReady,false);
 h.scroll.resolve();await job;
 assert.equal(h.events.filter(event=>event==='handoff').length,1);assert.equal(h.context.ui.phase,'film');
 transport.update(1/60);await flush();transport.update(1/60);
 assert.equal(transport.phase,'stage');assert.equal(h.context.ui.phase,'stage');assert.equal(video.currentTime,36.015);transport.dispose();
});

test('a preparation request during a visible stage does not touch the shared rig or hide its renderers',async()=>{
 const h=worldHarness({phase:'stage'}),job=h.context.run();await flush();
 assert.deepEqual(h.events,[['buffer',0]]);assert.equal(h.context.runtime.stageReady,false);
 h.context.ui.phase='film';h.release();await job;
 assert.deepEqual(h.events,[['buffer',0],'stage','scroll','handoff','ready']);
});

test('the actual shared-film stage adapter cannot seek, pause or replay the running film during warmup',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'HTMLVideoElement');
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'HTMLVideoElement',previous);else delete globalThis.HTMLVideoElement;});
 globalThis.HTMLVideoElement=class{};
 const film=new globalThis.HTMLVideoElement();let time=12.5,writes=0,pauses=0,plays=0;
 Object.defineProperty(film,'currentTime',{get:()=>time,set:value=>{writes++;time=value;}});
 Object.assign(film,{duration:51.983333,videoWidth:1920,videoHeight:1080,readyState:3,paused:false,pause(){pauses++;},play(){plays++;return Promise.resolve();}});
 const source=await createOpeningScreenSource({kind:'video',status:'approved',element:film,uri:'blob:shared-film',inPoint:36,fps:60});
 await source.seekExact(0);source.update(15.7,{sync:true});await source.seekExact(0);source.dispose();
 assert.equal(time,12.5);assert.equal(writes,0);assert.equal(pauses,0);assert.equal(plays,0);assert.equal(source.snapshot().sharedDecoder,true);
});
