import {BGM_STORAGE,nextMusicalExit} from './bgm.mjs';

// Decoded music buffers scheduled ahead on the audio clock. Asset loading,
// page animation and source.onended never decide the time of a musical seam.
export function createStreamingBgm({getContext,getOutput,onChange=()=>{},onError=()=>{},fetcher=globalThis.fetch,manifestURL='./assets/media/bgm/stream/manifest.json'}={}){
 let settings={enabled:true,volume:.15};try{const prior=JSON.parse(localStorage.getItem('linggan-bgm-r09')||'{}');settings.volume=prior.volume??.15;settings={...settings,...JSON.parse(localStorage.getItem(BGM_STORAGE)||'{}')};}catch{}
 settings.volume=Math.max(0,Math.min(1,Number(settings.volume)||0));settings.enabled=settings.enabled!==false;
 let context,master,meta,manifestJob,prepared,active=false,section='opening',complete=false,masterMuted=false,epoch=null,offsetFrame=0,cursor=0,stalledFrame=null,exitFrame=null,finished=false,error=null,starts=0,generation=0;
 const cache=new Map(),pending=new Map(),sources=new Set(),events=[],schedule=[],rate=48000;
 const record=(event,data={})=>{events.push({event,at:context?.currentTime||0,...data});if(events.length>100)events.shift();};
 const emit=()=>onChange(snapshot());
 function ensure(){
  if(context)return context;context=getContext();master=context.createGain();master.gain.value=settings.enabled&&!masterMuted?settings.volume:0;master.connect(getOutput?.()||context.destination);
  context.addEventListener('statechange',()=>{if(context.state==='running'){start();pump();}emit();});return context;
 }
 function elapsedFrame(){if(stalledFrame!==null)return stalledFrame;return epoch===null?offsetFrame:offsetFrame+Math.max(0,Math.round((context.currentTime-epoch)*rate));}
 function elapsed(){return elapsedFrame()/rate;}
 function firstReady(){return !!meta&&meta.tracks.intro.chunks.slice(0,2).every((_,i)=>cache.has('intro:'+i));}
 function loadManifest(){return manifestJob??=(async()=>{const r=await fetcher(manifestURL);if(!r.ok)throw Error('BGM manifest: '+r.status);meta=await r.json();return meta;})();}
 async function chunk(track,index){
  const key=track+':'+index;if(cache.has(key))return cache.get(key);if(pending.has(key))return pending.get(key);
  const item=meta.tracks[track].chunks[index],job=(async()=>{let failure;for(let attempt=0;attempt<3;attempt++)try{const r=await fetcher(new URL(item.src,new URL(manifestURL,location.href)),{priority:'low'});if(!r.ok)throw Error('BGM chunk: '+r.status);let buffer=await ensure().decodeAudioData(await r.arrayBuffer());if(buffer.getChannelData&&Number.isFinite(buffer.sampleRate)){const count=Math.round(item.frames/rate*buffer.sampleRate);if(buffer.length!==count){const trimmed=context.createBuffer(buffer.numberOfChannels,count,buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++)trimmed.copyToChannel(buffer.getChannelData(c).subarray(0,count),c);buffer=trimmed;}}if(Math.abs(buffer.duration-item.frames/rate)>1/rate*2)throw Error('BGM sample range mismatch');cache.set(key,buffer);record('chunk-ready',{track,index});return buffer;}catch(e){failure=e;if(attempt<2)await new Promise(r=>setTimeout(r,250*(attempt+1)));}throw failure;})();
  pending.set(key,job);job.then(()=>{pending.delete(key);pump();},e=>{pending.delete(key);error=e.message;emit();onError('背景音乐暂未载入，请稍后重试。');});return job;
 }
 function pieceAt(frame){
  let track,local,start;
  if(exitFrame!==null&&frame>=exitFrame){track='outro';local=frame-exitFrame;start=exitFrame;}
  else if(frame<meta.tracks.intro.frames){track='intro';local=frame;start=0;}
  else{track='loop';const length=meta.tracks.loop.frames,cycle=Math.floor((frame-meta.tracks.intro.frames)/length);start=meta.tracks.intro.frames+cycle*length;local=frame-start;}
  const data=meta.tracks[track];if(local>=data.frames)return null;
  const index=data.chunks.findIndex(c=>local>=c.startFrame&&local<c.startFrame+c.frames),item=data.chunks[index];if(!item)return null;
  let frames=item.startFrame+item.frames-local;if(track!=='outro'&&exitFrame!==null)frames=Math.min(frames,exitFrame-frame);
  return{track,index,localFrame:local-item.startFrame,frames,startFrame:frame,key:track+':'+index};
 }
 async function prepare(){
  ensure();if(!prepared)prepared=(async()=>{await loadManifest();await Promise.all(meta.tracks.intro.chunks.slice(0,2).map((_,i)=>chunk('intro',i)));error=null;start();emit();})().catch(e=>{error=e.message;onError('背景音乐暂未载入，可在设置中重新开启。');emit();});return prepared;
 }
 function stopSources(fade=.04){
  if(!context)return;const at=context.currentTime;
  for(const r of sources){r.gain.gain.cancelAndHoldAtTime(at);r.gain.gain.setTargetAtTime(.00001,at,Math.max(.003,fade/4));try{r.source.stop(at+fade+.005);}catch{}}
  sources.clear();
 }
 function start(){
  if(!active||epoch!==null||finished||!meta||!firstReady()||context.state!=='running')return;
  epoch=context.currentTime+.045;cursor=offsetFrame;starts++;record('loop-start',{offset:offsetFrame/rate,section});if(complete&&section==='scroll')queueEnding();pump();emit();
 }
 function pump(){
  if(!active||epoch===null||!meta||context.state!=='running'||finished)return;
  const now=context.currentTime,frame=elapsedFrame();
  if(exitFrame!==null&&frame>=exitFrame+meta.tracks.outro.frames){finished=true;record('outro-ended');emit();return;}
  let look=cursor;for(let i=0;i<8;i++){const p=pieceAt(look);if(!p||p.frames<=0)break;chunk(p.track,p.index).catch(()=>{});look+=p.frames;}
  const horizon=frame+rate*10;
  while(cursor<horizon){
   const p=pieceAt(cursor);if(!p||p.frames<=0)break;
   const buffer=cache.get(p.key);
   if(!buffer){if(cursor<=frame+rate*.008&&now>epoch){if(stalledFrame===null){stalledFrame=cursor;record('buffer-wait',{frame:cursor});}}break;}
   if(stalledFrame!==null){epoch=now+.025-(stalledFrame-offsetFrame)/rate;stalledFrame=null;record('buffer-resume');}
   const at=epoch+(cursor-offsetFrame)/rate,source=context.createBufferSource(),gain=context.createGain(),duration=p.frames/rate;
   source.buffer=buffer;source.connect(gain).connect(master);gain.gain.value=1;
   if(cursor===offsetFrame){gain.gain.setValueAtTime(.00001,at);gain.gain.linearRampToValueAtTime(1,at+.20);}
   if(p.track==='outro'&&p.localFrame===0){gain.gain.setValueAtTime(.00001,at);gain.gain.linearRampToValueAtTime(1,at+.10);}
   if(p.track!=='outro'&&exitFrame!==null&&cursor+p.frames===exitFrame){gain.gain.setValueAtTime(1,at+duration-.006);gain.gain.linearRampToValueAtTime(.00001,at+duration);}
   const recordSource={source,gain,startFrame:cursor,endFrame:cursor+p.frames};sources.add(recordSource);source.onended=()=>{sources.delete(recordSource);source.disconnect();gain.disconnect();};
   const actualAt=Math.max(now,at);source.start(actualAt,p.localFrame/rate,duration);schedule.push({section,track:p.track,index:p.index,startFrame:cursor,frames:p.frames,at:actualAt,end:actualAt+duration,generation});if(schedule.length>140)schedule.shift();cursor+=p.frames;
  }
 }
 function unlock(){try{const ctx=ensure();ctx.resume().then(()=>{start();pump();emit();}).catch(()=>{});prepare();}catch(e){error=e.message;emit();}}
 function queueEnding(){
  if(!active||section!=='scroll'||!complete||exitFrame!==null||epoch===null||!meta)return;
  const time=Math.max(meta.tracks.intro.duration,nextMusicalExit(elapsed(),meta.tracks.intro.duration,meta.tracks.loop.duration,meta.gates.map(g=>g.seconds),.12));exitFrame=Math.round(time*rate);
  const at=epoch+(exitFrame-offsetFrame)/rate;
  for(const r of sources){if(r.startFrame>=exitFrame){r.gain.gain.setValueAtTime(.00001,context.currentTime);try{r.source.stop(context.currentTime+.005);}catch{}}else if(r.endFrame>exitFrame){r.gain.gain.setValueAtTime(1,at-.005);r.gain.gain.linearRampToValueAtTime(.00001,at+.10);try{r.source.stop(at+.105);}catch{}}}
  cursor=Math.min(cursor,exitFrame);record('completion-queued',{exitFrame,exitAt:at});pump();emit();
 }
 function leave({fade=.025}={}){
  if(!active)return;offsetFrame=elapsedFrame();active=false;generation++;stopSources(fade);epoch=null;stalledFrame=null;record('leave',{offset:offsetFrame/rate,section});emit();
 }
 function enter({restart=false,section:next='scroll'}={}){
  if(active&&next===section&&!restart)return;
  leave();section=next;if(restart){offsetFrame=0;cursor=0;exitFrame=null;finished=false;record('restart',{section});}
  active=true;unlock();start();emit();
 }
 function volume(){if(master){const at=context.currentTime;master.gain.cancelAndHoldAtTime(at);master.gain.linearRampToValueAtTime(settings.enabled&&!masterMuted?settings.volume:0,at+.06);}try{localStorage.setItem(BGM_STORAGE,JSON.stringify(settings));}catch{}emit();}
 function snapshot(){const f=elapsedFrame(),outro=exitFrame!==null&&f>=exitFrame;return{ready:firstReady(),contextState:context?.state||'locked',needsGesture:active&&context?.state!=='running',sampleRate:context?.sampleRate||rate,active,section,enabled:settings.enabled,volume:settings.volume,masterMuted,outputGain:active?(master?.gain.value||0):0,complete,finished,mode:finished?'done':outro?'outro':'intro-loop',elapsed:f/rate,exitAt:exitFrame===null||epoch===null?null:epoch+(exitFrame-offsetFrame)/rate,starts,error,loopStart:meta?.tracks.intro.duration||0,loopEnd:meta?(meta.tracks.intro.frames+meta.tracks.loop.frames)/rate:0,loopFrames:meta?.tracks.loop.frames||0,streaming:true,lossless:meta?.lossless||false,bufferedChunks:cache.size,scheduledSources:sources.size,schedule:[...schedule],events:events.slice(-45)};}
 const timer=setInterval(pump,120);
 return{prepare,unlock,enter,leave,snapshot,setComplete(value){complete=!!value;if(complete)queueEnding();else if(exitFrame!==null){leave();offsetFrame=meta?.tracks.intro.frames||0;cursor=offsetFrame;exitFrame=null;finished=false;active=true;start();}emit();},
  setEnabled(value){settings.enabled=!!value;volume();if(value)unlock();},setVolume(value){settings.volume=Math.max(0,Math.min(1,Number(value)||0));volume();},setMasterMuted(value){masterMuted=!!value;volume();},
  get buffers(){return meta?Object.fromEntries(Object.entries(meta.tracks).map(([k,v])=>[k,{duration:v.duration,length:v.frames}])):null;},get context(){return context;},dispose(){leave();clearInterval(timer);}
 };
}
