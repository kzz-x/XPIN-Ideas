import * as T from 'three';
import {yieldTask} from './preparation.mjs';
export async function warmScene(renderer,scene,camera){
  // Match both display and offscreen material variants, in bounded batches.
  // Compiling a whole scene in one call still blocks JS on some GPU drivers.
  const objects=[],textures=new Set();scene.traverse(o=>{if(o.material&&camera.layers.test(o.layers)){objects.push(o);for(const m of(Array.isArray(o.material)?o.material:[o.material]))for(const v of Object.values(m))if(v?.isTexture&&!v.isVideoTexture)textures.add(v);}});
  for(const texture of textures){renderer.initTexture(texture);await new Promise(resolve=>requestAnimationFrame(resolve));}
  const target=new T.WebGLRenderTarget(8,8,{type:T.HalfFloatType}),previous=renderer.getRenderTarget();
  for(const renderTarget of [null,target]){
    for(const object of objects){let compile;try{renderer.setRenderTarget(renderTarget);compile=renderer.compileAsync(object,camera,scene);}finally{renderer.setRenderTarget(previous);}await compile;await yieldTask();}
  }
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.BackSide});
  for(const object of objects){if(!object.castShadow)continue;const proxy=object.clone(false);proxy.material=object.customDepthMaterial||depth;proxy.children=[];let compile;try{renderer.setRenderTarget(target);compile=renderer.compileAsync(proxy,camera,scene);}finally{renderer.setRenderTarget(previous);}await compile;await yieldTask();}
  depth.dispose();target.dispose();
}

export async function warmEnvironment(renderer,environment,camera){
  const target=new T.Scene();target.environment=environment;const geometry=new T.SphereGeometry(1,8,6),material=new T.MeshStandardMaterial({roughness:.5,metalness:.2}),mesh=new T.Mesh(geometry,material);target.add(mesh);
  await renderer.compileAsync(mesh,camera,target);geometry.dispose();material.dispose();await yieldTask();
}
