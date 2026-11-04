import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {makeEncoreSeeds} from './concert-encore-timing-r05.mjs';
import {random} from './concert-physics-r04.mjs';

/** Preserve the original 1108 identities/physical samplers and the 316
 * music-end-linked releases. Earlier cohorts start at six seconds, across
 * actual world-space depth bands rather than a screen overlay. */
export function makeRecoverySeeds(kind,count,options){
 return makeEncoreSeeds(kind,count,options).map((s,i)=>{
  const layer=i%3,side=i%2?-1:1,r=k=>random(i,k+340),o={...s,depthLayer:['back','middle','front'][layer]};
  o.z=layer===0?-3.0+2.4*r(1):layer===1?1.0+2.0*r(1):4.8+1.2*r(1);
  o.vz*=.45;
  if(!s.lateEncoreCohort){
   if(kind==='spark')o.start=6+Math.floor(i/70)*2.1+.09*r(2);
   else o.start=6+(Math.floor(i/3)%3)*2.1+1.25*r(2);
  }
  if(layer===2){o.x=-.57+side*(1.3+1.2*r(3));o.vx*=.46;o.size*=kind==='spark'?.9:1.10;if(kind==='spark')o.y=1.0+.6*r(4);}
  else if(layer===0){o.x=-.57+side*(2.1+5.5*r(3));o.size*=.9;}
  return o;
 });
}

export function actorProtection(dot,camera){
 const box=dot.getEnsembleBounds?dot.getEnsembleBounds():new T.Box3().setFromObject(dot.body),min=new T.Vector2(Infinity,Infinity),max=new T.Vector2(-Infinity,-Infinity),v=new T.Vector3();
 for(let i=0;i<8;i++){v.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);min.min(v);max.max(v);}
 const centre=box.getCenter(new T.Vector3()).applyMatrix4(camera.matrixWorldInverse);
 return{min,max,depth:centre.z,camera};
}
export function foregroundVisibility(sample,protection){
 const p=new T.Vector3(sample.x,sample.y,sample.z).applyMatrix4(protection.camera.matrixWorldInverse);
 if(p.z<=protection.depth-.25)return 1; // ordinary depth handles the rear layer
 p.set(sample.x,sample.y,sample.z).project(protection.camera);
 const outside=Math.max(protection.min.x-p.x,p.x-protection.max.x,protection.min.y-p.y,p.y-protection.max.y),u=T.MathUtils.clamp((outside-.018)/.08,0,1);
 return u*u*(3-2*u);
}
