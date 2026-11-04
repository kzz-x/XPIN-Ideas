import * as THREE from './frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
export function makeEnvironment(){
  const w=1024,h=512,a=new Float32Array(w*h*4);
  const softRect=(x,y,cx,cy,hx,hy,edge)=>(1-THREE.MathUtils.smoothstep(Math.abs(x-cx),hx-edge,hx+edge))*(1-THREE.MathUtils.smoothstep(Math.abs(y-cy),hy-edge,hy+edge));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const phi=(x/w-.5)*Math.PI*2,theta=(y/h-.5)*Math.PI;
    const dx=Math.cos(phi)*Math.cos(theta),dy=Math.sin(theta),dz=Math.sin(phi)*Math.cos(theta);
    let r=.13,g=.135,b=.15;
    const add=(energy,red,green,blue)=>{r+=energy*red;g+=energy*green;b+=energy*blue;};
    // HDR radiance from feathered sources: long gradients rather than white bars.
    if(dz<-.001){const t=-5.2/dz,px=dx*t,py=dy*t+.2;
      add(4.1*softRect(px,py,0,.49,4.475,1.47,.30),.97,.98,1.);}
    if(dz>.001){const t=4.8/dz,px=dx*t,py=dy*t+.2;
      add(4.2*softRect(px,py,-2.1,2.5,1.6,1.85,.75),1.,.93,.77);
      add(3.1*softRect(px,py,3.65,1.1,1.05,2.7,.85),1.,.97,.91);
      add(.75*softRect(px,py,.3,-1.9,3.2,.85,.7),1.,.85,.63);}
    const i=(y*w+x)*4;a[i]=r;a[i+1]=g;a[i+2]=b;a[i+3]=1;
  }
  const texture=new THREE.DataTexture(a,w,h,THREE.RGBAFormat,THREE.FloatType);
  texture.colorSpace=THREE.LinearSRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}
