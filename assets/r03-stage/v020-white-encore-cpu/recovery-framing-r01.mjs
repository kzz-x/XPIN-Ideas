import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {SHOT} from './document.mjs';

/** The r07d accepted camera track is supplied by its original director. Only
 * its existing slow pull and whole-ensemble centering run after that track. */
export function applyRecoveryFraming(stage,dot,time,state,layout,orbit={yaw:0,pitch:0}){
 const pullMix=T.MathUtils.smoothstep(time,SHOT.pullStart,SHOT.pullEnd),guideMix=T.MathUtils.smoothstep(time,SHOT.gameStart,SHOT.gameEnd);
 const desiredPos=new T.Vector3(layout.screen.x-.3,1.7,18.5),desiredTarget=new T.Vector3(layout.screen.x+.55,.72,0),aim=new T.Vector3(...state.target).lerp(desiredTarget,pullMix);
 if(pullMix>0)stage.camera.position.lerp(desiredPos,pullMix);
 const base=stage.camera.position.clone(),baseAim=aim.clone(),ensembleNear=T.MathUtils.smoothstep(time,4.8,10.2)*(1-pullMix)*(1-T.MathUtils.smoothstep(time,SHOT.musicEnd+.2,SHOT.musicEnd+1.6));
 stage.camera.lookAt(aim);stage.camera.updateMatrixWorld(true);
 for(let i=0;i<3;i++){
  dot.faceCamera(stage.camera);
  const actorWorld=dot.body.getWorldPosition(new T.Vector3()),centre=dot.getEnsembleBounds().getCenter(new T.Vector3()),shift=(centre.x-actorWorld.x)*ensembleNear;
  stage.camera.position.copy(base);stage.camera.position.x+=shift;aim.copy(baseAim);aim.x+=shift;stage.camera.lookAt(aim);stage.camera.updateMatrixWorld(true);
 }
 if(orbit.yaw||orbit.pitch){const rel=stage.camera.position.clone().sub(aim);rel.applyEuler(new T.Euler(orbit.pitch,orbit.yaw,0,'YXZ'));stage.camera.position.copy(aim).add(rel);stage.camera.lookAt(aim);stage.camera.updateMatrixWorld(true);}
 dot.faceCamera(stage.camera);
 return{pullMix,guideMix,actorWorld:dot.body.getWorldPosition(new T.Vector3()),mouthWorld:dot.anchor.getWorldPosition(new T.Vector3())};
}
