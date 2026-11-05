import * as T from 'three';
import {constrainedDevice,nextRasterScale} from './performance-budget.mjs';

// Raster quality only. This controller never changes presentation time,
// geometry, scene composition, or any of Dot's independent stage lights.
export function createRenderQuality({renderer,key,width=innerWidth,height=innerHeight,nativeDpr=devicePixelRatio}){
  let mode='balanced',w=width,h=height,scale=1,ratio=1,lastChange=performance.now()/1000,lastSample=lastChange;
  const constrained=constrainedDevice();
  let phase='',samples=[],changes=0;
  const gl=renderer.getContext(),msaaSamples=gl.getParameter(gl.SAMPLES),maxTexture=renderer.capabilities.maxTextureSize;
  const right=new T.Vector3(),up=new T.Vector3(),lightPosition=new T.Vector3(),shift=new T.Vector3();
  const profiles={balanced:{map:2048,radius:1.8,bias:-.00018,normalBias:.020,budget:4200000},high:{map:4096,radius:2.5,bias:-.00010,normalBias:.014,budget:6300000},low:{map:1024,radius:1,bias:-.0007,normalBias:.035,budget:1800000}};

  function desiredRatio(){
    const narrow=w<700,preferred=mode==='high'?2:mode==='low'?1:narrow?Math.min(2,Math.max(1.5,nativeDpr)):Math.min(1.75,Math.max(1.5,nativeDpr));
    const budgetLimit=Math.sqrt(profiles[mode].budget/(w*h));
    // Supersample a 1x desktop too. A native-DPR upper bound would silently
    // leave both Balanced and Fine rendering at 1x on common external screens.
    return Math.round(Math.max(.75,Math.min(preferred*scale*(mode==='balanced'&&constrained?.8:1),budgetLimit))*100)/100;
  }
  function applyRaster(){
    const next=desiredRatio();
    if(Math.abs(next-ratio)>.005||renderer.getPixelRatio()!==next){ratio=next;renderer.setPixelRatio(ratio);}
    renderer.setSize(w,h);
  }
  function applyShadow(){
    const p=profiles[mode],size=Math.min(maxTexture,w<700?Math.min(p.map,2048):p.map);
    if(key.shadow.mapSize.x!==size||key.shadow.mapSize.y!==size){
      key.shadow.mapSize.set(size,size);key.shadow.map?.dispose();key.shadow.map=null;key.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
    }
    key.shadow.radius=p.radius;key.shadow.bias=p.bias;key.shadow.normalBias=p.normalBias;
    // Retain the original bounded 36 x 42 light frustum: it includes the
    // 22-unit scroll and both side assemblies. Enlarging this wastes texels.
    renderer.shadowMap.enabled=mode!=='low';
  }
  function setMode(value){
    mode=Object.hasOwn(profiles,value)?value:'balanced';scale=1;samples=[];changes=0;lastChange=performance.now()/1000;applyShadow();applyRaster();
  }
  function resize(nextWidth,nextHeight){w=Math.max(1,nextWidth);h=Math.max(1,nextHeight);samples=[];applyShadow();applyRaster();}
  function sampleFrame({dt,time,phase:nextPhase}){
    if(nextPhase!==phase){phase=nextPhase;samples=[];lastSample=time;}
    if(mode!=='balanced'||!['intro','morph','chat','launch','scroll','stage'].includes(phase)||document.hidden||dt<=0||dt>1)return;
    // Sustained slow frames count too; ignoring them concealed weak devices.
    samples.push(dt*1000);if(samples.length>120)samples.shift();
    if(samples.length<60||time-lastSample<1.5)return;lastSample=time;
    const next=nextRasterScale(samples,scale,time-lastChange);
    if(next!==scale){scale=next;lastChange=time;changes++;samples=[];applyRaster();}
  }

  function stabilizeShadow({phase}){
    if(phase!=='scroll'||mode==='low')return;
    // Quantize the light translation in its own orthographic plane. Moving the
    // light and target equally preserves illumination and prevents sub-texel
    // crawling as the host moves the light along the scroll each frame.
    key.updateWorldMatrix(true,false);key.target.updateWorldMatrix(true,false);key.shadow.updateMatrices(key);
    const camera=key.shadow.camera,texelX=(camera.right-camera.left)/key.shadow.mapSize.x,texelY=(camera.top-camera.bottom)/key.shadow.mapSize.y;
    right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);lightPosition.setFromMatrixPosition(key.matrixWorld);
    const x=lightPosition.dot(right),y=lightPosition.dot(up);
    shift.copy(right).multiplyScalar(Math.round(x/texelX)*texelX-x).addScaledVector(up,Math.round(y/texelY)*texelY-y);
    key.position.add(shift);key.target.position.add(shift);key.updateWorldMatrix(true,false);key.target.updateWorldMatrix(true,false);
  }
  function snapshot(){const camera=key.shadow.camera;return{mode,constrained,nativeDpr,renderDpr:ratio,adaptiveScale:scale,adaptiveChanges:changes,buffer:[renderer.domElement.width,renderer.domElement.height],msaaSamples,shadow:{enabled:renderer.shadowMap.enabled,type:'PCF',map:key.shadow.mapSize.toArray(),worldScope:[camera.right-camera.left,camera.top-camera.bottom],worldTexel:[(camera.right-camera.left)/key.shadow.mapSize.x,(camera.top-camera.bottom)/key.shadow.mapSize.y],radius:key.shadow.radius,bias:key.shadow.bias,normalBias:key.shadow.normalBias,stabilized:phase==='scroll'}};}
  setMode(mode);return{setMode,resize,sampleFrame,stabilizeShadow,snapshot};
}
