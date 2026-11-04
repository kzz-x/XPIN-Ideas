import {CONFIG} from './config.mjs';
export class PresentationTransport {
  constructor(video,audio,{onStage,onDeparture,onFilm,onTransition,onError}={}){
    this.video=video;this.audio=audio;this.callbacks={onStage,onDeparture,onFilm,onTransition,onError};
    this.phase='film';this.time=0;this.playing=false;this.muted=false;this.generation=0;this.started=false;this.events=[];
    this.transition=null;this.scrub=null;this.pendingSeek=null;this.pendingAudioTime=null;this.awaitingPlay=null;
    this.stageRevealComplete=false;this.audioEnded=false;this.unlockPromise=null;this.abort=new AbortController();
    video.src=CONFIG.film.src;audio.src=CONFIG.stage.src;
    const options={signal:this.abort.signal};
    video.addEventListener('ended',()=>{
      // An ended event queued before a seek is not authority to leave the new position.
      if(this.phase==='film'&&this.playing&&!this.isScrubbing&&!this.pendingSeek&&!video.seeking&&video.ended)this.beginTransition('ended',0);
    },options);
    video.addEventListener('loadedmetadata',()=>this.applyPendingVideoSeek(),options);
    video.addEventListener('seeked',()=>this.settleVideoSeek(),options);
    video.addEventListener('error',()=>{
      if(this.phase==='film'&&video.error){this.pause();this.callbacks.onError?.('影片读取失败，请在设置中选择本机影片。');}
    },options);
    audio.addEventListener('loadedmetadata',()=>{
      if(this.pendingAudioTime!==null&&this.phase==='stage')this.setAudioTime(this.pendingAudioTime);
    },options);
    audio.addEventListener('ended',()=>{if(this.phase==='stage'&&audio.ended&&!audio.seeking&&!this.isScrubbing)this.audioEnded=true;},options);
  }
  get filmDuration(){return Number.isFinite(this.video.duration)&&this.video.duration>0?this.video.duration:0;}
  get stageDuration(){return CONFIG.stage.performanceDuration+CONFIG.stage.afterglow+CONFIG.stage.dissolve+CONFIG.stage.tail;}
  get duration(){return this.filmDuration+this.stageDuration;}
  get canSeek(){return this.filmDuration>0&&this.duration>0;}
  get isScrubbing(){return !!this.scrub;}
  get currentTime(){
    if(this.scrub)return this.scrub.previewTime;
    if(this.phase==='film')return this.pendingSeek?.time??this.video.currentTime??0;
    return this.filmDuration+this.time;
  }
  get revealProgress(){
    if(this.phase==='transition')return this.transition?.reveal??0;
    return this.stageRevealComplete?1:Math.min(1,Math.max(0,this.time/3.5));
  }
  record(event,data={}){this.events.push({event,at:performance.now(),generation:this.generation,...data});if(this.events.length>240)this.events.shift();}
  invalidate(reason){this.generation++;this.awaitingPlay=null;if(this.pendingSeek)this.pendingSeek.generation=this.generation;this.record(reason);return this.generation;}
  current(generation,phase){return generation===this.generation&&this.phase===phase;}
  restoreVolumes(){this.video.volume=1;this.audio.volume=1;this.video.muted=this.muted;this.audio.muted=this.muted;}
  notifyPhase(previous,detail={}){
    if(previous===this.phase)return;
    if(this.phase==='film')this.callbacks.onFilm?.(detail);
    if(this.phase==='stage')this.callbacks.onStage?.(detail);
  }
  setVideoTime(time,generation=this.generation){
    this.pendingSeek={time,generation};this.applyPendingVideoSeek();
  }
  applyPendingVideoSeek(){
    const pending=this.pendingSeek;
    if(!pending||pending.generation!==this.generation||this.phase!=='film'||this.video.readyState<1)return;
    const end=Math.max(0,this.filmDuration-.001),target=Math.min(end,Math.max(0,pending.time));pending.time=target;
    try{this.video.currentTime=target;this.settleVideoSeek();}catch{/* Metadata may become ready on the next event. */}
  }
  settleVideoSeek(){
    const pending=this.pendingSeek;
    if(pending&&pending.generation===this.generation&&this.phase==='film'&&!this.video.seeking&&Math.abs(this.video.currentTime-pending.time)<.075)this.pendingSeek=null;
  }
  setAudioTime(time){
    this.audioEnded=false;this.pendingAudioTime=time;
    if(this.audio.readyState<1)return;
    try{this.audio.currentTime=Math.max(0,Math.min(time,Number.isFinite(this.audio.duration)?this.audio.duration:time));this.pendingAudioTime=null;}catch{}
  }
  async playMedia(element,generation,phase,{notify=false,quiet=false}={}){
    this.awaitingPlay={generation,phase,kind:element===this.video?'video':'audio'};
    try{
      await element.play();
      if(!this.current(generation,phase)||!this.playing||this.isScrubbing)return false;
      if(this.awaitingPlay?.generation===generation)this.awaitingPlay=null;
      this.record(element===this.video?'film-playing':'stage-playing');
      if(notify)this.callbacks.onFilm?.({reason:'start'});
      return true;
    }catch(error){
      // AbortError from an old play/seek/pause never overrides a more recent intent.
      if(!this.current(generation,phase)||!this.playing||this.isScrubbing)return false;
      if(this.awaitingPlay?.generation===generation)this.awaitingPlay=null;
      if(quiet)return false;
      this.playing=false;this.video.pause();this.audio.pause();this.record('play-blocked',{name:error?.name});
      if(notify)this.callbacks.onFilm?.({reason:'play-blocked'});
      this.callbacks.onError?.(phase==='stage'?'舞台音乐尚未播放，请按播放键继续。':'播放被浏览器暂缓，请按播放键继续。');
      return false;
    }
  }
  async unlock(){
    if(this.started||this.unlockPromise)return this.unlockPromise;
    const generation=this.generation;
    this.unlockPromise=(async()=>{
      for(const element of [this.video,this.audio]){
        if(!this.current(generation,'film')||this.started||this.isScrubbing)return;
        const originalTime=element.currentTime||0;element.volume=0;element.muted=this.muted;
        try{await element.play();}catch{}
        // Never rewind a later start/seek/skip when this preflight finishes late.
        if(!this.current(generation,'film')||this.started||this.isScrubbing)return;
        element.pause();try{element.currentTime=originalTime;}catch{}element.volume=1;
      }
    })().finally(()=>{this.unlockPromise=null;});
    return this.unlockPromise;
  }
  async start(){
    const generation=this.invalidate('start');this.scrub=null;this.transition=null;this.pendingSeek=null;
    this.audio.pause();this.video.pause();this.restoreVolumes();this.phase='film';this.time=0;this.stageRevealComplete=false;
    this.playing=true;this.started=true;this.setVideoTime(0,generation);
    return this.playMedia(this.video,generation,'film',{notify:true});
  }
  async enterStage(at=0,{resume=this.playing,reason='manual',revealComplete=false}={}){
    const previous=this.phase,generation=this.invalidate('enter-stage');
    this.scrub=null;this.transition=null;this.pendingSeek=null;this.video.pause();this.audio.pause();this.restoreVolumes();
    this.phase='stage';this.time=Math.min(this.stageDuration,Math.max(0,at));this.playing=!!resume;this.started=true;this.stageRevealComplete=revealComplete;
    this.setAudioTime(Math.min(this.time,CONFIG.stage.performanceDuration));
    this.notifyPhase(previous,{reason,at:this.time,revealComplete});
    if(previous==='stage'&&reason==='manual')this.callbacks.onStage?.({reason,at:this.time,revealComplete});
    if(this.playing&&this.time<CONFIG.stage.performanceDuration)return this.playMedia(this.audio,generation,'stage');
    return true;
  }
  beginTransition(reason='ended',stageAt=0){
    if(this.phase==='transition')return false;
    this.invalidate('transition-'+reason);this.scrub=null;this.pendingSeek=null;this.audio.pause();this.started=true;
    const filmWasPlaying=!this.video.paused&&!this.video.ended;
    this.phase='transition';this.time=Math.min(this.stageDuration,Math.max(0,stageAt));this.playing=true;this.stageRevealComplete=false;
    this.transition={reason,stageAt:this.time,elapsed:0,duration:2.4,fadeDuration:.65,whiteHold:.12,fade:0,reveal:0,filmWasPlaying};
    this.callbacks.onTransition?.({...this.transition});return true;
  }
  skipFilm(){
    if(this.phase!=='film')return false;
    return this.beginTransition('skip',CONFIG.stage.performanceDuration);
  }
  pause(){
    this.invalidate('pause');this.playing=false;if(this.scrub)this.scrub.wasPlaying=false;
    this.video.pause();this.audio.pause();
  }
  async resume(){
    const generation=this.invalidate('resume');this.playing=true;this.video.muted=this.muted;this.audio.muted=this.muted;
    if(this.phase==='film'){this.video.volume=1;return this.playMedia(this.video,generation,'film');}
    if(this.phase==='stage'&&this.time<CONFIG.stage.performanceDuration){this.audio.volume=1;return this.playMedia(this.audio,generation,'stage');}
    if(this.phase==='transition'&&this.transition?.filmWasPlaying&&this.transition.fade<1&&!this.video.ended){
      this.video.volume=1-this.transition.fade;return this.playMedia(this.video,generation,'transition',{quiet:true});
    }
    return true;
  }
  toggle(){return this.playing?this.pause():this.resume();}
  setMuted(muted){this.muted=!!muted;this.video.muted=this.muted;this.audio.muted=this.muted;}
  seek(time,{resume=this.playing,reason='seek'}={}){
    this.scrub=null;return this.seekAt(time,{resume,reason});
  }
  seekAt(time,{resume=false,reason='seek'}={}){
    const target=Math.min(this.duration,Math.max(0,Number(time)||0)),previous=this.phase,generation=this.invalidate(reason);
    this.transition=null;this.pendingSeek=null;this.video.pause();this.audio.pause();this.restoreVolumes();this.started=true;this.playing=!!resume;
    if(target<this.filmDuration){
      this.phase='film';this.time=0;this.stageRevealComplete=false;this.setVideoTime(target,generation);this.notifyPhase(previous,{reason,target});
      if(this.playing)this.playMedia(this.video,generation,'film');
    }else{
      this.phase='stage';this.time=target-this.filmDuration;this.stageRevealComplete=true;this.setAudioTime(Math.min(this.time,CONFIG.stage.performanceDuration));this.notifyPhase(previous,{reason,target,at:this.time,revealComplete:true});
      if(this.playing&&this.time<CONFIG.stage.performanceDuration)this.playMedia(this.audio,generation,'stage');
    }
    return target;
  }
  beginScrub(){
    if(this.scrub||!this.canSeek)return !!this.scrub;
    const startTime=this.currentTime,wasPlaying=this.playing;this.invalidate('scrub-begin');
    this.video.pause();this.audio.pause();this.playing=false;this.pendingSeek=null;
    this.scrub={startTime,previewTime:startTime,wasPlaying};return true;
  }
  previewScrub(time){
    if(!this.scrub&&!this.beginScrub())return this.currentTime;
    const target=Math.min(this.duration,Math.max(0,Number(time)||0));this.scrub.previewTime=target;
    this.seekAt(target,{resume:false,reason:'scrub-preview'});return target;
  }
  endScrub({cancel=false,resume}={}){
    const scrub=this.scrub;if(!scrub)return false;
    this.scrub=null;this.seekAt(cancel?scrub.startTime:scrub.previewTime,{resume:resume??scrub.wasPlaying,reason:cancel?'scrub-cancel':'scrub-commit'});return true;
  }
  update(dt){
    dt=Math.max(0,Math.min(.1,Number(dt)||0));this.settleVideoSeek();
    if(this.isScrubbing||!this.playing)return;
    if(this.phase==='transition'){
      const tr=this.transition;if(!tr)return;tr.elapsed=Math.min(tr.duration,tr.elapsed+dt);
      const p=Math.min(1,tr.elapsed/tr.fadeDuration);tr.fade=p*p*(3-2*p);
      tr.reveal=Math.min(1,Math.max(0,(tr.elapsed-tr.fadeDuration-tr.whiteHold)/(tr.duration-tr.fadeDuration-tr.whiteHold)));
      this.video.volume=1-tr.fade;if(tr.fade>=1)this.video.pause();
      if(tr.elapsed>=tr.duration)this.enterStage(tr.stageAt,{resume:true,reason:tr.reason,revealComplete:true});
      return;
    }
    if(this.phase!=='stage')return;
    if(this.time<CONFIG.stage.performanceDuration){
      // The media clock is authoritative; buffering/awaiting play must not advance Dot.
      if(this.pendingAudioTime!==null||this.awaitingPlay)return;
      if(!this.audio.paused)this.time=Math.min(CONFIG.stage.performanceDuration,this.audio.currentTime);
      else if(this.audioEnded)this.time=CONFIG.stage.performanceDuration;
      if(this.time>=CONFIG.stage.performanceDuration)this.audio.pause();
    }else{this.audio.pause();this.time+=dt;}
    if(this.time>=this.stageDuration){
      this.time=this.stageDuration;this.playing=false;this.video.pause();this.audio.pause();this.phase='departure';this.invalidate('departure');this.callbacks.onDeparture?.();
    }
  }
  replace(file){
    this.pause();this.scrub=null;this.transition=null;this.pendingSeek=null;this.pendingAudioTime=null;this.restoreVolumes();
    if(this.objectURL)URL.revokeObjectURL(this.objectURL);this.objectURL=URL.createObjectURL(file);this.video.src=this.objectURL;
    CONFIG.film.status='user-preview';CONFIG.film.label='本机替换预览 · 接点待复核';CONFIG.film.seamlessTail=false;
    this.time=0;this.phase='film';this.started=false;this.stageRevealComplete=false;
  }
  snapshot(){return {phase:this.phase,time:this.time,currentTime:this.currentTime,duration:this.duration,filmDuration:this.filmDuration,playing:this.playing,muted:this.muted,generation:this.generation,isScrubbing:this.isScrubbing,scrub:this.scrub?{...this.scrub}:null,pendingSeek:this.pendingSeek?{...this.pendingSeek}:null,awaitingPlay:this.awaitingPlay?{...this.awaitingPlay}:null,transition:this.transition?{...this.transition}:null,revealProgress:this.revealProgress,media:{videoTime:this.video.currentTime,videoPaused:this.video.paused,videoSeeking:this.video.seeking,videoEnded:this.video.ended,audioTime:this.audio.currentTime,audioPaused:this.audio.paused},events:this.events.slice(-24)};}
  dispose(){this.pause();this.abort.abort();if(this.objectURL)URL.revokeObjectURL(this.objectURL);}
}

/** One owner for the range value, explicit pointer capture, and a real scrub transaction. */
export function bindSeekControl(input,transport,{onUserGesture=()=>{},thumbSize=18,keyboardStep=2}={}){
  const abort=new AbortController(),options={signal:abort.signal};let pointerId=null,keyboard=false,dead=false;
  input.style.touchAction='none';input.setAttribute('aria-label','拖动进度：影片与 Dot 舞台');
  function paint(){input.style.setProperty('--seek-progress',`${Math.min(100,Math.max(0,Number(input.value)/Math.max(1,transport.duration)*100))}%`);input.setAttribute('aria-valuetext',`${Math.floor(Number(input.value)||0)} 秒 / ${Math.floor(transport.duration)} 秒`);}
  function update(){
    if(dead)return;input.max=String(Math.max(1,transport.duration));input.disabled=!transport.canSeek;
    if(pointerId===null&&!keyboard&&!transport.isScrubbing)input.value=String(transport.currentTime);
    paint();
  }
  function start(){onUserGesture();return transport.beginScrub();}
  function preview(value){input.value=String(transport.previewScrub(value));paint();}
  function fromPointer(event){
    const rect=input.getBoundingClientRect(),pad=Math.min(thumbSize/2,rect.width/4),p=Math.min(1,Math.max(0,(event.clientX-rect.left-pad)/Math.max(1,rect.width-pad*2)));
    return p*transport.duration;
  }
  function finish(event){
    if(pointerId===null||event&&event.pointerId!==pointerId)return;
    if(event?.type==='pointerup')preview(fromPointer(event));
    const id=pointerId;pointerId=null;transport.endScrub();if(input.hasPointerCapture?.(id))input.releasePointerCapture(id);update();
  }
  input.addEventListener('pointerdown',event=>{
    if(event.button>0||input.disabled||pointerId!==null)return;event.preventDefault();event.stopPropagation();if(!start())return;
    pointerId=event.pointerId;input.setPointerCapture?.(pointerId);input.focus({preventScroll:true});preview(fromPointer(event));
  },options);
  input.addEventListener('pointermove',event=>{if(event.pointerId!==pointerId)return;event.preventDefault();event.stopPropagation();preview(fromPointer(event));},options);
  input.addEventListener('pointerup',finish,options);
  // A timeline interruption commits its last visible frame. This is intentionally
  // different from dragging a game piece; losing capture must not rewind the film.
  input.addEventListener('pointercancel',finish,options);
  input.addEventListener('lostpointercapture',event=>{if(event.pointerId===pointerId)finish(event);},options);
  const keys=['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End','PageDown','PageUp'];
  input.addEventListener('keydown',event=>{
    if(!keys.includes(event.key)||input.disabled)return;event.preventDefault();event.stopPropagation();if(!keyboard){if(!start())return;keyboard=true;}
    const old=Number(input.value)||0,delta=['ArrowRight','ArrowUp','PageUp'].includes(event.key)?1:-1;
    preview(event.key==='Home'?0:event.key==='End'?transport.duration:old+delta*(event.key.startsWith('Page')?10:keyboardStep));
  },options);
  input.addEventListener('keyup',event=>{if(keyboard&&keys.includes(event.key)){event.preventDefault();event.stopPropagation();keyboard=false;transport.endScrub();update();}},options);
  // Screen-reader/native change paths use the same transaction, without double-seeking pointer moves.
  input.addEventListener('input',()=>{if(pointerId!==null||keyboard)return;if(start()){preview(Number(input.value));transport.endScrub();}},options);
  input.addEventListener('blur',()=>{if(keyboard){keyboard=false;transport.endScrub();update();}},options);
  update();
  return {update,snapshot:()=>({pointerId,keyboard,dragging:pointerId!==null||keyboard,value:Number(input.value),max:Number(input.max),progress:input.style.getPropertyValue('--seek-progress'),disabled:input.disabled}),dispose(){dead=true;abort.abort();pointerId=null;keyboard=false;transport.endScrub();}};
}
export function createSound(){let ctx=null,muted=false;return {unlock(){try{ctx??=new AudioContext();ctx.resume();}catch{}},setMuted(v){muted=v;},play(type){if(!ctx||muted||ctx.state!=='running')return;const table={pickup:[420,.035,.035],wrong:[190,.10,.025],correct:[760,.13,.04],complete:[1040,.26,.04],stamp:[110,.19,.065],help:[560,.09,.025],open:[380,.09,.025],close:[290,.10,.022]};const [frequency,duration,volume]=table[type]||table.correct;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type==='stamp'?'triangle':'sine';o.frequency.setValueAtTime(frequency,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*(type==='wrong'?.72:1.25),ctx.currentTime+duration);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(volume,ctx.currentTime+.008);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration+.02);}};}
