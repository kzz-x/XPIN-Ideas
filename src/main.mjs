import {yieldTask,nextPaint,delay,waitFor} from './preparation.mjs';
import {warmScene,warmEnvironment} from './scene-warm.mjs';
import {createFilmMedia} from './film-media.mjs';
import {createStreamingBgm} from './bgm-stream.mjs';
import {createSound,bindUiSound} from './sound-design.mjs';
import {createAudioMix,bindAudioMix} from './audio-mix.mjs';
import {createBubbleEmphasis} from './bubble-emphasis.mjs';
import {ListeningGate} from './listening-gate.mjs';
import {createReturnVisit,ReturnHold} from './return-entry.mjs';
import {COUNTS} from './games-rules.mjs';
import * as T from 'three';
import {CSS3DRenderer} from 'three/addons/renderers/CSS3DRenderer.js';
import {createOpening,OPENING_TIMING} from './opening-r08.mjs';
import {glassEnvironment} from './frosted-glass.mjs';

import {createChatPresentation,createCinemaControls} from './chat-r07.mjs';
import {createDotForeground} from './dot-foreground.mjs';


import {PresentationTransport,bindSeekControl} from './transport-r07.mjs';
import {CONFIG} from './config.mjs';
import {createRenderQuality} from './render-quality.mjs';
import {CHAPTERS} from './content.mjs';
import {loadType,clamp,smooth,damp,vec,project} from './space-utils.mjs';

const $=id=>document.getElementById(id),canvas=$('world'),film=$('film'),audio=$('stage-audio'),portal=$('portal');
const ui={phase:'loading',phaseAt:0,scroll:0,target:0,scrollVelocity:0,held:false,hold:0,holdStart:0,muted:false,gameLock:false,focusLock:false,bubbleUntil:0,bubbleX:0,bubbleY:0,chapter:0,game:-1,stageEntryAt:0,frameTimes:[],blackAt:0,events:[],errors:[]};
let opening,dot,dotForeground,games,space,renderer,scene,camera,css,key,keyTarget,quality,previous=performance.now()/1000,time=0,startedAt=previous,toastTimer;
const runtime={ready:false,actorReady:false,stageReady:false,scrollReady:false,scrollProgress:0,scrollLabel:'正在准备空间',openingReadyAt:null,stageReadyAt:null,worldReadyAt:null,requested:false,longTasks:[]};
let actorJob,stageJob,screenReady,scrollJob,worldJob,fontsReady,rigModule,rigAssets,rigJob,stageRenderer,filmStarting=false;
let cueEdited=false;const media=createFilmMedia(film,{manifestURL:new URL(CONFIG.film.manifest,location.href).href,onManifest:m=>{if(!cueEdited&&Number.isFinite(m.stageAt))applyCue(m.stageAt);$('film-status').textContent=m.label+' · 同源大屏 / 分段预载';}});
const waitLabel=document.createElement('div');waitLabel.id='media-wait';waitLabel.setAttribute('role','status');waitLabel.textContent='[ · · · ] 正在准备下一幕';document.body.append(waitLabel);
function buffering(on){waitLabel.classList.toggle('visible',!!on);}
if(globalThis.PerformanceObserver)try{new PerformanceObserver(list=>runtime.longTasks.push(...list.getEntries().map(e=>({at:e.startTime,ms:e.duration,phase:ui.phase})))).observe({type:'longtask',buffered:true});}catch{}
function bootProgress(p,label){$('loading-bar').textContent='['+'#'.repeat(Math.floor(p*24))+'.'.repeat(24-Math.floor(p*24))+'] '+String(Math.round(p*100)).padStart(2,'0')+'%';$('loading-status').textContent=label;}
let resolveWorld,rejectWorld;
const worldReady=new Promise((resolve,reject)=>{resolveWorld=resolve;rejectWorld=reject;});
worldReady.catch(()=>{});
const idleFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
async function readyAction(action,button){
  runtime.requested=true;const label=button?.textContent;
  if(button&&!runtime.ready){button.disabled=true;button.textContent='正在准备…';}
  try{await prepareWorld();action();}catch(error){toast('场景暂未就绪，请稍后重试。');}
  finally{if(button){button.disabled=false;if(label)button.textContent=label;}}
}
const audioMix=createAudioMix(),listeningGate=new ListeningGate(2),returnVisit=createReturnVisit(),returnHold=new ReturnHold(1000);let listenGeneration=0,returnGeneration=0,returnBusy=false;
const sound=createSound({volume:audioMix.snapshot().sfx}),chatPresentation=createChatPresentation({onTyping:count=>sound.typing(count)});bindUiSound(sound);let activateSoundOnly=false;
const bgm=createStreamingBgm({getContext:()=>sound.ensureContext(),getOutput:()=>sound.musicBus,onError:toast,onChange:s=>{
  updateSoundButton();
  for(const id of ['bgm-toggle','bgm-enabled']){$(id).setAttribute('aria-pressed',String(s.enabled));$(id).setAttribute('aria-label',s.enabled?'关闭背景音乐':'开启背景音乐');}
  $('bgm-toggle').textContent=s.enabled?'BGM / 开':'BGM / 关';$('bgm-enabled').textContent=s.enabled?'BGM / 开':'BGM / 关';
  $('bgm-volume').value=Math.round(s.volume*100);$('bgm-value').value=Math.round(s.volume*100)+'%';
  $('bgm-status').textContent=s.error?'音乐暂未载入':!s.enabled?'背景音乐已关闭 · 影片与互动音效不受影响':s.finished?'本次创作已通关 · 音乐已收尾':s.complete?'已通关 · 音乐将在乐句出口自然收尾':s.active&&!s.ready?'背景音乐正在载入':s.needsGesture?'点击任意位置启用音乐':s.active?(s.section==='opening'?'开场音乐 · 无损连续播放':'卷轴音乐 · 从头播放，通关前循环'):'影片与舞台期间停止背景音乐';
}});
const bubbleEmphasis=createBubbleEmphasis($('dot-bubble'),{onCue:()=>sound.play('select',{intensity:.32,cooldown:350})});
const scrollPointer={x:0,y:0,dx:0,dy:0};
function unlockAudio(e){if(e.target?.closest?.('#sound'))activateSoundOnly=!ui.muted&&sound.context?.state!=='running';sound.unlock();bgm.unlock();updateSoundButton();}
window.addEventListener('pointerdown',unlockAudio,{capture:true});
window.addEventListener('keydown',unlockAudio,{capture:true});
for(const id of ['bgm-toggle','bgm-enabled'])$(id).addEventListener('click',()=>bgm.setEnabled(!bgm.snapshot().enabled));

bgm.setMasterMuted(false);
sound.connectMediaElement(film);sound.connectMediaElement(audio);
function updateCompletion(){if(games)bgm.setComplete(COUNTS.every((n,i)=>games.getState().done[i].length===n));}
window.addEventListener('pointermove',e=>{if(ui.phase==='scroll'&&e.pointerType!=='touch'){scrollPointer.x=e.clientX/innerWidth*2-1;scrollPointer.y=1-e.clientY/innerHeight*2;space?.pointerMove(e);}},true);
document.addEventListener('pointerleave',()=>{scrollPointer.x=scrollPointer.y=0;space?.clearHover();});
const transport=new PresentationTransport(film,audio,{managedMedia:true,getVideoVolume:()=>audioMix.snapshot().video,getMediaOffset:()=>media.timeOffset,canPlayAt:at=>media.canPlayAt(at),requestMedia:at=>media.ensure(at,3).catch(error=>toast(error.message)),canEnterStage:()=>runtime.ready,canDepart:()=>runtime.ready,onBuffering:buffering,onFilm(){setPhase('film');prepareWorld().catch(()=>{});},onStage(){ui.stageEntryAt=time;setPhase('stage');},onTransition(){ui.stageEntryAt=time;setPhase('transition');},onDeparture(){if(ui.phase==='film'){dot?.update({time,dt:0,mode:'stage',stageTime:CONFIG.stage.end,pixelRatio:renderer.getPixelRatio()});camera.copy(dot.stageCamera,false);camera.layers.set(0);look.copy(camera.position).add(camera.getWorldDirection(vec()).multiplyScalar(10));}setPhase('departure');},onError:toast});
const mixControls=bindAudioMix(audioMix,{onToast:toast,onPreview:()=>{sound.unlock();sound.play('click');setTimeout(()=>sound.play('win'),230);}});
function applyAudioMix(values){sound.setVolume(values.sfx);bgm.setVolume(values.bgm);transport.restoreVolumes();}
audioMix.subscribe(applyAudioMix);applyAudioMix(audioMix.snapshot());
const cinemaControls=createCinemaControls({transport,getPhase:()=>ui.phase});
const seekControl=bindSeekControl($('seek'),transport,{onUserGesture:()=>sound.unlock()});
window.addEventListener('error',e=>ui.errors.push(e.message));window.addEventListener('unhandledrejection',e=>ui.errors.push(String(e.reason)));
function updateSoundButton(){const blocked=!ui.muted&&sound.context?.state!=='running';$('sound').textContent=ui.muted?'声 / 关':blocked?'声 / 启用':'声 / 开';$('sound').setAttribute('aria-label',ui.muted?'打开声音':blocked?'启用声音与背景音乐':'关闭声音');}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function display(id,show,mode='block'){$(id).style.display=show?mode:'none';}
function setPhase(phase){const priorPhase=ui.phase;ui.phase=phase;ui.phaseAt=time;document.body.dataset.phase=phase;ui.events.push({phase,time,at:performance.now()});const scroll=phase==='scroll',intro=phase==='intro',movingIntro=['intro','morph','chat','launch','black'].includes(phase),watch=['film','transition','stage'].includes(phase);
  if(intro)dot?.update({mode:'hidden'});
  if(!['stage','transition','departure'].includes(phase))dot?.source?.hide();
  if(scroll&&camera){camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?48:42;camera.near=.05;camera.far=220;camera.updateProjectionMatrix();}
  display('intro-copy',intro);display('hold',intro,'flex');$('return-scroll').hidden=!(intro&&returnVisit.eligible);if(intro)requestAnimationFrame(placeReturnButton);display('portal',['morph','chat','launch','black','film','transition'].includes(phase));display('chat',['morph','chat'].includes(phase));display('code',phase==='launch');display('film',['film','transition'].includes(phase));display('film-badge',phase==='film');display('transport',watch,'flex');display('stage-caption',phase==='stage');$('skip-film').style.visibility=watch?'visible':'hidden';$('skip-film').disabled=!watch;$('skip-film').firstChild.textContent=phase==='stage'?'进入卷轴 ':'跳过影片 ';cinemaControls.reveal();$('handoff-white').style.opacity='0';display('chapters',scroll,'flex');display('scroll-footer',scroll,'flex');display('chapter-caption',scroll);display('dot-bubble',false);display('game-controls',false);display('scroll-cue',scroll&&ui.scroll<1);
  $('masthead').style.visibility=['black','listen','return-wait'].includes(phase)?'hidden':'visible';$('listening-overlay').classList.toggle('visible',phase==='listen');$('listening-overlay').setAttribute('aria-hidden',String(phase!=='listen'));$('blackout').style.opacity=phase==='black'?'1':'0';portal.style.opacity='1';$('portal-frame').style.opacity=phase==='film'?'0':'1';if(phase==='film'){$('film-badge').textContent=CONFIG.film.label;portal.style.boxShadow='none';}else portal.style.boxShadow='0 28px 80px #0006';
  if(phase==='scroll'){bgm.enter({restart:true,section:'scroll'});updateCompletion();}else{space?.cancelFocus();if(['intro','morph','chat','launch','return-wait'].includes(phase)){const b=bgm.snapshot();if(!b.active||b.section!=='opening')bgm.enter({restart:true,section:'opening'});}else bgm.leave();}
  if(phase!=='intro')sound.updateHold(0,false);if(phase==='morph')sound.play('charge');if(priorPhase==='morph'&&phase==='chat')sound.stopParticles();if(phase==='launch')sound.play('send');if(phase==='black')sound.play('sweep',{intensity:.6});if(phase==='departure')sound.play('turn',{intensity:.7});if(!['morph','chat'].includes(phase))sound.stopParticles();
  if(phase==='scroll'){returnVisit.markScrollVisited();ui.target=ui.scroll=ui.scrollVelocity=0;ui.game=-1;setBubble('你好，我是 Dot。我们把这次创作慢慢展开。',7);}
  if(phase==='stage'){ui.scroll=ui.target=ui.scrollVelocity=0;ui.stageGreeting=false;}
  if(phase==='black'){ui.blackAt=performance.now();ui.events.push({event:'pure-black-start',at:ui.blackAt});}
  if(!scroll){ui.target=0;games?.setActiveChapter(-1);}if(!movingIntro)ui.held=false;
}
function setBubble(text,duration=5){if(!text)return;bubbleEmphasis.announce();$('dot-bubble-text').textContent=text;ui.bubbleUntil=time+duration;}
async function init(){
  renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  scene=new T.Scene();glassEnvironment(scene);scene.background=new T.Color('#0b0c0e');scene.fog=new T.Fog('#0b0c0e',48,100);camera=new T.PerspectiveCamera(innerWidth<700?48:42,innerWidth/innerHeight,.05,220);camera.position.set(3,18,22);camera.lookAt(0,0,-3);
  scene.add(new T.HemisphereLight(0xf0f1f3,0x222327,1.35));key=new T.DirectionalLight(0xfffdf8,3.0);key.position.set(-6,18,12);key.castShadow=true;key.shadow.mapSize.set(1536,1536);key.shadow.camera.left=-18;key.shadow.camera.right=18;key.shadow.camera.top=21;key.shadow.camera.bottom=-21;key.shadow.camera.near=.1;key.shadow.camera.far=65;key.shadow.bias=-.0007;key.shadow.normalBias=.035;keyTarget=new T.Object3D();scene.add(keyTarget);key.target=keyTarget;scene.add(key);const fill=new T.DirectionalLight(0xbfc7d0,.6);fill.position.set(-12,8,-12);scene.add(fill);
  quality=createRenderQuality({renderer,key,width:innerWidth,height:innerHeight});
  css=new CSS3DRenderer({element:$('spatial')});css.setSize(innerWidth,innerHeight);
  // CSS3D camera transforms own placement. Prevent focus/scrollIntoView from
  // scrolling the renderer container; card-detail keeps its own native scroll.
  css.domElement.style.overflow='clip';
  bootProgress(.12,'正在准备真实字形');
  fontsReady=Promise.all([document.fonts.load('400 48px Idea','想法先行组织步骤资源档案'),document.fonts.load('700 48px Idea','主体构图色彩光影材质氛围')]);
  const environmentModule=import('../assets/r03-stage/v011/DotSharedWeb/stage.mjs');
  const rigModuleJob=import('../assets/dot/index.mjs');
  const stageModuleJob=import('./dot-stage-r07.mjs');
  opening=await createOpening({canvas,onInteract:()=>sound.play('select',{pitch:.8,intensity:.75})});resize();bootProgress(.45,'正在准备字符与光影');bgm.enter({restart:true,section:'opening'});
  await Promise.all([fontsReady,chatPresentation.ready,sound.prepareOpening()]);portalLayout(0);await opening.prepare(renderer);bootProgress(.82,'正在准备第一帧');
  opening.update({time:0,dt:0,phase:'intro'});await warmScene(renderer,opening.scene,opening.camera);renderer.render(opening.scene,opening.camera);
  window.__linggan={ui,bgm,sound,audioMix,listeningGate,returnVisit,returnHold,media,scrollPointer,scene,camera,renderer,quality,opening,runtime,transport,seekControl,config:CONFIG,version:CONFIG.version,prepareWorld,prepareScroll,getSnapshot:()=>({phase:ui.phase,scroll:ui.scroll,game:ui.game,mediaTime:transport.currentTime,paused:!transport.playing,errors:[...ui.errors],frameMs:ui.frameTimes.slice(-240),events:[...ui.events],runtime:{...runtime},media:media.snapshot(),dot:dot?.snapshot(),bgm:bgm.snapshot(),sound:sound.snapshot(),bubble:bubbleEmphasis.snapshot(),audioMix:audioMix.snapshot(),listening:listeningGate.snapshot(),returnEntry:{...returnVisit.snapshot(),held:returnHold.held,holdProgress:returnHold.progress,busy:returnBusy},games:games?.snapshot()})};
  rigModule=await rigModuleJob;await stageModuleJob;bootProgress(.94,'正在准备连续画面');
  const {makeEnvironment}=await environmentModule;globalThis.DOT_PREWARM_ENVIRONMENT=makeEnvironment();
  stageRenderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});stageRenderer.outputColorSpace=T.SRGBColorSpace;stageRenderer.toneMapping=T.ACESFilmicToneMapping;
  dotForeground=createDotForeground({scene,camera,worldRenderer:renderer});
  await warmEnvironment(stageRenderer,globalThis.DOT_PREWARM_ENVIRONMENT,camera);await warmEnvironment(renderer,scene.environment,camera);await warmEnvironment(dotForeground.renderer,scene.environment,camera);
  opening.update({time:0,dt:0,phase:'intro'});renderer.render(opening.scene,opening.camera);bootProgress(1,'画面已就绪');await delay(Math.max(0,2000-(performance.now()-(window.__bootStart||0))));
  previous=performance.now()/1000;time=previous-startedAt;setPhase('intro');runtime.openingReadyAt=performance.now();requestAnimationFrame(frame);
  await nextPaint();document.body.classList.add('scene-visible');$('loading').classList.add('leave');setTimeout(()=>$('loading').style.display='none',700);
  prepareRigAssets().catch(()=>{});
  if(returnVisit.eligible)setTimeout(()=>{if(ui.phase==='intro'&&!ui.held)prepareScroll().catch(()=>{});},900);
  worldReady.catch(error=>{ui.errors.push(String(error));console.error(error);toast('下一幕准备失败，请刷新后重试。');});
}
// Only the real first shot is on the opening critical path. Fetch later assets
// while the viewer reads, then build the rig in the existing black beat.
function prepareRigAssets(){return rigAssets??=Promise.all([rigModule||import('../assets/dot/index.mjs'),fetch(new URL('../assets/dot/model/assets/dot-character.glb',import.meta.url),{priority:'low'}).then(r=>{if(!r.ok)throw Error('Dot 模型暂未载入');return r.blob();})]);}
function prepareRig(){return rigJob??=(async()=>{const [{loadSharedDot},blob]=await prepareRigAssets(),asset=URL.createObjectURL(blob);try{const rig=await loadSharedDot({asset,camera,scene,coordinates:'normalized',context:'stage',state:'trumpet',instrument:true});dotForeground.bindRoot(rig.root);return rig;}finally{URL.revokeObjectURL(asset);}})();}
async function prepareActor(){
  if(actorJob)return actorJob;actorJob=(async()=>{
    const rig=await prepareRig();await yieldTask();
    const {createDotStage}=await import('./dot-stage-r07.mjs');
    dot=await createDotStage({scene,camera,film,rig,stageRenderer,deferStage:true,isPlaying:()=>transport.playing,onAction:action=>{if(['scroll','departure'].includes(ui.phase))sound.dotAction(action);}});
    window.__linggan.dot=dot;runtime.actorReady=true;advanceScrollProgress(.14,'正在准备空间');
  })();return actorJob;
}
async function prepareStage(){
  if(stageJob)return stageJob;stageJob=(async()=>{
    await Promise.all([prepareActor(),media.open()]);await yieldTask();
    await dot.prepareStage();dot.preparePerformance(CONFIG.stage.performanceDuration);
    window.__linggan.dot=dot;dot.source.renderer.domElement.style.visibility='hidden';
    await dot.source.seek(0);dot.update({time:0,dt:0,mode:'stage',stageTime:0,pixelRatio:renderer.getPixelRatio()});
    (runtime.prepTrace??=[]).push({label:'stage-shader-start',at:performance.now()});
    const mask=dot.stageCamera.layers.mask;for(const layer of [0,2]){dot.stageCamera.layers.set(layer);await warmScene(dot.source.renderer,dot.stageGroup,dot.stageCamera);await yieldTask();}dot.stageCamera.layers.mask=mask;
    runtime.prepTrace.push({label:'stage-draw-start',at:performance.now()});
    for(const at of [0,3,9,15.7]){dot.update({time:0,dt:0,mode:'stage',stageTime:at,pixelRatio:.25});dot.renderStage();await yieldTask();}
    dot.update({time:0,dt:0,mode:'stage',stageTime:0,pixelRatio:renderer.getPixelRatio()});await dot.source.seek(0);dot.renderStage();dot.source.hide();dot.source.renderer.domElement.style.visibility='';
    runtime.prepTrace.push({label:'stage-draw-end',at:performance.now()});runtime.stageReady=true;runtime.stageReadyAt=performance.now();screenReady=Promise.resolve();
  })();return stageJob;
}
async function prepareScroll(){
  if(scrollJob)return scrollJob;scrollJob=(async()=>{
    await prepareActor();await fontsReady;advanceScrollProgress(.16,'正在准备卷轴');
    const [{createGames},{createScrollSpace}]=await Promise.all([import('./games.mjs'),import('./scroll-space.mjs')]);await loadType();advanceScrollProgress(.20,'正在准备卷轴');await yieldTask();
    space=await createScrollSpace({scene,camera,onFocus:v=>{ui.focusLock=v;if(v){ui.target=ui.scroll;ui.scrollVelocity=0;}},onSound:(t,options)=>sound.play(t,options)});
    advanceScrollProgress(.30,'内容正在就位');await yieldTask();games=await createGames({scene,camera,renderer,canvas,chapterPositions:CONFIG.chapters,onFeedback:event=>{if(event.type==='level-success')sound.levelWin(event.chapter);else if(!['info','warning','complete'].includes(event.type))sound.play(event.type,event);if(event.text)setBubble(event.text,event.type==='complete'?7:4);},onProgress:()=>updateCompletion(),onInteractionLock:locked=>{ui.gameLock=locked;if(locked){ui.target=ui.scroll;ui.scrollVelocity=0;}},onGuide:guide=>{if(guide.text)setBubble(guide.text,7);const target=guide.target?.isVector3?guide.target:guide.target?.getWorldPosition?.(vec());if(target)dot?.setAttention(target);}});
    // Await actual model/texture decode, not just the creation of their loaders.
    advanceScrollProgress(.42,'内容正在就位');
    const images=[...document.querySelectorAll('.process-card img')],assets=[...games.loads,...images.map(img=>img.decode())];let finishedAssets=0;
    await Promise.all(assets.map(job=>Promise.resolve(job).then(()=>advanceScrollProgress(.42+(++finishedAssets/Math.max(1,assets.length))*.21,'内容正在就位'))));
    if(games.snapshot().products.models.some(model=>!model.loaded)||images.some(img=>!img.naturalWidth))throw Error('部分卷轴内容尚未载入，请重新加载。');
    Object.assign(window.__linggan,{games,space,dotForeground});
    const warmCamera=camera.clone();warmCamera.position.set(innerWidth<700?2.04:1.2,innerWidth<700?28.9:17,innerWidth<700?40.8:24);warmCamera.lookAt(0,0,-3);warmCamera.updateMatrixWorld();
    // Use the exact production light lists and draw passes. A combined layer
    // compile would create different shader variants and defer work until entry.
    camera.copy(warmCamera,false);camera.layers.set(0);dot.update({time:0,dt:0,mode:'scroll',companionTarget:vec(8.7,2.7,4)});
    runtime.prepTrace.push({label:'scroll-shader-start',at:performance.now()});await warmScene(renderer,scene,camera,{onProgress:p=>advanceScrollProgress(.64+p*.25,'正在展开画面')});await yieldTask();
    runtime.prepTrace.push({label:'scroll-draw-start',at:performance.now()});const oldTarget=renderer.getRenderTarget(),warmTarget=new T.WebGLRenderTarget(8,8);
    for(const [index,z] of [0,34,68,102,136,174].entries()){space.update({scroll:z,time:0,dt:0});camera.position.z=24-z;camera.lookAt(0,0,-3-z);camera.updateMatrixWorld();try{renderer.setRenderTarget(warmTarget);renderer.render(scene,camera);}finally{renderer.setRenderTarget(oldTarget);}advanceScrollProgress(.89+(index+1)/6*.06,'正在展开画面');await yieldTask();}
    warmTarget.dispose();camera.copy(warmCamera,false);space.update({scroll:0,time:0,dt:0});
    const foregroundMask=camera.layers.mask;camera.layers.set(30);await warmScene(dotForeground.renderer,scene,camera,{onProgress:p=>advanceScrollProgress(.95+p*.04,'正在展开画面')});camera.layers.mask=foregroundMask;
    dotForeground.canvas.style.visibility='hidden';dotForeground.setActive(true);dotForeground.render();dotForeground.setActive(false);dotForeground.canvas.style.visibility='';
    dot.update({mode:'hidden'});runtime.prepTrace.push({label:'scroll-draw-end',at:performance.now()});runtime.scrollReady=true;runtime.scrollReadyAt=performance.now();advanceScrollProgress(1,'准备就绪');bgm.prepare().catch(()=>{});
  })().catch(error=>{runtime.scrollError=error.message;throw error;});return scrollJob;
}
function prepareWorld(){
  if(worldJob)return worldJob;worldJob=(async()=>{
    // A return visit may already be assembling the scroll. Complete that work
    // before the cinema re-parents the shared character.
    if(scrollJob)await scrollJob;
    await prepareStage();await prepareScroll();await screenReady;
    runtime.ready=true;runtime.worldReadyAt=performance.now();resolveWorld();
  })().catch(error=>{rejectWorld(error);throw error;});worldJob.catch(()=>{});return worldJob;
}
function placeReturnButton(){
  const button=$('return-scroll');if(button.hidden)return;const rect=$('hold').getBoundingClientRect();if(!rect.height)return;
  button.style.width=Math.min(rect.width,innerWidth-40)+'px';button.style.top=Math.min(rect.bottom+12,innerHeight-74)+'px';
}
let lastReturnPercent=-1;
function advanceScrollProgress(value,label){
  if(runtime.scrollError)return;
  runtime.scrollProgress=Math.max(runtime.scrollProgress,Math.min(1,value));runtime.scrollLabel=label;
  const percent=Math.floor(runtime.scrollProgress*100);$('return-progress-fill').style.transform='scaleX('+runtime.scrollProgress+')';
  if(percent!==lastReturnPercent){$('return-progress-value').textContent=percent+'%';$('return-progress-fill').parentElement.setAttribute('aria-valuenow',String(percent));lastReturnPercent=percent;}
  $('return-progress-label').textContent=label;
}
function cancelReturnEntry(){
  returnGeneration++;returnBusy=false;returnHold.reset();sound.updateHold(0,false);document.body.classList.remove('return-entering');
  $('return-entry').classList.remove('visible','leaving');$('return-entry').setAttribute('aria-hidden','true');$('return-loading').classList.remove('visible');$('return-scroll').disabled=false;setPhase('intro');
}
async function enterScrollDirect(){
  if(returnBusy||!returnVisit.eligible)return;const generation=++returnGeneration;returnBusy=true;ui.held=false;ui.hold=0;sound.updateHold(0,false);sound.play('charge',{intensity:.6});
  $('return-scroll').disabled=true;$('return-loading-title').textContent='正在展开创作卷轴';$('return-loading').querySelector('.return-note').textContent='准备就绪后，将自动进入。';$('return-reload').hidden=true;$('return-loading').classList.remove('visible');
  $('return-entry').classList.remove('leaving');$('return-entry').classList.add('visible');$('return-entry').setAttribute('aria-hidden','false');setPhase('return-wait');
  const shownAt=performance.now(),timer=setTimeout(()=>{if(generation===returnGeneration&&!runtime.scrollReady)$('return-loading').classList.add('visible');},300);
  try{
    await prepareScroll();if(generation!==returnGeneration)return;clearTimeout(timer);
    await delay(Math.max(0,190-(performance.now()-shownAt)));if(generation!==returnGeneration)return;
    document.body.classList.add('return-entering');setPhase('scroll');
    // Settle the real CSS3D layers and GPU passes beneath the opaque cover.
    await nextPaint();await nextPaint();await nextPaint();if(generation!==returnGeneration)return;
    $('return-entry').classList.remove('visible');$('return-entry').classList.add('leaving');sound.play('open',{intensity:.45});
    await delay(matchMedia('(prefers-reduced-motion: reduce)').matches?160:620);if(generation!==returnGeneration)return;
    $('return-entry').classList.remove('leaving');$('return-entry').setAttribute('aria-hidden','true');$('return-loading').classList.remove('visible');document.body.classList.remove('return-entering');returnBusy=false;returnHold.reset();$('return-scroll').disabled=false;
  }catch(error){if(generation===returnGeneration){$('return-loading').classList.add('visible');$('return-loading-title').textContent='内容暂时未能载入';$('return-progress-label').textContent='请重新加载后继续';$('return-loading').querySelector('.return-note').textContent='重新加载后，可继续进入卷轴。';$('return-reload').hidden=false;}}
  finally{clearTimeout(timer);}
}
const returnButton=$('return-scroll');
function startReturnHold(){if(ui.phase!=='intro'||returnBusy||!returnVisit.eligible)return;ui.held=false;ui.hold=0;returnHold.press(performance.now());sound.unlock();prepareScroll().catch(()=>{});}
returnButton.addEventListener('pointerdown',e=>{if(ui.phase!=='intro')return;e.preventDefault();returnButton.setPointerCapture(e.pointerId);startReturnHold();});
for(const type of ['pointerup','pointercancel'])returnButton.addEventListener(type,()=>returnHold.release());
returnButton.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();startReturnHold();}});
returnButton.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();returnHold.release();}});
$('return-cancel').addEventListener('click',cancelReturnEntry);$('return-reload').addEventListener('click',()=>location.reload());
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.phase==='return-wait'){e.preventDefault();cancelReturnEntry();}});
window.addEventListener('blur',()=>returnHold.cancel());document.addEventListener('visibilitychange',()=>{if(document.hidden)returnHold.cancel();});
for(const type of ['pointerdown','keydown'])$('hold').addEventListener(type,()=>returnHold.cancel(),{capture:true});

function beginListening(){
  const generation=++listenGeneration;listeningGate.reset();setPhase('listen');ui.listenStartedAt=performance.now();ui.listenFinishedAt=null;$('listening-status').textContent='正在准备影片';sound.play('headphones');
  media.prime().catch(()=>{});Promise.all([media.preparePlayback(0),quality.snapshot().constrained?prepareWorld():Promise.resolve()]).then(()=>{if(generation!==listenGeneration)return;listeningGate.ready=true;$('listening-status').textContent='准备就绪，即将开始';}).catch(error=>{if(generation===listenGeneration&&ui.phase==='listen'){toast(error.message);setPhase('chat');}});
}
const listeningRange=$('listening-volume');
listeningRange.addEventListener('pointerdown',()=>listeningGate.adjusting=true);
listeningRange.addEventListener('input',()=>listeningGate.adjusted());
for(const type of ['pointerup','pointercancel'])window.addEventListener(type,()=>{if(listeningGate.adjusting){listeningGate.adjusting=false;listeningGate.adjusted();}});
listeningRange.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))listeningGate.adjusting=true;});
listeningRange.addEventListener('keyup',()=>{listeningGate.adjusting=false;listeningGate.adjusted();});
async function startFilm(at=0){
  if(filmStarting)return;filmStarting=true;let shown=false;const timer=setTimeout(()=>{shown=true;buffering(true);},300);
  try{media.prime().catch(()=>{});await media.preparePlayback(at);if(at>0)await prepareWorld();transport.started=true;await transport.start(at);}
  catch(error){toast(error.message);setPhase('chat');}
  finally{clearTimeout(timer);if(shown)buffering(false);filmStarting=false;}
}
function resize(){if(!renderer)return;quality.resize(innerWidth,innerHeight);css.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?48:42;camera.updateProjectionMatrix();opening?.resize(innerWidth,innerHeight);placeReturnButton();const code=$('code');code.width=Math.round(innerWidth*Math.min(devicePixelRatio,2));code.height=Math.round(innerHeight*Math.min(devicePixelRatio,2));}
window.addEventListener('resize',resize);
const codeCtx=$('code').getContext('2d');
const sourceLines=['const idea = observe({ subject, frame, light });','await create.space({ depth: true, continuity: 1 });','timeline.connect(reference, intention, result);','for (const part of thought) {','  geometry.extrude(part.outline, { precision: 0.001 });','  motion.follow(curve, ease.inOut);','  material.respond(light, atmosphere);','}','await render({ camera, scene, sound });','frame.read();  // 让每一个选择，都能被看见','return experience({ watch, interact, continue });'];
function drawCode(age){const ctx=codeCtx,w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#05090f';ctx.fillRect(0,0,w,h);const ratio=w/1200;for(let layer=0;layer<3;layer++){const fade=1-smooth((age-(2.65-layer*.15))/1.55);ctx.save();ctx.translate(w*(.06+layer*.32),h*(.10+layer*.12));const font=(13+layer*3)*ratio;ctx.font=`${font}px monospace`;for(let row=0;row<20;row++){const y=(row*font*1.65-(age*25*ratio)%(font*1.65));const line=sourceLines[(row+layer*3+Math.floor(age*1.7))%sourceLines.length];const chars=Math.floor(clamp((age-row*.045)*.7)*line.length);ctx.fillStyle=`rgba(${layer===2?'178,210,240':'88,143,183'},${fade*(.28+layer*.17)})`;ctx.fillText(String(row+1).padStart(2,'0')+'  '+line.slice(0,chars),0,y);if(row===Math.floor(age*3)%18){ctx.fillStyle=`rgba(206,238,207,${fade*.9})`;ctx.fillRect((chars+4)*font*.6,y-font*.8,font*.55,font);}}ctx.restore();}const f=1-smooth((age-3.1)/1.25);ctx.fillStyle=`rgba(186,213,239,${f*.7})`;ctx.font=`${11*ratio}px monospace`;ctx.fillText('IDEA → STRUCTURE → MOTION → EXPERIENCE',w*.055,h*.9);ctx.fillRect(w*.055,h*.93,w*.87*clamp(age/4.4),1*ratio);}
function portalLayout(age){if(['film','stage','transition'].includes(ui.phase)){Object.assign(portal.style,{width:'100vw',height:'100dvh',left:'0',top:'0',transform:'none'});return;}portal.style.left=portal.style.top='50%';portal.style.transform='translate(-50%,-50%)';const targetW=innerWidth,initialW=Math.min(innerWidth*(innerWidth<700?.92:.86),960),initialH=innerWidth<700?390:430;let p=ui.phase==='launch'?smooth(age/1.05):['film','black','transition'].includes(ui.phase)?1:0;const w=T.MathUtils.lerp(initialW,targetW,p),h=T.MathUtils.lerp(initialH,innerHeight,p);portal.style.width=w+'px';portal.style.height=h+'px';if(ui.phase==='morph')portal.style.opacity='1';if(ui.phase==='launch'){const fade=1-smooth((age-2.65)/1.7);portal.style.opacity=String(fade);$('portal-frame').style.opacity=String(fade);portal.style.transform=`translate(-50%,-50%) perspective(1200px) rotateY(${(1-p)*-2}deg)`;}}
function timeText(t){if(!Number.isFinite(t))return'00:00';return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;}
const normalPos=vec(),normalLook=vec(),look=vec(),companion=vec(),companionView=vec(),stageStart=vec(0,4.3,-9.5),stageEnd=vec(0,6,9),stageLook=vec(0,3.6,-14),departureStart=vec(),departureLook=vec();
function fitCompanionTarget(){
  // Zoomed game cameras must not push the companion below the viewport. Clamp
  // its destination; the existing spring still owns the continuous movement.
  companionView.copy(companion).applyMatrix4(camera.matrixWorldInverse);
  companionView.z=Math.min(companionView.z,-(innerWidth<700?20:16));
  companion.copy(companionView.applyMatrix4(camera.matrixWorld));
  companionView.copy(companion).project(camera);
  companionView.x=clamp(companionView.x,-.76,.76);
  companionView.y=innerWidth<700&&ui.phase==='scroll'&&!ui.focusLock?-.43:clamp(companionView.y,-.52,.64);
  companion.copy(companionView.unproject(camera));
}
let lastPhase='loading',lastChapter=-1,renderedFrames=0,departureFov=42;
function frame(now){const current=now/1000,rawDt=current-previous,dt=Math.min(.05,Math.max(.001,rawDt));previous=current;time=current-startedAt;ui.frameTimes.push(rawDt*1000);if(ui.frameTimes.length>600)ui.frameTimes.shift();const age=time-ui.phaseAt;
  // Native scrolling owns the settled article. Leave its background frame alone:
  // no CSS3D transforms, typography writes, shadow/foreground passes or games.
  if(ui.phase==='scroll'&&space?.readingStable&&!$('settings').open){requestAnimationFrame(frame);return;}
  if(ui.phase==='intro'&&returnHold.update(now))enterScrollDirect();
  $('return-scroll').style.setProperty('--return-hold',returnHold.progress);
  sound.updateHold(returnHold.held?returnHold.progress:ui.hold,ui.phase==='intro'&&(ui.held||returnHold.held));
  if(ui.phase==='intro'){ui.hold=ui.held?clamp(current-ui.holdStart):clamp(ui.hold-dt*1.65);$('hold').style.setProperty('--hold',ui.hold);if(ui.hold>=1&&opening.prepared){sound.unlock();ui.held=false;setPhase('morph');}}
  else if(ui.phase==='morph'&&age>=OPENING_TIMING.morph&&opening.ready)setPhase('chat');
  else if(ui.phase==='launch'&&age>=4.35)beginListening();
  else if(ui.phase==='listen'){const state=listeningGate.update(dt,{paused:document.hidden||$('settings').open});if(!state.ready){const m=media.snapshot();$('listening-status').textContent=m.complete?'正在准备舞台与卷轴':'影片正在载入 '+Math.floor(m.progress*100)+'%';}
    $('listening-fill').style.transform='scaleX('+state.progress+')';$('listening-fill').parentElement.setAttribute('aria-valuenow',String(Math.round(state.progress*100)));if(state.done){ui.listenFinishedAt=performance.now();setPhase('black');requestAnimationFrame(()=>setTimeout(()=>prepareWorld().catch(()=>{}),0));}}
  else if(ui.phase==='black'&&performance.now()-ui.blackAt>=750){setPhase('film-wait');startFilm();}
  if(['film','stage','transition'].includes(ui.phase))transport.update(dt);
  chatPresentation.update(ui.phase,time-ui.phaseAt);cinemaControls.update();
  const introRender=['intro','morph','chat','launch','black','film-wait'].includes(ui.phase);
  dotForeground?.setActive(ui.phase==='scroll'||ui.phase==='departure');
  if(introRender){portalLayout(time-ui.phaseAt);const state=opening.update({time,dt,phase:ui.phase==='film-wait'?'black':ui.phase,phaseTime:time-ui.phaseAt,holdProgress:ui.hold});if(ui.phase==='morph')sound.particleMotion(state);if(ui.phase==='launch')sound.codeTick(age);renderer.render(opening.scene,opening.camera);css.domElement.style.visibility='hidden';if(ui.phase==='launch')drawCode(age);portalLayout(time-ui.phaseAt);}
  else if(ui.phase==='film'){portalLayout(age);css.domElement.style.visibility='hidden';}
  else if(['stage','transition','departure','scroll'].includes(ui.phase)){
    css.domElement.style.visibility='visible';
    if(ui.phase==='scroll'&&!ui.gameLock&&!ui.focusLock){const maxSpeed=innerWidth<700?28:44;const desired=clamp((ui.target-ui.scroll)*4.8,-maxSpeed,maxSpeed);ui.scrollVelocity=damp(ui.scrollVelocity,desired,20,dt);ui.scroll=clamp(ui.scroll+ui.scrollVelocity*dt,0,CONFIG.scroll.max);if(Math.abs(ui.target-ui.scroll)<.0001&&Math.abs(ui.scrollVelocity)<.001){ui.scroll=ui.target;ui.scrollVelocity=0;}}
    const scale=innerWidth<700?1.7:1;normalPos.set(1.2*scale,17*scale,24*scale-ui.scroll);normalLook.set(0,0,-3-ui.scroll);
    if(ui.phase==='stage'||ui.phase==='transition'){
      if(space)space.root.visible=false;for(const r of games?.roots||[])r.visible=false;
      dot.update({time,mode:'stage',stageTime:transport.visualStageTime,dt,pixelRatio:renderer.getPixelRatio()});sound.stageMotion(transport.visualStageTime,transport.playing);
      camera.copy(dot.stageCamera,false);camera.layers.set(0);look.copy(camera.position).add(camera.getWorldDirection(vec()).multiplyScalar(10));
      const greeting=transport.visualStageTime>=CONFIG.stage.performanceDuration+.55;display('stage-caption',ui.phase==='stage'&&!greeting);
      if(greeting&&!ui.stageGreeting){ui.stageGreeting=true;setBubble('你好呀~我叫Dot',4);}if(!greeting)ui.stageGreeting=false;
      const greetingAt=project(dot.actorWorldPos.clone().add(vec(0,1.2,0)),camera);$('dot-bubble').style.left=clamp(greetingAt.x+45,25,innerWidth-260)+'px';$('dot-bubble').style.top=clamp(greetingAt.y-80,100,innerHeight-200)+'px';display('dot-bubble',greeting&&greetingAt.visible);
      const reveal=transport.revealProgress;portalLayout(age);portal.style.display=reveal<1?'block':'none';film.style.display='block';portal.style.opacity=String(1-smooth(reveal));
      $('handoff-white').style.opacity='0';css.domElement.style.visibility='hidden';
    }else if(ui.phase==='departure'){
      if(lastPhase!=='departure'){departureStart.copy(camera.position);departureLook.copy(look);departureFov=camera.fov;}
      const p=clamp((time-ui.phaseAt)/CONFIG.stage.departure),e=smooth(p);camera.fov=T.MathUtils.lerp(departureFov,innerWidth<700?48:42,e);camera.updateProjectionMatrix();camera.position.lerpVectors(departureStart,normalPos,e);camera.position.x+=Math.sin(p*Math.PI)*.7;look.lerpVectors(departureLook,normalLook,e);camera.lookAt(look);camera.updateMatrixWorld();companion.set(8.5,2.7,5);fitCompanionTarget();space.update({scroll:0,time,dt,unfold:smooth((p-.08)/.9)});for(const r of games.roots)r.visible=p>.65;dot.update({time,mode:'departure',stageTime:transport.stageDuration,performanceDuration:CONFIG.stage.performanceDuration,departureProgress:p,companionTarget:companion,dt});if(p>=1)setPhase('scroll');
    }else{
      const chapter=Math.min(5,Math.max(0,Math.floor((ui.scroll+11)/34)));ui.chapter=chapter;const gameIndex=CONFIG.chapters.findIndex(p=>Math.abs(-p.z-ui.scroll)<7.5);if(gameIndex!==ui.game&&!ui.gameLock){ui.game=gameIndex;games.setActiveChapter(gameIndex);if(gameIndex>=0){setBubble(['转动方块，让一面清楚地停在眼前。','把六个步骤，排成一次完整的创作。','先看需求，再把合适的工具连过去。','直接点模型上不合理的地方。','三项交付就位，最后再盖章。'][gameIndex],7);}}
      if(gameIndex>=0){const gp=CONFIG.chapters[gameIndex],narrow=innerWidth<700,gameScale=narrow?1.2:scale,blend=(narrow?.95:.72)*smooth(1-clamp((Math.abs(-gp.z-ui.scroll)-2.5)/5.5));normalPos.lerp(vec((narrow?0:2.5)*gameScale,12*gameScale,gp.z+15*gameScale),blend);normalLook.lerp(vec(0,0,gp.z),blend);}
      if(ui.scroll>178){const end=smooth((ui.scroll-178)/12);normalPos.lerp(innerWidth<700?vec(0,35,-141):vec(8,24,-147),end);normalLook.lerp(vec(0,0,-179),end);}
      scrollPointer.dx=damp(scrollPointer.dx,scrollPointer.x,4,dt);scrollPointer.dy=damp(scrollPointer.dy,scrollPointer.y,4,dt);
      const parallax=innerWidth<700?0:1;normalPos.x+=scrollPointer.dx*.8*parallax;normalPos.y+=scrollPointer.dy*.5*parallax;normalLook.x+=scrollPointer.dx*.12*parallax;normalLook.y+=scrollPointer.dy*.08*parallax;
      space.update({scroll:ui.scroll,time,dt});const cf=space.cameraFocus();if(cf){camera.position.lerpVectors(normalPos,cf.position,cf.mix);look.lerpVectors(normalLook,cf.target,cf.mix);}else{camera.position.copy(normalPos);look.copy(normalLook);}
      camera.lookAt(look);camera.updateMatrixWorld();const side=(chapter===2||chapter===4)?-1:1;companion.set(side*(innerWidth<700?5:8.7),innerWidth<700?3.8:2.7,chapter===5?Math.max(-ui.scroll+4,-176):-ui.scroll+4);fitCompanionTarget();dot.update({time,mode:'scroll',stageTime:transport.stageDuration,performanceDuration:CONFIG.stage.performanceDuration,companionTarget:companion,dt});
      for(let i=0;i<games.roots.length;i++)games.roots[i].visible=Math.abs(CONFIG.chapters[i].z+ui.scroll)<45;
      if(chapter!==lastChapter){lastChapter=chapter;if(chapter===5){dot.setAttention(null);setBubble('这次创作已经展开。下一次，换你的想法先行。',7);}document.querySelectorAll('#chapters button').forEach((b,i)=>b.classList.toggle('active',i===chapter));$('chapter-kicker').textContent=CHAPTERS[chapter]?.kicker||'06 / 留给下一次创作';$('chapter-title').textContent=CHAPTERS[chapter]?.title||'资源档案';$('chapter-description').textContent=CHAPTERS[chapter]?.description||'方法、工具与工程，都可以继续生长。';}
      display('scroll-cue',ui.scroll<1.2&&!ui.focusLock);display('chapter-caption',ui.scroll>1.2&&gameIndex<0&&!ui.focusLock&&chapter<5);display('game-controls',gameIndex>=0&&!ui.focusLock,'flex');$('game-instruction').textContent=gameIndex<0?'':['拖动旋转 · 清楚停留后自动收词','把步骤板拖入六个顺序槽','拖动工具，连接适合的用途','点击模型的问题区域','先安放三项成果，再拖动印章'][gameIndex];$('position-label').textContent=String(chapter+1).padStart(2,'0')+' / 06';$('scroll-progress').firstElementChild.style.width=(ui.scroll/CONFIG.scroll.max*100)+'%';
      const body=dot.actorWorldPos.clone().add(vec(0,1.2,0));const screen=project(body,camera);const narrow=innerWidth<700;const bx=narrow?clamp(screen.x-115,55,innerWidth-205):clamp(screen.x-90,35,innerWidth-255),by=narrow?Math.max(90,innerHeight*.105):clamp(screen.y-85,90,innerHeight-180);ui.bubbleX=damp(ui.bubbleX,bx,8,dt);ui.bubbleY=damp(ui.bubbleY,by,8,dt);$('dot-bubble').style.left=ui.bubbleX+'px';$('dot-bubble').style.top=ui.bubbleY+'px';display('dot-bubble',screen.visible&&time<ui.bubbleUntil&&!ui.focusLock);
    }
    if(ui.phase==='stage'||ui.phase==='transition'){renderer.setClearColor('#000000',1);renderer.clear();dot.renderStage();}else{camera.lookAt(look);camera.updateMatrixWorld();key.position.set(-6,18,12-ui.scroll);keyTarget.position.set(0,0,-ui.scroll-3);quality.stabilizeShadow({phase:ui.phase});games.update(dt,time);dot.beforeRender(renderer);dotForeground.renderWorld(()=>renderer.render(scene,camera));css.render(scene,camera);space.syncReading();dotForeground.render();}
  }
  bubbleEmphasis.update($('dot-bubble').style.display!=='none');
  if(['film','transition','stage'].includes(ui.phase)){seekControl.update();$('timecode').textContent=`${timeText(transport.currentTime)} / ${timeText(transport.duration)}`;$('play-pause').textContent=transport.playing?'Ⅱ':'▶';$('play-pause').setAttribute('aria-label',transport.playing?'暂停影片':'继续播放');$('transport-label').textContent=ui.phase==='transition'?'进入创作':ui.phase==='stage'?'Dot 舞台':'影片';}
  quality.sampleFrame({dt:rawDt,time:current,phase:ui.phase});lastPhase=ui.phase;renderedFrames++;requestAnimationFrame(frame);
}
const hold=$('hold');hold.addEventListener('pointermove',e=>{const r=hold.getBoundingClientRect();hold.style.setProperty('--mx',(e.clientX-r.x)/r.width);hold.style.setProperty('--my',(e.clientY-r.y)/r.height);});hold.addEventListener('pointerleave',()=>{hold.style.setProperty('--mx','.5');hold.style.setProperty('--my','.5');});hold.addEventListener('pointerdown',e=>{if(ui.phase!=='intro')return;e.preventDefault();hold.setPointerCapture(e.pointerId);if(!ui.held)ui.holdStart=performance.now()/1000;ui.held=true;sound.unlock();media.prime().catch(error=>toast(error.message));});hold.addEventListener('pointerup',()=>ui.held=false);hold.addEventListener('pointercancel',()=>ui.held=false);hold.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&ui.phase==='intro'){e.preventDefault();if(!ui.held)ui.holdStart=performance.now()/1000;ui.held=true;sound.unlock();media.prime().catch(error=>toast(error.message));}});hold.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();ui.held=false;}});window.addEventListener('blur',()=>ui.held=false);
$('send').addEventListener('click',()=>{if(ui.phase!=='chat')return;sound.unlock();media.prime().catch(()=>{});media.ensure(0,2).then(()=>transport.unlock()).catch(()=>{});setPhase('launch');});
$('sound').addEventListener('click',()=>{sound.unlock();ui.muted=activateSoundOnly?false:!ui.muted;activateSoundOnly=false;transport.setMuted(ui.muted);sound.setMuted(ui.muted);bgm.setMasterMuted(ui.muted);updateSoundButton();});
$('play-pause').addEventListener('click',()=>{sound.unlock();transport.toggle();});$('skip-film').addEventListener('click',()=>{sound.unlock();readyAction(()=>transport.skipFilm(),$('skip-film'));});
function scrollInput(delta){if(ui.phase!=='scroll'||returnBusy||ui.gameLock||ui.focusLock||$('settings').open)return;ui.target=clamp(ui.target+delta,0,CONFIG.scroll.max);}
window.addEventListener('wheel',e=>{if(e.target.closest('.card-detail,dialog'))return;e.preventDefault();scrollInput(e.deltaY*(e.deltaMode===1?15:1)*CONFIG.scroll.speed);},{passive:false});
let touch=null,downPoint=null;window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!dot?.hitTest(e.clientX,e.clientY)&&!e.target.closest('button,input,dialog,.card-detail'))touch={id:e.pointerId,y:e.clientY};},true);window.addEventListener('pointermove',e=>{if(touch&&e.pointerId===touch.id){scrollInput((e.clientY-touch.y)*.045);touch.y=e.clientY;}});window.addEventListener('pointerup',()=>touch=null,true);window.addEventListener('pointercancel',()=>touch=null,true);canvas.addEventListener('pointerdown',e=>{downPoint={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',e=>{if(!downPoint||Math.hypot(e.clientX-downPoint.x,e.clientY-downPoint.y)>5||ui.phase!=='scroll'||ui.gameLock)return;if(ui.chapter===5&&space.pointerHit(e))return;const p=project(dot.actorWorldPos,camera);if(Math.hypot(p.x-e.clientX,p.y-e.clientY)<55){if(ui.game>=0)games.help();else setBubble('沿着长卷走一走。想看细节，就点开一张过程卡片。',6);}else if(ui.chapter!==5)space.pointerHit(e);});
window.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||$('settings').open)return;if(ui.phase==='scroll'&&!returnBusy){if(e.key==='ArrowDown'||e.key==='PageDown'){e.preventDefault();scrollInput(e.key==='PageDown'?9:2);}if(e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();scrollInput(e.key==='PageUp'?-9:-2);}if(e.key==='Home'){e.preventDefault();ui.target=0;}if(e.key==='End'){e.preventDefault();ui.target=CONFIG.scroll.max;}}else if(e.key===' '&&['film','transition','stage'].includes(ui.phase)){e.preventDefault();transport.toggle();}});
document.querySelectorAll('#chapters button').forEach((b,i)=>b.addEventListener('click',()=>{if(ui.gameLock||ui.focusLock)return;ui.target=i===5?174:i*34;}));$('game-help').addEventListener('click',()=>games.help());$('dot-bubble').addEventListener('click',()=>{if(ui.game>=0)games.help();else setBubble('点击卡片可以立起阅读，点空白就回到长卷。',5);});$('game-reset').addEventListener('click',()=>games.reset(ui.game));
$('settings-button').addEventListener('click',()=>{$('settings').showModal();});
$('preview-scroll').addEventListener('click',()=>readyAction(()=>{$('settings').close();transport.pause();setPhase('scroll');},$('preview-scroll')));
$('preview-stage').addEventListener('click',async()=>{sound.unlock();const button=$('preview-stage');button.disabled=true;const label=button.textContent;button.textContent='正在准备…';try{media.prime().catch(()=>{});await Promise.all([prepareWorld(),media.ensure(CONFIG.film.stageAt,3)]);$('settings').close();transport.playing=true;transport.enterStage(0);}catch(e){toast(e.message);}finally{button.disabled=false;button.textContent=label;}});
function applyCue(value){const max=Math.max(0,(film.duration||Infinity)-media.timeOffset-.1),cue=Math.min(max,Math.max(0,Number(value)||0));CONFIG.film.stageAt=CONFIG.stage.origin=cue;$('film-cue').value=cue.toFixed(3);if(globalThis.DOT_STAGE_OPENING_SOURCE)globalThis.DOT_STAGE_OPENING_SOURCE.inPoint=cue;transport.record('cue-updated',{cue});return cue;}
$('film-cue').addEventListener('change',e=>{cueEdited=true;applyCue(e.target.value);});
$('cue-current').addEventListener('click',()=>{cueEdited=true;applyCue(transport.currentTime);});
$('preview-seam').addEventListener('click',async()=>{const b=$('preview-seam');b.disabled=true;try{const at=Math.max(0,CONFIG.film.stageAt-1);media.prime().catch(()=>{});await Promise.all([prepareWorld(),media.ensure(at,4)]);$('settings').close();await startFilm(at);}catch(e){toast(e.message);}finally{b.disabled=false;}});
$('film-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;transport.pause();transport.pendingSeek=null;transport.scrub=null;$('film-status').textContent='正在准备替换影片…';try{const info=await media.useLocal(file);CONFIG.film.label='本机替换影片';applyCue(CONFIG.film.stageAt);transport.absolute=0;transport.presentedTime=NaN;transport.phase='film';transport.started=false;$('film-status').textContent=`${file.name} · ${info.width}×${info.height} · ${info.duration.toFixed(3)} 秒 · 同源大屏`;$('film-cue').closest('details').open=true;toast('替换完成。大屏已共用这份影片，可调整接点后预览。');}catch(error){toast(error.message);}});
$('quality').addEventListener('change',e=>{const q=e.target.value;quality.setMode(q);dot?.setReflectionEnabled(q!=='low');resize();});
function restart(){transport.pause();space?.close();ui.hold=0;ui.held=false;setPhase('intro');}
$('back-start').addEventListener('click',restart);document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();restart();});$('replay').addEventListener('click',()=>{transport.pause();space?.close();beginListening();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){listeningGate.adjusting=false;listeningGate.adjusted();ui.held=false;sound.updateHold(0,false);sound.stopParticles();if(transport.playing)transport.pause();}});

let dotPress=null;
window.addEventListener('pointermove',e=>{if(ui.phase!=='scroll')return;dot.pointer(e.clientX,e.clientY);dot.hover(dot.hitTest(e.clientX,e.clientY));},true);
window.addEventListener('pointerdown',e=>{if(ui.phase!=='scroll'||$('settings').open||!dot.hitTest(e.clientX,e.clientY))return;dotPress={id:e.pointerId,x:e.clientX,y:e.clientY};e.preventDefault();e.stopImmediatePropagation();},true);
window.addEventListener('pointerup',e=>{if(!dotPress||e.pointerId!==dotPress.id)return;const click=Math.hypot(e.clientX-dotPress.x,e.clientY-dotPress.y)<9;dotPress=null;e.preventDefault();e.stopImmediatePropagation();if(click)dot.react('click');},true);
window.addEventListener('pointercancel',()=>dotPress=null,true);

init().catch(error=>{rejectWorld(error);ui.errors.push(String(error));$('loading-status').textContent='空间暂未就绪：'+error.message;console.error(error);});

