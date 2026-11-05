import {CONFIG} from './config.mjs';
export {bindSeekControl,createSound} from './transport.mjs';

/** The video is the only music clock, including after its picture leaves at
 * 36s. The auxiliary element contains only the supplied R03 impact sound. */
export class PresentationTransport{
  constructor(video,audio,callbacks={}){
    Object.assign(this,{video,audio,callbacks,phase:'film',absolute:0,playing:false,muted:false,generation:0,started:false,scrub:null,pendingSeek:null,awaitingPlay:null,stageRevealComplete:false,previewStage:false,impactPending:false,events:[]});
    this.abort=new AbortController();const options={signal:this.abort.signal};
    if(!callbacks.managedMedia)video.src=CONFIG.film.src;audio.src=CONFIG.stage.src;
    this.presentedTime=NaN;const decoded=(now,meta)=>{this.presentedTime=meta.mediaTime-this.offset;this.videoFrame=video.requestVideoFrameCallback(decoded);};if(video.requestVideoFrameCallback)this.videoFrame=video.requestVideoFrameCallback(decoded);
    video.addEventListener('loadedmetadata',()=>this.applySeek(),options);video.addEventListener('seeked',()=>this.settleSeek(true),options);
    video.addEventListener('ended',()=>{if(this.playing&&!this.scrub&&!video.seeking&&video.ended){this.absolute=Math.max(this.absolute,this.filmDuration);this.record('source-ended');}},options);
    video.addEventListener('error',()=>{this.pause();callbacks.onError?.('影片读取失败，请在设置中重新选择影片。');},options);
    audio.addEventListener('loadedmetadata',()=>this.syncImpact(true),options);
    this.restoreVolumes();
  }
  get offset(){return this.callbacks.getMediaOffset?.()||0;}
  get filmDuration(){return Number.isFinite(this.video.duration)?this.video.duration-this.offset:0;}
  get visualTime(){return !this.video.seeking&&Number.isFinite(this.presentedTime)&&Math.abs(this.presentedTime-this.absolute)<.2?this.presentedTime:this.absolute;}
  get visualStageTime(){return Math.max(0,this.visualTime-CONFIG.stage.origin);}
  get stageDuration(){return CONFIG.stage.end;}
  get duration(){return CONFIG.stage.origin+CONFIG.stage.end;}
  get time(){return Math.max(0,this.absolute-CONFIG.stage.origin);}
  get currentTime(){return this.scrub?.previewTime??this.pendingSeek?.requested??this.absolute;}
  get canSeek(){return this.filmDuration>0;}
  get isScrubbing(){return !!this.scrub;}
  get revealProgress(){return this.stageRevealComplete?1:Math.max(0,Math.min(1,(this.absolute-CONFIG.film.stageAt)/CONFIG.film.stageReveal));}
  record(event,data={}){this.events.push({event,at:performance.now(),generation:this.generation,...data});if(this.events.length>200)this.events.shift();}
  invalidate(reason){this.generation++;this.awaitingPlay=null;if(this.pendingSeek)this.pendingSeek.generation=this.generation;this.record(reason);return this.generation;}
  restoreVolumes(){const volume=Math.max(0,Math.min(1,this.callbacks.getVideoVolume?.()??CONFIG.stage.musicGain)),quiet=!!this.unlockPromise&&!this.started;this.video.volume=quiet?0:volume;this.audio.volume=quiet?0:Math.min(1,volume*CONFIG.stage.impactGain/CONFIG.stage.musicGain);this.video.muted=this.audio.muted=this.muted;}
  setPhase(next,detail={}){const old=this.phase;this.phase=next;if(old===next)return;if(next==='stage')this.callbacks.onStage?.(detail);if(next==='film')this.callbacks.onFilm?.(detail);}
  setVideoTime(requested){this.pendingSeek={requested,target:Math.min(Math.max(0,this.filmDuration-.001),requested),generation:this.generation};this.applySeek();}
  applySeek(){const p=this.pendingSeek;if(!p||this.video.readyState<1||p.generation!==this.generation)return;p.target=Math.min(Math.max(0,this.filmDuration-.001),p.requested);try{if(!this.video.seeking&&Math.abs(this.video.currentTime-this.offset-p.target)<.001){this.pendingSeek=null;return;}this.video.currentTime=p.target+this.offset;this.settleSeek();}catch{}}
  settleSeek(seeked=false){const p=this.pendingSeek;if(p&&p.generation===this.generation&&!this.video.seeking&&(seeked||Math.abs(this.video.currentTime-this.offset-p.target)<.075))this.pendingSeek=null;}
  async playSource(){
    if(this.filmDuration>0&&this.absolute>=this.filmDuration)return true;
    const generation=this.generation;this.awaitingPlay={generation,kind:'video'};
    try{await this.video.play();if(generation===this.generation){this.awaitingPlay=null;this.record('source-playing');}return true;}
    catch(error){if(generation!==this.generation)return false;this.awaitingPlay=null;this.playing=false;this.callbacks.onError?.('请按播放键继续影片。');return false;}
  }
  async unlock(){
    if(this.started||this.unlockPromise)return this.unlockPromise;const generation=this.generation;
    this.unlockPromise=Promise.all([this.video,this.audio].map(async element=>{
      const t=element.currentTime||0;element.volume=0;try{await element.play();}catch{}
      if(this.generation!==generation||this.started)return;element.pause();try{element.currentTime=t;}catch{}this.restoreVolumes();
    })).finally(()=>{this.unlockPromise=null;this.restoreVolumes();});return this.unlockPromise;
  }
  start(at=0){this.invalidate('start');this.waitingAt=null;this.scrub=null;this.previewStage=false;this.absolute=Math.max(0,at);this.stageRevealComplete=false;this.video.pause();this.audio.pause();this.started=true;this.playing=true;this.restoreVolumes();this.phase='film';this.setVideoTime(this.absolute);this.callbacks.onFilm?.({reason:'start'});return this.playSource();}
  pause(){this.invalidate('pause');this.playing=false;if(this.scrub)this.scrub.wasPlaying=false;this.video.pause();this.audio.pause();}
  resume(){this.invalidate('resume');this.playing=true;this.restoreVolumes();this.syncImpact(true);return this.playSource();}
  toggle(){return this.playing?this.pause():this.resume();}
  setMuted(value){this.muted=!!value;this.video.muted=this.audio.muted=this.muted;}
  enterStage(at=0,{resume=this.playing,reason='manual',revealComplete=true}={}){
    this.previewStage=reason==='manual';const active=this.phase==='stage';this.seekAt(CONFIG.stage.origin+at,{resume,reason,forceStage:true});this.stageRevealComplete=revealComplete;
    if(active&&!this.deferredSeek)this.callbacks.onStage?.({reason,at,revealComplete});return true;
  }
  seek(target,options={}){const resume=this.playing;this.scrub=null;this.previewStage=false;return this.seekAt(target,{resume,...options});}
  seekAt(time,{resume=false,reason='seek',forceStage=false}={}){
    const target=Math.min(this.duration,Math.max(0,Number(time)||0));this.invalidate(reason);this.video.pause();this.audio.pause();this.absolute=target;this.started=true;this.playing=!!resume;this.restoreVolumes();
    if(this.waitingAt||this.deferredSeek)this.callbacks.onBuffering?.(false);this.waitingAt=null;this.deferredSeek=null;
    if((forceStage||target>=CONFIG.film.stageAt)&&this.callbacks.canEnterStage?.()===false){this.deferredSeek={target,reason,forceStage};this.callbacks.onBuffering?.(true);this.setVideoTime(target);return target;}
    this.stageRevealComplete=true;if(!forceStage)this.previewStage=false;
    this.setPhase(forceStage||target>=CONFIG.film.stageAt?'stage':'film',{reason,target,at:this.time,revealComplete:true});
    this.setVideoTime(target);this.syncImpact(true);if(this.playing)this.playSource();return target;
  }
  beginScrub(){if(this.scrub||!this.canSeek)return !!this.scrub;const startTime=this.currentTime,wasPlaying=this.playing;this.invalidate('scrub-begin');this.video.pause();this.audio.pause();this.playing=false;this.pendingSeek=null;this.scrub={startTime,previewTime:startTime,wasPlaying};return true;}
  previewScrub(time){if(!this.scrub&&!this.beginScrub())return this.currentTime;const t=Math.min(this.duration,Math.max(0,Number(time)||0));this.scrub.previewTime=t;this.seekAt(t,{resume:false,reason:'scrub-preview'});return t;}
  endScrub({cancel=false,resume}={}){const s=this.scrub;if(!s)return false;this.scrub=null;this.seekAt(cancel?s.startTime:s.previewTime,{resume:resume??s.wasPlaying,reason:cancel?'scrub-cancel':'scrub-commit'});return true;}
  syncImpact(force=false){
    const local=this.absolute-(CONFIG.stage.origin+CONFIG.stage.impactStart),duration=Number.isFinite(this.audio.duration)?this.audio.duration:CONFIG.stage.impactDuration;
    if(local<0||local>=duration||this.phase==='departure'){this.audio.pause();return;}
    if(this.audio.readyState<1)return;
    if(force||Math.abs(this.audio.currentTime-local)>.065)try{this.audio.currentTime=local;}catch{}
    if(!this.playing||this.scrub){this.audio.pause();return;}
    if(this.audio.paused&&!this.impactPending){this.impactPending=true;const generation=this.generation;this.audio.play().catch(()=>{}).finally(()=>{this.impactPending=false;if(generation!==this.generation&&!this.playing)this.audio.pause();});}
  }
  skipFilm(){if(!['film','stage'].includes(this.phase))return false;this.finish('skip');return true;}
  finish(reason){if(this.callbacks.canDepart?.()===false){this.waitingAt='scroll';this.waitingReason=reason;this.video.pause();this.audio.pause();this.playing=true;this.callbacks.onBuffering?.(true);return;}this.invalidate(reason);this.playing=false;this.video.pause();this.audio.pause();this.pendingSeek=null;this.scrub=null;this.absolute=this.duration;this.phase='departure';this.callbacks.onDeparture?.({reason});}
  update(dt){
    this.settleSeek();if(this.deferredSeek){if(this.callbacks.canEnterStage?.()===false)return;const d=this.deferredSeek;this.seekAt(d.target,{reason:d.reason,resume:this.playing,forceStage:d.forceStage});return;}if(!this.playing||this.scrub||this.phase==='departure')return;
    if(this.waitingAt){const ready=this.waitingAt==='stage'?this.callbacks.canEnterStage?.():this.callbacks.canDepart?.();if(ready===false)return;const target=this.waitingAt;this.waitingAt=null;this.callbacks.onBuffering?.(false);if(target==='scroll'){this.finish(this.waitingReason);return;}this.playSource();}
    if(this.pendingSeek||this.awaitingPlay)return;
    if(this.absolute>=this.filmDuration&&this.filmDuration>0)this.absolute+=Math.min(.1,Math.max(0,dt));
    else if(!this.video.paused||this.video.ended)this.absolute=this.video.currentTime-this.offset;
    if(this.phase==='film'&&this.visualTime>=CONFIG.film.stageAt){if(this.callbacks.canEnterStage?.()===false){this.waitingAt='stage';this.video.pause();this.callbacks.onBuffering?.(true);return;}this.stageRevealComplete=false;this.setPhase('stage',{reason:'native-stage-opening',at:this.time,revealComplete:false});this.record('visual-cut',{videoTime:this.video.currentTime,stageTime:this.time,videoPaused:this.video.paused});}
    this.syncImpact();if(this.absolute>=this.duration)this.finish('complete');
  }
  replace(file){this.pause();this.scrub=null;this.pendingSeek=null;if(this.objectURL)URL.revokeObjectURL(this.objectURL);this.objectURL=URL.createObjectURL(file);this.video.src=this.objectURL;CONFIG.film.label='本机替换影片';this.absolute=0;this.phase='film';this.started=false;}
  snapshot(){return{visualTime:this.visualTime,visualStageTime:this.visualStageTime,waitingAt:this.waitingAt||null,phase:this.phase,time:this.time,currentTime:this.currentTime,duration:this.duration,filmDuration:this.filmDuration,playing:this.playing,muted:this.muted,generation:this.generation,isScrubbing:this.isScrubbing,scrub:this.scrub?{...this.scrub}:null,pendingSeek:this.pendingSeek,awaitingPlay:this.awaitingPlay,revealProgress:this.revealProgress,musicClock:'original video audio (continuous)',media:{videoTime:this.video.currentTime,videoPaused:this.video.paused,videoSeeking:this.video.seeking,audioTime:this.audio.currentTime,audioPaused:this.audio.paused,impactTarget:Math.max(0,this.absolute-CONFIG.stage.origin-CONFIG.stage.impactStart)},events:this.events.slice(-30)};}
  dispose(){if(this.videoFrame)this.video.cancelVideoFrameCallback?.(this.videoFrame);this.pause();this.abort.abort();if(this.objectURL)URL.revokeObjectURL(this.objectURL);}
}
