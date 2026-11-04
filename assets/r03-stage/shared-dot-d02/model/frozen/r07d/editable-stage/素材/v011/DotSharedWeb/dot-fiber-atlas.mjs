import * as T from '../../../../../../../../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';

// Seeded short curved fibres. Data only: no canvas, external texture, AI image,
// geometry or per-frame work. RGB = filament coverage / tuft / fine undercoat.
export function makeFiberAtlas(){
 const size=1024,coverage=new Float32Array(size*size);
 let state=0x6d2b79f5;const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
 function dab(x,y,r,energy){
  const ix=Math.floor(x),iy=Math.floor(y);
  // Only pixels whose centres can fall inside this dab need a distance test.
  // Preserve the original ascending visit order and exact hypot/coverage math.
  const x0=Math.max(-2,Math.ceil(x-r-.5)-ix),x1=Math.min(2,Math.floor(x+r-.5)-ix);
  const y0=Math.max(-2,Math.ceil(y-r-.5)-iy),y1=Math.min(2,Math.floor(y+r-.5)-iy);
  for(let dy=y0;dy<=y1;dy++)for(let dx=x0;dx<=x1;dx++){
   const d=Math.hypot(ix+dx+.5-x,iy+dy+.5-y),v=Math.max(0,1-d/r)*energy;
   const k=((iy+dy+size)%size)*size+(ix+dx+size)%size;
   coverage[k]=1-(1-coverage[k])*(1-v);
  }
 }
 for(let i=0;i<23500;i++){
  const x=rand()*size,y=rand()*size,a=rand()*Math.PI*2,l=12+rand()*31,curve=(rand()-.5)*1.7,r=.75+rand()*.65,energy=.32+rand()*.55;
  const steps=Math.ceil(l*1.8);
  for(let j=0;j<=steps;j++){
   const t=j/steps,angle=a+curve*(t-.5),bend=l*.19*Math.sin(t*Math.PI)*curve;
   const px=x+Math.cos(angle)*l*(t-.5)-Math.sin(a)*bend,py=y+Math.sin(angle)*l*(t-.5)+Math.cos(a)*bend;
   const taper=.35+.65*Math.sin(Math.PI*t)**.35;dab(px,py,r*taper,energy*taper*.55);
  }
 }
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=x+y*size,k=i*4,v=coverage[i];
  // Smooth, low-energy variation prevents a printed repeating-field appearance.
  const clump=.5+.25*Math.sin(x*.027+Math.sin(y*.019)*2)+.15*Math.sin(y*.041+x*.007);
  data[k]=Math.round(Math.min(1,v)*255);data[k+1]=Math.round(T.MathUtils.clamp(clump,0,1)*255);data[k+2]=Math.floor(rand()*255);data[k+3]=255;
 }
 const tex=new T.DataTexture(data,size,size,T.RGBAFormat,T.UnsignedByteType);tex.name='Dot / seeded short-fibre field';tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.colorSpace=T.NoColorSpace;tex.needsUpdate=true;
 return tex;
}
