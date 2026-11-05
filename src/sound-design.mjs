import {createAudioMaster,dbToGain,OPENING_TRIM_DB} from './audio-master.mjs';
import {createGlassOpening} from './opening-sound.mjs';
import {createSandOpening,sandProfile} from './sand-sound.mjs';
// Short physical and digital cues. Continuous gestures own one voice.
export const CUES={
 hover:{hz:1700,d:.028,g:.024,kind:'glass',noise:.05},
 click:{hz:620,d:.065,g:.022,kind:'wood',noise:.17},
 select:{hz:950,d:.055,g:.014,kind:'glass',noise:.04},
 toggle:{hz:840,d:.075,g:.018,kind:'glass',noise:.08},
 pickup:{hz:420,d:.09,g:.024,kind:'wood',noise:.15},
 contact:{hz:160,d:.10,g:.032,kind:'wood',noise:.24},
 metal:{hz:1450,d:.12,g:.019,kind:'glass',noise:.14},
 wrong:{hz:210,d:.13,g:.023,kind:'wood',end:.78,noise:.12},
 correct:{hz:760,d:.14,g:.024,kind:'glass',notes:[1,1.5],noise:.04},
 complete:{hz:660,d:.30,g:.026,kind:'glass',notes:[1,1.25,1.5],noise:.02},
 stamp:{hz:110,d:.18,g:.042,kind:'wood',noise:.4},
 help:{hz:560,d:.12,g:.019,kind:'glass',notes:[1,1.2]},
 open:{hz:400,d:.16,g:.021,kind:'glass',end:1.4,noise:.12},
 close:{hz:320,d:.12,g:.018,kind:'wood',end:.82,noise:.15},
 charge:{hz:520,d:.25,g:.035,kind:'glass',end:2.0,noise:.2},
 win:{hz:523.25,d:.42,g:.034,kind:'glass',notes:[1,1.25,1.5,2],noise:.025},
 headphones:{hz:660,d:.22,g:.025,kind:'glass',notes:[1,1.5],noise:.02},
 cancel:{hz:240,d:.11,g:.013,kind:'wood',end:.7,noise:.08},
 particle:{hz:2100,d:.055,g:.024,kind:'glass',noise:.2},
 settle:{hz:1050,d:.075,g:.013,kind:'glass',noise:.12},
 assembly:{hz:720,d:.27,g:.025,kind:'glass',notes:[1,1.5,2],noise:.02},
 typing:{hz:1450,d:.020,g:.028,kind:'wood',noise:.3},
 code:{hz:1950,d:.023,g:.025,kind:'wood',noise:.38},
 send:{hz:480,d:.19,g:.025,kind:'glass',end:2,noise:.18},
 sweep:{hz:300,d:.24,g:.017,kind:'air',end:2.2,noise:1},
 dot:{hz:390,d:.13,g:.020,kind:'wood',end:1.2,noise:.14},
 hat:{hz:1050,d:.18,g:.017,kind:'air',noise:.7},
 turn:{hz:700,d:.21,g:.017,kind:'air',noise:.8},
 land:{hz:130,d:.13,g:.028,kind:'wood',noise:.3},
 scrub:{hz:1150,d:.025,g:.026,kind:'wood',noise:.28},
 reset:{hz:610,d:.13,g:.018,kind:'glass',end:.72,noise:.1},
 attach:{hz:820,d:.12,g:.019,kind:'glass',notes:[1,1.25],noise:.08}
};
const noiseCache=new WeakMap();
function noiseBuffer(context){
 if(noiseCache.has(context))return noiseCache.get(context);
 const buffer=context.createBuffer(1,context.sampleRate,context.sampleRate),a=buffer.getChannelData(0);let seed=93173;
 for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=(seed/2147483648-1);}
 noiseCache.set(context,buffer);return buffer;
}
export function scheduleCue(context,output,type,{at=context.currentTime+.003,intensity=1,pitch=1,pan=0,onEnded=()=>{}}={}){
 const spec=CUES[type]||CUES.click,level=spec.g*Math.max(0,Math.min(1.5,intensity)),bus=context.createGain(),panner=context.createStereoPanner?.(),nodes=[];
 bus.gain.value=1;if(panner){panner.pan.value=Math.max(-.7,Math.min(.7,pan));bus.connect(panner).connect(output);}else bus.connect(output);
 let left=0;const disconnect=()=>{if(--left>0)return;bus.disconnect();panner?.disconnect();onEnded();};
 function envelope(node,volume,d,delay=0){const gain=context.createGain(),t=at+delay;gain.gain.setValueAtTime(.00001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.00002,volume),t+.004);gain.gain.exponentialRampToValueAtTime(.00001,t+d);node.connect(gain).connect(bus);left++;node.onended=()=>{node.disconnect();gain.disconnect();disconnect();};node.start(t);node.stop(t+d+.025);nodes.push(node);return gain;}
 const notes=spec.notes||[1];
 if(spec.kind!=='air')for(let i=0;i<notes.length;i++){const o=context.createOscillator(),hz=spec.hz*pitch*notes[i];o.type=spec.kind==='wood'?'triangle':'sine';o.frequency.setValueAtTime(hz,at+i*.035);o.frequency.exponentialRampToValueAtTime(hz*(spec.end||1.05),at+i*.035+spec.d);envelope(o,level/Math.sqrt(notes.length),spec.d,i*.035);}
 if(spec.noise){const source=context.createBufferSource(),filter=context.createBiquadFilter();source.buffer=noiseBuffer(context);filter.type='bandpass';filter.frequency.value=spec.kind==='wood'?2200:spec.hz*pitch;filter.Q.value=spec.kind==='air'?.65:1.1;source.connect(filter);const gain=context.createGain();gain.gain.setValueAtTime(.00001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.00002,level*spec.noise),at+.006);gain.gain.exponentialRampToValueAtTime(.00001,at+spec.d);filter.connect(gain).connect(bus);left++;source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();disconnect();};source.start(at,.17);source.stop(at+spec.d+.025);nodes.push(source);}
 return{nodes,end:at+spec.d+(notes.length-1)*.035+.025,stop(){for(const n of nodes)try{n.stop(context.currentTime+.01);}catch{}}};
}
export function createSound({volume=1}={}){
 let context,mix,limiter,master,fxBus,openingBus,glassOpening,sandOpening,musicBus,recording,muted=false,hold=null,particles=null,lastCode=-1,lastTyping=-1,active=0,unlockAt=-Infinity,lastStage=null,effectVolume=Math.max(0,Math.min(1,volume));
 const EFFECTS_GAIN=6;
 const openingCues=new Set(['charge','particle','settle','assembly']);
 const counters={},events=[],last=new Map(),queued=[];let playedAt=-Infinity;
 const record=(type,detail={})=>{counters[type]=(counters[type]||0)+1;events.push({type,at:performance.now(),...detail});if(events.length>240)events.shift();};
 function ensureContext(){
  if(context)return context;
  context=new (globalThis.AudioContext||globalThis.webkitAudioContext)({sampleRate:48000,latencyHint:'interactive'});
  master=createAudioMaster(context);mix=context.createGain();limiter=context.createDynamicsCompressor();fxBus=context.createGain();openingBus=context.createGain();openingBus.gain.value=dbToGain(OPENING_TRIM_DB);openingBus.connect(fxBus);musicBus=context.createGain();fxBus.gain.value=muted?0:effectVolume*EFFECTS_GAIN;
  limiter.threshold.value=-9;limiter.knee.value=10;limiter.ratio.value=4;limiter.attack.value=.003;limiter.release.value=.12;
  fxBus.connect(mix);musicBus.connect(mix);mix.connect(limiter).connect(master.input);
  glassOpening=createGlassOpening(context,openingBus);
  sandOpening=createSandOpening(context,openingBus);
  context.addEventListener('statechange',()=>{if(context.state==='running'){for(const item of queued.splice(0))if(performance.now()-item.at<350)play(item.type,item.options);}});
  return context;
 }
 function unlock(){try{const ctx=ensureContext();unlockAt=performance.now();ctx.resume().catch(()=>{});return ctx.state==='running';}catch{return false;}}
 function duckMusic(level=.38,restore=true,holdFor=.15){if(!context||effectVolume<=0||muted)return;const at=context.currentTime,target=hold?.25:particles?.42:level;musicBus.gain.cancelAndHoldAtTime(at);musicBus.gain.linearRampToValueAtTime(target,at+.012);if(restore&&!hold&&!particles)musicBus.gain.setTargetAtTime(1,at+holdFor,.08);}
 function releaseMusic(){if(!context||hold||particles)return;const at=context.currentTime;musicBus.gain.cancelAndHoldAtTime(at);musicBus.gain.setTargetAtTime(1,at,.065);}
 function play(type,options={}){
  if(muted||effectVolume<=0)return false;const now=performance.now(),ctx=ensureContext();
  if(ctx.state!=='running'){if(now-unlockAt<350&&queued.length<4)queued.push({type,options,at:now});return false;}
  const interval=options.cooldown??({hover:70,typing:45,code:55,particle:105,settle:100,scrub:90,contact:70,dot:180}[type]??35),key=options.key||type;
  if(now-(last.get(key)??-Infinity)<interval||(active>=12&&type!=='win'))return false;last.set(key,now);active++;playedAt=now;record(type,{intensity:options.intensity??1,...(options.key?{key:options.key}:{})});if(options.duck!==false){const cue=CUES[type]||CUES.click;duckMusic(.38,true,cue.d+((cue.notes?.length||1)-1)*.035+.03);}
  const opening=options.opening??openingCues.has(type);
  if(opening&&['charge','assembly'].includes(type)&&glassOpening.accent(type,options.intensity??1)){active--;return true;}
  scheduleCue(ctx,opening?openingBus:fxBus,type,{...options,onEnded:()=>active=Math.max(0,active-1)});return true;
 }
 function updateHold(progress,pressed){
  if(!pressed||muted||effectVolume<=0){if(hold){hold.stop();hold=null;record('hold-end');releaseMusic();}return;}
  ensureContext();if(!hold){hold=glassOpening.start('hold');if(hold){record('hold-start');duckMusic(.25,false);}}hold?.update(progress);
 }
 function particleMotion(state){
  if(muted||effectVolume<=0||!state)return;ensureContext();const profile=sandProfile(state);
  if(profile.complete){if(particles){particles.update(state);particles=null;record('particles-end',{reason:'visual-complete',visualTime:state.time});releaseMusic();}return;}
  if(!particles&&state.time>=.10){particles=sandOpening.start(state);if(particles){record('particles-start',{visualTime:state.time});duckMusic(.42,false);}}
  particles?.update(state);
 }
 function stopParticles(){if(particles){particles.stop();particles=null;record('particles-end');releaseMusic();}}
 function levelWin(chapter){const pitch=[1,1.122462,1.259921,1.33484,1.498307][chapter]||1;if(play('win',{pitch,key:'level-win-'+chapter,cooldown:800,at:ensureContext().currentTime+.06}))record('level-win',{chapter});}
 function setVolume(value){effectVolume=Math.max(0,Math.min(1,Number(value)||0));if(fxBus){const at=context.currentTime;fxBus.gain.cancelAndHoldAtTime(at);fxBus.gain.linearRampToValueAtTime(muted?0:effectVolume*EFFECTS_GAIN,at+.04);}if(effectVolume===0){updateHold(0,false);stopParticles();}}
 function codeTick(age){const key=Math.floor(age*11);if(key!==lastCode){lastCode=key;play('code',{pitch:.9+(key%5)*.06});}}
 function typing(count){if(count!==lastTyping){if(count>lastTyping&&count>0)play('typing',{pitch:.92+(count%4)*.06});lastTyping=count;}}
 function dotAction(action){if(!action||action.id==='idle')return;const id=action.id||'';if(action.edge==='end'){if(/response|dash|dodge|celebrate|happy/.test(id))play('land',{intensity:action.reason==='ambient'?.35:.55});return;}const type=/hat|shy|bow/.test(id)?'hat':/orbit|dash|dodge|turn|sway/.test(id)?'turn':'dot';play(type,{intensity:action.reason==='ambient'?.45:.85,pitch:.9+(id.length%5)*.06});}
 // Keep the approved stage particle accent at its r15 level, independent of the softer opening.
 function stageMotion(time,playing){if(!playing){lastStage=time;return;}if(lastStage===null||Math.abs(time-lastStage)>.3){lastStage=time;return;}for(const[t,type]of[[.8,'turn'],[2.1,'hat'],[14.85,'hat'],[15.3,'particle'],[18.2,'turn']])if(lastStage<t&&time>=t)play(type,{intensity:.45*(type==='particle'?dbToGain(-3):1),opening:false});lastStage=time;}
 return{ensureContext,unlock,play,updateHold,particleMotion,stopParticles,codeTick,typing,dotAction,stageMotion,levelWin,setVolume,
  prepareOpening(){ensureContext();return Promise.all([glassOpening.load(),sandOpening.load()]);},
  get context(){return context;},get musicBus(){ensureContext();return musicBus;},get playedAt(){return playedAt;},
  connectMediaElement(element){ensureContext();return master.connectMediaElement(element);},
  getMixStream(){ensureContext();if(!recording){recording=context.createMediaStreamDestination();master.output.connect(recording);}return recording.stream;},
  setMuted(value){muted=!!value;if(fxBus){const at=context.currentTime;fxBus.gain.cancelAndHoldAtTime(at);fxBus.gain.linearRampToValueAtTime(muted?0:effectVolume*EFFECTS_GAIN,at+.04);}if(muted){updateHold(0,false);stopParticles();}},
  snapshot:()=>({contextState:context?.state||'uncreated',muted,volume:effectVolume,effectsGain:fxBus?.gain.value||0,musicDuckGain:musicBus?.gain.value??1,master:master?.snapshot(),active,hold:!!hold,particles:!!particles,opening:glassOpening?.snapshot(),sand:sandOpening?.snapshot(),counters:{...counters},events:[...events]})
 };
}
export function bindUiSound(sound,{root=document}={}){
 const abort=new AbortController(),options={signal:abort.signal},selector='button,a[href],summary,select,input[type="range"],input[type="number"],.file-input,.process-card,.shelf-tag';let selection='';
 function element(target){return target?.closest?.(selector);}
 root.addEventListener('pointerover',e=>{const el=element(e.target);if(!el||el.disabled||el.contains(e.relatedTarget)||e.pointerType==='touch')return;sound.play('hover',{key:'ui-hover',intensity:.8,opening:['hold','return-scroll'].includes(el.id)});},options);
 root.addEventListener('focusin',e=>{const el=element(e.target);if(el)sound.play('hover',{key:'ui-hover',intensity:.7,opening:['hold','return-scroll'].includes(el.id)});},options);
 root.addEventListener('click',e=>{const el=element(e.target);if(!el||el.disabled||performance.now()-sound.playedAt<25)return;const id=el.id||'',type=/close|back-start/.test(id)?'close':/reset/.test(id)?'reset':/sound|bgm|quality/.test(id)?'toggle':/help|bubble/.test(id)?'help':/file/.test(id)?'attach':'click';sound.play(type,{opening:['hold','return-scroll'].includes(id)});},options);
 root.addEventListener('input',e=>{if(e.target.matches?.('input[type="range"]'))sound.play('scrub',{duck:e.target.dataset.audioChannel!=='bgm',intensity:e.target.dataset.audioChannel==='bgm'?.3:1});},options);
 root.addEventListener('change',e=>{if(e.target.matches?.('select,input[type="number"],input[type="file"]'))sound.play(e.target.type==='file'?'attach':'select');},options);
 root.addEventListener('selectionchange',()=>{const s=root.getSelection?.()||globalThis.getSelection?.(),value=s?.isCollapsed?'':s?.toString();if(value&&value!==selection)sound.play('select',{cooldown:85});selection=value||'';},options);
 return()=>abort.abort();
}
