import * as T from 'three';
import {CONFIG} from './config.mjs';
import {assetJSON} from './asset-prefetch.mjs';
import {constrainedDevice} from './performance-budget.mjs';
import {yieldTask} from './preparation.mjs';
import {loadDot} from '../assets/r03-stage/v020-white-encore-cpu/stage-character-d02-r01.mjs';
import {createBridgeStage} from '../assets/r03-stage/v020-white-encore-cpu/stage-base.mjs';
import {createStageFinale} from '../assets/r03-stage/v020-white-encore-cpu/stage-design.mjs';
import {createConcertRevision} from '../assets/r03-stage/v020-white-encore-cpu/concert-revision-r05.mjs';
import {createTunableDirector} from '../assets/r03-stage/v020-white-encore-cpu/tunable-director.mjs';
import {applyRecoveryFraming} from '../assets/r03-stage/v020-white-encore-cpu/recovery-framing-r01.mjs';
import {createMassFollower} from '../assets/r03-stage/v020-white-encore-cpu/mass-follow.mjs';
import {createStageScreen} from './stage-screen.mjs';
import {makeDefaults,SHOT,configureAudioDuration} from '../assets/r03-stage/v020-white-encore-cpu/document.mjs';
import {createHornDissolve} from '../assets/dot/effects/horn-dissolve-r05.mjs';

export async function createR03Stage({rig,film,isPlaying=()=>false,renderer=null}){
  const data=await assetJSON(new URL('../assets/r03-stage/document-source.json',import.meta.url));
  configureAudioDuration(51.9833333333);
  const doc=makeDefaults(data.project);
  // Finish the same source pullback before the new, short scroll handoff.
  SHOT.pullStart=SHOT.musicEnd+.05;SHOT.pullEnd=16.30;SHOT.speechStart=SHOT.musicEnd+.30;SHOT.speechEnd=SHOT.speechStart+3.4;
  doc.camera.dofEnabled=!constrainedDevice();doc.camera.dofStrength=.62;doc.camera.dofWidth=1.25;
  Object.assign(doc.screen,{fadeStart:1.0,fadeDuration:2,whiteEnabled:true,whiteRadiance:1});
  globalThis.DOT_STAGE_OPENING_SOURCE={kind:'video',status:'approved',label:'同源影片 · 共用解码帧',element:film,uri:film.currentSrc||film.src,inPoint:CONFIG.film.stageAt,fps:60};
  const dot=await loadDot({sharedRig:rig});
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=9;
  canvas.getContext('2d').fillRect(0,0,16,9);
  const texture=new T.CanvasTexture(canvas);
  const universe={texture,displayReferred:true,revision:0,update:time=>({time})};
  const trace=label=>{const r=window.__linggan?.runtime;if(r)(r.prepTrace??=[]).push({label,at:performance.now()});};
  trace('bridge-start');const stage=createBridgeStage(dot,{layout:data.layout,universe});trace('bridge-end');await yieldTask();
  stage.hemi.intensity=.075;stage.fill.intensity=.60;stage.rim.intensity=4;
  for(const light of stage.scene.children)if(light.isDirectionalLight&&light!==stage.fill&&light!==stage.rim)light.intensity=.35;
  const finale=createStageFinale(stage,data.layout);trace('finale-end');await yieldTask();const concert=createConcertRevision(stage,dot,data.layout,finale);trace('concert-end');await yieldTask();
  concert.root.traverse(o=>{if(o.isInstancedMesh)o.layers.set(2);});
  const media=await createStageScreen(stage,doc.screen,{isPlaying});
  const director=createTunableDirector(stage,dot,{layout:data.layout,document:doc}),mass=createMassFollower(dot,director);
  const stageParent=dot.root.parent,base={position:dot.root.position.clone(),quaternion:dot.root.quaternion.clone(),scale:dot.root.scale.clone()};
  renderer??=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.domElement.id='r03-stage';renderer.domElement.setAttribute('aria-hidden','true');
  Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'2',pointerEvents:'none',display:'none'});
  document.body.append(renderer.domElement);
  const departureCanvas=document.createElement('canvas');departureCanvas.id='stage-departure-backdrop';Object.assign(departureCanvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'2',pointerEvents:'none',display:'none'});document.body.append(departureCanvas);let backdropReady=false,liveDraws=0;
  let lastState=null,active=false,width=0,height=0,dpr=0,shadowReady=false;
  function warmShadows(){
    if(shadowReady||!renderer.shadowMap.enabled)return;
    const target=new T.WebGLRenderTarget(1,1),previous=renderer.getRenderTarget(),mask=stage.camera.layers.mask;
    try{renderer.setRenderTarget(target);stage.camera.layers.set(2);renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;renderer.render(stage.scene,stage.camera);shadowReady=true;}
    finally{stage.camera.layers.mask=mask;renderer.setRenderTarget(previous);target.dispose();}
  }
  function actor(time){
    dot.prepareStageFrame(time,{camera:stage.camera,scene:stage.scene,document:doc});
    const state=director.update(time),bow=.12*Math.sin(Math.PI*T.MathUtils.smoothstep(time,SHOT.musicEnd-.65,SHOT.musicEnd+.8));
    dot.addBodyRoll(-bow);dot.addMotionOffset(0,-bow*.10,0);dot.applyStageActions(time);dot.faceCamera(stage.camera);dot.root.updateMatrixWorld(true);return state;
  }
  const poseMatrices=new Map();
  for(let key=Math.floor((SHOT.musicEnd+.05)*120);key<=Math.ceil((SHOT.musicEnd+.45)*120);key++){const t=key/120,state=actor(t);applyRecoveryFraming(stage,dot,t,state,data.layout);dot.finalizeEyes();poseMatrices.set(key,dot.horn.matrixWorld.clone());if(key%2===0)await yieldTask();}
  const dissolve=createHornDissolve(stage.scene,dot.horn,{matrixAt(t){return poseMatrices.get(Math.round(t*120)).clone();}});
  stage.scene.traverse(o=>{if(/dissolv|grain/i.test(o.name)&&o.isPoints)o.layers.set(2);});
  const stageMasks=new Map();dot.root.traverse(o=>stageMasks.set(o,o.layers.mask));
  function activate(){
    if(dot.root.parent!==stageParent){stageParent.add(dot.root);dot.root.position.copy(base.position);dot.root.quaternion.copy(base.quaternion);dot.root.scale.copy(base.scale);}
    for(const [o,mask]of stageMasks)o.layers.mask=mask|(1<<30);
    dot.root.visible=true;active=true;
  }
  function resize(ratio=1.5){
    const next=Math.min(ratio,1.5);
    if(width===innerWidth&&height===innerHeight&&dpr===next)return;
    width=innerWidth;height=innerHeight;dpr=next;renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);stage.backdrop.invalidate();
  }
  function update(time,{playing=isPlaying(),ratio=1.5}={}){
    activate();resize(ratio);
    const state=actor(time),screen=media.update(time,{sync:true});
    const effects=Object.fromEntries(Object.entries(doc.stage.effects).map(([k,c])=>[k,{...c,enabled:false}]));
    finale.update(time,{...doc.stage,effects},{target:state.bodyCentre,...mass.sample(state,doc),whiteMix:screen.whiteMix});
    const framing=applyRecoveryFraming(stage,dot,time,state,data.layout);
    // Preserve the source horizontal composition on narrow viewports.
    stage.camera.aspect=width/height;
    const sourceAspect=film.videoWidth/film.videoHeight||16/9,nativeFit=Math.max(1,(16/9)/stage.camera.aspect),contentFit=Math.min(1,(16/9)/sourceAspect)*Math.max(1,sourceAspect/stage.camera.aspect);
    const fit=T.MathUtils.lerp(contentFit,nativeFit,T.MathUtils.smoothstep(time,0,1.8));
    stage.camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(stage.camera.fov/2))*fit));
    stage.camera.updateProjectionMatrix();stage.camera.updateMatrixWorld(true);
    stage.focus.configure({enabled:doc.camera.dofEnabled&&time>2.3,distance:-framing.mouthWorld.clone().lerp(framing.actorWorld,.35).applyMatrix4(stage.camera.matrixWorldInverse).z,strength:.4,width:5});
    stage.updateLighting();
    if(time<=0)dissolve.reset();const horn=dissolve.update(time);dot.horn.visible=time<SHOT.musicEnd+.50;
    const fx=concert.update(time,{stageSettings:doc.stage,project:doc.project,actorWorld:framing.actorWorld});concert.game.visible=false;
    dot.finalizeEyes();lastState={time,screen,horn,fx,camera:stage.camera.position.toArray(),actorWorld:framing.actorWorld.toArray(),actions:dot.stageActionState};
    return lastState;
  }
  return {stage,rig,dot,director,renderer,media,document:doc,normalBase:base,activate,update,resize,
    render(opacity=1){departureCanvas.style.display='none';renderer.domElement.style.display=opacity>0?'block':'none';renderer.domElement.style.opacity=String(opacity);if(opacity>0){warmShadows();stage.render(renderer);liveDraws++;}},
    hide(){renderer.domElement.style.display='none';departureCanvas.style.display='none';media.pause();active=false;},
    async prepareDepartureBackdrop(){
      const visible=dot.root.visible;dot.root.visible=false;
      try{warmShadows();stage.render(renderer);departureCanvas.width=renderer.domElement.width;departureCanvas.height=renderer.domElement.height;departureCanvas.getContext('2d',{alpha:false}).drawImage(renderer.domElement,0,0);backdropReady=true;}finally{dot.root.visible=visible;}
    },
    renderDeparture(opacity){
      renderer.domElement.style.display='none';departureCanvas.style.display=backdropReady&&opacity>0?'block':'none';departureCanvas.style.opacity=String(opacity);
    },
    freeze(){media.pause();return dot.captureHandoffFrame();},
    advanceBackground(elapsed){if(lastState){concert.update(lastState.time+elapsed,{stageSettings:doc.stage,project:doc.project,actorWorld:new T.Vector3(...lastState.actorWorld)});concert.game.visible=false;}},
    async seek(time){await media.seekExact(time);},
    setQuality(mode){doc.camera.dofEnabled=mode!=='low'&&!constrainedDevice();renderer.shadowMap.enabled=mode!=='low';},
    snapshot:()=>({source:'D02_R03_统一单文件_r01',active,characterCount:1,islandLoaded:false,departureBackdrop:{ready:backdropReady,width:departureCanvas.width,height:departureCanvas.height,liveDraws},...lastState})
  };
}
