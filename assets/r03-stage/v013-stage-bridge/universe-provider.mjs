import * as T from'../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
const smoother=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(6*x-15)+10)};
/** Reuses ONE identified, use-authorized image. Does not generate a replacement universe.
 * Slow UV is explicitly a still-image placeholder, not final particle geometry.
 */
export function sampleUniverseUV(time,{duration=644/60,sourceTimeOrigin=0,approvedCropUV=[0,0,1,1]}={}){const u=smoother((time-sourceTimeOrigin)/duration),repeat=1-.018*u,w=approvedCropUV[2]-approvedCropUV[0],h=approvedCropUV[3]-approvedCropUV[1];return{time,repeat:[repeat*w,repeat*h],offset:[approvedCropUV[0]+((1-repeat)/2+.003*u)*w,approvedCropUV[1]+((1-repeat)/2-.001*u)*h],finalParticles:false};}
export function createUniverseStillProvider(texture,{useAuthorized=false,qualityApproved=false,duration=644/60,sourceTimeOrigin=0,approvedCropUV=[0,0,1,1],sourceId=null}={}){
 if(!useAuthorized||!texture)throw Error('Missing explicitly authorized universe image input');texture.colorSpace=T.SRGBColorSpace;texture.matrixAutoUpdate=false;let revision=0,lastTransform='';
 return{texture,sourceId,qualityApproved,finalParticles:false,kind:qualityApproved?'APPROVED_STILL_SLOW_UV_PLACEHOLDER':'AUTHORIZED_EXISTING_STILL_PLACEHOLDER_NOT_QUALITY_APPROVED',sample(time){return sampleUniverseUV(time,{duration,sourceTimeOrigin,approvedCropUV});},update(time){const s=this.sample(time),key=[...s.offset,...s.repeat].join(':');texture.matrix.setUvTransform(s.offset[0],s.offset[1],s.repeat[0],s.repeat[1],0,0,0);if(key!==lastTransform){revision++;lastTransform=key;}return{...s,revision};},get revision(){return revision},dispose(){/* suppliedtexture ownership stayswith host */}};
}
