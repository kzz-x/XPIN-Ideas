import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createProcessVideoClock} from './process-video-clock-r05.mjs';
// Replaceable S25 input, separate from the approved S26 process film.
// No historical universe fallback, remote account, file picker or automatic upload.
export async function createOpeningScreenSource(input,{onFrameReady=()=>{},isPlaying=()=>false,end=2.1}={}){
 const spec={kind:'placeholder',label:'当前S24尾画待交接',status:'pending',fps:60,inPoint:0,...input};
 if(!['placeholder','image','video'].includes(spec.kind))throw Error('S25 source kind must be placeholder, image or video');
 if(!['pending','candidate','approved'].includes(spec.status))throw Error('S25 source status is invalid');
 if(!Number.isFinite(spec.inPoint)||spec.inPoint<0||![24,25,30,50,60].includes(spec.fps))throw Error('S25 media timing is invalid');
 if(spec.kind!=='placeholder'&&!(/^(data:|blob:)/.test(spec.uri||'')||new URL(spec.uri,location.href).origin===location.origin))throw Error('S25 source must be an embedded or explicitly chosen local blob');
 let element,texture,clock,disposed=false;
 if(spec.kind==='placeholder'){
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#080b10';ctx.fillRect(0,0,1280,720);
  ctx.fillStyle='#626e7d';ctx.textAlign='center';ctx.font='20px system-ui';ctx.fillText('S25 · 当前 S24 尾画待替换',640,348);
  ctx.font='13px system-ui';ctx.fillStyle='#424c59';ctx.fillText('独立审阅占位 · 不使用历史宇宙试片',640,382);
  texture=new T.CanvasTexture(canvas);
 }else if(spec.kind==='image'){
  element=new Image();element.src=spec.uri;await element.decode();texture=new T.Texture(element);texture.needsUpdate=true;
 }else{
  element=document.createElement('video');element.muted=true;element.playsInline=true;element.preload='auto';element.setAttribute('aria-hidden','true');
  element.style.cssText='position:fixed;left:-20000px;top:0;width:1px;height:1px;pointer-events:none';document.body.append(element);
  element.src=spec.uri;element.load();await new Promise((resolve,reject)=>{if(element.readyState>=2)return resolve();element.addEventListener('loadeddata',resolve,{once:true});element.addEventListener('error',()=>reject(Error('S25 embedded video could not decode')),{once:true});});
  if(!Number.isFinite(element.duration)||spec.inPoint>=element.duration)throw Error('S25 opening in-point is outside the source');
  texture=new T.VideoTexture(element);clock=createProcessVideoClock(element,{fps:spec.fps,duration:element.duration,onDecodedFrame(){texture.needsUpdate=true;if(isPlaying())onFrameReady();}});
 }
 texture.colorSpace=T.NoColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
 const target=time=>spec.inPoint+Math.max(0,Math.min(end,time));
 function snapshot(){return{kind:spec.kind,label:spec.label,status:spec.status,placeholder:spec.kind==='placeholder',approved:spec.kind!=='placeholder'&&spec.status==='approved',sha256:spec.sha256||null,inPoint:spec.inPoint,fps:spec.fps,duration:spec.kind==='video'?element.duration:null,sourceTooShort:spec.kind==='video'&&element.duration<spec.inPoint+end,clock:clock?.snapshot()||null};}
 async function seekExact(time){if(disposed)throw Error('Disposed S25 source');if(clock)await clock.seek(target(time));texture.needsUpdate=true;return snapshot();}
 function update(time,{sync=true}={}){
  if(disposed)throw Error('Disposed S25 source');
  if(clock&&sync){const t=clock.frameTarget(target(time));
   if(isPlaying()&&time>=0&&time<end){if(Math.abs(element.currentTime-t)>.16&&!clock.busy)void clock.seek(t).then(onFrameReady).catch(console.error);if(element.paused&&!clock.busy)element.play().catch(()=>{});}
   else{element.pause();if(Math.abs(element.currentTime-t)>.0005||element.seeking)void clock.seek(t).then(onFrameReady).catch(console.error);}
  }
  return snapshot();
 }
 return{texture,seekExact,update,snapshot,dispose(){disposed=true;clock?.dispose();if(spec.kind==='video'){element.pause();element.removeAttribute('src');element.load();element.remove();}texture.dispose();}};
}
