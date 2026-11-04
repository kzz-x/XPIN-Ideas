import {createRuntimeProbe} from './runtime-probe-r01.mjs';
import {applyRecoveryFraming} from './recovery-framing-r01.mjs';
import{createStageGameBridge}from'./stage-game-bridge-r07.mjs';import {createHornDissolve} from '../shared-dot-d02/effects/horn-dissolve-r05.mjs';import{createMassFollower}from'./mass-follow.mjs';import{createConcertRevision}from'./concert-revision-r05.mjs';import * as T from'../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';import{loadDot}from'./stage-character-d02-r01.mjs';import{applyRenderQuality}from'../v011/DotSharedWeb/render-quality.mjs';import{createBridgeStage}from'./stage-base.mjs';import{createUniverseStillProvider}from'../v013-stage-bridge/universe-provider.mjs';import{createProcessScreenMedia}from'./process-screen-r05.mjs';import{createStageFinale}from'./stage-design.mjs';import{createTunableDirector}from'./tunable-director.mjs';import{makeDefaults,createDocumentStore,SHOT,configureAudioDuration}from'./document.mjs';import{createAudioTransport}from'./transport.mjs';import{createWorkbenchUI}from'./ui.mjs';
const $=id=>document.getElementById(id),KEY='dot-stage-D02-accepted-integration-r01-independent';
let pageDisposed=false,pendingLoadRelease=null;addEventListener('pagehide',()=>{pageDisposed=true;pendingLoadRelease?.();pendingLoadRelease=null;},{once:true});
const data=globalThis.DOT_WORKBENCH_DATA??await fetch(new URL('./data.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('本地参数数据未找到');return r.json();});
if(pageDisposed)throw new DOMException('舞台已释放','AbortError');
const audioElement=$('audio');
if(audioElement.readyState<1)await new Promise((resolve,reject)=>{audioElement.addEventListener('loadedmetadata',resolve,{once:true});audioElement.addEventListener('error',()=>reject(Error('原音乐元数据未读取')),{once:true});});
if(pageDisposed)throw new DOMException('舞台已释放','AbortError');configureAudioDuration(audioElement.duration);
const defaults=makeDefaults(data.project),store=createDocumentStore(defaults);let savedMessage=null;
try{const saved=localStorage.getItem(KEY);if(saved){store.import(saved);savedMessage='已恢复此浏览器中的调节副本；原工程默认不变。';}}catch{savedMessage='本地记录不可用，已载入默认；可继续编辑并导出参数。';}
let preview=null,loading=null,raf=0,dirty=false,ui,resizeObserver,contextLost=false,initialRenderReady=false,intervals=[],profileFrames=[],lastFrame=null,lastInfo=0;
function requestFrame(){if(pageDisposed)return;dirty=true;if(preview&&!raf&&!document.hidden&&!contextLost)raf=requestAnimationFrame(frame);}
const transport=createAudioTransport($('audio'),{onTime(){ui?.draw();requestFrame();},onState(){window.DOT_STAGE_PERF?.setSuspended(!transport.playing);if(!transport.playing)window.DOT_STAGE_AUX_AUDIO?.pause();ui?.draw();lastFrame=null;intervals=[];if(transport.playing)requestFrame();}});
function persist(){try{localStorage.setItem(KEY,store.serialize(transport.time));}catch{ui.message('本地存储不可用，当前修改仍保留；请导出参数。',true);}}
function documentChanged(doc){transport.configure(doc.transport);preview?.configure(doc);persist();requestFrame();}
ui=createWorkbenchUI({store,transport,wave:data.wave,onChange:documentChanged,onNeedFrame:requestFrame,onLoadPreview:()=>loadPreview().catch(error=>ui.message('三维预览未完成：'+error.message,true))});transport.configure(store.document.transport);transport.seek(store.document.playhead);if(savedMessage)ui.message(savedMessage);
function frame(now){raf=0;if(document.hidden||contextLost||!preview||!initialRenderReady)return;if(transport.playing)transport.tick();if(!dirty&&!transport.playing)return;dirty=false;try{const state=preview.renderAt(transport.time);$('phase').textContent=({idle:'待气',inhale:'吸气',hold:'蓄力',exhale:'短吹',recover:'放松'})[state.pose.breathPhase]||'预览';if(transport.playing&&state.didRender&&lastFrame!==null){intervals.push(now-lastFrame);profileFrames.push({time:transport.time,dt:now-lastFrame});if(intervals.length>120)intervals.shift();}lastFrame=state.didRender?now:null;if(now-lastInfo>250){lastInfo=now;const fps=intervals.length>30?1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length):null;$('stats').textContent=transport.playing?`${fps?'逻辑提交约 '+fps.toFixed(1)+' fps · ':''}${preview.renderer.domElement.width} × ${preview.renderer.domElement.height}`:'已暂停 · 修改后单帧预览';}}catch(error){transport.pause();ui.message('三维预览已暂停：'+error.message,true);}if(transport.playing)requestFrame();}
async function loadPreview(){
 if(pageDisposed)throw new DOMException('舞台已释放','AbortError');if(loading)return loading;if(preview)return preview;
 $('loadPreview').disabled=true;$('loadRead').textContent='正在读取随包模型、纹理和着色器…';
 let partialPreview=null,loadReleased=false,previewDisposed=false;const acquired=[],frameWaiters=new Set();function assertAlive(){if(pageDisposed||loadReleased||previewDisposed)throw new DOMException('舞台已释放','AbortError');}function own(release){if(loadReleased||pageDisposed){release();throw new DOMException('舞台已释放','AbortError');}acquired.push(release);}function waitLoadFrame(){assertAlive();return new Promise((resolve,reject)=>{let id,done=false;const cancel=()=>{if(done)return;done=true;cancelAnimationFrame(id);frameWaiters.delete(cancel);reject(new DOMException('舞台已释放','AbortError'));};frameWaiters.add(cancel);id=requestAnimationFrame(()=>{if(done)return;done=true;frameWaiters.delete(cancel);try{assertAlive();resolve();}catch(e){reject(e);}});});}function releasePartial(){if(loadReleased)return;loadReleased=true;for(const cancel of[...frameWaiters])cancel();frameWaiters.clear();if(partialPreview){try{partialPreview.dispose();}catch{}}else for(const release of acquired.reverse()){try{release();}catch{}}acquired.length=0;}pendingLoadRelease=releasePartial;
 loading=(async()=>{
  const stageProbe=createRuntimeProbe('Dot stage',{maxSamples:3600,gpuEvery:8});own(()=>stageProbe.dispose());window.DOT_STAGE_PERF=stageProbe;stageProbe.setSuspended(true);
  const loadProfile={status:'loading',startedAt:performance.now(),events:[],scope:'Local browser JavaScript phase timings; first render submission does not measure GPU completion'};
  globalThis.DOT_LOAD_PROFILE=loadProfile;
  const markLoad=(phase,stageMs=null)=>{const event={phase,elapsedMs:performance.now()-loadProfile.startedAt,stageMs};loadProfile.events.push(event);stageProbe.mark(phase,event);};
  const dot=await loadDot({onStage:(phase,ms)=>markLoad(phase,ms)});own(()=>dot.dispose());
  const source=globalThis.DOT_WORKBENCH_UNIVERSE??new URL('./assets/universe-placeholder.png',import.meta.url),texture=await new T.TextureLoader().loadAsync(String(source));own(()=>texture.dispose());assertAlive();const universe=createUniverseStillProvider(texture,{useAuthorized:true,qualityApproved:false,sourceTimeOrigin:36,duration:SHOT.end,sourceId:'SH24-overview-v2-panel6-TEMP'});universe.displayReferred=true;markLoad('universe_texture_ready');
  const stage=createBridgeStage(dot,{layout:data.layout,universe});stage.hemi.intensity=.075;stage.fill.intensity=.60;stage.rim.intensity=4;for(const light of stage.scene.children){if(light.isDirectionalLight&&light!==stage.fill&&light!==stage.rim)light.intensity=.35;}own(()=>stage.dispose());markLoad('base_stage_ready');
  const finale=createStageFinale(stage,data.layout);own(()=>finale.dispose());markLoad('stage_architecture_ready');
  const concert=createConcertRevision(stage,dot,data.layout,finale);concert.root.traverse(o=>{if(o.isInstancedMesh)o.layers.set(2)});own(()=>concert.dispose());markLoad('celebration_geometry_ready');
  const media=await createProcessScreenMedia(stage,data.white,{onFrameReady:requestFrame,isPlaying:()=>transport.playing});own(()=>media.dispose());assertAlive();const rig=createTunableDirector(stage,dot,{layout:data.layout,document:store.document});own(()=>rig.dispose());markLoad('media_and_rig_ready');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});own(()=>{renderer.dispose();renderer.domElement.remove();});markLoad('renderer_created');
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;let realGame=null;let fatal=null,screenSignature='',qualitySignature='',quality;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{fatal=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].join('\n');};$('stage').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','可调 Dot 舞台的实时三维画面');
  const a=new T.Vector3(),b=new T.Vector3(),massFollower=createMassFollower(dot,rig);
  function updateActorPose(time){
   dot.prepareStageFrame(time,{camera:stage.camera,scene:stage.scene,document:store.document});
   const state=rig.update(time),guideMix=T.MathUtils.smoothstep(time,SHOT.gameStart,SHOT.gameEnd);
   const bow=.12*Math.sin(Math.PI*T.MathUtils.smoothstep(time,SHOT.musicEnd-.65,SHOT.musicEnd+.8));
   dot.addBodyRoll(-bow);dot.addMotionOffset(0,-bow*.10,0);
   const actions=dot.applyStageActions(time);
   if(!realGame){dot.motion.position.x-=2.1*guideMix;dot.motion.position.y+=.45*guideMix;}
   dot.faceCamera(stage.camera);dot.root.updateMatrixWorld(true);return {...state,actions};
  }
  const hornDissolve=createHornDissolve(stage.scene,dot.horn,{matrixAt(time){const state=updateActorPose(time);applyRecoveryFraming(stage,dot,time,state,data.layout,{yaw:0,pitch:0});dot.finalizeEyes();return dot.horn.matrixWorld.clone();}});stage.scene.traverse(o=>{if(/dissolv|grain/i.test(o.name)&&o.isPoints)o.layers.set(2)});own(()=>hornDissolve.dispose());markLoad('horn_surface_grain_origins_baked');

  if(globalThis.DOT_ENABLE_REAL_ISLAND){realGame=createStageGameBridge({stage,dot,renderer,transport,onNeedFrame:requestFrame});window.DOT_STAGE_GAME_BRIDGE=realGame;}
  function resize(){if(pageDisposed||loadReleased||previewDisposed||realGame?.active||realGame?.landing)return;const width=Math.max(16,Math.round($('stage').clientWidth)),height=Math.round(width*9/16),doc=store.document;quality=applyRenderQuality(renderer,stage,doc.view.quality,{deviceDPR:devicePixelRatio,dofEnabled:doc.camera.dofEnabled,samples:doc.view.dofSamples});renderer.setSize(width,height,false);stage.camera.aspect=16/9;stage.camera.updateProjectionMatrix();requestFrame();}
  const nextPreview={renderer,runtimeProbe:stageProbe,stage,dot,rig,media,finale,concert,gameBridge:realGame,suspendStageBuffers(){assertAlive();stageProbe.mark('stage-offscreen-buffers-release');stage.focus.releaseBuffers();stage.reflection.releaseBuffers();renderer.setSize(1,1,false);renderer.renderLists.dispose();},restoreStageBuffers(){assertAlive();stageProbe.mark('stage-offscreen-buffers-restore');resize();stage.backdrop.invalidate();},configure(doc){assertAlive();rig.setDocument(doc);finale.configureProject(doc.project);const screen=JSON.stringify(doc.screen);if(screen!==screenSignature){media.configure(doc.screen);screenSignature=screen;}const q=JSON.stringify([doc.view,doc.camera.dofEnabled]);if(q!==qualitySignature){qualitySignature=q;resize();}},renderAt(time,{draw=true,syncMedia=true}={}){
   assertAlive();   realGame?.restoreActorBase();const originalEnd=SHOT.performanceEnd,stageTime=Math.min(time,originalEnd);const state=updateActorPose(time),processMedia=media.update(time,{sync:syncMedia});const stageSettings=store.document.stage;const inactiveFx=Object.fromEntries(Object.entries(stageSettings.effects).map(([key,c])=>[key,{...c,enabled:false}]));const celebration=finale.update(time,{...stageSettings,effects:inactiveFx},{target:state.bodyCentre,...massFollower.sample(state,store.document),whiteMix:processMedia.whiteMix});
   // Preserve v018's continuous reveal-to-close-up. No finale-wide override,
   // no extra seven-metre actor lunge, and no forced DOF disable.
   const {pullMix,guideMix,actorWorld,mouthWorld}=applyRecoveryFraming(stage,dot,time,state,data.layout,window.DOT_3D_ORBIT||{yaw:0,pitch:0});
   const inheritedFocus={...stage.focus.settings};
   const focusPoint=mouthWorld.clone().lerp(actorWorld,.35).applyMatrix4(stage.camera.matrixWorldInverse);
   stage.focus.configure({enabled:store.document.camera.dofEnabled,distance:-focusPoint.z,strength:inheritedFocus.strength*(1-guideMix*.7),width:inheritedFocus.width+4.5*guideMix});
   stage.updateLighting?.();
   // Keep the actual instrument through the complete musical tail, then let
   // its small local dissolve lead into the spoken invitation.
   if(time<=0)hornDissolve.reset();const hornState=hornDissolve.update(time);if(hornState.changed)stage.backdrop.invalidate();
   dot.horn.visible=time<SHOT.musicEnd+1.65;dot.root.updateMatrixWorld(true);
   media.uniforms.uWhiteRadiance.value=T.MathUtils.lerp(store.document.screen.whiteRadiance,.32,pullMix);
   const userCube=window.DOT_CONCERT_CUBE_ROTATION||{};
   const concertState=concert.update(time,{stageSettings,project:store.document.project,actorWorld,cubeYaw:userCube.cubeYaw,cubePitch:userCube.cubePitch});
   if(window.DOT_CONCERT_UI_UPDATE)window.DOT_CONCERT_UI_UPDATE(time,{...concertState,openingSource:processMedia.openingSource});
   if(realGame){concert.game.visible=false;realGame.update(time);dot.faceCamera(stage.camera);}
   dot.finalizeEyes();const didRender=draw&&!realGame?.active&&!realGame?.landing;if(didRender)stageProbe.measureDraw(()=>stage.render(renderer),{renderer,phase:time<SHOT.musicEnd?'stage-performance':time<SHOT.musicEnd+1.65?'trumpet-retirement':time<SHOT.islandStart?'response-and-invitation':'stage-to-island'});if(fatal){nextPreview.fatalError='着色器编译失败：'+fatal;throw Error(nextPreview.fatalError);}dot.anchor.getWorldPosition(a);b.copy(dot.mouth).applyMatrix4(dot.deform.matrixWorld);const anchorError=a.distanceTo(b);if(anchorError>1e-8)throw Error('吹嘴连接异常');return{...state,didRender,actualCamera:stage.camera.position.toArray(),processMedia,celebration,concertState,hornState,anchorError,quality};
  },dispose(){if(previewDisposed)return;previewDisposed=true;const errors=[];for(const release of[()=>stageProbe.dispose(),()=>resizeObserver?.disconnect(),()=>realGame?.dispose(),()=>media.dispose(),()=>hornDissolve.dispose(),()=>rig.dispose(),()=>finale.dispose(),()=>concert.dispose(),()=>stage.dispose(),()=>texture.dispose(),()=>renderer.dispose(),()=>renderer.domElement.remove()]){try{release();}catch(error){errors.push(String(error?.message||error));}}return{errors};}};
  partialPreview=nextPreview;
  nextPreview.renderAtAsync=async time=>{assertAlive();await media.seekExact(time);assertAlive();return nextPreview.renderAt(time,{syncMedia:false});};
  nextPreview.configure(store.document);resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('stage'));resize();
  // Prepare the actual pose/lights without accidentally starting a blocking draw.
  nextPreview.renderAt(transport.time,{draw:false});markLoad('first_pose_ready');
  loadProfile.parallelShaderCompile=renderer.extensions.has('KHR_parallel_shader_compile');
  $('loadRead').textContent='正在预编译三维材质；保留标准画质与景深采样…';
  await waitLoadFrame();
  assertAlive();const compileStarted=performance.now(),restoreCompile=concert.prepareCompile({includeGame:!realGame}),restoreHorn=hornDissolve.prepareCompile(),restoreBridge=realGame?.prepareCompile();try{await renderer.compileAsync(stage.scene,stage.camera);assertAlive();}finally{restoreCompile();restoreHorn();restoreBridge?.();}
  markLoad('shader_precompile',performance.now()-compileStarted);
  $('loadRead').textContent='正在预热景深、礼花和玻璃过场；完成后恢复首帧…';
  const restoreTime=transport.time;
  for(const t of [8.2,11.8,SHOT.musicEnd+.8]){await waitLoadFrame();assertAlive();nextPreview.renderAt(t,{syncMedia:false});}
  await nextPreview.renderAtAsync(restoreTime);
  if(realGame&&!globalThis.DOT_SINGLE_INLINE){$('loadRead').textContent='正在准备真实第一关及同一角色…';await realGame.prepare();markLoad('real_island_authority_ready');}
profileFrames=[];
  await waitLoadFrame();
  nextPreview.renderAt(transport.time);initialRenderReady=true;markLoad('first_frame_submitted');loadProfile.totalMs=performance.now()-loadProfile.startedAt;loadProfile.status='first_frame_submitted';$('boot').hidden=true;ui.setReady(true);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;nextPreview.fatalError='三维上下文已丢失，请重新打开文件。';transport.pause();ui.setReady(false);ui.message('三维上下文已丢失。请先导出参数，再刷新恢复。',true);});
  assertAlive();preview=nextPreview;requestFrame();pendingLoadRelease=null;loading=null;acquired.length=0;return preview;
 })();
 try{return await loading;}catch(error){initialRenderReady=false;resizeObserver?.disconnect();releasePartial();pendingLoadRelease=null;preview=null;loading=null;if(globalThis.DOT_LOAD_PROFILE){globalThis.DOT_LOAD_PROFILE.status='failed';globalThis.DOT_LOAD_PROFILE.error=error.message;globalThis.DOT_LOAD_PROFILE.totalMs=performance.now()-globalThis.DOT_LOAD_PROFILE.startedAt;}$('loadRead').textContent='读取失败，请导出参数后刷新：'+error.message;transport.pause();throw error;}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){transport.pause();if(raf)cancelAnimationFrame(raf);raf=0;}else requestFrame();});$('audio').addEventListener('error',()=>{transport.pause();ui.message('本地原音乐未能读取；参数仍可编辑，请检查完整依赖包。',true);});
window.DOT_EDITOR={clearFrameProfile(){profileFrames=[];lastFrame=null;},getFrameProfile:()=>profileFrames.map(x=>({...x})),schema:'dot-motion-workbench-v1',loadPreview,getDocument:()=>JSON.parse(store.serialize(transport.time)),setDocument(doc){transport.pause();store.apply(doc);documentChanged(store.document);ui.refresh();transport.seek(store.document.playhead);},importParameters(text){transport.pause();store.import(text);documentChanged(store.document);ui.refresh();transport.seek(store.document.playhead);},exportParameters:()=>store.serialize(transport.time),seek:t=>transport.seek(t),renderAt(time){if(!preview)throw Error('先载入三维预览');transport.seek(time);return preview.renderAt(time);},async replaceOpeningSource(spec){transport.pause();const current=await loadPreview();const state=await current.media.replaceOpeningSource(spec);await current.renderAtAsync(transport.time);return state;},get preview(){return preview},get transport(){return transport},performanceSnapshot(){return window.DOT_STAGE_PERF?.snapshot()??null;}};
addEventListener('pageshow',event=>{if(event.persisted&&pageDisposed)location.reload();});
addEventListener('pagehide',()=>{pageDisposed=true;pendingLoadRelease?.();pendingLoadRelease=null;transport.dispose();ui.dispose();resizeObserver?.disconnect();if(raf)cancelAnimationFrame(raf);preview?.dispose();},{once:true});
