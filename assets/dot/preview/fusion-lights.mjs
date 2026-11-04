import * as T from '../model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {makeEnvironment} from '../model/a-environment-only.mjs';
function islandEnvironment(renderer){const env=new T.Scene();env.background=new T.Color(0xbbcadd);const room=new T.Mesh(new T.SphereGeometry(30,32,16),new T.MeshBasicMaterial({color:0xacc1d9,side:T.BackSide}));env.add(room);
 const panel=(w,h,p,color,intensity=1)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));m.position.set(...p);m.lookAt(0,0,0);env.add(m);};
 panel(11,8,[-8,12,-10],0xffe4bb,3);panel(18,12,[0,16,3],0xf4f4f7,1.8);panel(9,14,[9,5,7],0xc1ddff,1.4);panel(5,15,[-12,4,4],0xffdbaf,1.7);
 const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromScene(env,.1);pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target;
}
export function createLightPresets(scene,renderer){
 const stageHDR=makeEnvironment(),islandCache={target:null};let lights=[];
 const dir=(color,intensity,p)=>{const l=new T.DirectionalLight(color,intensity);l.position.set(...p);return l;};
 return {set(mode){for(const l of lights){scene.remove(l);l.dispose?.();}lights=[];
  if(mode==='island'){if(!islandCache.target)islandCache.target=islandEnvironment(renderer);scene.environment=islandCache.target.texture;scene.environmentIntensity=.48;renderer.toneMappingExposure=1.08;scene.background=new T.Color('#d9e5eb');lights=[new T.HemisphereLight(0xc2dcff,0xb3a99a,1.5),dir(0xffe4ba,4.8,[-4,11,-4]),dir(0xb7d7ff,1.4,[4,6,8]),dir(0xffd2a1,2,[-6,4,2])];}
  else if(mode==='stage'){scene.environment=stageHDR;scene.environmentIntensity=.58;renderer.toneMappingExposure=1;scene.background=new T.Color('#e7e5e0');lights=[new T.HemisphereLight(0xc1d2e6,0x070a10,.12),dir(0xe4edff,.65,[2.4,4.6,3.8]),dir(0xd6eaff,4,[2.5,3,-5]),dir(0xaac9ff,.8,[-4,1,-3])];}
  else {scene.environment=stageHDR;scene.environmentIntensity=.58;renderer.toneMappingExposure=1;scene.background=new T.Color('#e7e5e0');lights=[new T.HemisphereLight(0xe4e9f1,0x494949,.65),dir(0xffffff,2.1,[-3.5,4.5,5]),dir(0xeaf1ff,.55,[4,1,3]),dir(0xffffff,1.2,[-3,3,-4])];}
  const key=lights[1];key.castShadow=true;Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:35});key.shadow.mapSize.set(mode==='island'?2048:1024,mode==='island'?2048:1024);key.shadow.normalBias=.006;key.shadow.bias=-.0002;key.shadow.radius=4;scene.add(...lights);return {mode,environmentIntensity:scene.environmentIntensity,exposure:renderer.toneMappingExposure,lights:lights.map(l=>({type:l.type,color:l.color.getHexString(),intensity:l.intensity,position:l.position.toArray()}))};},
  dispose(){stageHDR.dispose();islandCache.target?.dispose();for(const l of lights){scene.remove(l);l.dispose?.();}}
 };
}