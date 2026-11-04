import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';

// Capture the neutral mass centre in the accepted root frame once. Local
// breath/punch/hat deformation never feeds back into this floor-light target.
export function createMassFollower(dot,rig){
 const mass=new T.Vector3(),local=dot.body.geometry.boundingBox.getCenter(new T.Vector3()).applyMatrix4(dot.body.matrixWorld).applyMatrix4(rig.root.matrixWorld.clone().invert());
 return {sample(state,doc){
  const f=doc.flight,tempo=state.time>1.8?f.tempo:1,scale=[f.amplitudeX,f.amplitudeY,f.amplitudeZ];
  return {massTarget:mass.copy(local).applyMatrix4(rig.root.matrixWorld).toArray(),rootVelocity:state.rootVelocity.map((v,i)=>f.enabled?v*scale[i]*tempo:0)};
 }};
}
