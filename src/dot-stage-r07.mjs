import * as T from 'three';
import {loadSharedDot,ACCEPTED_ID} from '../assets/dot/index.mjs';
import {createR03Stage} from './stage-r03.mjs';
import {createCompanionActions} from './companion-actions.mjs';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),sat=x=>T.MathUtils.clamp(x,0,1),ease=x=>{x=sat(x);return x*x*x*(10+x*(-15+6*x));};
export async function createDotStage({scene,camera,film=document.querySelector('#film'),isPlaying=()=>false}={}){
  const rig=await loadSharedDot({camera,scene,coordinates:'normalized',context:'stage',state:'trumpet',instrument:true});
  const nativeScale=rig.model.root.scale.x;
  rig.model.root.position.set(0,0,0);rig.model.root.scale.setScalar(1);
  const source=await createR03Stage({rig,film,isPlaying}),root=rig.root,actions=createCompanionActions(rig);
  const body=rig.native.body,bodyCentre=body.geometry.boundingBox.getCenter(V()),actorWorldPos=V(),position=V(),velocity=V(),target=V(),offset=V();
  const view=V(),right=V(),up=V(),ndc=V(),ray=new T.Raycaster(),mouse=new T.Vector2(),eyeBase=rig.model.eyeAdapter.frontTargets.map(v=>[...v]);
  const attention=V(),gaze=new T.Vector2();let attentionUntil=0,pointer=null,hovering=false;
  const guidance=new T.Group();guidance.visible=false;scene.add(guidance);
  const interact=document.createElement('button');interact.id='dot-interact';interact.setAttribute('aria-label','与 Dot 互动，触发一个小动作');interact.title='和 Dot 打个招呼';
  Object.assign(interact.style,{position:'fixed',width:'76px',height:'76px',background:'transparent',border:'0',zIndex:'14',pointerEvents:'none',display:'none'});document.body.append(interact);interact.onclick=()=>actions.trigger('click');
  let mode='hidden',lastTime=0,stageTime=0,depart=null,previousTargetZ=null,lastAction=null,sideStart=0,sideEnd=0,sideAt=0;
  function centre(){root.updateWorldMatrix(true,true);return actorWorldPos.copy(bodyCentre).applyMatrix4(body.matrixWorld);}
  function toHost(){if(root.parent!==scene){scene.add(root);root.quaternion.identity();root.traverse(o=>o.layers.enable(0));}}
  function pose(frame,desired,scale){
    rig.setState('idle');rig.setInstrumentVisible(false);rig.applyFrame(frame,{camera,scene,bindEyes:false});root.scale.setScalar(scale);root.position.copy(desired);root.quaternion.identity();
    for(let i=0;i<2;i++){rig.faceCamera(camera);centre();root.position.add(offset.copy(desired).sub(actorWorldPos));}
    rig.faceCamera(camera);rig.finalizeEyes();centre();
  }
  function spring(dt){const w=6.4,decay=Math.exp(-w*dt);for(const k of ['x','y','z']){const x=position[k]-target[k],v=velocity[k],c=v+w*x;position[k]=target[k]+(x+c*dt)*decay;velocity[k]=(v-w*c*dt)*decay;}}
  function update({time=0,dt=1/60,mode:next='hidden',stageTime:st=0,departureProgress=0,companionTarget=V(8,3,4),pixelRatio=1.5}={}){
    lastTime=time;stageTime=st;dt=Math.min(.05,Math.max(0,dt));
    if(next==='hidden'){root.visible=false;source.hide();interact.style.display='none';mode=next;return;}
    root.visible=true;
    if(next==='stage'){
      source.update(st,{ratio:pixelRatio});centre();interact.style.display='none';depart=null;mode=next;return;
    }
    if(next==='departure'){
      const p=sat(departureProgress),e=ease(p);
      if(mode!=='departure'){
        const start=centre().clone().project(source.stage.camera),depth=-centre().clone().applyMatrix4(source.stage.camera.matrixWorldInverse).z;
        const worldScale=root.getWorldScale(V()).x;
        depart={start,scale:worldScale,depth:Math.max(4,depth),fov:source.stage.camera.fov,frame:source.freeze()};
        toHost();actions.reset(time);velocity.set(0,0,0);
      }
      const end=companionTarget.clone().project(camera);ndc.copy(depart.start).lerp(end,e);ndc.y+=Math.sin(p*Math.PI)*.30;ndc.x+=Math.sin(p*Math.PI*2)*.09*Math.sin(p*Math.PI);
      const depth=16,viewPoint=V(0,0,-depth).applyMatrix4(camera.matrixWorld).project(camera);ndc.z=viewPoint.z;position.copy(ndc.unproject(camera));
      const oldScale=depart.scale*depth/depart.depth*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.tan(T.MathUtils.degToRad(depart.fov/2));
      const sampled=actions.sample(time),frame=sampled.frame;
      if(depart.frame&&p<.7){const mix=ease(p/.7);for(const k of Object.keys(frame.p))if(typeof frame.p[k]==='number'&&typeof depart.frame.p[k]==='number')frame.p[k]=T.MathUtils.lerp(depart.frame.p[k],frame.p[k],mix);frame.bodyRoll=T.MathUtils.lerp(Math.atan2(Math.sin(depart.frame.bodyRoll||0),Math.cos(depart.frame.bodyRoll||0)),frame.bodyRoll,mix);}
      pose(frame,position,T.MathUtils.lerp(oldScale,nativeScale*.55,e));
      source.advanceBackground?.(p*1.35);source.render(1-ease(p/.96));
      if(p>=1){source.hide();position.copy(actorWorldPos);actions.trigger('ambient','greet');}
    }else{
      if(mode!=='scroll'){toHost();source.hide();position.copy(mode==='departure'?actorWorldPos:companionTarget);sideStart=sideEnd=position.x;sideAt=time;previousTargetZ=null;if(mode!=='departure')actions.reset(time);}
      target.copy(companionTarget);
      if(previousTargetZ!==null)position.z+=(target.z-previousTargetZ)*.92;previousTargetZ=target.z;
      if(Math.sign(target.x)!==Math.sign(sideEnd)&&Math.abs(target.x-sideEnd)>1){sideStart=position.x;sideAt=time;}sideEnd=target.x;
      target.x=T.MathUtils.lerp(sideStart,sideEnd,ease((time-sideAt)/2.1));
      target.y+=.15*Math.sin(time*1.4)+.06*Math.sin(time*2.65);target.x+=.12*Math.sin(time*.73);spring(dt);
      const sampled=actions.sample(time);lastAction=sampled.id;
      right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);
      const desired=position.clone().addScaledVector(right,sampled.offset[0]*.65).addScaledVector(up,sampled.offset[1]*.65);
      const gazeTarget=new T.Vector2();
      if(pointer){view.copy(desired).project(camera);gazeTarget.set(T.MathUtils.clamp((pointer.x-view.x)*.9,-1,1),T.MathUtils.clamp((pointer.y-view.y)*.7,-.6,.6));}
      else if(time<attentionUntil){view.copy(attention).project(camera);ndc.copy(desired).project(camera);gazeTarget.set(T.MathUtils.clamp(view.x-ndc.x,-1,1),T.MathUtils.clamp(view.y-ndc.y,-.6,.6));}
      gaze.lerp(gazeTarget,1-Math.exp(-dt*8));
      for(let i=0;i<eyeBase.length;i++){rig.model.eyeAdapter.frontTargets[i][0]=eyeBase[i][0]+gaze.x*.05*rig.model.actionUnit;rig.model.eyeAdapter.frontTargets[i][1]=eyeBase[i][1]+gaze.y*.035*rig.model.actionUnit;}
      pose(sampled.frame,desired,nativeScale*.55);
      ndc.copy(actorWorldPos).project(camera);interact.style.display='block';interact.style.left=((ndc.x+1)*innerWidth/2-38)+'px';interact.style.top=((1-ndc.y)*innerHeight/2-38)+'px';
    }
    mode=next;
  }
  return{root,rig,actorWorldPos,guidance,source,stageGroup:source.stage.scene,stageCamera:source.stage.camera,screen:source.stage.screen,floor:source.stage.floor,update,
    renderStage:()=>source.render(1),beforeRender(){},preparePerformance:()=>({source:'R03',musicEnd:14.809,end:19.35}),
    setReflectionEnabled:on=>source.setQuality(on?'balanced':'low'),
    setAttention(point){if(point){attention.copy(point);attentionUntil=lastTime+4;actions.trigger('ambient','attention');}else attentionUntil=0;},
    pointer(x,y){pointer={x:x/innerWidth*2-1,y:1-y/innerHeight*2};},
    hitTest(x,y){if(mode!=='scroll')return false;mouse.set(x/innerWidth*2-1,1-y/innerHeight*2);ray.setFromCamera(mouse,camera);return ray.intersectObject(body,false).length>0||ray.intersectObject(rig.native.hats,true).length>0;},
    hover(value){if(value&&!hovering)actions.trigger('hover');hovering=value;},
    react:reason=>actions.trigger(reason||'click'),
    snapshot:()=>({acceptedId:ACCEPTED_ID,characterCount:1,mode,stageTime,actorWorldPos:actorWorldPos.toArray(),actions:actions.snapshot(),action:lastAction,source:source.snapshot()})
  };
}
