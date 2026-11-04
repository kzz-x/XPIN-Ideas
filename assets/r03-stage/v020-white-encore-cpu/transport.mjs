import {SHOT} from './document.mjs';
/** Retain source-audio sync for the original score, then continue the visual epilogue on a deterministic clock. */
export function createAudioTransport(audio,{onTime=()=>{},onState=()=>{}}={}){
 let time=0,playing=false,loopEnabled=false,loop=[0,SHOT.end],rate=1,pendingSeek=null,playToken=0,lastStamp=0;
 const clamp=t=>Math.max(SHOT.min,Math.min(SHOT.max,t));
 function sync(){if(time>=SHOT.musicEnd){audio.pause();return;}try{audio.currentTime=SHOT.audioStart+time;pendingSeek=null;}catch{pendingSeek=time;}}
 function pause(){playToken++;const old=playing;playing=false;audio.pause();if(old)onState(false);}
 function seek(value,{pause:stop=true}={}){if(!Number.isFinite(value))throw Error('时间无效');if(stop)pause();time=clamp(value);sync();lastStamp=performance.now();onTime(time);return time;}
 function configure(settings){loopEnabled=settings.loopEnabled;loop=[...settings.loop];rate=settings.rate;audio.playbackRate=rate;}
 async function play(){
  if(playing)return;if(loopEnabled&&(time>=loop[1]||time<loop[0]))seek(loop[0]);
  if(!loopEnabled&&time>=SHOT.end-.0001)seek(0);
  const token=++playToken;lastStamp=performance.now();
  if(time<SHOT.musicEnd){sync();await audio.play();if(token!==playToken){audio.pause();return;}}
  playing=true;onState(true);
 }
 function tick(){
  if(!playing)return time;
  const now=performance.now(),delta=Math.max(0,Math.min(.16,(now-lastStamp)/1000))*rate;lastStamp=now;
  if(time<SHOT.musicEnd&& !audio.paused){time=Math.max(time,Math.min(SHOT.musicEnd,audio.currentTime-SHOT.audioStart));if(time>=SHOT.musicEnd-.001){time=SHOT.musicEnd;audio.pause();}}
  else {time=clamp(time+delta);}
  const stop=loopEnabled?loop[1]:SHOT.end;
  if(time>=stop-.0001){if(loopEnabled){time=loop[0];sync();if(time<SHOT.musicEnd)audio.play().catch(()=>{});}else{time=SHOT.end;pause();}}
  onTime(time);return time;
 }
 const metadata=()=>{if(pendingSeek!==null)sync();};
 audio.addEventListener('loadedmetadata',metadata);
 return {get time(){return time},get playing(){return playing},get sourceTime(){return SHOT.audioStart+Math.min(time,SHOT.musicEnd)},pause,seek,configure,play,tick,step:d=>seek(time+d/60),dispose(){pause();audio.removeEventListener('loadedmetadata',metadata);}};
}
