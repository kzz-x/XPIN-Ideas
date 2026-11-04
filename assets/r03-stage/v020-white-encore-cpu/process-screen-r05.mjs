import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createProcessVideoClock} from './process-video-clock-r05.mjs';
import {createOpeningScreenSource} from './opening-screen-source-r05.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=(a,b,t)=>{let u=clamp((t-a)/(b-a),0,1);return u*u*(3-2*u)};
export async function createProcessScreenMedia(stage,config,{onFrameReady=()=>{},isPlaying=()=>false}={}){
 const uri=globalThis.DOT_APPROVED_PROCESS_VIDEO;if(!uri)throw Error('Approved S26 v10 video is not embedded');
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';video.setAttribute('aria-hidden','true');document.body.append(video);
 video.src=uri;video.load();await new Promise((resolve,reject)=>{if(video.readyState>=2)return resolve();video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error('Embedded S26 video decode failed')),{once:true})});
 const START=2.1,FPS=30,duration=video.duration;if(Math.abs(duration-12)>.05)throw Error('S26 duration is not the verified12s adaptation');
 const texture=new T.VideoTexture(video);texture.colorSpace=T.NoColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
 let fadeStart=14.1,fadeDuration=1.25,whiteEnabled=true,revision=0,lastSignature='',disposed=false;
 let opening=await createOpeningScreenSource(globalThis.DOT_STAGE_OPENING_SOURCE,{onFrameReady,isPlaying,end:START});
 const uniforms={uWhiteMix:{value:0},uWhiteRadiance:{value:config.whiteScreenRadianceLinear},uProcessMix:{value:0},uProcessVideo:{value:texture},uOpeningVideo:{value:opening.texture}};
 const material=stage.screenMat,prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey;
 material.onBeforeCompile=function(shader,renderer){prior.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.fragmentShader=`uniform float uWhiteMix,uWhiteRadiance,uProcessMix;uniform sampler2D uProcessVideo,uOpeningVideo;
vec3 cdxSrgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
`+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
// The current S24 tail has not been handed off. Never revive the historical
// cosmos image, or mislabel the S26 process as the missing S25 opening.
vec3 openingPending=cdxSrgbToLinear(texture2D(uOpeningVideo,vMapUv).rgb);
vec3 process=cdxSrgbToLinear(texture2D(uProcessVideo,vMapUv).rgb);
vec3 screenContent=mix(openingPending,process,uProcessMix);
diffuseColor*=vec4(mix(screenContent,vec3(uWhiteRadiance),uWhiteMix),1.);
#endif`)};material.customProgramCacheKey=()=> 'cdx-r05-approved-s26-video-screen-v1';material.needsUpdate=true;
 const clock=createProcessVideoClock(video,{fps:FPS,duration,onDecodedFrame(){texture.needsUpdate=true;stage.backdrop.invalidate();if(isPlaying())onFrameReady();}});
 const targetFor=time=>clamp(Math.floor(Math.max(0,time-START)*FPS+1e-5)/FPS,0,Math.max(0,duration-1/FPS));
 async function requestSeek(target,notify=false){try{await clock.seek(target);}finally{if(notify)onFrameReady();}}
 async function seekExact(time){video.pause();await Promise.all([requestSeek(targetFor(time)),opening.seekExact(time)]);texture.needsUpdate=true;return state(time)}
 function state(time){const source=opening.snapshot();return{time,source:'S26 approved v10 / Library version9 / originalSHA242fc92f…e99afcf',sourceDuration:duration,sourceTime:targetFor(time),videoClock:clock.snapshot(),mediaCount:22,processMix:uniforms.uProcessMix.value,whiteMix:uniforms.uWhiteMix.value,emptyWhitePlaceholder:false,openingSource:source,openingSourceReady:!source.placeholder,requiresCurrentS24Tail:!source.approved,historicalCosmosUsed:false,revision}}
 function update(time,{sync=true}={}){
  if(disposed)throw Error('Disposed process media');opening.update(time,{sync});uniforms.uProcessMix.value=smooth(1.72,START,time);uniforms.uWhiteMix.value=whiteEnabled?smooth(fadeStart,fadeStart+fadeDuration,time):0;
  if(sync){const target=targetFor(time),active=time>=START&&time<START+duration;if(isPlaying()&&active){if(Math.abs(video.currentTime-(time-START))>.16&&!clock.busy)void requestSeek(target,true).catch(error=>console.error(error));if(video.paused&&!clock.busy)video.play().catch(()=>{});}else{video.pause();if(Math.abs(video.currentTime-target)>.0005||video.seeking)void requestSeek(target,true).catch(error=>console.error(error));}}
  const signature=[uniforms.uWhiteMix.value,uniforms.uProcessMix.value,Math.floor(video.currentTime*FPS)].join(':');if(signature!==lastSignature){revision++;lastSignature=signature;stage.backdrop.invalidate()}
  return state(time);
 }
 return{video,texture,uniforms,seekExact,update,async replaceOpeningSource(spec){const next=await createOpeningScreenSource(spec,{onFrameReady,isPlaying,end:START});if(disposed){next.dispose();throw Error('Disposed process media');}const prior=opening;opening=next;uniforms.uOpeningVideo.value=next.texture;prior.dispose();lastSignature='';stage.backdrop.invalidate();onFrameReady();return next.snapshot();},configure(next){fadeStart=next.fadeStart;fadeDuration=next.fadeDuration;whiteEnabled=next.whiteEnabled;uniforms.uWhiteRadiance.value=next.whiteRadiance;lastSignature=''},dispose(){disposed=true;opening.dispose();clock.dispose();video.pause();video.removeAttribute('src');video.load();video.remove();texture.dispose();material.onBeforeCompile=prior;material.customProgramCacheKey=priorKey;material.needsUpdate=true}};
}
