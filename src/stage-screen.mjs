import * as T from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createOpeningScreenSource} from '../assets/r03-stage/v020-white-encore-cpu/opening-screen-source-r05.mjs';

export function stageWhiteMix(time,start=1,duration=2){
  const p=Math.max(0,Math.min(1,(time-start)/Math.max(.001,duration)));
  return p*p*(3-2*p);
}

// Keep the film's decoder and audio clock. The stage screen fades directly
// from that same frame to pure white; no process film is loaded or played.
export async function createStageScreen(stage,config,{onFrameReady=()=>{},isPlaying=()=>false}={}){
  let fadeStart=config.fadeStart??1,fadeDuration=config.fadeDuration??2;
  let opening=await createOpeningScreenSource(globalThis.DOT_STAGE_OPENING_SOURCE,{onFrameReady,isPlaying,end:fadeStart+fadeDuration});
  let revision=0,lastSignature='',disposed=false;
  const uniforms={uOpeningScale:{value:new T.Vector2(1,1)},uWhiteMix:{value:0},uWhiteRadiance:{value:1},uOpeningVideo:{value:opening.texture}};
  const material=stage.screenMat,prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
    prior.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
    shader.fragmentShader=`uniform float uWhiteMix,uWhiteRadiance;uniform sampler2D uOpeningVideo;uniform vec2 uOpeningScale;
vec3 cdxSrgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
vec2 openingUV=(vMapUv-.5)/uOpeningScale+.5;
float openingMask=step(0.,openingUV.x)*step(openingUV.x,1.)*step(0.,openingUV.y)*step(openingUV.y,1.);
vec3 openingFrame=cdxSrgbToLinear(texture2D(uOpeningVideo,clamp(openingUV,0.,1.)).rgb)*openingMask;
diffuseColor*=vec4(mix(openingFrame,vec3(uWhiteRadiance),uWhiteMix),1.);
#endif`);
  };
  material.customProgramCacheKey=()=> 'linggan-stage-film-to-white-r21';material.needsUpdate=true;
  function state(time){const source=opening.snapshot();return{time,source:'shared film to pure white',processMix:0,processVideoLoaded:false,whiteMix:uniforms.uWhiteMix.value,whiteRadiance:1,openingSource:source,openingSourceReady:!source.placeholder,revision};}
  function update(time,{sync=true}={}){
    if(disposed)throw Error('Disposed stage screen');
    const input=globalThis.DOT_STAGE_OPENING_SOURCE?.element,aspect=input?.videoWidth/input?.videoHeight||16/9;
    uniforms.uOpeningScale.value.set(Math.min(1,aspect/(16/9)),Math.min(1,(16/9)/aspect));
    opening.update(time,{sync});uniforms.uWhiteMix.value=stageWhiteMix(time,fadeStart,fadeDuration);
    const signature=[uniforms.uWhiteMix.value,uniforms.uWhiteMix.value<1?Math.floor((input?.currentTime||0)*60):'white'].join(':');
    if(signature!==lastSignature){revision++;lastSignature=signature;stage.backdrop.invalidate();}
    return state(time);
  }
  return{uniforms,update,async seekExact(time){await opening.seekExact(time);return update(time,{sync:false});},
    // This adapter owns no media playback. Hiding a stage must not pause film.
    pause(){},
    async replaceOpeningSource(spec){const next=await createOpeningScreenSource(spec,{onFrameReady,isPlaying,end:fadeStart+fadeDuration});if(disposed){next.dispose();throw Error('Disposed stage screen');}const previous=opening;opening=next;uniforms.uOpeningVideo.value=next.texture;previous.dispose();lastSignature='';stage.backdrop.invalidate();onFrameReady();return next.snapshot();},
    dispose(){disposed=true;opening.dispose();material.onBeforeCompile=prior;material.customProgramCacheKey=priorKey;material.needsUpdate=true;}
  };
}
