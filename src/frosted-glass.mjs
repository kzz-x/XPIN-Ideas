import * as T from 'three';
import {screenLines} from './screen-lines.mjs';
let grain,environment;
function frostTexture(){
  if(grain)return grain;const n=128,a=new Uint8Array(n*n);let seed=71831;
  for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=100+(seed>>>26);}
  grain=new T.DataTexture(a,n,n,T.RedFormat);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(8,8);grain.magFilter=T.LinearFilter;grain.needsUpdate=true;return grain;
}
export function frostedGlass({color=0xdce6ed,thickness=.28,roughness=.38,transmission=.86,...rest}={}){
  const m=new T.MeshPhysicalMaterial({color,metalness:0,roughness,transmission,thickness,ior:1.36,attenuationColor:0xb7cdd8,attenuationDistance:5,clearcoat:.12,clearcoatRoughness:.42,envMapIntensity:.6,bumpMap:frostTexture(),bumpScale:.0035,transparent:false,opacity:1,depthWrite:false,...rest});
  m.name='Frosted glass / rough transmission and real thickness';m.userData.frostedGlass=true;return m;
}
export function glassEnvironment(scene){
  if(!environment){const faces=[];for(let side=0;side<6;side++){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle=['#172334','#d5e0e9','#263b52','#111b2b','#4a5c6f','#101827'][side];x.fillRect(0,0,128,128);x.fillStyle=side===1?'#f4f6f7':'#bacbd7';x.fillRect(14,11,side===1?95:7,103);x.fillStyle='#34495e';x.fillRect(97,0,18,128);faces.push(c);}environment=new T.CubeTexture(faces);environment.colorSpace=T.SRGBColorSpace;environment.needsUpdate=true;}
  scene.environment=environment;scene.environmentIntensity=.45;return environment;
}
export function glassEdges(geometry,{color=0xc7d9e5,opacity=.38}={}){const edges=new T.EdgesGeometry(geometry,38),e=screenLines(T,edges.attributes.position.array,{color,opacity});edges.dispose();e.name='Glass edge / physical front and rear perimeter';return e;}
