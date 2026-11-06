import * as T from 'three';
import {yieldTask} from './preparation.mjs';
import {warmTextures} from './texture-warm.mjs';
export async function warmScene(renderer,scene,camera,{onProgress=()=>{}}={}){
  // Match both display and offscreen material variants, in bounded batches.
  // Compiling a whole scene in one call still blocks JS on some GPU drivers.
  const objects=[],textures=new Set();scene.traverse(o=>{if(o.material&&camera.layers.test(o.layers)){objects.push(o);for(const m of(Array.isArray(o.material)?o.material:[o.material]))for(const v of Object.values(m))if(v?.isTexture&&!v.isVideoTexture)textures.add(v);}});
  const total=Math.max(1,textures.size+objects.length*2+objects.filter(o=>o.castShadow).length);let completed=0;onProgress(0);
  await warmTextures(renderer,textures,{onUploaded:()=>onProgress(++completed/total)});
  const target=new T.WebGLRenderTarget(8,8,{type:T.HalfFloatType}),previous=renderer.getRenderTarget();
  // Light-list setup traverses the lighting scene on each compile. Borrow
  // small read-only groups without changing parentage or visible transforms.
  const batchSize=objects.length<8?1:8;
  async function compileObjects(list,renderTarget){
    for(let i=0;i<list.length;i+=batchSize){
      const children=list.slice(i,i+batchSize),root=children.length===1?children[0]:new T.Group();
      if(children.length>1)root.children=children;
      let compile;try{renderer.setRenderTarget(renderTarget);compile=renderer.compileAsync(root,camera,scene);}finally{renderer.setRenderTarget(previous);}
      await compile;completed+=children.length;onProgress(completed/total);await yieldTask();
    }
  }
  for(const renderTarget of [null,target]){
    await compileObjects(objects,renderTarget);
  }
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.BackSide});
  const proxies=objects.filter(object=>object.castShadow).map(object=>{const proxy=object.clone(false);proxy.material=object.customDepthMaterial||depth;proxy.children=[];return proxy;});
  await compileObjects(proxies,target);
  depth.dispose();target.dispose();onProgress(1);
}

export async function warmEnvironment(renderer,environment,camera){
  const target=new T.Scene();target.environment=environment;const geometry=new T.SphereGeometry(1,8,6),material=new T.MeshStandardMaterial({roughness:.5,metalness:.2}),mesh=new T.Mesh(geometry,material);target.add(mesh);
  await renderer.compileAsync(mesh,camera,target);geometry.dispose();material.dispose();await yieldTask();
}
