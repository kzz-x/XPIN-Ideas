import * as T from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
export const damp=(a,b,k,dt)=>T.MathUtils.lerp(a,b,1-Math.exp(-k*dt));
export const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
let glyphs;
export async function loadType(){glyphs=await (await fetch('./assets/type/title-glyphs.json')).json();return glyphs;}
const geoCache=new Map();
export function titleMesh(text,size=2,depth=.25){
  const g=new T.Group(),front=new T.MeshStandardMaterial({color:0xf4f5ee,roughness:.55,metalness:.1,side:T.DoubleSide}),side=new T.MeshStandardMaterial({color:0x777f91,roughness:.45,metalness:.25,side:T.DoubleSide});
  [...text].forEach((c,i)=>{let geo=geoCache.get(c);if(!geo){const d=glyphs[c]?.path;if(!d)return;const svg=new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="nonzero" d="${d.replace(/^F[01]\s*/, '')}"/></svg>`);let shapes=svg.paths.flatMap(p=>p.toShapes());geo=new T.ExtrudeGeometry(shapes,{depth:12,steps:1,bevelEnabled:true,bevelSize:.6,bevelThickness:.8,bevelSegments:1,curveSegments:3});geo.scale(.01,-.01,.01);const indices=[];for(let i=0;i<geo.attributes.position.count;i+=3)indices.push(i,i+2,i+1);geo.setIndex(indices);geo.computeBoundingBox();geo.translate(-.5,1.18,0);geoCache.set(c,geo);}
    const mesh=new T.Mesh(geo,[front,side]);mesh.scale.set(size,size,depth/.12);mesh.position.x=(i-(text.length-1)/2)*size*1.08;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);});
  return g;
}
export function label(text,width=5,height=.55,{color='#e8edf4',size=38,background=null,align='center'}={}){
  const c=document.createElement('canvas');c.width=1024;c.height=Math.max(80,Math.round(1024*height/width));const ctx=c.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);}ctx.fillStyle=color;ctx.font=`${size}px Idea,Microsoft YaHei,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,align==='left'?8:c.width/2,c.height/2);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide}));m.renderOrder=2;return m;
}
export function line(points,color=0xadc0df,opacity=.3){return new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity}));}
export function box(w,h,d,color=0x272e40,{metalness=.3,roughness=.5}={}){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,metalness,roughness}));m.castShadow=true;m.receiveShadow=true;return m;}
export function project(v,camera,w=innerWidth,h=innerHeight){const p=v.clone().project(camera);return {x:(p.x*.5+.5)*w,y:(-.5*p.y+.5)*h,visible:p.z<1&&p.z>-1&&Math.abs(p.x)<1.2&&Math.abs(p.y)<1.2};}
