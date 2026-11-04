import{createStageGameBridge}from'./stage-game-bridge-r07.mjs';import {createHornDissolve} from './horn-dissolve-r05.mjs';import{createMassFollower}from'./mass-follow.mjs';import{createConcertRevision}from'./concert-revision-r05.mjs';import * as T from'../v011/DotSharedWeb/vendor/three.module.js';import{loadDot}from'../v011/DotSharedWeb/dot-component.mjs';import{applyRenderQuality}from'../v011/DotSharedWeb/render-quality.mjs';import{createBridgeStage}from'./stage-base.mjs';import{createUniverseStillProvider}from'../v013-stage-bridge/universe-provider.mjs';import{createProcessScreenMedia}from'./process-screen-r05.mjs';import{createStageFinale}from'./stage-design.mjs';import{createTunableDirector}from'./tunable-director.mjs';import{makeDefaults,createDocumentStore,SHOT,configureAudioDuration}from'./document.mjs';import{createAudioTransport}from'./transport.mjs';import{createWorkbenchUI}from'./ui.mjs';
const $=id=>document.getElementById(id),KEY='dot-stage-cdx-review-r06b-anchor-and-tail-candidate';
const data=globalThis.DOT_WORKBENCH_DATA??await fetch(new URL('./data.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('本地参数数据未找到');return r.json();});
const audioElement=$('audio');
if(audioElement.readyState<1)await new Promise((resolve,reject)=>{audioElement.addEventListener('loadedmetadata',resolve,{once:true});audioElement.addEventListener('error',()=>reject(Error('原音乐元数据未读取')),{once:true});});
configureAudioDuration(audioElement.duration);
const defaults=makeDefaults(data.project),store=createDocumentStore(defaults);let savedMessage=null;
try{const saved=localStorage.getItem(KEY);if(saved){store.import(saved);savedMessage='已恢复此浏览器中的调节副本；原工程默认不变。';}}catch{savedMessage='本地记录不可用，已载入默认；可继续编辑并导出参数。';}
let preview=null,loading=null,raf=0,dirty=false,ui,resizeObserver,contextLost=false,initialRenderReady=false,intervals=[],profileFrames=[],lastFrame=null,lastInfo=0;
function requestFrame(){dirty=true;if(preview&&!raf&&!document.hidden&&!contextLost)raf=requestAnimationFrame(frame);}
const transport=createAudioTransport($('audio'),{onTime(){ui?.draw();requestFrame();},onState(){ui?.draw();lastFrame=null;intervals=[];if(transport.playing)requestFrame();}});
function persist(){try{localStorage.setItem(KEY,store.serialize(transport.time));}catch{ui.message('本地存储不可用，当前修改仍保留；请导出参数。',true);}}
function documentChanged(doc){transport.configure(doc.transport);preview?.configure(doc);persist();requestFrame();}
ui=createWorkbenchUI({store,transport,wave:data.wave,onChange:documentChanged,onNeedFrame:requestFrame,onLoadPreview:()=>loadPreview().catch(error=>ui.message('三维预览未完成：'+error.message,true))});transport.configure(store.document.transport);transport.seek(store.document.playhead);if(savedMessage)ui.message(savedMessage);
function frame(now){raf=0;if(document.hidden||contextLost||!preview||!initialRenderReady)return;if(transport.playing)transport.tick();if(!dirty&&!transport.playing)return;dirty=false;try{const state=preview.renderAt(transport.time);$('phase').textContent=({idle:'待气',inhale:'吸气',hold:'蓄力',exhale:'短吹',recover:'放松'})[state.pose.breathPhase]||'预览';if(transport.playing&&lastFrame!==null){intervals.push(now-lastFrame);profileFrames.push({time:transport.time,dt:now-lastFrame});if(intervals.length>120)intervals.shift();}lastFrame=now;if(now-lastInfo>250){lastInfo=now;const fps=intervals.length>30?1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length):null;$('stats').textContent=transport.playing?`${fps?'实际预览约 '+fps.toFixed(1)+' fps · ':''}${preview.renderer.domElement.width} × ${preview.renderer.domElement.height}`:'已暂停 · 修改后单帧预览';}}catch(error){transport.pause();ui.message('三维预览已暂停：'+error.message,true);}if(transport.playing)requestFrame();}
async function loadPreview(){
 if(preview)return preview;if(loading)return loading;
 $('loadPreview').disabled=true;$('loadRead').textContent='正在读取随包模型、纹理和着色器…';
 loading=(async()=>{
  const loadProfile={status:'loading',startedAt:performance.now(),events:[],scope:'Local browser JavaScript phase timings; first render submission does not measure GPU completion'};
  globalThis.DOT_LOAD_PROFILE=loadProfile;
  const markLoad=(phase,stageMs=null)=>loadProfile.events.push({phase,elapsedMs:performance.now()-loadProfile.startedAt,stageMs});
  const dot=await loadDot({onStage:(phase,ms)=>markLoad(phase,ms)});
  const source=globalThis.DOT_WORKBENCH_UNIVERSE??new URL('./assets/universe-placeholder.png',import.meta.url),texture=await new T.TextureLoader().loadAsync(String(source)),universe=createUniverseStillProvider(texture,{useAuthorized:true,qualityApproved:false,sourceTimeOrigin:36,duration:SHOT.end,sourceId:'SH24-overview-v2-panel6-TEMP'});universe.displayReferred=true;markLoad('universe_texture_ready');
  const stage=createBridgeStage(dot,{layout:data.layout,universe});markLoad('base_stage_ready');
  const finale=createStageFinale(stage,data.layout);markLoad('stage_architecture_ready');
  const concert=createConcertRevision(stage,dot,data.layout,finale);concert.root.traverse(o=>{if(o.isInstancedMesh)o.layers.set(2)});markLoad('celebration_geometry_ready');
  const media=await createProcessScreenMedia(stage,data.white,{onFrameReady:requestFrame,isPlaying:()=>transport.playing}),rig=createTunableDirector(stage,dot,{layout:data.layout,document:store.document});markLoad('media_and_rig_ready');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});markLoad('renderer_created');
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;let realGame=null;let fatal=null,screenSignature='',qualitySignature='',quality;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{fatal=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].join('\n');};$('stage').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','可调 Dot 舞台的实时三维画面');
  const a=new T.Vector3(),b=new T.Vector3(),massFollower=createMassFollower(dot,rig);
  function updateActorPose(time){
   const state=rig.update(time),guideMix=T.MathUtils.smoothstep(time,SHOT.gameStart,SHOT.gameEnd);
   const bow=.22*Math.sin(Math.PI*T.MathUtils.smoothstep(time,SHOT.musicEnd-.75,SHOT.musicEnd+.85));
   dot.motion.rotation.z-=bow;dot.motion.position.y-=bow*.16;
   dot.motion.rotation.y=T.MathUtils.lerp(dot.motion.rotation.y,.88,T.MathUtils.smoothstep(time,SHOT.musicEnd,SHOT.speechStart));
   const settle=T.MathUtils.smoothstep(time,SHOT.musicEnd,SHOT.musicEnd+.7),alive=.018*Math.sin((time-SHOT.musicEnd)*2.35)*settle;dot.motion.position.y+=alive;dot.motion.rotation.z+=.006*Math.sin((time-SHOT.musicEnd)*1.7)*settle;
   const blink=settle*Math.pow(Math.max(0,Math.cos((time-SHOT.musicEnd-1.55)*2.0)),28);if(settle>.95){dot.closedEyes.visible=blink>.88;dot.openEyes.visible=!dot.closedEyes.visible;for(const eye of dot.openEyes.children)eye.scale.y=.086*(1-blink*.94);}
   if(!realGame){dot.motion.position.x-=2.1*guideMix;dot.motion.position.y+=.45*guideMix;}dot.root.updateMatrixWorld(true);return state;
  }
  const hornDissolve=createHornDissolve(stage.scene,dot.horn,{matrixAt(time){updateActorPose(time);return dot.horn.matrixWorld.clone();}});stage.scene.traverse(o=>{if(/dissolv|grain/i.test(o.name)&&o.isPoints)o.layers.set(2)});markLoad('horn_surface_grain_origins_baked');

  if(globalThis.DOT_ENABLE_REAL_ISLAND){realGame=createStageGameBridge({stage,dot,renderer,transport,onNeedFrame:requestFrame});window.DOT_STAGE_GAME_BRIDGE=realGame;}
  function resize(){const width=Math.max(16,Math.round($('stage').clientWidth)),height=Math.round(width*9/16),doc=store.document;quality=applyRenderQuality(renderer,stage,doc.view.quality,{deviceDPR:devicePixelRatio,dofEnabled:doc.camera.dofEnabled,samples:doc.view.dofSamples});renderer.setSize(width,height,false);stage.camera.aspect=16/9;stage.camera.updateProjectionMatrix();requestFrame();}
  preview={renderer,stage,dot,rig,media,finale,concert,gameBridge:realGame,configure(doc){rig.setDocument(doc);finale.configureProject(doc.project);const screen=JSON.stringify(doc.screen);if(screen!==screenSignature){media.configure(doc.screen);screenSignature=screen;}const q=JSON.stringify([doc.view,doc.camera.dofEnabled]);if(q!==qualitySignature){qualitySignature=q;resize();}},renderAt(time,{draw=true,syncMedia=true}={}){
   realGame?.restoreActorBase();const originalEnd=SHOT.performanceEnd,stageTime=Math.min(time,originalEnd);const state=updateActorPose(time),processMedia=media.update(time,{sync:syncMedia});const stageSettings=store.document.stage;const inactiveFx=Object.fromEntries(Object.entries(stageSettings.effects).map(([key,c])=>[key,{...c,enabled:false}]));const celebration=finale.update(time,{...stageSettings,effects:inactiveFx},{target:state.bodyCentre,...massFollower.sample(state,store.document),whiteMix:processMedia.whiteMix});
   // Preserve v018's continuous reveal-to-close-up. No finale-wide override,
   // no extra seven-metre actor lunge, and no forced DOF disable.
   const pullMix=T.MathUtils.smoothstep(time,SHOT.pullStart,SHOT.pullEnd);
   const guideMix=T.MathUtils.smoothstep(time,SHOT.gameStart,SHOT.gameEnd);
   dot.root.updateMatrixWorld(true);
   const mouthWorld=new T.Vector3();dot.anchor.getWorldPosition(mouthWorld);
   const actorWorld=new T.Vector3();dot.body.getWorldPosition(actorWorld);
   const desiredPos=new T.Vector3(data.layout.screen.x-.3,1.7,18.5),desiredTarget=new T.Vector3(data.layout.screen.x+.55,.72,0);
   if(pullMix>0){stage.camera.position.lerp(desiredPos,pullMix);const aim=new T.Vector3(...state.target).lerp(desiredTarget,pullMix);stage.camera.lookAt(aim);stage.camera.updateMatrixWorld(true);}
   // Keep the accepted dolly and timing; only centre the whole Dot+horn ensemble.
   const ensembleNear=T.MathUtils.smoothstep(time,4.8,10.2)*(1-pullMix)*(1-T.MathUtils.smoothstep(time,SHOT.musicEnd+.2,SHOT.musicEnd+1.6));
   if(ensembleNear>0){const bounds=new T.Box3().setFromObject(dot.body).union(new T.Box3().setFromObject(dot.horn)),centre=bounds.getCenter(new T.Vector3()),shift=(centre.x-actorWorld.x)*ensembleNear;stage.camera.position.x+=shift;const aim=new T.Vector3(...state.target).lerp(desiredTarget,pullMix);aim.x+=shift;stage.camera.lookAt(aim);stage.camera.updateMatrixWorld(true);}
   const orbit=window.DOT_3D_ORBIT||{yaw:0,pitch:0};
   if(orbit.yaw||orbit.pitch){const aim=new T.Vector3(...state.target).lerp(desiredTarget,pullMix),rel=stage.camera.position.clone().sub(aim);rel.applyEuler(new T.Euler(orbit.pitch,orbit.yaw,0,'YXZ'));stage.camera.position.copy(aim).add(rel);stage.camera.lookAt(aim);stage.camera.updateMatrixWorld(true);}
   const inheritedFocus={...stage.focus.settings};
   const focusPoint=mouthWorld.clone().lerp(actorWorld,.35).applyMatrix4(stage.camera.matrixWorldInverse);
   stage.focus.configure({enabled:store.document.camera.dofEnabled,distance:-focusPoint.z,strength:inheritedFocus.strength*(1-guideMix*.7),width:inheritedFocus.width+4.5*guideMix});
   stage.updateLighting?.();
   // Keep the actual instrument through the complete musical tail, then let
   // its small local dissolve lead into the spoken invitation.
   const hornState=hornDissolve.update(time);if(hornState.changed)stage.backdrop.invalidate();
   dot.horn.visible=time<SHOT.musicEnd+1.65;dot.root.updateMatrixWorld(true);
   media.uniforms.uWhiteRadiance.value=T.MathUtils.lerp(store.document.screen.whiteRadiance,.32,pullMix);
   const userCube=window.DOT_CONCERT_CUBE_ROTATION||{};
   const concertState=concert.update(time,{stageSettings,project:store.document.project,actorWorld,cubeYaw:userCube.cubeYaw,cubePitch:userCube.cubePitch});
   if(window.DOT_CONCERT_UI_UPDATE)window.DOT_CONCERT_UI_UPDATE(time,{...concertState,openingSource:processMedia.openingSource});
   if(realGame){concert.game.visible=false;realGame.update(time);}
   if(draw&&!realGame?.active)stage.render(renderer);if(fatal)throw Error('着色器编译失败：'+fatal);dot.anchor.getWorldPosition(a);b.copy(dot.mouth).applyMatrix4(dot.deform.matrixWorld);const anchorError=a.distanceTo(b);if(anchorError>1e-8)throw Error('吹嘴连接异常');return{...state,actualCamera:stage.camera.position.toArray(),processMedia,celebration,concertState,hornState,anchorError,quality};
  },dispose(){realGame?.dispose();media.dispose();hornDissolve.dispose();rig.dispose();finale.dispose();concert.dispose();stage.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove();}};
  preview.renderAtAsync=async time=>{await media.seekExact(time);return preview.renderAt(time,{syncMedia:false});};
  preview.configure(store.document);resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('stage'));resize();
  // Prepare the actual pose/lights without accidentally starting a blocking draw.
  preview.renderAt(transport.time,{draw:false});markLoad('first_pose_ready');
  loadProfile.parallelShaderCompile=renderer.extensions.has('KHR_parallel_shader_compile');
  $('loadRead').textContent='正在预编译三维材质；保留标准画质与景深采样…';
  await new Promise(requestAnimationFrame);
  const compileStarted=performance.now(),restoreCompile=concert.prepareCompile({includeGame:!realGame}),restoreHorn=hornDissolve.prepareCompile(),restoreBridge=realGame?.prepareCompile();try{await renderer.compileAsync(stage.scene,stage.camera);}finally{restoreCompile();restoreHorn();restoreBridge?.();}
  markLoad('shader_precompile',performance.now()-compileStarted);
  $('loadRead').textContent='正在预热景深、礼花和玻璃过场；完成后恢复首帧…';
  const restoreTime=transport.time;
  for(const t of [8.2,11.8,SHOT.musicEnd+.8]){await new Promise(requestAnimationFrame);preview.renderAt(t,{syncMedia:false});}
  await preview.renderAtAsync(restoreTime);
  if(realGame){$('loadRead').textContent='正在准备真实第一关及同一角色…';await realGame.prepare();markLoad('real_island_authority_ready');}
profileFrames=[];
  await new Promise(requestAnimationFrame);
  preview.renderAt(transport.time);initialRenderReady=true;markLoad('first_frame_submitted');loadProfile.totalMs=performance.now()-loadProfile.startedAt;loadProfile.status='first_frame_submitted';$('boot').hidden=true;ui.setReady(true);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;transport.pause();ui.setReady(false);ui.message('三维上下文已丢失。请先导出参数，再刷新恢复。',true);});
  requestFrame();return preview;
 })();
 try{return await loading;}catch(error){if(globalThis.DOT_LOAD_PROFILE){globalThis.DOT_LOAD_PROFILE.status='failed';globalThis.DOT_LOAD_PROFILE.error=error.message;globalThis.DOT_LOAD_PROFILE.totalMs=performance.now()-globalThis.DOT_LOAD_PROFILE.startedAt;}$('loadRead').textContent='读取失败，请导出参数后刷新：'+error.message;transport.pause();throw error;}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){transport.pause();if(raf)cancelAnimationFrame(raf);raf=0;}else requestFrame();});$('audio').addEventListener('error',()=>{transport.pause();ui.message('本地原音乐未能读取；参数仍可编辑，请检查完整依赖包。',true);});
window.DOT_EDITOR={clearFrameProfile(){profileFrames=[];lastFrame=null;},getFrameProfile:()=>profileFrames.map(x=>({...x})),schema:'dot-motion-workbench-v1',loadPreview,getDocument:()=>JSON.parse(store.serialize(transport.time)),setDocument(doc){transport.pause();store.apply(doc);documentChanged(store.document);ui.refresh();transport.seek(store.document.playhead);},importParameters(text){transport.pause();store.import(text);documentChanged(store.document);ui.refresh();transport.seek(store.document.playhead);},exportParameters:()=>store.serialize(transport.time),seek:t=>transport.seek(t),renderAt(time){if(!preview)throw Error('先载入三维预览');transport.seek(time);return preview.renderAt(time);},async replaceOpeningSource(spec){transport.pause();const current=await loadPreview();const state=await current.media.replaceOpeningSource(spec);await current.renderAtAsync(transport.time);return state;},get preview(){return preview},get transport(){return transport},performanceSnapshot(){const sorted=intervals.slice().sort((a,b)=>a-b);return{samples:intervals.length,meanFPS:intervals.length?1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length):null,p95IntervalMs:sorted.length?sorted[Math.floor((sorted.length-1)*.95)]:null,actualBrowserMeasurement:true,paused:!transport.playing};}};
addEventListener('pagehide',()=>{transport.dispose();ui.dispose();resizeObserver?.disconnect();if(raf)cancelAnimationFrame(raf);preview?.dispose();},{once:true});
