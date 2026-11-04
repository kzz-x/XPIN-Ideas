import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {loadSharedDot,ACCEPTED_ID} from '../../dot/index.mjs';
import {sampleMotion} from '../recovery-actions/spirit-motions.mjs';
import {SHOT} from './document.mjs';
import {recoveryCues,smooth} from './recovery-cues-r01.mjs';
export function sampleRecoveryActions(time){
 const cues=recoveryCues(time),idle=sampleMotion('idle',time*1.23+2.1),sway=sampleMotion('sway',time*1.37+.7);
 const attentionStart=cues.hornGone-.16,attentionLocal=(time-attentionStart)*1.9;
 const attention=time>=attentionStart&&attentionLocal<=3?sampleMotion('attention',attentionLocal):null;
 const talk=time>=SHOT.speechStart?sampleMotion('talk',(time-SHOT.speechStart)*1.4):null;
 const beckonStart=SHOT.speechStart+1.2,beckonLocal=(time-beckonStart)*1.45;
 const beckon=time>=beckonStart&&beckonLocal<=3.8?sampleMotion('beckon',beckonLocal):null;
 const follow=time>=SHOT.islandStart?sampleMotion('follow',(time-SHOT.islandStart)*1.35):null;
 return {cues,idle,sway,attention,talk,beckon,follow,attentionLocal,beckonLocal};
}

export async function loadDot({asset=globalThis.DOT_COMPONENT_ASSET,onStage=()=>{},sharedRig=null}={}){
 const rig=sharedRig||await loadSharedDot({asset,coordinates:'native',context:'stage',state:'trumpet',instrument:true}),n=rig.native;
 let camera=null,scene=null,frame=null,currentTime=0,lastAppearance=null,disposed=false;
 // Accepted vertex buffers are immutable. Cache rest/target bounds once rather
 // than scanning 72k horn triangles on each camera framing iteration.
 const faceCentre=new T.Vector3(),faceEye=new T.Vector3(),faceUp=new T.Vector3(),faceMatrix=new T.Matrix4(),faceQ=new T.Quaternion(),parentQ=new T.Quaternion();
 const hornBounds=n.horn.children.filter(o=>o.isMesh).map(mesh=>{if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const target=mesh.geometry.morphAttributes.position?.[0];return{mesh,base:mesh.geometry.boundingBox.clone(),target:target?new T.Box3().setFromBufferAttribute(target):null};});
 function cachedFace(cam){camera=cam;rig.setCamera(cam);faceEye.copy(cam.getWorldPosition(faceEye));faceUp.set(0,1,0).transformDirection(cam.matrixWorld);for(let i=0;i<3;i++){rig.root.updateWorldMatrix(true,true);n.body.geometry.boundingBox.getCenter(faceCentre).applyMatrix4(n.body.matrixWorld);faceQ.setFromRotationMatrix(faceMatrix.lookAt(faceEye,faceCentre,faceUp));rig.orientationRoot.quaternion.copy(rig.orientationRoot.parent.getWorldQuaternion(parentQ).invert()).multiply(faceQ);}rig.root.updateWorldMatrix(true,true);}
 function cachedBounds(){rig.root.updateWorldMatrix(true,true);const b=n.body.geometry.boundingBox.clone().applyMatrix4(n.body.matrixWorld);if(n.horn.visible)for(const p of hornBounds){const a=p.base.clone(),w=p.mesh.morphTargetInfluences?.[0]??0;if(p.target){a.min.lerp(p.target.min,w);a.max.lerp(p.target.max,w);}b.union(a.applyMatrix4(p.mesh.matrixWorld));}return b;}

 function commit(){if(!frame||!camera)return;rig.setState('trumpet');rig.setInstrumentVisible(true);return rig.applyFrame(frame,{camera,scene,bindEyes:false});}
 const api={...n,root:rig.root,canonicalRig:rig,sharedRig:rig,frontOnly:true,sharedAccepted:true,canonicalId:ACCEPTED_ID,
  prepareStageFrame(time,{camera:cam,scene:s,document}={}){camera=cam||camera;scene=s||scene;rig.setCamera(camera);if(document)rig.setDocument(document);currentTime=time;frame=rig.captureSequence(time);frame.t=time;commit();},
  // Director owns camera and world flight; accepted shared track owns local A morph/eyes/C response.
  applyPerformancePose(){},
  addBodyRoll(value){if(frame){frame.bodyRoll+=value;commit();}},
  addHatLift(value){if(frame){frame.hatLift+=value;commit();}},
  addMotionOffset(x=0,y=0,z=0){if(frame){const gain=rig.model.doc.motion.localDrift||1;frame.p.driftX+=x/gain;frame.p.driftY+=y/gain;frame.p.driftZ+=z/gain;commit();}},
  setBlink(value){if(frame){frame.blinkOpen=Math.max(.06,Math.min(1,value));frame.closed=value<.3;commit();}},
  getFrame(){return frame?{bodyRoll:frame.bodyRoll,totalBodyRoll:frame.bodyRoll,blinkOpen:frame.blinkOpen,hatLift:frame.hatLift,hatTilt:frame.hatTilt}:null;},
  applyStageActions(time){
   const a=sampleRecoveryActions(time),late=smooth(2,8,time),handoff=1-.76*a.cues.transferMix,variant=1+.12*Math.sin(time*.31+.15*Math.sin(time*.13));
   frame.p.driftX+=(a.sway.position[0]*.68+a.idle.position[0])*variant*late*handoff;
   frame.p.driftY+=(a.idle.position[1]*1.05+.065*Math.sin(time*3.1+.22*Math.sin(time*.63)))*handoff;
   frame.p.driftZ+=.12*Math.sin(time*1.87+.2*Math.sin(time*.81))*late*handoff;
   let roll=a.sway.rotation[2]*.20*late*handoff;
   if(a.attention){frame.p.driftY+=a.attention.position[1]*.48;roll+=a.attention.rotation[2]*.6;}
   if(a.talk&&time<SHOT.speechEnd){const w=smooth(SHOT.speechStart,SHOT.speechStart+.18,time)*(1-smooth(SHOT.speechEnd-.25,SHOT.speechEnd,time));frame.p.driftY+=a.talk.position[1]*2.6*w;roll+=a.talk.rotation[2]*1.8*w;}
   if(a.beckon){frame.p.driftY+=a.beckon.position[1]*1.3;frame.p.driftZ+=a.beckon.position[2]*.65;roll+=a.beckon.rotation[2];}
   if(a.follow){frame.p.driftX+=a.follow.position[0]*.6*handoff;frame.p.driftY+=a.follow.position[1]*.8*handoff;}
   // A/C accepted body-spin channel; never rotate eyes or expose the body side.
   frame.bodyRoll+=roll;commit();api.setHandoffAppearance({acceptedId:ACCEPTED_ID,contextMix:a.cues.backgroundMix});
   api.stageActionState={ids:[...frame.actionIds,'idle','sway',...(a.attention?['attention']:[]),...(a.talk&&time<SHOT.speechEnd?['talk']:[]),...(a.beckon?['beckon']:[]),...(a.follow?['follow']:[])],time,frame:api.getFrame(),appearance:lastAppearance,hornInfluence:n.morphs[0]?.morphTargetInfluences?.[0]??0};return api.stageActionState;
  },
  setHandoffAppearance(p){const contextMix=p.contextMix??p.mix??0;rig.setHandoffAppearance({acceptedId:ACCEPTED_ID,contextMix});lastAppearance={acceptedId:ACCEPTED_ID,contextMix,albedo:n.materials.body.color.getHexString()};},
  faceCamera:cachedFace,finalizeEyes(){return rig.finalizeEyes();},
  getEnsembleBounds:cachedBounds,
  captureHandoffFrame(){return frame?{...structuredClone(frame),acceptedId:ACCEPTED_ID}:null;},
  snapshot(){return{version:'D02 stage integration r01',acceptedId:ACCEPTED_ID,canonical:rig.snapshot(),actions:api.stageActionState,appearance:lastAppearance,frontOnly:true,browserVerified:false};},
  dispose(){if(disposed)return;disposed=true;rig.dispose();},
  integrationStatus:{acceptedModel:'D r02',geometryFrozen:true,realMorphs:24,particleSource:'r07d actual surface dissolve',browserVerified:false}
 };onStage('D02_accepted_shared_actor_loaded',0);return api;
}
