import * as T from './frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
export function sampleResponseRoll(t){
 const up=smooth((t-.08)/.26),down=smooth((t-1.36)/.58);
 return{bodyRoll:2*Math.PI*smooth((t-.18)/1.18),hatLift:.209*up*(1-down),hatTilt:.017*Math.sin(Math.min(1,t/2.15)*Math.PI)*up*(1-down),blinkOpen:1};
}
